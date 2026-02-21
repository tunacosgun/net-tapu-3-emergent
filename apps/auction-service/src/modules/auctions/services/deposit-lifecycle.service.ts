import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Deposit, DepositTransition, PaymentLedger, Refund } from '@nettapu/shared';
import { SettlementManifest } from '../entities/settlement-manifest.entity';
import {
  PAYMENT_SERVICE,
  IPaymentService,
  CircuitOpenError,
} from './payment.service';
import { executeWithRetry } from '../utils/db-retry.util';
import { MetricsService } from '../../../metrics/metrics.service';
import { SettlementManifestItem, MAX_RETRIES } from './settlement.service';

@Injectable()
export class DepositLifecycleService {
  private readonly logger = new Logger(DepositLifecycleService.name);

  constructor(
    @InjectRepository(Deposit)
    private readonly depositRepo: Repository<Deposit>,
    private readonly dataSource: DataSource,
    @Inject(PAYMENT_SERVICE)
    private readonly paymentService: IPaymentService,
    private readonly metrics: MetricsService,
  ) {}

  // ── Capture ─────────────────────────────────────────────────────

  async processCaptureItem(
    manifest: SettlementManifest,
    item: SettlementManifestItem,
  ): Promise<SettlementManifestItem> {
    // Re-read deposit current state (outside TX for fresh read)
    const deposit = await this.depositRepo.findOne({ where: { id: item.deposit_id } });

    if (!deposit) {
      item.status = 'failed';
      item.failure_reason = 'Deposit not found';
      item.retry_count++;
      return item;
    }

    // Idempotent: already captured (POS succeeded, DB recorded on previous attempt)
    if (deposit.status === 'captured') {
      item.status = 'acknowledged';
      item.acknowledged_at = new Date().toISOString();
      this.logger.log(
        JSON.stringify({
          event: 'settlement_item_idempotent',
          action: 'capture',
          deposit_id: item.deposit_id,
          deposit_status: 'captured',
        }),
      );
      return item;
    }

    if (deposit.status !== 'held') {
      item.status = 'failed';
      item.failure_reason = `Unexpected deposit status: ${deposit.status}`;
      item.retry_count++;
      return item;
    }

    // Mark as sent before POS call
    item.status = 'sent';
    item.sent_at = new Date().toISOString();

    try {
      const result = await this.paymentService.captureDeposit({
        depositId: deposit.id,
        posTransactionId: deposit.posTransactionId,
        posProvider: deposit.posProvider,
        amount: deposit.amount,
        currency: deposit.currency,
        idempotencyKey: item.idempotency_key,
        metadata: { auctionId: manifest.auctionId, manifestId: manifest.id },
      });

      if (!result.success) {
        item.status = 'failed';
        item.failure_reason = result.message;
        item.retry_count++;
        return item;
      }

      item.pos_reference = result.posReference;

      // Record transition in DB (with transient failure retry)
      await executeWithRetry(
        () => this.recordCaptureInDb(deposit, item),
        { context: `capture_db:${item.deposit_id}` },
      );

      item.status = 'acknowledged';
      item.acknowledged_at = new Date().toISOString();
      return item;
    } catch (err) {
      // CircuitOpenError — POS was not called, safe to retry without re-check
      if (err instanceof CircuitOpenError) {
        item.status = 'failed';
        item.failure_reason = err.message;
        item.retry_count++;
        this.logger.warn(
          JSON.stringify({
            event: 'settlement_item_circuit_open',
            action: 'capture',
            deposit_id: item.deposit_id,
            retry_count: item.retry_count,
          }),
        );
        return item;
      }

      // CRITICAL: POS may have succeeded but DB write failed.
      // Re-check deposit status to detect this case.
      const recheckDeposit = await this.depositRepo.findOne({ where: { id: item.deposit_id } });
      if (recheckDeposit?.status === 'captured') {
        // POS call succeeded AND DB was somehow updated (or another instance handled it).
        item.status = 'acknowledged';
        item.acknowledged_at = new Date().toISOString();
        this.logger.warn(
          JSON.stringify({
            event: 'settlement_item_recovered',
            action: 'capture',
            deposit_id: item.deposit_id,
            error: (err as Error).message,
          }),
        );
        return item;
      }

      item.status = 'failed';
      item.failure_reason = (err as Error).message;
      item.retry_count++;
      this.logger.error(
        JSON.stringify({
          event: 'settlement_item_failed',
          action: 'capture',
          deposit_id: item.deposit_id,
          retry_count: item.retry_count,
          max_retries: MAX_RETRIES,
          error: (err as Error).message,
        }),
      );
      return item;
    }
  }

  private async recordCaptureInDb(
    deposit: Deposit,
    item: SettlementManifestItem,
  ): Promise<void> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // Lock deposit for atomic state transition
      const locked = await qr.manager
        .createQueryBuilder(Deposit, 'd')
        .setLock('pessimistic_write')
        .where('d.id = :id', { id: deposit.id })
        .getOne();

      if (!locked || locked.status !== 'held') {
        // Already transitioned (idempotent) — not an error
        await qr.rollbackTransaction();
        return;
      }

      // Transition: held → captured (DB trigger validates)
      locked.status = 'captured';
      await qr.manager.save(Deposit, locked);

      // Append deposit transition (audit trail)
      await qr.manager.save(DepositTransition, qr.manager.create(DepositTransition, {
        depositId: deposit.id,
        fromStatus: 'held',
        toStatus: 'captured',
        event: 'deposit_captured',
        reason: 'Settlement capture',
        metadata: {
          auctionId: item.idempotency_key.split(':')[1],
          idempotencyKey: item.idempotency_key,
          posReference: item.pos_reference,
        },
      }));

      // Append payment ledger (financial record)
      await qr.manager.save(PaymentLedger, qr.manager.create(PaymentLedger, {
        depositId: deposit.id,
        event: 'deposit_captured',
        amount: deposit.amount,
        currency: deposit.currency,
        metadata: {
          auctionId: item.idempotency_key.split(':')[1],
          idempotencyKey: item.idempotency_key,
          posReference: item.pos_reference,
        },
      }));

      await qr.commitTransaction();
    } catch (err) {
      if (qr.isTransactionActive) {
        await qr.rollbackTransaction();
      }
      throw err;
    } finally {
      await qr.release();
    }
  }

  // ── Refund ──────────────────────────────────────────────────────

  async processRefundItem(
    manifest: SettlementManifest,
    item: SettlementManifestItem,
  ): Promise<SettlementManifestItem> {
    const deposit = await this.depositRepo.findOne({ where: { id: item.deposit_id } });

    if (!deposit) {
      item.status = 'failed';
      item.failure_reason = 'Deposit not found';
      item.retry_count++;
      return item;
    }

    // Idempotent: already fully refunded
    if (deposit.status === 'refunded') {
      item.status = 'acknowledged';
      item.acknowledged_at = new Date().toISOString();
      this.logger.log(
        JSON.stringify({
          event: 'settlement_item_idempotent',
          action: 'refund',
          deposit_id: item.deposit_id,
          deposit_status: 'refunded',
        }),
      );
      return item;
    }

    // Crash recovery: POS call may have succeeded but worker crashed before DB update.
    // Deposit is still refund_pending — skip initiation, retry POS call.
    if (deposit.status === 'refund_pending') {
      return this.executeRefundPosCall(manifest, deposit, item);
    }

    if (deposit.status !== 'held') {
      item.status = 'failed';
      item.failure_reason = `Unexpected deposit status: ${deposit.status}`;
      item.retry_count++;
      return item;
    }

    // Step 1: Transition held → refund_pending + create refund record (atomic TX, with retry)
    const initiated = await executeWithRetry(
      () => this.recordRefundInitiationInDb(deposit, item),
      { context: `refund_init_db:${item.deposit_id}` },
    );
    if (!initiated) {
      // Deposit was concurrently transitioned — re-read and check
      const recheck = await this.depositRepo.findOne({ where: { id: item.deposit_id } });
      if (recheck?.status === 'refunded') {
        item.status = 'acknowledged';
        item.acknowledged_at = new Date().toISOString();
        return item;
      }
      if (recheck?.status === 'refund_pending') {
        return this.executeRefundPosCall(manifest, recheck, item);
      }
      item.status = 'failed';
      item.failure_reason = `Initiation failed: deposit status=${recheck?.status ?? 'unknown'}`;
      item.retry_count++;
      return item;
    }

    // Step 2: POS call + finalize (outside TX)
    return this.executeRefundPosCall(manifest, deposit, item);
  }

  /**
   * Returns true if initiation succeeded, false if deposit was already transitioned.
   */
  private async recordRefundInitiationInDb(
    deposit: Deposit,
    item: SettlementManifestItem,
  ): Promise<boolean> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const locked = await qr.manager
        .createQueryBuilder(Deposit, 'd')
        .setLock('pessimistic_write')
        .where('d.id = :id', { id: deposit.id })
        .getOne();

      if (!locked || locked.status !== 'held') {
        await qr.rollbackTransaction();
        return false;
      }

      // Transition: held → refund_pending (DB trigger validates)
      locked.status = 'refund_pending';
      await qr.manager.save(Deposit, locked);

      // Append deposit transition
      await qr.manager.save(DepositTransition, qr.manager.create(DepositTransition, {
        depositId: deposit.id,
        fromStatus: 'held',
        toStatus: 'refund_pending',
        event: 'deposit_refund_initiated',
        reason: 'Settlement refund',
        metadata: {
          auctionId: item.idempotency_key.split(':')[1],
          idempotencyKey: item.idempotency_key,
        },
      }));

      // Append payment ledger
      await qr.manager.save(PaymentLedger, qr.manager.create(PaymentLedger, {
        depositId: deposit.id,
        event: 'deposit_refund_initiated',
        amount: deposit.amount,
        currency: deposit.currency,
        metadata: {
          auctionId: item.idempotency_key.split(':')[1],
          idempotencyKey: item.idempotency_key,
        },
      }));

      // Create refund record
      await qr.manager.save(Refund, qr.manager.create(Refund, {
        depositId: deposit.id,
        amount: deposit.amount,
        currency: deposit.currency,
        reason: 'Auction settlement: losing bidder refund',
        status: 'pending',
        idempotencyKey: item.idempotency_key,
        initiatedAt: new Date(),
      }));

      await qr.commitTransaction();
      return true;
    } catch (err) {
      if (qr.isTransactionActive) {
        await qr.rollbackTransaction();
      }
      throw err;
    } finally {
      await qr.release();
    }
  }

  private async executeRefundPosCall(
    manifest: SettlementManifest,
    deposit: Deposit,
    item: SettlementManifestItem,
  ): Promise<SettlementManifestItem> {
    item.status = 'sent';
    item.sent_at = new Date().toISOString();

    try {
      const result = await this.paymentService.refundDeposit({
        depositId: deposit.id,
        posTransactionId: deposit.posTransactionId,
        posProvider: deposit.posProvider,
        amount: deposit.amount,
        currency: deposit.currency,
        idempotencyKey: item.idempotency_key,
        metadata: { auctionId: manifest.auctionId, manifestId: manifest.id },
      });

      if (!result.success) {
        item.status = 'failed';
        item.failure_reason = result.message;
        item.retry_count++;
        return item;
      }

      item.pos_reference = result.posRefundId;

      // Finalize in DB: refund_pending → refunded (with transient failure retry)
      await executeWithRetry(
        () => this.recordRefundCompletionInDb(deposit, item, result.posRefundId),
        { context: `refund_complete_db:${item.deposit_id}` },
      );

      item.status = 'acknowledged';
      item.acknowledged_at = new Date().toISOString();
      return item;
    } catch (err) {
      // CircuitOpenError — POS was not called, safe to retry without re-check
      if (err instanceof CircuitOpenError) {
        item.status = 'failed';
        item.failure_reason = err.message;
        item.retry_count++;
        this.logger.warn(
          JSON.stringify({
            event: 'settlement_item_circuit_open',
            action: 'refund',
            deposit_id: item.deposit_id,
            retry_count: item.retry_count,
          }),
        );
        return item;
      }

      // CRITICAL: POS may have succeeded but DB write failed.
      // Re-check deposit status to detect this case.
      const recheckDeposit = await this.depositRepo.findOne({ where: { id: item.deposit_id } });
      if (recheckDeposit?.status === 'refunded') {
        item.status = 'acknowledged';
        item.acknowledged_at = new Date().toISOString();
        this.logger.warn(
          JSON.stringify({
            event: 'settlement_item_recovered',
            action: 'refund',
            deposit_id: item.deposit_id,
            error: (err as Error).message,
          }),
        );
        return item;
      }

      item.status = 'failed';
      item.failure_reason = (err as Error).message;
      item.retry_count++;
      this.logger.error(
        JSON.stringify({
          event: 'settlement_item_failed',
          action: 'refund',
          deposit_id: item.deposit_id,
          retry_count: item.retry_count,
          max_retries: MAX_RETRIES,
          error: (err as Error).message,
        }),
      );
      return item;
    }
  }

  private async recordRefundCompletionInDb(
    deposit: Deposit,
    item: SettlementManifestItem,
    posRefundId: string | null,
  ): Promise<void> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const locked = await qr.manager
        .createQueryBuilder(Deposit, 'd')
        .setLock('pessimistic_write')
        .where('d.id = :id', { id: deposit.id })
        .getOne();

      if (!locked || locked.status !== 'refund_pending') {
        // Already refunded (idempotent) — not an error
        await qr.rollbackTransaction();
        return;
      }

      // Transition: refund_pending → refunded (DB trigger validates)
      locked.status = 'refunded';
      await qr.manager.save(Deposit, locked);

      // Append deposit transition
      await qr.manager.save(DepositTransition, qr.manager.create(DepositTransition, {
        depositId: deposit.id,
        fromStatus: 'refund_pending',
        toStatus: 'refunded',
        event: 'deposit_refunded',
        reason: 'Settlement refund completed',
        metadata: {
          auctionId: item.idempotency_key.split(':')[1],
          idempotencyKey: item.idempotency_key,
          posRefundId,
        },
      }));

      // Append payment ledger
      await qr.manager.save(PaymentLedger, qr.manager.create(PaymentLedger, {
        depositId: deposit.id,
        event: 'deposit_refunded',
        amount: deposit.amount,
        currency: deposit.currency,
        metadata: {
          auctionId: item.idempotency_key.split(':')[1],
          idempotencyKey: item.idempotency_key,
          posRefundId,
        },
      }));

      // Update refund record
      await qr.manager
        .createQueryBuilder()
        .update(Refund)
        .set({
          status: 'completed',
          posRefundId,
          completedAt: new Date(),
        })
        .where('idempotencyKey = :key', { key: item.idempotency_key })
        .execute();

      await qr.commitTransaction();
    } catch (err) {
      if (qr.isTransactionActive) {
        await qr.rollbackTransaction();
      }
      throw err;
    } finally {
      await qr.release();
    }
  }
}

import { Injectable, Logger, Inject, Optional, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  PaymentLedger,
  LedgerEvent,
  PaymentStatus,
  IPosGateway,
  POS_GATEWAY,
  Refund,
} from '@nettapu/shared';
import { Payment } from '../entities/payment.entity';
import { ReconciliationRun } from '../entities/reconciliation-run.entity';
import { MetricsService } from '../../../metrics/metrics.service';

const DEFAULT_INTERVAL_MS = 300_000; // 5 minutes
const PENDING_STALE_MINUTES = 30;
const AWAITING_3DS_STALE_MINUTES = 15;
const REFUND_STALE_MINUTES = 30;
const BATCH_SIZE = 50;

@Injectable()
export class ReconciliationWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReconciliationWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Refund)
    private readonly refundRepo: Repository<Refund>,
    @InjectRepository(ReconciliationRun)
    private readonly runRepo: Repository<ReconciliationRun>,
    @Inject(POS_GATEWAY)
    private readonly posGateway: IPosGateway,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  onModuleInit() {
    const enabled = this.config.get<string>('RECONCILIATION_ENABLED', 'false') === 'true';
    if (!enabled) {
      this.logger.log('Reconciliation worker: DISABLED');
      return;
    }

    const intervalMs = this.config.get<number>('RECONCILIATION_INTERVAL_MS', DEFAULT_INTERVAL_MS);
    this.logger.log(
      JSON.stringify({
        event: 'reconciliation_worker_started',
        interval_ms: intervalMs,
      }),
    );

    this.timer = setInterval(() => this.tick(), intervalMs);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async tick(): Promise<void> {
    if (this.running) {
      this.logger.debug('Reconciliation tick skipped — previous run still active');
      return;
    }

    // Distributed lock: only one instance runs reconciliation at a time
    const lockResult = await this.dataSource.query(
      "SELECT pg_try_advisory_lock(hashtext('nettapu_reconciliation_tick')) AS acquired",
    );
    if (!lockResult[0]?.acquired) {
      this.logger.debug('Reconciliation tick skipped — another instance holds the lock');
      return;
    }

    this.running = true;
    const run: ReconciliationRun = this.runRepo.create({
      startedAt: new Date(),
      paymentsChecked: 0,
      mismatchesFound: 0,
      mismatchesResolved: 0,
      errors: 0,
    });

    try {
      await this.runRepo.save(run);

      // 1. Stale pending payments (> 30 min)
      const stalePending = await this.paymentRepo.find({
        where: {
          status: In(['pending']),
          createdAt: LessThan(new Date(Date.now() - PENDING_STALE_MINUTES * 60_000)),
        },
        take: BATCH_SIZE,
        order: { createdAt: 'ASC' },
      });

      // 2. Stale awaiting_3ds payments (> 15 min since 3DS initiated)
      const stale3ds = await this.paymentRepo.find({
        where: {
          status: In(['awaiting_3ds']),
          threeDsInitiatedAt: LessThan(new Date(Date.now() - AWAITING_3DS_STALE_MINUTES * 60_000)),
        },
        take: BATCH_SIZE,
        order: { threeDsInitiatedAt: 'ASC' },
      });

      // 3. Stale pending refunds (> 30 min)
      const staleRefunds = await this.refundRepo.find({
        where: {
          status: 'pending',
          initiatedAt: LessThan(new Date(Date.now() - REFUND_STALE_MINUTES * 60_000)),
        },
        take: BATCH_SIZE,
        order: { initiatedAt: 'ASC' },
      });

      const allStalePayments = [...stalePending, ...stale3ds];
      run.paymentsChecked = allStalePayments.length + staleRefunds.length;

      // Process each stale payment
      for (const payment of allStalePayments) {
        try {
          await this.reconcilePayment(payment, run);
        } catch (err) {
          run.errors++;
          this.logger.error(
            JSON.stringify({
              event: 'reconciliation_payment_error',
              payment_id: payment.id,
              error: (err as Error).message,
            }),
          );
        }
      }

      // Log stale refunds (query POS if supported)
      for (const refund of staleRefunds) {
        try {
          await this.reconcileRefund(refund, run);
        } catch (err) {
          run.errors++;
          this.logger.error(
            JSON.stringify({
              event: 'reconciliation_refund_error',
              refund_id: refund.id,
              error: (err as Error).message,
            }),
          );
        }
      }

      run.completedAt = new Date();
      run.details = {
        stalePendingCount: stalePending.length,
        stale3dsCount: stale3ds.length,
        staleRefundCount: staleRefunds.length,
      };
      await this.runRepo.save(run);

      const tickDurationMs = run.completedAt.getTime() - run.startedAt.getTime();
      this.metrics?.reconciliationTickTotal.inc({ result: 'success' });
      this.metrics?.reconciliationTickDurationMs.observe(tickDurationMs);

      this.logger.log(
        JSON.stringify({
          event: 'reconciliation_tick_complete',
          run_id: run.id,
          checked: run.paymentsChecked,
          mismatches: run.mismatchesFound,
          resolved: run.mismatchesResolved,
          errors: run.errors,
          duration_ms: tickDurationMs,
        }),
      );
    } catch (err) {
      this.metrics?.reconciliationTickTotal.inc({ result: 'error' });
      this.logger.error(
        JSON.stringify({
          event: 'reconciliation_tick_error',
          error: (err as Error).message,
        }),
      );
    } finally {
      this.running = false;
      await this.dataSource.query(
        "SELECT pg_advisory_unlock(hashtext('nettapu_reconciliation_tick'))",
      ).catch(() => { /* lock auto-releases on disconnect */ });
    }
  }

  private async reconcilePayment(payment: Payment, run: ReconciliationRun): Promise<void> {
    if (!this.posGateway.queryTransactionStatus) {
      // Provider doesn't support status query — expire stale 3DS
      if (payment.status === PaymentStatus.AWAITING_3DS) {
        await this.expirePayment(payment, '3DS timed out — no status query available');
        run.mismatchesFound++;
        run.mismatchesResolved++;
      }
      return;
    }

    // Query POS for actual status
    const posStatus = await this.posGateway.queryTransactionStatus(
      payment.posTransactionToken || payment.id,
    );

    if (!posStatus.found) {
      // POS doesn't know about this payment — expire it
      if (payment.status === PaymentStatus.AWAITING_3DS) {
        await this.expirePayment(payment, 'POS has no record of this transaction');
        run.mismatchesFound++;
        run.mismatchesResolved++;
      }
      return;
    }

    // POS says paid but our DB says pending/awaiting_3ds
    if (
      posStatus.status === 'completed' ||
      posStatus.status === 'SUCCESS' ||
      posStatus.status === 'success'
    ) {
      run.mismatchesFound++;
      await this.resolveAsPaid(payment, posStatus.posReference || null);
      run.mismatchesResolved++;
      return;
    }

    // POS says failed — mark our payment as failed
    if (
      posStatus.status === 'failed' ||
      posStatus.status === 'FAILURE' ||
      posStatus.status === 'failure'
    ) {
      run.mismatchesFound++;
      await this.expirePayment(payment, `POS reports failed: ${posStatus.status}`);
      run.mismatchesResolved++;
    }
  }

  private async reconcileRefund(refund: Refund, run: ReconciliationRun): Promise<void> {
    // For now, just log stale refunds. POS refund status query
    // can be added when providers support it.
    this.logger.warn(
      JSON.stringify({
        event: 'reconciliation_stale_refund',
        refund_id: refund.id,
        amount: refund.amount,
        stale_minutes: Math.round((Date.now() - refund.initiatedAt.getTime()) / 60_000),
      }),
    );
    run.mismatchesFound++;
    this.metrics?.reconciliationMismatchTotal.inc({ original_status: 'pending_refund', resolution: 'stale_refund' });
  }

  private async resolveAsPaid(payment: Payment, posReference: string | null): Promise<void> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const locked = await qr.manager
        .createQueryBuilder(Payment, 'p')
        .setLock('pessimistic_write')
        .where('p.id = :id', { id: payment.id })
        .getOne();

      if (!locked || (locked.status !== PaymentStatus.PENDING && locked.status !== PaymentStatus.AWAITING_3DS)) {
        await qr.rollbackTransaction();
        return;
      }

      locked.status = PaymentStatus.PROVISIONED;
      await qr.manager.save(Payment, locked);

      await qr.manager.save(
        PaymentLedger,
        qr.manager.create(PaymentLedger, {
          paymentId: payment.id,
          event: LedgerEvent.RECONCILIATION_MISMATCH,
          amount: payment.amount,
          currency: payment.currency,
          metadata: {
            original_status: payment.status,
            pos_reference: posReference,
            resolution: 'marked_provisioned',
          },
        }),
      );

      await qr.manager.save(
        PaymentLedger,
        qr.manager.create(PaymentLedger, {
          paymentId: payment.id,
          event: LedgerEvent.RECONCILIATION_RESOLVED,
          amount: payment.amount,
          currency: payment.currency,
          metadata: {
            pos_reference: posReference,
            resolved_by: 'reconciliation_worker',
          },
        }),
      );

      await qr.commitTransaction();

      this.metrics?.reconciliationMismatchTotal.inc({ original_status: payment.status, resolution: 'marked_provisioned' });

      this.logger.warn(
        JSON.stringify({
          event: 'reconciliation_resolved_as_paid',
          payment_id: payment.id,
          original_status: payment.status,
          pos_reference: posReference,
        }),
      );
    } catch (err) {
      if (qr.isTransactionActive) {
        await qr.rollbackTransaction();
      }
      throw err;
    } finally {
      await qr.release();
    }
  }

  private async expirePayment(payment: Payment, reason: string): Promise<void> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const locked = await qr.manager
        .createQueryBuilder(Payment, 'p')
        .setLock('pessimistic_write')
        .where('p.id = :id', { id: payment.id })
        .getOne();

      if (!locked || (locked.status !== PaymentStatus.PENDING && locked.status !== PaymentStatus.AWAITING_3DS)) {
        await qr.rollbackTransaction();
        return;
      }

      locked.status = PaymentStatus.FAILED;
      await qr.manager.save(Payment, locked);

      await qr.manager.save(
        PaymentLedger,
        qr.manager.create(PaymentLedger, {
          paymentId: payment.id,
          event: LedgerEvent.RECONCILIATION_MISMATCH,
          amount: payment.amount,
          currency: payment.currency,
          metadata: {
            original_status: payment.status,
            reason,
            resolution: 'marked_failed',
          },
        }),
      );

      await qr.manager.save(
        PaymentLedger,
        qr.manager.create(PaymentLedger, {
          paymentId: payment.id,
          event: LedgerEvent.RECONCILIATION_RESOLVED,
          amount: payment.amount,
          currency: payment.currency,
          metadata: {
            reason,
            resolved_by: 'reconciliation_worker',
          },
        }),
      );

      await qr.commitTransaction();

      this.metrics?.reconciliationMismatchTotal.inc({ original_status: payment.status, resolution: 'marked_failed' });

      this.logger.warn(
        JSON.stringify({
          event: 'reconciliation_expired_payment',
          payment_id: payment.id,
          original_status: payment.status,
          reason,
        }),
      );
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

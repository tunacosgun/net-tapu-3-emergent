import {
  Injectable,
  Logger,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  PaymentLedger,
  Refund,
  LedgerEvent,
  PaymentStatus,
  IPosGateway,
  POS_GATEWAY,
} from '@nettapu/shared';
import { Payment } from '../entities/payment.entity';
import { PosTransaction } from '../entities/pos-transaction.entity';
import { IdempotencyKey } from '../entities/idempotency-key.entity';
import { InitiateRefundDto } from '../dto/initiate-refund.dto';
import { createHash } from 'crypto';

const IDEMPOTENCY_TTL_HOURS = 72;

/** Convert decimal string (e.g. "100.50") to integer cents. No IEEE 754 accumulation. */
const toCents = (v: string): number => Math.round(Number(v) * 100);

@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Refund)
    private readonly refundRepo: Repository<Refund>,
    @InjectRepository(PosTransaction)
    private readonly posTxRepo: Repository<PosTransaction>,
    @InjectRepository(IdempotencyKey)
    private readonly idempotencyRepo: Repository<IdempotencyKey>,
    @Inject(POS_GATEWAY)
    private readonly posGateway: IPosGateway,
    private readonly dataSource: DataSource,
  ) {}

  async initiateRefund(dto: InitiateRefundDto, adminUserId: string): Promise<Refund> {
    // 1. Idempotency check (fast path — no lock needed)
    const existing = await this.idempotencyRepo.findOne({
      where: { key: dto.idempotencyKey },
    });
    if (existing) {
      const requestHash = this.hashRequest(dto);
      if (existing.requestHash !== requestHash) {
        throw new ConflictException(
          'Idempotency key already used with different parameters',
        );
      }
      const refund = await this.refundRepo.findOne({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (refund) return refund;
    }

    // 2. Phase 1: Lock payment → validate amount → create refund (single TX)
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    let refund: Refund;
    let lockedPayment: Payment;
    let posTx: PosTransaction | null;
    try {
      // Lock payment — serializes concurrent refund requests
      const locked = await qr.manager
        .createQueryBuilder(Payment, 'p')
        .setLock('pessimistic_write')
        .where('p.id = :id', { id: dto.paymentId })
        .getOne();

      if (!locked) {
        throw new NotFoundException(`Payment ${dto.paymentId} not found`);
      }
      if (
        locked.status !== PaymentStatus.COMPLETED &&
        locked.status !== PaymentStatus.PARTIALLY_REFUNDED
      ) {
        throw new BadRequestException(
          `Cannot refund payment in status: ${locked.status}`,
        );
      }
      lockedPayment = locked;

      // Validate amount under lock — integer cents arithmetic (no IEEE 754)
      const allRefunds = await qr.manager.find(Refund, {
        where: { paymentId: dto.paymentId },
      });
      const committedCents = allRefunds
        .filter((r) => r.status === 'pending' || r.status === 'completed')
        .reduce((sum, r) => sum + toCents(r.amount), 0);
      const remainingCents = toCents(locked.amount) - committedCents;

      if (toCents(dto.amount) > remainingCents) {
        throw new BadRequestException(
          `Refund amount ${dto.amount} exceeds remaining refundable amount ${(remainingCents / 100).toFixed(2)}`,
        );
      }

      // Find POS capture reference (under same TX snapshot)
      posTx = await qr.manager.findOne(PosTransaction, {
        where: { paymentId: dto.paymentId, status: 'captured' },
      });

      // Create refund record
      refund = qr.manager.create(Refund, {
        paymentId: dto.paymentId,
        amount: dto.amount,
        currency: dto.currency ?? locked.currency,
        reason: dto.reason,
        status: 'pending',
        idempotencyKey: dto.idempotencyKey,
        initiatedAt: new Date(),
      });
      refund = await qr.manager.save(Refund, refund);

      // Ledger: refund initiated
      await qr.manager.save(
        PaymentLedger,
        qr.manager.create(PaymentLedger, {
          paymentId: dto.paymentId,
          event: LedgerEvent.REFUND_INITIATED,
          amount: dto.amount,
          currency: dto.currency ?? locked.currency,
          metadata: { refundId: refund.id, reason: dto.reason, adminUserId },
        }),
      );

      // Idempotency key
      await qr.manager.save(
        IdempotencyKey,
        qr.manager.create(IdempotencyKey, {
          key: dto.idempotencyKey,
          operationType: 'refund_initiation',
          requestHash: this.hashRequest(dto),
          responseBody: { refundId: refund.id, paymentId: dto.paymentId },
          expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_HOURS * 3600_000),
        }),
      );

      await qr.commitTransaction();
    } catch (err) {
      if (qr.isTransactionActive) {
        await qr.rollbackTransaction();
      }
      throw err;
    } finally {
      await qr.release();
    }

    // 3. Phase 2: POS refund call (outside TX — external side effect)
    let posResult;
    try {
      posResult = await this.posGateway.refund({
        paymentId: dto.paymentId,
        posReference: posTx?.externalId ?? '',
        amount: dto.amount,
        currency: dto.currency ?? lockedPayment.currency,
        idempotencyKey: dto.idempotencyKey,
      });
    } catch (posErr) {
      this.logger.error(
        JSON.stringify({
          event: 'pos_refund_exception',
          refund_id: refund.id,
          payment_id: dto.paymentId,
          error: (posErr as Error).message,
        }),
      );
      // POS failed — mark refund as 'failed' to free committed amount
      try {
        await this.recordRefundPosResult(refund, dto, lockedPayment, posTx, {
          success: false,
          posRefundReference: null,
          message: (posErr as Error).message,
        });
      } catch (dbErr) {
        // DB write also failed — refund stays 'pending', log for admin
        this.logger.error(
          JSON.stringify({
            event: 'CRITICAL_refund_pos_fail_db_fail',
            refund_id: refund.id,
            payment_id: dto.paymentId,
            pos_error: (posErr as Error).message,
            db_error: (dbErr as Error).message,
          }),
        );
      }
      const result = await this.refundRepo.findOne({ where: { id: refund.id } });
      return result ?? refund;
    }

    // 4. Phase 3: Record POS result in DB
    try {
      await this.recordRefundPosResult(refund, dto, lockedPayment, posTx, posResult);
    } catch (dbErr) {
      // CRITICAL: POS may have succeeded but DB write failed.
      // Refund stays 'pending'. Idempotency key exists, so retry
      // returns the pending refund for admin reconciliation.
      this.logger.error(
        JSON.stringify({
          event: 'CRITICAL_refund_pos_success_db_failure',
          refund_id: refund.id,
          payment_id: dto.paymentId,
          pos_success: posResult.success,
          pos_refund_reference: posResult.posRefundReference,
          db_error: (dbErr as Error).message,
        }),
      );
    }

    // Re-read to return current state
    const result = await this.refundRepo.findOne({ where: { id: refund.id } });
    refund = result ?? refund;

    this.logger.log(
      JSON.stringify({
        event: 'refund_processed',
        refund_id: refund.id,
        payment_id: dto.paymentId,
        status: refund.status,
        amount: dto.amount,
      }),
    );

    return refund;
  }

  private async recordRefundPosResult(
    refund: Refund,
    dto: InitiateRefundDto,
    lockedPayment: Payment,
    posTx: PosTransaction | null,
    posResult: { success: boolean; posRefundReference: string | null; message: string },
  ): Promise<void> {
    const qr2 = this.dataSource.createQueryRunner();
    await qr2.connect();
    await qr2.startTransaction();

    try {
      if (posResult.success) {
        refund.status = 'completed';
        refund.posRefundId = posResult.posRefundReference;
        refund.completedAt = new Date();
        await qr2.manager.save(Refund, refund);

        // Re-calculate total under lock for payment status update
        const locked2 = await qr2.manager
          .createQueryBuilder(Payment, 'p')
          .setLock('pessimistic_write')
          .where('p.id = :id', { id: dto.paymentId })
          .getOne();

        if (locked2) {
          const completedRefunds = await qr2.manager.find(Refund, {
            where: { paymentId: dto.paymentId },
          });
          const totalCompletedCents = completedRefunds
            .filter((r) => r.status === 'completed')
            .reduce((sum, r) => sum + toCents(r.amount), 0);
          const isFullRefund = totalCompletedCents >= toCents(locked2.amount);
          locked2.status = isFullRefund
            ? PaymentStatus.REFUNDED
            : PaymentStatus.PARTIALLY_REFUNDED;
          await qr2.manager.save(Payment, locked2);
        }

        // POS transaction record
        await qr2.manager.save(
          PosTransaction,
          qr2.manager.create(PosTransaction, {
            paymentId: dto.paymentId,
            provider: posTx?.provider ?? 'mock',
            externalId: posResult.posRefundReference,
            amount: dto.amount,
            currency: dto.currency ?? lockedPayment.currency,
            status: 'refunded',
            responsePayload: posResult as unknown as Record<string, unknown>,
          }),
        );

        // Ledger: refund completed
        await qr2.manager.save(
          PaymentLedger,
          qr2.manager.create(PaymentLedger, {
            paymentId: dto.paymentId,
            event: LedgerEvent.REFUND_COMPLETED,
            amount: dto.amount,
            currency: dto.currency ?? lockedPayment.currency,
            metadata: {
              refundId: refund.id,
              posRefundReference: posResult.posRefundReference,
            },
          }),
        );
      } else {
        refund.status = 'failed';
        await qr2.manager.save(Refund, refund);
      }

      await qr2.commitTransaction();
    } catch (err) {
      if (qr2.isTransactionActive) {
        await qr2.rollbackTransaction();
      }
      throw err;
    } finally {
      await qr2.release();
    }
  }

  async findById(id: string): Promise<Refund> {
    const refund = await this.refundRepo.findOne({ where: { id } });
    if (!refund) throw new NotFoundException(`Refund ${id} not found`);
    return refund;
  }

  async findByPayment(paymentId: string): Promise<Refund[]> {
    return this.refundRepo.find({
      where: { paymentId },
      order: { initiatedAt: 'DESC' },
    });
  }

  private hashRequest(dto: InitiateRefundDto): string {
    const payload = JSON.stringify({
      paymentId: dto.paymentId,
      amount: dto.amount,
      reason: dto.reason,
    });
    return createHash('sha256').update(payload).digest('hex');
  }
}

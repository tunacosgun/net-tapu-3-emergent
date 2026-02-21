import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Refund } from '@nettapu/shared';
import { Payment } from '../entities/payment.entity';
import { ReconciliationQueryDto } from '../dto/reconciliation-query.dto';

const DEFAULT_OLDER_THAN_MINUTES = 30;
const DEFAULT_LIMIT = 50;

export interface StaleRecord {
  id: string;
  amount: string;
  currency: string;
  status: string;
  staleSinceMinutes: number;
}

export interface ReconciliationReport {
  generatedAt: string;
  thresholdMinutes: number;
  stalePendingPayments: (StaleRecord & { userId: string; parcelId: string | null })[];
  stalePendingRefunds: (StaleRecord & { paymentId: string | null; reason: string })[];
}

@Injectable()
export class ReconciliationService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Refund)
    private readonly refundRepo: Repository<Refund>,
  ) {}

  async getReconciliationReport(query: ReconciliationQueryDto): Promise<ReconciliationReport> {
    const thresholdMinutes = query.olderThanMinutes ?? DEFAULT_OLDER_THAN_MINUTES;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const cutoff = new Date(Date.now() - thresholdMinutes * 60_000);

    const [payments, refunds] = await Promise.all([
      this.findStalePendingPayments(cutoff, limit),
      this.findStalePendingRefunds(cutoff, limit),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      thresholdMinutes,
      stalePendingPayments: payments.map((p) => ({
        id: p.id,
        userId: p.userId,
        parcelId: p.parcelId,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        staleSinceMinutes: Math.round((Date.now() - p.createdAt.getTime()) / 60_000),
      })),
      stalePendingRefunds: refunds.map((r) => ({
        id: r.id,
        paymentId: r.paymentId,
        amount: r.amount,
        currency: r.currency,
        status: r.status,
        reason: r.reason,
        staleSinceMinutes: Math.round((Date.now() - r.initiatedAt.getTime()) / 60_000),
      })),
    };
  }

  private async findStalePendingPayments(cutoff: Date, limit: number): Promise<Payment[]> {
    return this.paymentRepo.find({
      where: {
        status: 'pending',
        createdAt: LessThan(cutoff),
      },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  private async findStalePendingRefunds(cutoff: Date, limit: number): Promise<Refund[]> {
    return this.refundRepo.find({
      where: {
        status: 'pending',
        initiatedAt: LessThan(cutoff),
      },
      order: { initiatedAt: 'ASC' },
      take: limit,
    });
  }
}

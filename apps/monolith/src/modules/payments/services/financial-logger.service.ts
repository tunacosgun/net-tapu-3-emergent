import { Injectable, Logger } from '@nestjs/common';

/**
 * Structured financial logger for payment state transitions.
 *
 * Every financial event is logged in a consistent JSON format suitable
 * for log aggregation, alerting, and audit trails.
 *
 * NOTE: Frozen services (payment.service.ts, refund.service.ts) retain
 * their existing logging. This logger is for new code (reconciliation,
 * future admin tools, webhook handlers). Existing services may adopt
 * this format in a future logging-only pass.
 */

export interface FinancialLogEntry {
  event: string;
  payment_id?: string;
  refund_id?: string;
  amount_cents?: number;
  currency?: string;
  status_before?: string;
  status_after?: string;
  actor?: string;
  metadata?: Record<string, unknown>;
}

const toCents = (v: string): number => Math.round(Number(v) * 100);

@Injectable()
export class FinancialLogger {
  private readonly logger = new Logger('FinancialAudit');

  /**
   * Log a financial state transition.
   * All fields are optional except `event` — include what's available.
   */
  log(entry: FinancialLogEntry): void {
    this.logger.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        ...entry,
      }),
    );
  }

  /**
   * Log a financial state transition, auto-converting amount string to cents.
   */
  logWithAmount(
    entry: Omit<FinancialLogEntry, 'amount_cents'> & { amount: string },
  ): void {
    this.log({
      ...entry,
      amount_cents: toCents(entry.amount),
    });
  }

  /**
   * Log a CRITICAL financial event (POS/DB desync, reconciliation needed).
   */
  critical(entry: FinancialLogEntry): void {
    this.logger.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        severity: 'CRITICAL',
        ...entry,
      }),
    );
  }
}

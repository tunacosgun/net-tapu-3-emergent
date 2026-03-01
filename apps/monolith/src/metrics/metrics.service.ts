import { Injectable, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  Registry,
  Counter,
  Gauge,
  Histogram,
  collectDefaultMetrics,
} from 'prom-client';

@Injectable()
export class MetricsService {
  readonly registry: Registry;

  // ── Payment counters ──────────────────────────────────────
  readonly paymentInitiatedTotal: Counter;
  readonly paymentProvisionedTotal: Counter;
  readonly paymentFailedTotal: Counter;
  readonly paymentCapturedTotal: Counter;
  readonly paymentCancelledTotal: Counter;

  // ── 3DS counters ──────────────────────────────────────────
  readonly threeDsInitiatedTotal: Counter;
  readonly threeDsCompletedTotal: Counter;

  // ── Callback counters ─────────────────────────────────────
  readonly callbackReceivedTotal: Counter;
  readonly callbackRejectedTotal: Counter;

  // ── POS call counters ─────────────────────────────────────
  readonly posCallTotal: Counter;

  // ── Reconciliation counters ───────────────────────────────
  readonly reconciliationTickTotal: Counter;
  readonly reconciliationMismatchTotal: Counter;

  // ── Histograms ────────────────────────────────────────────
  readonly posCallDurationMs: Histogram;
  readonly threeDsCompletionDurationMs: Histogram;
  readonly reconciliationTickDurationMs: Histogram;

  // ── DB pool gauges ────────────────────────────────────────
  readonly dbPoolTotal: Gauge;
  readonly dbPoolIdle: Gauge;
  readonly dbPoolWaiting: Gauge;

  constructor(@Optional() private readonly dataSource?: DataSource) {
    this.registry = new Registry();
    const workerId = process.env.CLUSTER_WORKER_ID || '0';
    this.registry.setDefaultLabels({ app: 'monolith', worker: workerId });
    collectDefaultMetrics({ register: this.registry });

    // ── Payment counters ──────────────────────────────────────

    this.paymentInitiatedTotal = new Counter({
      name: 'nettapu_payment_initiated_total',
      help: 'Total payments initiated',
      labelNames: ['provider', 'currency'] as const,
      registers: [this.registry],
    });

    this.paymentProvisionedTotal = new Counter({
      name: 'nettapu_payment_provisioned_total',
      help: 'Total payments successfully provisioned',
      labelNames: ['provider', 'currency'] as const,
      registers: [this.registry],
    });

    this.paymentFailedTotal = new Counter({
      name: 'nettapu_payment_failed_total',
      help: 'Total failed payments by reason',
      labelNames: ['provider', 'reason'] as const,
      registers: [this.registry],
    });

    this.paymentCapturedTotal = new Counter({
      name: 'nettapu_payment_captured_total',
      help: 'Total payments captured',
      labelNames: ['provider'] as const,
      registers: [this.registry],
    });

    this.paymentCancelledTotal = new Counter({
      name: 'nettapu_payment_cancelled_total',
      help: 'Total payment provisions cancelled',
      labelNames: ['provider'] as const,
      registers: [this.registry],
    });

    // ── 3DS counters ──────────────────────────────────────────

    this.threeDsInitiatedTotal = new Counter({
      name: 'nettapu_3ds_initiated_total',
      help: 'Total 3DS redirects initiated',
      labelNames: ['provider'] as const,
      registers: [this.registry],
    });

    this.threeDsCompletedTotal = new Counter({
      name: 'nettapu_3ds_completed_total',
      help: 'Total 3DS callbacks processed by outcome',
      labelNames: ['provider', 'outcome'] as const,
      registers: [this.registry],
    });

    // ── Callback counters ─────────────────────────────────────

    this.callbackReceivedTotal = new Counter({
      name: 'nettapu_callback_received_total',
      help: 'Total POS callbacks received (valid signature)',
      labelNames: ['provider'] as const,
      registers: [this.registry],
    });

    this.callbackRejectedTotal = new Counter({
      name: 'nettapu_callback_rejected_total',
      help: 'Total POS callbacks rejected by reason',
      labelNames: ['provider', 'reason'] as const,
      registers: [this.registry],
    });

    // ── POS call counters ─────────────────────────────────────

    this.posCallTotal = new Counter({
      name: 'nettapu_pos_call_total',
      help: 'Total POS API calls by method and status',
      labelNames: ['provider', 'method', 'status'] as const,
      registers: [this.registry],
    });

    // ── Reconciliation counters ───────────────────────────────

    this.reconciliationTickTotal = new Counter({
      name: 'nettapu_reconciliation_tick_total',
      help: 'Total reconciliation worker ticks by result',
      labelNames: ['result'] as const,
      registers: [this.registry],
    });

    this.reconciliationMismatchTotal = new Counter({
      name: 'nettapu_reconciliation_mismatch_total',
      help: 'Total reconciliation mismatches by status and resolution',
      labelNames: ['original_status', 'resolution'] as const,
      registers: [this.registry],
    });

    // ── Histograms ────────────────────────────────────────────

    this.posCallDurationMs = new Histogram({
      name: 'nettapu_pos_call_duration_ms',
      help: 'POS API call latency in milliseconds',
      labelNames: ['provider', 'method'] as const,
      buckets: [100, 250, 500, 1000, 2500, 5000, 7500, 15000],
      registers: [this.registry],
    });

    this.threeDsCompletionDurationMs = new Histogram({
      name: 'nettapu_3ds_completion_duration_ms',
      help: 'Time from 3DS initiation to callback arrival in milliseconds',
      labelNames: ['provider'] as const,
      buckets: [5000, 15000, 30000, 60000, 120000, 300000, 600000, 900000],
      registers: [this.registry],
    });

    this.reconciliationTickDurationMs = new Histogram({
      name: 'nettapu_reconciliation_tick_duration_ms',
      help: 'Reconciliation worker tick duration in milliseconds',
      buckets: [500, 1000, 5000, 10000, 30000, 60000],
      registers: [this.registry],
    });

    // ── DB pool gauges ────────────────────────────────────────

    this.dbPoolTotal = new Gauge({
      name: 'nettapu_db_pool_total',
      help: 'Total connections in the DB pool',
      registers: [this.registry],
      collect: () => {
        try {
          const pool = (this.dataSource?.driver as any)?.master;
          if (pool && typeof pool.totalCount === 'number') {
            this.dbPoolTotal.set(pool.totalCount);
          }
        } catch {
          // Pool not yet available — skip
        }
      },
    });

    this.dbPoolIdle = new Gauge({
      name: 'nettapu_db_pool_idle',
      help: 'Idle connections in the DB pool',
      registers: [this.registry],
      collect: () => {
        try {
          const pool = (this.dataSource?.driver as any)?.master;
          if (pool && typeof pool.idleCount === 'number') {
            this.dbPoolIdle.set(pool.idleCount);
          }
        } catch {
          // Pool not yet available — skip
        }
      },
    });

    this.dbPoolWaiting = new Gauge({
      name: 'nettapu_db_pool_waiting',
      help: 'Clients waiting for a DB connection from the pool',
      registers: [this.registry],
      collect: () => {
        try {
          const pool = (this.dataSource?.driver as any)?.master;
          if (pool && typeof pool.waitingCount === 'number') {
            this.dbPoolWaiting.set(pool.waitingCount);
          }
        } catch {
          // Pool not yet available — skip
        }
      },
    });
  }
}

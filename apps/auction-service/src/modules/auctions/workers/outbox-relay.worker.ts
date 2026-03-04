import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
  Optional,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  OutboxEvent,
  OutboxEventStatus,
} from '../entities/outbox-event.entity';
import { OutboxConsumerRegistry } from '../events/outbox-consumer.registry';
import { MetricsService } from '../../../metrics/metrics.service';

const ADVISORY_LOCK_ID = 834729156;
const DEFAULT_POLL_INTERVAL_MS = 200;
const DEFAULT_BATCH_SIZE = 50;
const STALE_PROCESSING_THRESHOLD_MS = 30_000;

@Injectable()
export class OutboxRelayWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelayWorker.name);
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private processing = false;
  private readonly pollIntervalMs: number;
  private readonly batchSize: number;

  constructor(
    private readonly dataSource: DataSource,
    private readonly consumerRegistry: OutboxConsumerRegistry,
    @Optional() @Inject(MetricsService) private readonly metrics?: MetricsService,
  ) {
    this.pollIntervalMs = parseInt(
      process.env.OUTBOX_POLL_INTERVAL_MS ?? String(DEFAULT_POLL_INTERVAL_MS),
      10,
    );
    this.batchSize = parseInt(
      process.env.OUTBOX_BATCH_SIZE ?? String(DEFAULT_BATCH_SIZE),
      10,
    );
  }

  onModuleInit(): void {
    if (process.env.DISABLE_WORKERS === 'true') {
      this.logger.log('OutboxRelayWorker skipped (DISABLE_WORKERS=true)');
      return;
    }

    this.intervalHandle = setInterval(() => {
      this.tick().catch((err) => {
        this.logger.error(`Relay tick error: ${err.message}`, err.stack);
      });
    }, this.pollIntervalMs);
    this.logger.log(
      `OutboxRelayWorker started (poll=${this.pollIntervalMs}ms, batch=${this.batchSize})`,
    );
  }

  onModuleDestroy(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.logger.log('OutboxRelayWorker stopped');
  }

  private async tick(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    const tickStart = Date.now();
    let lockAcquired = false;

    try {
      // ── Advisory lock: single instance across all replicas ─────────
      const [{ acquired }] = await this.dataSource.query(
        `SELECT pg_try_advisory_lock($1) as acquired`,
        [ADVISORY_LOCK_ID],
      );

      if (!acquired) {
        // Another instance holds the lock
        return;
      }
      lockAcquired = true;

      // ── Reclaim stale processing events ────────────────────────────
      await this.reclaimStaleProcessing();

      // ── Fetch pending events ───────────────────────────────────────
      const events = await this.dataSource
        .getRepository(OutboxEvent)
        .createQueryBuilder('e')
        .where('e.status = :status', { status: OutboxEventStatus.PENDING })
        .orderBy('e.sequence', 'ASC')
        .limit(this.batchSize)
        .getMany();

      if (events.length === 0) return;

      // Update pending gauge
      this.metrics?.outboxPendingGauge.set(events.length);

      // ── Process each event ─────────────────────────────────────────
      for (const event of events) {
        await this.processEvent(event);
      }
    } finally {
      if (lockAcquired) {
        await this.dataSource
          .query(`SELECT pg_advisory_unlock($1)`, [ADVISORY_LOCK_ID])
          .catch((err) =>
            this.logger.error(`Advisory unlock failed: ${err.message}`),
          );
      }
      this.processing = false;
      this.metrics?.outboxRelayDurationMs.observe(Date.now() - tickStart);
    }
  }

  private async processEvent(event: OutboxEvent): Promise<void> {
    const repo = this.dataSource.getRepository(OutboxEvent);

    // Mark as processing
    await repo.update(event.id, {
      status: OutboxEventStatus.PROCESSING,
      lastAttemptAt: new Date(),
      attempts: event.attempts + 1,
    });

    try {
      await this.consumerRegistry.dispatch(event);

      // Mark as processed
      await repo.update(event.id, {
        status: OutboxEventStatus.PROCESSED,
        processedAt: new Date(),
      });

      this.metrics?.outboxEventsProcessedTotal.inc({
        event_type: event.eventType,
      });
    } catch (err) {
      const newAttempts = event.attempts + 1;
      const errorMsg = err instanceof Error ? err.message : String(err);

      if (newAttempts >= event.maxAttempts) {
        // Dead letter
        await repo.update(event.id, {
          status: OutboxEventStatus.DEAD_LETTER,
          errorDetails: errorMsg,
        });
        this.metrics?.outboxDeadLetterTotal.inc({
          event_type: event.eventType,
        });
        this.logger.error(
          `DEAD LETTER: event=${event.id} type=${event.eventType} aggregate=${event.aggregateId} attempts=${newAttempts}/${event.maxAttempts} error=${errorMsg}`,
        );
      } else {
        // Back to pending for retry
        await repo.update(event.id, {
          status: OutboxEventStatus.PENDING,
          errorDetails: errorMsg,
        });
        this.metrics?.outboxRetriesTotal.inc({ event_type: event.eventType });
        this.logger.warn(
          `Retry queued: event=${event.id} type=${event.eventType} attempt=${newAttempts}/${event.maxAttempts}`,
        );
      }
    }
  }

  private async reclaimStaleProcessing(): Promise<void> {
    const threshold = new Date(Date.now() - STALE_PROCESSING_THRESHOLD_MS);

    const result = await this.dataSource
      .getRepository(OutboxEvent)
      .createQueryBuilder()
      .update(OutboxEvent)
      .set({ status: OutboxEventStatus.PENDING })
      .where('status = :status', { status: OutboxEventStatus.PROCESSING })
      .andWhere('last_attempt_at < :threshold', { threshold })
      .execute();

    if (result.affected && result.affected > 0) {
      this.logger.warn(`Reclaimed ${result.affected} stale processing events`);
      this.metrics?.outboxStaleReclaimedTotal.inc(result.affected);
    }
  }
}

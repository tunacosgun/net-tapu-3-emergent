import { Injectable, Logger } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import {
  OutboxEvent,
  OutboxEventType,
} from '../entities/outbox-event.entity';
import { DomainEventPayload } from '../events/domain-event.types';

export interface OutboxWriteRequest {
  aggregateId: string;
  eventType: OutboxEventType;
  payload: DomainEventPayload;
  idempotencyKey: string;
}

@Injectable()
export class OutboxWriterService {
  private readonly logger = new Logger(OutboxWriterService.name);

  /**
   * Write a single domain event to the outbox within the caller's transaction.
   * Handles duplicate idempotency_key (PG 23505) gracefully — logs and returns.
   */
  async write(
    qr: QueryRunner,
    aggregateId: string,
    eventType: OutboxEventType,
    payload: DomainEventPayload,
    idempotencyKey: string,
  ): Promise<void> {
    try {
      const event = qr.manager.create(OutboxEvent, {
        aggregateId,
        eventType,
        payload: payload as unknown as Record<string, unknown>,
        idempotencyKey,
      });
      await qr.manager.save(OutboxEvent, event);
    } catch (err: unknown) {
      const pgCode = (err as Record<string, unknown>)?.code as string | undefined;
      if (pgCode === '23505') {
        // Duplicate idempotency key — event already written (safe to ignore)
        this.logger.debug(
          `Outbox dedup: ${idempotencyKey} already exists (event_type=${eventType})`,
        );
        return;
      }
      throw err;
    }
  }

  /**
   * Write multiple domain events to the outbox within the caller's transaction.
   */
  async writeMany(qr: QueryRunner, events: OutboxWriteRequest[]): Promise<void> {
    for (const e of events) {
      await this.write(qr, e.aggregateId, e.eventType, e.payload, e.idempotencyKey);
    }
  }
}

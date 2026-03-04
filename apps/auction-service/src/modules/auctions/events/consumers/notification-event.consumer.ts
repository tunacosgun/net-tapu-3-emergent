import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OutboxConsumer, OutboxConsumerRegistry } from '../outbox-consumer.registry';
import { OutboxEvent, OutboxEventType } from '../../entities/outbox-event.entity';

/**
 * Notification consumer — stub for future cross-service notifications.
 * When AUCTION_ENDED fires, this will send email/SMS to the winner
 * and losing participants.
 */
@Injectable()
export class NotificationEventConsumer implements OutboxConsumer, OnModuleInit {
  private readonly logger = new Logger(NotificationEventConsumer.name);

  readonly consumerGroup = 'notification';
  readonly subscribedEvents = [
    OutboxEventType.AUCTION_ENDED,
  ];

  constructor(private readonly registry: OutboxConsumerRegistry) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async handle(event: OutboxEvent): Promise<void> {
    // Stub: will integrate with notification service
    this.logger.debug(
      `Notification stub: ${event.eventType} for aggregate=${event.aggregateId}`,
    );
  }
}

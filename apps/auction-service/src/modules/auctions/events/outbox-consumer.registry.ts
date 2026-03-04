import { Injectable, Logger } from '@nestjs/common';
import { OutboxEvent, OutboxEventType } from '../entities/outbox-event.entity';

export interface OutboxConsumer {
  readonly consumerGroup: string;
  readonly subscribedEvents: OutboxEventType[];
  handle(event: OutboxEvent): Promise<void>;
}

@Injectable()
export class OutboxConsumerRegistry {
  private readonly logger = new Logger(OutboxConsumerRegistry.name);
  private readonly consumers: OutboxConsumer[] = [];

  register(consumer: OutboxConsumer): void {
    this.consumers.push(consumer);
    this.logger.log(
      `Registered consumer "${consumer.consumerGroup}" for events: ${consumer.subscribedEvents.join(', ')}`,
    );
  }

  /**
   * Dispatch an outbox event to all subscribed consumers sequentially.
   * Throws on first consumer failure (relay worker handles retry).
   */
  async dispatch(event: OutboxEvent): Promise<void> {
    for (const consumer of this.consumers) {
      if (consumer.subscribedEvents.includes(event.eventType)) {
        await consumer.handle(event);
      }
    }
  }
}

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OutboxConsumer, OutboxConsumerRegistry } from '../outbox-consumer.registry';
import { OutboxEvent, OutboxEventType } from '../../entities/outbox-event.entity';

/**
 * Metrics consumer — placeholder.
 * Inline metrics counting (bid counters, state transition counters) remains
 * in BidService/AuctionEndingWorker for now. This consumer will absorb those
 * responsibilities in a future phase to fully decouple side effects.
 */
@Injectable()
export class MetricsEventConsumer implements OutboxConsumer, OnModuleInit {
  private readonly logger = new Logger(MetricsEventConsumer.name);

  readonly consumerGroup = 'metrics';
  readonly subscribedEvents = [
    OutboxEventType.BID_ACCEPTED,
    OutboxEventType.AUCTION_ENDING,
    OutboxEventType.AUCTION_ENDED,
    OutboxEventType.SNIPER_EXTENSION,
  ];

  constructor(private readonly registry: OutboxConsumerRegistry) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async handle(_event: OutboxEvent): Promise<void> {
    // Placeholder — metrics are still counted inline.
    // Will migrate counters here in a future phase.
  }
}

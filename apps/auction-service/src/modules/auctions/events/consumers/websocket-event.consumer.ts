import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OutboxConsumer, OutboxConsumerRegistry } from '../outbox-consumer.registry';
import { OutboxEvent, OutboxEventType } from '../../entities/outbox-event.entity';
import { AuctionGateway } from '../../gateways/auction.gateway';
import {
  BidAcceptedEvent,
  SniperExtensionEvent,
  AuctionEndingEvent,
  AuctionEndedEvent,
} from '../domain-event.types';

@Injectable()
export class WebSocketEventConsumer implements OutboxConsumer, OnModuleInit {
  private readonly logger = new Logger(WebSocketEventConsumer.name);

  readonly consumerGroup = 'websocket';
  readonly subscribedEvents = [
    OutboxEventType.BID_ACCEPTED,
    OutboxEventType.SNIPER_EXTENSION,
    OutboxEventType.AUCTION_ENDING,
    OutboxEventType.AUCTION_ENDED,
  ];

  constructor(
    private readonly registry: OutboxConsumerRegistry,
    private readonly gateway: AuctionGateway,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async handle(event: OutboxEvent): Promise<void> {
    switch (event.eventType) {
      case OutboxEventType.BID_ACCEPTED: {
        const p = event.payload as unknown as BidAcceptedEvent;
        this.gateway.broadcastBidAccepted(event.aggregateId, {
          type: 'BID_ACCEPTED',
          bid_id: p.bid_id,
          user_id_masked: p.user_id_masked,
          amount: p.amount,
          server_timestamp: p.server_timestamp,
          new_bid_count: p.new_bid_count,
        });
        break;
      }
      case OutboxEventType.SNIPER_EXTENSION: {
        const p = event.payload as unknown as SniperExtensionEvent;
        this.gateway.broadcastAuctionExtended(event.aggregateId, {
          type: 'AUCTION_EXTENDED',
          auction_id: p.auction_id,
          new_end_time: p.new_end_time,
          triggered_by_bid_id: p.triggered_by_bid_id,
        });
        break;
      }
      case OutboxEventType.AUCTION_ENDING: {
        const p = event.payload as unknown as AuctionEndingEvent;
        this.gateway.broadcastAuctionEnding(event.aggregateId, {
          type: 'AUCTION_ENDING',
          time_remaining_ms: p.time_remaining_ms,
        });
        break;
      }
      case OutboxEventType.AUCTION_ENDED: {
        const p = event.payload as unknown as AuctionEndedEvent;
        this.gateway.broadcastAuctionEnded(event.aggregateId, {
          type: 'AUCTION_ENDED',
          winner_id_masked: p.winner_id_masked,
          final_price: p.final_price,
        });
        break;
      }
      default:
        this.logger.warn(`Unhandled event type: ${event.eventType}`);
    }
  }
}

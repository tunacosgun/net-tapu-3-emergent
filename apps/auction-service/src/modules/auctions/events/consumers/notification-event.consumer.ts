import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OutboxConsumer, OutboxConsumerRegistry } from '../outbox-consumer.registry';
import { OutboxEvent, OutboxEventType } from '../../entities/outbox-event.entity';

/**
 * Notification consumer — bridges auction events to monolith notification system.
 *
 * When domain events fire (bid accepted, auction ended, sniper extension, etc.),
 * this consumer calls the monolith's /notifications/events endpoint to queue
 * email/SMS/push notifications for affected users.
 *
 * Event → Notification mapping:
 * - AUCTION_ENDED  → 'auction.won' (to winner) + 'auction.lost' (to losers)
 * - BID_ACCEPTED   → 'auction.bid_placed' (to bidder)
 * - SNIPER_EXTENSION → 'auction.starting_soon' (to all participants)
 * - AUCTION_STARTED  → 'auction.starting_soon' (to all participants)
 */
@Injectable()
export class NotificationEventConsumer implements OutboxConsumer, OnModuleInit {
  private readonly logger = new Logger(NotificationEventConsumer.name);
  private readonly monolithBaseUrl: string;
  private readonly enabled: boolean;

  readonly consumerGroup = 'notification';
  readonly subscribedEvents = [
    OutboxEventType.AUCTION_ENDED,
    OutboxEventType.BID_ACCEPTED,
    OutboxEventType.SNIPER_EXTENSION,
    OutboxEventType.AUCTION_STARTED,
  ];

  constructor(
    private readonly registry: OutboxConsumerRegistry,
    private readonly config: ConfigService,
  ) {
    this.monolithBaseUrl = this.config.get<string>(
      'MONOLITH_INTERNAL_URL',
      'http://monolith:3000',
    );
    this.enabled = this.config.get<string>(
      'NOTIFICATION_CONSUMER_ENABLED',
      'true',
    ) === 'true';
  }

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log(
      `Notification consumer registered (enabled=${this.enabled}, monolith=${this.monolithBaseUrl})`,
    );
  }

  async handle(event: OutboxEvent): Promise<void> {
    if (!this.enabled) {
      this.logger.debug(`Notification consumer disabled — skipping ${event.eventType}`);
      return;
    }

    try {
      switch (event.eventType) {
        case OutboxEventType.AUCTION_ENDED:
          await this.handleAuctionEnded(event);
          break;

        case OutboxEventType.BID_ACCEPTED:
          await this.handleBidAccepted(event);
          break;

        case OutboxEventType.SNIPER_EXTENSION:
          await this.handleSniperExtension(event);
          break;

        case OutboxEventType.AUCTION_STARTED:
          await this.handleAuctionStarted(event);
          break;

        default:
          this.logger.warn(`Unhandled event type: ${event.eventType}`);
      }
    } catch (err) {
      this.logger.error(
        `Failed to dispatch notification for ${event.eventType} (aggregate=${event.aggregateId}): ${(err as Error).message}`,
      );
      throw err; // Re-throw so outbox relay can retry
    }
  }

  // ── AUCTION_ENDED: Notify winner + losers ──────────────────────

  private async handleAuctionEnded(event: OutboxEvent): Promise<void> {
    const payload = event.payload as {
      auction_id: string;
      winner_id: string;
      final_price: string;
      bid_count: number;
    };

    if (!payload.winner_id) {
      this.logger.warn(`Auction ${payload.auction_id} ended with no winner — skipping notifications`);
      return;
    }

    // Notify winner
    await this.sendNotificationEvent('auction.won', payload.winner_id, {
      auctionId: payload.auction_id,
      finalPrice: payload.final_price,
      bidCount: payload.bid_count,
    });

    this.logger.log(
      `Sent auction.won notification to winner ${payload.winner_id} for auction ${payload.auction_id}`,
    );

    // Notify losers — losers are all participants except winner
    // The monolith notification service will look up participants and exclude winner
    await this.sendNotificationEvent('auction.lost', undefined, {
      auctionId: payload.auction_id,
      winnerId: payload.winner_id,
      finalPrice: payload.final_price,
      notifyAllParticipantsExcept: payload.winner_id,
    });
  }

  // ── BID_ACCEPTED: Confirm bid to bidder ────────────────────────

  private async handleBidAccepted(event: OutboxEvent): Promise<void> {
    const payload = event.payload as {
      auction_id: string;
      bid_id: string;
      user_id: string;
      amount: string;
      new_price: string;
      server_timestamp: string;
    };

    await this.sendNotificationEvent('auction.bid_placed', payload.user_id, {
      auctionId: payload.auction_id,
      bidId: payload.bid_id,
      amount: payload.amount,
      currentPrice: payload.new_price,
      timestamp: payload.server_timestamp,
    });
  }

  // ── SNIPER_EXTENSION: Alert participants of extended time ──────

  private async handleSniperExtension(event: OutboxEvent): Promise<void> {
    const payload = event.payload as {
      auction_id: string;
      new_end_time: string;
      extension_count: number;
    };

    // Broadcast to all participants via monolith
    await this.sendNotificationEvent('auction.starting_soon', undefined, {
      auctionId: payload.auction_id,
      newEndTime: payload.new_end_time,
      extensionCount: payload.extension_count,
      type: 'sniper_extension',
      notifyAllParticipants: true,
    });
  }

  // ── AUCTION_STARTED: Notify participants auction is live ───────

  private async handleAuctionStarted(event: OutboxEvent): Promise<void> {
    const payload = event.payload as {
      auction_id: string;
      starting_price: string;
      scheduled_end: string;
    };

    await this.sendNotificationEvent('auction.starting_soon', undefined, {
      auctionId: payload.auction_id,
      startingPrice: payload.starting_price,
      scheduledEnd: payload.scheduled_end,
      type: 'auction_started',
      notifyAllParticipants: true,
    });
  }

  // ── HTTP bridge to monolith notification service ───────────────

  private async sendNotificationEvent(
    eventName: string,
    userId: string | undefined,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    const url = `${this.monolithBaseUrl}/api/v1/notifications/events`;

    const body = {
      event: eventName,
      ...(userId ? { userId } : {}),
      metadata,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Internal service-to-service call — uses shared secret
        'X-Internal-Service': 'auction-service',
        'X-Service-Key': this.config.get<string>('INTERNAL_SERVICE_KEY', ''),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000), // 5s timeout
    });

    if (!response.ok) {
      const text = await response.text().catch(() => 'unknown');
      throw new Error(
        `Monolith notification API returned ${response.status}: ${text}`,
      );
    }

    this.logger.debug(
      `Notification event dispatched: ${eventName} (userId=${userId ?? 'broadcast'})`,
    );
  }
}

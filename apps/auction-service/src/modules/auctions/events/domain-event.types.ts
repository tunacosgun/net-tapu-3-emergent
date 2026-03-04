import { OutboxEventType } from '../entities/outbox-event.entity';

export interface BidAcceptedEvent {
  auction_id: string;
  bid_id: string;
  user_id: string;
  user_id_masked: string;
  amount: string;
  new_price: string;
  new_bid_count: number;
  server_timestamp: string;
  idempotency_key: string;
}

export interface AuctionStartedEvent {
  auction_id: string;
  starting_price: string;
  scheduled_end: string;
}

export interface AuctionEndingEvent {
  auction_id: string;
  time_remaining_ms: number;
}

export interface AuctionEndedEvent {
  auction_id: string;
  winner_id: string | null;
  winner_id_masked: string;
  winner_bid_id: string | null;
  final_price: string;
  bid_count: number;
  ended_at: string;
}

export interface SniperExtensionEvent {
  auction_id: string;
  triggered_by_bid_id: string;
  new_end_time: string;
  extension_count: number;
}

export type DomainEventPayload =
  | BidAcceptedEvent
  | AuctionStartedEvent
  | AuctionEndingEvent
  | AuctionEndedEvent
  | SniperExtensionEvent;

/** Map event types to their payload shapes */
export type EventPayloadMap = {
  [OutboxEventType.BID_ACCEPTED]: BidAcceptedEvent;
  [OutboxEventType.AUCTION_STARTED]: AuctionStartedEvent;
  [OutboxEventType.AUCTION_ENDING]: AuctionEndingEvent;
  [OutboxEventType.AUCTION_ENDED]: AuctionEndedEvent;
  [OutboxEventType.SNIPER_EXTENSION]: SniperExtensionEvent;
};

/**
 * Idempotency key conventions:
 * BID_ACCEPTED       → bid:{bid_id}
 * SNIPER_EXTENSION   → sniper:{bid_id}
 * AUCTION_ENDING     → auction_ending:{auction_id}
 * AUCTION_ENDED      → auction_ended:{auction_id}
 * AUCTION_STARTED    → auction_started:{auction_id}
 */

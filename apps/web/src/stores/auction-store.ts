import { create } from 'zustand';
import type {
  AuctionStateMessage,
  BidAcceptedMessage,
  BidRejectedMessage,
  AuctionExtendedMessage,
  AuctionEndingMessage,
  AuctionEndedMessage,
} from '@nettapu/shared/dist/types/auction-ws.types';
import type { Auction, Payment } from '@/types';

const MAX_BID_FEED = 50;

export interface BidFeedItem {
  bid_id: string;
  user_id_masked: string;
  amount: string;
  server_timestamp: string;
}

export interface OptimisticBid {
  idempotencyKey: string;
  amount: string;
  previousPrice: string;
  previousBidCount: number;
}

// Deposit is valid if payment status (payments.payments) or deposit status
// (payments.deposits) indicates funds are secured for the auction.
const ACTIVE_DEPOSIT_STATUSES = ['provisioned', 'completed', 'held', 'collected'];

interface AuctionState {
  // REST-fetched auction detail
  auctionDetail: Auction | null;
  auctionLoading: boolean;
  auctionError: string | null;

  // Deposit gating (checked via payment status)
  userDeposit: Payment | null;
  depositLoading: boolean;
  hasActiveDeposit: boolean;
  depositVersion: number;

  // WS-driven live state
  auctionId: string | null;
  status: string | null;
  currentPrice: string | null;
  bidCount: number;
  participantCount: number;
  watcherCount: number;
  timeRemainingMs: number | null;
  extendedUntil: string | null;
  bidFeed: BidFeedItem[];
  lastRejection: BidRejectedMessage | null;
  winnerIdMasked: string | null;
  finalPrice: string | null;

  // Broadcast name map (admin revealed names for everyone)
  broadcastNameMap: Record<string, string> | null;

  // Optimistic bid tracking
  optimisticBid: OptimisticBid | null;

  // REST actions
  setAuctionDetail: (auction: Auction) => void;
  setAuctionLoading: (loading: boolean) => void;
  setAuctionError: (error: string | null) => void;
  setUserDeposit: (payment: Payment | null) => void;
  setDepositLoading: (loading: boolean) => void;
  invalidateDeposit: () => void;

  // WS actions
  applyAuctionState: (msg: AuctionStateMessage) => void;
  applyBidAccepted: (msg: BidAcceptedMessage) => void;
  applyBidRejected: (msg: BidRejectedMessage) => void;
  applyAuctionExtended: (msg: AuctionExtendedMessage) => void;
  applyAuctionEnding: (msg: AuctionEndingMessage) => void;
  applyAuctionEnded: (msg: AuctionEndedMessage) => void;
  setTimeRemaining: (ms: number) => void;
  setWatcherCount: (count: number) => void;
  setBroadcastNames: (map: Record<string, string> | null) => void;

  // Optimistic bid
  setOptimisticBid: (bid: OptimisticBid) => void;
  rollbackOptimisticBid: () => void;

  reset: () => void;
}

const initialState = {
  auctionDetail: null,
  auctionLoading: true,
  auctionError: null,
  userDeposit: null,
  depositLoading: true,
  hasActiveDeposit: false,
  depositVersion: 0,
  auctionId: null,
  status: null,
  currentPrice: null,
  bidCount: 0,
  participantCount: 0,
  watcherCount: 0,
  timeRemainingMs: null,
  extendedUntil: null,
  bidFeed: [] as BidFeedItem[],
  lastRejection: null as BidRejectedMessage | null,
  winnerIdMasked: null,
  finalPrice: null,
  broadcastNameMap: null as Record<string, string> | null,
  optimisticBid: null as OptimisticBid | null,
};

export const useAuctionStore = create<AuctionState>((set) => ({
  ...initialState,

  setAuctionDetail: (auction) =>
    set({
      auctionDetail: auction,
      auctionLoading: false,
      auctionError: null,
      // Seed live state from REST until WS connects
      status: auction.status,
      currentPrice: auction.currentPrice,
      bidCount: auction.bidCount,
      participantCount: auction.participantCount,
      watcherCount: auction.watcherCount,
    }),

  setAuctionLoading: (loading) => set({ auctionLoading: loading }),
  setAuctionError: (error) => set({ auctionError: error, auctionLoading: false }),

  setUserDeposit: (payment) =>
    set({
      userDeposit: payment,
      depositLoading: false,
      hasActiveDeposit: payment
        ? ACTIVE_DEPOSIT_STATUSES.includes(payment.status)
        : false,
    }),

  setDepositLoading: (loading) => set({ depositLoading: loading }),

  invalidateDeposit: () =>
    set((state) => ({
      userDeposit: null,
      depositLoading: true,
      hasActiveDeposit: false,
      depositVersion: state.depositVersion + 1,
    })),

  applyAuctionState: (msg) =>
    set({
      auctionId: msg.auction_id,
      status: msg.status,
      currentPrice: msg.current_price,
      bidCount: msg.bid_count,
      participantCount: msg.participant_count,
      watcherCount: msg.watcher_count,
      timeRemainingMs: msg.time_remaining_ms,
      extendedUntil: msg.extended_until,
    }),

  applyBidAccepted: (msg) =>
    set((state) => {
      const item: BidFeedItem = {
        bid_id: msg.bid_id,
        user_id_masked: msg.user_id_masked,
        amount: msg.amount,
        server_timestamp: msg.server_timestamp,
      };
      const feed = [item, ...state.bidFeed].slice(0, MAX_BID_FEED);
      return {
        currentPrice: msg.amount,
        bidCount: msg.new_bid_count,
        bidFeed: feed,
        lastRejection: null,
        optimisticBid: null, // confirmed, clear optimistic
      };
    }),

  applyBidRejected: (msg) =>
    set((state) => {
      // Rollback optimistic bid if present
      if (state.optimisticBid) {
        return {
          lastRejection: msg,
          currentPrice: state.optimisticBid.previousPrice,
          bidCount: state.optimisticBid.previousBidCount,
          bidFeed: state.bidFeed.filter(
            (b) => b.bid_id !== `optimistic-${state.optimisticBid!.idempotencyKey}`,
          ),
          optimisticBid: null,
        };
      }
      return { lastRejection: msg };
    }),

  applyAuctionExtended: (msg) =>
    set({ extendedUntil: msg.new_end_time }),

  applyAuctionEnding: (msg) =>
    set({ status: 'ending', timeRemainingMs: msg.time_remaining_ms }),

  applyAuctionEnded: (msg) =>
    set({
      status: 'ended',
      winnerIdMasked: msg.winner_id_masked,
      finalPrice: msg.final_price,
      timeRemainingMs: 0,
    }),

  setTimeRemaining: (ms) => set({ timeRemainingMs: ms }),
  setWatcherCount: (count) => set({ watcherCount: count }),
  setBroadcastNames: (map) => set({ broadcastNameMap: map }),

  setOptimisticBid: (bid) =>
    set((state) => {
      const optimisticFeedItem: BidFeedItem = {
        bid_id: `optimistic-${bid.idempotencyKey}`,
        user_id_masked: 'Siz',
        amount: bid.amount,
        server_timestamp: new Date().toISOString(),
      };
      return {
        optimisticBid: bid,
        currentPrice: bid.amount,
        bidCount: state.bidCount + 1,
        bidFeed: [optimisticFeedItem, ...state.bidFeed].slice(0, MAX_BID_FEED),
        lastRejection: null,
      };
    }),

  rollbackOptimisticBid: () =>
    set((state) => {
      if (!state.optimisticBid) return {};
      return {
        currentPrice: state.optimisticBid.previousPrice,
        bidCount: state.optimisticBid.previousBidCount,
        bidFeed: state.bidFeed.filter(
          (b) => b.bid_id !== `optimistic-${state.optimisticBid!.idempotencyKey}`,
        ),
        optimisticBid: null,
      };
    }),

  reset: () => set(initialState),
}));

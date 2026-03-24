import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/auth-store';
import { useAuctionStore } from '../stores/auction-store';
import { useConnectionStore } from '../stores/connection-store';
import { Config } from '../config/env';
import 'react-native-get-random-values'; // polyfill for crypto.randomUUID

let socket: Socket | null = null;
let currentAuctionId: string | null = null;

type ServerMessage = {
  type: string;
  [key: string]: unknown;
};

function handleMessage(eventName: string, msg: ServerMessage) {
  const store = useAuctionStore.getState();
  const msgType = msg.type || eventName.toUpperCase();

  switch (msgType) {
    case 'AUCTION_STATE':
      store.applyAuctionState(msg as any);
      break;
    case 'BID_ACCEPTED':
      store.applyBidAccepted(msg as any);
      break;
    case 'BID_REJECTED':
      store.applyBidRejected(msg as any);
      break;
    case 'AUCTION_EXTENDED':
      store.applyAuctionExtended(msg as any);
      break;
    case 'AUCTION_ENDING':
      store.applyAuctionEnding(msg as any);
      break;
    case 'AUCTION_ENDED':
      store.applyAuctionEnded(msg as any);
      break;
  }
}

function setupListeners() {
  if (!socket) return;

  socket.on('connect', () => {
    console.log('[WS] Connected, socket id:', socket?.id);
    useConnectionStore.getState().setStatus('connected');
    if (currentAuctionId) {
      socket?.emit('join_auction', { type: 'JOIN_AUCTION', auction_id: currentAuctionId });
    }
  });

  socket.on('connect_error', (err) => {
    console.log('[WS] Connection error:', err.message);
    // If auth error, try refreshing token and reconnecting
    if (err.message?.includes('unauthorized') || err.message?.includes('jwt')) {
      console.log('[WS] Auth error, will retry with fresh token');
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('[WS] Disconnected:', reason);
    useConnectionStore.getState().setStatus('disconnected');
  });

  socket.io.on('reconnect_attempt', (attempt) => {
    console.log('[WS] Reconnect attempt', attempt);
    useConnectionStore.getState().setStatus('reconnecting');
  });

  socket.io.on('reconnect', () => {
    console.log('[WS] Reconnected');
    useConnectionStore.getState().setStatus('connected');
    if (currentAuctionId) {
      socket?.emit('join_auction', { type: 'JOIN_AUCTION', auction_id: currentAuctionId });
    }
  });

  socket.io.on('reconnect_failed', () => {
    console.log('[WS] Reconnect failed');
    useConnectionStore.getState().setStatus('disconnected');
  });

  socket.on('error', (data: any) => {
    console.log('[WS] Server error:', data);
  });

  const events = [
    'auction_state',
    'bid_accepted',
    'bid_rejected',
    'auction_extended',
    'auction_ending',
    'auction_ended',
  ] as const;

  events.forEach((event) => {
    socket?.on(event, (data: ServerMessage) => {
      console.log('[WS] Event received:', event, JSON.stringify(data).slice(0, 200));
      handleMessage(event, data);
    });
  });

  socket.on('watcher_update', (data: { watcher_count: number }) => {
    useAuctionStore.getState().setWatcherCount(data.watcher_count);
  });

  socket.on('names_revealed', (data: { name_map: Record<string, string> }) => {
    useAuctionStore.getState().setBroadcastNames(data.name_map);
  });
  socket.on('names_hidden', () => {
    useAuctionStore.getState().setBroadcastNames(null);
  });

  socket.on('admin_time_extended', (data: {
    auction_id: string;
    new_end_time: string;
    added_minutes: number;
    time_remaining_ms: number;
    silent?: boolean;
  }) => {
    useAuctionStore.getState().applyAdminTimeExtended(
      data.added_minutes, data.time_remaining_ms, data.new_end_time, !!data.silent,
    );
  });

  socket.on('admin_announcement', (data: { message: string; timestamp: string }) => {
    useAuctionStore.getState().addAnnouncement(data.message, data.timestamp);
  });

  // Settlement events
  socket.on('auction_settlement_pending', (data: any) => {
    console.log('[WS] Settlement pending:', data);
  });
  socket.on('auction_settlement_progress', (data: any) => {
    console.log('[WS] Settlement progress:', data);
  });
  socket.on('auction_settled', (data: any) => {
    console.log('[WS] Settlement completed:', data);
  });
  socket.on('auction_settlement_failed', (data: any) => {
    console.log('[WS] Settlement failed:', data);
  });
}

/**
 * Connect to an auction's WS room.
 * Reuses the existing socket if possible — only creates a new one if needed.
 */
export function connectToAuction(auctionId: string) {
  const token = useAuthStore.getState().accessToken;
  useConnectionStore.getState().setStatus('connecting');

  // If socket exists and is connected, just switch rooms
  if (socket?.connected) {
    if (currentAuctionId && currentAuctionId !== auctionId) {
      socket.emit('leave_auction', { type: 'LEAVE_AUCTION', auction_id: currentAuctionId });
    }
    currentAuctionId = auctionId;
    socket.emit('join_auction', { type: 'JOIN_AUCTION', auction_id: auctionId });
    useConnectionStore.getState().setStatus('connected');
    console.log('[WS] Reused existing connection, joined auction', auctionId);
    return;
  }

  // If socket exists but disconnected, update auth and reconnect
  if (socket) {
    currentAuctionId = auctionId;
    socket.auth = { token };
    socket.connect();
    console.log('[WS] Reconnecting existing socket for auction', auctionId);
    return;
  }

  // Create new socket
  currentAuctionId = auctionId;
  console.log('[WS] Creating new connection to', Config.WS_URL, 'for auction', auctionId);

  socket = io(Config.WS_URL, {
    path: '/ws/auction',
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 15,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
    timeout: 8000,
  });

  setupListeners();
}

export function placeBid(auctionId: string, amount: string, referencePrice: string): string {
  const idempotencyKey = uuidv4();

  if (!socket?.connected) {
    console.log('[WS] Cannot place bid - not connected');
    return idempotencyKey;
  }

  const store = useAuctionStore.getState();
  store.setOptimisticBid({
    idempotencyKey,
    amount,
    previousPrice: store.currentPrice || referencePrice,
    previousBidCount: store.bidCount,
  });

  console.log('[WS] Placing bid:', amount, 'ref:', referencePrice);
  socket.emit('place_bid', {
    type: 'PLACE_BID',
    auction_id: auctionId,
    amount,
    reference_price: referencePrice,
    idempotency_key: idempotencyKey,
  });

  return idempotencyKey;
}

export function getSocket(): Socket | null {
  return socket;
}

/**
 * Leave the current auction room. Does NOT destroy the socket.
 * Call destroySocket() only on logout or app termination.
 */
export function disconnectFromAuction() {
  if (socket && currentAuctionId) {
    socket.emit('leave_auction', { type: 'LEAVE_AUCTION', auction_id: currentAuctionId });
  }
  currentAuctionId = null;
  useConnectionStore.getState().setStatus('disconnected');
}

/**
 * Fully destroy the socket (use on logout).
 */
export function destroySocket() {
  if (socket) {
    if (currentAuctionId) {
      socket.emit('leave_auction', { type: 'LEAVE_AUCTION', auction_id: currentAuctionId });
    }
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    currentAuctionId = null;
    useConnectionStore.getState().setStatus('disconnected');
  }
}

import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth-store';
import { useAuctionStore } from '@/stores/auction-store';
import { useConnectionStore } from '@/stores/connection-store';
import type { ServerMessage } from '@nettapu/shared/dist/types/auction-ws.types';

const WS_URL =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001')
    : '';

let socket: Socket | null = null;
let currentAuctionId: string | null = null;

function handleMessage(msg: ServerMessage) {
  const store = useAuctionStore.getState();

  switch (msg.type) {
    case 'AUCTION_STATE':
      store.applyAuctionState(msg);
      break;
    case 'BID_ACCEPTED':
      store.applyBidAccepted(msg);
      break;
    case 'BID_REJECTED':
      store.applyBidRejected(msg);
      break;
    case 'AUCTION_EXTENDED':
      store.applyAuctionExtended(msg);
      break;
    case 'AUCTION_ENDING':
      store.applyAuctionEnding(msg);
      break;
    case 'AUCTION_ENDED':
      store.applyAuctionEnded(msg);
      break;
  }
}

export function connectToAuction(auctionId: string) {
  disconnectFromAuction();

  const token = useAuthStore.getState().accessToken;
  currentAuctionId = auctionId;
  useConnectionStore.getState().setStatus('connecting');

  socket = io(WS_URL, {
    path: '/ws/auction',
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    useConnectionStore.getState().setStatus('connected');
    socket?.emit('join_auction', { type: 'JOIN_AUCTION', auction_id: auctionId });
  });

  socket.on('disconnect', () => {
    useConnectionStore.getState().setStatus('disconnected');
  });

  socket.io.on('reconnect_attempt', () => {
    useConnectionStore.getState().setStatus('reconnecting');
  });

  socket.on('reconnect', () => {
    useConnectionStore.getState().setStatus('connected');
    if (currentAuctionId) {
      socket?.emit('join_auction', {
        type: 'JOIN_AUCTION',
        auction_id: currentAuctionId,
      });
    }
  });

  socket.on('reconnect_failed', () => {
    useConnectionStore.getState().setStatus('disconnected');
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
    socket?.on(event, (data: ServerMessage) => handleMessage(data));
  });

  // Live watcher count updates
  socket.on('watcher_update', (data: { watcher_count: number }) => {
    useAuctionStore.getState().setWatcherCount(data.watcher_count);
  });

  // Admin broadcast: names revealed/hidden for all clients
  socket.on('names_revealed', (data: { name_map: Record<string, string> }) => {
    useAuctionStore.getState().setBroadcastNames(data.name_map);
  });
  socket.on('names_hidden', () => {
    useAuctionStore.getState().setBroadcastNames(null);
  });
}

export function placeBid(auctionId: string, amount: string, referencePrice: string): string {
  const idempotencyKey = crypto.randomUUID();

  if (!socket?.connected) return idempotencyKey;

  // Apply optimistic update
  const store = useAuctionStore.getState();
  store.setOptimisticBid({
    idempotencyKey,
    amount,
    previousPrice: store.currentPrice || referencePrice,
    previousBidCount: store.bidCount,
  });

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

export function disconnectFromAuction() {
  if (socket) {
    if (currentAuctionId) {
      socket.emit('leave_auction', {
        type: 'LEAVE_AUCTION',
        auction_id: currentAuctionId,
      });
    }
    socket.disconnect();
    socket = null;
    currentAuctionId = null;
    useConnectionStore.getState().setStatus('disconnected');
    useAuctionStore.getState().reset();
  }
}

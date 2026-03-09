import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Logger, HttpException, UseInterceptors } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { Auction } from '../entities/auction.entity';
import { AuctionParticipant } from '../entities/auction-participant.entity';
import { Bid } from '../entities/bid.entity';
import { BidService } from '../services/bid.service';
import { RedisLockService } from '../services/redis-lock.service';
import { PlaceBidDto } from '../dto/place-bid.dto';
import {
  AuctionStateMessage,
  BidAcceptedMessage,
  BidRejectedMessage,
  AuctionExtendedMessage,
  AuctionEndingMessage,
  AuctionEndedMessage,
  AuctionSettlementPendingMessage,
  AuctionSettlementProgressMessage,
  AuctionSettledMessage,
  AuctionSettlementFailedMessage,
  WsContextInterceptor,
} from '@nettapu/shared';
import { MetricsService } from '../../../metrics/metrics.service';

interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
}

// Matches digits with optional decimal, no leading minus, no letters
const VALID_AMOUNT_RE = /^\d+(\.\d+)?$/;

@UseInterceptors(WsContextInterceptor)
@WebSocketGateway({
  path: '/ws/auction',
  cors: { origin: '*' },
})
export class AuctionGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(AuctionGateway.name);

  constructor(
    @InjectRepository(Auction)
    private readonly auctionRepo: Repository<Auction>,
    @InjectRepository(AuctionParticipant)
    private readonly participantRepo: Repository<AuctionParticipant>,
    @InjectRepository(Bid)
    private readonly bidRepo: Repository<Bid>,
    private readonly bidService: BidService,
    private readonly redisLock: RedisLockService,
    private readonly config: ConfigService,
    private readonly metrics: MetricsService,
  ) {}

  // ── JWT Authentication Middleware ──────────────────────────────

  afterInit(server: Server) {
    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    const verifyOptions: jwt.VerifyOptions = {
      algorithms: ['HS256'],
      issuer: this.config.getOrThrow<string>('JWT_ISSUER'),
      audience: this.config.getOrThrow<string>('JWT_AUDIENCE'),
    };

    server.use((socket: Socket, next: (err?: Error) => void) => {
      const token =
        socket.handshake.auth?.token ??
        (socket.handshake.headers?.authorization as string)?.replace(
          'Bearer ',
          '',
        );

      if (!token) {
        this.logger.warn(
          `Connection rejected: no token provided (${socket.id})`,
        );
        return next(new Error('Authentication required'));
      }

      try {
        const payload = jwt.verify(token, secret, verifyOptions) as JwtPayload;
        socket.data.userId = payload.sub;
        socket.data.email = payload.email;
        socket.data.roles = payload.roles;
        socket.data.requestId = randomUUID();
        next();
      } catch (err) {
        this.logger.warn(
          `Connection rejected: invalid token (${socket.id}) – ${(err as Error).message}`,
        );
        return next(new Error('Invalid or expired token'));
      }
    });

    this.logger.log('JWT authentication middleware registered (HS256-only, iss/aud enforced)');
  }

  handleConnection(client: Socket) {
    this.metrics.wsConnectionsTotal.inc({ status: 'connected' });
    this.metrics.wsActiveConnections.inc();
    this.logger.log(
      `Client connected: ${client.id} (user=${client.data.userId})`,
    );
  }

  // ── Memory leak protection: leave all rooms on disconnect ──────

  handleDisconnect(client: Socket) {
    this.metrics.wsConnectionsTotal.inc({ status: 'disconnected' });
    this.metrics.wsActiveConnections.dec();

    // Socket.IO auto-removes the socket from all rooms on disconnect,
    // but we explicitly verify and log for audit trail.
    const auctionRooms = [...client.rooms].filter((r) =>
      r.startsWith('auction:'),
    );
    for (const room of auctionRooms) {
      client.leave(room);
      // Broadcast updated watcher count after leave
      const watcherCount = this.server.sockets.adapter.rooms.get(room)?.size ?? 0;
      this.server.to(room).emit('watcher_update', { watcher_count: watcherCount });
      this.logger.log(
        `Cleanup: ${client.id} force-left room ${room} on disconnect (watchers=${watcherCount})`,
      );
    }
    this.logger.log(
      `Client disconnected: ${client.id} (user=${client.data.userId}, rooms_cleaned=${auctionRooms.length})`,
    );
  }

  // ── join_auction (anti-enumeration + participant-only) ─────────

  @SubscribeMessage('join_auction')
  async handleJoinAuction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { auction_id: string },
  ) {
    const userId = client.data.userId as string;
    const auctionId = data.auction_id;

    // Anti-enumeration: validate UUID format before any DB lookup
    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!auctionId || !uuidRe.test(auctionId)) {
      this.logger.warn(
        `Join denied: user ${userId} sent invalid auctionId format`,
      );
      client.emit('error', { message: 'Unable to join auction' });
      return;
    }

    // Admin/superadmin bypass participant check
    const roles = (client.data.roles as string[]) ?? [];
    const isAdmin = roles.includes('admin') || roles.includes('superadmin');

    if (!isAdmin) {
      // Single query: participant + auction existence in one check.
      // If auction doesn't exist OR user is not participant, same generic error.
      const participant = await this.participantRepo.findOne({
        where: {
          auctionId,
          userId,
          eligible: true,
        },
      });

      if (!participant) {
        // Generic error — do NOT reveal whether auction exists
        this.logger.warn(
          `Join denied: user ${userId} for auction ${auctionId} (not participant or not found)`,
        );
        client.emit('error', { message: 'Unable to join auction' });
        return;
      }
    }

    // Load auction state
    const auction = await this.auctionRepo.findOne({
      where: { id: auctionId },
    });

    if (!auction) {
      // Should not happen if participant FK is intact, but defend anyway
      client.emit('error', { message: 'Unable to join auction' });
      return;
    }

    const room = `auction:${auctionId}`;
    await client.join(room);

    // Live counts: participants from DB, watchers from Socket.IO room
    const participantCount = await this.participantRepo.count({
      where: { auctionId, eligible: true },
    });
    const watcherCount = this.server.sockets.adapter.rooms.get(room)?.size ?? 0;

    // Fetch recent bids for bid history (last 50, newest first)
    const recentBids = await this.bidRepo.find({
      where: { auctionId },
      order: { serverTs: 'DESC' },
      take: 50,
    });

    const effectiveEnd = auction.extendedUntil ?? auction.scheduledEnd;
    const snapshot: AuctionStateMessage = {
      type: 'AUCTION_STATE',
      auction_id: auction.id,
      status: auction.status,
      current_price: auction.currentPrice ?? auction.startingPrice,
      bid_count: auction.bidCount,
      participant_count: participantCount,
      watcher_count: watcherCount,
      time_remaining_ms: effectiveEnd
        ? Math.max(
            0,
            new Date(effectiveEnd).getTime() - Date.now(),
          )
        : null,
      extended_until: auction.extendedUntil?.toISOString() ?? null,
      recent_bids: recentBids.map((b) => ({
        id: b.id,
        user_id: b.userId,
        amount: b.amount,
        server_ts: b.serverTs.toISOString(),
      })),
    };

    client.emit('auction_state', snapshot);

    // Broadcast updated watcher count to all in room
    this.server.to(room).emit('watcher_update', { watcher_count: watcherCount });

    this.logger.log(
      `Client ${client.id} (user=${userId}) joined room ${room} (watchers=${watcherCount}, participants=${participantCount})`,
    );
  }

  // ── leave_auction ──────────────────────────────────────────────

  @SubscribeMessage('leave_auction')
  async handleLeaveAuction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { auction_id: string },
  ) {
    const room = `auction:${data.auction_id}`;
    await client.leave(room);
    const watcherCount = this.server.sockets.adapter.rooms.get(room)?.size ?? 0;
    this.server.to(room).emit('watcher_update', { watcher_count: watcherCount });
    this.logger.log(
      `Client ${client.id} (user=${client.data.userId}) left room ${room}`,
    );
  }

  // ── reveal_names / hide_names (admin only) ───────────────────────

  @SubscribeMessage('reveal_names')
  handleRevealNames(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { auction_id: string; name_map: Record<string, string> },
  ) {
    const roles = (client.data.roles as string[]) ?? [];
    if (!roles.includes('admin') && !roles.includes('superadmin')) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }
    const room = `auction:${data.auction_id}`;
    this.server.to(room).emit('names_revealed', { name_map: data.name_map });
    this.logger.log(`Admin ${client.data.userId} revealed names in ${room}`);
  }

  @SubscribeMessage('hide_names')
  handleHideNames(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { auction_id: string },
  ) {
    const roles = (client.data.roles as string[]) ?? [];
    if (!roles.includes('admin') && !roles.includes('superadmin')) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }
    const room = `auction:${data.auction_id}`;
    this.server.to(room).emit('names_hidden', {});
    this.logger.log(`Admin ${client.data.userId} hid names in ${room}`);
  }

  // ── admin_extend_time (admin only) ────────────────────────────

  @SubscribeMessage('admin_extend_time')
  async handleAdminExtendTime(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { auction_id: string; minutes: number },
  ) {
    const roles = (client.data.roles as string[]) ?? [];
    if (!roles.includes('admin') && !roles.includes('superadmin')) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    const auctionId = data.auction_id;
    const minutes = Math.min(Math.max(data.minutes || 0, 1), 60); // 1-60 min

    const auction = await this.auctionRepo.findOne({ where: { id: auctionId } });
    if (!auction) {
      client.emit('error', { message: 'Auction not found' });
      return;
    }

    // Calculate new end time from current effective end
    const currentEnd = auction.extendedUntil ?? auction.scheduledEnd;
    if (!currentEnd) {
      client.emit('error', { message: 'Auction has no end time' });
      return;
    }

    const newEnd = new Date(new Date(currentEnd).getTime() + minutes * 60_000);
    await this.auctionRepo.update(auctionId, {
      extendedUntil: newEnd,
      extensionCount: () => 'extension_count + 1',
    });

    const room = `auction:${auctionId}`;
    const timeRemainingMs = Math.max(0, newEnd.getTime() - Date.now());

    // Broadcast to all clients in room
    this.server.to(room).emit('admin_time_extended', {
      type: 'ADMIN_TIME_EXTENDED',
      auction_id: auctionId,
      new_end_time: newEnd.toISOString(),
      added_minutes: minutes,
      time_remaining_ms: timeRemainingMs,
    });

    this.logger.log(
      `Admin ${client.data.userId} extended auction ${auctionId} by ${minutes}min → ${newEnd.toISOString()}`,
    );
  }

  // ── admin_add_time_at_last_minute (auto-extend config) ──────

  @SubscribeMessage('admin_send_announcement')
  handleAdminAnnouncement(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { auction_id: string; message: string },
  ) {
    const roles = (client.data.roles as string[]) ?? [];
    if (!roles.includes('admin') && !roles.includes('superadmin')) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    const room = `auction:${data.auction_id}`;
    this.server.to(room).emit('admin_announcement', {
      type: 'ADMIN_ANNOUNCEMENT',
      auction_id: data.auction_id,
      message: data.message,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(
      `Admin ${client.data.userId} announcement in ${data.auction_id}: ${data.message}`,
    );
  }

  // ── place_bid (hardened) ───────────────────────────────────────

  @SubscribeMessage('place_bid')
  async handlePlaceBid(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { auction_id: string; amount: string; idempotency_key: string },
  ) {
    const userId = client.data.userId as string;
    const auctionId = data.auction_id;
    const idempotencyKey = data.idempotency_key;
    this.metrics.wsBidsTotal.inc();

    // ── Bid floor enforcement: reject obviously invalid amounts ──
    // NUMERIC(15,2) max = 9,999,999,999,999.99
    const MAX_BID = 9_999_999_999_999.99;
    if (
      !data.amount ||
      !VALID_AMOUNT_RE.test(data.amount) ||
      parseFloat(data.amount) <= 0 ||
      parseFloat(data.amount) > MAX_BID
    ) {
      this.logger.warn(
        `Bid floor reject: user ${userId} sent invalid amount "${data.amount}"`,
      );
      this.metrics.wsBidRejectionsTotal.inc({ reason_code: 'invalid_amount' });
      client.emit('bid_rejected', {
        type: 'BID_REJECTED',
        reason_code: 'invalid_amount',
        current_price: '',
        message: 'Invalid bid amount',
      } as BidRejectedMessage);
      return;
    }

    // ── Redis failover protection ────────────────────────────────
    if (!this.redisLock.isHealthy()) {
      this.logger.error(
        `CRITICAL: Redis unavailable — blocking bid from user ${userId}`,
      );
      this.metrics.wsBidRejectionsTotal.inc({ reason_code: 'service_unavailable' });
      client.emit('bid_rejected', {
        type: 'BID_REJECTED',
        reason_code: 'service_unavailable',
        current_price: '',
        message: 'Service temporarily unavailable. Please retry.',
      } as BidRejectedMessage);
      return;
    }

    // ── Global bid rate limit: 200 bids per 3 seconds ─────────────
    let globalRate: { allowed: boolean; current: number };
    try {
      globalRate = await this.redisLock.checkRateLimit('ws:bid:rate:global', 200, 3);
    } catch (err) {
      this.logger.error(
        `CRITICAL: Redis global rate limit failed: ${(err as Error).message}`,
      );
      this.metrics.wsBidRejectionsTotal.inc({ reason_code: 'service_unavailable' });
      client.emit('bid_rejected', {
        type: 'BID_REJECTED',
        reason_code: 'service_unavailable',
        current_price: '',
        message: 'Service temporarily unavailable. Please retry.',
      } as BidRejectedMessage);
      return;
    }

    if (!globalRate.allowed) {
      this.logger.warn(
        `Global rate limit hit: ${globalRate.current} bids in 3s window`,
      );
      this.metrics.globalRateLimitHitsTotal.inc();
      this.metrics.wsBidRejectionsTotal.inc({ reason_code: 'global_rate_limited' });
      client.emit('bid_rejected', {
        type: 'BID_REJECTED',
        reason_code: 'global_rate_limited',
        current_price: '',
        message: 'System is under heavy load. Please retry.',
      } as BidRejectedMessage);
      return;
    }

    // ── Per-user rate limit: 5 bids per 3 seconds ────────────────
    let userRate: { allowed: boolean; current: number };
    try {
      userRate = await this.redisLock.checkBidRateLimit(userId, 5, 3);
    } catch (err) {
      this.logger.error(
        `CRITICAL: Redis rate limit failed — blocking bid from user ${userId}: ${(err as Error).message}`,
      );
      this.metrics.wsBidRejectionsTotal.inc({ reason_code: 'service_unavailable' });
      client.emit('bid_rejected', {
        type: 'BID_REJECTED',
        reason_code: 'service_unavailable',
        current_price: '',
        message: 'Service temporarily unavailable. Please retry.',
      } as BidRejectedMessage);
      return;
    }

    if (!userRate.allowed) {
      this.logger.warn(
        `User rate limit hit: user ${userId} sent ${userRate.current} bids in 3s window`,
      );
      this.metrics.userRateLimitHitsTotal.inc();
      this.metrics.wsBidRejectionsTotal.inc({ reason_code: 'rate_limited' });
      client.emit('bid_rejected', {
        type: 'BID_REJECTED',
        reason_code: 'rate_limited',
        current_price: '',
        message: `Rate limit exceeded. Slow down.`,
      } as BidRejectedMessage);
      return;
    }

    // ── Per-auction rate limit: 50 bids per 3 seconds ────────────
    let auctionRate: { allowed: boolean; current: number };
    try {
      auctionRate = await this.redisLock.checkAuctionRateLimit(
        auctionId,
        50,
        3,
      );
    } catch (err) {
      this.logger.error(
        `CRITICAL: Redis auction rate limit failed: ${(err as Error).message}`,
      );
      this.metrics.wsBidRejectionsTotal.inc({ reason_code: 'service_unavailable' });
      client.emit('bid_rejected', {
        type: 'BID_REJECTED',
        reason_code: 'service_unavailable',
        current_price: '',
        message: 'Service temporarily unavailable. Please retry.',
      } as BidRejectedMessage);
      return;
    }

    if (!auctionRate.allowed) {
      this.logger.warn(
        `Auction rate limit hit: auction ${auctionId} received ${auctionRate.current} bids in 3s window`,
      );
      this.metrics.auctionRateLimitHitsTotal.inc();
      this.metrics.wsBidRejectionsTotal.inc({ reason_code: 'auction_rate_limited' });
      client.emit('bid_rejected', {
        type: 'BID_REJECTED',
        reason_code: 'auction_rate_limited',
        current_price: '',
        message: 'Auction is receiving too many bids. Please retry.',
      } as BidRejectedMessage);
      return;
    }

    const ipAddress =
      (client.handshake.headers?.['x-forwarded-for'] as string)
        ?.split(',')[0]
        ?.trim() ?? client.handshake.address;

    const bidStartMs = Date.now();
    try {
      const auction = await this.auctionRepo.findOne({
        where: { id: auctionId },
      });
      const referencePrice =
        auction?.currentPrice ?? auction?.startingPrice ?? '0';

      const dto: PlaceBidDto = {
        auctionId,
        amount: data.amount,
        referencePrice,
        idempotencyKey,
      };

      // Outbox events (BID_ACCEPTED, SNIPER_EXTENSION) are written
      // in the same transaction as the bid — relay worker handles broadcast.
      await this.bidService.placeBid(dto, userId, ipAddress);

      this.metrics.bidE2eDurationMs.observe(Date.now() - bidStartMs);
    } catch (err: unknown) {
      let reasonCode = 'unknown';
      let currentPrice = '';
      let message = 'Bid rejected';

      if (err instanceof HttpException) {
        const body = err.getResponse();
        if (typeof body === 'object') {
          const b = body as Record<string, any>;
          reasonCode = b.reason_code ?? reasonCode;
          currentPrice = b.current_price ?? currentPrice;
          message = b.message ?? message;
        }
      } else if (err instanceof Error) {
        message = err.message;
      }

      this.metrics.wsBidRejectionsTotal.inc({ reason_code: reasonCode });
      this.metrics.bidE2eDurationMs.observe(Date.now() - bidStartMs);
      client.emit('bid_rejected', {
        type: 'BID_REJECTED',
        reason_code: reasonCode,
        current_price: currentPrice,
        message,
      } as BidRejectedMessage);
    }
  }

  // ── Public broadcast methods ───────────────────────────────────

  broadcastBidAccepted(auctionId: string, data: BidAcceptedMessage): void {
    this.server.to(`auction:${auctionId}`).emit('bid_accepted', data);
  }

  broadcastAuctionExtended(auctionId: string, data: AuctionExtendedMessage): void {
    this.server.to(`auction:${auctionId}`).emit('auction_extended', data);
  }

  broadcastAuctionEnding(auctionId: string, data: AuctionEndingMessage): void {
    this.server.to(`auction:${auctionId}`).emit('auction_ending', data);
  }

  broadcastAuctionEnded(auctionId: string, data: AuctionEndedMessage): void {
    this.server.to(`auction:${auctionId}`).emit('auction_ended', data);
  }

  broadcastSettlementPending(auctionId: string, data: AuctionSettlementPendingMessage): void {
    this.server.to(`auction:${auctionId}`).emit('auction_settlement_pending', data);
  }

  broadcastSettlementProgress(auctionId: string, data: AuctionSettlementProgressMessage): void {
    this.server.to(`auction:${auctionId}`).emit('auction_settlement_progress', data);
  }

  broadcastSettlementCompleted(auctionId: string, data: AuctionSettledMessage): void {
    this.server.to(`auction:${auctionId}`).emit('auction_settled', data);
  }

  broadcastSettlementFailed(auctionId: string, data: AuctionSettlementFailedMessage): void {
    this.server.to(`auction:${auctionId}`).emit('auction_settlement_failed', data);
  }
}

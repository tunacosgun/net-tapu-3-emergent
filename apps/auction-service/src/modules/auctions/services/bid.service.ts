import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  Inject,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Decimal } from 'decimal.js';
import { Auction } from '../entities/auction.entity';
import { Bid } from '../entities/bid.entity';
import { BidRejection } from '../entities/bid-rejection.entity';
import { AuctionParticipant } from '../entities/auction-participant.entity';
import { AuctionConsent } from '../entities/auction-consent.entity';
import { Deposit } from '@nettapu/shared';
import { RedisLockService } from './redis-lock.service';
import { PlaceBidDto } from '../dto/place-bid.dto';
import {
  AuctionStatus,
  BidRejectionReason,
  DepositStatus,
} from '@nettapu/shared';
import { MetricsService } from '../../../metrics/metrics.service';
import { OutboxWriterService } from './outbox-writer.service';
import { OutboxEventType } from '../entities/outbox-event.entity';
import { BidAcceptedEvent, SniperExtensionEvent } from '../events/domain-event.types';

const BID_LOCK_PREFIX = 'bid:lock:auction:';
const BID_LOCK_TTL_MS = 3000;

export interface BidAcceptedResponse {
  bid_id: string;
  auction_id: string;
  amount: string;
  new_price: string;
  new_bid_count: number;
  server_timestamp: string;
  idempotency_key: string;
  sniper_extended: boolean;
  extended_until: string | null;
}

@Injectable()
export class BidService {
  private readonly logger = new Logger(BidService.name);

  constructor(
    @InjectRepository(Auction)
    private readonly auctionRepo: Repository<Auction>,
    @InjectRepository(Bid)
    private readonly bidRepo: Repository<Bid>,
    @InjectRepository(BidRejection)
    private readonly bidRejectionRepo: Repository<BidRejection>,
    @InjectRepository(AuctionParticipant)
    private readonly participantRepo: Repository<AuctionParticipant>,
    @InjectRepository(AuctionConsent)
    private readonly consentRepo: Repository<AuctionConsent>,
    private readonly dataSource: DataSource,
    private readonly redisLock: RedisLockService,
    private readonly config: ConfigService,
    private readonly outboxWriter: OutboxWriterService,
    @Optional() @Inject(MetricsService) private readonly metrics?: MetricsService,
  ) {}

  async placeBid(
    dto: PlaceBidDto,
    userId: string,
    ipAddress?: string,
  ): Promise<BidAcceptedResponse> {
    // ── PHASE 0: Idempotency fast-path (before locking) ────────
    const existing = await this.bidRepo.findOne({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (existing) {
      this.logger.debug(`Idempotent hit: ${dto.idempotencyKey}`);
      return this.toResponse(existing);
    }

    // ── PHASE 1: Acquire distributed lock ──────────────────────
    const lockKey = `${BID_LOCK_PREFIX}${dto.auctionId}`;
    const lockValue = await this.redisLock.acquire(lockKey, BID_LOCK_TTL_MS);
    if (!lockValue) {
      throw new HttpException(
        {
          reason_code: 'lock_contention',
          message: 'Auction is processing another bid. Please retry.',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    let qr: QueryRunner | null = null;

    try {
      // ── PHASE 2: Start DB transaction ────────────────────────
      qr = this.dataSource.createQueryRunner();
      await qr.connect();
      await qr.startTransaction();

      // Safety timeouts: prevent runaway transactions from holding
      // row locks or connections indefinitely under load.
      // - lock_timeout: max wait for FOR UPDATE row lock (3s)
      //   If another tx holds the lock, fail fast instead of blocking.
      // - statement_timeout: max execution for any single statement (5s)
      //   Kills stuck queries and auto-rolls back the transaction.
      await qr.query('SET LOCAL lock_timeout = 3000');
      await qr.query('SET LOCAL statement_timeout = 5000');

      // ── PHASE 3: Idempotency re-check inside transaction ────
      const existingInTx = await qr.manager.findOne(Bid, {
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existingInTx) {
        await qr.rollbackTransaction();
        return this.toResponse(existingInTx);
      }

      // ── PHASE 4: Load auction with SELECT ... FOR UPDATE ─────
      // Pessimistic write lock prevents concurrent bid processing
      // on the same auction row. This is the CRITICAL concurrency gate.
      const auction = await qr.manager
        .createQueryBuilder(Auction, 'a')
        .setLock('pessimistic_write')
        .where('a.id = :id', { id: dto.auctionId })
        .getOne();

      if (!auction) {
        await qr.rollbackTransaction();
        this.reject(BidRejectionReason.AUCTION_NOT_LIVE, 'Auction not found');
      }

      // ── PHASE 5: Validate auction status ─────────────────────
      if (auction!.status !== AuctionStatus.LIVE) {
        await this.recordRejection(
          qr, dto, userId,
          BidRejectionReason.AUCTION_NOT_LIVE,
          `Status: ${auction!.status}`,
        );
        await qr.commitTransaction();
        this.reject(
          BidRejectionReason.AUCTION_NOT_LIVE,
          `Auction is not live (status: ${auction!.status})`,
        );
      }

      // ── PHASE 5b: Time integrity — use DB clock (NOT app time) ─
      // Authoritative time check: NOW() must be before effective end.
      // This prevents clock-skew attacks and ensures legal compliance.
      const effectiveEnd = auction!.extendedUntil ?? auction!.scheduledEnd;
      if (effectiveEnd) {
        const [{ db_now, is_past_end }] = await qr.query(
          `SELECT NOW() as db_now,
                  (NOW() > $1::timestamptz) as is_past_end`,
          [effectiveEnd],
        );
        if (is_past_end) {
          await this.recordRejection(
            qr, dto, userId,
            BidRejectionReason.AUCTION_NOT_LIVE,
            `Auction time expired (db_now: ${db_now}, effective_end: ${effectiveEnd})`,
          );
          await qr.commitTransaction();
          this.reject(
            BidRejectionReason.AUCTION_NOT_LIVE,
            'Auction has ended',
          );
        }
      }

      // ── PHASE 6: Validate participant eligibility ────────────
      const participant = await qr.manager.findOne(AuctionParticipant, {
        where: { auctionId: dto.auctionId, userId },
      });

      if (!participant || !participant.eligible) {
        await this.recordRejection(
          qr, dto, userId,
          BidRejectionReason.USER_NOT_ELIGIBLE,
          'Not eligible participant',
        );
        await qr.commitTransaction();
        this.reject(
          BidRejectionReason.USER_NOT_ELIGIBLE,
          'You are not an eligible participant in this auction',
        );
      }

      // ── PHASE 6b: Validate deposit status (financial safety) ──
      // Cross-schema read: verify deposit is in a valid state.
      // Deposit must exist, belong to this user+auction, and be held.
      const deposit = await qr.manager.findOne(Deposit, {
        where: { id: participant!.depositId },
      });

      if (!deposit) {
        await this.recordRejection(
          qr, dto, userId,
          BidRejectionReason.INSUFFICIENT_DEPOSIT,
          `Deposit ${participant!.depositId} not found`,
        );
        await qr.commitTransaction();
        this.reject(
          BidRejectionReason.INSUFFICIENT_DEPOSIT,
          'No valid deposit found for this auction',
        );
      }

      if (deposit!.status !== DepositStatus.HELD && deposit!.status !== DepositStatus.COLLECTED) {
        await this.recordRejection(
          qr, dto, userId,
          BidRejectionReason.INSUFFICIENT_DEPOSIT,
          `Deposit status: ${deposit!.status} (expected: held or collected)`,
        );
        await qr.commitTransaction();
        this.reject(
          BidRejectionReason.INSUFFICIENT_DEPOSIT,
          'Deposit is not in a valid state for bidding',
        );
      }

      // Verify deposit amount meets auction requirement
      const depositAmount = new Decimal(deposit!.amount);
      const requiredDeposit = new Decimal(auction!.requiredDeposit);
      if (depositAmount.lessThan(requiredDeposit)) {
        await this.recordRejection(
          qr, dto, userId,
          BidRejectionReason.INSUFFICIENT_DEPOSIT,
          `Deposit: ${deposit!.amount}, required: ${auction!.requiredDeposit}`,
        );
        await qr.commitTransaction();
        this.reject(
          BidRejectionReason.INSUFFICIENT_DEPOSIT,
          `Deposit amount insufficient (required: ${auction!.requiredDeposit})`,
        );
      }

      // ── PHASE 7: Validate consent ───────────────────────────
      const consent = await qr.manager.findOne(AuctionConsent, {
        where: { auctionId: dto.auctionId, userId },
      });

      if (!consent) {
        await this.recordRejection(
          qr, dto, userId,
          BidRejectionReason.CONSENT_MISSING,
          'No consent record',
        );
        await qr.commitTransaction();
        this.reject(
          BidRejectionReason.CONSENT_MISSING,
          'Auction consent not accepted',
        );
      }

      // ── PHASE 8: Validate reference price ───────────────────
      const currentPrice = auction!.currentPrice ?? auction!.startingPrice;
      if (dto.referencePrice !== currentPrice) {
        await this.recordRejection(
          qr, dto, userId,
          BidRejectionReason.PRICE_CHANGED,
          `Expected ${dto.referencePrice}, actual ${currentPrice}`,
        );
        await qr.commitTransaction();
        this.reject(
          BidRejectionReason.PRICE_CHANGED,
          `Price changed. Current: ${currentPrice}`,
          { current_price: currentPrice },
        );
      }

      // ── PHASE 9: Validate minimum increment ─────────────────
      const bidAmount = new Decimal(dto.amount);
      const basePrice = new Decimal(currentPrice);
      const minIncrement = new Decimal(auction!.minimumIncrement);
      const minimumBid = basePrice.plus(minIncrement);

      if (bidAmount.lessThan(minimumBid)) {
        await this.recordRejection(
          qr, dto, userId,
          BidRejectionReason.BELOW_MINIMUM_INCREMENT,
          `Minimum: ${minimumBid.toString()}, attempted: ${dto.amount}`,
        );
        await qr.commitTransaction();
        this.reject(
          BidRejectionReason.BELOW_MINIMUM_INCREMENT,
          `Minimum bid is ${minimumBid.toString()}`,
        );
      }

      // ── PHASE 10: Check duplicate amount ─────────────────────
      const dupBid = await qr.manager.findOne(Bid, {
        where: { auctionId: dto.auctionId, amount: dto.amount },
      });

      if (dupBid) {
        await this.recordRejection(
          qr, dto, userId,
          BidRejectionReason.AMOUNT_ALREADY_BID,
          `Amount ${dto.amount} already bid`,
        );
        await qr.commitTransaction();
        this.reject(
          BidRejectionReason.AMOUNT_ALREADY_BID,
          `Amount ${dto.amount} already bid`,
        );
      }

      // ── PHASE 11: INSERT bid (append-only) ───────────────────
      // server_ts uses DB default NOW() via the column default.
      // DB trigger trg_enforce_bid_time_integrity provides additional
      // safety net: rejects INSERT if NOW() > effective_end.
      // DB trigger trg_enforce_minimum_increment provides additional
      // safety net: rejects INSERT if amount < minimum bid.
      const newBid = qr.manager.create(Bid, {
        auctionId: dto.auctionId,
        userId,
        amount: dto.amount,
        referencePrice: dto.referencePrice,
        idempotencyKey: dto.idempotencyKey,
        serverTs: new Date(),
        clientSentAt: dto.clientSentAt ? new Date(dto.clientSentAt) : null,
        ipAddress: ipAddress ?? null,
      });
      const savedBid = await qr.manager.save(Bid, newBid);

      // ── PHASE 12: UPDATE auction + atomic sniper extension ───
      // Auction row is already locked (Phase 4 FOR UPDATE).
      // No optimistic lock conflict possible — we hold the row lock.
      auction!.currentPrice = dto.amount;
      auction!.bidCount = auction!.bidCount + 1;

      // Sniper protection: extend if bid is within the sniper window.
      // Per-auction config takes priority, falls back to global env vars.
      let sniperExtended = false;
      let newExtendedUntil: Date | null = null;
      const sniperEnabled = auction!.sniperEnabled ?? true;
      const sniperWindowSeconds = auction!.sniperWindowSeconds
        ?? this.config.get<number>('SNIPER_EXTENSION_SECONDS')
        ?? 60;
      const sniperExtensionSeconds = auction!.sniperExtensionSeconds ?? sniperWindowSeconds;
      const maxExtensions = auction!.maxSniperExtensions
        ?? this.config.get<number>('MAX_SNIPER_EXTENSIONS')
        ?? 5;

      if (sniperEnabled && effectiveEnd && auction!.extensionCount < maxExtensions) {
        // Use DB time for sniper calculation (atomic with the FOR UPDATE lock)
        const [{ remaining_ms }] = await qr.query(
          `SELECT EXTRACT(EPOCH FROM ($1::timestamptz - NOW())) * 1000 as remaining_ms`,
          [effectiveEnd],
        );
        const remainingMs = parseFloat(remaining_ms);

        if (remainingMs > 0 && remainingMs <= sniperWindowSeconds * 1000) {
          // Compute extension using DB time
          const [{ new_end }] = await qr.query(
            `SELECT (NOW() + ($1 || ' seconds')::interval) as new_end`,
            [sniperExtensionSeconds],
          );
          newExtendedUntil = new Date(new_end);
          auction!.extendedUntil = newExtendedUntil;
          auction!.extensionCount = auction!.extensionCount + 1;
          sniperExtended = true;
          this.metrics?.auctionExtensionsTotal.inc();
          this.logger.log(
            `SNIPER EXTENSION auction=${dto.auctionId} newEnd=${newExtendedUntil.toISOString()} remainingWas=${remainingMs.toFixed(0)}ms extension=${auction!.extensionCount}/${maxExtensions}`,
          );
        }
      }

      await qr.manager.save(Auction, auction!);

      // ── PHASE 12b: Write outbox events (SAME transaction) ────
      // Fetch username for bid display
      let username: string | undefined;
      try {
        const userRow = await qr.manager.query(
          `SELECT username FROM auth.users WHERE id = $1`,
          [userId],
        );
        username = userRow?.[0]?.username || undefined;
      } catch { /* non-critical */ }

      const bidEvent: BidAcceptedEvent = {
        auction_id: dto.auctionId,
        bid_id: savedBid.id,
        user_id: userId,
        user_id_masked: userId.slice(0, 8) + '***',
        username,
        amount: dto.amount,
        new_price: dto.amount,
        new_bid_count: auction!.bidCount,
        server_timestamp: savedBid.serverTs.toISOString(),
        idempotency_key: dto.idempotencyKey,
      };
      await this.outboxWriter.write(
        qr, dto.auctionId, OutboxEventType.BID_ACCEPTED,
        bidEvent, `bid:${savedBid.id}`,
      );

      if (sniperExtended) {
        const sniperEvent: SniperExtensionEvent = {
          auction_id: dto.auctionId,
          triggered_by_bid_id: savedBid.id,
          new_end_time: newExtendedUntil!.toISOString(),
          extension_count: auction!.extensionCount,
        };
        await this.outboxWriter.write(
          qr, dto.auctionId, OutboxEventType.SNIPER_EXTENSION,
          sniperEvent, `sniper:${savedBid.id}`,
        );
      }

      // ── PHASE 13: COMMIT ─────────────────────────────────────
      await qr.commitTransaction();

      this.logger.log(
        `BID ACCEPTED auction=${dto.auctionId} user=${userId} amount=${dto.amount} bid=${savedBid.id} ip=${ipAddress ?? 'unknown'}${sniperExtended ? ` EXTENDED→${newExtendedUntil!.toISOString()}` : ''}`,
      );

      return {
        bid_id: savedBid.id,
        auction_id: savedBid.auctionId,
        amount: savedBid.amount,
        new_price: dto.amount,
        new_bid_count: auction!.bidCount,
        server_timestamp: savedBid.serverTs.toISOString(),
        idempotency_key: savedBid.idempotencyKey,
        sniper_extended: sniperExtended,
        extended_until: newExtendedUntil?.toISOString() ?? null,
      };
    } catch (err) {
      if (qr?.isTransactionActive) {
        await qr.rollbackTransaction();
      }

      // Convert PostgreSQL lock_timeout / statement_timeout errors to 503
      // so clients get a retryable response instead of a 500.
      const pgCode = (err as Record<string, unknown>)?.code as string | undefined;
      if (pgCode === '55P03') {
        // 55P03 = lock_not_available (lock_timeout exceeded)
        this.logger.warn(
          `DB lock timeout: auction=${dto.auctionId} user=${userId}`,
        );
        throw new HttpException(
          { reason_code: 'db_lock_contention', message: 'Auction is busy. Please retry.' },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      if (pgCode === '57014') {
        // 57014 = query_canceled (statement_timeout exceeded)
        this.logger.error(
          `Statement timeout: auction=${dto.auctionId} user=${userId}`,
        );
        throw new HttpException(
          { reason_code: 'timeout', message: 'Bid processing timed out. Please retry.' },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      throw err;
    } finally {
      // ── PHASE 14: Release lock + cleanup ─────────────────────
      await this.redisLock.release(lockKey, lockValue);
      if (qr) {
        await qr.release();
      }
    }
  }

  // ── Private helpers ────────────────────────────────────────────

  private reject(
    reason: BidRejectionReason,
    message: string,
    extra?: Record<string, unknown>,
  ): never {
    const statusMap: Partial<Record<BidRejectionReason, HttpStatus>> = {
      [BidRejectionReason.AUCTION_NOT_LIVE]: HttpStatus.CONFLICT,
      [BidRejectionReason.PRICE_CHANGED]: HttpStatus.CONFLICT,
      [BidRejectionReason.AMOUNT_ALREADY_BID]: HttpStatus.CONFLICT,
      [BidRejectionReason.BELOW_MINIMUM_INCREMENT]:
        HttpStatus.UNPROCESSABLE_ENTITY,
      [BidRejectionReason.INSUFFICIENT_DEPOSIT]: HttpStatus.PAYMENT_REQUIRED,
      [BidRejectionReason.USER_NOT_ELIGIBLE]: HttpStatus.FORBIDDEN,
      [BidRejectionReason.CONSENT_MISSING]: HttpStatus.FORBIDDEN,
      [BidRejectionReason.RATE_LIMITED]: HttpStatus.TOO_MANY_REQUESTS,
    };

    throw new HttpException(
      { reason_code: reason, message, ...extra },
      statusMap[reason] ?? HttpStatus.BAD_REQUEST,
    );
  }

  private async recordRejection(
    qr: QueryRunner,
    dto: PlaceBidDto,
    userId: string,
    reason: BidRejectionReason,
    details: string,
  ): Promise<void> {
    const rejection = qr.manager.create(BidRejection, {
      auctionId: dto.auctionId,
      userId,
      attemptedAmount: dto.amount,
      reason,
      details,
      serverTs: new Date(),
    });
    await qr.manager.save(BidRejection, rejection);
  }

  private toResponse(bid: Bid): BidAcceptedResponse {
    return {
      bid_id: bid.id,
      auction_id: bid.auctionId,
      amount: bid.amount,
      new_price: bid.amount,
      new_bid_count: -1,
      server_timestamp: bid.serverTs.toISOString(),
      idempotency_key: bid.idempotencyKey,
      sniper_extended: false,
      extended_until: null,
    };
  }
}

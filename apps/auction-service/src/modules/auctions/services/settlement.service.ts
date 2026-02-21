import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { randomUUID } from 'crypto';
import { Auction } from '../entities/auction.entity';
import { AuctionParticipant } from '../entities/auction-participant.entity';
import { SettlementManifest } from '../entities/settlement-manifest.entity';
import { AuctionStatus, Deposit } from '@nettapu/shared';
import { DepositLifecycleService } from './deposit-lifecycle.service';
import { MetricsService } from '../../../metrics/metrics.service';

// ── Manifest JSONB types ──────────────────────────────────────

export interface SettlementManifestItem {
  item_id: string;
  deposit_id: string;
  user_id: string;
  action: 'capture' | 'refund';
  amount: string;
  currency: string;
  status: 'pending' | 'sent' | 'acknowledged' | 'failed';
  idempotency_key: string;
  pos_reference: string | null;
  sent_at: string | null;
  acknowledged_at: string | null;
  failure_reason: string | null;
  retry_count: number;
}

export interface SettlementManifestData {
  auction_id: string;
  winner_id: string | null;
  final_price: string | null;
  currency: string;
  created_at: string;
  items: SettlementManifestItem[];
}

// ── Constants ─────────────────────────────────────────────────

export const MAX_RETRIES = 3;
const MANIFEST_EXPIRY_HOURS = 48;

/**
 * Max items to process per worker tick per manifest.
 * Prevents a single tick from running longer than the Redis lock TTL.
 * With real POS calls (2-5s each), 5 items ≈ 10-25s < 30s lock TTL.
 */
export const ITEMS_PER_TICK = 5;

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    @InjectRepository(Auction)
    private readonly auctionRepo: Repository<Auction>,
    @InjectRepository(AuctionParticipant)
    private readonly participantRepo: Repository<AuctionParticipant>,
    @InjectRepository(SettlementManifest)
    private readonly manifestRepo: Repository<SettlementManifest>,
    @InjectRepository(Deposit)
    private readonly depositRepo: Repository<Deposit>,
    private readonly dataSource: DataSource,
    private readonly depositLifecycle: DepositLifecycleService,
    private readonly metrics: MetricsService,
  ) {}

  // ── 1. Initiate Settlement ────────────────────────────────────

  async initiateSettlement(auctionId: string): Promise<SettlementManifest | null> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // Pessimistic lock auction
      const auction = await qr.manager
        .createQueryBuilder(Auction, 'a')
        .setLock('pessimistic_write')
        .where('a.id = :id', { id: auctionId })
        .getOne();

      if (!auction || auction.status !== AuctionStatus.ENDED) {
        await qr.rollbackTransaction();
        return null;
      }

      // Guard: no existing manifest (idempotency via UNIQUE constraint)
      const existingManifest = await qr.manager.findOne(SettlementManifest, {
        where: { auctionId },
      });
      if (existingManifest) {
        await qr.rollbackTransaction();
        this.logger.warn(
          JSON.stringify({
            event: 'settlement_duplicate_manifest',
            auction_id: auctionId,
            existing_manifest_id: existingManifest.id,
          }),
        );
        return null;
      }

      // Batch load: participants first, then all deposits in one query
      const participants = await qr.manager.find(AuctionParticipant, {
        where: { auctionId, eligible: true },
      });

      // Batch load all referenced deposits (single query with IN clause)
      const depositIds = participants.map((p) => p.depositId);
      const deposits = depositIds.length > 0
        ? await qr.manager.find(Deposit, { where: { id: In(depositIds) } })
        : [];

      const depositMap = new Map<string, Deposit>();
      for (const d of deposits) {
        depositMap.set(d.id, d);
      }

      const items: SettlementManifestItem[] = [];

      for (const participant of participants) {
        const deposit = depositMap.get(participant.depositId);

        if (!deposit || deposit.status !== 'held') {
          this.logger.warn(
            JSON.stringify({
              event: 'settlement_skip_participant',
              auction_id: auctionId,
              user_id: participant.userId,
              deposit_id: participant.depositId,
              deposit_status: deposit?.status ?? 'not_found',
            }),
          );
          continue;
        }

        const isWinner = auction.winnerId === participant.userId;
        const action: 'capture' | 'refund' = isWinner ? 'capture' : 'refund';

        items.push({
          item_id: randomUUID(),
          deposit_id: deposit.id,
          user_id: participant.userId,
          action,
          amount: deposit.amount,
          currency: deposit.currency,
          status: 'pending',
          idempotency_key: `settlement:${auctionId}:${deposit.id}:${action}`,
          pos_reference: null,
          sent_at: null,
          acknowledged_at: null,
          failure_reason: null,
          retry_count: 0,
        });
      }

      const manifestData: SettlementManifestData = {
        auction_id: auctionId,
        winner_id: auction.winnerId,
        final_price: auction.finalPrice,
        currency: auction.currency,
        created_at: new Date().toISOString(),
        items,
      };

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + MANIFEST_EXPIRY_HOURS);

      const manifest = qr.manager.create(SettlementManifest, {
        auctionId,
        manifestData: manifestData as unknown as Record<string, unknown>,
        status: 'active',
        itemsTotal: items.length,
        itemsAcknowledged: 0,
        expiresAt,
      });

      await qr.manager.save(SettlementManifest, manifest);

      // Transition auction: ENDED → SETTLING
      auction.status = AuctionStatus.SETTLING as string;
      await qr.manager.save(Auction, auction);

      await qr.commitTransaction();

      this.logger.log(
        JSON.stringify({
          event: 'settlement_started',
          auction_id: auctionId,
          manifest_id: manifest.id,
          items_total: items.length,
          winner_id: auction.winnerId ?? null,
          final_price: auction.finalPrice ?? null,
        }),
      );

      return manifest;
    } catch (err) {
      if (qr.isTransactionActive) {
        await qr.rollbackTransaction();
      }
      throw err;
    } finally {
      await qr.release();
    }
  }

  // ── 2. Process Manifest Item ──────────────────────────────────

  async processManifestItem(
    manifest: SettlementManifest,
    item: SettlementManifestItem,
  ): Promise<SettlementManifestItem> {
    const result = item.action === 'capture'
      ? await this.depositLifecycle.processCaptureItem(manifest, item)
      : await this.depositLifecycle.processRefundItem(manifest, item);

    if (result.status === 'failed') {
      this.metrics.settlementItemFailuresTotal.inc({ action: result.action });
    }

    return result;
  }

  // ── 3. Finalize Manifest ──────────────────────────────────────

  async finalizeManifest(
    manifest: SettlementManifest,
  ): Promise<'completed' | 'failed' | 'in_progress'> {
    const data = manifest.manifestData as unknown as SettlementManifestData;
    const items = data.items;

    const acknowledgedCount = items.filter((i) => i.status === 'acknowledged').length;
    const hasMaxRetryFailure = items.some(
      (i) => i.status === 'failed' && i.retry_count >= MAX_RETRIES,
    );

    // Empty manifest (no-bid auction) or all items acknowledged
    if (acknowledgedCount === items.length) {
      return this.completeSettlement(manifest, acknowledgedCount);
    }

    // 3-strike failure escalation
    if (hasMaxRetryFailure) {
      return this.escalateSettlement(manifest, acknowledgedCount);
    }

    // Still in progress — update acknowledged count
    manifest.itemsAcknowledged = acknowledgedCount;
    await this.manifestRepo.save(manifest);
    return 'in_progress';
  }

  private async completeSettlement(
    manifest: SettlementManifest,
    acknowledgedCount: number,
  ): Promise<'completed'> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const auction = await qr.manager
        .createQueryBuilder(Auction, 'a')
        .setLock('pessimistic_write')
        .where('a.id = :id', { id: manifest.auctionId })
        .getOne();

      if (!auction || auction.status !== AuctionStatus.SETTLING) {
        await qr.rollbackTransaction();
        return 'completed';
      }

      // Transition: SETTLING → SETTLED (DB trigger validates)
      auction.status = AuctionStatus.SETTLED as string;

      // Write settlement summary for audit
      auction.settlementMetadata = {
        manifest_id: manifest.id,
        items_total: manifest.itemsTotal,
        items_acknowledged: acknowledgedCount,
        settled_at: new Date().toISOString(),
      };
      await qr.manager.save(Auction, auction);

      manifest.status = 'completed';
      manifest.itemsAcknowledged = acknowledgedCount;
      manifest.completedAt = new Date();
      await qr.manager.save(SettlementManifest, manifest);

      await qr.commitTransaction();
      this.logger.log(
        JSON.stringify({
          event: 'settlement_completed',
          auction_id: manifest.auctionId,
          manifest_id: manifest.id,
          items_total: manifest.itemsTotal,
          items_acknowledged: acknowledgedCount,
        }),
      );
      return 'completed';
    } catch (err) {
      if (qr.isTransactionActive) {
        await qr.rollbackTransaction();
      }
      throw err;
    } finally {
      await qr.release();
    }
  }

  private async escalateSettlement(
    manifest: SettlementManifest,
    acknowledgedCount: number,
  ): Promise<'failed'> {
    const data = manifest.manifestData as unknown as SettlementManifestData;
    const failedItems = data.items.filter(
      (i) => i.status === 'failed' && i.retry_count >= MAX_RETRIES,
    );

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const auction = await qr.manager
        .createQueryBuilder(Auction, 'a')
        .setLock('pessimistic_write')
        .where('a.id = :id', { id: manifest.auctionId })
        .getOne();

      if (!auction || auction.status !== AuctionStatus.SETTLING) {
        await qr.rollbackTransaction();
        return 'failed';
      }

      // Transition: SETTLING → SETTLEMENT_FAILED (DB trigger validates)
      auction.status = AuctionStatus.SETTLEMENT_FAILED as string;
      auction.settlementMetadata = {
        manifest_id: manifest.id,
        items_total: manifest.itemsTotal,
        items_acknowledged: acknowledgedCount,
        failed_items: failedItems.map((i) => ({
          deposit_id: i.deposit_id,
          action: i.action,
          failure_reason: i.failure_reason,
          retry_count: i.retry_count,
        })),
        escalated_at: new Date().toISOString(),
      };
      await qr.manager.save(Auction, auction);

      manifest.status = 'escalated';
      manifest.itemsAcknowledged = acknowledgedCount;
      await qr.manager.save(SettlementManifest, manifest);

      await qr.commitTransaction();
      this.logger.error(
        JSON.stringify({
          event: 'settlement_escalated',
          auction_id: manifest.auctionId,
          manifest_id: manifest.id,
          items_total: manifest.itemsTotal,
          items_acknowledged: acknowledgedCount,
          failed_count: failedItems.length,
          failed_deposits: failedItems.map((i) => i.deposit_id),
        }),
      );
      return 'failed';
    } catch (err) {
      if (qr.isTransactionActive) {
        await qr.rollbackTransaction();
      }
      throw err;
    } finally {
      await qr.release();
    }
  }

  // ── 4. Update Manifest Data ───────────────────────────────────

  async updateManifestData(
    manifest: SettlementManifest,
    updatedItems: SettlementManifestItem[],
  ): Promise<void> {
    const data = manifest.manifestData as unknown as SettlementManifestData;
    data.items = updatedItems;
    manifest.manifestData = data as unknown as Record<string, unknown>;
    manifest.itemsAcknowledged = updatedItems.filter((i) => i.status === 'acknowledged').length;
    await this.manifestRepo.save(manifest);
  }
}

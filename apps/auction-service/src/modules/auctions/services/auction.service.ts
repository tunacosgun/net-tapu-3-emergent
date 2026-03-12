import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Auction } from '../entities/auction.entity';
import { AuctionParticipant } from '../entities/auction-participant.entity';
import { AuctionStatus, Deposit } from '@nettapu/shared';
import { CreateAuctionDto } from '../dto/create-auction.dto';
import { UpdateAuctionStatusDto } from '../dto/update-auction-status.dto';
import { ListAuctionsQueryDto } from '../dto/list-auctions-query.dto';

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  [AuctionStatus.DRAFT]: [AuctionStatus.SCHEDULED],
  [AuctionStatus.SCHEDULED]: [AuctionStatus.LIVE],
  [AuctionStatus.LIVE]: [AuctionStatus.ENDING, AuctionStatus.CANCELLED],
  [AuctionStatus.ENDING]: [AuctionStatus.ENDED, AuctionStatus.CANCELLED],
  [AuctionStatus.ENDED]: [AuctionStatus.SETTLING],
  [AuctionStatus.SETTLING]: [AuctionStatus.SETTLED, AuctionStatus.SETTLEMENT_FAILED],
  [AuctionStatus.SETTLEMENT_FAILED]: [AuctionStatus.SETTLED],
};

@Injectable()
export class AuctionService {
  private readonly logger = new Logger(AuctionService.name);

  constructor(
    @InjectRepository(Auction)
    private readonly auctionRepo: Repository<Auction>,
    @InjectRepository(AuctionParticipant)
    private readonly participantRepo: Repository<AuctionParticipant>,
    @InjectRepository(Deposit)
    private readonly depositRepo: Repository<Deposit>,
    private readonly ds: DataSource,
  ) {}

  async create(dto: CreateAuctionDto, userId: string): Promise<Auction> {
    const auction = this.auctionRepo.create({
      parcelId: dto.parcelId,
      title: dto.title,
      description: dto.description ?? null,
      status: AuctionStatus.DRAFT,
      startingPrice: dto.startingPrice,
      minimumIncrement: dto.minimumIncrement,
      requiredDeposit: dto.requiredDeposit,
      currency: dto.currency ?? 'TRY',
      scheduledStart: new Date(dto.startTime),
      scheduledEnd: new Date(dto.endTime),
      depositDeadline: new Date(dto.depositDeadline),
      createdBy: userId,
      sniperEnabled: dto.sniperEnabled ?? true,
      sniperWindowSeconds: dto.sniperWindowSeconds ?? null,
      sniperExtensionSeconds: dto.sniperExtensionSeconds ?? null,
      maxSniperExtensions: dto.maxSniperExtensions ?? null,
    });

    const saved = await this.auctionRepo.save(auction);
    this.logger.log(`Auction created: ${saved.id} by user ${userId}`);
    return saved;
  }

  async findAll(
    query: ListAuctionsQueryDto,
  ): Promise<{ data: Auction[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.auctionRepo.createQueryBuilder('auction');

    if (query.status) {
      qb.where('auction.status = :status', { status: query.status });
    }

    qb.orderBy('auction.createdAt', 'DESC').skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string): Promise<Auction> {
    const auction = await this.auctionRepo.findOne({ where: { id } });
    if (!auction) {
      throw new NotFoundException(`Auction ${id} not found`);
    }
    return auction;
  }

  async getMyParticipation(
    auctionId: string,
    userId: string,
  ): Promise<{ eligible: boolean; depositStatus: string | null }> {
    const participant = await this.participantRepo.findOne({
      where: { auctionId, userId },
    });

    if (!participant) {
      return { eligible: false, depositStatus: null };
    }

    const deposit = await this.depositRepo.findOne({
      where: { id: participant.depositId },
    });

    return {
      eligible: participant.eligible,
      depositStatus: deposit?.status ?? null,
    };
  }

  async remove(id: string): Promise<void> {
    const auction = await this.auctionRepo.findOne({ where: { id } });
    if (!auction) {
      throw new NotFoundException(`Auction ${id} not found`);
    }

    // Clean up all related records, disabling append-only triggers temporarily
    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      await qr.query('ALTER TABLE auctions.bids DISABLE TRIGGER trg_bids_no_delete');
      await qr.query('ALTER TABLE auctions.bid_rejections DISABLE TRIGGER trg_bid_rejections_no_delete');

      await qr.query('DELETE FROM auctions.settlement_manifests WHERE auction_id = $1', [id]);
      await qr.query('DELETE FROM auctions.bid_rejections WHERE auction_id = $1', [id]);
      await qr.query('DELETE FROM auctions.bids_corrections WHERE auction_id = $1', [id]);
      await qr.query('DELETE FROM auctions.bids WHERE auction_id = $1', [id]);
      await qr.query('DELETE FROM auctions.auction_consents WHERE auction_id = $1', [id]);
      await qr.query('DELETE FROM auctions.auction_participants WHERE auction_id = $1', [id]);
      await qr.query('DELETE FROM auctions.event_outbox WHERE aggregate_id = $1', [id]);
      await qr.query('DELETE FROM auctions.auctions WHERE id = $1', [id]);

      await qr.query('ALTER TABLE auctions.bids ENABLE TRIGGER trg_bids_no_delete');
      await qr.query('ALTER TABLE auctions.bid_rejections ENABLE TRIGGER trg_bid_rejections_no_delete');

      await qr.commitTransaction();
      this.logger.log(`Auction ${id} and all related records deleted`);
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  async updateStatus(id: string, dto: UpdateAuctionStatusDto): Promise<Auction> {
    const auction = await this.auctionRepo.findOne({ where: { id } });
    if (!auction) {
      throw new NotFoundException(`Auction ${id} not found`);
    }

    if (auction.version !== dto.version) {
      throw new ConflictException(
        `Version conflict: expected ${dto.version}, current ${auction.version}`,
      );
    }

    const allowed = ALLOWED_TRANSITIONS[auction.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Invalid status transition: ${auction.status} -> ${dto.status}. Allowed: [${allowed.join(', ')}]`,
      );
    }

    const oldStatus = auction.status;
    auction.status = dto.status;

    if (dto.status === AuctionStatus.LIVE) {
      const liveCount = await this.auctionRepo.count({
        where: { status: AuctionStatus.LIVE as string },
      });
      if (liveCount >= 10) {
        throw new ConflictException(
          `Cannot go LIVE: ${liveCount} auctions already live (max 10)`,
        );
      }
      auction.actualStart = new Date();
    }

    if (dto.status === AuctionStatus.ENDED || dto.status === AuctionStatus.CANCELLED) {
      auction.endedAt = new Date();
    }

    try {
      const saved = await this.auctionRepo.save(auction);
      this.logger.log(`Auction ${id} status: ${oldStatus} -> ${dto.status}`);
      return saved;
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        err.name === 'OptimisticLockVersionMismatchError'
      ) {
        throw new ConflictException(
          'Concurrent modification detected. Please retry with current version.',
        );
      }
      throw err;
    }
  }
}

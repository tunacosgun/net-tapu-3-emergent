import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { Auction } from '../entities/auction.entity';
import { AuctionConsent } from '../entities/auction-consent.entity';
import { AuctionParticipant } from '../entities/auction-participant.entity';
import { AuctionStatus } from '@nettapu/shared';

@Injectable()
export class ConsentService {
  private readonly logger = new Logger(ConsentService.name);

  constructor(
    @InjectRepository(Auction)
    private readonly auctionRepo: Repository<Auction>,

    @InjectRepository(AuctionConsent)
    private readonly consentRepo: Repository<AuctionConsent>,

    @InjectRepository(AuctionParticipant)
    private readonly participantRepo: Repository<AuctionParticipant>,
  ) {}

  /**
   * Accept auction participation consent.
   * Requirements:
   * 1. Auction must exist and be in a biddable state
   * 2. User must be an eligible participant (deposit paid)
   * 3. User must not have already accepted consent for this auction
   */
  async acceptConsent(
    auctionId: string,
    userId: string,
    consentText: string,
    ipAddress: string | null,
    userAgent: string | null,
  ): Promise<AuctionConsent> {
    // 1. Verify auction exists and is in valid state
    const auction = await this.auctionRepo.findOne({ where: { id: auctionId } });
    if (!auction) {
      throw new NotFoundException(`Auction ${auctionId} not found`);
    }

    const allowedStatuses = [
      AuctionStatus.SCHEDULED,
      AuctionStatus.DEPOSIT_OPEN,
      AuctionStatus.LIVE,
      AuctionStatus.ENDING,
    ];
    if (!allowedStatuses.includes(auction.status as AuctionStatus)) {
      throw new BadRequestException(
        `Cannot accept consent for auction in status: ${auction.status}`,
      );
    }

    // 2. Verify user is an eligible participant
    const participant = await this.participantRepo.findOne({
      where: { auctionId, userId, eligible: true },
    });
    if (!participant) {
      throw new BadRequestException(
        'You must pay the required deposit before accepting auction terms',
      );
    }

    // 3. Check for existing consent (idempotent)
    const existing = await this.consentRepo.findOne({
      where: { auctionId, userId },
    });
    if (existing) {
      this.logger.debug(
        `Consent already accepted: user=${userId}, auction=${auctionId}`,
      );
      return existing;
    }

    // 4. Hash the consent text for legal proof
    const consentTextHash = createHash('sha256')
      .update(consentText)
      .digest('hex');

    // 5. Create consent record
    try {
      const consent = this.consentRepo.create({
        auctionId,
        userId,
        consentTextHash,
        ipAddress,
        userAgent,
        acceptedAt: new Date(),
      });

      const saved = await this.consentRepo.save(consent);

      this.logger.log(
        `Consent accepted: user=${userId}, auction=${auctionId}, hash=${consentTextHash.slice(0, 12)}...`,
      );

      return saved;
    } catch (err: unknown) {
      // Handle unique constraint race condition
      if (
        err instanceof Error &&
        'code' in err &&
        (err as any).code === '23505'
      ) {
        const existingConsent = await this.consentRepo.findOne({
          where: { auctionId, userId },
        });
        if (existingConsent) {
          return existingConsent;
        }
        throw new ConflictException('Consent already recorded');
      }
      throw err;
    }
  }

  /**
   * Check if user has accepted consent for an auction.
   */
  async hasConsent(auctionId: string, userId: string): Promise<boolean> {
    const consent = await this.consentRepo.findOne({
      where: { auctionId, userId },
    });
    return !!consent;
  }

  /**
   * Get consent record for a user in an auction.
   */
  async getConsent(
    auctionId: string,
    userId: string,
  ): Promise<AuctionConsent | null> {
    return this.consentRepo.findOne({
      where: { auctionId, userId },
    });
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Headers,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuctionService } from '../services/auction.service';
import { ConsentService } from '../services/consent.service';
import { Bid } from '../entities/bid.entity';
import { CreateAuctionDto } from '../dto/create-auction.dto';
import { UpdateAuctionStatusDto } from '../dto/update-auction-status.dto';
import { ListAuctionsQueryDto } from '../dto/list-auctions-query.dto';
import { AcceptConsentDto } from '../dto/accept-consent.dto';
import { AdminGuard } from '../guards/admin.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller()
export class AuctionController {
  constructor(
    private readonly auctionService: AuctionService,
    private readonly consentService: ConsentService,
    @InjectRepository(Bid)
    private readonly bidRepo: Repository<Bid>,
  ) {}

  @Post()
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateAuctionDto,
    @Req() req: Record<string, any>,
  ) {
    const userId = req.user?.sub;

    if (!userId) {
      throw new UnauthorizedException('Authenticated user ID is required');
    }

    return this.auctionService.create(dto, userId);
  }

  @Get()
  async list(@Query() query: ListAuctionsQueryDto) {
    return this.auctionService.findAll(query);
  }

  @Get(':id')
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('include_bids') includeBids?: string,
  ) {
    const auction = await this.auctionService.findById(id);
    if (includeBids === 'true' || includeBids === '1') {
      const bids = await this.bidRepo.find({
        where: { auctionId: id },
        order: { serverTs: 'DESC' },
        take: 50,
        select: ['id', 'auctionId', 'userId', 'amount', 'serverTs'],
      });
      return {
        ...auction,
        recentBids: bids.map((b) => ({
          id: b.id,
          user_id: b.userId.slice(0, 8) + '****',
          amount: b.amount,
          server_ts: b.serverTs.toISOString(),
        })),
      };
    }
    return auction;
  }

  @Get(':id/my-participation')
  @UseGuards(JwtAuthGuard)
  async getMyParticipation(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Record<string, any>,
  ) {
    const userId = req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Authenticated user ID is required');
    }
    return this.auctionService.getMyParticipation(id, userId);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.auctionService.remove(id);
  }

  @Patch(':id/status')
  @UseGuards(AdminGuard)
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAuctionStatusDto,
  ) {
    return this.auctionService.updateStatus(id, dto);
  }

  // ── Bid History (public, read-only) ────────────────────────────

  @Get(':id/bid-history')
  async listBids(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: string,
  ) {
    const take = Math.min(parseInt(limit || '50', 10) || 50, 100);
    const bids = await this.bidRepo.find({
      where: { auctionId: id },
      order: { serverTs: 'DESC' },
      take,
      select: ['id', 'auctionId', 'userId', 'amount', 'serverTs'],
    });
    return {
      data: bids.map((b) => ({
        id: b.id,
        auction_id: b.auctionId,
        user_id: b.userId.slice(0, 8) + '****',
        amount: b.amount,
        server_ts: b.serverTs.toISOString(),
      })),
      total: bids.length,
    };
  }

  // ── Auction Consent Endpoints ──────────────────────────────────

  /**
   * Accept auction participation agreement.
   * User must accept terms before placing bids.
   * Stores consent text hash, IP, and user-agent for legal compliance.
   */
  @Post(':id/consent')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async acceptConsent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AcceptConsentDto,
    @Req() req: Record<string, any>,
    @Headers('user-agent') userAgent: string,
  ) {
    const userId = req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Authenticated user ID is required');
    }

    const ipAddress =
      (req.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.ip ??
      null;

    const consent = await this.consentService.acceptConsent(
      id,
      userId,
      dto.consentText,
      ipAddress,
      userAgent ?? null,
    );

    return {
      id: consent.id,
      auctionId: consent.auctionId,
      acceptedAt: consent.acceptedAt,
      consentTextHash: consent.consentTextHash,
    };
  }

  /**
   * Check if the current user has accepted consent for an auction.
   */
  @Get(':id/consent')
  @UseGuards(JwtAuthGuard)
  async getMyConsent(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Record<string, any>,
  ) {
    const userId = req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Authenticated user ID is required');
    }

    const consent = await this.consentService.getConsent(id, userId);
    return {
      hasConsent: !!consent,
      acceptedAt: consent?.acceptedAt ?? null,
    };
  }
}

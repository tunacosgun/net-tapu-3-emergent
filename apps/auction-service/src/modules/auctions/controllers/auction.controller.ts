import {
  Controller,
  Get,
  Post,
  Patch,
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
import { AuctionService } from '../services/auction.service';
import { ConsentService } from '../services/consent.service';
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
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.auctionService.findById(id);
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

  @Patch(':id/status')
  @UseGuards(AdminGuard)
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAuctionStatusDto,
  ) {
    return this.auctionService.updateStatus(id, dto);
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

import {
  Controller,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { BidService, BidAcceptedResponse } from '../services/bid.service';
import { PlaceBidDto } from '../dto/place-bid.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('bids')
@UseGuards(JwtAuthGuard)
export class BidController {
  constructor(private readonly bidService: BidService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async placeBid(
    @Body() dto: PlaceBidDto,
    @Req() req: Record<string, any>,
  ): Promise<BidAcceptedResponse> {
    const userId = req.user?.sub;

    if (!userId) {
      throw new UnauthorizedException('Authenticated user ID is required');
    }

    const ipAddress =
      (req.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.ip;

    // Outbox events (BID_ACCEPTED, SNIPER_EXTENSION) are written
    // in the same transaction as the bid — relay worker handles broadcast.
    return this.bidService.placeBid(dto, userId, ipAddress);
  }
}

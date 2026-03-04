import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/auth.service';
import { PriceAlertService } from '../services/price-alert.service';

class CreatePriceAlertDto {
  targetPrice?: number;
  alertType?: string;
}

@Controller('parcels')
@UseGuards(JwtAuthGuard)
export class PriceAlertController {
  constructor(private readonly priceAlertService: PriceAlertService) {}

  /**
   * POST /parcels/:id/price-alert — Subscribe to price drop alerts
   */
  @Post(':id/price-alert')
  @HttpCode(HttpStatus.CREATED)
  async subscribe(
    @Param('id', ParseUUIDPipe) parcelId: string,
    @Body() dto: CreatePriceAlertDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.priceAlertService.subscribe(user.sub, parcelId, {
      targetPrice: dto.targetPrice,
      alertType: dto.alertType,
    });
  }

  /**
   * DELETE /parcels/:id/price-alert — Unsubscribe from price drop alerts
   */
  @Delete(':id/price-alert')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unsubscribe(
    @Param('id', ParseUUIDPipe) parcelId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.priceAlertService.unsubscribe(user.sub, parcelId);
  }

  /**
   * GET /parcels/:id/price-alert — Check if user has an active price alert
   */
  @Get(':id/price-alert')
  async checkAlert(
    @Param('id', ParseUUIDPipe) parcelId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const hasAlert = await this.priceAlertService.hasAlert(user.sub, parcelId);
    return { parcelId, hasAlert };
  }
}

/**
 * Separate controller for user-level price alert management.
 */
@Controller('user/price-alerts')
@UseGuards(JwtAuthGuard)
export class UserPriceAlertController {
  constructor(private readonly priceAlertService: PriceAlertService) {}

  /**
   * GET /user/price-alerts — Get all active price alerts for the current user
   */
  @Get()
  async getMyAlerts(@CurrentUser() user: JwtPayload) {
    return this.priceAlertService.getUserAlerts(user.sub);
  }
}

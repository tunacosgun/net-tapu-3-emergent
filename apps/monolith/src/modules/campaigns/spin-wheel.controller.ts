import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { SpinWheelService } from './spin-wheel.service';

/**
 * Public spin wheel endpoints for authenticated users.
 */
@Controller('campaigns/spin')
@UseGuards(JwtAuthGuard)
export class SpinWheelController {
  constructor(private readonly spinWheelService: SpinWheelService) {}

  /**
   * GET /campaigns/spin/eligibility — Check if user can spin
   */
  @Get('eligibility')
  async getEligibility(@CurrentUser() user: JwtPayload) {
    return this.spinWheelService.getEligibility(user.sub);
  }

  /**
   * POST /campaigns/spin — Execute a spin
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async spin(@CurrentUser() user: JwtPayload) {
    return this.spinWheelService.spin(user.sub);
  }

  /**
   * GET /campaigns/spin/history — Get user's spin history
   */
  @Get('history')
  async getHistory(@CurrentUser() user: JwtPayload) {
    return this.spinWheelService.getUserSpinHistory(user.sub);
  }

  /**
   * POST /campaigns/spin/redeem/:code — Redeem a discount code
   */
  @Post('redeem/:code')
  @HttpCode(HttpStatus.OK)
  async redeem(
    @Param('code') code: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.spinWheelService.redeemCode(code, user.sub);
  }
}

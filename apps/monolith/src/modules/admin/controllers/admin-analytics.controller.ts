import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AuditInterceptor } from '../interceptors/audit.interceptor';
import { AdminAnalyticsService } from '../services/admin-analytics.service';

@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@UseInterceptors(AuditInterceptor)
export class AdminAnalyticsController {
  constructor(private readonly analyticsService: AdminAnalyticsService) {}

  /** GET /admin/analytics/overview — Aggregate dashboard data */
  @Get('overview')
  async getOverview(@Query('period') period?: string) {
    return this.analyticsService.getOverview(period || 'month');
  }

  /** GET /admin/analytics/time-series — Daily counts for charts */
  @Get('time-series')
  async getTimeSeries(@Query('period') period?: string) {
    return this.analyticsService.getTimeSeries(period || 'month');
  }

  /** GET /admin/analytics/revenue — Revenue trend data */
  @Get('revenue')
  async getRevenueTrend(@Query('period') period?: string) {
    return this.analyticsService.getRevenueTrend(period || 'month');
  }

  /** GET /admin/analytics/top-parcels — Most popular parcels */
  @Get('top-parcels')
  async getTopParcels(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.analyticsService.getTopParcels(Math.min(limit, 50));
  }

  /** GET /admin/analytics/activity — Recent admin activity feed */
  @Get('activity')
  async getRecentActivity(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.analyticsService.getRecentActivity(Math.min(limit, 100));
  }

  /** GET /admin/analytics/distribution — City-level parcel distribution */
  @Get('distribution')
  async getParcelDistribution() {
    return this.analyticsService.getParcelDistribution();
  }

  /** GET /admin/analytics/crm — CRM call center dashboard */
  @Get('crm')
  @Roles('admin', 'consultant')
  async getCrmDashboard() {
    return this.analyticsService.getCrmDashboard();
  }

  /** GET /admin/analytics/auctions/:id/participants — Participant names for admin bid feed */
  @Get('auctions/:id/participants')
  async getAuctionParticipants(@Param('id') auctionId: string) {
    return this.analyticsService.getAuctionParticipantNames(auctionId);
  }
}

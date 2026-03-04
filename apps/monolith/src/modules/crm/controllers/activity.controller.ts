import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ActivityTrackingService } from '../services/activity-tracking.service';

@Controller('activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityTrackingService) {}

  /**
   * Track a user action (page view, click, etc).
   * Accepts both authenticated and anonymous users.
   */
  @Post('track')
  @HttpCode(HttpStatus.ACCEPTED)
  async track(
    @Body()
    body: {
      action: string;
      resourceType?: string;
      resourceId?: string;
      sessionId?: string;
      metadata?: Record<string, unknown>;
    },
    @Req() req: Request,
  ) {
    const user = (req as unknown as Record<string, unknown>).user as { sub?: string } | undefined;
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.ip;
    const userAgent = req.headers['user-agent'];

    await this.activityService.track({
      userId: user?.sub,
      sessionId: body.sessionId,
      action: body.action,
      resourceType: body.resourceType,
      resourceId: body.resourceId,
      metadata: body.metadata,
      ipAddress,
      userAgent,
    });

    return { tracked: true };
  }

  /**
   * Social proof: get active viewer count for a resource.
   */
  @Get('viewers/:resourceType/:resourceId')
  async getViewerCount(
    @Param('resourceType') resourceType: string,
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
    @Query('window') window?: string,
  ) {
    const windowMinutes = parseInt(window || '15', 10);
    const count = await this.activityService.getActiveViewerCount(
      resourceType,
      resourceId,
      windowMinutes,
    );
    return { count };
  }

  /**
   * CRM: get a user's recent activity (call center screen).
   */
  @Get('user/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'superadmin', 'consultant')
  async getUserActivity(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('limit') limit?: string,
  ) {
    return this.activityService.getUserActivity(
      userId,
      parseInt(limit || '50', 10),
    );
  }

  /**
   * CRM: get last parcel a user was viewing (call center context).
   */
  @Get('user/:userId/last-viewed-parcel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'superadmin', 'consultant')
  async getLastViewedParcel(
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.activityService.getLastViewedParcel(userId);
  }
}

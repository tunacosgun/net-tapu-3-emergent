import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserActivityLog } from '../entities/user-activity-log.entity';

export interface TrackActivityParams {
  userId?: string;
  sessionId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class ActivityTrackingService {
  private readonly logger = new Logger(ActivityTrackingService.name);

  constructor(
    @InjectRepository(UserActivityLog)
    private readonly activityRepo: Repository<UserActivityLog>,
  ) {}

  /**
   * Record a user activity. Fire-and-forget — never blocks the caller.
   */
  async track(params: TrackActivityParams): Promise<void> {
    try {
      await this.activityRepo.save(
        this.activityRepo.create({
          userId: params.userId ?? null,
          sessionId: params.sessionId ?? null,
          action: params.action,
          resourceType: params.resourceType ?? null,
          resourceId: params.resourceId ?? null,
          metadata: params.metadata ?? null,
          ipAddress: params.ipAddress ?? null,
          userAgent: params.userAgent ?? null,
        }),
      );
    } catch (err) {
      // Never fail the parent operation
      this.logger.warn(`Activity tracking failed: ${err}`);
    }
  }

  /**
   * Get recent activity for a user (for CRM call center screen).
   */
  async getUserActivity(
    userId: string,
    limit = 50,
  ): Promise<UserActivityLog[]> {
    return this.activityRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get what a user was last viewing (parcel context for call center).
   */
  async getLastViewedParcel(userId: string): Promise<UserActivityLog | null> {
    return this.activityRepo.findOne({
      where: {
        userId,
        action: 'parcel_view',
        resourceType: 'parcel',
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get view count for a resource (social proof).
   */
  async getViewCount(resourceType: string, resourceId: string): Promise<number> {
    return this.activityRepo.count({
      where: {
        action: 'parcel_view',
        resourceType,
        resourceId,
      },
    });
  }

  /**
   * Get unique viewer count in the last N minutes (social proof: "X kişi bakıyor").
   */
  async getActiveViewerCount(
    resourceType: string,
    resourceId: string,
    windowMinutes = 15,
  ): Promise<number> {
    const since = new Date();
    since.setMinutes(since.getMinutes() - windowMinutes);

    const result = await this.activityRepo
      .createQueryBuilder('a')
      .select('COUNT(DISTINCT COALESCE(a.user_id::text, a.session_id))', 'count')
      .where('a.resource_type = :resourceType', { resourceType })
      .andWhere('a.resource_id = :resourceId', { resourceId })
      .andWhere('a.action = :action', { action: 'parcel_view' })
      .andWhere('a.created_at > :since', { since })
      .getRawOne();

    return parseInt(result?.count || '0', 10);
  }
}

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

interface BroadcastInput {
  subject: string;
  message: string;
  channels: string[];
  audience: string;
  targetUserId?: string;
}

@Injectable()
export class AdminBroadcastService {
  private readonly logger = new Logger(AdminBroadcastService.name);

  constructor(private readonly dataSource: DataSource) {}

  async broadcast(input: BroadcastInput, adminUserId: string) {
    const { subject, message, channels, audience, targetUserId } = input;

    if (!channels.length) {
      throw new BadRequestException('At least one channel must be selected');
    }

    // Determine target users
    let userQuery = 'SELECT id, email, phone FROM auth.users WHERE is_locked = false';
    const params: unknown[] = [];

    if (audience === 'verified') {
      userQuery += ' AND is_email_verified = true';
    } else if (audience === 'specific') {
      if (!targetUserId) {
        throw new BadRequestException('Target user ID required for specific audience');
      }
      userQuery += ' AND id = $1';
      params.push(targetUserId);
    }

    const users = await this.dataSource.query(userQuery, params) as Array<{
      id: string;
      email: string;
      phone: string | null;
    }>;

    // Enqueue notifications for each user
    let enqueued = 0;

    for (const user of users) {
      for (const channel of channels) {
        try {
          await this.dataSource.query(
            `INSERT INTO crm.notification_queue
              (user_id, event_type, channel, subject, body, data, status, created_at)
             VALUES ($1, 'admin_broadcast', $2, $3, $4, $5, 'pending', NOW())`,
            [
              user.id,
              channel,
              subject,
              message,
              JSON.stringify({
                adminUserId,
                audience,
                broadcastAt: new Date().toISOString(),
              }),
            ],
          );
          enqueued++;
        } catch (err) {
          this.logger.warn(
            `Failed to enqueue ${channel} notification for user ${user.id}: ${(err as Error).message}`,
          );
        }
      }
    }

    this.logger.log(
      `Broadcast by admin ${adminUserId}: ${enqueued} notifications enqueued to ${users.length} users`,
    );

    return {
      success: true,
      totalUsers: users.length,
      totalNotifications: enqueued,
      channels,
      audience,
    };
  }
}

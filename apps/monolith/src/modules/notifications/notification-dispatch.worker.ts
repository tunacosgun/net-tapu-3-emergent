import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, In } from 'typeorm';
import { NotificationQueue } from '../crm/entities/notification-queue.entity';
import { NotificationService } from './notification.service';

@Injectable()
export class NotificationDispatchWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationDispatchWorker.name);
  private intervalHandle?: ReturnType<typeof setInterval>;
  private readonly enabled: boolean;
  private readonly pollIntervalMs: number;
  private readonly batchSize: number;
  private processing = false;

  constructor(
    @InjectRepository(NotificationQueue)
    private readonly queueRepo: Repository<NotificationQueue>,
    private readonly notificationService: NotificationService,
    private readonly config: ConfigService,
  ) {
    this.enabled = this.config.get<string>('NOTIFICATION_DISPATCH_ENABLED', 'true') === 'true';
    this.pollIntervalMs = this.config.get<number>('NOTIFICATION_POLL_INTERVAL_MS', 5000);
    this.batchSize = this.config.get<number>('NOTIFICATION_BATCH_SIZE', 10);
  }

  onModuleInit() {
    if (!this.enabled) {
      this.logger.warn('Notification dispatch worker is DISABLED');
      return;
    }

    this.logger.log(
      `Notification dispatch worker started (poll: ${this.pollIntervalMs}ms, batch: ${this.batchSize})`,
    );

    this.intervalHandle = setInterval(() => this.poll(), this.pollIntervalMs);
  }

  onModuleDestroy() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.logger.log('Notification dispatch worker stopped');
    }
  }

  private async poll(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      const notifications = await this.queueRepo.find({
        where: {
          status: In(['queued']),
          scheduledFor: LessThanOrEqual(new Date()),
        },
        order: { scheduledFor: 'ASC' },
        take: this.batchSize,
      });

      if (notifications.length === 0) {
        return;
      }

      this.logger.debug(`Processing ${notifications.length} queued notifications`);

      for (const notification of notifications) {
        try {
          await this.notificationService.processNotification(notification);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error(`Failed to process notification ${notification.id}: ${msg}`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Notification poll error: ${msg}`);
    } finally {
      this.processing = false;
    }
  }
}

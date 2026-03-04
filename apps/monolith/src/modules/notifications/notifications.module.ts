import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationQueue } from '../crm/entities/notification-queue.entity';
import { NotificationLog } from '../crm/entities/notification-log.entity';
import { User } from '../auth/entities/user.entity';
import { NotificationService } from './notification.service';
import { NotificationDispatchWorker } from './notification-dispatch.worker';
import { NotificationsController } from './notifications.controller';
import { SendGridAdapter } from './adapters/sendgrid.adapter';
import { NetgsmAdapter } from './adapters/netgsm.adapter';
import { ConsoleNotificationAdapter } from './adapters/console.adapter';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationQueue, NotificationLog, User]),
  ],
  controllers: [NotificationsController],
  providers: [
    SendGridAdapter,
    NetgsmAdapter,
    ConsoleNotificationAdapter,
    NotificationService,
    NotificationDispatchWorker,
  ],
  exports: [NotificationService],
})
export class NotificationsModule {}

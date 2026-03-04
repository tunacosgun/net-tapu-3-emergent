import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationQueue } from '../crm/entities/notification-queue.entity';
import { NotificationLog } from '../crm/entities/notification-log.entity';
import { User } from '../auth/entities/user.entity';
import { UserDevice } from './entities/user-device.entity';
import { NotificationService } from './notification.service';
import { NotificationDispatchWorker } from './notification-dispatch.worker';
import { NotificationsController } from './notifications.controller';
import { DeviceController } from './device.controller';
import { SendGridAdapter } from './adapters/sendgrid.adapter';
import { NetgsmAdapter } from './adapters/netgsm.adapter';
import { FirebaseAdapter } from './adapters/firebase.adapter';
import { ConsoleNotificationAdapter } from './adapters/console.adapter';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationQueue, NotificationLog, User, UserDevice]),
  ],
  controllers: [NotificationsController, DeviceController],
  providers: [
    SendGridAdapter,
    NetgsmAdapter,
    FirebaseAdapter,
    ConsoleNotificationAdapter,
    NotificationService,
    NotificationDispatchWorker,
  ],
  exports: [NotificationService, FirebaseAdapter],
})
export class NotificationsModule {}

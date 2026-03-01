import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { NotificationService } from './notification.service';
import { NotificationEventDto } from './dto/notification-event.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('events')
  @Throttle({ short: { ttl: 1000, limit: 50 } })
  @HttpCode(HttpStatus.ACCEPTED)
  async handleEvent(@Body() dto: NotificationEventDto) {
    await this.notificationService.handleEvent(
      dto.event,
      dto.userId,
      dto.metadata,
    );
    return { queued: true };
  }
}

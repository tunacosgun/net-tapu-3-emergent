import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/auth.service';
import { AuditInterceptor } from '../interceptors/audit.interceptor';
import { AdminBroadcastService } from '../services/admin-broadcast.service';

class BroadcastDto {
  subject!: string;
  message!: string;
  channels!: string[]; // ['email', 'sms', 'push']
  audience!: string; // 'all' | 'verified' | 'specific'
  targetUserId?: string;
}

@Controller('admin/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@UseInterceptors(AuditInterceptor)
export class AdminNotificationController {
  constructor(private readonly broadcastService: AdminBroadcastService) {}

  /**
   * POST /admin/notifications/broadcast — Send notification to users
   */
  @Post('broadcast')
  @HttpCode(HttpStatus.OK)
  async broadcast(
    @Body() dto: BroadcastDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.broadcastService.broadcast(dto, user.sub);
  }
}

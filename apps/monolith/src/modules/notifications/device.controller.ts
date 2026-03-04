import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { UserDevice } from './entities/user-device.entity';

@Controller('user/devices')
@UseGuards(JwtAuthGuard)
export class DeviceController {
  constructor(
    @InjectRepository(UserDevice)
    private readonly deviceRepo: Repository<UserDevice>,
  ) {}

  /**
   * POST /user/devices — Register a device for push notifications
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async registerDevice(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      deviceToken: string;
      platform: 'web' | 'ios' | 'android';
      deviceName?: string;
    },
  ) {
    // Upsert — if the token already exists, update the user/metadata
    const existing = await this.deviceRepo.findOne({
      where: { deviceToken: body.deviceToken },
    });

    if (existing) {
      existing.userId = user.sub;
      existing.platform = body.platform;
      existing.deviceName = body.deviceName ?? existing.deviceName;
      existing.isActive = true;
      existing.lastUsedAt = new Date();
      await this.deviceRepo.save(existing);
      return { id: existing.id, registered: true };
    }

    const device = this.deviceRepo.create({
      userId: user.sub,
      deviceToken: body.deviceToken,
      platform: body.platform,
      deviceName: body.deviceName ?? null,
      isActive: true,
    });

    const saved = await this.deviceRepo.save(device);
    return { id: saved.id, registered: true };
  }

  /**
   * GET /user/devices — Get user's registered devices
   */
  @Get()
  async getDevices(@CurrentUser() user: JwtPayload) {
    return this.deviceRepo.find({
      where: { userId: user.sub, isActive: true },
      order: { lastUsedAt: 'DESC' },
    });
  }

  /**
   * DELETE /user/devices/:id — Unregister a device
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unregisterDevice(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.deviceRepo.update(
      { id, userId: user.sub },
      { isActive: false },
    );
  }
}

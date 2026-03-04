import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { JwtPayload } from '../auth.service';
import { BanService } from '../services/ban.service';
import { CreateBanDto } from '../dto/create-ban.dto';

@Controller('admin/bans')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'superadmin')
export class BanController {
  constructor(private readonly banService: BanService) {}

  @Get()
  async listBans(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.banService.listBans(
      parseInt(page || '1', 10),
      parseInt(limit || '20', 10),
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createBan(
    @Body() dto: CreateBanDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.banService.createBan({
      ipAddress: dto.ipAddress,
      userId: dto.userId,
      reason: dto.reason,
      bannedBy: user.sub,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    });
  }

  @Patch(':id/lift')
  @HttpCode(HttpStatus.OK)
  async liftBan(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.banService.liftBan(id, user.sub);
    return { message: 'Engel kaldırıldı' };
  }
}

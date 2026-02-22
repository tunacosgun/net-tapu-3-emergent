import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
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
import { SystemSettingService } from '../services/system-setting.service';
import { UpdateSystemSettingDto } from '../dto/update-system-setting.dto';
import { AuditInterceptor } from '../interceptors/audit.interceptor';

@Controller('admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@UseInterceptors(AuditInterceptor)
export class AdminSettingController {
  constructor(private readonly settingService: SystemSettingService) {}

  @Get()
  async findAll() {
    return this.settingService.findAll();
  }

  @Get(':key')
  async findByKey(@Param('key') key: string) {
    return this.settingService.findByKey(key);
  }

  @Put(':key')
  @HttpCode(HttpStatus.OK)
  async upsert(
    @Param('key') key: string,
    @Body() dto: UpdateSystemSettingDto,
    @CurrentUser() user: { sub: string },
  ) {
    return this.settingService.upsert(key, dto, user.sub);
  }

  @Delete(':key')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('key') key: string) {
    return this.settingService.remove(key);
  }
}

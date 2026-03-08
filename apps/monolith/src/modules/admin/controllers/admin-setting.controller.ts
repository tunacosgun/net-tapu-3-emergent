import {
  Controller,
  Get,
  Put,
  Patch,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { SystemSettingService } from '../services/system-setting.service';
import { UpdateSystemSettingDto } from '../dto/update-system-setting.dto';
import { AuditInterceptor } from '../interceptors/audit.interceptor';
import { ConfigService } from '@nestjs/config';

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');

// Ensure site upload directory exists
const siteDir = path.join(UPLOADS_DIR, 'site');
if (!fs.existsSync(siteDir)) {
  fs.mkdirSync(siteDir, { recursive: true });
}

@Controller('admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@UseInterceptors(AuditInterceptor)
export class AdminSettingController {
  private readonly uploadsBaseUrl: string;

  constructor(
    private readonly settingService: SystemSettingService,
    private readonly config: ConfigService,
  ) {
    this.uploadsBaseUrl = this.config.get<string>('UPLOADS_BASE_URL') || '/uploads';
  }

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

  /** PATCH /admin/settings — Bulk upsert settings { settings: { key: value, ... } } */
  @Patch()
  @HttpCode(HttpStatus.OK)
  async bulkUpsert(
    @Body() body: { settings: Record<string, string> },
    @CurrentUser() user: { sub: string },
  ) {
    const entries = Object.entries(body.settings || {});
    for (const [key, value] of entries) {
      await this.settingService.upsert(key, { value: value as any }, user.sub);
    }
    return { updated: entries.length };
  }

  /** POST /admin/settings/upload-logo — Upload logo/favicon image */
  @Post('upload-logo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: siteDir,
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname) || '.png';
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'];
        cb(null, allowed.includes(file.mimetype));
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadLogo(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      return { error: 'No file uploaded or invalid file type' };
    }
    const url = `${this.uploadsBaseUrl}/site/${file.filename}`;
    return { url, filename: file.filename, size: file.size };
  }

  @Delete(':key')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('key') key: string) {
    return this.settingService.remove(key);
  }
}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Page } from './entities/page.entity';
import { Faq } from './entities/faq.entity';
import { Reference } from './entities/reference.entity';
import { Media } from './entities/media.entity';
import { SystemSetting } from './entities/system-setting.entity';
import { AuditLog } from './entities/audit-log.entity';

import { PageService } from './services/page.service';
import { FaqService } from './services/faq.service';
import { ReferenceService } from './services/reference.service';
import { MediaService } from './services/media.service';
import { SystemSettingService } from './services/system-setting.service';
import { AuditLogService } from './services/audit-log.service';

import { AdminPageController } from './controllers/admin-page.controller';
import { AdminFaqController } from './controllers/admin-faq.controller';
import { AdminReferenceController } from './controllers/admin-reference.controller';
import { AdminMediaController } from './controllers/admin-media.controller';
import { AdminSettingController } from './controllers/admin-setting.controller';
import { AuditLogController } from './controllers/audit-log.controller';
import { PublicContentController } from './controllers/public-content.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Page,
      Faq,
      Reference,
      Media,
      SystemSetting,
      AuditLog,
    ]),
  ],
  controllers: [
    AdminPageController,
    AdminFaqController,
    AdminReferenceController,
    AdminMediaController,
    AdminSettingController,
    AuditLogController,
    PublicContentController,
  ],
  providers: [
    PageService,
    FaqService,
    ReferenceService,
    MediaService,
    SystemSettingService,
    AuditLogService,
  ],
  exports: [TypeOrmModule, AuditLogService],
})
export class AdminModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Page } from './entities/page.entity';
import { Faq } from './entities/faq.entity';
import { Reference } from './entities/reference.entity';
import { Media } from './entities/media.entity';
import { SystemSetting } from './entities/system-setting.entity';
import { AuditLog } from './entities/audit-log.entity';
import { Testimonial } from './entities/testimonial.entity';

import { PageService } from './services/page.service';
import { FaqService } from './services/faq.service';
import { ReferenceService } from './services/reference.service';
import { MediaService } from './services/media.service';
import { SystemSettingService } from './services/system-setting.service';
import { AuditLogService } from './services/audit-log.service';
import { AdminAnalyticsService } from './services/admin-analytics.service';
import { AdminBroadcastService } from './services/admin-broadcast.service';
import { TestimonialService } from './services/testimonial.service';

import { AdminPageController } from './controllers/admin-page.controller';
import { AdminFaqController } from './controllers/admin-faq.controller';
import { AdminReferenceController } from './controllers/admin-reference.controller';
import { AdminMediaController } from './controllers/admin-media.controller';
import { AdminSettingController } from './controllers/admin-setting.controller';
import { AuditLogController } from './controllers/audit-log.controller';
import { PublicContentController } from './controllers/public-content.controller';
import { AdminAnalyticsController } from './controllers/admin-analytics.controller';
import { AdminNotificationController } from './controllers/admin-notification.controller';
import { AdminTestimonialController, PublicTestimonialController } from './controllers/admin-testimonial.controller';
import { AdminDealerController } from './controllers/admin-dealer.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Page,
      Faq,
      Reference,
      Media,
      SystemSetting,
      AuditLog,
      Testimonial,
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
    AdminAnalyticsController,
    AdminNotificationController,
    AdminTestimonialController,
    PublicTestimonialController,
    AdminDealerController,
  ],
  providers: [
    PageService,
    FaqService,
    ReferenceService,
    MediaService,
    SystemSettingService,
    AuditLogService,
    AdminAnalyticsService,
    AdminBroadcastService,
    TestimonialService,
  ],
  exports: [TypeOrmModule, AuditLogService],
})
export class AdminModule {}

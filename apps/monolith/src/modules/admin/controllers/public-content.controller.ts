import { Controller, Get, Param } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PageService } from '../services/page.service';
import { FaqService } from '../services/faq.service';
import { ReferenceService } from '../services/reference.service';
import { SystemSettingService } from '../services/system-setting.service';

@Controller('content')
export class PublicContentController {
  constructor(
    private readonly pageService: PageService,
    private readonly faqService: FaqService,
    private readonly referenceService: ReferenceService,
    private readonly settingService: SystemSettingService,
    private readonly dataSource: DataSource,
  ) {}

  /** GET /content/stats — Public platform statistics for CMS pages */
  @Get('stats')
  async getPublicStats() {
    try {
      const [parcels, users, auctions, cities] = await Promise.all([
        this.dataSource.query(`SELECT COUNT(*) AS count FROM listings.parcels WHERE status = 'published'`),
        this.dataSource.query(`SELECT COUNT(*) AS count FROM auth.users`),
        this.dataSource.query(`SELECT COUNT(*) AS count FROM auctions.auctions WHERE status = 'completed'`),
        this.dataSource.query(`SELECT COUNT(DISTINCT city) AS count FROM listings.parcels WHERE status = 'published'`),
      ]);
      return {
        totalParcels: parseInt(parcels[0]?.count || '0'),
        totalUsers: parseInt(users[0]?.count || '0'),
        completedAuctions: parseInt(auctions[0]?.count || '0'),
        activeCities: parseInt(cities[0]?.count || '0'),
      };
    } catch {
      return { totalParcels: 0, totalUsers: 0, completedAuctions: 0, activeCities: 0 };
    }
  }

  /** GET /content/site-settings — Public site settings (logo, contact, social, etc.) */
  @Get('site-settings')
  async getSiteSettings() {
    try {
      const all = await this.settingService.findAll();
      const map: Record<string, string> = {};
      for (const s of all) {
        // value is stored as JSONB, could be string or object
        map[s.key] = typeof s.value === 'string' ? s.value : JSON.stringify(s.value);
      }
      return map;
    } catch {
      return {};
    }
  }

  @Get('pages')
  async listPublishedPages() {
    return this.pageService.findAll({ status: 'published', sortBy: 'sortOrder', sortOrder: 'ASC' });
  }

  @Get('pages/:slug')
  async getPageBySlug(@Param('slug') slug: string) {
    return this.pageService.findBySlug(slug);
  }

  @Get('faq')
  async listPublishedFaq() {
    return this.faqService.findPublished();
  }

  @Get('references')
  async listPublishedReferences() {
    return this.referenceService.findPublished();
  }
}

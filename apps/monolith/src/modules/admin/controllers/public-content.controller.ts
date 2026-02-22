import { Controller, Get, Param } from '@nestjs/common';
import { PageService } from '../services/page.service';
import { FaqService } from '../services/faq.service';
import { ReferenceService } from '../services/reference.service';

@Controller('content')
export class PublicContentController {
  constructor(
    private readonly pageService: PageService,
    private readonly faqService: FaqService,
    private readonly referenceService: ReferenceService,
  ) {}

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

import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Page } from '../entities/page.entity';
import { CreatePageDto } from '../dto/create-page.dto';
import { UpdatePageDto } from '../dto/update-page.dto';
import { ListPagesQueryDto } from '../dto/list-pages-query.dto';

@Injectable()
export class PageService {
  private readonly logger = new Logger(PageService.name);

  constructor(
    @InjectRepository(Page)
    private readonly pageRepo: Repository<Page>,
  ) {}

  async create(dto: CreatePageDto, userId: string): Promise<Page> {
    const existing = await this.pageRepo.findOne({ where: { slug: dto.slug } });
    if (existing) {
      throw new ConflictException(`Page with slug "${dto.slug}" already exists`);
    }

    const page = this.pageRepo.create({
      pageType: dto.pageType,
      slug: dto.slug,
      title: dto.title,
      content: dto.content ?? null,
      metaTitle: dto.metaTitle ?? null,
      metaDescription: dto.metaDescription ?? null,
      sortOrder: dto.sortOrder ?? 0,
      status: 'draft',
      createdBy: userId,
    });

    const saved = await this.pageRepo.save(page);
    this.logger.log(`Page created: ${saved.id} (${saved.slug}) by ${userId}`);
    return saved;
  }

  async findAll(
    query: ListPagesQueryDto,
  ): Promise<{ data: Page[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.pageRepo.createQueryBuilder('p');

    if (query.status) {
      qb.andWhere('p.status = :status', { status: query.status });
    }
    if (query.pageType) {
      qb.andWhere('p.page_type = :pageType', { pageType: query.pageType });
    }
    if (query.search) {
      qb.andWhere('(p.title ILIKE :search OR p.slug ILIKE :search)', { search: `%${query.search}%` });
    }

    const sortColumn = {
      sortOrder: 'p.sort_order',
      createdAt: 'p.created_at',
      publishedAt: 'p.published_at',
      title: 'p.title',
    }[query.sortBy ?? 'sortOrder'] ?? 'p.sort_order';

    const sortDir = query.sortOrder === 'DESC' ? 'DESC' : 'ASC';
    qb.orderBy(sortColumn, sortDir).skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string): Promise<Page> {
    const page = await this.pageRepo.findOne({ where: { id } });
    if (!page) throw new NotFoundException(`Page ${id} not found`);
    return page;
  }

  async findBySlug(slug: string): Promise<Page> {
    const page = await this.pageRepo.findOne({ where: { slug, status: 'published' } });
    if (!page) throw new NotFoundException(`Page "${slug}" not found`);
    return page;
  }

  async update(id: string, dto: UpdatePageDto, userId: string): Promise<Page> {
    const page = await this.findById(id);

    if (dto.title !== undefined) page.title = dto.title;
    if (dto.content !== undefined) page.content = dto.content;
    if (dto.metaTitle !== undefined) page.metaTitle = dto.metaTitle;
    if (dto.metaDescription !== undefined) page.metaDescription = dto.metaDescription;
    if (dto.sortOrder !== undefined) page.sortOrder = dto.sortOrder;
    if (dto.status !== undefined) {
      if (dto.status === 'published' && page.status !== 'published') {
        page.publishedAt = new Date();
      }
      page.status = dto.status;
    }

    const saved = await this.pageRepo.save(page);
    this.logger.log(`Page ${id} updated by ${userId}`);
    return saved;
  }

  async remove(id: string): Promise<void> {
    const page = await this.findById(id);
    await this.pageRepo.remove(page);
    this.logger.log(`Page ${id} deleted`);
  }
}

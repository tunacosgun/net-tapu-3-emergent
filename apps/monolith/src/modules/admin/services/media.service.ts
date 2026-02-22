import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Media } from '../entities/media.entity';
import { UploadMediaDto } from '../dto/upload-media.dto';
import { ListMediaQueryDto } from '../dto/list-media-query.dto';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    @InjectRepository(Media)
    private readonly mediaRepo: Repository<Media>,
  ) {}

  async create(dto: UploadMediaDto, userId: string): Promise<Media> {
    const media = this.mediaRepo.create({
      title: dto.title ?? null,
      description: dto.description ?? null,
      fileUrl: dto.fileUrl,
      thumbnailUrl: dto.thumbnailUrl ?? null,
      mediaType: dto.mediaType,
      mimeType: dto.mimeType ?? null,
      fileSizeBytes: dto.fileSizeBytes ?? null,
      isPopup: dto.isPopup ?? false,
      uploadedBy: userId,
    });

    const saved = await this.mediaRepo.save(media);
    this.logger.log(`Media created: ${saved.id} by ${userId}`);
    return saved;
  }

  async findAll(
    query: ListMediaQueryDto,
  ): Promise<{ data: Media[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.mediaRepo.createQueryBuilder('m');

    if (query.mediaType) {
      qb.andWhere('m.media_type = :mediaType', { mediaType: query.mediaType });
    }
    if (query.isPopup !== undefined) {
      qb.andWhere('m.is_popup = :isPopup', { isPopup: query.isPopup });
    }
    if (query.search) {
      qb.andWhere('(m.title ILIKE :search OR m.description ILIKE :search)', { search: `%${query.search}%` });
    }

    const sortColumn = {
      createdAt: 'm.created_at',
      title: 'm.title',
      fileSizeBytes: 'm.file_size_bytes',
    }[query.sortBy ?? 'createdAt'] ?? 'm.created_at';

    const sortDir = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(sortColumn, sortDir).skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string): Promise<Media> {
    const media = await this.mediaRepo.findOne({ where: { id } });
    if (!media) throw new NotFoundException(`Media ${id} not found`);
    return media;
  }

  async remove(id: string): Promise<void> {
    const media = await this.findById(id);
    await this.mediaRepo.remove(media);
    this.logger.log(`Media ${id} deleted`);
  }
}

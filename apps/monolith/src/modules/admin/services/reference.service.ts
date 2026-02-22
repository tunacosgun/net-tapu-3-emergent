import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reference } from '../entities/reference.entity';
import { CreateReferenceDto } from '../dto/create-reference.dto';
import { UpdateReferenceDto } from '../dto/update-reference.dto';

@Injectable()
export class ReferenceService {
  private readonly logger = new Logger(ReferenceService.name);

  constructor(
    @InjectRepository(Reference)
    private readonly refRepo: Repository<Reference>,
  ) {}

  async create(dto: CreateReferenceDto): Promise<Reference> {
    const ref = this.refRepo.create({
      title: dto.title,
      description: dto.description ?? null,
      imageUrl: dto.imageUrl ?? null,
      websiteUrl: dto.websiteUrl ?? null,
      referenceType: dto.referenceType,
      sortOrder: dto.sortOrder ?? 0,
      isPublished: dto.isPublished ?? false,
    });

    const saved = await this.refRepo.save(ref);
    this.logger.log(`Reference created: ${saved.id}`);
    return saved;
  }

  async findAll(): Promise<Reference[]> {
    return this.refRepo.find({ order: { sortOrder: 'ASC', createdAt: 'DESC' } });
  }

  async findPublished(): Promise<Reference[]> {
    return this.refRepo.find({
      where: { isPublished: true },
      order: { sortOrder: 'ASC' },
    });
  }

  async findById(id: string): Promise<Reference> {
    const ref = await this.refRepo.findOne({ where: { id } });
    if (!ref) throw new NotFoundException(`Reference ${id} not found`);
    return ref;
  }

  async update(id: string, dto: UpdateReferenceDto): Promise<Reference> {
    const ref = await this.findById(id);

    if (dto.title !== undefined) ref.title = dto.title;
    if (dto.description !== undefined) ref.description = dto.description;
    if (dto.imageUrl !== undefined) ref.imageUrl = dto.imageUrl;
    if (dto.websiteUrl !== undefined) ref.websiteUrl = dto.websiteUrl;
    if (dto.referenceType !== undefined) ref.referenceType = dto.referenceType;
    if (dto.sortOrder !== undefined) ref.sortOrder = dto.sortOrder;
    if (dto.isPublished !== undefined) ref.isPublished = dto.isPublished;

    const saved = await this.refRepo.save(ref);
    this.logger.log(`Reference ${id} updated`);
    return saved;
  }

  async remove(id: string): Promise<void> {
    const ref = await this.findById(id);
    await this.refRepo.remove(ref);
    this.logger.log(`Reference ${id} deleted`);
  }
}

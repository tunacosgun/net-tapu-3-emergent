import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavedSearch } from '../entities/saved-search.entity';
import { CreateSavedSearchDto } from '../dto/create-saved-search.dto';
import { UpdateSavedSearchDto } from '../dto/update-saved-search.dto';

@Injectable()
export class SavedSearchService {
  private readonly logger = new Logger(SavedSearchService.name);

  constructor(
    @InjectRepository(SavedSearch)
    private readonly repo: Repository<SavedSearch>,
  ) {}

  async create(dto: CreateSavedSearchDto, userId: string): Promise<SavedSearch> {
    const search = this.repo.create({
      userId,
      name: dto.name ?? null,
      filters: dto.filters,
      notifyOnMatch: dto.notifyOnMatch ?? true,
    });

    const saved = await this.repo.save(search);
    this.logger.log(`SavedSearch ${saved.id} created by user ${userId}`);
    return saved;
  }

  async listByUser(userId: string): Promise<SavedSearch[]> {
    return this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async update(id: string, dto: UpdateSavedSearchDto, userId: string): Promise<SavedSearch> {
    const search = await this.findOwnedByUser(id, userId);

    const updateData: Partial<SavedSearch> = {};
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined) {
        (updateData as Record<string, unknown>)[key] = value;
      }
    }

    Object.assign(search, updateData);
    const saved = await this.repo.save(search);
    this.logger.log(`SavedSearch ${id} updated by user ${userId}`);
    return saved;
  }

  async remove(id: string, userId: string): Promise<void> {
    const search = await this.findOwnedByUser(id, userId);
    await this.repo.remove(search);
    this.logger.log(`SavedSearch ${id} deleted by user ${userId}`);
  }

  private async findOwnedByUser(id: string, userId: string): Promise<SavedSearch> {
    const search = await this.repo.findOne({ where: { id } });
    if (!search) {
      throw new NotFoundException(`SavedSearch ${id} not found`);
    }
    if (search.userId !== userId) {
      throw new ForbiddenException('Cannot modify another user\'s saved search');
    }
    return search;
  }
}

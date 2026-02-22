import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SyncState } from '../entities/sync-state.entity';
import { ListSyncStateQueryDto } from '../dto/list-sync-state-query.dto';

@Injectable()
export class SyncStateService {
  private readonly logger = new Logger(SyncStateService.name);

  constructor(
    @InjectRepository(SyncState)
    private readonly syncRepo: Repository<SyncState>,
  ) {}

  async findAll(
    query: ListSyncStateQueryDto,
  ): Promise<{ data: SyncState[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.syncRepo.createQueryBuilder('s');

    if (query.provider) {
      qb.andWhere('s.provider = :provider', { provider: query.provider });
    }
    if (query.status) {
      qb.andWhere('s.status = :status', { status: query.status });
    }

    const sortDir = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy('s.updated_at', sortDir).skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string): Promise<SyncState> {
    const state = await this.syncRepo.findOne({ where: { id } });
    if (!state) throw new NotFoundException(`SyncState ${id} not found`);
    return state;
  }

  async markSyncing(id: string): Promise<SyncState> {
    const state = await this.findById(id);
    state.status = 'syncing';
    state.errorMessage = null;
    return this.syncRepo.save(state);
  }

  async markCompleted(id: string): Promise<SyncState> {
    const state = await this.findById(id);
    state.status = 'idle';
    state.lastSyncAt = new Date();
    state.errorMessage = null;
    const saved = await this.syncRepo.save(state);
    this.logger.log(`Sync completed for ${state.provider}/${state.resourceId}`);
    return saved;
  }

  async markFailed(id: string, errorMessage: string): Promise<SyncState> {
    const state = await this.findById(id);
    state.status = 'error';
    state.errorMessage = errorMessage;
    const saved = await this.syncRepo.save(state);
    this.logger.warn(`Sync failed for ${state.provider}/${state.resourceId}: ${errorMessage}`);
    return saved;
  }
}

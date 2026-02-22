import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExternalApiLog } from '../entities/external-api-log.entity';
import { ListExternalApiLogQueryDto } from '../dto/list-external-api-log-query.dto';

export interface ApiLogEntry {
  provider: string;
  endpoint: string;
  method: string;
  requestPayload?: Record<string, unknown> | null;
  responseStatus?: number | null;
  responsePayload?: Record<string, unknown> | null;
  durationMs?: number | null;
  errorMessage?: string | null;
}

@Injectable()
export class ExternalApiLogService {
  constructor(
    @InjectRepository(ExternalApiLog)
    private readonly logRepo: Repository<ExternalApiLog>,
  ) {}

  async record(entry: ApiLogEntry): Promise<ExternalApiLog> {
    const log = this.logRepo.create({
      provider: entry.provider,
      endpoint: entry.endpoint,
      method: entry.method,
      requestPayload: entry.requestPayload ?? null,
      responseStatus: entry.responseStatus ?? null,
      responsePayload: entry.responsePayload ?? null,
      durationMs: entry.durationMs ?? null,
      errorMessage: entry.errorMessage ?? null,
    });
    return this.logRepo.save(log);
  }

  async findAll(
    query: ListExternalApiLogQueryDto,
  ): Promise<{ data: ExternalApiLog[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.logRepo.createQueryBuilder('l');

    if (query.provider) {
      qb.andWhere('l.provider = :provider', { provider: query.provider });
    }
    if (query.endpoint) {
      qb.andWhere('l.endpoint ILIKE :endpoint', { endpoint: `%${query.endpoint}%` });
    }
    if (query.from) {
      qb.andWhere('l.created_at >= :from', { from: query.from });
    }
    if (query.to) {
      qb.andWhere('l.created_at <= :to', { to: query.to });
    }

    const sortDir = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy('l.created_at', sortDir).skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}

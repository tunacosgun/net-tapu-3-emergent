import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { ListAuditLogQueryDto } from '../dto/list-audit-log-query.dto';

export interface AuditEntry {
  actorId: string | null;
  actorRole: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async record(entry: AuditEntry): Promise<AuditLog> {
    const log = this.auditRepo.create({
      actorId: entry.actorId,
      actorRole: entry.actorRole,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      oldValue: entry.oldValue ?? null,
      newValue: entry.newValue ?? null,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
    });
    const saved = await this.auditRepo.save(log);
    this.logger.debug(`Audit: ${entry.action} on ${entry.resourceType}/${entry.resourceId} by ${entry.actorId}`);
    return saved;
  }

  async findAll(
    query: ListAuditLogQueryDto,
  ): Promise<{ data: AuditLog[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.auditRepo.createQueryBuilder('al');

    if (query.actorId) {
      qb.andWhere('al.actor_id = :actorId', { actorId: query.actorId });
    }
    if (query.action) {
      qb.andWhere('al.action = :action', { action: query.action });
    }
    if (query.resourceType) {
      qb.andWhere('al.resource_type = :resourceType', { resourceType: query.resourceType });
    }
    if (query.resourceId) {
      qb.andWhere('al.resource_id = :resourceId', { resourceId: query.resourceId });
    }
    if (query.from) {
      qb.andWhere('al.created_at >= :from', { from: query.from });
    }
    if (query.to) {
      qb.andWhere('al.created_at <= :to', { to: query.to });
    }

    const sortDir = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy('al.created_at', sortDir).skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}

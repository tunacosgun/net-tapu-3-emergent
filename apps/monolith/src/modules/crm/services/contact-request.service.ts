import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContactRequest } from '../entities/contact-request.entity';
import { CreateContactRequestDto } from '../dto/create-contact-request.dto';
import { UpdateContactRequestDto } from '../dto/update-contact-request.dto';
import { ListContactRequestsQueryDto } from '../dto/list-contact-requests-query.dto';

@Injectable()
export class ContactRequestService {
  private readonly logger = new Logger(ContactRequestService.name);

  constructor(
    @InjectRepository(ContactRequest)
    private readonly repo: Repository<ContactRequest>,
  ) {}

  async create(dto: CreateContactRequestDto, userId?: string, ipAddress?: string): Promise<ContactRequest> {
    const entity = this.repo.create({
      type: dto.type,
      name: dto.name,
      phone: dto.phone,
      email: dto.email ?? null,
      message: dto.message ?? null,
      parcelId: dto.parcelId ?? null,
      userId: userId ?? null,
      ipAddress: ipAddress ?? null,
      status: 'new',
    });

    const saved = await this.repo.save(entity);
    this.logger.log(`ContactRequest created: ${saved.id} type=${saved.type}`);
    return saved;
  }

  async findAll(
    query: ListContactRequestsQueryDto,
  ): Promise<{ data: ContactRequest[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.repo.createQueryBuilder('cr');

    if (query.status) {
      qb.andWhere('cr.status = :status', { status: query.status });
    }
    if (query.type) {
      qb.andWhere('cr.type = :type', { type: query.type });
    }
    if (query.assigned_to) {
      qb.andWhere('cr.assigned_to = :assignedTo', { assignedTo: query.assigned_to });
    }

    qb.orderBy('cr.created_at', 'DESC').skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string): Promise<ContactRequest> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`ContactRequest ${id} not found`);
    }
    return entity;
  }

  async update(id: string, dto: UpdateContactRequestDto, userId: string): Promise<ContactRequest> {
    const entity = await this.findById(id);

    if (dto.status !== undefined) entity.status = dto.status;
    if (dto.assignedTo !== undefined) entity.assignedTo = dto.assignedTo;

    const saved = await this.repo.save(entity);
    this.logger.log(`ContactRequest ${id} updated by ${userId}`);
    return saved;
  }
}

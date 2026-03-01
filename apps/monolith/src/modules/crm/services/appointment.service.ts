import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment } from '../entities/appointment.entity';
import { CreateAppointmentDto } from '../dto/create-appointment.dto';
import { UpdateAppointmentDto } from '../dto/update-appointment.dto';
import { ListAppointmentsQueryDto } from '../dto/list-appointments-query.dto';

@Injectable()
export class AppointmentService {
  private readonly logger = new Logger(AppointmentService.name);

  constructor(
    @InjectRepository(Appointment)
    private readonly repo: Repository<Appointment>,
  ) {}

  async create(dto: CreateAppointmentDto, createdBy: string): Promise<Appointment> {
    const entity = this.repo.create({
      userId: dto.userId ?? null,
      parcelId: dto.parcelId ?? null,
      consultantId: dto.consultantId ?? null,
      contactRequestId: dto.contactRequestId ?? null,
      scheduledAt: new Date(dto.scheduledAt),
      durationMinutes: dto.durationMinutes ?? 30,
      location: dto.location ?? null,
      notes: dto.notes ?? null,
      status: 'scheduled',
    });

    const saved = await this.repo.save(entity);
    this.logger.log(`Appointment created: ${saved.id} by ${createdBy}`);
    return saved;
  }

  async findAll(
    query: ListAppointmentsQueryDto,
  ): Promise<{ data: Appointment[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.repo.createQueryBuilder('a');

    if (query.status) {
      qb.andWhere('a.status = :status', { status: query.status });
    }
    if (query.consultant_id) {
      qb.andWhere('a.consultant_id = :consultantId', { consultantId: query.consultant_id });
    }

    qb.orderBy('a.scheduled_at', 'ASC').skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string): Promise<Appointment> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`Appointment ${id} not found`);
    }
    return entity;
  }

  async update(id: string, dto: UpdateAppointmentDto, userId: string): Promise<Appointment> {
    const entity = await this.findById(id);

    if (dto.status !== undefined) entity.status = dto.status;
    if (dto.scheduledAt !== undefined) entity.scheduledAt = new Date(dto.scheduledAt);
    if (dto.durationMinutes !== undefined) entity.durationMinutes = dto.durationMinutes;
    if (dto.location !== undefined) entity.location = dto.location;
    if (dto.notes !== undefined) entity.notes = dto.notes;

    const saved = await this.repo.save(entity);
    this.logger.log(`Appointment ${id} updated by ${userId}`);
    return saved;
  }
}

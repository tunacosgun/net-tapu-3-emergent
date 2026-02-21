import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Parcel } from '../entities/parcel.entity';
import { ParcelStatusHistory } from '../entities/parcel-status-history.entity';
import { ParcelStatus } from '@nettapu/shared';
import { CreateParcelDto } from '../dto/create-parcel.dto';
import { UpdateParcelDto } from '../dto/update-parcel.dto';
import { UpdateParcelStatusDto } from '../dto/update-parcel-status.dto';
import { ListParcelsQueryDto } from '../dto/list-parcels-query.dto';

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  [ParcelStatus.DRAFT]: [ParcelStatus.ACTIVE],
  [ParcelStatus.ACTIVE]: [ParcelStatus.DEPOSIT_TAKEN, ParcelStatus.WITHDRAWN],
  [ParcelStatus.DEPOSIT_TAKEN]: [ParcelStatus.SOLD, ParcelStatus.ACTIVE, ParcelStatus.WITHDRAWN],
  [ParcelStatus.WITHDRAWN]: [ParcelStatus.ACTIVE],
};

@Injectable()
export class ParcelService {
  private readonly logger = new Logger(ParcelService.name);

  constructor(
    @InjectRepository(Parcel)
    private readonly parcelRepo: Repository<Parcel>,
    @InjectRepository(ParcelStatusHistory)
    private readonly historyRepo: Repository<ParcelStatusHistory>,
    private readonly dataSource: DataSource,
  ) {}

  private async nextListingId(): Promise<string> {
    const [{ nextval }] = await this.dataSource.query<{ nextval: string }[]>(
      `SELECT nextval('listings.listing_id_seq')`,
    );
    return `NT-${nextval.padStart(6, '0')}`;
  }

  async create(dto: CreateParcelDto, userId: string): Promise<Parcel> {
    const listingId = await this.nextListingId();

    const parcel = this.parcelRepo.create({
      listingId,
      title: dto.title,
      description: dto.description ?? null,
      status: ParcelStatus.DRAFT,
      city: dto.city,
      district: dto.district,
      neighborhood: dto.neighborhood ?? null,
      address: dto.address ?? null,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      ada: dto.ada ?? null,
      parsel: dto.parsel ?? null,
      areaM2: dto.areaM2 ?? null,
      zoningStatus: dto.zoningStatus ?? null,
      landType: dto.landType ?? null,
      price: dto.price ?? null,
      currency: dto.currency ?? 'TRY',
      isAuctionEligible: dto.isAuctionEligible ?? false,
      isFeatured: dto.isFeatured ?? false,
      createdBy: userId,
    });

    const saved = await this.parcelRepo.save(parcel);
    this.logger.log(`Parcel created: ${saved.id} (${saved.listingId}) by user ${userId}`);
    return saved;
  }

  async findAll(
    query: ListParcelsQueryDto,
  ): Promise<{ data: Parcel[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.parcelRepo.createQueryBuilder('p');

    if (query.status) {
      qb.andWhere('p.status = :status', { status: query.status });
    }
    if (query.city) {
      qb.andWhere('p.city = :city', { city: query.city });
    }
    if (query.district) {
      qb.andWhere('p.district = :district', { district: query.district });
    }
    if (query.minPrice) {
      qb.andWhere('p.price::numeric >= :minPrice', { minPrice: query.minPrice });
    }
    if (query.maxPrice) {
      qb.andWhere('p.price::numeric <= :maxPrice', { maxPrice: query.maxPrice });
    }
    if (query.minArea) {
      qb.andWhere('p.area_m2::numeric >= :minArea', { minArea: query.minArea });
    }
    if (query.maxArea) {
      qb.andWhere('p.area_m2::numeric <= :maxArea', { maxArea: query.maxArea });
    }
    if (query.isAuctionEligible !== undefined) {
      qb.andWhere('p.is_auction_eligible = :isAuctionEligible', {
        isAuctionEligible: query.isAuctionEligible,
      });
    }
    if (query.isFeatured !== undefined) {
      qb.andWhere('p.is_featured = :isFeatured', { isFeatured: query.isFeatured });
    }
    if (query.search) {
      qb.andWhere('(p.title ILIKE :search OR p.city ILIKE :search OR p.district ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    const sortColumn = {
      price: 'p.price',
      areaM2: 'p.area_m2',
      createdAt: 'p.created_at',
      listedAt: 'p.listed_at',
    }[query.sortBy ?? 'createdAt'] ?? 'p.created_at';

    const sortOrder = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(sortColumn, sortOrder).skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string): Promise<Parcel> {
    const parcel = await this.parcelRepo.findOne({ where: { id } });
    if (!parcel) {
      throw new NotFoundException(`Parcel ${id} not found`);
    }
    return parcel;
  }

  async update(id: string, dto: UpdateParcelDto, userId: string): Promise<Parcel> {
    const parcel = await this.findById(id);

    const updateData: Partial<Parcel> = {};
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined) {
        (updateData as Record<string, unknown>)[key] = value;
      }
    }

    Object.assign(parcel, updateData);
    const saved = await this.parcelRepo.save(parcel);
    this.logger.log(`Parcel ${id} updated by user ${userId}`);
    return saved;
  }

  async updateStatus(id: string, dto: UpdateParcelStatusDto, userId: string): Promise<Parcel> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const parcel = await qr.manager
        .createQueryBuilder(Parcel, 'p')
        .setLock('pessimistic_write')
        .where('p.id = :id', { id })
        .getOne();

      if (!parcel) {
        throw new NotFoundException(`Parcel ${id} not found`);
      }

      const allowed = ALLOWED_TRANSITIONS[parcel.status] ?? [];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(
          `Invalid status transition: ${parcel.status} -> ${dto.status}. Allowed: [${allowed.join(', ')}]`,
        );
      }

      const oldStatus = parcel.status;
      parcel.status = dto.status;

      if (dto.status === ParcelStatus.ACTIVE && !parcel.listedAt) {
        parcel.listedAt = new Date();
      }

      await qr.manager.save(Parcel, parcel);

      const history = qr.manager.create(ParcelStatusHistory, {
        parcelId: id,
        fromStatus: oldStatus,
        toStatus: dto.status,
        changedBy: userId,
        reason: dto.reason ?? null,
      });
      await qr.manager.save(ParcelStatusHistory, history);

      await qr.commitTransaction();
      this.logger.log(`Parcel ${id} status: ${oldStatus} -> ${dto.status} by user ${userId}`);
      return parcel;
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }
}

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Offer } from '../entities/offer.entity';
import { OfferResponse } from '../entities/offer-response.entity';
import { CreateOfferDto } from '../dto/create-offer.dto';
import { RespondToOfferDto } from '../dto/respond-to-offer.dto';
import { ListOffersQueryDto } from '../dto/list-offers-query.dto';

const RESPONSE_STATUS_MAP: Record<string, string> = {
  accept: 'accepted',
  reject: 'rejected',
  counter: 'countered',
};

@Injectable()
export class OfferService {
  private readonly logger = new Logger(OfferService.name);

  constructor(
    @InjectRepository(Offer)
    private readonly offerRepo: Repository<Offer>,
    @InjectRepository(OfferResponse)
    private readonly responseRepo: Repository<OfferResponse>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateOfferDto, userId: string): Promise<Offer> {
    const entity = this.offerRepo.create({
      userId,
      parcelId: dto.parcelId,
      amount: dto.amount,
      currency: dto.currency ?? 'TRY',
      message: dto.message ?? null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      status: 'pending',
    });

    const saved = await this.offerRepo.save(entity);
    this.logger.log(`Offer created: ${saved.id} by ${userId} for parcel ${saved.parcelId}`);
    return saved;
  }

  async findAll(
    query: ListOffersQueryDto,
  ): Promise<{ data: Offer[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.offerRepo.createQueryBuilder('o');

    if (query.status) {
      qb.andWhere('o.status = :status', { status: query.status });
    }
    if (query.parcel_id) {
      qb.andWhere('o.parcel_id = :parcelId', { parcelId: query.parcel_id });
    }
    if (query.user_id) {
      qb.andWhere('o.user_id = :userId', { userId: query.user_id });
    }

    qb.orderBy('o.created_at', 'DESC').skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string): Promise<Offer> {
    const entity = await this.offerRepo.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`Offer ${id} not found`);
    }
    return entity;
  }

  async respond(id: string, dto: RespondToOfferDto, respondedBy: string): Promise<OfferResponse> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const offer = await qr.manager
        .createQueryBuilder(Offer, 'o')
        .setLock('pessimistic_write')
        .where('o.id = :id', { id })
        .getOne();

      if (!offer) {
        throw new NotFoundException(`Offer ${id} not found`);
      }

      if (offer.status !== 'pending') {
        throw new BadRequestException(`Offer ${id} is not pending (current: ${offer.status})`);
      }

      const newStatus = RESPONSE_STATUS_MAP[dto.responseType];
      if (!newStatus) {
        throw new BadRequestException(`Invalid response type: ${dto.responseType}`);
      }

      offer.status = newStatus;
      await qr.manager.save(Offer, offer);

      const response = qr.manager.create(OfferResponse, {
        offerId: id,
        respondedBy,
        responseType: dto.responseType,
        counterAmount: dto.counterAmount ?? null,
        message: dto.message ?? null,
      });
      await qr.manager.save(OfferResponse, response);

      await qr.commitTransaction();
      this.logger.log(`Offer ${id} responded: ${dto.responseType} by ${respondedBy}`);
      return response;
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  async withdraw(id: string, userId: string): Promise<Offer> {
    const offer = await this.findById(id);

    if (offer.userId !== userId) {
      throw new BadRequestException('Only the offer creator can withdraw');
    }
    if (offer.status !== 'pending') {
      throw new BadRequestException(`Cannot withdraw offer in status: ${offer.status}`);
    }

    offer.status = 'withdrawn';
    const saved = await this.offerRepo.save(offer);
    this.logger.log(`Offer ${id} withdrawn by ${userId}`);
    return saved;
  }
}

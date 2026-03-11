import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Deposit } from '@nettapu/shared';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@Controller('admin/finance/deposits')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminDepositController {
  constructor(
    @InjectRepository(Deposit)
    private readonly depositRepo: Repository<Deposit>,
  ) {}

  @Get()
  async list(
    @Query('limit') limit = '20',
    @Query('offset') offset = '0',
    @Query('status') status?: string,
    @Query('auction_id') auctionId?: string,
  ) {
    const take = Math.min(Number(limit) || 20, 100);
    const skip = Number(offset) || 0;

    const qb = this.depositRepo
      .createQueryBuilder('d')
      .orderBy('d.created_at', 'DESC')
      .take(take)
      .skip(skip);

    if (status) {
      qb.andWhere('d.status = :status', { status });
    }
    if (auctionId) {
      qb.andWhere('d.auction_id = :auctionId', { auctionId });
    }

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: { total, limit: take, offset: skip },
    };
  }
}

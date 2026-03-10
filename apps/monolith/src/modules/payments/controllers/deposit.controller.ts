import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Deposit } from '@nettapu/shared';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@Controller('deposits')
@UseGuards(JwtAuthGuard)
export class DepositController {
  constructor(
    @InjectRepository(Deposit)
    private readonly depositRepo: Repository<Deposit>,
  ) {}

  @Get()
  async listMine(@CurrentUser() user: { sub: string }) {
    return this.depositRepo.find({
      where: { userId: user.sub },
      order: { createdAt: 'DESC' },
    });
  }
}

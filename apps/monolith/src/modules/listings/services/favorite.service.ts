import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorite } from '../entities/favorite.entity';
import { ParcelService } from './parcel.service';

@Injectable()
export class FavoriteService {
  private readonly logger = new Logger(FavoriteService.name);

  constructor(
    @InjectRepository(Favorite)
    private readonly favoriteRepo: Repository<Favorite>,
    private readonly parcelService: ParcelService,
  ) {}

  async add(parcelId: string, userId: string): Promise<Favorite> {
    await this.parcelService.findById(parcelId);

    const existing = await this.favoriteRepo.findOne({ where: { userId, parcelId } });
    if (existing) {
      throw new ConflictException('Parcel is already in favorites');
    }

    const fav = this.favoriteRepo.create({ userId, parcelId });
    const saved = await this.favoriteRepo.save(fav);
    this.logger.log(`User ${userId} favorited parcel ${parcelId}`);
    return saved;
  }

  async listByUser(userId: string): Promise<Favorite[]> {
    return this.favoriteRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async remove(parcelId: string, userId: string): Promise<void> {
    const result = await this.favoriteRepo.delete({ userId, parcelId });
    if (result.affected === 0) {
      this.logger.warn(`Favorite not found: user ${userId}, parcel ${parcelId}`);
    } else {
      this.logger.log(`User ${userId} unfavorited parcel ${parcelId}`);
    }
  }
}

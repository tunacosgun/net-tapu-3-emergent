import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorite } from '../entities/favorite.entity';
import { ParcelImage } from '../entities/parcel-image.entity';
import { ParcelService } from './parcel.service';

@Injectable()
export class FavoriteService {
  private readonly logger = new Logger(FavoriteService.name);

  constructor(
    @InjectRepository(Favorite)
    private readonly favoriteRepo: Repository<Favorite>,
    @InjectRepository(ParcelImage)
    private readonly imageRepo: Repository<ParcelImage>,
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
    const favorites = await this.favoriteRepo.find({
      where: { userId },
      relations: ['parcel'],
      order: { createdAt: 'DESC' },
    });

    // Attach images to each parcel (images is not a TypeORM relation)
    const parcelIds = favorites
      .filter((f) => f.parcel)
      .map((f) => f.parcel!.id);

    if (parcelIds.length > 0) {
      const allImages = await this.imageRepo
        .createQueryBuilder('img')
        .where('img.parcel_id IN (:...ids)', { ids: parcelIds })
        .orderBy('img.sort_order', 'ASC')
        .getMany();

      const imageMap = new Map<string, ParcelImage[]>();
      for (const img of allImages) {
        const arr = imageMap.get(img.parcelId) || [];
        arr.push(img);
        imageMap.set(img.parcelId, arr);
      }

      for (const fav of favorites) {
        if (fav.parcel) {
          fav.parcel.images = imageMap.get(fav.parcel.id) || [];
        }
      }
    }

    return favorites;
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

import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { Parcel } from '../entities/parcel.entity';
import { PriceChangeLog } from '../entities/price-change-log.entity';
import {
  PricingStrategy,
  PricingContext,
  PricingResult,
  PRICING_STRATEGY,
} from '../pricing/pricing-strategy.interface';

export interface BulkPriceUpdateResult {
  updated: number;
  skipped: number;
  changes: Array<{
    parcelId: string;
    listingId: string;
    oldPrice: number;
    newPrice: number;
    changePercent: number;
  }>;
}

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);

  constructor(
    @InjectRepository(Parcel)
    private readonly parcelRepo: Repository<Parcel>,
    @InjectRepository(PriceChangeLog)
    private readonly priceChangeLogRepo: Repository<PriceChangeLog>,
    @Inject(PRICING_STRATEGY)
    private readonly strategy: PricingStrategy,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Apply pricing strategy to a single parcel.
   */
  async applyToParcel(
    parcelId: string,
    params: Record<string, unknown>,
    changedBy: string,
  ): Promise<PricingResult & { parcelId: string }> {
    const parcel = await this.parcelRepo.findOne({ where: { id: parcelId } });
    if (!parcel || !parcel.price) {
      throw new Error(`Parcel ${parcelId} not found or has no price`);
    }

    const context: PricingContext = {
      parcelId: parcel.id,
      currentPrice: parseFloat(parcel.price),
      areaM2: parcel.areaM2 ? parseFloat(parcel.areaM2) : undefined,
      city: parcel.city,
      district: parcel.district,
      landType: parcel.landType ?? undefined,
      zoningStatus: parcel.zoningStatus ?? undefined,
    };

    const result = this.strategy.calculate(context, params);

    // Update parcel price
    const newPriceStr = result.newPrice.toFixed(2);
    await this.parcelRepo.update(parcelId, { price: newPriceStr });

    // Log the change
    await this.priceChangeLogRepo.save(
      this.priceChangeLogRepo.create({
        parcelId,
        oldPrice: parcel.price,
        newPrice: newPriceStr,
        changeType: result.appliedStrategy,
        changePercent: result.changePercent.toFixed(4),
        changedBy,
        metadata: { params, ...result.metadata },
      }),
    );

    return { ...result, parcelId };
  }

  /**
   * Bulk apply pricing strategy to multiple parcels by IDs.
   * Wrapped in a single transaction with pessimistic_write locks
   * to prevent concurrent race conditions.
   * Idempotency: skips parcels where the computed price equals the current price.
   */
  async applyToMany(
    parcelIds: string[],
    params: Record<string, unknown>,
    changedBy: string,
  ): Promise<BulkPriceUpdateResult> {
    return this.dataSource.transaction(async (manager) => {
      // Lock all target parcels with FOR UPDATE to prevent concurrent modifications
      const parcels = await manager
        .getRepository(Parcel)
        .createQueryBuilder('p')
        .setLock('pessimistic_write')
        .where('p.id IN (:...ids)', { ids: parcelIds })
        .getMany();

      const result: BulkPriceUpdateResult = {
        updated: 0,
        skipped: 0,
        changes: [],
      };

      for (const parcel of parcels) {
        if (!parcel.price) {
          result.skipped++;
          continue;
        }

        const context: PricingContext = {
          parcelId: parcel.id,
          currentPrice: parseFloat(parcel.price),
          areaM2: parcel.areaM2 ? parseFloat(parcel.areaM2) : undefined,
          city: parcel.city,
          district: parcel.district,
          landType: parcel.landType ?? undefined,
          zoningStatus: parcel.zoningStatus ?? undefined,
        };

        const calcResult = this.strategy.calculate(context, params);
        const newPriceStr = calcResult.newPrice.toFixed(2);

        // Idempotency: skip if price is unchanged
        if (newPriceStr === parseFloat(parcel.price).toFixed(2)) {
          result.skipped++;
          continue;
        }

        await manager.getRepository(Parcel).update(parcel.id, { price: newPriceStr });

        await manager.getRepository(PriceChangeLog).save(
          manager.getRepository(PriceChangeLog).create({
            parcelId: parcel.id,
            oldPrice: parcel.price,
            newPrice: newPriceStr,
            changeType: calcResult.appliedStrategy,
            changePercent: calcResult.changePercent.toFixed(4),
            changedBy,
            metadata: { params, ...calcResult.metadata },
          }),
        );

        result.updated++;
        result.changes.push({
          parcelId: parcel.id,
          listingId: parcel.listingId,
          oldPrice: parseFloat(parcel.price),
          newPrice: calcResult.newPrice,
          changePercent: calcResult.changePercent,
        });
      }

      this.logger.log(
        `Bulk pricing: ${result.updated} updated, ${result.skipped} skipped by ${changedBy}`,
      );

      return result;
    });
  }

  /**
   * Bulk apply by region filter (city/district).
   */
  async applyToRegion(
    filters: { city?: string; district?: string; status?: string },
    params: Record<string, unknown>,
    changedBy: string,
  ): Promise<BulkPriceUpdateResult> {
    const where: Record<string, unknown> = {};
    if (filters.city) where.city = filters.city;
    if (filters.district) where.district = filters.district;
    if (filters.status) where.status = filters.status;

    const parcels = await this.parcelRepo.find({ where });
    const ids = parcels.map((p) => p.id);

    return this.applyToMany(ids, params, changedBy);
  }

  /**
   * Get price history for a parcel.
   */
  async getHistory(
    parcelId: string,
    limit = 50,
  ): Promise<PriceChangeLog[]> {
    return this.priceChangeLogRepo.find({
      where: { parcelId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { TkgmCache } from '../entities/tkgm-cache.entity';
import { ExternalApiLogService } from './external-api-log.service';
import { TkgmLookupDto } from '../dto/tkgm-lookup.dto';

@Injectable()
export class TkgmService {
  private readonly logger = new Logger(TkgmService.name);
  private static readonly CACHE_TTL_HOURS = 24;

  constructor(
    @InjectRepository(TkgmCache)
    private readonly cacheRepo: Repository<TkgmCache>,
    private readonly apiLogService: ExternalApiLogService,
  ) {}

  async lookup(dto: TkgmLookupDto): Promise<TkgmCache> {
    const cached = await this.cacheRepo.findOne({
      where: {
        city: dto.city,
        district: dto.district,
        ada: dto.ada,
        parsel: dto.parsel,
        expiresAt: MoreThan(new Date()),
      },
    });

    if (cached) {
      this.logger.debug(`TKGM cache hit: ${dto.city}/${dto.district} ${dto.ada}/${dto.parsel}`);
      return cached;
    }

    return this.fetchAndCache(dto);
  }

  private async fetchAndCache(dto: TkgmLookupDto): Promise<TkgmCache> {
    const startMs = Date.now();

    // External TKGM API call placeholder — replace with real HTTP call when API is available
    const responseData: Record<string, unknown> = {
      source: 'tkgm_mock',
      ada: dto.ada,
      parsel: dto.parsel,
      city: dto.city,
      district: dto.district,
      fetchedAt: new Date().toISOString(),
    };
    const durationMs = Date.now() - startMs;

    await this.apiLogService.record({
      provider: 'tkgm',
      endpoint: `/api/parcel/${dto.city}/${dto.district}/${dto.ada}/${dto.parsel}`,
      method: 'GET',
      requestPayload: dto as unknown as Record<string, unknown>,
      responseStatus: 200,
      responsePayload: responseData,
      durationMs,
    });

    const now = new Date();
    const expiresAt = new Date(now.getTime() + TkgmService.CACHE_TTL_HOURS * 60 * 60 * 1000);

    const entry = this.cacheRepo.create({
      ada: dto.ada,
      parsel: dto.parsel,
      city: dto.city,
      district: dto.district,
      responseData,
      fetchedAt: now,
      expiresAt,
    });

    const saved = await this.cacheRepo.save(entry);
    this.logger.log(`TKGM fetched & cached: ${dto.city}/${dto.district} ${dto.ada}/${dto.parsel}`);
    return saved;
  }

  async invalidateCache(city: string, district: string, ada: string, parsel: string): Promise<number> {
    const result = await this.cacheRepo.delete({ city, district, ada, parsel });
    return result.affected ?? 0;
  }
}

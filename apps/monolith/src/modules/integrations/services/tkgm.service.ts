import { Injectable, Logger, BadGatewayException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { TkgmCache } from '../entities/tkgm-cache.entity';
import { ExternalApiLogService } from './external-api-log.service';
import { TkgmLookupDto } from '../dto/tkgm-lookup.dto';

const TKGM_BASE = 'https://cbsapi.tkgm.gov.tr/megsiswebapi.v3.1/api';
const TKGM_TIMEOUT = 15_000;

interface TkgmIl { id: number; text: string }
interface TkgmIlce { id: number; text: string }
interface TkgmMahalle { id: number; text: string }
interface TkgmFeatureCollection<T> {
  type: string;
  features: Array<{ type: string; properties: T; geometry?: unknown }>;
}

@Injectable()
export class TkgmService {
  private readonly logger = new Logger(TkgmService.name);
  private static readonly CACHE_TTL_HOURS = 24;

  // In-memory code caches (rarely change)
  private ilListCache: TkgmIl[] = [];

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

  private async tkgmFetch<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TKGM_TIMEOUT);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json', 'User-Agent': 'NetTapu/1.0' },
      });
      if (!res.ok) throw new Error(`TKGM ${res.status} ${res.statusText}`);
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  private normalize(s: string): string {
    return s
      .toLocaleLowerCase('tr-TR')
      .replace(/İ/g, 'i').replace(/I/g, 'ı')
      .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u')
      .replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g')
      .trim();
  }

  private extractFeatures<T>(fc: TkgmFeatureCollection<T>): T[] {
    if (fc && Array.isArray(fc.features)) {
      return fc.features.map((f) => f.properties);
    }
    return [];
  }

  private async getIlKod(cityName: string): Promise<number> {
    if (this.ilListCache.length === 0) {
      const fc = await this.tkgmFetch<TkgmFeatureCollection<TkgmIl>>(`${TKGM_BASE}/idariYapi/ilListe`);
      this.ilListCache = this.extractFeatures(fc);
    }
    const norm = this.normalize(cityName);
    const il = this.ilListCache.find((i) => this.normalize(i.text) === norm);
    if (!il) throw new BadGatewayException(`TKGM: İl bulunamadı: ${cityName}`);
    return il.id;
  }

  private async getIlceKod(ilKod: number, districtName: string): Promise<number> {
    const fc = await this.tkgmFetch<TkgmFeatureCollection<TkgmIlce>>(`${TKGM_BASE}/idariYapi/ilceListe/${ilKod}`);
    const list = this.extractFeatures(fc);
    const norm = this.normalize(districtName);
    const ilce = list.find((i) => this.normalize(i.text) === norm);
    if (!ilce) throw new BadGatewayException(`TKGM: İlçe bulunamadı: ${districtName}`);
    return ilce.id;
  }

  private async getMahalleler(ilceKod: number): Promise<TkgmMahalle[]> {
    const fc = await this.tkgmFetch<TkgmFeatureCollection<TkgmMahalle>>(`${TKGM_BASE}/idariYapi/mahalleListe/${ilceKod}`);
    return this.extractFeatures(fc);
  }

  private async fetchAndCache(dto: TkgmLookupDto): Promise<TkgmCache> {
    const startMs = Date.now();
    let responseData: Record<string, unknown>;
    let httpStatus = 200;

    try {
      // 1. Resolve administrative codes
      const ilKod = await this.getIlKod(dto.city);
      const ilceKod = await this.getIlceKod(ilKod, dto.district);
      const mahalleler = await this.getMahalleler(ilceKod);

      // 2. Try each mahalle until parcel is found
      let parcelData: Record<string, unknown> | null = null;
      let foundMahalle = '';

      for (const mah of mahalleler) {
        try {
          // TKGM parsel endpoint: /parsel/{mahalleKod}/{ada}/{parsel}
          const url = `${TKGM_BASE}/parsel/${mah.id}/${dto.ada}/${dto.parsel}`;
          const data = await this.tkgmFetch<Record<string, unknown>>(url);
          // TKGM may return GeoJSON Feature or FeatureCollection
          let feature: Record<string, unknown> | null = null;
          if (data && (data as any).type === 'FeatureCollection' && Array.isArray((data as any).features) && (data as any).features.length > 0) {
            feature = (data as any).features[0];
          } else if (data && (data as any).type === 'Feature') {
            feature = data;
          } else if (data && typeof data === 'object' && Object.keys(data).length > 0) {
            feature = data;
          }
          if (feature) {
            parcelData = feature;
            foundMahalle = mah.text;
            break;
          }
        } catch {
          // This mahalle doesn't have this parcel, try next
          continue;
        }
      }

      if (!parcelData) {
        throw new BadGatewayException(
          `TKGM: Parsel bulunamadı — ${dto.city}/${dto.district} Ada:${dto.ada} Parsel:${dto.parsel}`,
        );
      }

      // 3. Extract useful data
      const geometry = parcelData.geometry as Record<string, unknown> | undefined;
      const properties = parcelData.properties as Record<string, unknown> | undefined;
      const alanRaw = properties?.alan ?? parcelData.alan;
      // Parse Turkish number format: "100.301,93" → 100301.93
      const alan = typeof alanRaw === 'string'
        ? Number(alanRaw.replace(/\./g, '').replace(',', '.'))
        : alanRaw;

      // Calculate centroid from coordinates if available
      let latitude: number | null = null;
      let longitude: number | null = null;
      let boundary: unknown = null;

      if (geometry && geometry.type === 'Polygon' && Array.isArray(geometry.coordinates)) {
        boundary = geometry;
        // Calculate centroid from first ring
        const ring = (geometry.coordinates as number[][][])[0];
        if (ring && ring.length > 0) {
          let sumLat = 0, sumLng = 0;
          for (const [lng, lat] of ring) {
            sumLng += lng;
            sumLat += lat;
          }
          longitude = sumLng / ring.length;
          latitude = sumLat / ring.length;
        }
      } else if (geometry && geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates)) {
        boundary = geometry;
        const ring = (geometry.coordinates as number[][][][])[0]?.[0];
        if (ring && ring.length > 0) {
          let sumLat = 0, sumLng = 0;
          for (const [lng, lat] of ring) {
            sumLng += lng;
            sumLat += lat;
          }
          longitude = sumLng / ring.length;
          latitude = sumLat / ring.length;
        }
      }

      responseData = {
        source: 'tkgm',
        ada: dto.ada,
        parsel: dto.parsel,
        city: dto.city,
        district: dto.district,
        neighborhood: foundMahalle,
        areaM2: alan ? Number(alan) : null,
        nitelik: properties?.nitelik ?? null,
        pafta: properties?.pafta ?? null,
        mevkii: properties?.mevkii ?? null,
        latitude,
        longitude,
        boundary,
        rawProperties: properties ?? {},
        fetchedAt: new Date().toISOString(),
      };
    } catch (err) {
      httpStatus = err instanceof BadGatewayException ? 404 : 502;
      const durationMs = Date.now() - startMs;

      await this.apiLogService.record({
        provider: 'tkgm',
        endpoint: `/api/parcel/${dto.city}/${dto.district}/${dto.ada}/${dto.parsel}`,
        method: 'GET',
        requestPayload: dto as unknown as Record<string, unknown>,
        responseStatus: httpStatus,
        responsePayload: { error: (err as Error).message },
        durationMs,
      });

      throw err;
    }

    const durationMs = Date.now() - startMs;

    await this.apiLogService.record({
      provider: 'tkgm',
      endpoint: `/api/parcel/${dto.city}/${dto.district}/${dto.ada}/${dto.parsel}`,
      method: 'GET',
      requestPayload: dto as unknown as Record<string, unknown>,
      responseStatus: httpStatus,
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
    this.logger.log(`TKGM fetched & cached: ${dto.city}/${dto.district} ${dto.ada}/${dto.parsel} (${durationMs}ms)`);
    return saved;
  }

  async invalidateCache(city: string, district: string, ada: string, parsel: string): Promise<number> {
    const result = await this.cacheRepo.delete({ city, district, ada, parsel });
    return result.affected ?? 0;
  }
}

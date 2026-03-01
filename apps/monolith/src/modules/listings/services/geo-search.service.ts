import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Parcel } from '../entities/parcel.entity';

export interface GeoSearchResult {
  id: string;
  listingId: string;
  title: string;
  status: string;
  city: string;
  district: string;
  latitude: string | null;
  longitude: string | null;
  price: string | null;
  areaM2: string | null;
  distanceMeters?: number;
}

@Injectable()
export class GeoSearchService {
  private readonly logger = new Logger(GeoSearchService.name);

  constructor(
    @InjectRepository(Parcel)
    private readonly parcelRepo: Repository<Parcel>,
  ) {}

  /**
   * Find parcels within a radius of a point.
   * Uses ST_DWithin on GEOGRAPHY type — distance in meters, uses GIST index.
   *
   * Expected EXPLAIN plan:
   * ┌─────────────────────────────────────────────────────────────────────┐
   * │ Bitmap Heap Scan on listings.parcels p                             │
   * │   Recheck Cond: ST_DWithin(location, $point, $radius)             │
   * │   Filter: (location IS NOT NULL) AND (status = 'active')          │
   * │   -> Bitmap Index Scan on idx_parcels_location_gist               │
   * │        Index Cond: (location && ST_Expand($point, $radius))       │
   * └─────────────────────────────────────────────────────────────────────┘
   * ST_DWithin internally expands the point into a bbox for the initial
   * GIST index filter, then refines with exact geodesic distance check.
   * For status='active', idx_parcels_active_location_gist (partial) is preferred.
   */
  async findWithinRadius(
    lat: number,
    lng: number,
    radiusMeters: number,
    options: { status?: string; limit?: number; offset?: number } = {},
  ): Promise<{ data: GeoSearchResult[]; total: number }> {
    const { status = 'active', offset = 0 } = options;
    const limit = Math.min(options.limit ?? 50, 100);
    const clampedRadius = Math.min(radiusMeters, 100_000); // Hard cap: 100km

    const baseWhere = `
      p.location IS NOT NULL
      AND ST_DWithin(
        p.location,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        $3
      )
    `;
    const statusFilter = status ? `AND p.status = $4` : '';
    const params: (string | number)[] = [lng, lat, clampedRadius];
    if (status) params.push(status);

    const countQuery = `
      SELECT COUNT(*) as total
      FROM listings.parcels p
      WHERE ${baseWhere} ${statusFilter}
    `;

    const dataQuery = `
      SELECT
        p.id, p.listing_id as "listingId", p.title, p.status,
        p.city, p.district, p.latitude, p.longitude,
        p.price, p.area_m2 as "areaM2",
        ST_Distance(
          p.location,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) as "distanceMeters"
      FROM listings.parcels p
      WHERE ${baseWhere} ${statusFilter}
      ORDER BY "distanceMeters" ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const dataParams = [...params, limit, offset];

    const [countResult, dataResult] = await Promise.all([
      this.parcelRepo.query(countQuery, params),
      this.parcelRepo.query(dataQuery, dataParams),
    ]);

    return {
      data: dataResult.map((r: Record<string, unknown>) => ({
        ...r,
        distanceMeters: parseFloat(r.distanceMeters as string),
      })),
      total: parseInt(countResult[0]?.total || '0', 10),
    };
  }

  /**
   * Find parcels within a bounding box (map viewport).
   * Uses ST_Intersects with ST_MakeEnvelope — GIST index scan.
   *
   * Expected EXPLAIN plan:
   * ┌─────────────────────────────────────────────────────────────────────┐
   * │ Bitmap Heap Scan on listings.parcels p                             │
   * │   Recheck Cond: (location::geometry && ST_MakeEnvelope(..., 4326)) │
   * │   Filter: (location IS NOT NULL) AND (status = 'active')          │
   * │   -> Bitmap Index Scan on idx_parcels_location_gist               │
   * │        Index Cond: (location::geometry && envelope)                │
   * └─────────────────────────────────────────────────────────────────────┘
   * ST_Intersects on geometry uses the && (bounding box overlap) operator
   * for index access, then refines with exact intersection check.
   */
  async findInBoundingBox(
    minLat: number,
    minLng: number,
    maxLat: number,
    maxLng: number,
    options: { status?: string; limit?: number; offset?: number } = {},
  ): Promise<{ data: GeoSearchResult[]; total: number }> {
    const { status = 'active', offset = 0 } = options;
    const limit = Math.min(options.limit ?? 100, 100);

    const baseWhere = `
      p.location IS NOT NULL
      AND ST_Intersects(
        p.location::geometry,
        ST_MakeEnvelope($1, $2, $3, $4, 4326)
      )
    `;
    const statusFilter = status ? `AND p.status = $5` : '';
    const params: (string | number)[] = [minLng, minLat, maxLng, maxLat];
    if (status) params.push(status);

    const countQuery = `
      SELECT COUNT(*) as total
      FROM listings.parcels p
      WHERE ${baseWhere} ${statusFilter}
    `;

    const dataQuery = `
      SELECT
        p.id, p.listing_id as "listingId", p.title, p.status,
        p.city, p.district, p.latitude, p.longitude,
        p.price, p.area_m2 as "areaM2"
      FROM listings.parcels p
      WHERE ${baseWhere} ${statusFilter}
      ORDER BY p.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const dataParams = [...params, limit, offset];

    const [countResult, dataResult] = await Promise.all([
      this.parcelRepo.query(countQuery, params),
      this.parcelRepo.query(dataQuery, dataParams),
    ]);

    return {
      data: dataResult,
      total: parseInt(countResult[0]?.total || '0', 10),
    };
  }

  /**
   * Find nearest parcels to a point, ordered by distance.
   * Uses the PostGIS <-> KNN operator for index-assisted nearest-neighbor sort.
   *
   * Expected EXPLAIN plan:
   * ┌─────────────────────────────────────────────────────────────────────┐
   * │ Limit (rows=N)                                                     │
   * │   -> Index Scan using idx_parcels_location_gist on parcels p       │
   * │        Order By: (location <-> $point)                             │
   * │        Filter: (location IS NOT NULL) AND (status = 'active')      │
   * └─────────────────────────────────────────────────────────────────────┘
   * The <-> operator triggers a KNN-GiST index scan that reads entries
   * in distance order directly from the index, avoiding a full sort.
   * When maxDistanceMeters is set, ST_DWithin adds an additional bbox
   * filter that still uses the GIST index (Bitmap Index Scan).
   */
  async findNearest(
    lat: number,
    lng: number,
    limit = 10,
    options: { status?: string; maxDistanceMeters?: number } = {},
  ): Promise<GeoSearchResult[]> {
    const { status = 'active' } = options;
    const clampedLimit = Math.min(limit, 50);
    const maxDistanceMeters = options.maxDistanceMeters
      ? Math.min(options.maxDistanceMeters, 50_000) // Hard cap: 50km
      : undefined;

    let where = `p.location IS NOT NULL`;
    const params: (string | number)[] = [lng, lat];
    let paramIdx = 3;

    if (status) {
      where += ` AND p.status = $${paramIdx}`;
      params.push(status);
      paramIdx++;
    }

    if (maxDistanceMeters) {
      where += ` AND ST_DWithin(p.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $${paramIdx})`;
      params.push(maxDistanceMeters);
      paramIdx++;
    }

    // Use <-> operator for KNN index scan (efficient nearest-neighbor)
    const query = `
      SELECT
        p.id, p.listing_id as "listingId", p.title, p.status,
        p.city, p.district, p.latitude, p.longitude,
        p.price, p.area_m2 as "areaM2",
        ST_Distance(
          p.location,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) as "distanceMeters"
      FROM listings.parcels p
      WHERE ${where}
      ORDER BY p.location <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
      LIMIT $${paramIdx}
    `;

    params.push(clampedLimit);

    const results = await this.parcelRepo.query(query, params);

    return results.map((r: Record<string, unknown>) => ({
      ...r,
      distanceMeters: parseFloat(r.distanceMeters as string),
    }));
  }

  /**
   * Sync the PostGIS location column from lat/lng.
   * Called after parcel creation or coordinate update.
   */
  async syncLocation(parcelId: string): Promise<void> {
    await this.parcelRepo.query(
      `UPDATE listings.parcels
       SET location = CASE
         WHEN latitude IS NOT NULL AND longitude IS NOT NULL
         THEN ST_SetSRID(ST_MakePoint(longitude::float8, latitude::float8), 4326)::geography
         ELSE NULL
       END
       WHERE id = $1`,
      [parcelId],
    );
  }

  /**
   * Set boundary polygon from GeoJSON.
   * Validates GeoJSON structure and rejects invalid geometries via ST_IsValid.
   */
  async setBoundary(parcelId: string, geojson: Record<string, unknown>): Promise<void> {
    // Validate GeoJSON structure
    if (!geojson || typeof geojson !== 'object') {
      throw new BadRequestException('GeoJSON must be an object');
    }
    if (geojson.type !== 'Polygon' && geojson.type !== 'MultiPolygon') {
      throw new BadRequestException(
        `GeoJSON type must be "Polygon" or "MultiPolygon", got "${geojson.type}"`,
      );
    }
    if (!Array.isArray(geojson.coordinates) || geojson.coordinates.length === 0) {
      throw new BadRequestException('GeoJSON coordinates must be a non-empty array');
    }

    // Validate ring closure for Polygon type
    if (geojson.type === 'Polygon') {
      const ring = (geojson.coordinates as number[][][])[0];
      if (!Array.isArray(ring) || ring.length < 4) {
        throw new BadRequestException('Polygon ring must have at least 4 coordinate pairs (closed ring)');
      }
    }

    // Use ST_IsValid in the query to reject degenerate/self-intersecting polygons
    const result = await this.parcelRepo.query(
      `UPDATE listings.parcels
       SET boundary = CASE
         WHEN ST_IsValid(ST_GeomFromGeoJSON($1)) THEN ST_GeomFromGeoJSON($1)::geography
         ELSE NULL
       END
       WHERE id = $2
       RETURNING CASE WHEN ST_IsValid(ST_GeomFromGeoJSON($1)) THEN 'valid' ELSE 'invalid' END as validity`,
      [JSON.stringify(geojson), parcelId],
    );

    if (result?.[0]?.validity === 'invalid') {
      throw new BadRequestException('Invalid geometry: polygon is self-intersecting or degenerate');
    }
  }
}

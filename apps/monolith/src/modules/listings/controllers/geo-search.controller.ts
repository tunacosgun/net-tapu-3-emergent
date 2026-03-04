import {
  Controller,
  Get,
  Query,
} from '@nestjs/common';
import { GeoSearchService } from '../services/geo-search.service';
import { RadiusSearchDto, BboxSearchDto, NearestSearchDto } from '../dto/geo-search.dto';

@Controller('listings/geo')
export class GeoSearchController {
  constructor(private readonly geoSearchService: GeoSearchService) {}

  /**
   * GET /listings/geo/radius?lat=39.9&lng=32.8&radius=5000
   * Find parcels within a radius (meters) of a point.
   */
  @Get('radius')
  async radiusSearch(@Query() dto: RadiusSearchDto) {
    return this.geoSearchService.findWithinRadius(
      dto.lat,
      dto.lng,
      dto.radius,
      {
        status: dto.status,
        limit: dto.limit,
        offset: dto.offset,
      },
    );
  }

  /**
   * GET /listings/geo/bbox?minLat=39&minLng=32&maxLat=40&maxLng=33
   * Find parcels within a bounding box (map viewport).
   */
  @Get('bbox')
  async bboxSearch(@Query() dto: BboxSearchDto) {
    return this.geoSearchService.findInBoundingBox(
      dto.minLat,
      dto.minLng,
      dto.maxLat,
      dto.maxLng,
      {
        status: dto.status,
        limit: dto.limit,
        offset: dto.offset,
      },
    );
  }

  /**
   * GET /listings/geo/nearest?lat=39.9&lng=32.8&limit=10
   * Find nearest parcels to a point, ordered by distance.
   */
  @Get('nearest')
  async nearestSearch(@Query() dto: NearestSearchDto) {
    return this.geoSearchService.findNearest(
      dto.lat,
      dto.lng,
      dto.limit,
      {
        status: dto.status,
        maxDistanceMeters: dto.maxDistance,
      },
    );
  }
}

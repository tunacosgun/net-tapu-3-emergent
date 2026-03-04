import { Controller, Get, Query } from '@nestjs/common';
import { LocationsService } from './locations.service';

@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('cities')
  getCities() {
    return this.locationsService.getCities();
  }

  @Get('districts')
  getDistricts(@Query('city') city: string) {
    if (!city) return [];
    return this.locationsService.getDistricts(city);
  }

  @Get('neighborhoods')
  getNeighborhoods(
    @Query('city') city: string,
    @Query('district') district: string,
  ) {
    if (!city || !district) return [];
    return this.locationsService.getNeighborhoods(city, district);
  }
}

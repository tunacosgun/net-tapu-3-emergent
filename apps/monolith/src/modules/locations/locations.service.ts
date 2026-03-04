import { Injectable } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';

type LocationData = Record<string, Record<string, string[]>>;

@Injectable()
export class LocationsService {
  private readonly data: LocationData;

  constructor() {
    const filePath = path.join(__dirname, 'turkey_locations.json');
    this.data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  getCities(): string[] {
    return Object.keys(this.data).sort((a, b) => a.localeCompare(b, 'tr'));
  }

  getDistricts(city: string): string[] {
    const districts = this.data[city];
    if (!districts) return [];
    return Object.keys(districts).sort((a, b) => a.localeCompare(b, 'tr'));
  }

  getNeighborhoods(city: string, district: string): string[] {
    const districts = this.data[city];
    if (!districts) return [];
    const neighborhoods = districts[district];
    if (!neighborhoods) return [];
    return [...neighborhoods].sort((a, b) => a.localeCompare(b, 'tr'));
  }
}

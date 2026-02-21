import { IsEnum, IsOptional, IsInt, Min, Max, IsString, IsBoolean, IsNumberString } from 'class-validator';
import { Type } from 'class-transformer';
import { ParcelStatus } from '@nettapu/shared';

export class ListParcelsQueryDto {
  @IsEnum(ParcelStatus)
  @IsOptional()
  status?: ParcelStatus;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  district?: string;

  @IsNumberString()
  @IsOptional()
  minPrice?: string;

  @IsNumberString()
  @IsOptional()
  maxPrice?: string;

  @IsNumberString()
  @IsOptional()
  minArea?: string;

  @IsNumberString()
  @IsOptional()
  maxArea?: string;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  isAuctionEligible?: boolean;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  sortBy?: 'price' | 'areaM2' | 'createdAt' | 'listedAt';

  @IsString()
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;
}

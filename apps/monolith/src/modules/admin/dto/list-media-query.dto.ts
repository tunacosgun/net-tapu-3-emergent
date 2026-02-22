import { IsOptional, IsString, IsBoolean, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export class ListMediaQueryDto {
  @IsString()
  @IsOptional()
  mediaType?: string;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  isPopup?: boolean;

  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  sortBy?: 'createdAt' | 'title' | 'fileSizeBytes';

  @IsEnum(['ASC', 'DESC'])
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

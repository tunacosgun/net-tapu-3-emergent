import { IsEnum, IsOptional, IsInt, Min, Max, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class ListOffersQueryDto {
  @IsEnum(['pending', 'accepted', 'rejected', 'countered', 'expired', 'withdrawn'])
  @IsOptional()
  status?: string;

  @IsUUID()
  @IsOptional()
  parcel_id?: string;

  @IsUUID()
  @IsOptional()
  user_id?: string;

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

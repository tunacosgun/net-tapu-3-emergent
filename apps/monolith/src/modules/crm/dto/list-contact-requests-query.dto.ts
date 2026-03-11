import { IsEnum, IsOptional, IsInt, IsString, Min, Max, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class ListContactRequestsQueryDto {
  @IsEnum(['new', 'assigned', 'in_progress', 'completed', 'cancelled'])
  @IsOptional()
  status?: string;

  @IsEnum(['call_me', 'parcel_inquiry', 'general'])
  @IsOptional()
  type?: string;

  @IsUUID()
  @IsOptional()
  assigned_to?: string;

  @IsString()
  @IsOptional()
  search?: string;

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

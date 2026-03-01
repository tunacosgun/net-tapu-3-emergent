import { IsEnum, IsOptional, IsInt, Min, Max, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class ListAppointmentsQueryDto {
  @IsEnum(['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'])
  @IsOptional()
  status?: string;

  @IsUUID()
  @IsOptional()
  consultant_id?: string;

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

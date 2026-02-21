import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ReconciliationQueryDto {
  /** Only return records older than this many minutes (default: 30) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10080) // 7 days
  olderThanMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

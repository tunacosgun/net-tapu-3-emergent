import { IsOptional, IsEnum, IsInt, IsUUID, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentStatus } from '@nettapu/shared';

export class ListPaymentsQueryDto {
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: string;

  @IsOptional()
  @IsUUID()
  auctionId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ParcelStatus } from '@nettapu/shared';

export class UpdateParcelStatusDto {
  @IsEnum(ParcelStatus)
  status!: ParcelStatus;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}

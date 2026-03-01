import { IsString, IsOptional, IsUUID, MaxLength, Matches, IsDateString } from 'class-validator';

export class CreateOfferDto {
  @IsUUID()
  parcelId!: string;

  @IsString()
  @Matches(/^\d{1,13}(\.\d{1,2})?$/, {
    message: 'amount must be a positive decimal with up to 2 decimal places',
  })
  amount!: string;

  @IsString()
  @MaxLength(3)
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  message?: string;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}

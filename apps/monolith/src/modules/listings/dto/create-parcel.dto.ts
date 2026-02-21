import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  MaxLength,
  Length,
  IsNumberString,
} from 'class-validator';

export class CreateParcelDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  district!: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  neighborhood?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsNumberString()
  @IsOptional()
  latitude?: string;

  @IsNumberString()
  @IsOptional()
  longitude?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  ada?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  parsel?: string;

  @IsNumberString()
  @IsOptional()
  areaM2?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  zoningStatus?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  landType?: string;

  @IsNumberString()
  @IsOptional()
  price?: string;

  @IsString()
  @Length(3, 3)
  @IsOptional()
  currency?: string;

  @IsBoolean()
  @IsOptional()
  isAuctionEligible?: boolean;

  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;
}

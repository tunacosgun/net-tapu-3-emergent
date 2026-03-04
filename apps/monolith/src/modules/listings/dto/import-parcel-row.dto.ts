import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsNumberString,
} from 'class-validator';

export class ImportParcelRowDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  district!: string;

  @IsNumberString()
  @IsOptional()
  areaSize?: string;

  @IsNumberString()
  @IsOptional()
  price?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  parcelNumber?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  ada?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  parsel?: string;
}

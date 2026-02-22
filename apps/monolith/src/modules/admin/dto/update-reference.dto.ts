import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  MaxLength,
  IsUrl,
} from 'class-validator';

export class UpdateReferenceDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUrl()
  @IsOptional()
  @MaxLength(1000)
  imageUrl?: string;

  @IsUrl()
  @IsOptional()
  @MaxLength(1000)
  websiteUrl?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  referenceType?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;
}

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  MaxLength,
  IsUrl,
} from 'class-validator';

export class CreateReferenceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title!: string;

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
  @IsNotEmpty()
  @MaxLength(50)
  referenceType!: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;
}

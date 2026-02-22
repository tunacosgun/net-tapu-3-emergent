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

export class UploadMediaDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUrl()
  @IsNotEmpty()
  @MaxLength(1000)
  fileUrl!: string;

  @IsUrl()
  @IsOptional()
  @MaxLength(1000)
  thumbnailUrl?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  mediaType!: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  mimeType?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  fileSizeBytes?: number;

  @IsBoolean()
  @IsOptional()
  isPopup?: boolean;
}

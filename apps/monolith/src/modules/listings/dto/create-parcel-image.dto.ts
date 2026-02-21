import { IsString, IsNotEmpty, IsOptional, IsInt, IsBoolean, MaxLength, Min } from 'class-validator';

export class CreateParcelImageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  originalUrl!: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  mimeType?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  fileSizeBytes?: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  isCover?: boolean;
}

import { IsString, IsNotEmpty, IsOptional, IsInt, MaxLength, Min } from 'class-validator';

export class CreateParcelDocumentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  documentType!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  fileUrl!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName!: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  fileSizeBytes?: number;
}

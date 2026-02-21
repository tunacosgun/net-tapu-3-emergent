import { IsString, IsOptional, IsBoolean, IsObject, MaxLength } from 'class-validator';

export class CreateSavedSearchDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @IsObject()
  filters!: Record<string, unknown>;

  @IsBoolean()
  @IsOptional()
  notifyOnMatch?: boolean;
}

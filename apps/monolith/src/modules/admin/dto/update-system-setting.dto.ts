import { IsObject, IsNotEmpty, IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateSystemSettingDto {
  @IsObject()
  @IsNotEmpty()
  value!: Record<string, unknown>;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}

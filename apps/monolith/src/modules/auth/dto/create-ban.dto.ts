import { IsOptional, IsString, IsUUID, MaxLength, IsDateString, ValidateIf } from 'class-validator';

export class CreateBanDto {
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsString()
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ValidateIf((o) => !o.ipAddress && !o.userId)
  @IsString({ message: 'En az bir hedef (IP veya kullanıcı) belirtilmelidir' })
  _target?: string;
}

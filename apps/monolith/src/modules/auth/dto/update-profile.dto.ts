import { IsOptional, IsString, IsBoolean, MaxLength, MinLength, Matches } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Kullanıcı adı en az 3 karakter olmalıdır' })
  @MaxLength(30, { message: 'Kullanıcı adı en fazla 30 karakter olabilir' })
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'Kullanıcı adı yalnızca harf, rakam ve alt çizgi içerebilir' })
  username?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(11)
  @MinLength(11)
  @Matches(/^\d{11}$/, { message: 'TC Kimlik No 11 haneli olmalıdır' })
  tcKimlikNo?: string;

  @IsOptional()
  @IsBoolean()
  showAvatarInAuction?: boolean;
}

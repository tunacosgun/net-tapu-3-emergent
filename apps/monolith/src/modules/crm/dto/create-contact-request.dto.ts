import { IsString, IsEnum, IsOptional, MaxLength, IsEmail, IsUUID } from 'class-validator';

export class CreateContactRequestDto {
  @IsEnum(['call_me', 'parcel_inquiry', 'general'])
  type!: string;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsString()
  @MaxLength(20)
  phone!: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  message?: string;

  @IsUUID()
  @IsOptional()
  parcelId?: string;
}

import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class TkgmLookupDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  district!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  ada!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  parsel!: string;
}

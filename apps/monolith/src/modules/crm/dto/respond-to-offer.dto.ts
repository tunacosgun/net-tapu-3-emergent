import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';

export class RespondToOfferDto {
  @IsEnum(['accept', 'reject', 'counter'])
  responseType!: string;

  @IsString()
  @Matches(/^\d{1,13}(\.\d{1,2})?$/, {
    message: 'counterAmount must be a positive decimal',
  })
  @IsOptional()
  counterAmount?: string;

  @IsString()
  @IsOptional()
  message?: string;
}

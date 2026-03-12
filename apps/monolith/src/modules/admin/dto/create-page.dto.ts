import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  MaxLength,
} from 'class-validator';

export class CreatePageDto {
  @IsEnum([
    'about',
    'vision',
    'mission',
    'legal_info',
    'real_estate_concepts',
    'withdrawal_info',
    'post_sale',
    'press',
    'auction_rules',
    'auction_contract',
    'custom',
  ])
  pageType!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  slug!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title!: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  metaTitle?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  metaDescription?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}

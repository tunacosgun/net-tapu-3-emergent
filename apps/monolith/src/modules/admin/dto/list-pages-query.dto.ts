import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ListPagesQueryDto {
  @IsEnum(['draft', 'published', 'archived'])
  @IsOptional()
  status?: string;

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
  @IsOptional()
  pageType?: string;

  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  sortBy?: 'sortOrder' | 'createdAt' | 'publishedAt' | 'title';

  @IsEnum(['ASC', 'DESC'])
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;
}

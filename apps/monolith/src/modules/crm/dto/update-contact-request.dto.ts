import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class UpdateContactRequestDto {
  @IsEnum(['new', 'assigned', 'in_progress', 'completed', 'cancelled'])
  @IsOptional()
  status?: string;

  @IsUUID()
  @IsOptional()
  assignedTo?: string;
}

import { IsString, IsOptional, IsEnum, IsDateString, IsInt, Min, Max } from 'class-validator';

export class UpdateAppointmentDto {
  @IsEnum(['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'])
  @IsOptional()
  status?: string;

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  @IsInt()
  @Min(5)
  @Max(480)
  @IsOptional()
  durationMinutes?: number;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

import { IsString, IsOptional, IsUUID, IsDateString, IsInt, Min, Max } from 'class-validator';

export class CreateAppointmentDto {
  @IsUUID()
  @IsOptional()
  userId?: string;

  @IsUUID()
  @IsOptional()
  parcelId?: string;

  @IsUUID()
  @IsOptional()
  consultantId?: string;

  @IsUUID()
  @IsOptional()
  contactRequestId?: string;

  @IsDateString()
  scheduledAt!: string;

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

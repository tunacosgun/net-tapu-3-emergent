import { IsString, IsNotEmpty, IsOptional, IsObject, IsUUID } from 'class-validator';

export class NotificationEventDto {
  @IsString()
  @IsNotEmpty()
  event!: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

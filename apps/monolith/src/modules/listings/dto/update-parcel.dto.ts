import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsUUID } from 'class-validator';
import { CreateParcelDto } from './create-parcel.dto';

export class UpdateParcelDto extends PartialType(CreateParcelDto) {
  @IsUUID()
  @IsOptional()
  assignedConsultant?: string;
}

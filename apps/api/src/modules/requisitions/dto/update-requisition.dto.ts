import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsEnum } from 'class-validator';
import { CreateRequisitionDto } from './create-requisition.dto';

export class UpdateRequisitionDto extends PartialType(CreateRequisitionDto) {
  @IsOptional()
  @IsEnum(['Draft', 'Open', 'Paused', 'Closed', 'Filled'])
  status?: string;
}

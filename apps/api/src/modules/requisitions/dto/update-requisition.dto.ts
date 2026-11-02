import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsEnum, IsString, IsNumber } from 'class-validator';
import { CreateRequisitionDto } from './create-requisition.dto';

export class UpdateRequisitionDto extends PartialType(CreateRequisitionDto) {
  @IsOptional()
  @IsEnum(['Draft', 'Open', 'Paused', 'Closed', 'Filled'])
  status?: string;
}

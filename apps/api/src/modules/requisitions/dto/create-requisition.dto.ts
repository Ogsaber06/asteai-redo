import {
  IsString, IsNumber, IsEnum, IsOptional, IsArray, Min, Max, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { CandidateTier } from '@asteai/types';

class WeightsDto {
  @IsNumber() @Min(0) @Max(100) iq: number;
  @IsNumber() @Min(0) @Max(100) eq: number;
  @IsNumber() @Min(0) @Max(100) grit: number;
}

export class CreateRequisitionDto {
  @ApiProperty() @IsString() title: string;
  @ApiProperty() @IsString() industry: string;
  @ApiProperty() @IsString() func: string;
  @ApiProperty({ minimum: 1, maximum: 6 }) @IsNumber() @Min(1) @Max(6) echLevel: number;

  @ApiProperty({ enum: ['Technical', 'Non-Technical', 'Frontline', 'Skilled'] })
  @IsEnum(['Technical', 'Non-Technical', 'Frontline', 'Skilled'])
  tier: CandidateTier;

  @ApiProperty() @ValidateNested() @Type(() => WeightsDto) weights: WeightsDto;

  @ApiProperty() @IsString() lang: string;
  @ApiProperty() @IsOptional() @IsString() location?: string;
  @ApiProperty({ default: 1 }) @IsNumber() headcount: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() minShortlist?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() threshold?: number;
  @ApiProperty({ type: [String], required: false }) @IsOptional() @IsArray() stack?: string[];
  @ApiProperty({ required: false }) @IsOptional() @IsString() brief?: string;
}

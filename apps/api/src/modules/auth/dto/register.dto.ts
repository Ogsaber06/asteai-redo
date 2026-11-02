import { IsEmail, IsString, MinLength, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@asteai/types';

export class RegisterDto {
  @ApiProperty({ example: 'priya@hospital.in' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Priya' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Menon' })
  @IsString()
  lastName: string;

  @ApiProperty({ example: 'Employer', enum: ['Employer','Candidate','Freelancer','Buyer'] })
  @IsOptional()
  @IsEnum(['Employer', 'Candidate', 'Freelancer', 'Buyer'])
  role?: UserRole;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;
}

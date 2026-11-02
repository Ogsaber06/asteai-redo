import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { LANGUAGE_CODES } from '../catalogue';

export class StartMockInterviewDto {
  @IsIn(['tech', 'non-tech', 'frontline'])
  category!: 'tech' | 'non-tech' | 'frontline';

  /** A field from the catalogue for this category. */
  @IsString()
  @MaxLength(120)
  domain!: string;

  /** Typed for tech / non-tech; the role label for frontline. */
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  skill!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  summary?: string;

  @IsOptional()
  @IsIn(LANGUAGE_CODES)
  language?: string;
}

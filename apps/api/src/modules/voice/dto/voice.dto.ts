import { IsString, Length, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TranslateDto {
  @ApiProperty() @IsString() @MaxLength(5000) text: string;
  @ApiProperty({ example: 'en' }) @IsString() @Length(2, 8) from: string;
  @ApiProperty({ example: 'hi' }) @IsString() @Length(2, 8) to: string;
}

export class DetectLanguageDto {
  @ApiProperty() @IsString() @MaxLength(5000) text: string;
}

export class SynthesizeSpeechDto {
  @ApiProperty({ description: 'Short assistant reply to speak aloud', maxLength: 500 })
  @IsString() @MaxLength(500) text: string;

  @ApiProperty({ example: 'en-IN', description: 'BCP 47 language tag from the browser' })
  @IsString() @Length(2, 35) @Matches(/^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/)
  language: string;
}

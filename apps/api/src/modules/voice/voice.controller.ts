import { Body, Controller, Get, HttpCode, Post, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiNoContentResponse, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { DetectLanguageDto, SynthesizeSpeechDto, TranslateDto } from './dto/voice.dto';
import { SpeechSynthesisService } from './speech-synthesis.service';
import { VoiceService } from './voice.service';

@ApiTags('voice')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('voice')
export class VoiceController {
  constructor(private readonly svc: VoiceService, private readonly speech: SpeechSynthesisService) {}

  @Get('synthesis/status')
  synthesisStatus() {
    return this.speech.status();
  }

  /** Returns short-lived audio only; no transcript or audio is stored by this endpoint. */
  @Post('synthesize')
  @HttpCode(200)
  @Throttle({ short: { ttl: 60_000, limit: 30 } })
  @ApiProduces('audio/mpeg')
  @ApiResponse({ status: 200, description: 'Synthesized speech audio' })
  @ApiNoContentResponse({ description: 'Speech synthesis is disabled or no configured voice supports this language' })
  async synthesize(@Body() body: SynthesizeSpeechDto, @Res() response: Response): Promise<void> {
    response.setHeader('Cache-Control', 'private, no-store');
    const audio = await this.speech.synthesize(body.text, body.language);
    if (!audio?.length) {
      response.status(204).end();
      return;
    }
    response.status(200).type('audio/mpeg').send(audio);
  }

  @Post('translate')
  @HttpCode(200)
  translate(@Body() body: TranslateDto) {
    return this.svc.translate(body.text, body.from, body.to);
  }

  @Post('detect')
  @HttpCode(200)
  detect(@Body() body: DetectLanguageDto) {
    return this.svc.detect(body.text);
  }
}

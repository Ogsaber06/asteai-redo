import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { VoiceService } from './voice.service';

@ApiTags('voice')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('voice')
export class VoiceController {
  constructor(private readonly svc: VoiceService) {}

  @Post('translate')
  translate(@Body() body: { text: string; from: string; to: string }) {
    return this.svc.translate(body.text, body.from, body.to);
  }

  @Post('detect')
  detect(@Body() body: { text: string }) {
    return this.svc.detect(body.text);
  }
}

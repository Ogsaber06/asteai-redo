import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PollyClient } from '@aws-sdk/client-polly';
import { VoiceController } from './voice.controller';
import { VoiceService } from './voice.service';
import { POLLY_CLIENT, SpeechSynthesisService } from './speech-synthesis.service';

@Module({
  controllers: [VoiceController],
  providers: [
    VoiceService,
    SpeechSynthesisService,
    {
      provide: POLLY_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): PollyClient | null => {
        if (config.get<string>('VOICE_TTS_ENABLED') !== 'true') return null;
        return new PollyClient({ region: config.getOrThrow<string>('AWS_REGION') });
      },
    },
  ],
})
export class VoiceModule {}

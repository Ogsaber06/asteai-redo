import { DescribeVoicesCommand, Engine, PollyClient, SynthesizeSpeechCommand, type Voice } from '@aws-sdk/client-polly';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const POLLY_CLIENT = Symbol('POLLY_CLIENT');
type VoiceEngine = typeof Engine.GENERATIVE | typeof Engine.NEURAL;

@Injectable()
export class SpeechSynthesisService {
  private readonly logger = new Logger(SpeechSynthesisService.name);
  private readonly enabled: boolean;
  private readonly preferredEngine: VoiceEngine;
  private readonly voiceCache = new Map<VoiceEngine, { promise: Promise<Voice[]>; expiresAt: number }>();

  constructor(config: ConfigService, @Inject(POLLY_CLIENT) private readonly polly: PollyClient | null) {
    this.enabled = config.get<string>('VOICE_TTS_ENABLED') === 'true' && polly !== null;
    this.preferredEngine = config.get<string>('VOICE_TTS_ENGINE') === Engine.NEURAL ? Engine.NEURAL : Engine.GENERATIVE;
  }

  status() {
    return { enabled: this.enabled };
  }

  async synthesize(text: string, language: string): Promise<Buffer | null> {
    if (!this.enabled || !this.polly) return null;
    const cleaned = text.trim();
    if (!cleaned || cleaned.length > 500) return null;

    const engines = this.preferredEngine === Engine.GENERATIVE
      ? [Engine.GENERATIVE, Engine.NEURAL] as const
      : [Engine.NEURAL] as const;

    for (const engine of engines) {
      try {
        const voice = this.voiceFor(await this.listVoices(engine), language);
        if (!voice?.Id) continue;
        const requestedLanguage = normalizeLanguage(language);
        const synthesisLanguage = [voice.LanguageCode, ...(voice.AdditionalLanguageCodes ?? [])]
          .find((code) => code && normalizeLanguage(code) === requestedLanguage) ?? voice.LanguageCode;
        if (!synthesisLanguage) continue;

        const output = await this.polly.send(new SynthesizeSpeechCommand({
          Engine: engine,
          LanguageCode: synthesisLanguage,
          OutputFormat: 'mp3',
          Text: cleaned,
          TextType: 'text',
          VoiceId: voice.Id,
        }));
        if (output.AudioStream) return Buffer.from(await output.AudioStream.transformToByteArray());
      } catch {
        // Some Polly engines are unavailable in particular AWS regions. Try the
        // neural voice next; a provider issue must never disable voice commands.
        this.logger.warn(`Amazon Polly ${engine} speech unavailable; trying the next voice option`);
      }
    }
    return null;
  }

  private async listVoices(engine: VoiceEngine): Promise<Voice[]> {
    const cached = this.voiceCache.get(engine);
    if (cached && Date.now() < cached.expiresAt) return cached.promise;
    const request = this.polly!.send(new DescribeVoicesCommand({
      Engine: engine,
      IncludeAdditionalLanguageCodes: true,
    })).then((result) => result.Voices ?? []);
    this.voiceCache.set(engine, { promise: request, expiresAt: Date.now() + 60 * 60 * 1000 });
    try {
      return await request;
    } catch (error) {
      if (this.voiceCache.get(engine)?.promise === request) this.voiceCache.delete(engine);
      throw error;
    }
  }

  private voiceFor(voices: Voice[], language: string): Voice | undefined {
    const requested = normalizeLanguage(language);
    const codes = (voice: Voice) => [voice.LanguageCode, ...(voice.AdditionalLanguageCodes ?? [])]
      .map((code) => code ? normalizeLanguage(code) : null)
      .filter((code): code is string => code !== null);
    const exact = voices.find((voice) => codes(voice).includes(requested));
    if (exact || requested.includes('-')) return exact;
    return voices.find((voice) => codes(voice).some((code) => code.split('-')[0] === requested));
  }
}

function normalizeLanguage(language: string): string {
  return language.trim().replace(/_/g, '-').toLowerCase();
}

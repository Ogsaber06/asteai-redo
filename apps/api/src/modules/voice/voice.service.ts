import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * VoiceService: routes translation/TTS/STT requests to the deeptech_ai service.
 * The AI service URL is configured via AI_SERVICE_URL env var.
 */
@Injectable()
export class VoiceService {
  private readonly aiUrl: string;

  constructor(private readonly config: ConfigService) {
    this.aiUrl = config.get('AI_SERVICE_URL', 'http://localhost:8000');
  }

  async translate(text: string, from: string, to: string): Promise<{ translated: string }> {
    // Proxy to deeptech_ai FastAPI /translate endpoint
    const res = await fetch(`${this.aiUrl}/voice/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, from_lang: from, to_lang: to }),
    });
    if (!res.ok) throw new Error(`AI service error: ${res.status}`);
    return res.json() as Promise<{ translated: string }>;
  }

  async detect(text: string): Promise<{ lang: string; confidence: number }> {
    const res = await fetch(`${this.aiUrl}/voice/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`AI service error: ${res.status}`);
    return res.json() as Promise<{ lang: string; confidence: number }>;
  }
}

import { DescribeVoicesCommand, Engine, PollyClient, SynthesizeSpeechCommand, type Voice } from '@aws-sdk/client-polly';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { SpeechSynthesisService } from './speech-synthesis.service';

type VoiceEngine = typeof Engine.GENERATIVE | typeof Engine.NEURAL;

function setup(options: {
  enabled?: boolean;
  preferredEngine?: VoiceEngine;
  fail?: boolean;
  failEngines?: VoiceEngine[];
  generativeVoices?: Array<Record<string, unknown>>;
  neuralVoices?: Array<Record<string, unknown>>;
} = {}) {
  const commands: Array<DescribeVoicesCommand | SynthesizeSpeechCommand> = [];
  const polly = {
    send: async (command: DescribeVoicesCommand | SynthesizeSpeechCommand) => {
      commands.push(command);
      if (options.fail || options.failEngines?.includes(command.input.Engine as VoiceEngine)) {
        throw new Error('provider unavailable');
      }
      if (command instanceof DescribeVoicesCommand) {
        const voices = command.input.Engine === Engine.GENERATIVE
          ? options.generativeVoices ?? []
          : options.neuralVoices ?? [];
        return { Voices: voices as Voice[] };
      }
      return { AudioStream: { transformToByteArray: async () => Uint8Array.from([0x49, 0x44, 0x33]) } };
    },
  } as unknown as PollyClient;
  const config = {
    get: (key: string) => {
      if (key === 'VOICE_TTS_ENABLED' && options.enabled) return 'true';
      if (key === 'VOICE_TTS_ENGINE') return options.preferredEngine;
      return undefined;
    },
  } as ConfigService;
  return { service: new SpeechSynthesisService(config, polly), commands };
}

describe('SpeechSynthesisService', () => {
  it('is off by default and does not call Polly', async () => {
    const { service, commands } = setup();
    assert.deepEqual(service.status(), { enabled: false });
    assert.equal(await service.synthesize('Hello', 'en-IN'), null);
    assert.equal(commands.length, 0);
  });

  it('uses a matching generative voice first for human-like replies', async () => {
    const { service, commands } = setup({ enabled: true, generativeVoices: [{ Id: 'Kajal', LanguageCode: 'en-IN' }] });
    const audio = await service.synthesize('Hello there.', 'en-IN');
    assert.deepEqual(audio, Buffer.from([0x49, 0x44, 0x33]));
    assert.ok(commands[0] instanceof DescribeVoicesCommand);
    assert.equal(commands[0].input.Engine, Engine.GENERATIVE);
    const synth = commands[1];
    assert.ok(synth instanceof SynthesizeSpeechCommand);
    assert.equal(synth.input.Engine, Engine.GENERATIVE);
    assert.equal(synth.input.VoiceId, 'Kajal');
    assert.equal(synth.input.OutputFormat, 'mp3');
    assert.equal(synth.input.Text, 'Hello there.');
  });

  it('falls back to neural speech when the region does not support the generative engine', async () => {
    const { service, commands } = setup({
      enabled: true,
      failEngines: [Engine.GENERATIVE],
      neuralVoices: [{ Id: 'Kajal', LanguageCode: 'en-IN' }],
    });
    assert.ok(await service.synthesize('Hello there.', 'en-IN'));
    assert.ok(commands[0] instanceof DescribeVoicesCommand);
    assert.equal(commands[0].input.Engine, Engine.GENERATIVE);
    assert.ok(commands[1] instanceof DescribeVoicesCommand);
    assert.equal(commands[1].input.Engine, Engine.NEURAL);
    const synth = commands[2];
    assert.ok(synth instanceof SynthesizeSpeechCommand);
    assert.equal(synth.input.Engine, Engine.NEURAL);
  });

  it('matches bilingual generative voices by their additional language code', async () => {
    const { service, commands } = setup({ enabled: true, generativeVoices: [{
      Id: 'Kajal', LanguageCode: 'en-IN', AdditionalLanguageCodes: ['hi-IN'],
    }] });
    assert.ok(await service.synthesize('नमस्ते', 'hi-IN'));
    const synth = commands[1];
    assert.ok(synth instanceof SynthesizeSpeechCommand);
    assert.equal(synth.input.LanguageCode, 'hi-IN');
  });

  it('can prefer neural speech when the deployment opts out of generative TTS', async () => {
    const { service, commands } = setup({
      enabled: true,
      preferredEngine: Engine.NEURAL,
      generativeVoices: [{ Id: 'Kajal', LanguageCode: 'en-IN' }],
      neuralVoices: [{ Id: 'Kajal', LanguageCode: 'en-IN' }],
    });
    assert.ok(await service.synthesize('Hello there.', 'en-IN'));
    assert.equal(commands.length, 2);
    assert.ok(commands[0] instanceof DescribeVoicesCommand);
    assert.equal(commands[0].input.Engine, Engine.NEURAL);
  });

  it('falls back when no voice supports the requested language', async () => {
    const { service, commands } = setup({
      enabled: true,
      generativeVoices: [{ Id: 'Kajal', LanguageCode: 'en-IN' }],
      neuralVoices: [{ Id: 'Kajal', LanguageCode: 'en-IN' }],
    });
    assert.equal(await service.synthesize('ನಮಸ್ಕಾರ', 'kn-IN'), null);
    assert.equal(commands.length, 2);
  });

  it('does not substitute a different regional accent when a specific locale has no voice', async () => {
    const { service, commands } = setup({
      enabled: true,
      generativeVoices: [{ Id: 'Joanna', LanguageCode: 'en-US' }],
      neuralVoices: [{ Id: 'Joanna', LanguageCode: 'en-US' }],
    });
    assert.equal(await service.synthesize('Hello', 'en-IN'), null);
    assert.equal(commands.length, 2);
  });

  it('falls back to the device when Polly engines are unavailable', async () => {
    const { service, commands } = setup({ enabled: true, fail: true });
    assert.equal(await service.synthesize('Hello', 'en-IN'), null);
    assert.equal(commands.length, 2);
  });

  it('does not send empty or overlong text to Polly', async () => {
    const { service, commands } = setup({ enabled: true });
    assert.equal(await service.synthesize('  ', 'en-IN'), null);
    assert.equal(await service.synthesize('x'.repeat(501), 'en-IN'), null);
    assert.equal(commands.length, 0);
  });
});

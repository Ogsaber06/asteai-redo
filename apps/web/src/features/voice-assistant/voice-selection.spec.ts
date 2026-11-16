import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { chooseSpeechVoice } from './voice-selection';

function voice(name: string, lang: string, isDefault = false): SpeechSynthesisVoice {
  return { name, lang, default: isDefault } as SpeechSynthesisVoice;
}

describe('chooseSpeechVoice', () => {
  it('prefers the natural voice for the exact locale', () => {
    const defaultVoice = voice('Microsoft David - English (United States)', 'en-US', true);
    const naturalVoice = voice('Microsoft Aria Online (Natural) - English (United States)', 'en-US');
    assert.equal(chooseSpeechVoice([defaultVoice, naturalVoice], 'en-US'), naturalVoice);
  });

  it('prefers an exact locale over a more natural voice in another locale', () => {
    const localVoice = voice('Google Hindi', 'hi-IN');
    const otherVoice = voice('Natural English', 'en-IN');
    assert.equal(chooseSpeechVoice([otherVoice, localVoice], 'hi-IN'), localVoice);
  });

  it('falls back to a same-language voice when the exact locale is unavailable', () => {
    const english = voice('Google English', 'en-GB');
    assert.equal(chooseSpeechVoice([english], 'en-IN'), english);
  });

  it('does not select a voice from an unrelated language', () => {
    assert.equal(chooseSpeechVoice([voice('Google Hindi', 'hi-IN')], 'en-IN'), null);
  });
});

/** Picks a speech voice that matches the requested locale, preferring installed natural voices. */
export function chooseSpeechVoice(
  voices: readonly SpeechSynthesisVoice[], language: string,
): SpeechSynthesisVoice | null {
  const requested = normalizeLanguage(language);
  const base = requested.split('-')[0];
  const compatible = voices.filter((voice) => {
    const locale = normalizeLanguage(voice.lang);
    return locale === requested || locale.split('-')[0] === base;
  });
  compatible.sort((a, b) => voiceScore(b, requested) - voiceScore(a, requested));
  return compatible[0] ?? null;
}

function voiceScore(voice: SpeechSynthesisVoice, requested: string): number {
  const locale = normalizeLanguage(voice.lang);
  let score = locale === requested ? 100 : 50;
  const name = voice.name.toLowerCase();
  if (/\b(natural|neural|wavenet|premium|enhanced)\b/.test(name)) score += 80;
  else if (/\bonline\b/.test(name)) score += 40;
  else if (/\bgoogle\b/.test(name)) score += 20;
  if (voice.default) score += 5;
  return score;
}

function normalizeLanguage(language: string): string {
  return language.trim().replace(/_/g, '-').toLowerCase();
}

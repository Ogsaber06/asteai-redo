/** Browser speech input plus natural and on-device speech output for the assistant. */

import { apiFetch, apiRequest } from '@/lib/api';
import { chooseSpeechVoice } from './voice-selection';

interface RecognitionAlternative { transcript: string }
interface RecognitionResultList { [index: number]: { [index: number]: RecognitionAlternative }; length: number }
interface RecognitionEvent { results: RecognitionResultList }
interface RecognitionErrorEvent { error: string }

interface Recognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}

type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext && recognitionCtor() !== null;
}

export function isSpeechOutputSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export class SpeechError extends Error {
  constructor(readonly code: string) {
    super(code === 'not-allowed' ? 'Microphone access was blocked.' : code === 'no-speech' ? "I didn't hear anything." : 'Speech recognition failed.');
  }
}

export interface Listening {
  result: Promise<string>;
  cancel: () => void;
}

/** Listens for one phrase. `result` resolves with the transcript ('' if cancelled). */
export function listenOnce(lang: string): Listening {
  const Ctor = recognitionCtor();
  if (!Ctor) return { result: Promise.reject(new SpeechError('unsupported')), cancel: () => {} };

  const rec = new Ctor();
  rec.lang = lang;
  rec.interimResults = false;
  rec.maxAlternatives = 1;

  let finish: (text: string) => void = () => {};
  const result = new Promise<string>((resolve, reject) => {
    finish = resolve;
    let transcript = '';
    rec.onresult = (e) => { transcript = e.results[0]?.[0]?.transcript ?? ''; };
    rec.onerror = (e) => { if (e.error !== 'aborted') reject(new SpeechError(e.error)); };
    rec.onend = () => transcript.trim() ? resolve(transcript.trim()) : reject(new SpeechError('no-speech'));
    rec.start();
  });
  return { result, cancel: () => { finish(''); rec.abort(); } };
}

let naturalVoiceStatus: Promise<boolean> | null = null;

/** Reads the server's feature flag once; disabled speech never sends reply text to a provider. */
export function isNaturalVoiceAvailable(): Promise<boolean> {
  if (!naturalVoiceStatus) {
    naturalVoiceStatus = loadNaturalVoiceStatus();
  }
  return naturalVoiceStatus;
}

async function loadNaturalVoiceStatus(): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_000);
  try {
    const result = await apiFetch<{ enabled: boolean }>('/voice/synthesis/status', { signal: controller.signal });
    return result.enabled === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export type SpeechOutputMode = 'natural' | 'device' | null;

let activeAudio: HTMLAudioElement | null = null;
let activeAudioUrl: string | null = null;
let activeSpeechRequest: AbortController | null = null;
const naturalSpeechTimeoutMs = 2_500;

export { chooseSpeechVoice } from './voice-selection';

/** Reads a short reply aloud. Natural server speech is preferred when configured; browser speech is the fallback. */
export async function speak(text: string, lang: string, preferNatural = false): Promise<SpeechOutputMode> {
  stopSpeaking();
  if (!text.trim() || typeof window === 'undefined' || !isSpeechOutputSupported()) return null;

  const playbackController = new AbortController();
  activeSpeechRequest = playbackController;
  if (preferNatural) {
    const requestController = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; requestController.abort(); }, naturalSpeechTimeoutMs);
    const cancelRequest = () => requestController.abort();
    playbackController.signal.addEventListener('abort', cancelRequest, { once: true });
    try {
      const response = await apiRequest('/voice/synthesize', {
        method: 'POST', body: { text: text.slice(0, 500), language: lang }, signal: requestController.signal,
      });
      if (playbackController.signal.aborted) return null;
      if (timedOut) throw new Error('Natural speech took too long.');
      if (response.status === 204) throw new Error('Natural speech is unavailable for this language.');
      const blob = await response.blob();
      if (!blob.size || playbackController.signal.aborted) throw new Error('Natural speech returned no audio.');

      clearTimeout(timeout);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      activeAudio = audio;
      activeAudioUrl = url;
      const cleanUp = () => {
        if (activeAudio !== audio) return;
        activeAudio = null;
        activeAudioUrl = null;
        if (activeSpeechRequest === playbackController) activeSpeechRequest = null;
        URL.revokeObjectURL(url);
      };
      audio.addEventListener('ended', cleanUp, { once: true });
      audio.addEventListener('error', cleanUp, { once: true });
      await audio.play();
      if (playbackController.signal.aborted) return null;
      return 'natural';
    } catch {
      releaseActiveAudio();
      if (playbackController.signal.aborted) return null;
      // A missing provider, unsupported locale, network error, or autoplay restriction
      // must not leave the user without the existing browser speech response.
    } finally {
      clearTimeout(timeout);
      playbackController.signal.removeEventListener('abort', cancelRequest);
    }
  }

  if (playbackController.signal.aborted) return null;
  let mode: SpeechOutputMode = null;
  try {
    mode = await speakOnDevice(text, lang, playbackController.signal);
  } catch {
    // Keep the text response usable even when a browser exposes speech synthesis but
    // rejects a voice/utterance at runtime (for example, after a permission change).
  }
  if (playbackController.signal.aborted) return null;
  if (activeSpeechRequest === playbackController) activeSpeechRequest = null;
  return mode;
}

async function speakOnDevice(text: string, lang: string, signal: AbortSignal): Promise<SpeechOutputMode> {
  const synthesis = window.speechSynthesis;
  const voices = await availableVoices(synthesis);
  if (!isSpeechOutputSupported() || signal.aborted) return null;

  const utterance = new SpeechSynthesisUtterance(text);
  const voice = chooseSpeechVoice(voices, lang);
  utterance.lang = voice?.lang ?? lang;
  if (voice) utterance.voice = voice;
  // Leave rate and pitch at the browser's natural defaults. Aggressive changes sound robotic.
  synthesis.speak(utterance);
  return 'device';
}

function availableVoices(synthesis: SpeechSynthesis): Promise<SpeechSynthesisVoice[]> {
  const current = synthesis.getVoices();
  if (current.length) return Promise.resolve(current);
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      synthesis.removeEventListener('voiceschanged', finish);
      resolve(synthesis.getVoices());
    };
    const timeout = setTimeout(finish, 300);
    synthesis.addEventListener('voiceschanged', finish, { once: true });
  });
}

function releaseActiveAudio() {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.src = '';
    activeAudio = null;
  }
  if (activeAudioUrl) {
    URL.revokeObjectURL(activeAudioUrl);
    activeAudioUrl = null;
  }
}

export function stopSpeaking() {
  activeSpeechRequest?.abort();
  activeSpeechRequest = null;
  releaseActiveAudio();
  if (isSpeechOutputSupported()) window.speechSynthesis.cancel();
}

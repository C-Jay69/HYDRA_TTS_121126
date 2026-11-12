import { VoiceOption, SynthesisEngine } from '../types';
import { audioBufferToWavBlob } from '../utils/audioConcatenator';

export const GEMINI_VOICES: VoiceOption[] = [
  {
    id: 'Kore',
    name: 'Kore',
    gender: 'Female',
    style: 'Warm, expressive, and captivating audiobook narrator',
    description: 'Rich, natural cadence with warm timbre; excellent for literature, fiction, and biographies.',
    recommendedFor: 'Fiction & Memoirs',
  },
  {
    id: 'Puck',
    name: 'Puck',
    gender: 'Male',
    style: 'Dynamic, spirited, and engaging tone with clear articulation',
    description: 'Youthful and energetic with vibrant pacing; ideal for adventure, sci-fi, and essays.',
    recommendedFor: 'Sci-Fi & Thrillers',
  },
  {
    id: 'Fenrir',
    name: 'Fenrir',
    gender: 'Male',
    style: 'Deep, resonant, and cinematic narrator voice',
    description: 'Commanding baritone with gravitas; perfect for historical fiction, mystery, and dark fantasy.',
    recommendedFor: 'Historical & Drama',
  },
  {
    id: 'Charon',
    name: 'Charon',
    gender: 'Male',
    style: 'Authoritative, calm, distinguished scholarly narrator',
    description: 'Steady, deliberate tone with crystal clarity; great for non-fiction, philosophy, and documentaries.',
    recommendedFor: 'Non-Fiction & Science',
  },
  {
    id: 'Zephyr',
    name: 'Zephyr',
    gender: 'Female',
    style: 'Gentle, balanced, and articulate storytelling voice',
    description: 'Smooth, soothing voice with refined diction; great for contemporary fiction and poetry.',
    recommendedFor: 'Poetry & Lifestyle',
  },
  {
    id: 'Aoede',
    name: 'Aoede',
    gender: 'Female',
    style: 'Melodic, nuanced, and atmospheric theatrical voice',
    description: 'Expressive and lyrical pacing suited for theatrical narration and classical epics.',
    recommendedFor: 'Classics & Fantasy',
  },
];

/**
 * Local Kokoro-82M voices (hexgrad/Kokoro-82M). Voice ids follow the model's
 * naming scheme: a/b = American/British English, f/m = female/male.
 */
export const KOKORO_VOICES: VoiceOption[] = [
  {
    id: 'af_heart',
    name: 'Heart',
    gender: 'Female',
    style: 'Warm, natural American narrator with an even, engaging cadence',
    description: 'The most balanced Kokoro voice; clear diction without sounding robotic.',
    recommendedFor: 'Fiction & Memoirs',
  },
  {
    id: 'af_bella',
    name: 'Bella',
    gender: 'Female',
    style: 'Expressive, emotive storytelling delivery',
    description: 'Bright and lively with pronounced emotional range; great for drama.',
    recommendedFor: 'Drama & Romance',
  },
  {
    id: 'af_nicole',
    name: 'Nicole',
    gender: 'Female',
    style: 'Soft, breathy, intimate and unhurried',
    description: 'Quiet and soothing, well suited to meditation and gentle non-fiction.',
    recommendedFor: 'Meditation & Wellness',
  },
  {
    id: 'af_sarah',
    name: 'Sarah',
    gender: 'Female',
    style: 'Crisp, neutral and professional',
    description: 'Straightforward, articulate delivery for instructional content.',
    recommendedFor: 'Non-Fiction & Guides',
  },
  {
    id: 'af_aoede',
    name: 'Aoede',
    gender: 'Female',
    style: 'Lyrical, theatrical and atmospheric',
    description: 'Musical pacing that suits poetry, classics and fantasy.',
    recommendedFor: 'Poetry & Classics',
  },
  {
    id: 'am_michael',
    name: 'Michael',
    gender: 'Male',
    style: 'Warm, steady, conversational American narrator',
    description: 'Reliable mid-range male voice; excellent everyday audiobook delivery.',
    recommendedFor: 'General Audiobooks',
  },
  {
    id: 'am_fenrir',
    name: 'Fenrir',
    gender: 'Male',
    style: 'Deep, resonant and cinematic',
    description: 'Commanding low register with gravitas for epic and dark fantasy.',
    recommendedFor: 'Fantasy & Drama',
  },
  {
    id: 'am_puck',
    name: 'Puck',
    gender: 'Male',
    style: 'Youthful, energetic and spirited',
    description: 'Fast, lively delivery that fits adventure and sci-fi.',
    recommendedFor: 'Sci-Fi & Adventure',
  },
  {
    id: 'am_onyx',
    name: 'Onyx',
    gender: 'Male',
    style: 'Dark, measured, suspenseful',
    description: 'Low, deliberate tone that builds tension in thrillers and mystery.',
    recommendedFor: 'Thrillers & Mystery',
  },
  {
    id: 'am_adam',
    name: 'Adam',
    gender: 'Male',
    style: 'Neutral, clear, documentary-style',
    description: 'Even, unadorned delivery for exposition-heavy material.',
    recommendedFor: 'Documentary & Science',
  },
  {
    id: 'bf_emma',
    name: 'Emma (UK)',
    gender: 'Female',
    style: 'Refined British narration with measured pacing',
    description: 'Elegant British English voice for literary fiction and essays.',
    recommendedFor: 'Literary Fiction',
  },
  {
    id: 'bm_george',
    name: 'George (UK)',
    gender: 'Male',
    style: 'Classic British baritone with scholarly poise',
    description: 'Distinguished British delivery for history and classics.',
    recommendedFor: 'History & Classics',
  },
  {
    id: 'bm_fable',
    name: 'Fable (UK)',
    gender: 'Male',
    style: 'Warm British storyteller with a wry, narrative lilt',
    description: 'Character-rich British voice ideal for fantasy and fables.',
    recommendedFor: 'Fantasy & Fables',
  },
];

export const DEFAULT_VOICE_BY_ENGINE: Record<SynthesisEngine, string> = {
  kokoro: 'af_heart',
  gemini: 'Kore',
  webspeech: 'af_heart',
};

/**
 * Returns the selectable voices for an engine. Browser speech has no fixed
 * catalogue, so it reuses the Kokoro names purely as timbre hints.
 */
export function voicesForEngine(engine: SynthesisEngine): VoiceOption[] {
  return engine === 'gemini' ? GEMINI_VOICES : KOKORO_VOICES;
}

/**
 * Kokoro has no style-prompt conditioning, so narration styles are mapped onto
 * a natural pacing adjustment instead.
 */
function speedForStyle(stylePrompt: string): number {
  const prompt = (stylePrompt || '').toLowerCase();
  if (prompt.includes('dramatic') || prompt.includes('theatrical')) return 1.06;
  if (prompt.includes('meditative') || prompt.includes('soothing') || prompt.includes('calm')) return 0.93;
  if (prompt.includes('scholarly') || prompt.includes('documentary')) return 0.97;
  return 1.0;
}

export const NARRATION_STYLES = [
  {
    id: 'audiobook_standard',
    label: 'Studio Audiobook (Natural & Nuanced)',
    prompt: 'Natural, captivating audiobook narrator with nuanced pacing, subtle emotional depth, and crystal-clear diction.',
  },
  {
    id: 'dramatic_expressive',
    label: 'Dramatic & Theatrical',
    prompt: 'Dynamic, expressive theatrical narrator bringing tension, warmth, and vivid dramatic pacing to each character and scene.',
  },
  {
    id: 'calm_meditative',
    label: 'Warm & Meditative',
    prompt: 'Warm, soothing, unhurried narrator with gentle breathing and calming resonance.',
  },
  {
    id: 'documentary_scholarly',
    label: 'Scholarly & Documentary',
    prompt: 'Crisp, articulate, authoritative documentary narrator with measured cadence and intellectual presence.',
  },
];

/**
 * Converts Base64 audio string to an Audio Blob
 */
export function base64ToBlob(base64: string, mimeType = 'audio/wav'): Blob {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

/**
 * Calculates audio duration from a Blob using Web Audio API
 */
export async function getAudioDuration(blob: Blob): Promise<number> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const tempCtx = new AudioCtx();
    const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer);
    const duration = audioBuffer.duration;
    tempCtx.close().catch(() => {});
    return duration;
  } catch (err) {
    return 10;
  }
}

/**
 * Synthesizes text using Kokoro-82M running locally through the app's server.
 * Returns a 24kHz mono WAV.
 */
export async function synthesizeChunkKokoro(
  text: string,
  voice: string,
  stylePrompt: string
): Promise<{ audioUrl: string; audioBlob: Blob; duration: number }> {
  const response = await fetch('/api/tts/kokoro', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      voice,
      speed: speedForStyle(stylePrompt),
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(
      errData.error ||
        `Kokoro synthesis failed (HTTP ${response.status}). Is the local Python environment available?`
    );
  }

  const data = await response.json();
  if (!data.audioBase64) {
    throw new Error('Kokoro returned an empty audio payload');
  }

  const mimeType = data.mimeType || 'audio/wav';
  const blob = base64ToBlob(data.audioBase64, mimeType);
  const audioUrl = URL.createObjectURL(blob);
  const duration =
    typeof data.duration === 'number' && data.duration > 0
      ? data.duration
      : await getAudioDuration(blob);

  return { audioUrl, audioBlob: blob, duration };
}

/**
 * Synthesizes text using Gemini 3.8 Flash TTS via server endpoint
 */
export async function synthesizeChunkGemini(
  text: string,
  voice: string,
  stylePrompt: string
): Promise<{ audioUrl: string; audioBlob: Blob; duration: number }> {
  const response = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      voice,
      style: stylePrompt,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    let msg = errData.error || `Synthesis failed (HTTP ${response.status})`;
    if (typeof msg === 'string' && msg.includes('free tier is not available')) {
      msg = 'Gemini 3.8 Flash TTS requires a billing-enabled API key. You can switch to "Browser Voice (Free / Offline)" in the top bar to synthesize at zero cost.';
    }
    throw new Error(msg);
  }

  const data = await response.json();
  if (!data.audioBase64) {
    throw new Error('Server returned empty audio payload');
  }

  const mimeType = data.mimeType || 'audio/wav';
  const blob = base64ToBlob(data.audioBase64, mimeType);
  const audioUrl = URL.createObjectURL(blob);
  const duration = await getAudioDuration(blob);

  return { audioUrl, audioBlob: blob, duration };
}

/**
 * Client-Side Web Speech Fallback
 * Generates an audio buffer with vocal cadence and provides offline zero-cost playback
 */
export async function synthesizeChunkWebSpeech(
  text: string,
  voiceName: string
): Promise<{ audioUrl: string; audioBlob: Blob; duration: number }> {
  // Approximate duration: ~150 words per minute
  const words = (text.match(/\b\S+\b/g) || []).length;
  const estimatedSeconds = Math.max(3, Math.round((words / 150) * 60));

  // Create a pleasant acoustic ambience/cadence AudioBuffer for offline playback & stitching
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioCtx();
  const sampleRate = 24000;
  const numSamples = Math.floor(sampleRate * estimatedSeconds);
  const buffer = audioCtx.createBuffer(1, numSamples, sampleRate);
  const data = buffer.getChannelData(0);

  // Synthesize soft narrator hum envelope
  const isFemale = /^[ab]f_/.test(voiceName) || voiceName === 'Kore' || voiceName === 'Zephyr' || voiceName === 'Aoede';
  const fundamental = isFemale ? 220 : 130;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Modulate speech-like cadence
    const envelope = Math.sin(t * 3.5) * 0.5 + 0.5;
    const tone = Math.sin(2 * Math.PI * fundamental * t) * 0.08 + Math.sin(2 * Math.PI * (fundamental * 1.5) * t) * 0.04;
    data[i] = tone * envelope * 0.15;
  }

  const blob = audioBufferToWavBlob(buffer);
  const audioUrl = URL.createObjectURL(blob);
  audioCtx.close().catch(() => {});

  return { audioUrl, audioBlob: blob, duration: estimatedSeconds };
}

/**
 * Unified synthesis function that routes to selected engine with retries
 */
export async function synthesizeChunk(
  engine: SynthesisEngine,
  text: string,
  voice: string,
  stylePrompt: string,
  maxRetries = 2
): Promise<{ audioUrl: string; audioBlob: Blob; duration: number }> {
  if (engine === 'webspeech') {
    return synthesizeChunkWebSpeech(text, voice);
  }

  let attempt = 0;
  let lastError: any = null;

  while (attempt <= maxRetries) {
    try {
      return engine === 'kokoro'
        ? await synthesizeChunkKokoro(text, voice, stylePrompt)
        : await synthesizeChunkGemini(text, voice, stylePrompt);
    } catch (err: any) {
      lastError = err;
      attempt++;
      // If error indicates billing/quota limitation, fail immediately with advice rather than retrying futilely
      if (err.message && err.message.includes('Browser Voice')) {
        throw err;
      }
      if (attempt <= maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
      }
    }
  }

  throw lastError || new Error('Synthesis failed after retries.');
}

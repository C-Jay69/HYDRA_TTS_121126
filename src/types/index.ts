export type ChunkStatus = 'pending' | 'processing' | 'ready' | 'error';

export interface Chunk {
  id: number;
  text: string;
  status: ChunkStatus;
  audioUrl: string | null;
  duration: number; // Duration in seconds
  charCount: number;
  wordCount: number;
  retryCount: number;
  errorMessage?: string;
  audioBlob?: Blob;
}

export interface ManuscriptMeta {
  fileName: string;
  fileSize: number;
  fileType: string;
  rawTextLength: number;
  totalWords: number;
  estimatedReadingMinutes: number;
  totalChunks: number;
  uploadedAt: Date;
  isLegacyDocWarning?: boolean;
}

export interface VoiceOption {
  id: string;
  name: string;
  gender: 'Female' | 'Male' | 'Neutral';
  style: string;
  description: string;
  recommendedFor: string;
}

export type SynthesisEngine = 'kokoro' | 'gemini' | 'webspeech';

export interface TTSConfig {
  voice: string;
  engine: SynthesisEngine;
  stylePrompt: string;
  speed: number;
  concurrency: number;
}

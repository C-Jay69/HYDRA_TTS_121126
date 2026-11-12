import { Chunk } from '../types';

let cachedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!cachedAudioContext) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    cachedAudioContext = new AudioCtx();
  }
  if (cachedAudioContext.state === 'suspended') {
    cachedAudioContext.resume().catch(() => {});
  }
  return cachedAudioContext;
}

/**
 * Encodes an AudioBuffer into a standard 16-bit PCM RIFF WAV Blob.
 */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = buffer.length * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  // Helper to write ASCII strings
  function writeString(offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  // RIFF Chunk Descriptor
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');

  // "fmt " sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, format, true); // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // "data" sub-chunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave and quantize channel PCM samples to 16-bit signed integers
  let offset = 44;
  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channelData.push(buffer.getChannelData(ch));
  }

  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channelData[ch][i]));
      // Convert float [-1.0, 1.0] to 16-bit signed integer [-32768, 32767]
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([view], { type: 'audio/wav' });
}

/**
 * Merges multiple ready chunks into a single gapless WAV Audio file.
 */
export async function stitchChunksToAudiobookWav(
  chunks: Chunk[],
  onProgress?: (percent: number, current: number, total: number) => void
): Promise<Blob> {
  const readyChunks = chunks.filter((c) => c.status === 'ready' && c.audioUrl);
  if (readyChunks.length === 0) {
    throw new Error('No ready audio chunks found to stitch.');
  }

  const audioCtx = getAudioContext();
  const decodedBuffers: AudioBuffer[] = [];

  for (let i = 0; i < readyChunks.length; i++) {
    const chunk = readyChunks[i];
    onProgress?.(Math.round(((i + 1) / readyChunks.length) * 50), i + 1, readyChunks.length);

    try {
      const response = await fetch(chunk.audioUrl!);
      const arrayBuffer = await response.arrayBuffer();
      // Decode audio data (copies buffer to prevent detach issues)
      const decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
      decodedBuffers.push(decoded);
    } catch (err) {
      console.error(`Failed to decode audio for chunk ${chunk.id}:`, err);
    }
  }

  if (decodedBuffers.length === 0) {
    throw new Error('Could not decode any of the audio chunks.');
  }

  // Calculate master properties
  const targetSampleRate = decodedBuffers[0].sampleRate;
  const targetChannels = Math.max(...decodedBuffers.map((b) => b.numberOfChannels));
  const totalLength = decodedBuffers.reduce((sum, buf) => sum + buf.length, 0);

  const stitchedBuffer = audioCtx.createBuffer(targetChannels, totalLength, targetSampleRate);

  // Copy channel data
  for (let ch = 0; ch < targetChannels; ch++) {
    const masterChannelData = stitchedBuffer.getChannelData(ch);
    let currentOffset = 0;

    for (let i = 0; i < decodedBuffers.length; i++) {
      const buf = decodedBuffers[i];
      const sourceChannel = Math.min(ch, buf.numberOfChannels - 1);
      const bufData = buf.getChannelData(sourceChannel);
      masterChannelData.set(bufData, currentOffset);
      currentOffset += buf.length;
    }
  }

  onProgress?.(85, readyChunks.length, readyChunks.length);

  // Encode to 16-bit WAV Blob
  const wavBlob = audioBufferToWavBlob(stitchedBuffer);
  onProgress?.(100, readyChunks.length, readyChunks.length);

  return wavBlob;
}

/**
 * Triggers a browser download of a given Blob.
 */
export function triggerFileDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Downloads a single chunk audio file.
 */
export async function downloadSingleChunk(chunk: Chunk, manuscriptTitle = 'manuscript'): Promise<void> {
  if (!chunk.audioUrl) return;

  const safeTitle = manuscriptTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${safeTitle}_part_${String(chunk.id).padStart(3, '0')}.wav`;

  try {
    const res = await fetch(chunk.audioUrl);
    const blob = await res.blob();
    triggerFileDownload(blob, filename);
  } catch (err) {
    console.error('Failed to download chunk:', err);
  }
}

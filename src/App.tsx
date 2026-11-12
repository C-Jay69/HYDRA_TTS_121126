/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { UploadZone } from './components/UploadZone';
import { TelemetryDashboard } from './components/TelemetryDashboard';
import { DocWarningBanner } from './components/DocWarningBanner';
import { ScriptReader } from './components/ScriptReader';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { parseManuscriptFile } from './utils/fileParser';
import { smartChunkManuscript } from './utils/chunker';
import { 
  stitchChunksToAudiobookWav, 
  downloadSingleChunk, 
  triggerFileDownload 
} from './utils/audioConcatenator';
import { hydraStudioBg, hydraMeshBg } from './assets/images';
import { 
  synthesizeChunk, 
  GEMINI_VOICES, 
  NARRATION_STYLES 
} from './services/ttsService';
import { SampleManuscript } from './data/sampleManuscripts';
import { Chunk, ManuscriptMeta, SynthesisEngine } from './types';

export default function App() {
  // Manuscript & Chunks State
  const [meta, setMeta] = useState<ManuscriptMeta | null>(null);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showDocWarning, setShowDocWarning] = useState(false);

  // Settings & Voice Configuration
  const [selectedVoice, setSelectedVoice] = useState<string>('Kore');
  const [selectedStyle, setSelectedStyle] = useState<string>(NARRATION_STYLES[0].prompt);
  const [engine, setEngine] = useState<SynthesisEngine>('gemini');

  // Batch Queue & Worker State
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  const isCancelledRef = useRef(false);

  // Full Audiobook Stitching State
  const [isStitching, setIsStitching] = useState(false);
  const [stitchingProgress, setStitchingProgress] = useState(0);

  // Playback State
  const [activeChunkId, setActiveChunkId] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  // Track created Object URLs for memory cleanup
  const createdUrlsRef = useRef<Set<string>>(new Set());

  // Keep ref synchronized with state for async worker loops
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Clean up all object URLs on unmount
  useEffect(() => {
    return () => {
      createdUrlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch (_) {}
      });
      createdUrlsRef.current.clear();
    };
  }, []);

  // Helper to safely store an Object URL for later revocation
  const registerObjectUrl = (url: string) => {
    createdUrlsRef.current.add(url);
  };

  // Reset manuscript
  const handleReset = useCallback(() => {
    // Revoke all existing chunk audio URLs to prevent memory leaks
    createdUrlsRef.current.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch (_) {}
    });
    createdUrlsRef.current.clear();

    setIsSynthesizing(false);
    setIsPaused(false);
    isCancelledRef.current = true;
    setIsPlaying(false);
    setActiveChunkId(null);
    setMeta(null);
    setChunks([]);
    setUploadError(null);
    setShowDocWarning(false);
  }, []);

  // Handle uploaded manuscript file
  const handleFileSelected = async (file: File) => {
    setIsLoadingFile(true);
    setUploadError(null);
    isCancelledRef.current = false;

    try {
      const parsed = await parseManuscriptFile(file);
      const generatedChunks = smartChunkManuscript(parsed.text);

      if (generatedChunks.length === 0) {
        throw new Error('No readable paragraphs or text could be chunked from this file.');
      }

      const totalWords = parsed.wordCount;
      const readingMinutes = Math.max(1, Math.round(totalWords / 150));

      setMeta({
        fileName: file.name,
        fileSize: file.size,
        fileType: file.name.split('.').pop()?.toUpperCase() || 'DOCUMENT',
        rawTextLength: parsed.charCount,
        totalWords,
        estimatedReadingMinutes: readingMinutes,
        totalChunks: generatedChunks.length,
        uploadedAt: new Date(),
        isLegacyDocWarning: parsed.isLegacyDocWarning,
      });

      setShowDocWarning(parsed.isLegacyDocWarning);
      setChunks(generatedChunks);
      setActiveChunkId(generatedChunks[0].id);
    } catch (err: any) {
      console.error('File parsing error:', err);
      setUploadError(err.message || 'Failed to parse file.');
    } finally {
      setIsLoadingFile(false);
    }
  };

  // Handle sample manuscript selection
  const handleSampleSelected = (sample: SampleManuscript) => {
    setIsLoadingFile(true);
    setUploadError(null);
    isCancelledRef.current = false;

    try {
      const generatedChunks = smartChunkManuscript(sample.text);
      const totalWords = (sample.text.match(/\b\S+\b/g) || []).length;
      const readingMinutes = Math.max(1, Math.round(totalWords / 150));

      setMeta({
        fileName: sample.filename,
        fileSize: sample.text.length,
        fileType: 'TXT',
        rawTextLength: sample.text.length,
        totalWords,
        estimatedReadingMinutes: readingMinutes,
        totalChunks: generatedChunks.length,
        uploadedAt: new Date(),
        isLegacyDocWarning: false,
      });

      setShowDocWarning(false);
      setChunks(generatedChunks);
      setActiveChunkId(generatedChunks[0].id);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to load sample.');
    } finally {
      setIsLoadingFile(false);
    }
  };

  // Synthesize single chunk
  const synthesizeSingleChunk = async (chunkId: number) => {
    setChunks((prev) =>
      prev.map((c) =>
        c.id === chunkId ? { ...c, status: 'processing', errorMessage: undefined } : c
      )
    );

    const targetChunk = chunks.find((c) => c.id === chunkId);
    if (!targetChunk) return;

    try {
      const result = await synthesizeChunk(
        engine,
        targetChunk.text,
        selectedVoice,
        selectedStyle,
        2
      );
      registerObjectUrl(result.audioUrl);

      setChunks((prev) =>
        prev.map((c) =>
          c.id === chunkId
            ? {
                ...c,
                status: 'ready',
                audioUrl: result.audioUrl,
                audioBlob: result.audioBlob,
                duration: result.duration,
                errorMessage: undefined,
              }
            : c
        )
      );
    } catch (err: any) {
      console.error(`Chunk ${chunkId} error:`, err);
      setChunks((prev) =>
        prev.map((c) =>
          c.id === chunkId
            ? {
                ...c,
                status: 'error',
                errorMessage: err.message || 'Synthesis failed. Click retry.',
              }
            : c
        )
      );
    }
  };

  // Sequential / Batched Queue Worker
  // Concurrency limit of 2 to balance throughput and prevent rate-limiting
  const startSynthesisQueue = async () => {
    setIsSynthesizing(true);
    setIsPaused(false);
    isPausedRef.current = false;
    isCancelledRef.current = false;

    const concurrency = 2;
    let activeTasks = 0;

    const getNextCandidate = (currentChunks: Chunk[]) => {
      return currentChunks.find(
        (c) => c.status === 'pending' || (c.status === 'error' && c.retryCount < 2)
      );
    };

    const processNext = async () => {
      if (isCancelledRef.current) return;

      while (isPausedRef.current) {
        if (isCancelledRef.current) return;
        await new Promise((r) => setTimeout(r, 400));
      }

      if (isCancelledRef.current) return;

      let candidate: Chunk | undefined;
      setChunks((prev) => {
        candidate = getNextCandidate(prev);
        if (!candidate) return prev;
        return prev.map((c) =>
          c.id === candidate!.id
            ? { ...c, status: 'processing', errorMessage: undefined }
            : c
        );
      });

      if (!candidate) {
        return;
      }

      const chunkToProcess = candidate;
      activeTasks++;

      try {
        const result = await synthesizeChunk(
          engine,
          chunkToProcess.text,
          selectedVoice,
          selectedStyle,
          2
        );
        registerObjectUrl(result.audioUrl);

        setChunks((prev) =>
          prev.map((c) =>
            c.id === chunkToProcess.id
              ? {
                  ...c,
                  status: 'ready',
                  audioUrl: result.audioUrl,
                  audioBlob: result.audioBlob,
                  duration: result.duration,
                  errorMessage: undefined,
                }
              : c
          )
        );

        // If player has no active chunk or active chunk isn't ready yet, set this as active
        setActiveChunkId((currentActive) => {
          if (!currentActive) return chunkToProcess.id;
          return currentActive;
        });
      } catch (err: any) {
        console.error(`Queue item ${chunkToProcess.id} failed:`, err);
        setChunks((prev) =>
          prev.map((c) =>
            c.id === chunkToProcess.id
              ? {
                  ...c,
                  status: 'error',
                  retryCount: (c.retryCount || 0) + 1,
                  errorMessage: err.message || 'TTS generation failed. Click Retry.',
                }
              : c
          )
        );
      } finally {
        activeTasks--;
        if (!isCancelledRef.current) {
          processNext();
        }
      }
    };

    // Spawn workers up to concurrency
    const workers: Promise<void>[] = [];
    for (let i = 0; i < concurrency; i++) {
      workers.push(processNext());
    }

    await Promise.allSettled(workers);

    // Keep checking until no more items are processing or pending
    const checkInterval = setInterval(() => {
      setChunks((latestChunks) => {
        const hasPending = latestChunks.some(
          (c) => c.status === 'processing' || c.status === 'pending'
        );
        if (!hasPending || isCancelledRef.current) {
          clearInterval(checkInterval);
          setIsSynthesizing(false);
        }
        return latestChunks;
      });
    }, 500);
  };

  // Queue Controls
  const pauseSynthesisQueue = () => {
    setIsPaused(true);
    isPausedRef.current = true;
  };

  const resumeSynthesisQueue = () => {
    setIsPaused(false);
    isPausedRef.current = false;
    if (!isSynthesizing) {
      startSynthesisQueue();
    }
  };

  const cancelSynthesisQueue = () => {
    isCancelledRef.current = true;
    setIsSynthesizing(false);
    setIsPaused(false);
    isPausedRef.current = false;

    // Reset currently processing chunks back to pending
    setChunks((prev) =>
      prev.map((c) => (c.status === 'processing' ? { ...c, status: 'pending' } : c))
    );
  };

  // Playback Navigation & Gapless Sequential Auto-Advance
  const currentActiveChunk = chunks.find((c) => c.id === activeChunkId) || null;

  const playChunk = (chunkId: number) => {
    const chunk = chunks.find((c) => c.id === chunkId);
    if (chunk && chunk.status === 'ready' && chunk.audioUrl) {
      setActiveChunkId(chunkId);
      setIsPlaying(true);

      if (engine === 'webspeech' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(chunk.text);
        u.rate = playbackSpeed;
        window.speechSynthesis.speak(u);
      }
    }
  };

  const pausePlayback = () => {
    setIsPlaying(false);
    if (engine === 'webspeech' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.pause();
    }
  };

  const playPreviousChunk = () => {
    if (!activeChunkId) return;
    const currentIndex = chunks.findIndex((c) => c.id === activeChunkId);
    if (currentIndex > 0) {
      const prevChunk = chunks[currentIndex - 1];
      if (prevChunk.status === 'ready') {
        playChunk(prevChunk.id);
      } else {
        setActiveChunkId(prevChunk.id);
      }
    }
  };

  const playNextChunk = () => {
    if (!activeChunkId) return;
    const currentIndex = chunks.findIndex((c) => c.id === activeChunkId);
    if (currentIndex >= 0 && currentIndex < chunks.length - 1) {
      const nextChunk = chunks[currentIndex + 1];
      if (nextChunk.status === 'ready') {
        playChunk(nextChunk.id);
      } else {
        setActiveChunkId(nextChunk.id);
      }
    }
  };

  // Gapless sequential playback: when onEnded triggers, automatically play next chunk!
  const handleChunkEnded = () => {
    if (engine === 'webspeech' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    if (!activeChunkId) return;
    const currentIndex = chunks.findIndex((c) => c.id === activeChunkId);
    if (currentIndex >= 0 && currentIndex < chunks.length - 1) {
      const nextChunk = chunks[currentIndex + 1];
      if (nextChunk.status === 'ready' && nextChunk.audioUrl) {
        // Gapless seamless transition to next chunk
        playChunk(nextChunk.id);
      } else {
        setIsPlaying(false);
      }
    } else {
      // Reached end of manuscript
      setIsPlaying(false);
    }
  };

  // Audio Stitching & Full Audiobook WAV Export
  const handleDownloadFullAudiobook = async () => {
    if (isStitching) return;
    setIsStitching(true);
    setStitchingProgress(0);

    try {
      const wavBlob = await stitchChunksToAudiobookWav(chunks, (percent) => {
        setStitchingProgress(percent);
      });

      const safeName = (meta?.fileName || 'manuscript')
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_');

      triggerFileDownload(wavBlob, `${safeName}_Full_Audiobook.wav`);
    } catch (err: any) {
      console.error('Audiobook stitching error:', err);
      alert(`Could not stitch audiobook: ${err.message || 'AudioContext error'}`);
    } finally {
      setIsStitching(false);
      setStitchingProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200 relative overflow-x-hidden">
      {/* Full-Page Atmospheric Studio Background Images */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Dark Studio Acoustic Wave Wallpaper */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-20 mix-blend-luminosity filter blur-[0.5px]"
          style={{ backgroundImage: `url(${hydraStudioBg})` }}
        />
        {/* Subtle Hydra Constellation Accent in Top Corner */}
        <div 
          className="absolute -top-12 -right-12 w-[600px] h-[600px] bg-contain bg-no-repeat bg-right-top opacity-15 mix-blend-screen pointer-events-none"
          style={{ backgroundImage: `url(${hydraMeshBg})` }}
        />
        {/* Smooth Obsidian Studio Vignette Gradients */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/85 via-slate-950/90 to-slate-950 pointer-events-none" />
      </div>

      {/* Studio Header */}
      <div className="relative z-20">
        <Header
          selectedVoice={selectedVoice}
          onVoiceChange={setSelectedVoice}
          selectedStyle={selectedStyle}
          onStyleChange={setSelectedStyle}
          engine={engine}
          onEngineChange={setEngine}
          onReset={handleReset}
          hasManuscript={Boolean(meta)}
        />
      </div>

      {/* Main Studio Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-32 relative z-10">
        {!meta ? (
          /* File Ingestion & Parsing Zone */
          <UploadZone
            onFileSelected={handleFileSelected}
            onSampleSelected={handleSampleSelected}
            isLoading={isLoadingFile}
            errorMessage={uploadError}
            onDismissError={() => setUploadError(null)}
          />
        ) : (
          /* Manuscript Workspace */
          <div className="space-y-6">
            {/* Legacy .doc warning banner */}
            {showDocWarning && (
              <DocWarningBanner onDismiss={() => setShowDocWarning(false)} />
            )}

            {/* Telemetry Dashboard */}
            <TelemetryDashboard
              meta={meta}
              chunks={chunks}
              isSynthesizing={isSynthesizing}
              isPaused={isPaused}
              onStartSynthesis={startSynthesisQueue}
              onPauseSynthesis={pauseSynthesisQueue}
              onResumeSynthesis={resumeSynthesisQueue}
              onCancelSynthesis={cancelSynthesisQueue}
              onDownloadFullAudiobook={handleDownloadFullAudiobook}
              isStitching={isStitching}
              stitchingProgress={stitchingProgress}
            />

            {/* Interactive Script View */}
            <ScriptReader
              chunks={chunks}
              activeChunkId={activeChunkId}
              isPlaying={isPlaying}
              onPlayChunk={playChunk}
              onPauseChunk={pausePlayback}
              onRetryChunk={synthesizeSingleChunk}
              onSynthesizeSingleChunk={synthesizeSingleChunk}
              onDownloadChunk={(chunk) =>
                downloadSingleChunk(chunk, meta.fileName.replace(/\.[^/.]+$/, ''))
              }
            />
          </div>
        )}
      </main>

      {/* Gapless Audio Player Bar */}
      {currentActiveChunk && currentActiveChunk.audioUrl && (
        <AudioPlayerBar
          currentChunk={currentActiveChunk}
          chunks={chunks}
          isPlaying={isPlaying}
          onPlay={() => setIsPlaying(true)}
          onPause={pausePlayback}
          onPreviousChunk={playPreviousChunk}
          onNextChunk={playNextChunk}
          onChunkEnded={handleChunkEnded}
          speed={playbackSpeed}
          onSpeedChange={setPlaybackSpeed}
          onDownloadCurrent={() =>
            downloadSingleChunk(
              currentActiveChunk,
              (meta?.fileName || 'manuscript').replace(/\.[^/.]+$/, '')
            )
          }
          manuscriptTitle={meta?.fileName || 'Manuscript'}
        />
      )}
    </div>
  );
}

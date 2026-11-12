import React from 'react';
import { 
  FileText, 
  Clock, 
  Layers, 
  Sparkles, 
  Play, 
  Pause, 
  Square, 
  Download, 
  CheckCircle2, 
  AlertTriangle,
  RotateCw,
  Loader2
} from 'lucide-react';
import { ManuscriptMeta, Chunk } from '../types';

interface TelemetryDashboardProps {
  meta: ManuscriptMeta;
  chunks: Chunk[];
  isSynthesizing: boolean;
  isPaused: boolean;
  onStartSynthesis: () => void;
  onPauseSynthesis: () => void;
  onResumeSynthesis: () => void;
  onCancelSynthesis: () => void;
  onDownloadFullAudiobook: () => void;
  isStitching: boolean;
  stitchingProgress: number;
}

export const TelemetryDashboard: React.FC<TelemetryDashboardProps> = ({
  meta,
  chunks,
  isSynthesizing,
  isPaused,
  onStartSynthesis,
  onPauseSynthesis,
  onResumeSynthesis,
  onCancelSynthesis,
  onDownloadFullAudiobook,
  isStitching,
  stitchingProgress,
}) => {
  const totalChunks = chunks.length;
  const readyChunks = chunks.filter((c) => c.status === 'ready').length;
  const processingChunks = chunks.filter((c) => c.status === 'processing').length;
  const errorChunks = chunks.filter((c) => c.status === 'error').length;
  const pendingChunks = chunks.filter((c) => c.status === 'pending').length;

  const percentComplete = totalChunks > 0 ? Math.round((readyChunks / totalChunks) * 100) : 0;

  // Calculate total audio duration generated so far
  const totalAudioDurationSec = chunks
    .filter((c) => c.status === 'ready')
    .reduce((sum, c) => sum + (c.duration || 0), 0);

  const formatAudioTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  };

  const isComplete = readyChunks === totalChunks && totalChunks > 0;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 mb-6 shadow-xl backdrop-blur-sm">
      {/* Top File & Global Actions Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-100 text-base sm:text-lg tracking-tight truncate max-w-md">
              {meta.fileName}
            </span>
            <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/60">
              {meta.fileType}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Target chunk size: 1,500 – 2,500 characters • Paragraph & sentence boundary protected
          </p>
        </div>

        {/* Global Batch Synthesis & Export Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {!isSynthesizing && !isPaused && !isComplete && (
            <button
              onClick={onStartSynthesis}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Synthesize All ({totalChunks} Chunks)</span>
            </button>
          )}

          {isSynthesizing && !isPaused && (
            <button
              onClick={onPauseSynthesis}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-amber-600/90 hover:bg-amber-600 text-white shadow-lg shadow-amber-600/20 transition-all"
            >
              <Pause className="w-4 h-4 fill-current" />
              <span>Pause Queue</span>
            </button>
          )}

          {isPaused && (
            <button
              onClick={onResumeSynthesis}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 transition-all"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Resume Queue</span>
            </button>
          )}

          {(isSynthesizing || isPaused) && (
            <button
              onClick={onCancelSynthesis}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-red-950/80 text-slate-300 hover:text-red-300 border border-slate-700 hover:border-red-800/80 transition-colors"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Cancel</span>
            </button>
          )}

          {/* Download Full Audiobook Button */}
          <button
            onClick={onDownloadFullAudiobook}
            disabled={readyChunks === 0 || isStitching}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              readyChunks > 0 && !isStitching
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transform hover:scale-[1.02]'
                : 'bg-slate-800/60 text-slate-500 border border-slate-800 cursor-not-allowed'
            }`}
            title={
              readyChunks === 0
                ? 'Synthesize at least one chunk to download'
                : `Stitch and download ${readyChunks} ready audio chunk${readyChunks > 1 ? 's' : ''} into a single .wav file`
            }
          >
            {isStitching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Stitching Audio ({stitchingProgress}%)...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download Full Audiobook (.wav)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Real-time Telemetry Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 my-4">
        {/* Word Count */}
        <div className="p-3 bg-slate-950/60 border border-slate-800/70 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] uppercase tracking-wider font-semibold">Total Words</span>
            <FileText className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-100">
            {meta.totalWords.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            {meta.rawTextLength.toLocaleString()} chars
          </span>
        </div>

        {/* Estimated Reading Time */}
        <div className="p-3 bg-slate-950/60 border border-slate-800/70 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] uppercase tracking-wider font-semibold">Est. Reading Time</span>
            <Clock className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-100">
            ~{meta.estimatedReadingMinutes} min
          </div>
          <span className="text-[11px] text-slate-500">at 150 words/min</span>
        </div>

        {/* Smart Chunks Generated */}
        <div className="p-3 bg-slate-950/60 border border-slate-800/70 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] uppercase tracking-wider font-semibold">Smart Chunks</span>
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-xl font-bold font-mono text-indigo-300">
            {totalChunks}
          </div>
          <span className="text-[11px] text-slate-500">avg ~{Math.round(meta.rawTextLength / (totalChunks || 1))} chars/chunk</span>
        </div>

        {/* Generated Audio Time */}
        <div className="p-3 bg-slate-950/60 border border-slate-800/70 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] uppercase tracking-wider font-semibold">Synthesized Audio</span>
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-300">
            {formatAudioTime(totalAudioDurationSec)}
          </div>
          <span className="text-[11px] text-slate-500">
            {readyChunks} of {totalChunks} parts ready
          </span>
        </div>
      </div>

      {/* Synthesis Progress Bar */}
      <div className="mt-4 pt-3 border-t border-slate-800/60">
        <div className="flex items-center justify-between text-xs mb-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">Synthesis Progress:</span>
            <span className="font-mono text-indigo-400 font-bold">
              {readyChunks} / {totalChunks} chunks completed ({percentComplete}%)
            </span>
            {isSynthesizing && !isPaused && (
              <span className="inline-flex items-center gap-1 text-[11px] text-indigo-400 animate-pulse font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                Synthesizing batch...
              </span>
            )}
            {isPaused && (
              <span className="text-[11px] text-amber-400 font-medium">
                (Queue paused)
              </span>
            )}
          </div>

          {/* Status Breakdown Pills */}
          <div className="hidden sm:flex items-center gap-3 text-[11px] font-mono text-slate-400">
            {readyChunks > 0 && (
              <span className="flex items-center gap-1 text-emerald-400">
                <CheckCircle2 className="w-3 h-3" />
                {readyChunks} ready
              </span>
            )}
            {processingChunks > 0 && (
              <span className="flex items-center gap-1 text-indigo-400">
                <RotateCw className="w-3 h-3 animate-spin" />
                {processingChunks} active
              </span>
            )}
            {errorChunks > 0 && (
              <span className="flex items-center gap-1 text-red-400">
                <AlertTriangle className="w-3 h-3" />
                {errorChunks} failed
              </span>
            )}
            {pendingChunks > 0 && (
              <span className="text-slate-500">{pendingChunks} pending</span>
            )}
          </div>
        </div>

        {/* Progress Track */}
        <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800 relative">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 via-indigo-400 to-emerald-400 transition-all duration-300 rounded-full"
            style={{ width: `${percentComplete}%` }}
          />
        </div>
      </div>
    </div>
  );
};

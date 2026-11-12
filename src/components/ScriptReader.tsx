import React, { useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  Download, 
  RotateCw, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Volume2, 
  Copy, 
  Check, 
  Search,
  Sparkles,
  FileText
} from 'lucide-react';
import { Chunk } from '../types';

interface ScriptReaderProps {
  chunks: Chunk[];
  activeChunkId: number | null;
  isPlaying: boolean;
  onPlayChunk: (chunkId: number) => void;
  onPauseChunk: () => void;
  onRetryChunk: (chunkId: number) => void;
  onSynthesizeSingleChunk: (chunkId: number) => void;
  onDownloadChunk: (chunk: Chunk) => void;
}

export const ScriptReader: React.FC<ScriptReaderProps> = ({
  chunks,
  activeChunkId,
  isPlaying,
  onPlayChunk,
  onPauseChunk,
  onRetryChunk,
  onSynthesizeSingleChunk,
  onDownloadChunk,
}) => {
  const activeChunkRef = useRef<HTMLDivElement>(null);
  const [copiedChunkId, setCopiedChunkId] = React.useState<number | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');

  // Auto-scroll to active chunk when it changes
  useEffect(() => {
    if (activeChunkId && activeChunkRef.current) {
      activeChunkRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [activeChunkId]);

  const handleCopy = (chunk: Chunk) => {
    navigator.clipboard.writeText(chunk.text);
    setCopiedChunkId(chunk.id);
    setTimeout(() => setCopiedChunkId(null), 2000);
  };

  const filteredChunks = searchQuery.trim()
    ? chunks.filter((c) => c.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : chunks;

  const formatDuration = (secs: number) => {
    if (!secs) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl flex flex-col shadow-xl overflow-hidden">
      {/* Script Header Bar */}
      <div className="px-5 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-400" />
          <h3 className="font-bold text-slate-100 text-sm sm:text-base">
            Manuscript Script & Audio Chunks
          </h3>
          <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
            {chunks.length} parts
          </span>
        </div>

        {/* Quick Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search manuscript text..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Chunk List Container */}
      <div className="divide-y divide-slate-800/80 max-h-[640px] overflow-y-auto p-4 sm:p-5 space-y-4">
        {filteredChunks.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            No chunks match your search query "{searchQuery}".
          </div>
        ) : (
          filteredChunks.map((chunk) => {
            const isActive = activeChunkId === chunk.id;
            const isChunkPlaying = isActive && isPlaying;
            const isReady = chunk.status === 'ready';
            const isProcessing = chunk.status === 'processing';
            const isError = chunk.status === 'error';
            const isPending = chunk.status === 'pending';

            return (
              <div
                key={chunk.id}
                ref={isActive ? activeChunkRef : null}
                onClick={() => {
                  if (isReady) {
                    if (isChunkPlaying) {
                      onPauseChunk();
                    } else {
                      onPlayChunk(chunk.id);
                    }
                  }
                }}
                className={`rounded-xl p-4 sm:p-5 transition-all duration-200 cursor-pointer relative border ${
                  isActive
                    ? 'bg-indigo-950/30 border-indigo-500/80 ring-2 ring-indigo-500/30 shadow-lg shadow-indigo-950/50'
                    : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700 hover:bg-slate-950/80'
                }`}
              >
                {/* Chunk Card Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    {/* Part Number Badge */}
                    <span
                      className={`font-mono text-xs font-bold px-2.5 py-1 rounded-md border ${
                        isActive
                          ? 'bg-indigo-600 text-white border-indigo-400'
                          : 'bg-slate-800/80 text-slate-300 border-slate-700/80'
                      }`}
                    >
                      Chunk #{String(chunk.id).padStart(2, '0')}
                    </span>

                    {/* Status Badge */}
                    {isReady && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded">
                        <CheckCircle2 className="w-3 h-3" />
                        Ready ({formatDuration(chunk.duration)})
                      </span>
                    )}

                    {isProcessing && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-indigo-300 bg-indigo-950/80 border border-indigo-800/80 px-2 py-0.5 rounded animate-pulse">
                        <RotateCw className="w-3 h-3 animate-spin text-indigo-400" />
                        Synthesizing audio...
                      </span>
                    )}

                    {isPending && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-800/60 border border-slate-700/60 px-2 py-0.5 rounded">
                        <Clock className="w-3 h-3" />
                        Pending
                      </span>
                    )}

                    {isError && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-400 bg-red-950/80 border border-red-800/80 px-2 py-0.5 rounded">
                        <AlertCircle className="w-3 h-3" />
                        Failed
                      </span>
                    )}

                    {/* Word / Char Counters */}
                    <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                      {chunk.wordCount} words • {chunk.charCount.toLocaleString()} chars
                    </span>
                  </div>

                  {/* Actions on this chunk */}
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {/* Copy text button */}
                    <button
                      onClick={() => handleCopy(chunk)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors"
                      title="Copy chunk text"
                    >
                      {copiedChunkId === chunk.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Retry button if failed */}
                    {isError && (
                      <button
                        onClick={() => onRetryChunk(chunk.id)}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-red-900/60 hover:bg-red-900 text-red-200 border border-red-700 transition-colors"
                        title="Retry synthesis for this chunk"
                      >
                        <RotateCw className="w-3 h-3" />
                        <span>Retry</span>
                      </button>
                    )}

                    {/* Generate single chunk if pending */}
                    {isPending && (
                      <button
                        onClick={() => onSynthesizeSingleChunk(chunk.id)}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-indigo-900/40 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-700/60 transition-colors"
                        title="Synthesize this individual chunk"
                      >
                        <Sparkles className="w-3 h-3 text-indigo-400" />
                        <span>Synthesize Part</span>
                      </button>
                    )}

                    {/* Download single chunk audio */}
                    {isReady && chunk.audioUrl && (
                      <button
                        onClick={() => onDownloadChunk(chunk)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-emerald-950/40 transition-colors"
                        title={`Download Part #${chunk.id} (.wav)`}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Play / Pause button */}
                    {isReady && (
                      <button
                        onClick={() => {
                          if (isChunkPlaying) {
                            onPauseChunk();
                          } else {
                            onPlayChunk(chunk.id);
                          }
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          isChunkPlaying
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                            : 'bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white'
                        }`}
                      >
                        {isChunkPlaying ? (
                          <>
                            <Pause className="w-3 h-3 fill-current" />
                            <span>Playing</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3 fill-current" />
                            <span>Play</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Error Banner for Chunk */}
                {isError && chunk.errorMessage && (
                  <div className="mb-3 px-3 py-2 bg-red-950/70 border border-red-800/70 rounded-lg text-xs text-red-300">
                    {chunk.errorMessage}
                  </div>
                )}

                {/* Chunk Script Text */}
                <div
                  className={`text-sm leading-relaxed font-serif whitespace-pre-wrap select-text ${
                    isActive ? 'text-slate-100 font-medium' : 'text-slate-300'
                  }`}
                  style={{ fontFamily: "'Newsreader', Georgia, serif" }}
                >
                  {chunk.text}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

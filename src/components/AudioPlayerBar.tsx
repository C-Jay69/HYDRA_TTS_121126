import React, { useRef, useEffect, useState } from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  RotateCcw, 
  RotateCw, 
  Volume2, 
  VolumeX, 
  Download, 
  Sparkles,
  Layers,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { Chunk } from '../types';
import { WaveformVisualizer } from './WaveformVisualizer';

interface AudioPlayerBarProps {
  currentChunk: Chunk | null;
  chunks: Chunk[];
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onPreviousChunk: () => void;
  onNextChunk: () => void;
  onChunkEnded: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  onDownloadCurrent: () => void;
  manuscriptTitle: string;
}

const SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  currentChunk,
  chunks,
  isPlaying,
  onPlay,
  onPause,
  onPreviousChunk,
  onNextChunk,
  onChunkEnded,
  speed,
  onSpeedChange,
  onDownloadCurrent,
  manuscriptTitle,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.9);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeedOpen, setIsSpeedOpen] = useState(false);

  // Keep audioElement state in sync with ref for visualizer node connection
  useEffect(() => {
    if (audioRef.current && audioRef.current !== audioElement) {
      setAudioElement(audioRef.current);
    }
  }, [audioRef.current]);

  // Synchronize audio source when currentChunk changes
  useEffect(() => {
    if (audioRef.current && currentChunk?.audioUrl) {
      if (audioRef.current.src !== currentChunk.audioUrl) {
        audioRef.current.src = currentChunk.audioUrl;
        audioRef.current.load();
        if (isPlaying) {
          audioRef.current.play().catch((e) => console.log('Autoplay deferred:', e));
        }
      }
    }
  }, [currentChunk?.audioUrl]);

  // Synchronize play/pause
  useEffect(() => {
    if (!audioRef.current || !currentChunk?.audioUrl) return;

    if (isPlaying) {
      audioRef.current.play().catch((err) => {
        console.warn('Playback error:', err);
      });
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  // Synchronize speed
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, [speed]);

  // Synchronize volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || currentChunk?.duration || 0);
    }
  };

  const handleSeek = (newTime: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleSkipTime = (delta: number) => {
    if (audioRef.current) {
      const newTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + delta));
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const formatTime = (timeInSec: number) => {
    if (isNaN(timeInSec) || !isFinite(timeInSec)) return '0:00';
    const m = Math.floor(timeInSec / 60);
    const s = Math.floor(timeInSec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const currentIndex = currentChunk ? chunks.findIndex((c) => c.id === currentChunk.id) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < chunks.length - 1;

  if (!currentChunk || !currentChunk.audioUrl) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 border-t border-indigo-900/40 backdrop-blur-xl shadow-2xl transition-all">
      {/* Hidden Native Audio Element */}
      <audio
        ref={(el) => {
          audioRef.current = el;
          if (el && el !== audioElement) {
            setAudioElement(el);
          }
        }}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleTimeUpdate}
        onEnded={onChunkEnded}
        crossOrigin="anonymous"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        {/* Real-time Audio Visualization Waveform & Progress */}
        <div className="flex items-center gap-3 mb-2.5">
          <span className="text-[11px] font-mono font-semibold text-slate-300 w-12 text-right">
            {formatTime(currentTime)}
          </span>

          <div className="flex-1 min-w-0">
            <WaveformVisualizer
              audioElement={audioElement}
              isPlaying={isPlaying}
              currentTime={currentTime}
              duration={duration || currentChunk.duration || 1}
              onSeek={handleSeek}
            />
          </div>

          <span className="text-[11px] font-mono font-semibold text-slate-400 w-12 text-left">
            {formatTime(duration || currentChunk.duration || 0)}
          </span>
        </div>

        {/* Main Controls Grid */}
        <div className="flex items-center justify-between gap-4">
          {/* Left: Current Track Details */}
          <div className="flex items-center gap-3 min-w-0 max-w-[28%] sm:max-w-[33%]">
            <div className="relative w-10 h-10 rounded-xl bg-indigo-950/80 border border-indigo-700/60 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              {isPlaying && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-100 truncate">
                  Chunk #{String(currentChunk.id).padStart(2, '0')}
                </span>
                <span className="text-[10px] font-mono text-indigo-300 bg-indigo-950/70 border border-indigo-800/40 px-1.5 py-0.2 rounded">
                  Part {currentIndex + 1} of {chunks.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate mt-0.5 font-serif italic">
                "{currentChunk.text.slice(0, 50)}..."
              </p>
            </div>
          </div>

          {/* Center: Playback Transport Buttons */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {/* Skip Back 10s */}
            <button
              onClick={() => handleSkipTime(-10)}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-lg transition-colors hidden sm:inline-flex"
              title="Rewind 10 seconds"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Previous Chunk */}
            <button
              onClick={onPreviousChunk}
              disabled={!hasPrev}
              className={`p-2 rounded-lg transition-colors ${
                hasPrev
                  ? 'text-slate-300 hover:text-white hover:bg-slate-900'
                  : 'text-slate-600 cursor-not-allowed'
              }`}
              title="Previous Chunk"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            {/* Play/Pause Main Button */}
            <button
              onClick={() => (isPlaying ? onPause() : onPlay())}
              className="w-11 h-11 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 transform hover:scale-105 active:scale-95 transition-all"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>

            {/* Next Chunk */}
            <button
              onClick={onNextChunk}
              disabled={!hasNext}
              className={`p-2 rounded-lg transition-colors ${
                hasNext
                  ? 'text-slate-300 hover:text-white hover:bg-slate-900'
                  : 'text-slate-600 cursor-not-allowed'
              }`}
              title="Next Chunk"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            {/* Skip Forward 10s */}
            <button
              onClick={() => handleSkipTime(10)}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-lg transition-colors hidden sm:inline-flex"
              title="Forward 10 seconds"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          {/* Right: Audio Speed, Volume, Download Chunk */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {/* Speed Selector Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsSpeedOpen(!isSpeedOpen)}
                className="px-2.5 py-1 text-xs font-mono font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg flex items-center gap-1 transition-colors"
                title="Playback Speed"
              >
                <span>{speed}x</span>
                {isSpeedOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
              </button>

              {isSpeedOpen && (
                <div className="absolute bottom-full mb-2 right-0 bg-slate-900 border border-slate-800 rounded-lg shadow-xl p-1 z-50 flex flex-col gap-0.5 w-20">
                  {SPEED_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => {
                        onSpeedChange(opt);
                        setIsSpeedOpen(false);
                      }}
                      className={`px-2 py-1 text-xs font-mono rounded text-left transition-colors ${
                        speed === opt
                          ? 'bg-indigo-600 text-white font-bold'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {opt}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Volume Control */}
            <div className="hidden md:flex items-center gap-2">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="text-slate-400 hover:text-slate-200"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  setVolume(parseFloat(e.target.value));
                  if (isMuted) setIsMuted(false);
                }}
                className="w-16 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>

            {/* Download Part .wav */}
            <button
              onClick={onDownloadCurrent}
              className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-900 rounded-lg transition-colors"
              title="Download Current Part (.wav)"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

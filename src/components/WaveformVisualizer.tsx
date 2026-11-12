import React, { useRef, useEffect, useState, useCallback } from 'react';

interface WaveformVisualizerProps {
  audioElement: HTMLAudioElement | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
  audioElement,
  isPlaying,
  currentTime,
  duration,
  onSeek,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  // Mouse hover state for time preview
  const [hoverPosition, setHoverPosition] = useState<{ x: number; time: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Precomputed static waveform pattern so bars have realistic manuscript audio contours
  const staticPeaksRef = useRef<number[]>([]);

  // Generate static peak profile once
  useEffect(() => {
    const totalBars = 120;
    const peaks: number[] = [];
    for (let i = 0; i < totalBars; i++) {
      // Natural cadence contour combining sine harmonics with gentle variations
      const naturalRhythm =
        Math.sin(i * 0.12) * 0.25 +
        Math.sin(i * 0.28) * 0.2 +
        Math.cos(i * 0.05) * 0.15 +
        0.4;
      peaks.push(Math.max(0.15, Math.min(0.9, naturalRhythm)));
    }
    staticPeaksRef.current = peaks;
  }, []);

  // Initialize Web Audio AnalyserNode connected to the audio element
  const initWebAudio = useCallback(() => {
    if (!audioElement || sourceNodeRef.current) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;

      // MediaElementSource can only be created once per element
      const source = ctx.createMediaElementSource(audioElement);
      source.connect(analyser);
      analyser.connect(ctx.destination);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      audioContextRef.current = ctx;
      analyserRef.current = analyser;
      sourceNodeRef.current = source;
      dataArrayRef.current = dataArray;
    } catch (err) {
      // If already connected or browser restricted, handle gracefully
      console.warn('Web Audio Analyser notice:', err);
    }
  }, [audioElement]);

  // Ensure AudioContext is resumed when playback starts
  useEffect(() => {
    if (isPlaying) {
      initWebAudio();
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }
    }
  }, [isPlaying, initWebAudio]);

  // Main Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      // Handle High-DPI screens
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Get real-time frequency data if playing
      let liveFrequencies: Uint8Array | null = null;
      if (isPlaying && analyserRef.current && dataArrayRef.current) {
        analyserRef.current.getByteFrequencyData(dataArrayRef.current as any);
        liveFrequencies = dataArrayRef.current;
      }

      const totalBars = 96;
      const gap = 2;
      const barWidth = Math.max(2, (width - (totalBars - 1) * gap) / totalBars);
      const progressRatio = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
      const playheadX = progressRatio * width;

      const peaks = staticPeaksRef.current;

      for (let i = 0; i < totalBars; i++) {
        const x = i * (barWidth + gap);
        if (x > width) break;

        const isPlayed = x <= playheadX;
        const peakIndex = i % peaks.length;
        const baseHeightRatio = peaks[peakIndex] || 0.3;

        // Modulate with real-time audio frequencies if playing
        let dynamicBoost = 0;
        if (liveFrequencies && liveFrequencies.length > 0) {
          // Map bar index to frequency bin
          const binIndex = Math.floor((i / totalBars) * (liveFrequencies.length * 0.75));
          const freqValue = liveFrequencies[binIndex] || 0;
          dynamicBoost = (freqValue / 255) * 0.6;
        }

        const totalHeightRatio = Math.max(0.1, Math.min(0.95, baseHeightRatio + dynamicBoost));
        const barHeight = Math.max(3, totalHeightRatio * (height - 6));
        const y = (height - barHeight) / 2;

        // Styling: Played vs Unplayed with gradient
        if (isPlayed) {
          // Played bars: Radiant Indigo to Sky Blue gradient
          const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
          gradient.addColorStop(0, '#a5b4fc'); // indigo-300
          gradient.addColorStop(0.5, '#6366f1'); // indigo-500
          gradient.addColorStop(1, '#38bdf8'); // sky-400
          ctx.fillStyle = gradient;
        } else {
          // Unplayed bars: Subtle dark slate
          ctx.fillStyle = '#334155'; // slate-700
        }

        // Draw rounded bar
        const radius = barWidth / 2;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, barWidth, barHeight, radius);
        } else {
          ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.fill();
      }

      // Draw Playhead Indicator Line & Glowing Beacon
      if (progressRatio > 0 && progressRatio <= 1) {
        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, height);
        ctx.strokeStyle = '#818cf8'; // indigo-400
        ctx.lineWidth = 1.5;
        ctx.shadowColor = 'rgba(99, 102, 241, 0.8)';
        ctx.shadowBlur = 6;
        ctx.stroke();

        // Small top and bottom marker diamonds
        ctx.fillStyle = '#c7d2fe'; // indigo-200
        ctx.beginPath();
        ctx.arc(playheadX, 3, 2.5, 0, Math.PI * 2);
        ctx.arc(playheadX, height - 3, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw Hover Scrub Line if user is hovering
      if (hoverPosition) {
        ctx.beginPath();
        ctx.moveTo(hoverPosition.x, 0);
        ctx.lineTo(hoverPosition.x, height);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();
      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, currentTime, duration, hoverPosition]);

  // Handle Scrub Interactions
  const handleSeekFromEvent = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !duration) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const targetRatio = clickX / rect.width;
    const targetTime = targetRatio * duration;

    onSeek(targetTime);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    handleSeekFromEvent(e);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const time = duration ? (x / rect.width) * duration : 0;

    setHoverPosition({ x, time });

    if (isDragging) {
      handleSeekFromEvent(e);
    }
  };

  const handleMouseLeave = () => {
    setHoverPosition(null);
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const formatTooltipTime = (secs: number) => {
    if (isNaN(secs) || !isFinite(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="relative w-full group py-1">
      {/* Canvas Waveform */}
      <div className="relative w-full h-10 sm:h-12 bg-slate-950/70 border border-slate-800/80 rounded-xl overflow-hidden cursor-pointer hover:border-indigo-500/50 transition-colors shadow-inner">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          className="w-full h-full block"
        />

        {/* Hover Time Tooltip */}
        {hoverPosition && (
          <div
            className="absolute top-1 -translate-x-1/2 pointer-events-none px-1.5 py-0.5 rounded bg-slate-900 border border-indigo-500/50 text-[10px] font-mono font-semibold text-indigo-300 shadow-lg"
            style={{ left: `${hoverPosition.x}px` }}
          >
            {formatTooltipTime(hoverPosition.time)}
          </div>
        )}
      </div>

      {/* Subtle Bottom Indicators */}
      <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 px-1 mt-1">
        <span className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-indigo-400 animate-pulse' : 'bg-slate-600'}`} />
          <span>Real-time Analyser (256 FFT)</span>
        </span>
        <span>Click or drag waveform to scrub</span>
      </div>
    </div>
  );
};

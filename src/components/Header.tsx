import React from 'react';
import { 
  Headphones, 
  Sparkles, 
  SlidersHorizontal, 
  Mic2, 
  RotateCcw,
  Cpu,
  Globe
} from 'lucide-react';
import { VoiceOption, SynthesisEngine } from '../types';
import { NARRATION_STYLES, voicesForEngine } from '../services/ttsService';

const ENGINE_BADGES: Record<SynthesisEngine, string> = {
  kokoro: 'kokoro-82m · local',
  gemini: 'gemini-3.8-flash-tts',
  webspeech: 'browser speech',
};

interface HeaderProps {
  selectedVoice: string;
  onVoiceChange: (voice: string) => void;
  selectedStyle: string;
  onStyleChange: (style: string) => void;
  engine: SynthesisEngine;
  onEngineChange: (engine: SynthesisEngine) => void;
  onReset: () => void;
  hasManuscript: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  selectedVoice,
  onVoiceChange,
  selectedStyle,
  onStyleChange,
  engine,
  onEngineChange,
  onReset,
  hasManuscript,
}) => {
  return (
    <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
        {/* Logo & Title */}
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/30 flex-shrink-0">
            <Headphones className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-slate-100 text-lg tracking-tight truncate">
                HYDRA <span className="text-cyan-400">TTS</span>
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-950/80 text-cyan-300 border border-cyan-800/50">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                {ENGINE_BADGES[engine]}
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate hidden md:block">
              Intelligent manuscript chunking & gapless audiobook synthesis studio
            </p>
          </div>
        </div>

        {/* Studio Controls */}
        <div className="flex items-center gap-2.5 sm:gap-4 flex-shrink-0">
          {/* Engine Selector */}
          <div className="flex items-center bg-slate-900 border border-slate-800 p-0.5 rounded-lg">
            <button
              onClick={() => onEngineChange('kokoro')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                engine === 'kokoro'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Use Kokoro-82M running locally on this machine"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kokoro (Local)</span>
            </button>
            <button
              onClick={() => onEngineChange('gemini')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                engine === 'gemini'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Use Gemini 3.8 Flash TTS Neural Voice"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Gemini TTS</span>
            </button>
            <button
              onClick={() => onEngineChange('webspeech')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                engine === 'webspeech'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Use Browser Voice (Zero-Cost / Offline)"
            >
              <Globe className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Browser Voice (Free)</span>
            </button>
          </div>

          {/* Voice Selector */}
          <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-lg">
            <Mic2 className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            <div className="flex flex-col text-left">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Narrator Voice</span>
              <select
                value={selectedVoice}
                onChange={(e) => onVoiceChange(e.target.value)}
                className="bg-transparent text-xs text-slate-200 font-medium focus:outline-none cursor-pointer pr-1"
                aria-label="Select Narrator Voice"
              >
                {voicesForEngine(engine).map((v) => (
                  <option key={v.id} value={v.id} className="bg-slate-900 text-slate-200">
                    {v.name} ({v.gender} - {v.recommendedFor})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Style Selector */}
          <div className="hidden lg:flex items-center gap-2 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-lg">
            <SlidersHorizontal className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            <div className="flex flex-col text-left">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                {engine === 'kokoro' ? 'Pacing Style' : 'Narration Style'}
              </span>
              <select
                value={selectedStyle}
                onChange={(e) => onStyleChange(e.target.value)}
                className="bg-transparent text-xs text-slate-200 font-medium focus:outline-none cursor-pointer pr-1"
                aria-label="Select Narration Style"
                title={
                  engine === 'kokoro'
                    ? 'Kokoro has no style prompts; each style maps to a natural speaking pace'
                    : undefined
                }
              >
                {NARRATION_STYLES.map((s) => (
                  <option key={s.id} value={s.prompt} className="bg-slate-900 text-slate-200">
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Reset / New Manuscript Button */}
          {hasManuscript && (
            <button
              onClick={onReset}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-lg transition-colors"
              title="Upload new manuscript or clear current"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">New File</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

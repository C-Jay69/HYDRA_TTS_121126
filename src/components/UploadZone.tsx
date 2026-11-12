import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  FileText, 
  AlertCircle, 
  Sparkles, 
  BookOpen, 
  ShieldAlert, 
  CheckCircle2, 
  ArrowRight,
  FileCode2,
  FileCheck
} from 'lucide-react';
import { SAMPLE_MANUSCRIPTS, SampleManuscript } from '../data/sampleManuscripts';
import { MAX_FILE_SIZE_BYTES } from '../utils/fileParser';
import { hydraStudioBg, hydraMeshBg } from '../assets/images';

interface UploadZoneProps {
  onFileSelected: (file: File) => void;
  onSampleSelected: (sample: SampleManuscript) => void;
  isLoading: boolean;
  errorMessage: string | null;
  onDismissError: () => void;
}

export const UploadZone: React.FC<UploadZoneProps> = ({
  onFileSelected,
  onSampleSelected,
  isLoading,
  errorMessage,
  onDismissError,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayError = errorMessage || localError;

  const validateAndProcess = (file: File) => {
    setLocalError(null);
    onDismissError();

    // 5 MB Hard Limit Check
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      setLocalError(
        `File rejected: Size (${sizeMb} MB) exceeds the maximum allowed 5 MB limit. Please upload a smaller document.`
      );
      return;
    }

    // Supported extensions: txt, md, docx, pdf, doc
    const extension = file.name.split('.').pop()?.toLowerCase();
    const allowed = ['txt', 'md', 'docx', 'pdf', 'doc'];
    if (!extension || !allowed.includes(extension)) {
      setLocalError(
        `Unsupported file format ".${extension || 'unknown'}". Allowed formats: .txt, .md, .docx, .pdf, and .doc`
      );
      return;
    }

    onFileSelected(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndProcess(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndProcess(e.target.files[0]);
      e.target.value = ''; // Reset input to allow selecting same file again if desired
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      {/* Hero Intro */}
      <div className="text-center mb-8 relative">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-800/40 text-cyan-300 text-xs font-semibold mb-3">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>HYDRA TTS • Neural Audio Engine</span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-100 tracking-tight">
          HYDRA <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-indigo-400 to-indigo-300">TTS</span> Studio
        </h2>
        <p className="mt-3 text-sm sm:text-base text-slate-300 max-w-2xl mx-auto">
          Convert manuscripts, books, and essays into full audiobooks using deterministic smart chunking and local Kokoro-82M speech synthesis.
        </p>
      </div>

      {/* Error Banner */}
      {displayError && (
        <div className="mb-6 bg-red-950/80 border border-red-800/80 rounded-xl p-4 flex items-start gap-3 text-red-200 text-sm shadow-lg shadow-red-950/40 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold block text-red-100">Upload Error</span>
            <p className="mt-0.5 text-xs sm:text-sm text-red-300">{displayError}</p>
          </div>
          <button
            onClick={() => {
              setLocalError(null);
              onDismissError();
            }}
            className="text-red-400 hover:text-red-200 text-xs font-semibold px-2 py-1 rounded hover:bg-red-900/50"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Upload Drop Zone Card with Atmospheric Background Image */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-14 text-center cursor-pointer transition-all duration-300 overflow-hidden ${
          isDragOver
            ? 'border-cyan-400 bg-cyan-950/40 ring-4 ring-cyan-500/20 scale-[1.01]'
            : 'border-slate-800 hover:border-cyan-500/50 bg-slate-900/50 hover:bg-slate-900/80'
        }`}
      >
        {/* Background Image Layer with Dark Overlay */}
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center opacity-25 mix-blend-luminosity filter saturate-150 transition-opacity duration-300 pointer-events-none"
          style={{ backgroundImage: `url(${hydraStudioBg})` }}
        />
        <div className="absolute inset-0 z-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-slate-950/60 pointer-events-none" />

        {/* Content over background */}
        <div className="relative z-10">
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.docx,.pdf,.doc,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
            className="hidden"
            onChange={handleFileInputChange}
            disabled={isLoading}
          />

          <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-900/90 border border-cyan-500/40 flex items-center justify-center text-cyan-400 mb-4 shadow-xl ring-2 ring-cyan-500/10 group-hover:scale-105 transition-transform backdrop-blur-sm">
            {isLoading ? (
              <div className="w-8 h-8 border-3 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <UploadCloud className="w-8 h-8 text-cyan-400" />
            )}
          </div>

          <h3 className="text-xl font-bold text-slate-100 tracking-tight">
            {isLoading ? 'Extracting & Parsing Manuscript...' : 'Drop your manuscript into HYDRA TTS, or click to browse'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-md mx-auto">
            Client-side parsing ensures your raw file never leaves your browser until audio synthesis.
          </p>

          {/* Supported Format Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
            <span className="px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-slate-900/90 text-slate-300 border border-slate-700/80 backdrop-blur-sm">
              .TXT
            </span>
            <span className="px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-slate-900/90 text-slate-300 border border-slate-700/80 backdrop-blur-sm">
              .MD
            </span>
            <span className="px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-slate-900/90 text-slate-300 border border-slate-700/80 backdrop-blur-sm">
              .DOCX
            </span>
            <span className="px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-slate-900/90 text-slate-300 border border-slate-700/80 backdrop-blur-sm">
              .PDF
            </span>
            <span className="px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-slate-900/90 text-slate-300 border border-slate-700/80 backdrop-blur-sm">
              .DOC
            </span>
            <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 backdrop-blur-sm">
              Max 5 MB
            </span>
          </div>
        </div>
      </div>

      {/* Instant Demo Manuscripts */}
      <div className="mt-10">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-4 h-4 text-indigo-400" />
          <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Or test with a sample manuscript excerpt:
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {SAMPLE_MANUSCRIPTS.map((sample) => (
            <button
              key={sample.id}
              onClick={() => onSampleSelected(sample)}
              disabled={isLoading}
              className="text-left p-4 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-indigo-500/40 transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-[11px] font-mono text-indigo-400">{sample.genre}</span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {sample.text.length.toLocaleString()} chars
                  </span>
                </div>
                <h5 className="font-semibold text-slate-200 text-sm group-hover:text-white group-hover:translate-x-0.5 transition-transform">
                  {sample.title}
                </h5>
                <p className="text-xs text-slate-400 mt-0.5">by {sample.author}</p>
                <p className="text-xs text-slate-500 line-clamp-2 mt-2 leading-relaxed">
                  {sample.text.slice(0, 120)}...
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-medium text-indigo-400 mt-4 group-hover:text-indigo-300">
                <span>Load & Chunk Excerpt</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

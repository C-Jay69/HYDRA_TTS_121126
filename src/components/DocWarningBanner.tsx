import React from 'react';
import { AlertCircle, FileWarning, X } from 'lucide-react';

interface DocWarningBannerProps {
  onDismiss: () => void;
}

export const DocWarningBanner: React.FC<DocWarningBannerProps> = ({ onDismiss }) => {
  return (
    <div className="mb-6 bg-amber-950/40 border border-amber-800/60 rounded-xl p-4 flex items-start gap-3.5 text-amber-200 text-sm shadow-md backdrop-blur-sm animate-in fade-in">
      <FileWarning className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <h4 className="font-semibold text-amber-100 text-xs sm:text-sm">
          Legacy Binary Word Document (.doc) Notice
        </h4>
        <p className="mt-0.5 text-xs text-amber-300 leading-relaxed">
          Best-effort binary ASCII extraction was applied to this legacy file. If you notice unusual characters, broken symbols, or formatting artifacts, we recommend saving your manuscript as modern <strong className="text-amber-100">.docx</strong> or <strong className="text-amber-100">.txt</strong> for pristine fidelity.
        </p>
      </div>
      <button
        onClick={onDismiss}
        className="text-amber-400/80 hover:text-amber-200 p-1 rounded hover:bg-amber-900/40 transition-colors"
        title="Dismiss warning"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

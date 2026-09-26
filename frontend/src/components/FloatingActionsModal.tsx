import React, { useState, useEffect } from 'react';
import { Sparkles, Copy, Bookmark, X, Check, CornerDownLeft } from 'lucide-react';
import { HighlightData } from '../types';

interface FloatingActionsModalProps {
  highlight: HighlightData;
  onAskAi: (highlight: HighlightData) => void;
  onCopy: (highlight: HighlightData) => void;
  onSaveForLater: (highlight: HighlightData) => void;
  onDismiss: () => void;
}

export const FloatingActionsModal: React.FC<FloatingActionsModalProps> = ({
  highlight,
  onAskAi,
  onCopy,
  onSaveForLater,
  onDismiss,
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const options = [
    {
      id: 'ask_ai',
      key: '1',
      title: 'Ask AI about...',
      description: 'Expand, confirm, or research based on this transcription',
      icon: Sparkles,
      iconColor: 'text-purple-400',
      action: () => onAskAi(highlight),
    },
    {
      id: 'copy',
      key: '2',
      title: 'Copy to Clipboard',
      description: 'Copy highlighted fragment text directly to clipboard',
      icon: Copy,
      iconColor: 'text-blue-400',
      action: () => onCopy(highlight),
    },
    {
      id: 'save',
      key: '3',
      title: 'Save for later',
      description: 'Archive fragment in the side panel to navigate back later',
      icon: Bookmark,
      iconColor: 'text-emerald-400',
      action: () => onSaveForLater(highlight),
    },
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === '1') {
        e.preventDefault();
        onAskAi(highlight);
      } else if (e.key === '2') {
        e.preventDefault();
        onCopy(highlight);
      } else if (e.key === '3') {
        e.preventDefault();
        onSaveForLater(highlight);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onDismiss();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % options.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + options.length) % options.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        options[selectedIndex].action();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [highlight, selectedIndex]);

  // Truncate preview text
  const previewText = highlight.text.length > 120 ? highlight.text.slice(0, 120) + '...' : highlight.text;

  return (
    <div className="absolute bottom-20 left-3 right-3 z-40 animate-in fade-in slide-in-from-bottom-3 duration-200">
      <div className="bg-[#141416]/95 backdrop-blur-md border border-purple-500/30 rounded-xl shadow-2xl overflow-hidden p-3.5 flex flex-col gap-2.5">
        {/* Header with preview */}
        <div className="flex items-start justify-between gap-2 border-b border-zinc-800/80 pb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-300 mb-0.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Highlighted Passage</span>
              <span className="text-[10px] text-zinc-400 font-normal">
                ({highlight.speaker === 'me' ? 'You' : 'Caller'})
              </span>
            </div>
            <p className="text-xs text-zinc-300 italic truncate" title={highlight.text}>
              "{previewText}"
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="text-zinc-400 hover:text-zinc-200 p-1 rounded hover:bg-zinc-800 transition-colors"
            title="Skip (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Options list */}
        <div className="flex flex-col gap-1.5">
          {options.map((opt, idx) => {
            const Icon = opt.icon;
            const isSelected = selectedIndex === idx;
            return (
              <button
                key={opt.id}
                onClick={opt.action}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all group ${
                  isSelected
                    ? 'bg-purple-600/20 border border-purple-500/40 text-white'
                    : 'bg-zinc-900/60 border border-zinc-800/60 text-zinc-300 hover:bg-zinc-800/60'
                }`}
              >
                {/* Keyboard Shortcut badge */}
                <div
                  className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold font-mono transition-colors ${
                    isSelected
                      ? 'bg-purple-500 text-white'
                      : 'bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700 group-hover:text-zinc-200'
                  }`}
                >
                  {opt.key}
                </div>

                <Icon className={`w-4 h-4 shrink-0 ${opt.iconColor}`} />

                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium">{opt.title}</div>
                  <div className="text-[10px] text-zinc-400 truncate">{opt.description}</div>
                </div>

                {isSelected && <Check className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Bottom footer: Skip & Submit */}
        <div className="flex items-center justify-between pt-1 border-t border-zinc-800/80 text-[11px] text-zinc-400">
          <button
            onClick={onDismiss}
            className="px-2.5 py-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Skip <span className="font-mono text-[9px] opacity-70">(Esc)</span>
          </button>

          <button
            onClick={() => options[selectedIndex].action()}
            className="flex items-center gap-1.5 px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded font-medium shadow-sm transition-colors text-xs"
          >
            <span>Submit</span>
            <CornerDownLeft className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

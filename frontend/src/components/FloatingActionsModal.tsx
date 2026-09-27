import React, { useState, useEffect } from 'react';
import { Sparkles, Copy, Bookmark, X, Check, CornerDownLeft, Camera, Trash2 } from 'lucide-react';
import { HighlightData, ScreenshotData } from '../types';

interface FloatingActionsModalProps {
  highlight?: HighlightData | null;
  screenshot?: ScreenshotData | null;
  onAskAi: (item: HighlightData | ScreenshotData) => void;
  onViewAiThread?: (item: HighlightData | ScreenshotData) => void;
  onCopy: (item: HighlightData | ScreenshotData) => void;
  onSaveForLater?: (highlight: HighlightData) => void;
  onDeleteScreenshot?: (screenshot: ScreenshotData) => void;
  onDeselectHighlight?: (highlight: HighlightData) => void;
  onDismiss: () => void;
}

export const FloatingActionsModal: React.FC<FloatingActionsModalProps> = ({
  highlight,
  screenshot,
  onAskAi,
  onViewAiThread,
  onCopy,
  onSaveForLater,
  onDeleteScreenshot,
  onDeselectHighlight,
  onDismiss,
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const isScreenshot = Boolean(screenshot);
  const hasAiResponse = Boolean(isScreenshot ? screenshot?.ai_response : highlight?.ai_response);

  const options = isScreenshot
    ? [
        {
          id: hasAiResponse ? 'view_thread' : 'explain_image',
          key: '1',
          title: hasAiResponse ? 'View AI Thread' : 'Explain this image using AI...',
          description: hasAiResponse
            ? 'Open AI visual analysis and reasoning trace in side panel'
            : 'Multimodal analysis of visual layout, UI, errors, code, and text',
          icon: Sparkles,
          iconColor: 'text-purple-400',
          action: () => {
            if (!screenshot) return;
            if (hasAiResponse && onViewAiThread) {
              onViewAiThread(screenshot);
            } else {
              onAskAi(screenshot);
            }
          },
        },
        {
          id: 'copy_image',
          key: '2',
          title: 'Copy to Clipboard',
          description: 'Copy original full-resolution image to Windows clipboard',
          icon: Copy,
          iconColor: 'text-blue-400',
          action: () => screenshot && onCopy(screenshot),
        },
        {
          id: 'delete_screenshot',
          key: '3',
          title: 'Delete Screenshot',
          description: 'Erase image from chat, delete file from disk, and discard AI research',
          icon: Trash2,
          iconColor: 'text-red-400',
          action: () => screenshot && onDeleteScreenshot && onDeleteScreenshot(screenshot),
        },
      ]
    : [
        {
          id: hasAiResponse ? 'view_thread' : 'ask_ai',
          key: '1',
          title: hasAiResponse ? 'View AI Thread' : 'Ask AI about...',
          description: hasAiResponse
            ? 'Open saved AI research and explanation in side panel'
            : 'Expand, confirm, or research based on this transcription',
          icon: Sparkles,
          iconColor: 'text-purple-400',
          action: () => {
            if (!highlight) return;
            if (hasAiResponse && onViewAiThread) {
              onViewAiThread(highlight);
            } else {
              onAskAi(highlight);
            }
          },
        },
        {
          id: 'copy',
          key: '2',
          title: 'Copy to Clipboard',
          description: 'Copy highlighted fragment text directly to clipboard',
          icon: Copy,
          iconColor: 'text-blue-400',
          action: () => highlight && onCopy(highlight),
        },
        {
          id: 'save',
          key: '3',
          title: 'Save for later',
          description: 'Archive fragment in the side panel to navigate back later',
          icon: Bookmark,
          iconColor: 'text-emerald-400',
          action: () => highlight && onSaveForLater?.(highlight),
        },
        {
          id: 'deselect_highlight',
          key: '4',
          title: 'De-select Highlight',
          description: 'Remove highlight from passage and erase any saved AI research',
          icon: Trash2,
          iconColor: 'text-rose-400',
          action: () => highlight && onDeselectHighlight?.(highlight),
        },
      ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === '1') {
        e.preventDefault();
        options[0]?.action();
      } else if (e.key === '2') {
        e.preventDefault();
        options[1]?.action();
      } else if (e.key === '3' && options[2]) {
        e.preventDefault();
        options[2].action();
      } else if (e.key === '4' && options[3]) {
        e.preventDefault();
        options[3].action();
      } else if (e.key === 'Delete' && !isScreenshot && options[3]) {
        e.preventDefault();
        options[3].action();
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
        options[selectedIndex]?.action();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [highlight, screenshot, selectedIndex, options, isScreenshot]);

  return (
    <div className="absolute bottom-20 left-3 right-3 z-40 animate-in fade-in slide-in-from-bottom-3 duration-200">
      <div className="bg-[#141416]/95 backdrop-blur-md border border-purple-500/30 rounded-xl shadow-2xl overflow-hidden p-3.5 flex flex-col gap-2.5">
        {/* Header Preview */}
        <div className="flex items-start justify-between gap-2 border-b border-zinc-800/80 pb-2">
          {isScreenshot && screenshot ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={screenshot.thumbnail_url}
                alt="Captured Snapshot"
                className="w-12 h-9 object-cover rounded border border-zinc-700 shrink-0 shadow"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-300">
                  <Camera className="w-3.5 h-3.5 text-purple-400" />
                  <span className="truncate">Visual Snapshot ({screenshot.target_title})</span>
                </div>
                <div className="text-[10px] text-zinc-400">
                  {screenshot.width} × {screenshot.height} px • Ready for AI explanation
                </div>
              </div>
            </div>
          ) : highlight ? (
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-300 mb-0.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>Highlighted Passage</span>
                <span className="text-[10px] text-zinc-400 font-normal">
                  ({highlight.speaker === 'me' ? 'You' : 'Caller'})
                </span>
              </div>
              <p className="text-xs text-zinc-300 italic truncate" title={highlight.text}>
                "{highlight.text.length > 120 ? highlight.text.slice(0, 120) + '...' : highlight.text}"
              </p>
            </div>
          ) : null}

          <button
            onClick={onDismiss}
            className="text-zinc-400 hover:text-zinc-200 p-1 rounded hover:bg-zinc-800 transition-colors shrink-0"
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
            onClick={() => options[selectedIndex]?.action()}
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

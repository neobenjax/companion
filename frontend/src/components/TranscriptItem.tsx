import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Copy, X } from 'lucide-react';
import { TranscriptSegment, HighlightData } from '../types';
import { pywebviewService } from '../services/pywebview';

interface TranscriptItemProps {
  segment: TranscriptSegment;
  highlights?: HighlightData[];
  onHighlightClick?: (highlight: HighlightData) => void;
  onManualHighlight?: (messageId: string, text: string, speaker: 'caller' | 'me', timestamp: number) => void;
  messageId?: string;
}

interface ContextMenuPosition {
  x: number;
  y: number;
  text: string;
}

export const TranscriptItem: React.FC<TranscriptItemProps> = ({
  segment,
  highlights = [],
  onHighlightClick,
  onManualHighlight,
  messageId,
}) => {
  const [contextMenu, setContextMenu] = useState<ContextMenuPosition | null>(null);
  const textRef = useRef<HTMLParagraphElement>(null);

  const isMe = segment.speaker === 'me';
  const timeStr = new Date(segment.timestamp * 1000).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  // Filter highlights applicable to this segment / message
  const segHighlights = highlights.filter(
    (h) => h.messageId === segment.id || (messageId && h.messageId === messageId)
  );

  // Close context menu on Escape key
  useEffect(() => {
    if (!contextMenu) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [contextMenu]);

  // Handle right-click text selection within single turn
  const handleContextMenu = (e: React.MouseEvent) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText) {
      return;
    }

    if (textRef.current) {
      const range = selection.getRangeAt(0);
      // Ensure the selection is strictly clamped within this turn's text container
      if (
        textRef.current.contains(range.startContainer) &&
        textRef.current.contains(range.endContainer)
      ) {
        e.preventDefault();
        e.stopPropagation();

        const menuWidth = 190;
        const menuHeight = 130;
        const x = Math.min(e.clientX, window.innerWidth - menuWidth - 10);
        const y = Math.min(e.clientY, window.innerHeight - menuHeight - 10);

        setContextMenu({
          x: Math.max(10, x),
          y: Math.max(10, y),
          text: selectedText,
        });
      }
    }
  };

  const handleContextHighlight = () => {
    if (!contextMenu) return;
    const textToHighlight = contextMenu.text;
    window.getSelection()?.removeAllRanges();
    setContextMenu(null);
    onManualHighlight?.(
      messageId || segment.id,
      textToHighlight,
      segment.speaker,
      segment.timestamp
    );
  };

  const handleContextCopy = async () => {
    if (!contextMenu) return;
    const textToCopy = contextMenu.text;
    window.getSelection()?.removeAllRanges();
    setContextMenu(null);
    try {
      await pywebviewService.copyToClipboard(textToCopy);
    } catch (e) {
      console.error('Failed to copy to clipboard:', e);
    }
  };

  const handleContextCancel = () => {
    setContextMenu(null);
  };

  // Render text with highlights
  const renderHighlightedContent = () => {
    if (!segHighlights || segHighlights.length === 0) {
      return <span>{segment.text}</span>;
    }

    const fullText = segment.text;
    // Find all occurrences of highlights in text
    interface Slice {
      start: number;
      end: number;
      highlight?: HighlightData;
      text: string;
    }

    // Locate each highlight in the string
    const matchRanges: { start: number; end: number; hl: HighlightData }[] = [];
    for (const hl of segHighlights) {
      const idx = fullText.lastIndexOf(hl.text);
      if (idx !== -1) {
        matchRanges.push({ start: idx, end: idx + hl.text.length, hl });
      }
    }

    if (matchRanges.length === 0) {
      return <span>{segment.text}</span>;
    }

    // Sort by start index
    matchRanges.sort((a, b) => a.start - b.start);

    const slices: Slice[] = [];
    let currentPos = 0;

    for (const range of matchRanges) {
      if (range.start < currentPos) {
        // Skip overlapping range to prevent corrupted rendering
        continue;
      }
      if (range.start > currentPos) {
        slices.push({
          start: currentPos,
          end: range.start,
          text: fullText.slice(currentPos, range.start),
        });
      }
      slices.push({
        start: range.start,
        end: range.end,
        highlight: range.hl,
        text: fullText.slice(range.start, range.end),
      });
      currentPos = range.end;
    }

    if (currentPos < fullText.length) {
      slices.push({
        start: currentPos,
        end: fullText.length,
        text: fullText.slice(currentPos),
      });
    }

    return (
      <>
        {slices.map((slice, i) => {
          if (!slice.highlight) {
            return <span key={i}>{slice.text}</span>;
          }

          const hl = slice.highlight;
          const isCaller = hl.speaker === 'caller';

          return (
            <mark
              key={hl.id || i}
              onClick={(e) => {
                e.stopPropagation();
                onHighlightClick?.(hl);
              }}
              className={`font-bold cursor-pointer rounded px-1 py-0.5 transition-all inline mx-0.5 select-text ${
                isCaller
                  ? 'bg-emerald-500/20 text-emerald-300 border-b-2 border-emerald-400 hover:bg-emerald-500/35 hover:text-emerald-100 shadow-sm'
                  : 'bg-purple-500/20 text-purple-300 border-b-2 border-purple-400 hover:bg-purple-500/35 hover:text-purple-100 shadow-sm'
              }`}
              title="Click to view AI Thread or actions"
            >
              {slice.text}
              {hl.ai_response && (
                <span className="inline-flex items-center ml-1 text-purple-300 align-middle">
                  <Sparkles className="w-3 h-3 inline text-purple-400 animate-pulse" />
                </span>
              )}
            </mark>
          );
        })}
      </>
    );
  };

  return (
    <div
      id={`msg-${segment.id}`}
      className="group px-3 py-1.5 rounded-lg text-xs transition-all duration-300 hover:bg-zinc-900/60 border border-transparent select-none relative"
    >
      <div className="flex items-center justify-between space-x-2 mb-0.5 select-none">
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase select-none ${
            isMe
              ? 'bg-purple-950/80 text-purple-300 border border-purple-800/50'
              : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50'
          }`}
        >
          {isMe ? 'You' : 'Caller'}
        </span>
        <span className="text-[10px] text-zinc-500 opacity-60 group-hover:opacity-100 transition select-none">
          {timeStr}
        </span>
      </div>
      <p
        ref={textRef}
        onContextMenu={handleContextMenu}
        className="text-zinc-300 leading-relaxed text-xs pl-0.5 select-text"
      >
        {renderHighlightedContent()}
      </p>

      {/* Context Menu Popup for Manual Text Selection */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu(null);
            }}
          />
          <div
            style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
            className="fixed z-50 min-w-[170px] bg-zinc-900/95 border border-zinc-700/80 rounded-xl shadow-2xl backdrop-blur-md p-1 animate-in fade-in zoom-in-95 duration-100 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-2.5 py-1 text-[10px] text-zinc-400 font-medium border-b border-zinc-800/80 mb-1 truncate max-w-[200px]">
              "{contextMenu.text}"
            </div>
            <button
              onClick={handleContextHighlight}
              className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-zinc-200 hover:text-purple-200 hover:bg-purple-600/20 text-left transition"
            >
              <Sparkles size={13} className="text-purple-400" />
              <span className="font-medium">Highlight</span>
            </button>
            <button
              onClick={handleContextCopy}
              className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-zinc-200 hover:text-blue-200 hover:bg-blue-600/20 text-left transition"
            >
              <Copy size={13} className="text-blue-400" />
              <span>Copy to Clipboard</span>
            </button>
            <button
              onClick={handleContextCancel}
              className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 text-left transition border-t border-zinc-800/60 mt-1"
            >
              <X size={13} className="text-zinc-500" />
              <span>Cancel</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

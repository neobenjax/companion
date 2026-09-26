import React from 'react';
import { Sparkles } from 'lucide-react';
import { TranscriptSegment, HighlightData } from '../types';

interface TranscriptItemProps {
  segment: TranscriptSegment;
  highlights?: HighlightData[];
  onHighlightClick?: (highlight: HighlightData) => void;
  messageId?: string;
}

export const TranscriptItem: React.FC<TranscriptItemProps> = ({
  segment,
  highlights = [],
  onHighlightClick,
  messageId,
}) => {
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
      className="group px-3 py-1.5 rounded-lg text-xs transition-all duration-300 hover:bg-zinc-900/60 border border-transparent"
    >
      <div className="flex items-center justify-between space-x-2 mb-0.5">
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase ${
            isMe
              ? 'bg-purple-950/80 text-purple-300 border border-purple-800/50'
              : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50'
          }`}
        >
          {isMe ? 'You' : 'Caller'}
        </span>
        <span className="text-[10px] text-zinc-500 opacity-60 group-hover:opacity-100 transition">
          {timeStr}
        </span>
      </div>
      <p className="text-zinc-300 leading-relaxed text-xs pl-0.5">
        {renderHighlightedContent()}
      </p>
    </div>
  );
};

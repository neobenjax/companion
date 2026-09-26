import React, { useState } from 'react';
import { 
  Sparkles, 
  ArrowLeft, 
  X, 
  Copy, 
  Check, 
  Bookmark, 
  ExternalLink, 
  Trash2,
  ChevronDown,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { HighlightData } from '../types';

interface ThreadSidepanelProps {
  highlights: HighlightData[];
  activeHighlightId: string | null;
  isLoadingAi: boolean;
  onSelectHighlight: (highlight: HighlightData) => void;
  onBackToHighlights: () => void;
  onClose: () => void;
  onJumpToTranscript: (messageId: string) => void;
  onDeleteHighlight: (highlightId: string) => void;
}

export const ThreadSidepanel: React.FC<ThreadSidepanelProps> = ({
  highlights,
  activeHighlightId,
  isLoadingAi,
  onSelectHighlight,
  onBackToHighlights,
  onClose,
  onJumpToTranscript,
  onDeleteHighlight,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showThought, setShowThought] = useState<boolean>(true);

  const activeHighlight = highlights.find((h) => h.id === activeHighlightId);
  const savedHighlights = highlights.filter((h) => h.is_saved || h.ai_response);

  const handleCopyText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      console.error('Failed to copy', e);
    }
  };

  return (
    <div className="w-[400px] h-full flex flex-col bg-[#0f0f12] border-l border-zinc-800 shrink-0 select-none">
      {/* Top Header */}
      <div className="h-12 border-b border-zinc-800/80 px-4 flex items-center justify-between bg-[#141418]">
        {activeHighlight ? (
          <button
            onClick={onBackToHighlights}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Saved Highlights</span>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-semibold text-zinc-200">Saved Highlights</span>
            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full font-mono">
              {savedHighlights.length}
            </span>
          </div>
        )}

        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-zinc-200 p-1.5 rounded-md hover:bg-zinc-800 transition-colors"
          title="Close panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {activeHighlight ? (
          /* --- AI Thread View --- */
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Highlighted Quote Excerpt */}
            <div className="bg-zinc-900/80 border-l-2 border-purple-500 rounded-r-lg p-3 text-xs text-zinc-200 space-y-1.5 shadow-sm">
              <div className="flex items-center justify-between text-[10px] text-zinc-400">
                <span className="font-semibold uppercase tracking-wider text-purple-400">
                  {activeHighlight.speaker === 'me' ? 'You' : 'Caller'}
                </span>
                <button
                  onClick={() => onJumpToTranscript(activeHighlight.messageId)}
                  className="hover:text-purple-300 flex items-center gap-1 transition-colors"
                  title="Scroll to position in chat"
                >
                  <span>Jump to chat</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
              <p className="italic leading-relaxed font-sans">"{activeHighlight.text}"</p>
            </div>

            {/* AI Thought Process Trace (if available) */}
            {activeHighlight.thought && (
              <div className="border border-zinc-800 rounded-lg overflow-hidden bg-[#16161a]">
                <button
                  onClick={() => setShowThought(!showThought)}
                  className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                    <span>Reasoning Trace</span>
                  </div>
                  {showThought ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
                {showThought && (
                  <div className="px-3 py-2 text-xs text-zinc-400 border-t border-zinc-800/80 font-mono text-[11px] leading-relaxed whitespace-pre-wrap bg-black/20">
                    {activeHighlight.thought}
                  </div>
                )}
              </div>
            )}

            {/* AI Response Card */}
            <div className="bg-[#18181f] border border-zinc-800 rounded-xl p-4 shadow-lg space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-purple-600/20 flex items-center justify-center text-purple-400">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-zinc-100">Antigravity Copilot</div>
                    <div className="text-[10px] text-zinc-400">Research & Context Expansion</div>
                  </div>
                </div>

                {activeHighlight.ai_response && (
                  <button
                    onClick={() => handleCopyText(activeHighlight.ai_response!, 'thread_copy')}
                    className="flex items-center gap-1 px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs transition-colors"
                    title="Copy AI response"
                  >
                    {copiedId === 'thread_copy' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-[10px] text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span className="text-[10px]">Copy</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {isLoadingAi ? (
                <div className="py-8 flex flex-col items-center justify-center gap-3 text-zinc-400">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                  <p className="text-xs">Analyzing and expanding with Antigravity Agent...</p>
                </div>
              ) : activeHighlight.ai_response ? (
                <div className="text-xs text-zinc-200 leading-relaxed font-sans whitespace-pre-wrap">
                  {activeHighlight.ai_response}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-zinc-400">
                  No AI explanation generated yet for this highlight.
                </div>
              )}
            </div>
          </div>
        ) : (
          /* --- Saved Highlights List View --- */
          <div className="space-y-2.5">
            {savedHighlights.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <Bookmark className="w-8 h-8 text-zinc-700 mx-auto" />
                <p className="text-xs font-medium text-zinc-400">No saved highlights yet</p>
                <p className="text-[11px] text-zinc-400 max-w-[240px] mx-auto leading-normal">
                  Press your global shortcut or click <span className="text-purple-400">Highlight</span> while listening to mark passages, save them, or ask AI about them.
                </p>
              </div>
            ) : (
              savedHighlights.map((hl) => (
                <div
                  key={hl.id}
                  className="bg-[#141418] hover:bg-[#1a1a20] border border-zinc-800 hover:border-zinc-700 rounded-xl p-3 space-y-2 transition-all group"
                >
                  <div className="flex items-center justify-between text-[10px]">
                    <span
                      className={`px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider ${
                        hl.speaker === 'me'
                          ? 'bg-purple-950/60 text-purple-300 border border-purple-800/40'
                          : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
                      }`}
                    >
                      {hl.speaker === 'me' ? 'You' : 'Caller'}
                    </span>

                    <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onJumpToTranscript(hl.messageId)}
                        className="text-zinc-400 hover:text-zinc-200 p-1 rounded hover:bg-zinc-800 transition-colors"
                        title="Jump to position in chat"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => onDeleteHighlight(hl.id)}
                        className="text-zinc-400 hover:text-red-400 p-1 rounded hover:bg-zinc-800 transition-colors"
                        title="Delete highlight"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <p
                    onClick={() => {
                      onJumpToTranscript(hl.messageId);
                      if (hl.ai_response) onSelectHighlight(hl);
                    }}
                    className="text-xs text-zinc-200 italic line-clamp-3 cursor-pointer hover:text-white transition-colors"
                  >
                    "{hl.text}"
                  </p>

                  <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60">
                    {hl.ai_response ? (
                      <button
                        onClick={() => onSelectHighlight(hl)}
                        className="flex items-center gap-1.5 text-[11px] text-purple-400 hover:text-purple-300 font-medium transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>View AI Thread</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => onSelectHighlight(hl)}
                        className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-purple-300 transition-colors"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Ask AI about this</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleCopyText(hl.text, hl.id)}
                      className="text-zinc-400 hover:text-zinc-200 p-1 rounded hover:bg-zinc-800 transition-colors"
                      title="Copy excerpt"
                    >
                      {copiedId === hl.id ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

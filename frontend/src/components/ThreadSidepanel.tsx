import React, { useState, useRef, useEffect } from 'react';
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
  Loader2,
  Camera,
  Monitor,
  AppWindow,
  Send
} from 'lucide-react';
import { HighlightData, ScreenshotData } from '../types';
import { pywebviewService } from '../services/pywebview';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ThreadSidepanelProps {
  highlights: HighlightData[];
  activeHighlightId: string | null;
  activeScreenshot?: ScreenshotData | null;
  isLoadingAi: boolean;
  sessionTitle?: string;
  width?: number;
  onResize?: (newWidth: number) => void;
  onResizeEnd?: (newWidth: number) => void;
  onSelectHighlight: (highlight: HighlightData) => void;
  onBackToHighlights: () => void;
  onClose: () => void;
  onJumpToTranscript: (messageId: string) => void;
  onDeleteHighlight: (highlightId: string) => void;
  onCopyImage?: (imagePath: string) => void;
  onAskVisionFollowup?: (screenshot: ScreenshotData, prompt: string) => void;
  fontSize?: number;
  onFontSizeChange?: (size: number) => void;
  onOpenPromptsModal?: () => void;
  hasCustomPrompts?: boolean;
}

export const ThreadSidepanel: React.FC<ThreadSidepanelProps> = ({
  highlights,
  activeHighlightId,
  activeScreenshot,
  isLoadingAi,
  sessionTitle,
  width = 420,
  onResize,
  onResizeEnd,
  onSelectHighlight,
  onBackToHighlights,
  onClose,
  onJumpToTranscript,
  onDeleteHighlight,
  onCopyImage,
  onAskVisionFollowup,
  fontSize = 13,
  onFontSizeChange,
  onOpenPromptsModal,
  hasCustomPrompts = false,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showThought, setShowThought] = useState<boolean>(true);
  const [followupPrompt, setFollowupPrompt] = useState<string>('');

  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(width);
  const currentWidthRef = useRef(width);

  useEffect(() => {
    currentWidthRef.current = width;
  }, [width]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = currentWidthRef.current;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const delta = startXRef.current - e.clientX;
    const nextWidth = Math.max(360, Math.min(800, startWidthRef.current + delta));
    currentWidthRef.current = nextWidth;
    onResize?.(nextWidth);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    onResizeEnd?.(currentWidthRef.current);
  };

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

  const handleCopyImageToClipboard = async (imagePath: string, id: string) => {
    try {
      if (onCopyImage) {
        onCopyImage(imagePath);
      } else {
        await pywebviewService.copyImageToClipboard(imagePath);
      }
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      console.error('Failed to copy image', e);
    }
  };

  const isThreadActive = Boolean(activeHighlight || activeScreenshot);

  return (
    <div
      style={{ width: `${width}px` }}
      className="relative h-full flex flex-col bg-[#0f0f12] border-l border-zinc-800 shrink-0 select-none"
    >
      {/* Draggable Left Edge Splitter */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="absolute top-0 bottom-0 -left-1.5 w-3 cursor-col-resize z-50 group flex items-center justify-center hover:bg-purple-500/20 active:bg-purple-500/30 transition-colors"
        title="Drag left edge to resize panel (360px - 800px)"
      >
        <div className="w-1 h-8 rounded-full bg-zinc-700/60 group-hover:bg-purple-400 group-hover:scale-y-125 transition-all" />
      </div>

      {/* Top Header */}
      <div className="h-12 border-b border-zinc-800/80 px-4 flex items-center justify-between bg-[#141418]">
        {isThreadActive ? (
          <button
            onClick={onBackToHighlights}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{activeScreenshot ? 'Back' : 'Saved Highlights'}</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 overflow-hidden">
            <Bookmark className="w-4 h-4 text-purple-400 shrink-0" />
            <div className="flex flex-col overflow-hidden">
              <span className="text-xs font-semibold text-zinc-200 leading-tight">Saved Highlights</span>
              {sessionTitle && (
                <span className="text-[10px] text-zinc-400 truncate max-w-[190px]" title={sessionTitle}>
                  {sessionTitle}
                </span>
              )}
            </div>
            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full font-mono shrink-0 ml-1">
              {savedHighlights.length}
            </span>
          </div>
        )}

        <div className="flex items-center space-x-1.5 shrink-0">
          {onOpenPromptsModal && (
            <button
              onClick={onOpenPromptsModal}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition ${
                hasCustomPrompts
                  ? 'bg-purple-950/80 border border-purple-700/60 text-purple-300 hover:bg-purple-900/80'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
              title={hasCustomPrompts ? 'Custom AI instructions active for this note (click to edit)' : 'Configure AI persona & prompts'}
            >
              <Sparkles size={12} className={hasCustomPrompts ? 'text-purple-400 animate-pulse' : 'text-zinc-400'} />
              <span>Prompts</span>
              {hasCustomPrompts && (
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 ml-0.5" />
              )}
            </button>
          )}

          {onFontSizeChange && (
            <div
              className="flex items-center space-x-0.5 bg-zinc-800/80 border border-zinc-700/60 rounded px-1.5 py-0.5 select-none"
              title="Sidepanel font size (click number to reset to 13px)"
            >
              <button
                type="button"
                onClick={() => onFontSizeChange(Math.max(11, fontSize - 1))}
                disabled={fontSize <= 11}
                className="px-1.5 py-0.5 text-zinc-400 hover:text-zinc-100 disabled:opacity-30 text-xs font-mono font-bold leading-none transition"
                title="Decrease font size"
              >
                -
              </button>
              <button
                type="button"
                onClick={() => onFontSizeChange(13)}
                className="px-1 text-[11px] font-mono text-zinc-300 hover:text-purple-300 leading-none transition"
                title="Reset to default 13px"
              >
                {fontSize}px
              </button>
              <button
                type="button"
                onClick={() => onFontSizeChange(Math.min(22, fontSize + 1))}
                disabled={fontSize >= 22}
                className="px-1.5 py-0.5 text-zinc-400 hover:text-zinc-100 disabled:opacity-30 text-xs font-mono font-bold leading-none transition"
                title="Increase font size"
              >
                +
              </button>
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
      </div>

      {/* Main Content Area */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-3"
        style={{ fontSize: `${fontSize}px` }}
      >
        {/* --- Vision Thread View --- */}
        {activeScreenshot ? (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Target Header Pill */}
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-zinc-200 font-medium">
                  {activeScreenshot.target_type === 'screen' ? (
                    <Monitor className="w-4 h-4 text-blue-400" />
                  ) : (
                    <AppWindow className="w-4 h-4 text-purple-400" />
                  )}
                  <span className="truncate max-w-[220px]" title={activeScreenshot.target_title}>
                    {activeScreenshot.target_title}
                  </span>
                </div>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {activeScreenshot.width}×{activeScreenshot.height}
                </span>
              </div>

              {/* Full-width Image Preview */}
              <div className="relative rounded-lg overflow-hidden border border-zinc-800/80 bg-black/60 max-h-[220px] flex items-center justify-center">
                <img
                  src={activeScreenshot.thumbnail_url}
                  alt={activeScreenshot.target_title}
                  className="w-full h-auto max-h-[220px] object-contain"
                />
              </div>

              {/* Image Actions Bar */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-zinc-500">
                  {new Date(activeScreenshot.timestamp * 1000).toLocaleTimeString()}
                </span>
                <button
                  onClick={() => handleCopyImageToClipboard(activeScreenshot.image_path, 'img_copy')}
                  className="flex items-center gap-1 px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs transition"
                  title="Copy full resolution image to Windows clipboard"
                >
                  {copiedId === 'img_copy' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-[10px] text-emerald-400">Image Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span className="text-[10px]">Copy Image</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* AI Thought Process Trace (if available) */}
            {activeScreenshot.thought && (
              <div className="border border-zinc-800 rounded-lg overflow-hidden bg-[#16161a]">
                <button
                  onClick={() => setShowThought(!showThought)}
                  className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                    <span>Vision Reasoning Trace</span>
                  </div>
                  {showThought ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
                {showThought && (
                  <div
                    className="px-3 py-2 text-zinc-400 border-t border-zinc-800/80 font-mono leading-relaxed whitespace-pre-wrap bg-black/20"
                    style={{ fontSize: `${Math.max(10, fontSize - 1)}px` }}
                  >
                    {activeScreenshot.thought}
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
                    <div className="text-[10px] text-zinc-400">Multimodal Vision Analysis</div>
                  </div>
                </div>

                {activeScreenshot.ai_response && (
                  <button
                    onClick={() => handleCopyText(activeScreenshot.ai_response!, 'vision_ai_copy')}
                    className="flex items-center gap-1 px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs transition-colors"
                    title="Copy AI response"
                  >
                    {copiedId === 'vision_ai_copy' ? (
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
                  <p className="text-xs">Analyzing visual details with Gemini Vision Agent...</p>
                </div>
              ) : activeScreenshot.ai_response ? (
                <MarkdownRenderer content={activeScreenshot.ai_response} fontSize={fontSize} />
              ) : (
                <div className="py-6 text-center text-xs text-zinc-400">
                  Select <strong className="text-zinc-200">Explain this image</strong> to query the AI Agent.
                </div>
              )}
            </div>

            {/* Follow-up Question Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (followupPrompt.trim() && onAskVisionFollowup && activeScreenshot) {
                  onAskVisionFollowup(activeScreenshot, followupPrompt.trim());
                  setFollowupPrompt('');
                }
              }}
              className="flex items-center gap-2 p-2 bg-[#141418] border border-zinc-800 rounded-xl"
            >
              <input
                type="text"
                value={followupPrompt}
                onChange={(e) => setFollowupPrompt(e.target.value)}
                placeholder="Ask follow-up question about this image..."
                disabled={isLoadingAi}
                className="flex-1 bg-transparent text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none px-2"
              />
              <button
                type="submit"
                disabled={!followupPrompt.trim() || isLoadingAi}
                className="p-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-lg transition"
                title="Send follow-up question"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        ) : activeHighlight ? (
          /* --- AI Thread View --- */
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Highlighted Quote Excerpt */}
            <div className="bg-zinc-900/80 border-l-2 border-purple-500 rounded-r-lg p-3 text-zinc-200 space-y-1.5 shadow-sm">
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
              <p className="italic leading-relaxed font-sans" style={{ fontSize: `${fontSize}px`, lineHeight: 1.55 }}>"{activeHighlight.text}"</p>
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
                  <div
                    className="px-3 py-2 text-zinc-400 border-t border-zinc-800/80 font-mono leading-relaxed whitespace-pre-wrap bg-black/20"
                    style={{ fontSize: `${Math.max(10, fontSize - 1)}px` }}
                  >
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
                <MarkdownRenderer content={activeHighlight.ai_response} fontSize={fontSize} />
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
                    className="text-zinc-200 italic line-clamp-3 cursor-pointer hover:text-white transition-colors"
                    style={{ fontSize: `${fontSize}px`, lineHeight: 1.55 }}
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

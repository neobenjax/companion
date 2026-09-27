import React, { useRef, useEffect, useState } from 'react';
import { Calendar, Users, Sparkles, ChevronDown, ChevronUp, Bot, User, Zap } from 'lucide-react';
import { ChatMessage, TranscriptSegment, ActionCardData, HighlightData, ScreenshotData } from '../types';
import { TranscriptItem } from './TranscriptItem';
import { ActionCard } from './ActionCard';
import { Camera, Monitor, AppWindow } from 'lucide-react';

interface ChatFeedProps {
  title: string;
  onUpdateTitle: (newTitle: string) => void;
  messages: ChatMessage[];
  highlights?: HighlightData[];
  onHighlightClick?: (highlight: HighlightData) => void;
  onManualHighlight?: (messageId: string, text: string, speaker: 'caller' | 'me', timestamp: number) => void;
  onScreenshotClick?: (screenshot: ScreenshotData) => void;
  onUpdateCard: (messageId: string, updatedCard: ActionCardData) => void;
  isRecording: boolean;
  speechActivity?: { is_speaking: boolean; speaker: string };
}

export const ChatFeed: React.FC<ChatFeedProps> = ({
  title,
  onUpdateTitle,
  messages,
  highlights = [],
  onHighlightClick,
  onManualHighlight,
  onScreenshotClick,
  onUpdateCard,
  isRecording,
  speechActivity,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(title);
  const [collapsedThoughts, setCollapsedThoughts] = useState<{ [id: string]: boolean }>({});
  const feedEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTitleInput(title);
  }, [title]);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, speechActivity?.is_speaking]);

  const toggleThought = (msgId: string) => {
    setCollapsedThoughts((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (titleInput.trim()) {
      onUpdateTitle(titleInput.trim());
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
      {/* Session Header (Granola style) */}
      <div className="pb-3 border-b border-zinc-800/80 space-y-2 select-none">
        {isEditingTitle ? (
          <input
            type="text"
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            onBlur={handleTitleSubmit}
            onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
            autoFocus
            className="w-full text-lg font-bold text-zinc-100 bg-zinc-900 border border-zinc-700 rounded px-2 py-0.5 focus:outline-none"
          />
        ) : (
          <h1
            onClick={() => setIsEditingTitle(true)}
            className="text-lg font-bold text-zinc-100 hover:text-purple-300 cursor-pointer transition flex items-center space-x-2"
            title="Click to rename"
          >
            <span>{title || 'Untitled Note'}</span>
          </h1>
        )}

        <div className="flex items-center space-x-2 text-[11px] text-zinc-400 select-none">
          <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800">
            <Calendar size={12} className="text-zinc-500" />
            <span>Today</span>
          </div>
          <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800">
            <Users size={12} className="text-zinc-500" />
            <span>Me + Caller</span>
          </div>
          {isRecording && (
            <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-red-950/60 text-red-300 border border-red-900/50 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span>Transcribing Speech...</span>
            </div>
          )}
        </div>
      </div>

      {/* Stream Messages */}
      {messages.length === 0 ? (
        <div className="py-16 text-center text-zinc-500 text-xs space-y-2 select-none">
          <Sparkles size={24} className="mx-auto text-purple-400/60 animate-pulse" />
          <p className="font-medium text-zinc-400">Ambient Copilot is ready.</p>
          <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">
            Click <strong className="text-zinc-300">[Record]</strong> below to transcribe speech.
            Press the global hotkey anytime to trigger the Antigravity Agent on the last 10s excerpt.
          </p>
        </div>
      ) : (
        messages.map((msg) => {
          if (msg.type === 'transcript') {
            return (
              <TranscriptItem
                key={msg.id}
                messageId={msg.id}
                segment={{
                  id: msg.segmentId || msg.id,
                  timestamp: msg.timestamp,
                  speaker: msg.speaker || 'me',
                  text: msg.content || '',
                }}
                highlights={highlights}
                onHighlightClick={onHighlightClick}
                onManualHighlight={onManualHighlight}
              />
            );
          }

          if (msg.type === 'intent_trigger') {
            return null; // Highlights are displayed in-place within the transcript
          }

          if (msg.type === 'user') {
            return (
              <div key={msg.id} className="flex justify-end my-2 select-none">
                <div className="max-w-[85%] px-3 py-2 rounded-lg bg-purple-600 text-white text-xs shadow">
                  <div className="flex items-center space-x-1 mb-0.5 opacity-80 text-[10px]">
                    <User size={10} />
                    <span>You</span>
                  </div>
                  <p>{msg.content}</p>
                </div>
              </div>
            );
          }

          if (msg.type === 'screenshot' && msg.screenshot) {
            const shot = msg.screenshot;
            const timeStr = new Date(shot.timestamp * 1000).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });
            const isScreen = shot.target_type === 'screen';

            return (
              <div
                key={msg.id}
                onClick={() => onScreenshotClick && onScreenshotClick(shot)}
                className="my-3 p-3 rounded-xl bg-[#141418] hover:bg-[#1a1a20] border border-zinc-800 hover:border-purple-500/50 shadow-md cursor-pointer transition group select-none"
              >
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800/80 text-[11px]">
                  <div className="flex items-center gap-1.5 text-zinc-300 font-medium">
                    {isScreen ? (
                      <Monitor className="w-3.5 h-3.5 text-blue-400" />
                    ) : (
                      <AppWindow className="w-3.5 h-3.5 text-purple-400" />
                    )}
                    <span className="truncate max-w-[200px]" title={shot.target_title}>
                      {shot.target_title}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-500">{timeStr}</span>
                </div>

                {/* Thumbnail Image Container */}
                <div className="relative rounded-lg overflow-hidden bg-black/40 border border-zinc-800/60 aspect-video flex items-center justify-center group-hover:border-zinc-700 transition">
                  {shot.thumbnail_url ? (
                    <img
                      src={shot.thumbnail_url}
                      alt={shot.target_title}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-zinc-600 gap-1 text-[10px]">
                      <Camera className="w-6 h-6" />
                      <span>Screenshot</span>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition backdrop-blur-[1px]">
                    <span className="px-2.5 py-1 bg-purple-600/90 text-white text-[11px] font-medium rounded-md shadow flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      {shot.ai_response ? 'View AI Thread' : 'Actions & Explain'}
                    </span>
                  </div>
                </div>

                {/* AI Response Preview if already analyzed */}
                {shot.ai_response && (
                  <div className="mt-2.5 pt-2 border-t border-zinc-800/60 space-y-1">
                    <div className="flex items-center gap-1 text-[10px] font-semibold text-purple-400 uppercase tracking-wider">
                      <Sparkles className="w-3 h-3" />
                      <span>Vision Copilot</span>
                    </div>
                    <p className="text-[11px] text-zinc-300 line-clamp-2 leading-relaxed">
                      {shot.ai_response}
                    </p>
                  </div>
                )}
              </div>
            );
          }

          if (msg.type === 'assistant') {
            const isThoughtCollapsed = collapsedThoughts[msg.id];
            return (
              <div
                key={msg.id}
                className="my-3 p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 shadow-md text-xs space-y-2.5"
              >
                <div className="flex items-center space-x-2 text-purple-400 font-semibold text-xs border-b border-zinc-800/60 pb-1.5">
                  <Bot size={14} className="text-purple-400" />
                  <span>Antigravity Agent</span>
                </div>

                {/* Antigravity 2.0 Thought Reasoning Trace */}
                {msg.thought && (
                  <div className="rounded-lg bg-zinc-950/70 border border-zinc-800/70 overflow-hidden text-[11px]">
                    <button
                      onClick={() => toggleThought(msg.id)}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 text-zinc-400 hover:text-zinc-200 bg-zinc-900/40 transition"
                    >
                      <div className="flex items-center space-x-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                        <span className="font-mono text-[10px] uppercase tracking-wider text-purple-300">
                          Reasoning Trace
                        </span>
                      </div>
                      {isThoughtCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                    </button>
                    {!isThoughtCollapsed && (
                      <div className="p-2.5 text-zinc-400 font-mono text-[10.5px] leading-relaxed whitespace-pre-wrap border-t border-zinc-800/50">
                        {msg.thought}
                      </div>
                    )}
                  </div>
                )}

                {/* Markdown content */}
                <div className="text-zinc-100 text-xs leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                </div>

                {/* Interactive Action Cards */}
                {msg.action_cards && msg.action_cards.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {msg.action_cards.map((card) => (
                      <ActionCard
                        key={card.actionId}
                        card={card}
                        onUpdateCard={(updated) => onUpdateCard(msg.id, updated)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return null;
        })
      )}

      {/* Granola-Style Animated 3-Dots Listening Indicator */}
      {isRecording && speechActivity?.is_speaking && (
        <div className="px-3 py-2 rounded-lg text-xs bg-zinc-900/50 border border-zinc-800/60 my-1.5 flex items-center space-x-2.5 animate-fadeIn select-none transition-all">
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase select-none ${
              speechActivity.speaker === 'caller'
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50'
                : 'bg-purple-950/80 text-purple-300 border border-purple-800/50'
            }`}
          >
            {speechActivity.speaker === 'caller' ? 'Caller' : 'You'}
          </span>
          <div className="flex items-center space-x-1.5 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 animate-bounce" style={{ animationDelay: '300ms' }} />
            <span className="text-[11px] text-zinc-400 font-medium ml-1">listening...</span>
          </div>
        </div>
      )}

      <div ref={feedEndRef} />
    </div>
  );
};

import React, { useRef, useEffect, useState } from 'react';
import { Calendar, Users, Sparkles, ChevronDown, ChevronUp, Bot, User, Zap } from 'lucide-react';
import { ChatMessage, TranscriptSegment, ActionCardData, HighlightData } from '../types';
import { TranscriptItem } from './TranscriptItem';
import { ActionCard } from './ActionCard';

interface ChatFeedProps {
  title: string;
  onUpdateTitle: (newTitle: string) => void;
  messages: ChatMessage[];
  highlights?: HighlightData[];
  onHighlightClick?: (highlight: HighlightData) => void;
  onUpdateCard: (messageId: string, updatedCard: ActionCardData) => void;
  isRecording: boolean;
}

export const ChatFeed: React.FC<ChatFeedProps> = ({
  title,
  onUpdateTitle,
  messages,
  highlights = [],
  onHighlightClick,
  onUpdateCard,
  isRecording,
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
  }, [messages]);

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
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 select-text">
      {/* Session Header (Granola style) */}
      <div className="pb-3 border-b border-zinc-800/80 space-y-2">
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

        <div className="flex items-center space-x-2 text-[11px] text-zinc-400">
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
        <div className="py-16 text-center text-zinc-500 text-xs space-y-2">
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
                  text: msg.content,
                }}
                highlights={highlights}
                onHighlightClick={onHighlightClick}
              />
            );
          }

          if (msg.type === 'intent_trigger') {
            return null; // Highlights are displayed in-place within the transcript
          }

          if (msg.type === 'user') {
            return (
              <div key={msg.id} className="flex justify-end my-2">
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
      <div ref={feedEndRef} />
    </div>
  );
};

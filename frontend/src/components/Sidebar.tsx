import React, { useState } from 'react';
import { Home, Users, MessageSquare, Plus, FileText, Trash2, Search, ChevronRight, Sparkles } from 'lucide-react';
import { Session } from '../types';

interface SidebarProps {
  sessions: Session[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  isOpen,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  // Filter sessions by query
  const filtered = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group sessions by date
  const groupSessions = (list: Session[]) => {
    const groups: { [key: string]: Session[] } = {};
    const now = new Date();

    list.forEach((s) => {
      const d = new Date(s.created_at * 1000);
      let label = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

      // Check if today or yesterday
      const isToday = d.toDateString() === now.toDateString();
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const isYesterday = d.toDateString() === yesterday.toDateString();

      if (isToday) label = 'Today';
      else if (isYesterday) label = 'Yesterday';

      if (!groups[label]) groups[label] = [];
      groups[label].push(s);
    });
    return groups;
  };

  const grouped = groupSessions(filtered);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 z-40 backdrop-blur-[1px] animate-in fade-in duration-150"
      />

      {/* Slide-over Drawer */}
      <div className="absolute top-0 bottom-0 left-0 w-64 h-full bg-[#121216] border-r border-zinc-800/80 flex flex-col select-none text-zinc-300 text-xs z-50 shadow-2xl animate-in slide-in-from-left duration-200">
        {/* Top Search & New note action */}
        <div className="p-3 border-b border-zinc-800/80 space-y-2">
          <button
            onClick={() => {
              onCreateSession();
              onClose();
            }}
            className="w-full flex items-center justify-center space-x-1.5 py-1.5 px-3 bg-purple-600 hover:bg-purple-500 text-white rounded-md font-medium text-xs shadow transition active:scale-[0.98]"
          >
            <Plus size={14} />
            <span>New note</span>
          </button>

        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-2.5 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes..."
            className="w-full bg-zinc-950/60 border border-zinc-800 rounded-md pl-8 pr-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
          />
        </div>
      </div>

      {/* Main Navigation (Granola style) */}
      <div className="px-2 py-2 border-b border-zinc-800/60 space-y-0.5">
        <div className="flex items-center space-x-2 px-2.5 py-1.5 rounded hover:bg-zinc-800/60 cursor-pointer text-zinc-400 hover:text-zinc-200 transition">
          <Home size={14} />
          <span>Home</span>
        </div>
        <div className="flex items-center space-x-2 px-2.5 py-1.5 rounded hover:bg-zinc-800/60 cursor-pointer text-zinc-400 hover:text-zinc-200 transition">
          <Users size={14} />
          <span>Shared with me</span>
        </div>
        <div className="flex items-center space-x-2 px-2.5 py-1.5 rounded hover:bg-zinc-800/60 cursor-pointer text-zinc-400 hover:text-zinc-200 transition">
          <MessageSquare size={14} />
          <span>Copilot Chat</span>
        </div>
      </div>

      {/* Spaces & Notes list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
        <div className="px-2 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
          Notes & Transcripts
        </div>

        {Object.keys(grouped).length === 0 ? (
          <div className="px-3 py-6 text-center text-zinc-500 text-xs">
            No notes yet. Click "+ New note" to start.
          </div>
        ) : (
          Object.entries(grouped).map(([dateLabel, items]) => (
            <div key={dateLabel} className="space-y-1">
              <div className="px-2 text-[11px] font-medium text-zinc-400">{dateLabel}</div>
              <div className="space-y-0.5">
                {items.map((session) => {
                  const isActive = session.id === activeSessionId;
                  const timeStr = new Date(session.created_at * 1000).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={session.id}
                      onClick={() => {
                        onSelectSession(session.id);
                        onClose();
                      }}
                      className={`group flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer transition ${
                        isActive
                          ? 'bg-zinc-800 text-zinc-100 font-medium'
                          : 'hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <div className="flex items-center space-x-2 overflow-hidden pr-1">
                        <FileText size={13} className={isActive ? 'text-purple-400' : 'text-zinc-500'} />
                        <span className="truncate text-xs">{session.title || 'Untitled note'}</span>
                      </div>
                      <div className="flex items-center space-x-1 shrink-0">
                        <span className="text-[10px] text-zinc-500 group-hover:hidden">{timeStr}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Delete this session note?')) {
                              onDeleteSession(session.id);
                            }
                          }}
                          className="hidden group-hover:block p-1 hover:text-red-400 text-zinc-500 transition"
                          title="Delete note"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bottom workspace footer */}
      <div className="p-2 border-t border-zinc-800/80 flex items-center justify-between text-zinc-400">
        <div className="flex items-center space-x-2 px-1">
          <div className="w-5 h-5 rounded bg-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-200">
            A
          </div>
          <span className="text-xs truncate max-w-[120px]">My Workspace</span>
        </div>
        <div className="px-1.5 py-0.5 rounded bg-purple-950/60 border border-purple-800/40 text-[10px] text-purple-300 flex items-center space-x-1">
          <Sparkles size={10} />
          <span>Antigravity</span>
        </div>
      </div>
    </div>
    </>
  );
};

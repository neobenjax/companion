import React from 'react';
import { Pin, PinOff, Minus, X, Settings as SettingsIcon, Sidebar as SidebarIcon, Mic, PanelRight } from 'lucide-react';
import { pywebviewService } from '../services/pywebview';

interface TitleBarProps {
  alwaysOnTop: boolean;
  onToggleAlwaysOnTop: () => void;
  onOpenSettings: () => void;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  isRecording: boolean;
  onToggleSidepanel?: () => void;
  sidepanelOpen?: boolean;
  savedCount?: number;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  alwaysOnTop,
  onToggleAlwaysOnTop,
  onOpenSettings,
  onToggleSidebar,
  sidebarOpen,
  isRecording,
  onToggleSidepanel,
  sidepanelOpen = false,
  savedCount = 0,
}) => {
  return (
    <div className="drag-region flex items-center justify-between h-10 px-3 bg-zinc-900/90 border-b border-zinc-800/80 backdrop-blur-md text-zinc-300 z-50">
      <div className="flex items-center space-x-2 no-drag">
        <button
          onClick={onToggleSidebar}
          title="Toggle Navigation / History"
          className="p-1 hover:bg-zinc-800 rounded transition text-zinc-400 hover:text-zinc-100"
        >
          <SidebarIcon size={16} />
        </button>
        <div className="flex items-center space-x-1.5 pl-1">
          <div className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-sm shadow-purple-500/50" />
          <span className="text-xs font-semibold tracking-wide text-zinc-200">Ambient Copilot</span>
        </div>
        {isRecording && (
          <div className="flex items-center space-x-1 px-1.5 py-0.5 rounded-full bg-red-950/70 border border-red-800/60 text-[10px] text-red-300 animate-pulse">
            <Mic size={10} className="text-red-400" />
            <span>LIVE</span>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-1 no-drag">
        <button
          onClick={onToggleAlwaysOnTop}
          title={alwaysOnTop ? 'Disable Always on Top' : 'Enable Always on Top'}
          className={`p-1 rounded transition ${
            alwaysOnTop
              ? 'text-purple-400 bg-purple-950/50 border border-purple-800/40'
              : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
          }`}
        >
          {alwaysOnTop ? <Pin size={14} /> : <PinOff size={14} />}
        </button>
        {onToggleSidepanel && (
          <button
            onClick={onToggleSidepanel}
            title={sidepanelOpen ? 'Collapse Side Panel' : 'Saved Highlights & Threads'}
            className={`p-1 rounded transition relative ${
              sidepanelOpen
                ? 'text-purple-300 bg-purple-950/60 border border-purple-800/50'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
            }`}
          >
            <PanelRight size={14} />
            {savedCount > 0 && !sidepanelOpen && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-purple-500 ring-2 ring-zinc-900" />
            )}
          </button>
        )}
        <button
          onClick={onOpenSettings}
          title="Settings & Hotkeys"
          className="p-1 hover:bg-zinc-800 rounded transition text-zinc-400 hover:text-zinc-100"
        >
          <SettingsIcon size={14} />
        </button>
        <button
          onClick={() => pywebviewService.minimizeWindow()}
          title="Minimize"
          className="p-1 hover:bg-zinc-800 rounded transition text-zinc-400 hover:text-zinc-100"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={() => pywebviewService.closeWindow()}
          title="Close"
          className="p-1 hover:bg-red-900/60 rounded transition text-zinc-400 hover:text-red-300"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import { Mic, Eye, ChevronDown, Check, Sparkles, Settings2, Edit3 } from 'lucide-react';
import { PromptPreset, PresetCategory } from '../types';

interface PresetQuickSelectorProps {
  activeAudioPreset: PromptPreset | null;
  activeVisionPreset: PromptPreset | null;
  presets: PromptPreset[];
  onSelectPreset: (preset: PromptPreset) => void;
  onOpenPresetManager: () => void;
  hotkeyLabel?: string;
  isOpenExternal?: boolean;
  onCloseExternal?: () => void;
}

export const PresetQuickSelector: React.FC<PresetQuickSelectorProps> = ({
  activeAudioPreset,
  activeVisionPreset,
  presets,
  onSelectPreset,
  onOpenPresetManager,
  hotkeyLabel = 'Ctrl+P',
  isOpenExternal = false,
  onCloseExternal,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync external open state (e.g. from hotkey)
  useEffect(() => {
    if (isOpenExternal) {
      setIsOpen(true);
    }
  }, [isOpenExternal]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (onCloseExternal) onCloseExternal();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onCloseExternal]);

  const handleToggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (!next && onCloseExternal) onCloseExternal();
  };

  const audioPresets = presets.filter((p) => p.category === 'transcription' || p.category === 'compound');
  const visionPresets = presets.filter((p) => p.category === 'vision' || p.category === 'compound');

  const currentDisplay = activeAudioPreset?.name || 'Standard Ambient';

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Compact Quick-Select Pill */}
      <button
        type="button"
        onClick={handleToggle}
        title={`Active Preset: ${currentDisplay} (${hotkeyLabel})`}
        className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition border ${
          isOpen
            ? 'bg-purple-900/40 border-purple-500/80 text-purple-200 shadow-sm shadow-purple-900/30'
            : 'bg-zinc-800/80 hover:bg-zinc-700/80 border-zinc-700/70 text-zinc-300 hover:text-zinc-100'
        }`}
      >
        <span className="flex items-center justify-center text-purple-400">
          <Sparkles size={12} />
        </span>
        <span className="max-w-[130px] truncate text-[11px]">{currentDisplay}</span>
        <span className="text-[10px] text-zinc-500 font-mono hidden sm:inline px-1 py-0.5 rounded bg-zinc-900/80 border border-zinc-800">
          {hotkeyLabel}
        </span>
        <ChevronDown size={12} className={`text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute right-0 mt-1.5 w-72 max-h-[420px] bg-zinc-900/95 backdrop-blur-md border border-zinc-700/90 rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col text-zinc-200 animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/80 bg-zinc-950/60">
            <span className="text-[11px] font-semibold text-zinc-400 tracking-wider uppercase">Prompt Presets</span>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                if (onCloseExternal) onCloseExternal();
                onOpenPresetManager();
              }}
              className="flex items-center space-x-1 text-[11px] text-purple-400 hover:text-purple-300 font-medium px-1.5 py-0.5 rounded hover:bg-purple-950/40 transition"
              title="Manage and edit prompt presets"
            >
              <Edit3 size={11} />
              <span>Edit</span>
            </button>
          </div>

          {/* Preset Groups */}
          <div className="flex-1 overflow-y-auto p-1.5 space-y-2 text-xs divide-y divide-zinc-800/40">
            {/* Audio Presets */}
            <div className="space-y-1">
              <div className="flex items-center space-x-1.5 px-2 pt-1 text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                <Mic size={11} className="text-purple-400" />
                <span>Transcript Presets (Spoken Context)</span>
              </div>
              {audioPresets.map((preset) => {
                const isActive = activeAudioPreset?.id === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      onSelectPreset(preset);
                      setIsOpen(false);
                      if (onCloseExternal) onCloseExternal();
                    }}
                    className={`w-full text-left flex items-start justify-between px-2.5 py-2 rounded-lg transition ${
                      isActive
                        ? 'bg-purple-950/60 border border-purple-800/50 text-purple-100'
                        : 'hover:bg-zinc-800/70 text-zinc-300 hover:text-zinc-100 border border-transparent'
                    }`}
                  >
                    <div className="flex-1 pr-2">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-semibold text-xs">{preset.name}</span>
                        {preset.isBuiltIn && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                            Built-in
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-1">{preset.description}</p>
                    </div>
                    {isActive && <Check size={14} className="text-purple-400 shrink-0 mt-0.5" />}
                  </button>
                );
              })}
            </div>

            {/* Vision Presets */}
            <div className="space-y-1 pt-1.5">
              <div className="flex items-center space-x-1.5 px-2 text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                <Eye size={11} className="text-blue-400" />
                <span>Vision Presets (Screenshots & Code)</span>
              </div>
              {visionPresets.map((preset) => {
                const isActive = activeVisionPreset?.id === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      onSelectPreset(preset);
                      setIsOpen(false);
                      if (onCloseExternal) onCloseExternal();
                    }}
                    className={`w-full text-left flex items-start justify-between px-2.5 py-2 rounded-lg transition ${
                      isActive
                        ? 'bg-blue-950/60 border border-blue-800/50 text-blue-100'
                        : 'hover:bg-zinc-800/70 text-zinc-300 hover:text-zinc-100 border border-transparent'
                    }`}
                  >
                    <div className="flex-1 pr-2">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-semibold text-xs">{preset.name}</span>
                        {preset.isBuiltIn && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                            Built-in
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-1">{preset.description}</p>
                    </div>
                    {isActive && <Check size={14} className="text-blue-400 shrink-0 mt-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="px-3 py-2 border-t border-zinc-800/80 bg-zinc-950/70 flex items-center justify-between text-[11px] text-zinc-400">
            <span>Toggle with <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 font-mono text-[10px]">{hotkeyLabel}</kbd></span>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                if (onCloseExternal) onCloseExternal();
                onOpenPresetManager();
              }}
              className="text-purple-400 hover:text-purple-300 font-medium"
            >
              Open Manager ➔
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

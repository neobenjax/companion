import React, { useState, useEffect } from 'react';
import { Monitor, AppWindow, RefreshCw, X, Check, Laptop } from 'lucide-react';
import { CaptureTarget, CaptureTargetsResponse } from '../types';
import { pywebviewService } from '../services/pywebview';

interface TargetPickerPopoverProps {
  selectedTarget: CaptureTarget | null;
  onSelectTarget: (target: CaptureTarget) => void;
  onClose: () => void;
}

export const TargetPickerPopover: React.FC<TargetPickerPopoverProps> = ({
  selectedTarget,
  onSelectTarget,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'screens' | 'applications'>('screens');
  const [targets, setTargets] = useState<CaptureTargetsResponse>({ screens: [], applications: [] });
  const [isLoading, setIsLoading] = useState(false);

  const loadTargets = async () => {
    setIsLoading(true);
    try {
      const res = await pywebviewService.getCaptureTargets();
      setTargets(res);
    } catch (e) {
      console.error('Failed to load capture targets:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTargets();
  }, []);

  return (
    <div className="absolute bottom-16 left-2 right-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="bg-[#141418]/95 backdrop-blur-md border border-purple-500/40 rounded-xl shadow-2xl p-3 max-h-[320px] flex flex-col gap-2.5 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
            <Laptop className="w-3.5 h-3.5 text-purple-400" />
            <span>Select Target to Track</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={loadTargets}
              disabled={isLoading}
              className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition"
              title="Refresh open windows and screens"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tabs: Screens vs Applications */}
        <div className="flex items-center p-0.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs">
          <button
            onClick={() => setActiveTab('screens')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1 rounded-md transition font-medium ${
              activeTab === 'screens'
                ? 'bg-purple-600 text-white shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Screens ({targets.screens.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('applications')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1 rounded-md transition font-medium ${
              activeTab === 'applications'
                ? 'bg-purple-600 text-white shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <AppWindow className="w-3.5 h-3.5" />
            <span>Applications ({targets.applications.length})</span>
          </button>
        </div>

        {/* Targets List */}
        <div className="flex-1 overflow-y-auto space-y-1 pr-1 max-h-[190px]">
          {activeTab === 'screens' ? (
            targets.screens.length === 0 ? (
              <div className="py-6 text-center text-xs text-zinc-500">No physical displays detected.</div>
            ) : (
              targets.screens.map((screen) => {
                const isSelected = selectedTarget?.id === screen.id;
                return (
                  <button
                    key={screen.id}
                    onClick={() => {
                      onSelectTarget(screen);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition border ${
                      isSelected
                        ? 'bg-purple-950/60 border-purple-500/60 text-white'
                        : 'bg-zinc-900/60 border-zinc-800/60 text-zinc-300 hover:bg-zinc-800/80 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Monitor className="w-4 h-4 text-purple-400 shrink-0" />
                      <div>
                        <div className="font-medium">{screen.name}</div>
                        <div className="text-[10px] text-zinc-500">
                          {screen.width} × {screen.height} {screen.is_primary ? '• Primary Display' : ''}
                        </div>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-purple-400 shrink-0" />}
                  </button>
                );
              })
            )
          ) : targets.applications.length === 0 ? (
            <div className="py-6 text-center text-xs text-zinc-500">
              No top-level application windows detected.
            </div>
          ) : (
            targets.applications.map((app) => {
              const isSelected = selectedTarget?.id === app.id;
              return (
                <button
                  key={app.id}
                  onClick={() => {
                    onSelectTarget(app);
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition border ${
                    isSelected
                      ? 'bg-purple-950/60 border-purple-500/60 text-white'
                      : 'bg-zinc-900/60 border-zinc-800/60 text-zinc-300 hover:bg-zinc-800/80 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <AppWindow className="w-4 h-4 text-purple-400 shrink-0" />
                    <div className="truncate">
                      <div className="font-medium truncate" title={app.name}>
                        {app.name}
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        {app.width} × {app.height} px
                      </div>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-purple-400 shrink-0 ml-2" />}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

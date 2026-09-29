import React, { useState, useEffect, useRef } from 'react';
import { Target, X, Check, ArrowRight } from 'lucide-react';
import { PromptPreset } from '../types';

interface AutoDetectionBannerProps {
  suggestedPreset: PromptPreset | null;
  detectedApp: string;
  onApplyPreset: (preset: PromptPreset) => void;
  onDismiss: () => void;
  autoSwitchCountdownSec?: number;
}

export const AutoDetectionBanner: React.FC<AutoDetectionBannerProps> = ({
  suggestedPreset,
  detectedApp,
  onApplyPreset,
  onDismiss,
  autoSwitchCountdownSec = 4,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(autoSwitchCountdownSec);
  const [isApplied, setIsApplied] = useState<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!suggestedPreset) return;
    setSecondsRemaining(autoSwitchCountdownSec);
    setIsApplied(false);

    timerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleApply();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [suggestedPreset?.id]);

  if (!suggestedPreset) return null;

  const handleApply = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsApplied(true);
    onApplyPreset(suggestedPreset);
    setTimeout(() => {
      onDismiss();
    }, 1000);
  };

  const handleCancel = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    onDismiss();
  };

  return (
    <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-3 duration-200 pointer-events-auto">
      <div className="flex items-center space-x-3 px-3.5 py-2 rounded-full bg-zinc-900/95 border border-purple-500/70 shadow-2xl backdrop-blur-md text-zinc-100 text-xs">
        <div className="w-5 h-5 rounded-full bg-purple-900/60 border border-purple-500/80 flex items-center justify-center text-purple-300 shrink-0">
          <Target size={12} />
        </div>

        <div className="flex items-center space-x-1.5">
          <span className="text-zinc-400">Detected <strong className="text-zinc-200 font-semibold">{detectedApp}</strong>:</span>
          <span>Switching to <strong className="text-purple-300 font-semibold">{suggestedPreset.name}</strong></span>
          {!isApplied && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800/60">
              in {secondsRemaining}s
            </span>
          )}
        </div>

        {isApplied ? (
          <div className="flex items-center space-x-1 text-emerald-400 font-medium text-[11px] px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-800/40">
            <Check size={12} />
            <span>Activated!</span>
          </div>
        ) : (
          <div className="flex items-center space-x-1 pl-1">
            <button
              type="button"
              onClick={handleApply}
              className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white font-medium text-[11px] transition shadow-sm shadow-purple-600/30"
            >
              <span>Switch Now</span>
              <ArrowRight size={10} />
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="p-1 rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
              title="Cancel auto-switch and keep current preset"
            >
              <X size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

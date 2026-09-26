import React, { useState, useEffect } from 'react';
import { X, Keyboard, Mic, Sliders, KeyRound, Check, RefreshCw, Eye, EyeOff, Sparkles } from 'lucide-react';
import { Settings, AudioDevicesResponse } from '../types';
import { pywebviewService } from '../services/pywebview';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onSaveSettings: (newSettings: Settings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  const [formData, setFormData] = useState<Settings>(settings);
  const [audioDevices, setAudioDevices] = useState<AudioDevicesResponse>({ inputs: [], loopbacks: [] });
  const [isRecordingHotkey, setIsRecordingHotkey] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  useEffect(() => {
    if (isOpen) {
      loadDevices();
    }
  }, [isOpen]);

  const loadDevices = async () => {
    try {
      const devs = await pywebviewService.getAudioDevices();
      setAudioDevices(devs);
    } catch (e) {
      console.error('Failed to load audio devices:', e);
    }
  };

  // Keyboard shortcut recorder
  useEffect(() => {
    if (!isRecordingHotkey) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const parts: string[] = [];
      if (e.ctrlKey) parts.push('<ctrl>');
      if (e.shiftKey) parts.push('<shift>');
      if (e.altKey) parts.push('<alt>');
      if (e.metaKey) parts.push('<cmd>');

      const key = e.key.toLowerCase();
      if (!['control', 'shift', 'alt', 'meta'].includes(key)) {
        parts.push(key);
        const combo = parts.join('+');
        setFormData((prev) => ({ ...prev, audio_intent_hotkey: combo }));
        setIsRecordingHotkey(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isRecordingHotkey]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveSettings(formData);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  const formatHotkey = (hk: string) => {
    return hk
      .replace(/<|>/g, '')
      .split('+')
      .map((k) => k.charAt(0).toUpperCase() + k.slice(1))
      .join('+');
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-xs text-zinc-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center space-x-2">
            <Sliders size={16} className="text-purple-400" />
            <span className="font-semibold text-sm text-zinc-100">Copilot Settings</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200">
            <X size={15} />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Global Shortcuts */}
          <div className="space-y-2.5">
            <div className="flex items-center space-x-1.5 text-zinc-300 font-semibold">
              <Keyboard size={14} className="text-purple-400" />
              <span>Global Keyboard Shortcuts</span>
            </div>

            <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-zinc-200">Audio Intent Trigger</span>
                  <p className="text-[11px] text-zinc-500">Takes last 10s speech & prompts Antigravity Agent</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRecordingHotkey(true)}
                  className={`px-3 py-1.5 rounded text-xs font-mono font-medium transition ${
                    isRecordingHotkey
                      ? 'bg-amber-600 text-white animate-pulse'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-purple-300 border border-purple-900/40'
                  }`}
                >
                  {isRecordingHotkey ? 'Press Keys...' : formatHotkey(formData.audio_intent_hotkey)}
                </button>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-800/50">
                <div>
                  <span className="font-medium text-zinc-300">Vision Snapshot Trigger</span>
                  <p className="text-[11px] text-zinc-500">Takes window snapshot (MVP 2)</p>
                </div>
                <span className="px-2.5 py-1 rounded bg-zinc-800/70 text-zinc-400 text-xs font-mono">
                  {formatHotkey(formData.vision_intent_hotkey)}
                </span>
              </div>
            </div>
          </div>

          {/* Lookback duration and words */}
          <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800/80 space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-zinc-300">Speech Lookback Duration</span>
                <span className="font-mono text-purple-400 font-semibold">{formData.lookback_duration_sec}s</span>
              </div>
              <p className="text-[11px] text-zinc-500">
                Minimum time window of spoken audio analyzed when shortcut is pressed.
              </p>
              <input
                type="range"
                min="5"
                max="60"
                step="1"
                value={formData.lookback_duration_sec}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, lookback_duration_sec: parseInt(e.target.value, 10) }))
                }
                className="w-full accent-purple-600 cursor-pointer"
              />
            </div>

            <div className="space-y-1.5 pt-2 border-t border-zinc-800/50">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-zinc-300">Highlight Word Budget</span>
                <span className="font-mono text-purple-400 font-semibold">{formData.lookback_words || 50} words</span>
              </div>
              <p className="text-[11px] text-zinc-500">
                Highlights the last X words of spoken speech in the chat when the shortcut is triggered.
              </p>
              <input
                type="range"
                min="20"
                max="200"
                step="5"
                value={formData.lookback_words || 50}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, lookback_words: parseInt(e.target.value, 10) }))
                }
                className="w-full accent-purple-600 cursor-pointer"
              />
            </div>
          </div>

          {/* Audio Devices */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-zinc-300 font-semibold">
                <Mic size={14} className="text-purple-400" />
                <span>Audio Capture Devices (WASAPI)</span>
              </div>
              <button
                type="button"
                onClick={loadDevices}
                className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200"
                title="Refresh audio devices"
              >
                <RefreshCw size={12} />
              </button>
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Microphone (You):</label>
                <select
                  value={formData.input_device_index ?? ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      input_device_index: e.target.value === '' ? null : parseInt(e.target.value, 10),
                    }))
                  }
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
                >
                  <option value="">Default Windows Microphone</option>
                  {audioDevices.inputs.map((d) => (
                    <option key={d.index} value={d.index}>
                      {d.name} {d.is_default ? '(Default)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">WASAPI Loopback (Speakers / Caller):</label>
                <select
                  value={formData.loopback_device_index ?? ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      loopback_device_index: e.target.value === '' ? null : parseInt(e.target.value, 10),
                    }))
                  }
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
                >
                  <option value="">Default Windows Loopback</option>
                  {audioDevices.loopbacks.map((d) => (
                    <option key={d.index} value={d.index}>
                      {d.name} {d.is_default ? '(Default)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Whisper Model */}
          <div className="space-y-1.5">
            <span className="font-semibold text-zinc-300">Whisper STT Model</span>
            <select
              value={formData.whisper_model}
              onChange={(e) => setFormData((prev) => ({ ...prev, whisper_model: e.target.value }))}
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
            >
              <option value="tiny.en">tiny.en (Fastest, Lowest CPU)</option>
              <option value="base.en">base.en (Recommended, Balanced)</option>
              <option value="small.en">small.en (Higher Accuracy)</option>
            </select>
          </div>

          {/* API Key */}
          <div className="space-y-1.5">
            <div className="flex items-center space-x-1.5 text-zinc-300 font-semibold">
              <KeyRound size={14} className="text-purple-400" />
              <span>Google Antigravity / Gemini API Key</span>
            </div>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={formData.gemini_api_key}
                onChange={(e) => setFormData((prev) => ({ ...prev, gemini_api_key: e.target.value }))}
                placeholder="AIzaSy... (Optional for cloud LLM)"
                className="w-full bg-zinc-950 border border-zinc-800 rounded pl-3 pr-8 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-700"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-2 text-zinc-500 hover:text-zinc-300"
              >
                {showApiKey ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
            <p className="text-[10px] text-zinc-500">
              Leave blank to use the smart built-in offline engine (supports calculations, tasks, and summarization).
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center space-x-1 px-4 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs transition active:scale-95 shadow"
          >
            {savedSuccess ? <Check size={13} /> : null}
            <span>{savedSuccess ? 'Saved' : 'Save Changes'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

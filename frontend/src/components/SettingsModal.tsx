import React, { useState, useEffect } from 'react';
import {
  X,
  Keyboard,
  Mic,
  Sliders,
  KeyRound,
  Check,
  RefreshCw,
  Eye,
  EyeOff,
  Sparkles,
  RotateCcw,
  Code2,
  ShieldAlert,
  Edit3,
  Save,
  Undo2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Settings, AudioDevicesResponse, PromptPreset } from '../types';
import { pywebviewService } from '../services/pywebview';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onSaveSettings: (newSettings: Settings) => void;
}

const SETTINGS_TEMPLATE_VARIABLES = [
  { token: '{{selected_text}}', label: 'Selected Text' },
  { token: '{{full_transcript_recent}}', label: 'Rolling Transcript (75s)' },
  { token: '{{window_title}}', label: 'Window Title' },
  { token: '{{process_name}}', label: 'Process Name' },
  { token: '{{timestamp}}', label: 'Timestamp' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'presets'>('general');
  const [formData, setFormData] = useState<Settings>(settings);
  const [audioDevices, setAudioDevices] = useState<AudioDevicesResponse>({ inputs: [], loopbacks: [] });
  const [recordingHotkeyType, setRecordingHotkeyType] = useState<'audio' | 'vision' | 'preset' | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [presets, setPresets] = useState<PromptPreset[]>([]);
  const [presetCategoryFilter, setPresetCategoryFilter] = useState<'all' | 'transcription' | 'vision'>('all');
  const [resetSuccess, setResetSuccess] = useState(false);

  // Global Preset In-Place Editing State
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editingInstruction, setEditingInstruction] = useState<string>('');
  const [editingTemplate, setEditingTemplate] = useState<string>('');
  const [presetSaveSuccess, setPresetSaveSuccess] = useState<string | null>(null);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  useEffect(() => {
    if (isOpen) {
      loadDevices();
      loadPresets();
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

  const loadPresets = async () => {
    try {
      const list = await pywebviewService.getPresets();
      setPresets(list);
    } catch (e) {
      console.error('Failed to load presets:', e);
    }
  };

  const handleResetPresets = async () => {
    if (window.confirm('Reset all prompt presets to factory defaults? Any custom preset modifications will be reverted.')) {
      const res = await pywebviewService.resetPresetsToDefault();
      setPresets(res);
      setEditingPresetId(null);
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 2000);
    }
  };

  const handleStartEditPreset = (preset: PromptPreset) => {
    if (editingPresetId === preset.id) {
      setEditingPresetId(null);
    } else {
      setEditingPresetId(preset.id);
      setEditingInstruction(preset.systemInstruction || '');
      setEditingTemplate(preset.userPromptTemplate || '');
    }
  };

  const handleCancelEditPreset = () => {
    setEditingPresetId(null);
  };

  const handleInsertVariableIntoTemplate = (token: string) => {
    setEditingTemplate((prev) => (prev ? `${prev} ${token}` : token));
  };

  const handleSaveEditedPreset = async (preset: PromptPreset) => {
    const updated: PromptPreset = {
      ...preset,
      systemInstruction: editingInstruction.trim() || undefined,
      userPromptTemplate: editingTemplate.trim() || '{{selected_text}}',
    };
    try {
      const res = await pywebviewService.savePreset(updated);
      if (res && res.status === 'ok') {
        setPresets((prev) => prev.map((p) => (p.id === preset.id ? updated : p)));
        setPresetSaveSuccess(preset.id);
        setTimeout(() => {
          setPresetSaveSuccess(null);
          setEditingPresetId(null);
        }, 800);
      }
    } catch (e) {
      console.error('Failed to save preset:', e);
    }
  };

  const handleRevertSinglePreset = async (presetId: string) => {
    if (window.confirm('Revert this preset to its factory defaults?')) {
      try {
        await pywebviewService.deletePreset(presetId);
        const list = await pywebviewService.getPresets();
        setPresets(list);
        const reverted = list.find((p) => p.id === presetId);
        if (reverted) {
          setEditingInstruction(reverted.systemInstruction || '');
          setEditingTemplate(reverted.userPromptTemplate || '');
        }
      } catch (e) {
        console.error('Failed to revert preset:', e);
      }
    }
  };

  // Keyboard shortcut recorder
  useEffect(() => {
    if (!recordingHotkeyType) return;

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
        if (recordingHotkeyType === 'audio') {
          setFormData((prev) => ({ ...prev, audio_intent_hotkey: combo }));
        } else if (recordingHotkeyType === 'vision') {
          setFormData((prev) => ({ ...prev, vision_intent_hotkey: combo }));
        } else if (recordingHotkeyType === 'preset') {
          setFormData((prev) => ({ ...prev, preset_switcher_hotkey: combo }));
        }
        setRecordingHotkeyType(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [recordingHotkeyType]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveSettings(formData);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  const formatHotkey = (hk?: string) => {
    if (!hk) return 'None';
    return hk
      .replace(/<|>/g, '')
      .split('+')
      .map((k) => k.charAt(0).toUpperCase() + k.slice(1))
      .join('+');
  };

  const filteredPresets = presets.filter((p) => {
    if (presetCategoryFilter === 'all') return true;
    return p.category === presetCategoryFilter || p.category === 'compound';
  });

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-xs text-zinc-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 bg-zinc-950/70">
          <div className="flex items-center space-x-2">
            <Sliders size={16} className="text-purple-400" />
            <span className="font-semibold text-sm text-zinc-100">Copilot Settings</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200">
            <X size={15} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-800 bg-zinc-950/40 px-5 pt-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition -mb-px ${
              activeTab === 'general'
                ? 'border-purple-500 text-purple-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            General & Transcript
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('presets')}
            className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-medium border-b-2 transition -mb-px ${
              activeTab === 'presets'
                ? 'border-purple-500 text-purple-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles size={13} className="text-purple-400" />
            <span>Prompt Presets</span>
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {activeTab === 'general' ? (
            <>
              {/* Global Shortcuts */}
              <div className="space-y-2.5">
                <div className="flex items-center space-x-1.5 text-zinc-300 font-semibold">
                  <Keyboard size={14} className="text-purple-400" />
                  <span>Global Keyboard Shortcuts</span>
                </div>

                <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-zinc-200">Transcript Highlight Shortcut</span>
                      <p className="text-[11px] text-zinc-500">Highlights last words & prompts Copilot</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRecordingHotkeyType('audio')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition ${
                        recordingHotkeyType === 'audio'
                          ? 'bg-amber-600 text-white animate-pulse'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-purple-300 border border-purple-900/40'
                      }`}
                    >
                      {recordingHotkeyType === 'audio' ? 'Press Keys...' : formatHotkey(formData.audio_intent_hotkey)}
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-zinc-800/50">
                    <div>
                      <span className="font-medium text-zinc-200">Vision Snapshot Shortcut</span>
                      <p className="text-[11px] text-zinc-500">Takes window snapshot and analyzes with AI</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRecordingHotkeyType('vision')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition ${
                        recordingHotkeyType === 'vision'
                          ? 'bg-amber-600 text-white animate-pulse'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-purple-300 border border-purple-900/40'
                      }`}
                    >
                      {recordingHotkeyType === 'vision' ? 'Press Keys...' : formatHotkey(formData.vision_intent_hotkey)}
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-zinc-800/50">
                    <div>
                      <span className="font-medium text-zinc-200">Preset Switcher Shortcut</span>
                      <p className="text-[11px] text-zinc-500">Toggles the quick-preset menu on the fly</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRecordingHotkeyType('preset')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition ${
                        recordingHotkeyType === 'preset'
                          ? 'bg-amber-600 text-white animate-pulse'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-purple-300 border border-purple-900/40'
                      }`}
                    >
                      {recordingHotkeyType === 'preset'
                        ? 'Press Keys...'
                        : formatHotkey(formData.preset_switcher_hotkey || '<ctrl>+p')}
                    </button>
                  </div>
                </div>
              </div>

              {/* Highlight word budget */}
              <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-2">
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

              {/* Speech-to-Text Model */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-300">Speech-to-Text Model</span>
                  <span className="text-[10px] text-purple-400 font-mono">Optimal Default</span>
                </div>
                <select
                  value={formData.whisper_model || 'small.en'}
                  onChange={(e) => setFormData((prev) => ({ ...prev, whisper_model: e.target.value }))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-purple-600/60"
                >
                  <option value="small.en">small.en (Optimal: Best Accuracy & Accents on CPU/GPU)</option>
                  <option value="whisper-large-v3-turbo">whisper-large-v3-turbo (State-of-the-Art Accuracy)</option>
                  <option value="base.en">base.en (Ultra-Lightweight, Lower Accuracy)</option>
                </select>
                <p className="text-[10.5px] text-zinc-500">
                  small.en provides ~4x better accuracy on diverse accents and fast speech with INT8 quantization.
                </p>
              </div>

              {/* AI Provider & API Key */}
              <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-3">
                <div className="space-y-1.5">
                  <span className="font-semibold text-zinc-300">AI Agent Provider</span>
                  <select
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-purple-600/60"
                    defaultValue="gemini"
                  >
                    <option value="gemini">Google Gemini 3.8 Flash (Recommended, Native Vision & Low Cost)</option>
                    <option value="gemini_pro">Google Gemini 3.8 Pro (Deep Reasoning)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5 text-zinc-300 font-semibold text-xs">
                      <KeyRound size={13} className="text-purple-400" />
                      <span>Google Gemini API Key</span>
                    </div>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-purple-400 hover:text-purple-300 underline font-medium"
                    >
                      Get API Key →
                    </a>
                  </div>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={formData.gemini_api_key}
                      onChange={(e) => setFormData((prev) => ({ ...prev, gemini_api_key: e.target.value }))}
                      placeholder="AIzaSy... (Leave empty for Offline Sandbox)"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded pl-3 pr-8 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-purple-600/60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2 top-2 text-zinc-500 hover:text-zinc-300"
                    >
                      {showApiKey ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>

                  {formData.gemini_api_key.trim() ? (
                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 pt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Live Agent Ready (Connected to Google Antigravity & Gemini 3.8 Flash)</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[10px] text-amber-400/90 pt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      <span>Sandbox Mode Active (Runs offline fallback with local math & simulated reasoning)</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* Presets Management Tab */
            <div className="space-y-4">
              {/* Global Defaults Section */}
              <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-3">
                <span className="font-semibold text-zinc-200 block text-xs">Global Default Presets</span>
                <p className="text-[11px] text-zinc-400">
                  These presets will be applied automatically to all new sessions unless customized per-session.
                </p>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">Default Transcript Preset:</label>
                    <select
                      value={formData.default_audio_preset_id || 'default-audio-ambient'}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, default_audio_preset_id: e.target.value }))
                      }
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-purple-600/60"
                    >
                      {presets
                        .filter((p) => p.category === 'transcription' || p.category === 'compound')
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">Default Vision Preset:</label>
                    <select
                      value={formData.default_vision_preset_id || 'default-vision-ambient'}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, default_vision_preset_id: e.target.value }))
                      }
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-purple-600/60"
                    >
                      {presets
                        .filter((p) => p.category === 'vision' || p.category === 'compound')
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Preset List & Filter */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => setPresetCategoryFilter('all')}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                        presetCategoryFilter === 'all'
                          ? 'bg-purple-900/60 text-purple-200 border border-purple-700/60'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      All ({presets.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPresetCategoryFilter('transcription')}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                        presetCategoryFilter === 'transcription'
                          ? 'bg-purple-900/60 text-purple-200 border border-purple-700/60'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Transcript ({presets.filter((p) => p.category === 'transcription').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPresetCategoryFilter('vision')}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                        presetCategoryFilter === 'vision'
                          ? 'bg-purple-900/60 text-purple-200 border border-purple-700/60'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Vision ({presets.filter((p) => p.category === 'vision').length})
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetPresets}
                    className="flex items-center space-x-1 text-[11px] text-zinc-400 hover:text-purple-300 transition"
                    title="Revert all presets to factory shipped configuration"
                  >
                    <RotateCcw size={11} />
                    <span>Reset to Defaults</span>
                  </button>
                </div>

                {resetSuccess && (
                  <div className="p-2 rounded bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-[11px] flex items-center space-x-1.5">
                    <Check size={12} />
                    <span>Factory presets restored successfully!</span>
                  </div>
                )}

                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {filteredPresets.map((preset) => {
                    const isEditing = editingPresetId === preset.id;
                    return (
                      <div
                        key={preset.id}
                        className={`p-3 rounded-xl border transition space-y-2 ${
                          isEditing
                            ? 'bg-zinc-950/90 border-purple-500/80 shadow-lg shadow-purple-950/20'
                            : 'bg-zinc-950/50 border-zinc-800 hover:border-zinc-700/80'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-zinc-200">{preset.name}</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800/80 text-zinc-400 border border-zinc-700/60 uppercase">
                              {preset.category === 'transcription' ? 'Transcript' : preset.category}
                            </span>
                            {preset.isBuiltIn && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-950/50 text-purple-300 border border-purple-800/40">
                                Built-in
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleStartEditPreset(preset)}
                            className={`flex items-center space-x-1 text-[11px] px-2 py-0.5 rounded transition ${
                              isEditing
                                ? 'bg-purple-900/60 text-purple-200 border border-purple-700/60'
                                : 'text-zinc-400 hover:text-purple-300 hover:bg-zinc-800/60'
                            }`}
                          >
                            <Edit3 size={11} />
                            <span>{isEditing ? 'Close' : 'Edit Rules'}</span>
                          </button>
                        </div>

                        {!isEditing ? (
                          <>
                            <p className="text-[11px] text-zinc-400">{preset.description}</p>
                            {preset.targetAppPatterns && preset.targetAppPatterns.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap pt-0.5">
                                <span className="text-[10px] text-zinc-500">Auto-triggers on:</span>
                                {preset.targetAppPatterns.map((pat) => (
                                  <span
                                    key={pat}
                                    className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-zinc-900 text-zinc-400 border border-zinc-800"
                                  >
                                    {pat}
                                  </span>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          /* In-Place Preset Customization Editor */
                          <div className="pt-2 border-t border-zinc-800 space-y-3">
                            <div className="space-y-1">
                              <label className="text-[10px] font-semibold text-zinc-300 flex items-center justify-between">
                                <span>System Role & Instructions:</span>
                                <span className="text-[9px] text-zinc-500">Defines how Copilot thinks & responds</span>
                              </label>
                              <textarea
                                value={editingInstruction}
                                onChange={(e) => setEditingInstruction(e.target.value)}
                                placeholder="Define persona and output formatting rules..."
                                rows={5}
                                className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg p-2.5 text-[11px] font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-purple-500 resize-y"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-semibold text-zinc-300 flex items-center justify-between">
                                <span>User Prompt Template:</span>
                                <span className="text-[9px] text-zinc-500">Supports dynamic context variables</span>
                              </label>
                              <div className="flex items-center gap-1 flex-wrap pb-1">
                                {SETTINGS_TEMPLATE_VARIABLES.map((v) => (
                                  <button
                                    key={v.token}
                                    type="button"
                                    onClick={() => handleInsertVariableIntoTemplate(v.token)}
                                    className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-purple-950/60 hover:text-purple-300 border border-zinc-800 hover:border-purple-800/60 text-zinc-400 transition"
                                    title={`Insert ${v.token}`}
                                  >
                                    + {v.label}
                                  </button>
                                ))}
                              </div>
                              <textarea
                                value={editingTemplate}
                                onChange={(e) => setEditingTemplate(e.target.value)}
                                placeholder="Prompt template containing {{selected_text}}..."
                                rows={3}
                                className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg p-2.5 text-[11px] font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-purple-500 resize-y"
                              />
                            </div>

                            <div className="flex items-center justify-between pt-1">
                              {preset.isBuiltIn ? (
                                <button
                                  type="button"
                                  onClick={() => handleRevertSinglePreset(preset.id)}
                                  className="flex items-center space-x-1 text-[10px] text-zinc-500 hover:text-purple-300 transition"
                                  title="Revert this preset to original factory configuration"
                                >
                                  <Undo2 size={11} />
                                  <span>Revert to Factory</span>
                                </button>
                              ) : <div />}
                              <div className="flex items-center space-x-2">
                                <button
                                  type="button"
                                  onClick={handleCancelEditPreset}
                                  className="px-2.5 py-1 text-[11px] rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditedPreset(preset)}
                                  className="flex items-center space-x-1 px-3 py-1 text-[11px] font-medium rounded bg-purple-600 hover:bg-purple-500 text-white transition active:scale-95 shadow"
                                >
                                  {presetSaveSuccess === preset.id ? <Check size={12} /> : <Save size={12} />}
                                  <span>{presetSaveSuccess === preset.id ? 'Saved!' : 'Save Preset'}</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Guardrails Info Banner */}
              <div className="flex items-start space-x-2 p-2.5 rounded-xl bg-purple-950/20 border border-purple-900/40 text-[11px] text-zinc-400">
                <ShieldAlert size={14} className="text-purple-400 shrink-0 mt-0.5" />
                <p>
                  <strong className="text-purple-300">Prompt Safety Boundaries Enforced:</strong> All presets inherit inviolable system envelopes to prevent prompt injection and system prompt override from audio, vision, or templates.
                </p>
              </div>
            </div>
          )}
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

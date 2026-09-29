import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles, RotateCcw, ChevronDown, ChevronUp, FileText, Image as ImageIcon, Check, Code2, ShieldAlert } from 'lucide-react';
import { Session, PromptPreset } from '../types';
import { pywebviewService } from '../services/pywebview';

interface SessionPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: Session | null;
  presets: PromptPreset[];
  onSavePrompts: (
    promptHighlight: string,
    promptImage: string,
    activeAudioPresetId?: string,
    activeVisionPresetId?: string,
    presetPrompts?: Record<string, string>
  ) => void;
  defaultPrompts: { highlight: string; image: string };
}

const TEMPLATE_VARIABLES = [
  { token: '{{selected_text}}', label: 'Selected Text', desc: 'Triggered transcript excerpt or highlight' },
  { token: '{{full_transcript_recent}}', label: 'Rolling Transcript (75s)', desc: 'Recent conversation context' },
  { token: '{{window_title}}', label: 'Window Title', desc: 'Title bar of active/captured window' },
  { token: '{{process_name}}', label: 'Process Name', desc: 'Target process executable name' },
  { token: '{{timestamp}}', label: 'Timestamp', desc: 'Local OS time of invocation' },
];

export const SessionPromptModal: React.FC<SessionPromptModalProps> = ({
  isOpen,
  onClose,
  session,
  presets,
  onSavePrompts,
  defaultPrompts,
}) => {
  const [activeTab, setActiveTab] = useState<'highlight' | 'image'>('highlight');
  const [selectedAudioPresetId, setSelectedAudioPresetId] = useState<string>('default-audio-ambient');
  const [selectedVisionPresetId, setSelectedVisionPresetId] = useState<string>('default-vision-ambient');
  const [presetDrafts, setPresetDrafts] = useState<Record<string, string>>({});
  const [presetBaselines, setPresetBaselines] = useState<Record<string, string>>({});

  type PendingAction =
    | { type: 'switch_preset'; preset: PromptPreset }
    | { type: 'switch_tab'; tab: 'highlight' | 'image' };

  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [showConfirmSwitch, setShowConfirmSwitch] = useState<boolean>(false);
  const [showLivePreview, setShowLivePreview] = useState<boolean>(false);
  const [previewContent, setPreviewContent] = useState<{ rendered?: string; guardrail?: string }>({});
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fallback hierarchy: Preset's configured global instruction -> Shipped factory default fail-safe
  const resolvePromptForPreset = (presetId: string, category: 'transcription' | 'vision'): string => {
    const p = presets.find((item) => item.id === presetId);
    if (p && p.systemInstruction && p.systemInstruction.trim()) {
      return p.systemInstruction.trim();
    }
    // Factory fail-safe in case all prompts are blanked in presets.json
    return category === 'transcription' ? defaultPrompts.highlight : defaultPrompts.image;
  };

  useEffect(() => {
    if (!isOpen) return;

    const audioId = session?.active_audio_preset_id || 'default-audio-ambient';
    const visionId = session?.active_vision_preset_id || 'default-vision-ambient';

    setSelectedAudioPresetId(audioId);
    setSelectedVisionPresetId(visionId);

    // Initialize drafts and baselines for all presets:
    const initialDrafts: Record<string, string> = {};
    const initialBaselines: Record<string, string> = {};

    presets.forEach((p) => {
      let promptVal: string;
      if (session?.preset_prompts && session.preset_prompts[p.id] !== undefined) {
        promptVal = session.preset_prompts[p.id];
      } else if (
        p.id === audioId &&
        session?.prompt_highlight !== undefined &&
        session?.prompt_highlight !== null &&
        session?.prompt_highlight.trim() !== ''
      ) {
        promptVal = session.prompt_highlight;
      } else if (
        p.id === visionId &&
        session?.prompt_image !== undefined &&
        session?.prompt_image !== null &&
        session?.prompt_image.trim() !== ''
      ) {
        promptVal = session.prompt_image;
      } else {
        promptVal = resolvePromptForPreset(p.id, p.category === 'vision' ? 'vision' : 'transcription');
      }
      initialDrafts[p.id] = promptVal;
      initialBaselines[p.id] = promptVal;
    });

    setPresetDrafts(initialDrafts);
    setPresetBaselines(initialBaselines);
    setShowConfirmSwitch(false);
    setPendingAction(null);
    setSavedSuccess(false);
  }, [session, isOpen, presets]);

  // Load preview when opening preview drawer or changing preset
  useEffect(() => {
    if (showLivePreview && isOpen) {
      const activePresetId = activeTab === 'highlight' ? selectedAudioPresetId : selectedVisionPresetId;
      pywebviewService.renderPresetPreview(activePresetId).then((res) => {
        if (res && res.status === 'ok') {
          setPreviewContent({
            rendered: res.rendered_prompt,
            guardrail: res.guarded_system_instruction,
          });
        }
      });
    }
  }, [showLivePreview, activeTab, selectedAudioPresetId, selectedVisionPresetId, isOpen]);

  if (!isOpen) return null;

  const currentActivePresetId = activeTab === 'highlight' ? selectedAudioPresetId : selectedVisionPresetId;
  const currentCategory = activeTab === 'highlight' ? 'transcription' : 'vision';
  const currentPrompt =
    presetDrafts[currentActivePresetId] !== undefined
      ? presetDrafts[currentActivePresetId]
      : resolvePromptForPreset(currentActivePresetId, currentCategory);

  const currentBaseline =
    presetBaselines[currentActivePresetId] !== undefined
      ? presetBaselines[currentActivePresetId]
      : resolvePromptForPreset(currentActivePresetId, currentCategory);

  const isCurrentDirty = currentPrompt.trim() !== currentBaseline.trim();

  const relevantPresets = presets.filter((p) =>
    activeTab === 'highlight'
      ? p.category === 'transcription' || p.category === 'compound'
      : p.category === 'vision' || p.category === 'compound'
  );

  const handlePromptChange = (val: string) => {
    setPresetDrafts((prev) => ({
      ...prev,
      [currentActivePresetId]: val,
    }));
  };

  const handleInsertVariable = (token: string) => {
    const el = textareaRef.current;
    if (!el) {
      handlePromptChange(currentPrompt ? `${currentPrompt} ${token}` : token);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = currentPrompt || '';
    const updated = text.substring(0, start) + token + text.substring(end);
    handlePromptChange(updated);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    }, 50);
  };

  const handleSelectPreset = (preset: PromptPreset) => {
    if (preset.id === currentActivePresetId) return;

    if (isCurrentDirty) {
      setPendingAction({ type: 'switch_preset', preset });
      setShowConfirmSwitch(true);
    } else {
      if (activeTab === 'highlight') {
        setSelectedAudioPresetId(preset.id);
      } else {
        setSelectedVisionPresetId(preset.id);
      }
    }
  };

  const handleTabChange = (targetTab: 'highlight' | 'image') => {
    if (targetTab === activeTab) return;

    if (isCurrentDirty) {
      setPendingAction({ type: 'switch_tab', tab: targetTab });
      setShowConfirmSwitch(true);
    } else {
      setActiveTab(targetTab);
    }
  };

  const handleKeepEditing = () => {
    setShowConfirmSwitch(false);
    setPendingAction(null);
  };

  const handleLoseChanges = () => {
    // Revert current preset draft to its baseline
    setPresetDrafts((prev) => ({
      ...prev,
      [currentActivePresetId]: currentBaseline,
    }));

    if (pendingAction) {
      if (pendingAction.type === 'switch_preset') {
        if (activeTab === 'highlight') {
          setSelectedAudioPresetId(pendingAction.preset.id);
        } else {
          setSelectedVisionPresetId(pendingAction.preset.id);
        }
      } else if (pendingAction.type === 'switch_tab') {
        setActiveTab(pendingAction.tab);
      }
    }

    setShowConfirmSwitch(false);
    setPendingAction(null);
  };

  const handleSaveAndSwitch = () => {
    const updatedDrafts = { ...presetDrafts };
    // Update baseline for the current preset to mark it saved
    setPresetBaselines((prev) => ({
      ...prev,
      [currentActivePresetId]: currentPrompt,
    }));

    const targetAudioId =
      pendingAction?.type === 'switch_preset' && activeTab === 'highlight'
        ? pendingAction.preset.id
        : selectedAudioPresetId;
    const targetVisionId =
      pendingAction?.type === 'switch_preset' && activeTab === 'image'
        ? pendingAction.preset.id
        : selectedVisionPresetId;

    const highlightText =
      activeTab === 'highlight'
        ? currentPrompt
        : (presetDrafts[selectedAudioPresetId] ?? resolvePromptForPreset(selectedAudioPresetId, 'transcription'));
    const imageText =
      activeTab === 'image'
        ? currentPrompt
        : (presetDrafts[selectedVisionPresetId] ?? resolvePromptForPreset(selectedVisionPresetId, 'vision'));

    onSavePrompts(
      highlightText.trim(),
      imageText.trim(),
      targetAudioId,
      targetVisionId,
      updatedDrafts
    );

    // Apply the pending switch
    if (pendingAction) {
      if (pendingAction.type === 'switch_preset') {
        if (activeTab === 'highlight') {
          setSelectedAudioPresetId(pendingAction.preset.id);
        } else {
          setSelectedVisionPresetId(pendingAction.preset.id);
        }
      } else if (pendingAction.type === 'switch_tab') {
        setActiveTab(pendingAction.tab);
      }
    }

    setShowConfirmSwitch(false);
    setPendingAction(null);
  };

  // Reverts ONLY the currently active preset to its global default prompt
  const handleResetToDefault = () => {
    const def = resolvePromptForPreset(currentActivePresetId, currentCategory);
    setPresetDrafts((prev) => ({
      ...prev,
      [currentActivePresetId]: def,
    }));
  };

  const handleSave = () => {
    const highlightText =
      presetDrafts[selectedAudioPresetId] !== undefined
        ? presetDrafts[selectedAudioPresetId]
        : resolvePromptForPreset(selectedAudioPresetId, 'transcription');
    const imageText =
      presetDrafts[selectedVisionPresetId] !== undefined
        ? presetDrafts[selectedVisionPresetId]
        : resolvePromptForPreset(selectedVisionPresetId, 'vision');

    // Update baselines to match current drafts
    setPresetBaselines({ ...presetDrafts });

    onSavePrompts(
      highlightText.trim(),
      imageText.trim(),
      selectedAudioPresetId,
      selectedVisionPresetId,
      presetDrafts
    );
    setSavedSuccess(true);
    setTimeout(() => {
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[88vh] text-zinc-200 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Unsaved Changes Confirmation Dialog */}
        {showConfirmSwitch && pendingAction && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
            <div className="bg-zinc-900 border border-zinc-700/90 rounded-2xl p-5 max-w-sm w-full space-y-3 shadow-2xl text-xs text-zinc-200">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-zinc-100 flex items-center gap-1.5 text-sm">
                  <ShieldAlert size={16} className="text-amber-400" />
                  <span>Unsaved changes</span>
                </span>
                <button
                  type="button"
                  onClick={handleKeepEditing}
                  className="text-zinc-400 hover:text-zinc-200"
                >
                  <X size={15} />
                </button>
              </div>
              <p className="text-zinc-300 text-[11px] leading-relaxed">
                You have modified the prompt for this preset. Switching before saving will discard your edits unless saved.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={handleKeepEditing}
                  className="px-2.5 py-1.5 text-[11px] rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
                >
                  Keep editing
                </button>
                <button
                  type="button"
                  onClick={handleLoseChanges}
                  className="px-2.5 py-1.5 text-[11px] rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition"
                >
                  Lose changes
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndSwitch}
                  className="px-3 py-1.5 text-[11px] font-medium rounded bg-purple-600 hover:bg-purple-500 text-white transition active:scale-95 shadow"
                >
                  Save and Switch
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 bg-[#141418]">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-purple-950/80 border border-purple-800/60 flex items-center justify-center text-purple-400">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <span>Session Prompts & Presets</span>
                {session?.title && (
                  <span className="text-[11px] font-normal text-zinc-400 max-w-[200px] truncate" title={session.title}>
                    ({session.title})
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-zinc-400">
                Personalize active presets, dynamic variables, and instructions for this session
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-zinc-800 bg-zinc-950/40 px-5 pt-2">
          <button
            type="button"
            onClick={() => handleTabChange('highlight')}
            className={`flex items-center space-x-2 px-3 py-2 text-xs font-medium border-b-2 transition -mb-px ${
              activeTab === 'highlight'
                ? 'border-purple-500 text-purple-300 bg-purple-950/20'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FileText size={14} />
            <span>Transcript Prompt Preset</span>
            {(presetDrafts[selectedAudioPresetId] ?? '').trim() && (
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            )}
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('image')}
            className={`flex items-center space-x-2 px-3 py-2 text-xs font-medium border-b-2 transition -mb-px ${
              activeTab === 'image'
                ? 'border-purple-500 text-purple-300 bg-purple-950/20'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ImageIcon size={14} />
            <span>Screenshot Vision Preset</span>
            {(presetDrafts[selectedVisionPresetId] ?? '').trim() && (
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            )}
          </button>
        </div>

        {/* Main Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Active Preset Picker */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-zinc-300 flex items-center justify-between">
              <span>Active Preset for this Session:</span>
              <span className="text-[10px] text-zinc-500 font-normal">Choose preset persona & formatting</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {relevantPresets.map((preset) => {
                const isSelected = currentActivePresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`text-left p-2.5 rounded-xl border transition ${
                      isSelected
                        ? 'bg-purple-950/50 border-purple-500/80 text-purple-100 shadow-sm shadow-purple-950/40'
                        : 'bg-zinc-800/40 hover:bg-zinc-800/80 border-zinc-700/60 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs truncate">{preset.name}</span>
                      {isSelected && <Check size={13} className="text-purple-400 shrink-0" />}
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-1">{preset.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dynamic Variable Insertion Chips */}
          <div className="space-y-1.5 bg-zinc-950/40 border border-zinc-800/80 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5">
                <Code2 size={13} className="text-purple-400" />
                <span>Dynamic Context Variables</span>
              </span>
              <span className="text-[10px] text-zinc-500">Click to insert at cursor</span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {TEMPLATE_VARIABLES.map((v) => (
                <button
                  key={v.token}
                  type="button"
                  onClick={() => handleInsertVariable(v.token)}
                  title={v.desc}
                  className="px-2 py-0.5 rounded-lg bg-zinc-800 hover:bg-purple-900/50 border border-zinc-700 hover:border-purple-600/70 text-purple-300 font-mono text-[10px] transition"
                >
                  + {v.token}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Instruction / Override Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-zinc-300">
                {activeTab === 'highlight'
                  ? 'Custom Session Instruction / Template Override:'
                  : 'Custom Vision Instruction / Template Override:'}
              </label>
              <span className="text-[10px] text-zinc-500">
                Leave empty to inherit selected preset rules
              </span>
            </div>
            <textarea
              ref={textareaRef}
              rows={6}
              value={currentPrompt}
              onChange={(e) => handlePromptChange(e.target.value)}
              placeholder="Leave blank to use active preset rules, or enter custom instructions/template with {{selected_text}}, {{full_transcript_recent}}, {{window_title}}..."
              className="w-full bg-zinc-950/90 border border-zinc-700/80 rounded-xl p-3 text-xs text-zinc-100 placeholder-zinc-500 font-mono leading-relaxed focus:outline-none focus:border-purple-500 transition resize-y"
            />
          </div>

          {/* Security Guardrail Notice */}
          <div className="flex items-start space-x-2 p-2.5 rounded-xl bg-purple-950/20 border border-purple-900/40 text-[11px] text-zinc-400">
            <ShieldAlert size={14} className="text-purple-400 shrink-0 mt-0.5" />
            <p>
              <strong className="text-purple-300">Inviolable Guardrails Active:</strong> Prompt templates and audio transcripts are automatically encapsulated in strict XML boundaries to prevent prompt override or malicious meta-prompting.
            </p>
          </div>

          {/* Collapsible Live Preview Drawer */}
          <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950/30">
            <button
              type="button"
              onClick={() => setShowLivePreview(!showLivePreview)}
              className="w-full flex items-center justify-between px-3.5 py-2 text-[11px] text-purple-300 hover:text-purple-200 transition"
            >
              <span>{showLivePreview ? 'Hide Live Interpolated Preview' : 'Show Live Interpolated Preview & XML Fencing'}</span>
              {showLivePreview ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            {showLivePreview && previewContent.rendered && (
              <div className="px-3.5 pb-3 text-[11px] font-mono text-zinc-400 whitespace-pre-wrap border-t border-zinc-800/60 pt-2 bg-black/30 max-h-48 overflow-y-auto">
                <div className="text-[10px] text-emerald-400 font-semibold mb-1">=== Rendered Prompt Preview ===</div>
                {previewContent.rendered}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-800 bg-[#141418]">
          <button
            type="button"
            onClick={handleResetToDefault}
            className="flex items-center space-x-1 text-xs text-zinc-400 hover:text-zinc-200 transition"
            title="Revert only this preset to its global default"
          >
            <RotateCcw size={12} />
            <span>Reset to Defaults</span>
          </button>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-lg font-medium text-xs transition ${
                savedSuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/30'
              }`}
            >
              {savedSuccess ? (
                <>
                  <Check size={14} />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Save Session Settings</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

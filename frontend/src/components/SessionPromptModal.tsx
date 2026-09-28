import React, { useState, useEffect } from 'react';
import { X, Sparkles, RotateCcw, ChevronDown, ChevronUp, FileText, Image as ImageIcon, Check } from 'lucide-react';
import { Session } from '../types';

interface SessionPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: Session | null;
  onSavePrompts: (promptHighlight: string, promptImage: string) => void;
  defaultPrompts: { highlight: string; image: string };
}

interface PresetOption {
  label: string;
  snippet: string;
}

const PRESET_OPTIONS: PresetOption[] = [
  {
    label: '💼 Virtual Interview',
    snippet: '\n\nRole: Virtual Interview Copilot.\n- Help me formulate crisp, confident answers using the STAR method.\n- Highlight critical talking points and avoid rambling.',
  },
  {
    label: '🌱 Layman / Non-Technical',
    snippet: '\n\nAudience: Non-technical stakeholder.\n- Explain all concepts using plain, everyday analogies without jargon.',
  },
  {
    label: '📋 Executive Briefing',
    snippet: '\n\nFormat: Executive Summary.\n- Bullet points only, bottom-line upfront, with decisions and next steps highlighted.',
  },
  {
    label: '💻 Tech Architecture',
    snippet: '\n\nRole: Senior Staff Software Architect.\n- Analyze technical trade-offs, system scalability, and code correctness in detail.',
  },
];

export const SessionPromptModal: React.FC<SessionPromptModalProps> = ({
  isOpen,
  onClose,
  session,
  onSavePrompts,
  defaultPrompts,
}) => {
  const [activeTab, setActiveTab] = useState<'highlight' | 'image'>('highlight');
  const [highlightPrompt, setHighlightPrompt] = useState<string>('');
  const [imagePrompt, setImagePrompt] = useState<string>('');
  const [showDefaultTemplate, setShowDefaultTemplate] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (session) {
      setHighlightPrompt(session.prompt_highlight || '');
      setImagePrompt(session.prompt_image || '');
    } else {
      setHighlightPrompt('');
      setImagePrompt('');
    }
    setSavedSuccess(false);
  }, [session, isOpen]);

  if (!isOpen) return null;

  const currentPrompt = activeTab === 'highlight' ? highlightPrompt : imagePrompt;
  const defaultTemplate = activeTab === 'highlight' ? defaultPrompts.highlight : defaultPrompts.image;

  const handlePromptChange = (val: string) => {
    if (activeTab === 'highlight') {
      setHighlightPrompt(val);
    } else {
      setImagePrompt(val);
    }
  };

  const handleAppendPreset = (snippet: string) => {
    const existing = currentPrompt.trim();
    const updated = existing ? `${existing}${snippet}` : `${defaultTemplate}${snippet}`;
    handlePromptChange(updated);
  };

  const handleResetToDefault = () => {
    handlePromptChange('');
  };

  const handleSave = () => {
    onSavePrompts(highlightPrompt.trim(), imagePrompt.trim());
    setSavedSuccess(true);
    setTimeout(() => {
      onClose();
    }, 400);
  };

  const isCustomized = Boolean(currentPrompt.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh] text-zinc-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 bg-[#141418]">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-purple-950/80 border border-purple-800/60 flex items-center justify-center text-purple-400">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <span>Per-Conversation AI Prompts</span>
                {session?.title && (
                  <span className="text-[11px] font-normal text-zinc-400 max-w-[200px] truncate" title={session.title}>
                    ({session.title})
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-zinc-400">
                Customize system instructions & persona for this conversation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-zinc-800 bg-zinc-950/40 px-5 pt-2">
          <button
            onClick={() => setActiveTab('highlight')}
            className={`flex items-center space-x-2 px-3 py-2 text-xs font-medium border-b-2 transition -mb-px ${
              activeTab === 'highlight'
                ? 'border-purple-500 text-purple-300 bg-purple-950/20'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FileText size={14} />
            <span>Audio Highlight Prompt</span>
            {highlightPrompt.trim() && (
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('image')}
            className={`flex items-center space-x-2 px-3 py-2 text-xs font-medium border-b-2 transition -mb-px ${
              activeTab === 'image'
                ? 'border-purple-500 text-purple-300 bg-purple-950/20'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ImageIcon size={14} />
            <span>Screenshot Vision Prompt</span>
            {imagePrompt.trim() && (
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            )}
          </button>
        </div>

        {/* Main Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Status Banner */}
          <div className="flex items-center justify-between text-[11px] px-3 py-1.5 rounded-lg bg-zinc-800/40 border border-zinc-700/40">
            <span className="text-zinc-400">
              Current state:{' '}
              <strong className={isCustomized ? 'text-purple-300' : 'text-emerald-400'}>
                {isCustomized ? 'Custom Instruction Active' : 'Using Standard Ambient Default'}
              </strong>
            </span>
            {isCustomized && (
              <button
                onClick={handleResetToDefault}
                className="flex items-center space-x-1 text-purple-400 hover:text-purple-300 underline"
              >
                <RotateCcw size={11} />
                <span>Revert to Default</span>
              </button>
            )}
          </div>

          {/* Quick Preset Chips */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-zinc-400">
              Quick Persona Additions:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_OPTIONS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => handleAppendPreset(p.snippet)}
                  className="px-2.5 py-1 rounded-full bg-zinc-800 hover:bg-purple-900/40 border border-zinc-700 hover:border-purple-700/60 text-zinc-300 hover:text-purple-200 text-[11px] transition"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-zinc-300">
                {activeTab === 'highlight'
                  ? 'Custom Highlight System Instruction:'
                  : 'Custom Vision System Instruction:'}
              </label>
              <span className="text-[10px] text-zinc-500">
                Leave empty to use default
              </span>
            </div>
            <textarea
              rows={7}
              value={currentPrompt}
              onChange={(e) => handlePromptChange(e.target.value)}
              placeholder={`Leave blank to use default instruction, or enter custom instructions (e.g., "Act as an interview coach...", "Explain to a 10 year old...")`}
              className="w-full bg-zinc-950/80 border border-zinc-700 rounded-xl p-3 text-xs text-zinc-100 placeholder-zinc-500 font-mono leading-relaxed focus:outline-none focus:border-purple-500 transition resize-y"
            />
          </div>

          {/* Collapsible Default Template Preview */}
          <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950/30">
            <button
              type="button"
              onClick={() => setShowDefaultTemplate(!showDefaultTemplate)}
              className="w-full flex items-center justify-between px-3.5 py-2 text-[11px] text-zinc-400 hover:text-zinc-200 transition"
            >
              <span>View Default System Instruction Template</span>
              {showDefaultTemplate ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            {showDefaultTemplate && (
              <div className="px-3.5 pb-3 text-[11px] font-mono text-zinc-400 whitespace-pre-wrap border-t border-zinc-800/60 pt-2 bg-black/20">
                {defaultTemplate}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-800 bg-[#141418]">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition text-xs"
          >
            Cancel
          </button>
          <div className="flex items-center space-x-2">
            <button
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
                <span>Save Prompts</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

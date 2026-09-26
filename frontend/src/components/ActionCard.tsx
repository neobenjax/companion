import React, { useState } from 'react';
import { Play, Check, Copy, X, Loader2, Sparkles } from 'lucide-react';
import { ActionCardData } from '../types';
import { pywebviewService } from '../services/pywebview';

interface ActionCardProps {
  card: ActionCardData;
  onUpdateCard: (updated: ActionCardData) => void;
}

export const ActionCard: React.FC<ActionCardProps> = ({ card, onUpdateCard }) => {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleExecute = async () => {
    setLoading(true);
    try {
      const res = await pywebviewService.executeActionCard(card.actionId, card.toolName, card.parameters);
      onUpdateCard({
        ...card,
        status: 'executed',
        result: res.result || 'Executed successfully',
      });
    } catch (e: any) {
      onUpdateCard({
        ...card,
        status: 'executed',
        result: `Error: ${e?.message || e}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    onUpdateCard({
      ...card,
      status: 'dismissed',
    });
  };

  const handleCopy = async () => {
    const textToCopy = card.parameters?.text || card.description || card.title;
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (card.status === 'dismissed') {
    return (
      <div className="py-1 px-2.5 rounded bg-zinc-900/50 border border-zinc-800 text-[11px] text-zinc-500 italic flex items-center justify-between">
        <span>Action dismissed: {card.title}</span>
      </div>
    );
  }

  return (
    <div className="my-2 p-3 rounded-lg bg-zinc-900/90 border border-purple-900/50 shadow-sm shadow-purple-950/20 text-xs text-zinc-200">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center space-x-1.5">
            <Sparkles size={13} className="text-purple-400" />
            <span className="font-semibold text-zinc-100">{card.title}</span>
            <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-purple-300 font-mono">
              {card.toolName}
            </span>
          </div>
          <p className="text-zinc-400 text-[11px]">{card.description}</p>
        </div>

        {card.status === 'pending' && (
          <button
            onClick={handleDismiss}
            className="text-zinc-500 hover:text-zinc-300 p-0.5"
            title="Dismiss action"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {card.status === 'executed' && card.result && (
        <div className="mt-2.5 p-2 rounded bg-zinc-950/70 border border-emerald-900/40 text-emerald-300 text-[11px] font-mono">
          <div className="flex items-center space-x-1 mb-0.5 text-emerald-400 font-semibold">
            <Check size={11} />
            <span>Output</span>
          </div>
          <div className="whitespace-pre-wrap">
            {typeof card.result === 'object' ? JSON.stringify(card.result, null, 2) : String(card.result)}
          </div>
        </div>
      )}

      {card.status === 'pending' && (
        <div className="mt-2.5 flex items-center space-x-2 pt-1 border-t border-zinc-800/80">
          <button
            onClick={handleExecute}
            disabled={loading}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 active:scale-[0.98] text-white font-medium text-[11px] transition shadow"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Play size={11} />}
            <span>Execute</span>
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] transition"
          >
            {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      )}
    </div>
  );
};

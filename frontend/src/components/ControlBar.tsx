import React, { useState } from 'react';
import { Square, Play, Pause, Send, Zap, MoreHorizontal, Mic, Sparkles } from 'lucide-react';
import { RecordingState } from '../types';

interface ControlBarProps {
  recordingState: RecordingState;
  onStartRecord: () => void;
  onPauseRecord: () => void;
  onResumeRecord: () => void;
  onStopRecord: () => void;
  onTriggerIntent: () => void;
  onSendMessage: (text: string) => void;
  audioHotkey: string;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  recordingState,
  onStartRecord,
  onPauseRecord,
  onResumeRecord,
  onStopRecord,
  onTriggerIntent,
  onSendMessage,
  audioHotkey,
}) => {
  const [inputText, setInputText] = useState('');

  const handleSend = () => {
    if (inputText.trim()) {
      onSendMessage(inputText.trim());
      setInputText('');
    }
  };

  const isRecording = recordingState.is_recording;
  const isPaused = recordingState.is_paused;

  // Format hotkey display e.g. <ctrl>+<shift>+a -> Ctrl+Shift+A
  const displayHotkey = audioHotkey
    .replace(/<|>/g, '')
    .split('+')
    .map((k) => k.charAt(0).toUpperCase() + k.slice(1))
    .join('+');

  return (
    <div className="p-3 bg-zinc-950/80 border-t border-zinc-800/80 backdrop-blur-md space-y-2">
      <div className="flex items-center space-x-2">
        {/* Left Record Control Pill (Granola style) */}
        <div className="flex items-center space-x-1.5 p-1 rounded-full bg-zinc-900 border border-zinc-800 shadow shrink-0">
          {!isRecording ? (
            <button
              onClick={onStartRecord}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-red-600 hover:bg-red-500 text-white font-medium text-xs transition active:scale-95 shadow-sm"
              title="Start recording audio & transcribing"
            >
              <Mic size={13} className="text-white" />
              <span>Record</span>
            </button>
          ) : (
            <>
              <button
                onClick={onStopRecord}
                className="p-1.5 rounded-full bg-red-600/90 hover:bg-red-500 text-white transition active:scale-95 shadow-sm"
                title="Stop recording"
              >
                <Square size={13} fill="currentColor" />
              </button>

              {isPaused ? (
                <button
                  onClick={onResumeRecord}
                  className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-300 transition"
                  title="Resume recording"
                >
                  <Play size={13} fill="currentColor" />
                </button>
              ) : (
                <button
                  onClick={onPauseRecord}
                  className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-300 transition"
                  title="Pause recording"
                >
                  <Pause size={13} />
                </button>
              )}
            </>
          )}

          <button
            onClick={onTriggerIntent}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-purple-950/70 hover:bg-purple-900/80 border border-purple-800/50 text-purple-200 text-xs font-medium transition active:scale-95 shadow-sm"
            title={`Highlight recent transcript (${displayHotkey})`}
          >
            <Sparkles size={12} className="text-purple-400" />
            <span>{displayHotkey} Highlight</span>
          </button>
        </div>

        {/* Right Input Bar (Granola "Ask anything" style) */}
        <div className="flex-1 relative flex items-center">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask anything or prompt copilot..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-full pl-4 pr-9 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-purple-600/60 shadow-inner"
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim()}
            className="absolute right-1.5 p-1.5 rounded-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:hover:bg-purple-600 text-white transition active:scale-95"
          >
            <Send size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { Square, Play, Pause, Mic, Sparkles, Camera, Crosshair, Monitor, AppWindow } from 'lucide-react';
import { RecordingState, CaptureTarget } from '../types';

interface ControlBarProps {
  recordingState: RecordingState;
  onStartRecord: () => void;
  onPauseRecord: () => void;
  onResumeRecord: () => void;
  onStopRecord: () => void;
  onTriggerHighlight: () => void;
  audioHotkey: string;
  visionHotkey: string;
  selectedTarget: CaptureTarget | null;
  onOpenTargetPicker: () => void;
  onTakeScreenshot: () => void;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  recordingState,
  onStartRecord,
  onPauseRecord,
  onResumeRecord,
  onStopRecord,
  onTriggerHighlight,
  audioHotkey,
  visionHotkey,
  selectedTarget,
  onOpenTargetPicker,
  onTakeScreenshot,
}) => {
  const isRecording = recordingState.is_recording;
  const isPaused = recordingState.is_paused;

  // Format hotkey displays
  const formatKey = (keyStr: string) =>
    (keyStr || '')
      .replace(/<|>/g, '')
      .split('+')
      .map((k) => k.charAt(0).toUpperCase() + k.slice(1))
      .join('+');

  const displayAudioHotkey = formatKey(audioHotkey);
  const displayVisionHotkey = formatKey(visionHotkey);

  // Target label
  const targetLabel = selectedTarget
    ? selectedTarget.name.length > 26
      ? selectedTarget.name.slice(0, 26) + '...'
      : selectedTarget.name
    : 'Select Target';

  return (
    <div className="p-2.5 bg-zinc-950/90 border-t border-zinc-800/80 backdrop-blur-md">
      <div className="flex items-center justify-between gap-2 flex-wrap w-full">
        {/* Record & Highlight Pill */}
        <div className="flex items-center space-x-1 p-1 rounded-full bg-zinc-900 border border-zinc-800 shadow shrink-0 max-w-full">
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
            onClick={onTriggerHighlight}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-purple-950/70 hover:bg-purple-900/80 border border-purple-800/50 text-purple-200 text-xs font-medium transition active:scale-95 shadow-sm"
            title={`Highlight recent transcript (${displayAudioHotkey})`}
          >
            <Sparkles size={12} className="text-purple-400" />
            <span>{displayAudioHotkey} Highlight</span>
          </button>
        </div>

        {/* Vision Controls: Target Picker & Screenshot Trigger */}
        <div className="flex items-center space-x-1 p-1 rounded-full bg-zinc-900 border border-zinc-800 shadow shrink-0 max-w-full">
          {/* Target Selection Button */}
          <button
            onClick={onOpenTargetPicker}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition active:scale-95 shadow-sm ${
              selectedTarget
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-purple-500/40'
                : 'bg-zinc-800/60 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-dashed border-zinc-700'
            }`}
            title="Choose a window, application, or screen to track"
          >
            {selectedTarget?.type === 'screen' ? (
              <Monitor size={12} className="text-purple-400" />
            ) : selectedTarget?.type === 'window' ? (
              <AppWindow size={12} className="text-purple-400" />
            ) : (
              <Crosshair size={12} className="text-zinc-400" />
            )}
            <span className="truncate max-w-[170px]">{targetLabel}</span>
          </button>

          {/* Screenshot Button */}
          <button
            onClick={onTakeScreenshot}
            disabled={!selectedTarget}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition shadow-sm ${
              selectedTarget
                ? 'bg-purple-600 hover:bg-purple-500 text-white active:scale-95 cursor-pointer shadow-purple-600/20 shadow-md'
                : 'bg-zinc-800/40 text-zinc-500 border border-zinc-800/80 cursor-not-allowed opacity-60'
            }`}
            title={
              selectedTarget
                ? `Take snapshot of ${selectedTarget.name} (${displayVisionHotkey})`
                : 'Select a target window or screen first'
            }
          >
            <Camera size={12} className={selectedTarget ? 'text-white' : 'text-zinc-600'} />
            <span>Screenshot [{displayVisionHotkey}]</span>
          </button>
        </div>
      </div>
    </div>
  );
};

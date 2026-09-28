export interface TranscriptSegment {
  id: string;
  timestamp: number;
  speaker: 'me' | 'caller';
  text: string;
}

export interface ActionCardData {
  actionId: string;
  title: string;
  description: string;
  toolName: string;
  parameters: Record<string, any>;
  status: 'pending' | 'executed' | 'dismissed';
  result?: any;
}

export interface CaptureTarget {
  id: string;
  type: 'screen' | 'window';
  name: string;
  index?: number;
  hwnd?: number;
  width?: number;
  height?: number;
  is_primary?: boolean;
}

export interface CaptureTargetsResponse {
  screens: CaptureTarget[];
  applications: CaptureTarget[];
}

export interface ScreenshotData {
  id: string;
  target_type: 'screen' | 'window';
  target_id: string;
  target_title: string;
  image_path: string;
  thumbnail_url: string;
  width: number;
  height: number;
  timestamp: number;
  ai_response?: string;
  thought?: string;
}

export interface ChatMessage {
  id: string;
  type: 'transcript' | 'intent_trigger' | 'assistant' | 'user' | 'screenshot';
  timestamp: number;
  content?: string;
  speaker?: 'me' | 'caller';
  segmentId?: string;
  thought?: string;
  action_cards?: ActionCardData[];
  trigger?: 'hotkey' | 'user_input';
  hotkey?: string;
  lookback_sec?: number;
  excerpt?: string;
  highlight_segment_ids?: string[];
  screenshot?: ScreenshotData;
}

export interface HighlightData {
  id: string;
  messageId: string;
  text: string;
  speaker: 'me' | 'caller';
  timestamp: number;
  ai_response?: string;
  thought?: string;
  action_cards?: ActionCardData[];
  created_at: number;
  is_saved?: boolean;
}

export interface Session {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  notes?: string;
  notes_preview?: string;
  highlights?: HighlightData[];
  prompt_highlight?: string;
  prompt_image?: string;
  has_custom_prompts?: boolean;
}

export interface Settings {
  audio_intent_hotkey: string;
  vision_intent_hotkey: string;
  lookback_duration_sec: number;
  lookback_words?: number;
  whisper_model: string;
  input_device_index: number | null;
  loopback_device_index: number | null;
  gemini_api_key: string;
  always_on_top: boolean;
  window_opacity?: number;
  window_width?: number;
  window_height?: number;
}

export interface AudioDevice {
  index: number;
  name: string;
  is_default: boolean;
}

export interface AudioDevicesResponse {
  inputs: AudioDevice[];
  loopbacks: AudioDevice[];
}

export interface RecordingState {
  is_recording: boolean;
  is_paused: boolean;
}

import { 
  Settings, 
  AudioDevicesResponse, 
  RecordingState, 
  Session, 
  TranscriptSegment, 
  ChatMessage,
  CaptureTargetsResponse,
  CaptureTarget,
  ScreenshotData,
} from '../types';

declare global {
  interface Window {
    chrome?: {
      webview?: {
        postMessage: (message: string) => void;
      };
    };
    onBridgeResponse?: (resp: { id: string; result: any }) => void;
    pywebview?: {
      api: {
        get_settings: () => Promise<Settings>;
        save_settings: (settings: Partial<Settings>) => Promise<Settings>;
        get_audio_devices: () => Promise<AudioDevicesResponse>;
        start_recording: (sessionId?: string) => Promise<RecordingState>;
        pause_recording: () => Promise<RecordingState>;
        resume_recording: () => Promise<RecordingState>;
        stop_recording: () => Promise<RecordingState>;
        get_recording_state: () => Promise<RecordingState>;
        trigger_audio_intent: () => Promise<{ status: string }>;
        trigger_highlight: () => Promise<{ status: string; words: number }>;
        resize_window: (expand: boolean) => Promise<{ status: string; expanded: boolean; width: number }>;
        ask_ai_about_highlight: (sessionId: string, highlightId: string, text: string) => Promise<{ status: string }>;
        save_highlight: (sessionId: string, highlight: any) => Promise<{ status: string; highlights: any[] }>;
        delete_highlight: (sessionId: string, highlightId: string) => Promise<{ status: string; highlights: any[] }>;
        get_highlights: (sessionId: string) => Promise<any[]>;
        copy_to_clipboard: (text: string) => Promise<{ status: string; text: string }>;
        get_capture_targets: () => Promise<CaptureTargetsResponse>;
        set_selected_target: (target: any) => Promise<any>;
        capture_selected_target: (target?: any) => Promise<ScreenshotData | null>;
        copy_image_to_clipboard: (imagePath: string) => Promise<{ status: string; success: boolean }>;
        explain_image_with_ai: (sessionId: string, imageId: string, imagePath: string, prompt?: string, targetTitle?: string) => Promise<any>;
        send_user_message: (text: string) => Promise<any>;
        execute_action_card: (actionId: string, toolName: string, params: any) => Promise<any>;
        get_sessions: () => Promise<Session[]>;
        create_session: (title: string) => Promise<Session>;
        get_session: (id: string) => Promise<any>;
        save_session: (id: string, title: string, notes: string, messages: any[], highlights?: any[]) => Promise<boolean>;
        delete_session: (id: string) => Promise<boolean>;
        toggle_always_on_top: () => Promise<boolean>;
        minimize_window: () => Promise<void>;
        close_window: () => Promise<void>;
      };
    };
    onNewTranscript?: (segment: TranscriptSegment) => void;
    onHotkeyTriggered?: (data: any) => void;
    onRecordingStateChanged?: (state: RecordingState) => void;
    onTriggerHighlight?: (data: { words: number }) => void;
    onHighlightAiResponse?: (data: { session_id: string; highlight_id: string; ai_response: string; thought?: string; action_cards?: any[]; error?: string }) => void;
    onNewScreenshot?: (data: ScreenshotData) => void;
    onVisionAiResponse?: (data: { session_id: string; image_id: string; image_path: string; target_title?: string; ai_response: string; thought?: string; error?: string }) => void;
    onScreenshotError?: (data: { message: string }) => void;
  }
}

type TranscriptListener = (segment: TranscriptSegment) => void;
type HotkeyListener = (data: any) => void;
type StateListener = (state: RecordingState) => void;
type TriggerHighlightListener = (data: { words: number }) => void;
type HighlightAiListener = (data: { session_id: string; highlight_id: string; ai_response: string; thought?: string; action_cards?: any[]; error?: string }) => void;
type ScreenshotListener = (data: ScreenshotData) => void;
type VisionAiListener = (data: { session_id: string; image_id: string; image_path: string; target_title?: string; ai_response: string; thought?: string; error?: string }) => void;
type ScreenshotErrorListener = (data: { message: string }) => void;

class PyWebViewService {
  private transcriptListeners: Set<TranscriptListener> = new Set();
  private hotkeyListeners: Set<HotkeyListener> = new Set();
  private stateListeners: Set<StateListener> = new Set();
  private triggerHighlightListeners: Set<TriggerHighlightListener> = new Set();
  private highlightAiListeners: Set<HighlightAiListener> = new Set();
  private screenshotListeners: Set<ScreenshotListener> = new Set();
  private visionAiListeners: Set<VisionAiListener> = new Set();
  private screenshotErrorListeners: Set<ScreenshotErrorListener> = new Set();
  private readyPromise: Promise<boolean> | null = null;

  constructor() {
    this.initEventListeners();
  }

  private initEventListeners() {
    window.onNewTranscript = (segment: TranscriptSegment) => {
      this.transcriptListeners.forEach((cb) => cb(segment));
    };

    window.onHotkeyTriggered = (data: any) => {
      this.hotkeyListeners.forEach((cb) => cb(data));
    };

    window.onRecordingStateChanged = (state: RecordingState) => {
      this.stateListeners.forEach((cb) => cb(state));
    };

    window.onTriggerHighlight = (data: { words: number }) => {
      this.triggerHighlightListeners.forEach((cb) => cb(data));
    };

    window.onHighlightAiResponse = (data: any) => {
      this.highlightAiListeners.forEach((cb) => cb(data));
    };

    window.onNewScreenshot = (data: ScreenshotData) => {
      this.screenshotListeners.forEach((cb) => cb(data));
    };

    window.onVisionAiResponse = (data: any) => {
      this.visionAiListeners.forEach((cb) => cb(data));
    };

    window.onScreenshotError = (data: { message: string }) => {
      this.screenshotErrorListeners.forEach((cb) => cb(data));
    };
  }

  public onTranscript(cb: TranscriptListener): () => void {
    this.transcriptListeners.add(cb);
    return () => this.transcriptListeners.delete(cb);
  }

  public onHotkey(cb: HotkeyListener): () => void {
    this.hotkeyListeners.add(cb);
    return () => this.hotkeyListeners.delete(cb);
  }

  public onRecordingState(cb: StateListener): () => void {
    this.stateListeners.add(cb);
    return () => this.stateListeners.delete(cb);
  }

  public onTriggerHighlight(cb: TriggerHighlightListener): () => void {
    this.triggerHighlightListeners.add(cb);
    return () => this.triggerHighlightListeners.delete(cb);
  }

  public onHighlightAiResponse(cb: HighlightAiListener): () => void {
    this.highlightAiListeners.add(cb);
    return () => this.highlightAiListeners.delete(cb);
  }

  public onScreenshot(cb: ScreenshotListener): () => void {
    this.screenshotListeners.add(cb);
    return () => this.screenshotListeners.delete(cb);
  }

  public onVisionAi(cb: VisionAiListener): () => void {
    this.visionAiListeners.add(cb);
    return () => this.visionAiListeners.delete(cb);
  }

  public onScreenshotError(cb: ScreenshotErrorListener): () => void {
    this.screenshotErrorListeners.add(cb);
    return () => this.screenshotErrorListeners.delete(cb);
  }

  private async waitForBridge(timeoutMs = 3000): Promise<boolean> {
    if (window.pywebview?.api) return true;
    if (this.readyPromise) return this.readyPromise;

    this.readyPromise = new Promise<boolean>((resolve) => {
      let resolved = false;
      const onReady = () => {
        if (!resolved) {
          resolved = true;
          window.removeEventListener('pywebviewready', onReady);
          resolve(true);
        }
      };
      window.addEventListener('pywebviewready', onReady);
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          window.removeEventListener('pywebviewready', onReady);
          resolve(!!window.pywebview?.api);
        }
      }, timeoutMs);
    });

    return this.readyPromise;
  }

  private async callBridge(method: string, args: any[] = []): Promise<any> {
    await this.waitForBridge();

    // 1. Pywebview API (first priority)
    if (window.pywebview?.api && typeof (window.pywebview.api as any)[method] === 'function') {
      try {
        const fn = (window.pywebview.api as any)[method];
        return await fn(...args);
      } catch (err) {
        console.error(`Error in pywebview bridge call [${method}]:`, err);
        throw err;
      }
    }

    // 2. Fallback mock for pure browser dev / testing
    return null;
  }

  public async getSettings(): Promise<Settings> {
    const res = await this.callBridge('get_settings');
    if (res) return res;
    return {
      audio_intent_hotkey: '<ctrl>+<shift>+a',
      vision_intent_hotkey: '<ctrl>+<shift>+v',
      lookback_duration_sec: 10,
      whisper_model: 'base.en',
      input_device_index: null,
      loopback_device_index: null,
      gemini_api_key: '',
      always_on_top: true,
    };
  }

  public async saveSettings(settings: Partial<Settings>): Promise<Settings> {
    const res = await this.callBridge('save_settings', [settings]);
    if (res) return res;
    return settings as Settings;
  }

  public async getAudioDevices(): Promise<AudioDevicesResponse> {
    const res = await this.callBridge('get_audio_devices');
    if (res) return res;
    return {
      inputs: [{ index: 0, name: 'Default Microphone (WASAPI)', is_default: true }],
      loopbacks: [{ index: 1, name: 'Default Speakers Loopback (WASAPI)', is_default: true }],
    };
  }

  public async startRecording(sessionId?: string): Promise<RecordingState> {
    const res = await this.callBridge('start_recording', [sessionId]);
    if (res) return res;
    const state = { is_recording: true, is_paused: false };
    if (window.onRecordingStateChanged) window.onRecordingStateChanged(state);
    return state;
  }

  public async pauseRecording(): Promise<RecordingState> {
    const res = await this.callBridge('pause_recording');
    if (res) return res;
    const state = { is_recording: true, is_paused: true };
    if (window.onRecordingStateChanged) window.onRecordingStateChanged(state);
    return state;
  }

  public async resumeRecording(): Promise<RecordingState> {
    const res = await this.callBridge('resume_recording');
    if (res) return res;
    const state = { is_recording: true, is_paused: false };
    if (window.onRecordingStateChanged) window.onRecordingStateChanged(state);
    return state;
  }

  public async stopRecording(): Promise<RecordingState> {
    const res = await this.callBridge('stop_recording');
    if (res) return res;
    const state = { is_recording: false, is_paused: false };
    if (window.onRecordingStateChanged) window.onRecordingStateChanged(state);
    return state;
  }

  public async triggerAudioIntent(): Promise<void> {
    await this.callBridge('trigger_audio_intent');
  }

  public async triggerHighlight(): Promise<void> {
    await this.callBridge('trigger_highlight');
  }

  public async resizeWindow(expand: boolean): Promise<{ status: string; expanded: boolean; width: number }> {
    const res = await this.callBridge('resize_window', [expand]);
    return res || { status: 'ok', expanded: expand, width: expand ? 860 : 460 };
  }

  public async askAiAboutHighlight(sessionId: string, highlightId: string, text: string): Promise<any> {
    return await this.callBridge('ask_ai_about_highlight', [sessionId, highlightId, text]);
  }

  public async saveHighlight(sessionId: string, highlight: any): Promise<any> {
    return await this.callBridge('save_highlight', [sessionId, highlight]);
  }

  public async deleteHighlight(sessionId: string, highlightId: string): Promise<any[]> {
    const res = await this.callBridge('delete_highlight', [sessionId, highlightId]);
    return res?.highlights || [];
  }

  public async getHighlights(sessionId: string): Promise<any[]> {
    const res = await this.callBridge('get_highlights', [sessionId]);
    return res || [];
  }

  public async copyToClipboard(text: string): Promise<void> {
    await this.callBridge('copy_to_clipboard', [text]);
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  }

  public async getCaptureTargets(): Promise<CaptureTargetsResponse> {
    const res = await this.callBridge('get_capture_targets');
    return res || { screens: [], applications: [] };
  }

  public async setSelectedTarget(target: any): Promise<any> {
    return await this.callBridge('set_selected_target', [target]);
  }

  public async captureSelectedTarget(target?: any): Promise<ScreenshotData | null> {
    return await this.callBridge('capture_selected_target', target ? [target] : []);
  }

  public async copyImageToClipboard(imagePath: string): Promise<{ status: string; success: boolean }> {
    const res = await this.callBridge('copy_image_to_clipboard', [imagePath]);
    return res || { status: 'failed', success: false };
  }

  public async explainImageWithAi(sessionId: string, imageId: string, imagePath: string, prompt?: string, targetTitle?: string): Promise<any> {
    return await this.callBridge('explain_image_with_ai', [sessionId, imageId, imagePath, prompt || '', targetTitle || '']);
  }

  public async deleteScreenshot(imageId: string, imagePath: string): Promise<{ status: string; deleted: boolean }> {
    const res = await this.callBridge('delete_screenshot', [imageId, imagePath]);
    return res || { status: 'failed', deleted: false };
  }

  public async sendUserMessage(text: string): Promise<any> {
    const res = await this.callBridge('send_user_message', [text]);
    if (res) return res;
    return {
      trigger: 'user_input',
      content: `Echo response for: ${text}`,
      thought: 'Processed in browser fallback mode',
      action_cards: [],
      timestamp: Date.now() / 1000,
    };
  }

  public async executeActionCard(actionId: string, toolName: string, params: any): Promise<any> {
    const res = await this.callBridge('execute_action_card', [actionId, toolName, params]);
    if (res) return res;
    if (toolName === 'copy_clipboard') {
      await navigator.clipboard.writeText(params.text || '');
    }
    return { status: 'executed', actionId, result: 'Executed action in fallback' };
  }

  public async getSessions(): Promise<Session[]> {
    const res = await this.callBridge('get_sessions');
    if (res) return res;
    return [];
  }

  public async createSession(title: string = 'New note'): Promise<Session> {
    const res = await this.callBridge('create_session', [title]);
    if (res) return res;
    return {
      id: `sess_${Date.now()}`,
      title,
      created_at: Date.now() / 1000,
      updated_at: Date.now() / 1000,
    };
  }

  public async getSession(id: string): Promise<any> {
    const res = await this.callBridge('get_session', [id]);
    return res;
  }

  public async saveSession(id: string, title: string, notes: string, messages: any[], highlights?: any[]): Promise<boolean> {
    const res = await this.callBridge('save_session', [id, title, notes, messages, highlights || []]);
    return res ?? true;
  }

  public async deleteSession(id: string): Promise<boolean> {
    const res = await this.callBridge('delete_session', [id]);
    return res ?? true;
  }

  public async toggleAlwaysOnTop(): Promise<boolean> {
    const res = await this.callBridge('toggle_always_on_top');
    return res ?? true;
  }

  public async minimizeWindow(): Promise<void> {
    await this.callBridge('minimize_window');
  }

  public async closeWindow(): Promise<void> {
    await this.callBridge('close_window');
  }
}

export const pywebviewService = new PyWebViewService();

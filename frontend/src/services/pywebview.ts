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
  PromptPreset,
  PresetCategory,
  ActiveContextInfo,
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
        resize_window: (expand: boolean, width?: number) => Promise<{ status: string; expanded: boolean; width: number }>;
        ask_ai_about_highlight: (sessionId: string, highlightId: string, text: string, customInstruction?: string | null, presetId?: string | null) => Promise<{ status: string }>;
        save_highlight: (sessionId: string, highlight: any) => Promise<{ status: string; highlights: any[] }>;
        delete_highlight: (sessionId: string, highlightId: string) => Promise<{ status: string; highlights: any[] }>;
        get_highlights: (sessionId: string) => Promise<any[]>;
        copy_to_clipboard: (text: string) => Promise<{ status: string; text: string }>;
        get_capture_targets: () => Promise<CaptureTargetsResponse>;
        set_selected_target: (target: any) => Promise<any>;
        capture_selected_target: (target?: any) => Promise<ScreenshotData | null>;
        copy_image_to_clipboard: (imagePath: string) => Promise<{ status: string; success: boolean }>;
        explain_image_with_ai: (sessionId: string, imageId: string, imagePath: string, prompt?: string, targetTitle?: string, customInstruction?: string | null, presetId?: string | null) => Promise<any>;
        send_user_message: (text: string) => Promise<any>;
        execute_action_card: (actionId: string, toolName: string, params: any) => Promise<any>;
        get_sessions: () => Promise<Session[]>;
        create_session: (title: string) => Promise<Session>;
        save_session: (id: string, title: string, notes: string, messages: any[], highlights?: any[], prompt_highlight?: string, prompt_image?: string, active_audio_preset_id?: string, active_vision_preset_id?: string) => Promise<boolean>;
        delete_session: (id: string) => Promise<boolean>;
        get_default_prompts: () => Promise<{ highlight: string; image: string }>;
        get_presets: () => Promise<PromptPreset[]>;
        save_preset: (preset: PromptPreset) => Promise<{ status: string; preset?: PromptPreset }>;
        delete_preset: (presetId: string) => Promise<{ status: string; preset_id?: string }>;
        reset_presets_to_default: () => Promise<PromptPreset[]>;
        get_active_preset: (sessionId?: string, category?: string) => Promise<PromptPreset>;
        set_active_preset: (sessionId: string | null, category: string, presetId: string) => Promise<{ status: string }>;
        detect_active_context: () => Promise<ActiveContextInfo>;
        render_preset_preview: (presetId: string, sampleText?: string, windowTitle?: string) => Promise<{ status: string; rendered_prompt?: string; guarded_system_instruction?: string }>;
        set_window_opacity: (opacity: number) => Promise<{ status: string; opacity: number }>;
        get_window_opacity: () => Promise<number>;
        toggle_always_on_top: () => Promise<boolean>;
        minimize_window: () => Promise<void>;
        close_window: () => Promise<void>;
      };
    };
    onNewTranscript?: (segment: TranscriptSegment) => void;
    onSpeechActivity?: (data: { is_speaking: boolean; speaker: string }) => void;
    onHotkeyTriggered?: (data: any) => void;
    onRecordingStateChanged?: (state: RecordingState) => void;
    onTriggerHighlight?: (data: { words: number }) => void;
    onHighlightAiResponse?: (data: { session_id: string; highlight_id: string; ai_response: string; thought?: string; action_cards?: any[]; error?: string }) => void;
    onNewScreenshot?: (data: ScreenshotData) => void;
    onVisionAiResponse?: (data: { session_id: string; image_id: string; image_path: string; target_title?: string; ai_response: string; thought?: string; error?: string }) => void;
    onScreenshotError?: (data: { message: string }) => void;
    onTriggerPresetSwitcher?: () => void;
    onPresetsChanged?: (presets: PromptPreset[]) => void;
    onActivePresetChanged?: (data: { session_id?: string; category: string; preset_id: string }) => void;
  }
}

type TranscriptListener = (segment: TranscriptSegment) => void;
type SpeechActivityListener = (data: { is_speaking: boolean; speaker: string }) => void;
type HotkeyListener = (data: any) => void;
type StateListener = (state: RecordingState) => void;
type TriggerHighlightListener = (data: { words: number }) => void;
type HighlightAiListener = (data: { session_id: string; highlight_id: string; ai_response: string; thought?: string; action_cards?: any[]; error?: string }) => void;
type ScreenshotListener = (data: ScreenshotData) => void;
type VisionAiListener = (data: { session_id: string; image_id: string; image_path: string; target_title?: string; ai_response: string; thought?: string; error?: string }) => void;
type ScreenshotErrorListener = (data: { message: string }) => void;
type PresetSwitcherListener = () => void;
type PresetsChangedListener = (presets: PromptPreset[]) => void;
type ActivePresetChangedListener = (data: { session_id?: string; category: string; preset_id: string }) => void;

class PyWebViewService {
  private transcriptListeners: Set<TranscriptListener> = new Set();
  private hotkeyListeners: Set<HotkeyListener> = new Set();
  private stateListeners: Set<StateListener> = new Set();
  private triggerHighlightListeners: Set<TriggerHighlightListener> = new Set();
  private highlightAiListeners: Set<HighlightAiListener> = new Set();
  private screenshotListeners: Set<ScreenshotListener> = new Set();
  private visionAiListeners: Set<VisionAiListener> = new Set();
  private screenshotErrorListeners: Set<ScreenshotErrorListener> = new Set();
  private speechActivityListeners: Set<SpeechActivityListener> = new Set();
  private presetSwitcherListeners: Set<PresetSwitcherListener> = new Set();
  private presetsChangedListeners: Set<PresetsChangedListener> = new Set();
  private activePresetChangedListeners: Set<ActivePresetChangedListener> = new Set();

  constructor() {
    this.initEventListeners();
  }

  private initEventListeners() {
    window.onNewTranscript = (segment: TranscriptSegment) => {
      this.transcriptListeners.forEach((cb) => cb(segment));
    };

    window.onSpeechActivity = (data: { is_speaking: boolean; speaker: string }) => {
      this.speechActivityListeners.forEach((cb) => cb(data));
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

    window.onTriggerPresetSwitcher = () => {
      this.presetSwitcherListeners.forEach((cb) => cb());
    };

    window.onPresetsChanged = (presets: PromptPreset[]) => {
      this.presetsChangedListeners.forEach((cb) => cb(presets));
    };

    window.onActivePresetChanged = (data: { session_id?: string; category: string; preset_id: string }) => {
      this.activePresetChangedListeners.forEach((cb) => cb(data));
    };
  }

  public onTranscript(cb: TranscriptListener): () => void {
    this.transcriptListeners.add(cb);
    return () => this.transcriptListeners.delete(cb);
  }

  public onSpeechActivity(cb: SpeechActivityListener): () => void {
    this.speechActivityListeners.add(cb);
    return () => this.speechActivityListeners.delete(cb);
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

  public onTriggerPresetSwitcher(cb: PresetSwitcherListener): () => void {
    this.presetSwitcherListeners.add(cb);
    return () => this.presetSwitcherListeners.delete(cb);
  }

  public onPresetsChanged(cb: PresetsChangedListener): () => void {
    this.presetsChangedListeners.add(cb);
    return () => this.presetsChangedListeners.delete(cb);
  }

  public onActivePresetChanged(cb: ActivePresetChangedListener): () => void {
    this.activePresetChangedListeners.add(cb);
    return () => this.activePresetChangedListeners.delete(cb);
  }

  public isBridgeReady(): boolean {
    return Boolean(
      window.pywebview?.api &&
        typeof (window.pywebview.api as any).get_sessions === 'function'
    );
  }

  public async waitForBridge(timeoutMs = 12000): Promise<boolean> {
    if (this.isBridgeReady()) return true;

    return new Promise<boolean>((resolve) => {
      let resolved = false;

      const finish = (ok: boolean) => {
        if (!resolved) {
          resolved = true;
          window.removeEventListener('pywebviewready', onReady);
          clearInterval(interval);
          clearTimeout(timer);
          resolve(ok);
        }
      };

      const onReady = () => {
        if (this.isBridgeReady()) {
          finish(true);
        }
      };

      window.addEventListener('pywebviewready', onReady);

      // Fast active polling (every 40ms) to detect bridge immediately upon injection
      const interval = setInterval(() => {
        if (this.isBridgeReady()) {
          finish(true);
        }
      }, 40);

      const timer = setTimeout(() => {
        finish(this.isBridgeReady());
      }, timeoutMs);
    });
  }

  private async callBridge(method: string, args: any[] = [], timeoutMs = 10000): Promise<any> {
    await this.waitForBridge();

    // 1. Pywebview API (first priority)
    if (window.pywebview?.api && typeof (window.pywebview.api as any)[method] === 'function') {
      try {
        const fn = (window.pywebview.api as any)[method];
        let timer: any;
        const timeoutPromise = new Promise((_, reject) => {
          timer = setTimeout(() => {
            reject(new Error(`Timeout calling bridge method [${method}] after ${timeoutMs}ms`));
          }, timeoutMs);
        });

        const result = await Promise.race([fn(...args), timeoutPromise]);
        clearTimeout(timer);
        return result;
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

  public async resizeWindow(expand: boolean, width?: number): Promise<{ status: string; expanded: boolean; width: number }> {
    const res = await this.callBridge('resize_window', [expand, width]);
    return res || { status: 'ok', expanded: expand, width: width || (expand ? 960 : 560) };
  }

  public async askAiAboutHighlight(
    sessionId: string,
    highlightId: string,
    text: string,
    customInstruction?: string | null,
    presetId?: string | null
  ): Promise<any> {
    return await this.callBridge('ask_ai_about_highlight', [
      sessionId,
      highlightId,
      text,
      customInstruction ?? null,
      presetId ?? null,
    ]);
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

  public async explainImageWithAi(
    sessionId: string,
    imageId: string,
    imagePath: string,
    prompt?: string,
    targetTitle?: string,
    customInstruction?: string | null,
    presetId?: string | null
  ): Promise<any> {
    return await this.callBridge('explain_image_with_ai', [
      sessionId,
      imageId,
      imagePath,
      prompt || '',
      targetTitle || '',
      customInstruction ?? null,
      presetId ?? null,
    ]);
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

  public async saveSession(
    id: string,
    title: string,
    notes: string,
    messages: any[],
    highlights?: any[],
    promptHighlight?: string,
    promptImage?: string,
    activeAudioPresetId?: string,
    activeVisionPresetId?: string,
    presetPrompts?: Record<string, string>
  ): Promise<boolean> {
    const res = await this.callBridge('save_session', [
      id,
      title,
      notes,
      messages,
      highlights || [],
      promptHighlight !== undefined ? promptHighlight : null,
      promptImage !== undefined ? promptImage : null,
      activeAudioPresetId !== undefined ? activeAudioPresetId : null,
      activeVisionPresetId !== undefined ? activeVisionPresetId : null,
      presetPrompts !== undefined ? presetPrompts : null,
    ]);
    return res ?? true;
  }

  public async deleteSession(id: string): Promise<boolean> {
    const res = await this.callBridge('delete_session', [id]);
    return res ?? true;
  }

  public async getDefaultPrompts(): Promise<{ highlight: string; image: string }> {
    const res = await this.callBridge('get_default_prompts');
    if (res) return res;
    return {
      highlight: `You are an ambient Copilot embedded in a live meeting (like Granola and Antigravity).\nTone & Style:\n- Casual, clear, and friendly.\n- Explain any technical words or concepts in simple layman's terms so any reader can understand.\nFormatting:\n- Summarize the key information using clear bullet points.\n- Straight to the point without conversational filler, long dashes (like --- or —), or decorators.\n- Provide complete, well-formed, and comprehensive explanations.`,
      image: `You are an ambient multimodal Windows Copilot companion.\nAnalyze the provided screenshot with high precision.\nRULES:\n- Summary First: Begin with 1-2 concise sentences stating the purpose of what the user is doing or needs to know from the image.\n- Highlights: Use short bullet points to highlight only the most critical parts (active window, key content, errors, code, or data).\n- Tone: Casual and plain English. If technical terms are present, explain what they mean simply in layman's terms.\n- Formatting: No decorators, no long dashes (like --- or —). Provide a complete and well-structured breakdown.`,
    };
  }

  // -------------------------------------------------------------------------
  // Preset Engine API Calls
  // -------------------------------------------------------------------------
  public async getPresets(): Promise<PromptPreset[]> {
    const res = await this.callBridge('get_presets');
    if (Array.isArray(res)) return res;
    return [];
  }

  public async savePreset(preset: PromptPreset): Promise<{ status: string; preset?: PromptPreset }> {
    const res = await this.callBridge('save_preset', [preset]);
    return res || { status: 'error' };
  }

  public async deletePreset(presetId: string): Promise<{ status: string; preset_id?: string }> {
    const res = await this.callBridge('delete_preset', [presetId]);
    return res || { status: 'error' };
  }

  public async resetPresetsToDefault(): Promise<PromptPreset[]> {
    const res = await this.callBridge('reset_presets_to_default');
    if (Array.isArray(res)) return res;
    return [];
  }

  public async getActivePreset(sessionId?: string, category: PresetCategory = 'transcription'): Promise<PromptPreset> {
    const res = await this.callBridge('get_active_preset', [sessionId || null, category]);
    if (res && res.id) return res;
    return {
      id: category === 'vision' ? 'default-vision-ambient' : 'default-audio-ambient',
      name: category === 'vision' ? 'Standard Visual Assistant' : 'Standard Ambient Copilot',
      description: 'Default ambient companion preset',
      category,
      isBuiltIn: true,
      targetAppPatterns: [],
      userPromptTemplate: '{{selected_text}}',
    };
  }

  public async setActivePreset(sessionId: string | null, category: PresetCategory, presetId: string): Promise<any> {
    return await this.callBridge('set_active_preset', [sessionId, category, presetId]);
  }

  public async detectActiveContext(): Promise<ActiveContextInfo> {
    const res = await this.callBridge('detect_active_context');
    if (res) return res;
    return {
      window_title: 'Active Window',
      process_name: 'explorer.exe',
      suggested_preset: null,
    };
  }

  public async renderPresetPreview(
    presetId: string,
    sampleText?: string,
    windowTitle?: string
  ): Promise<{ status: string; rendered_prompt?: string; guarded_system_instruction?: string }> {
    const res = await this.callBridge('render_preset_preview', [presetId, sampleText || '', windowTitle || '']);
    return res || { status: 'error' };
  }

  public async setWindowOpacity(opacity: number): Promise<{ status: string; opacity: number }> {
    // Clamp to 0.5 - 1.0
    const clamped = Math.max(0.5, Math.min(1.0, opacity));
    const res = await this.callBridge('set_window_opacity', [clamped]);
    // Apply CSS opacity fallback for dev browser preview
    try {
      document.documentElement.style.opacity = String(clamped);
    } catch {}
    if (res) return res;
    return { status: 'ok', opacity: clamped };
  }

  public async getWindowOpacity(): Promise<number> {
    const res = await this.callBridge('get_window_opacity');
    if (typeof res === 'number') return res;
    return 1.0;
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

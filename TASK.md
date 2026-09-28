## Phase 1: Planning & Requirements Specification
- [x] Initial specification and architectural review
- [x] Identify hardware, framework, and environment constraints (Python 3.13, Node 22, absence of Cargo/MSVC)
- [x] Align with user on missing details and architectural improvements (Native Python pywebview, 10s pre-transcribed text slicing, customizable hotkeys & lookback)
- [x] User approval of Implementation Plan

## Phase 2: MVP 1 - Ambient Audio & Core Copilot HUD
### Subtask 2.1: Project Scaffolding & Desktop Shell
- [x] Initialize repository structure (Vite + React 19 + TypeScript + Tailwind CSS + Lucide)
- [x] Configure Desktop Shell (pywebview EdgeChromium HUD, always-on-top, draggable header, multi-monitor auto-docking to primary screen)
- [x] Set up Python environment via `uv` (`pywebview`, `pyaudiowpatch`, `pynput`, `faster-whisper`, `google-antigravity`, `google-genai`)
- [x] Implement robust bi-directional API bridge between React UI and Python Engine (direct window.pywebview.api IPC + evaluate_js push)
- [x] Fix WebView2 cache, isolated UserDataFolder, and multi-monitor bounds positioning
- [x] Implement automatic Windows Station & Desktop routing (`WinSta0\Default`) to ensure physical screen visibility when launched from IDE sandbox terminal

### Subtask 2.2: Granola-Inspired UI & Historic Sessions
- [x] Build Collapsible Sidebar (Home, Historic Sessions grouped by date, Spaces, Settings, New Note button)
- [x] Build Main HUD view (Editable note title, date/participants pills, live transcript / chat stream, bottom control bar)
- [x] Build "Ask anything" bottom bar with quick prompts and action buttons
- [x] Build Settings Modal (Configure Global Hotkeys, Audio Devices, Model selector, API Key input)
- [x] Implement local SQLite session persistence for historic sessions and transcripts

### Subtask 2.3: Audio Capture & Real-time Transcription Engine
- [x] Implement dual-channel WASAPI capture via `pyaudiowpatch` (Microphone `me` + Loopback `caller`)
- [x] Adapt microphone stream to WASAPI native rates (44.1kHz/48kHz, stereo) with downmixing and resampling to 16kHz mono
- [x] Integrate Silero/Energy VAD gating (<0.5 speech discarded) with adaptive 2.0s-3.5s chunk pooling
- [x] Integrate `faster-whisper` (`base.en` / `small.en`) worker queue with standalone CTranslate2 engine (removed PyTorch dependency, automatic CUDA / INT8 CPU fallback)
- [x] Implement 15-minute rolling transcript ring buffer with timestamped speaker tagging
- [x] Fix PortAudio stream teardown in `stop_recording` to prevent native access violation crash
- [x] Implement continuous speech-to-text grouping and concatenation for identical speakers in the UI feed
- [x] Wire audio recording controls (`[Record]`, `[Pause]`, `[Stop]`) to IPC and UI status indicators

### Subtask 2.4: Global Hotkey Dispatcher & Audio Intent Analysis
- [x] Implement system-wide global shortcut registration (`Win+Shift+A` / `Ctrl+Shift+A`, fully customizable)
- [x] On hotkey press: slice the last 10 seconds of already-transcribed text
- [x] Visual UI highlight: highlight the triggered 10s excerpt in chat with pulsing glow badge
- [x] Dispatch to Google Antigravity Agent (`google-antigravity` / Gemini API / local math evaluator)
- [x] Render Antigravity 2.0-style intent response and interactive Action Cards (`[Execute]`, `[Dismiss]`, `[Copy]`)
- [x] Support direct user text prompts in "Ask anything" input box

### Subtask 2.5: Verification & MVP 1 Walkthrough
- [x] Automated unit test suite (test_buffer, test_agent, test_storage all passing)
- [x] End-to-end testing of bridge, device enumeration, intent execution, and Action Cards
- [x] Create detailed user walkthrough testing guide (walkthrough.md)

### Subtask 2.6: Refinements - In-Place Highlighting, Floating Actions & AI Threads
- [x] Implement in-place chat transcript highlighting (last 50 words within latest turn, marker style in caller/me accent color, no duplicate message boxes)
- [x] Configure word budget in Settings (default: 50 words, customizable slider)
- [x] Update bottom dock trigger button label: `${hotkey} Highlight`
- [x] Build Antigravity 2.0-style Floating Actions Prompt Modal above dock controls with hotkeys (`1` Ask AI, `2` Copy, `3` Save for later, `Esc` Skip, `Enter` Submit)
- [x] Add native pywebview window expansion to the left (460px -> 860px) via bridge `resize_window`
- [x] Build Right Sidepanel:
  - [x] Chronological "Saved Highlights" main list with smooth scroll-to-chat navigation
  - [x] "AI Thread" view with Antigravity SDK research/explanation query, thought trace, and stored thread persistence
  - [x] Top-right toolbar toggle icon to show/collapse panel and resize window
- [x] Wire clickable transcript highlights:
  - [x] If already answered -> open AI Thread view
  - [x] If not answered -> show Floating Actions modal
- [x] Ensure background audio capture and live Whisper transcription remain uninterrupted throughout all highlight and AI operations
- [x] End-to-end verification and updated walkthrough guide

## Phase 3: MVP 2 - Multimodal Window Tracking & Vision Copilot
### Subtask 3.1: Settings & UI Cleanups
- [x] Remove "Speech Lookback Duration" slider/module from SettingsModal; keep "Highlight Word Budget" slider
- [x] Add model selector dropdown (Gemini 2.0 Flash / Pro) with direct API key helper links
- [x] Confirm sandbox fallback mode behavior when API key is unset

### Subtask 3.2: Target Selection Popover & Dock Controls
- [x] Remove "Ask anything" input box from bottom control dock
- [x] Add "Select" button with popover menu containing "Screens" (monitors) and "Applications" (open top-level windows)
- [x] Update button label to display active target (e.g. `🎯 VS Code` or `🖥️ Screen 1`)
- [x] Add `Screenshot [Shortcut]` button (disabled until target selected)
- [x] Register global vision shortcut (`Ctrl+Shift+V` / `Win+Shift+V`)

### Subtask 3.3: Capture Engine & Clipboard Integration
- [x] Build Windows GDI `PrintWindow` (PW_RENDERFULLCONTENT) capture for application windows (with auto-restore if minimized)
- [x] Build `mss` hardware screen capture for physical monitors
- [x] Generate session high-res PNG and thumbnail data URI
- [x] Implement full-resolution clipboard copying via Win32 DIB / Pillow

### Subtask 3.4: Chat Thumbnail & Floating Actions Modal
- [x] Render screenshot thumbnail card in chat stream with target title, timestamp, and zoom preview
- [x] Adapt Floating Actions Modal for screenshot mode:
  - Option 1: "Explain this image using AI..." (`1` or `Enter`)
  - Option 2: "Copy to Clipboard" (`2`)
  - `Esc`: Skip
- [x] Handle thumbnail click in chat (open stored thread if answered, or prompt options if unanswered)

### Subtask 3.5: Multimodal Vision Agent & Expandable AI Thread Sidepanel
- [x] Implement Gemini 2.0 Vision API query in `AgentOrchestrator` (with sandbox simulated fallback)
- [x] Build Vision Thread view in Right Sidepanel with preview image, reasoning trace, and structured analysis
- [x] Add custom follow-up prompt input in Vision Thread view
- [x] Dynamic window expansion to 860px (expanding left) when viewing vision threads
- [x] End-to-end verification and updated walkthrough guide

## Phase 4: MVP 2 Refinements - Multi-Monitor Mixed-DPI, App Name Resolution, Controls & Persistence
### Subtask 4.1: Mixed-DPI Multi-Monitor Hardware Calibration
- [x] Enforce Per-Monitor DPI Awareness V2 (`SetProcessDpiAwarenessContext(-4)` & `SetThreadDpiAwarenessContext(-4)`)
- [x] Align monitor coordinates using `EnumDisplayMonitors` physical rects to eliminate image bleeding and black space on Screen 2 and Screen 3
- [x] Verify exact boundary capture for multi-monitor layouts (100% and 125% mixed scale)

### Subtask 4.2: Window Filtering & Application Process Resolution
- [x] Filter out cloaked windows via `DwmGetWindowAttribute(hwnd, DWMWA_CLOAKED)`
- [x] Filter out tool windows via `GWL_EXSTYLE` & `WS_EX_TOOLWINDOW` (eliminates ghost WhatsApp and GeForce Overlay)
- [x] Query owning process image name (`GetWindowThreadProcessId` + `GetModuleFileNameEx`)
- [x] Format target name as `[Application Name] - [Current Name]` (e.g. `[Antigravity] - Ambient Windows Copilot Plan`)

### Subtask 4.3: Floating Actions Modal - Option 3: Delete Screenshot
- [x] Add Option 3 (`Delete Screenshot`) to `FloatingActionsModal.tsx` (`3` or Del key)
- [x] Implement backend `delete_screenshot` to remove PNG from `~/.ambient_copilot/media/`
- [x] Erase screenshot message from chat feed and clear any active AI thread sidepanel

### Subtask 4.4: Customizable Vision Snapshot Shortcut in Settings
- [x] Add interactive shortcut recorder button for Vision Snapshot trigger in `SettingsModal.tsx`
- [x] Support recording and saving custom key combinations for vision capture

### Subtask 4.5: Chat Screenshot History & Note Persistence
- [x] Persist screenshot messages to active session in SQLite on capture, AI response, and deletion
- [x] Ensure switching session notes loads full chat history with screenshot cards, thumbnails, and AI thread metadata

### Subtask 4.6: Left Panel / Sidebar Overlay & Auto-Collapse
- [x] Convert `Sidebar` to an absolute overlay drawer with backdrop to prevent pushing/squeezing chat feed
- [x] Automatically close sidebar upon selecting a note in `selectSession`

### Subtask 4.7: Title Bar Drag vs Click Isolation
- [x] Confine `.drag-region` strictly to the title/brand element
- [x] Isolate control buttons from dragging (`onMouseDown={e => e.stopPropagation()}` and `no-drag`)

### Subtask 4.8: Expand Window Width for Single-Row Dock Buttons
- [x] Increase base window width to 560px (and expanded width to 960px) in config and window manager
- [x] Adjust `ControlBar.tsx` layout with `flex-nowrap` so all 4 buttons fit neatly in a single horizontal row
- [x] End-to-end verification and updated walkthrough guide

## Phase 5: Critical Bug Fixes - Persistence, Switching, Scoped Highlights, Window Positioning & Dock Responsiveness
### Subtask 5.1: Live Transcript Auto-Saving & Disk Backup
- [x] Implement debounced auto-save effect in `App.tsx` saving `messages` and `highlights` on change
- [x] Flush-save current note before session switching, on `window.beforeunload`, and before window closing
- [x] Add JSON backup snapshot mechanism in `backend/storage/session_db.py` to `~/.ambient_copilot/backups/sessions_backup.json`
- [x] Restore last active session (or most recent non-empty session) upon startup in `loadInitialData()`

### Subtask 5.2: Chat Switching Robustness
- [x] Add `_normalize_id` in `backend/bridge.py` for all session operations (`get_session`, `save_session`, `delete_session`, `get_highlights`)
- [x] Update `self._active_session_id = session_id` and clear `self._buffer` upon session selection in `bridge.py`
- [x] In `App.tsx` `selectSession(id)`: guard against re-selecting active session, flush active note, fetch target note, populate messages/highlights, and close sidebar

### Subtask 5.3: Chat-Scoped Highlights & Sidepanel
- [x] Include `highlights` in `save_session` bridge signature and persist `highlights_json` in `session_db.py`
- [x] Add `delete_highlight(session_id, highlight_id)` IPC endpoint in backend and integrate with `handleDeleteHighlight`
- [x] Reset active thread view (`activeThreadHighlightId = null`, `activeThreadScreenshot = null`) on note switch
- [x] Update `ThreadSidepanel.tsx` header to display current session note title

### Subtask 5.4: Multi-Monitor Window Positioning Calibration
- [x] Calibrate initial window docking using `GetMonitorInfo` `rcWork` in logical DIP coordinates
- [x] Ensure window sits flush on the right edge of the primary monitor without bleeding into Screen 2 (Ultrawide)

### Subtask 5.5: Responsive Dock Buttons Layout
- [x] Replace strict `flex-nowrap` with `flex-wrap justify-between gap-1.5` in `ControlBar.tsx`
- [x] Ensure buttons fit on 1 row at default 560px width and wrap gracefully into 2 rows when narrowed

## Phase 6: Gemini 3.8 Flash, Floating Dialog Enhancements & Manual Text Selection
### Subtask 6.1: Gemini 3.8 Flash Migration & Token Budget Optimization
- [x] Update `backend/agent/orchestrator.py` to use `gemini-3.8-flash` for text and multimodal queries
- [x] Downscale screenshot payloads to max 1280px in `analyze_vision` using Pillow thumbnail to conserve tokens and API budget
- [x] Update model selector dropdown in `SettingsModal.tsx` and defaults in `config.py` to reflect Gemini 3.8 Flash / Pro

### Subtask 6.2: Always-On Floating Dialog & Dynamic Option 1
- [x] Update `handleHighlightClick` and `handleScreenshotClick` in `App.tsx` to always present `FloatingActionsModal`
- [x] In `FloatingActionsModal.tsx`: dynamic Option 1 ("View AI Thread" if already answered vs "Ask AI / Explain" if new)
- [x] Wire Option 1 to directly open the Sidepanel thread when an AI answer already exists without re-calling API

### Subtask 6.3: Option 4: De-select Highlight
- [x] Add Option 4 ("De-select Highlight", hotkey `4` or `Del`) to `FloatingActionsModal.tsx`
- [x] Implement `handleDeselectHighlight` in `App.tsx` to remove the highlight from state and delete it from SQLite database

### Subtask 6.4: Single-Turn Text Selection Clamping & Right-Click Context Menu
- [x] Scope text selection strictly to message turns; add `select-none` to images and avatars to prevent cross-turn/image bleed
- [x] Build custom right-click context menu in `TranscriptItem.tsx` with options: `Highlight`, `Copy to Clipboard`, `Cancel`
- [x] Trigger Floating Actions Modal with the selected text snippet when `Highlight` is chosen from context menu
- [x] End-to-end verification, automated tests, and updated walkthrough guide

## Phase 7: Markdown Transpilation, Chat AFC Migration & Lean Output Rules
### Subtask 7.1: Frontend Markdown Transpiler Component
- [x] Install `react-markdown` in `frontend/`
- [x] Create `MarkdownRenderer.tsx` with sleek dark-mode styling for headings, lists, bold, inline code, and links
- [x] Integrate `MarkdownRenderer` in `ThreadSidepanel.tsx` for `activeHighlight.ai_response` and `activeScreenshot.ai_response`

### Subtask 7.2: Google GenAI Chat AFC Migration
- [x] Migrate `client.models.generate_content` in `backend/agent/orchestrator.py` to `client.chats.create` + `chat.send_message`
- [x] Eliminate the automatic function calling (AFC) deprecation warning in console output

### Subtask 7.3: Lean Token & Output Formatting Rules
- [x] Enforce casual tone with plain English explanations for technical terms
- [x] Highlight text rules: bullet points only, straight to the point, no decorators, no long dashes, strictly < 150 words
- [x] Image rules: summary first ("purpose of what user is doing or needs to know"), critical highlights, strictly < 150 words
- [x] Configure `max_output_tokens=350` at the API config level to protect pre-paid quota

### Subtask 7.4: Verification, Automated Tests & Walkthrough
- [x] Add unit tests verifying prompt guidelines and token constraints
- [x] Verify frontend build (`npm run build`) and backend tests (`pytest tests/`)
- [x] Create detailed manual walkthrough testing guide for the user

## Phase 8: AI Trimming Fix & Console Traceability Logging
### Subtask 8.1: Thinking Budget Configuration & Headroom Expansion
- [x] Remove restrictive `max_output_tokens=350` capping to restore full, complete responses from the model
- [x] Retain casual tone, bullet points, clean formatting, and explanations in layman's terms without truncating

### Subtask 8.2: Comprehensive Console Traceability Logging
- [x] Log outbound AI requests in `analyze_intent` and `analyze_vision` (model, target, parameters, prompt, system instructions) with `flush=True`
- [x] Log inbound AI responses and metadata (finish reason, prompt/candidate/thoughts/total token counts, word count, response text)

### Subtask 8.3: Automated Tests & Verification
- [x] Run backend unit tests (`pytest tests/`) - 14 passed
- [x] Verified live query trace and full response output in console

### Subtask 8.4: Walkthrough & User Review
- [x] Update walkthrough guide with testing steps for console traceability and complete answers
- [x] Review with user before staging and merging




## Phase 9: STT Speed & Accuracy, Granola 3-Dots Animation & Resizable Sidepanel
### Subtask 9.1: Agent Roles & Architecture Guardrails Setup
- [x] Create Senior AI Engineer role specification (`.agents/roles/senior-ai-engineer.md`)
- [x] Create Senior Backend Developer role specification (`.agents/roles/senior-backend-developer.md`)
- [x] Create Senior Frontend Developer role specification (`.agents/roles/senior-frontend-developer.md`)
- [x] Define comprehensive multi-layer architectural guardrails for STT, IPC, Webview2, and LLM (`.agents/rules/stt-and-ui-guardrails.md`)

### Subtask 9.2: Speech-to-Text Performance & Accuracy Overhaul
- [x] Upgrade audio resampling pipeline in `capture.py` to anti-aliased linear interpolation (eliminates high-frequency distortion)
- [x] Enhance Voice Activity Detection (VAD) with speech padding (~250ms onset/offset) to prevent clipping words
- [x] Upgrade STT engine: add configurable Whisper models (`small.en` optimal default, `base.en`, `whisper-large-v3-turbo`) with INT8 quantization
- [x] Implement transformer prompt conditioning (`initial_prompt`) with rolling context to drastically improve accent recognition and fast speaker tracking
- [x] Add model selection setting in SettingsModal

### Subtask 9.3: Granola-Style Animated 3-Dots Listening Indicator
- [x] Implement backend speech activity state tracking and event emission (`onSpeechActivity`) in `capture.py` & `bridge.py`
- [x] Register `onSpeechActivity` in `pywebview.ts` IPC layer
- [x] Build animated pulsing 3-dots indicator bubble in `ChatFeed.tsx` for active speaker
- [x] Smoothly transition the pending 3-dots indicator to transcribed text upon arrival, looping while audio is detected until silence or STOP

### Subtask 9.4: Resizable Right Sidepanel with Drag Handle & Default Reset
- [x] Build draggable left-edge splitter/handle on `ThreadSidepanel.tsx` with `col-resize` cursor and visual hover indicator
- [x] Implement pointer event listeners (`pointerdown`, `pointermove`, `pointerup`) with width clamping (min 360px, max 800px)
- [x] Expand desktop window smoothly via bridge (`resize_window` with custom width) when sidepanel is dragged wider
- [x] Ensure collapse (`X`) and back (`ArrowLeft`) buttons retain full functionality
- [x] Enforce automatic reset to default width (420px) whenever sidepanel is opened from a highlight click or screenshot click

### Subtask 9.5: Automated Testing, Manual Walkthrough & User Review
- [x] Run automated test suite (`pytest tests/`) - 17 passed
- [x] Build and verify frontend (`npm run build`)
- [x] Prepare detailed manual walkthrough testing guide (`walkthrough.md`)
- [x] Present changes for user review and approval before git staging and merging

## Phase 10: App Transparency Slider, Independent Font Controls & Per-Session AI Prompts
### Subtask 10.1: Native Window Transparency Slider (10% - 100%)
- [x] Implement Win32 `SetLayeredWindowAttributes` bridge method `set_window_opacity(opacity: float)` in `backend/desktop.py` and `backend/bridge.py`
- [x] Add `set_window_opacity` method to `pywebview.ts` IPC service layer
- [x] Build compact transparency slider control in `TitleBar.tsx` (10% to 100% range, slider + percentage badge)
- [x] Add fallback CSS opacity on app root for browser preview mode
- [x] Persist chosen opacity value in local storage / user configuration

### Subtask 10.2: Independent Font Size Controls for Chat & Sidepanel
- [x] Design always-on-top font size control UI (`-` / `+` / reset indicator)
- [x] Embed chat font size controls as a pinned/always-on-top element of `ChatFeed.tsx`
- [x] Fix chat header layout: isolate session header (Title, pills, persona badge, and font controls) in a dedicated fixed/pinned top bar (`shrink-0 z-20`) so it never scrolls away when scrolling through transcripts
- [x] Wire `fontSize` prop directly into `<TranscriptItem fontSize={fontSize} />`, user bubbles, and assistant responses in `ChatFeed.tsx`
- [x] Embed sidepanel font size controls as an always-on-top element of `ThreadSidepanel.tsx`
- [x] Wire dynamic font scaling across all sidepanel elements (saved highlights list, quote excerpts, reasoning traces, and markdown responses), eliminating conflicting Tailwind classes
- [x] Persist independent font sizes in `localStorage`

### Subtask 10.3: Per-Conversation AI Prompt Customization (Highlights & Images)
- [x] Add `prompt_highlight` and `prompt_image` columns to SQLite `sessions` table in `session_db.py` with automatic schema migration
- [x] Update `backend/bridge.py` (`save_session`, `get_session`, `create_session`) to handle custom prompts
- [x] Refactor `AgentOrchestrator` (`analyze_intent` and `analyze_vision`) to accept and log custom system instructions with fallback to defaults
- [x] Pass session-specific custom prompts in `ask_ai_about_highlight` and `explain_image_with_ai`
- [x] Create `SessionPromptModal.tsx` allowing editing of highlight & screenshot prompts, previewing default prompt templates, and resetting
- [x] Add entry point button and status indicator in `ThreadSidepanel.tsx` and `ChatFeed.tsx` session header

### Subtask 10.4: Automated Tests, Manual Walkthrough & User Review
- [x] Write unit tests for session prompt persistence and orchestrator prompt overriding (`test_prompts_and_transparency.py`)
- [x] Execute automated test suite (`uv run pytest tests/`) - 21 passed
- [x] Run production build (`npm run build`)
- [x] Prepare comprehensive manual walkthrough guide with step-by-step instructions
- [x] Collect user feedback on opacity threshold and font sizing

### Subtask 10.5: Opacity Slider Range Adjustment (50% - 100%)
- [x] Adjust Win32 bridge minimum opacity clamp from `0.10` to `0.50` in `backend/bridge.py` and `backend/desktop.py`
- [x] Update frontend slider range in `TitleBar.tsx` (`min="50"`, `max="100"`) and tooltip title
- [x] Update frontend service and App state clamping to `0.50` in `pywebview.ts` and `App.tsx`
- [x] Update test assertions in `tests/test_prompts_and_transparency.py`
- [x] Verify test suite (`uv run pytest tests/` - 21 passed) and build (`npm run build`)
- [x] Update manual walkthrough testing guide

### Subtask 10.6: Startup Freeze & Last Opened Chat Restoration Fix
- [x] Enable SQLite WAL mode (`PRAGMA journal_mode=WAL;`), 30s busy timeout, and thread lock in `backend/storage/session_db.py`
- [x] Optimize `backup_to_json()` with WAL concurrency and thread mutex to eliminate database lock contention
- [x] Ensure `CompanionBridge._set_window` is internal to prevent pywebview method introspection leaks
- [x] Prioritize native WinForms `form.Invoke(lambda: setattr(form, 'Opacity', val))` in `bridge.py`
- [x] Add 300ms delay to initial opacity restore in `desktop.py` to prevent CoreWebView2 controller initialization contention
- [x] Upgrade `waitForBridge()` in `pywebview.ts` with 40ms active polling and 12s timeout without stale false-cache
- [x] Implement `companion_active_session_id` persistence and restoration in `App.tsx`
- [x] Add `isInitializing` startup guard and late `pywebviewready` event listener in `App.tsx`
- [x] Run test suite (`uv run pytest tests/` - 21 passed) and production build (`npm run build`)
- [x] Update walkthrough guide with troubleshooting root cause and verification steps

### Subtask 10.7: Resolve Intermittent Startup Freeze & Double-Initialization Deadlock
- [x] Eliminate double initialization in `App.tsx` by removing redundant `pywebviewready` listener and adding re-entrancy locks (`isInitializingRef`, `isLoadedRef`)
- [x] Replace blocking synchronous `form.Invoke` with non-blocking `form.BeginInvoke(System.Action(...))` in `backend/bridge.py`
- [x] Remove background `threading.Timer(0.3)` opacity call in `backend/desktop.py` that collided with WebView2 navigation
- [x] Add 10-second safety timeout on `callBridge` in `frontend/src/services/pywebview.ts` to prevent UI Promise hangs
- [x] Sequence startup queries in `loadInitialData` and only apply non-100% opacity after session retrieval completes
- [x] Run test suite (`uv run pytest tests/` - 21 passed) and production build (`npm run build`)
- [ ] Update walkthrough guide with root cause analysis and manual verification steps
- [ ] Await user review and approval before stashing, committing, pushing, and merging to main




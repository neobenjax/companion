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
- [ ] Target window and display monitor picker UI
- [ ] Window capture pipeline (HWND and monitor capture via Direct3D / desktopCapturer)
- [ ] Background perceptual diffing (pHash DCT Hamming distance > 10)
- [ ] Vision Snapshot hotkey trigger (`Win+Shift+V` / Compound `Win+Shift+C`)
- [ ] Multimodal vision analysis (Amazon product comparison, quiz solving, data summarization)
- [ ] Interactive action cards for vision intents
- [ ] Verification and MVP 2 walkthrough

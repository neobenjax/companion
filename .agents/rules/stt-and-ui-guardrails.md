# Multi-Layer Architectural Guardrails (2026 Standards)

## 1. Speech-to-Text (STT) & Audio Capture Layer
- **Anti-Aliased Resampling**: Always use linear interpolation (`np.interp`) or polyphase filtering when resampling WASAPI audio (44.1kHz/48kHz) down to 16kHz mono. Never use raw index decimation (`step = rate / 16000`), as aliasing destroys phoneme clarity for fast speech and non-native accents.
- **Acoustic Speech Padding**: Maintain an onset/offset buffer of at least 250ms (4-5 frames at 64ms/frame). Never discard audio immediately upon VAD boundary transitions; word-initial plosives and word-final fricatives must be preserved.
- **Prompt Conditioning**: Feed the last 15-25 words of transcribed context into Whisper's `initial_prompt`. Always keep `condition_on_previous_text=False` to prevent repetitive loop hallucinations while preserving vocabulary and accent context.
- **Speech Activity State Throttle**: Only emit speech state changes (`is_speaking: True` or `False`) upon state transition edges (entering voice activity vs. entering silence timeout) to keep the bridge IPC channel lightweight.

## 2. Desktop IPC & Window Management Layer
- **Coordinated Window Resizing**: When expanding the sidepanel via drag, expand the native `pywebview` window to the left (`x = max(0, x - delta_w)`, `w = w + delta_w`) so that the main feed is not compressed below minimum readable dimensions (340px).
- **Default Width Reset**: Any programmatic opening of the sidepanel (via highlight clicks or image analysis triggers) must deterministically reset the sidepanel to its default width (420px) and restore standard window geometry (960px).
- **Bridge Error Handling**: All IPC bridge endpoints must accept optional parameters defensively (e.g. `dict` vs primitive unwrapping) and handle window minimization or off-screen coordinates gracefully.

## 3. Frontend Micro-Interactions & UX Layer
- **Granola-Style Listening Indicator**: The 3-dots indicator bubble (`...`) must animate smoothly (gentle bounce/pulse) beneath the current active speaker's turn. It must never cause layout shift or scroll jumping, and must seamlessly dissolve when the transcribed text segment arrives.
- **Pointer Capture & Boundary Safety**: Left-edge resizing of the sidepanel must use pointer capture (`setPointerCapture`) with document-wide pointer move/up handlers. Widths must be strictly clamped between 360px and 800px.
- **Clean Markdown & Typography**: Transcripts and AI responses must maintain high legibility with dark-mode contrast ratios and responsive wrapping.

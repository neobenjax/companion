# Ambient Copilot: Immutable Application Behavior & UX Snapshot

> [!IMPORTANT]
> **MANDATORY RULE FOR ALL AGENTS & DEVELOPERS**:
> Before making ANY architectural, frontend, backend, or design changes, you MUST consult this snapshot.
> **All previously tested and accepted user behaviors described below are IMMUTABLE.**
> Under NO circumstances should an agent bypass, remove, or modify these interaction patterns unless the user explicitly requests an alteration.

---

## 1. Chat Feed & Floating Actions Modal Rules

### A. Highlight Floating Actions Modal
- **Click Behavior**: Clicking ANY highlighted text in the chronological chat feed must **ALWAYS** open the Floating Actions Modal. It must **NEVER** bypass the modal to open the sidepanel directly, even if the highlight was already researched by AI.
- **Strict Option Ordering & Keystrokes**:
  1. **Option 1 (`1` or `Enter`)**:
     - **If AI response is already saved**: Title must be **`Review in AI Thread`** (Description: *Open saved AI research and explanation in side panel*). Clicking this opens the sidepanel directly to this highlight's thread and resets the sidepanel width to the default **420px**.
     - **If no AI response yet**: Title must be **`Ask AI about...`** (Description: *Expand, confirm, or research based on this transcription*). Triggers AI analysis and opens the sidepanel at default width.
  2. **Option 2 (`2`)**: **`Copy to Clipboard`** (Copies highlighted snippet text to clipboard).
  3. **Option 3 (`3`)**: **`Save for later`** (Marks highlight as saved and archives in Saved Highlights list).
  4. **Option 4 (`4`)**: **`De-select Highlight`** (Removes highlight from passage and erases associated research).
  5. **`Esc`**: Dismisses modal without side effects.

### B. Screenshot Floating Actions Modal
- **Click Behavior**: Clicking ANY screenshot thumbnail card in the chat feed must **ALWAYS** open the Floating Actions Modal.
- **Strict Option Ordering & Keystrokes**:
  1. **Option 1 (`1` or `Enter`)**:
     - **If AI response is already saved**: Title must be **`Review in AI Thread`** (Description: *Open AI visual analysis and reasoning trace in side panel*). Opens the sidepanel directly to this screenshot's thread and resets the width to default **420px**.
     - **If no AI response yet**: Title must be **`Explain this image using AI...`** (Description: *Multimodal analysis of visual layout, UI, errors, code, and text*). Triggers vision analysis and opens the sidepanel at default width.
  2. **Option 2 (`2`)**: **`Copy to Clipboard`** (Copies original full-resolution image to Windows clipboard via Win32 DIB).
  3. **Option 3 (`3`)**: **`Delete Screenshot`** (Erases card from chat, deletes file from disk, and removes thread).
  4. **`Esc`**: Dismisses modal without side effects.

---

## 2. Right Sidepanel Geometry & Window Resizing Rules

1. **Default Dimensions**:
   - Collapsed HUD width: **560px**.
   - Default expanded window width: **960px** (540px main feed + **420px** sidepanel).
2. **Deterministic Reset to Default Width**:
   - Whenever the sidepanel is opened programmatically (e.g. clicking a highlight, screenshot, or "Review in AI Thread" / "Ask AI"), **the sidepanel MUST appear with the default width of 420px** (and native window width 960px). It must NOT retain any previous manual drag size.
3. **Manual Drag Handle**:
   - The left edge of the sidepanel features a vertical splitter handle with `col-resize` cursor.
   - Dragging the left edge to the left expands the sidepanel width between **360px (minimum)** and **800px (maximum)**.
   - As the sidepanel expands, the native desktop window (`pywebview`) expands to the left (`new_x = max(0, curr_x - delta_w)`) to ensure the main feed is not compressed below readable dimensions.
4. **Header Navigation Controls**:
   - **Back Button (`ArrowLeft`)**: Appears when viewing an active thread. Returns to the "Saved Highlights" list while keeping the sidepanel open and maintaining its current width.
   - **Close Button (`X`)**: Collapses the sidepanel and shrinks the window back to the compact **560px** HUD width.

---

## 3. Speech-to-Text & Granola Micro-Interactions

1. **Granola-Style 3-Dots Listening Indicator**:
   - While recording, speech detection immediately triggers an animated bouncing 3-dots bubble tagged with the speaker badge (`You` or `Caller`) and `"listening..."`.
   - When the finalized transcription segment arrives, the 3-dots bubble dissolves and is replaced by the text segment.
   - Looping: If the speaker continues talking, the 3-dots bubble appears beneath the latest turn in a continuous loop until silence is reached or recording is stopped/paused.
2. **Audio Resampling & VAD**:
   - Downmixing to 16kHz mono must ALWAYS use anti-aliased linear interpolation (`np.interp`). Nearest-neighbor decimation is strictly prohibited.
   - Acoustic speech padding of ~256ms pre-speech onset must be maintained to prevent clipping leading consonants.
   - Whisper decoder must be conditioned with rolling conversational context (`initial_prompt` with the last 25 words).
3. **STT Model Selection**:
   - Optimal default: **`small.en`** (INT8 quantized).
   - Configurable in Settings: `small.en` (Optimal), `whisper-large-v3-turbo` (State-of-the-Art), and `base.en` (Ultra-lightweight).

---

## 4. AI Response Formatting & Guardrails

1. **Tone & Word Constraints**:
   - Tone: Casual, straightforward, plain English (explain technical terms in layman's terms).
   - Highlights: Bullet points only, strictly **< 150 words**, no decorators or conversational filler.
   - Images: Summary first ("purpose of what user is doing or needs to know"), critical points, strictly **< 150 words**.
2. **No Artificial Token Clamping**:
   - Never cap `max_output_tokens` below the combined thinking + content threshold.
   - Separate reasoning thoughts from user-facing text cleanly in the UI.

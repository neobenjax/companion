# Ambient Multimodal Windows Copilot (Companion)

An ambient, always-on-top desktop companion for Windows that merges the meeting transcription aesthetic of **Granola AI** with the proactive intent HUD of **Google Antigravity 2.0**.

![Ambient Copilot](frontend/src/assets/hero.png)

---

## Key Features

- **Ambient EdgeChromium HUD (`pywebview`):**
  - Modern, frameless floating HUD docked against the right side of the screen.
  - Multi-monitor aware with automatic screen bounds calibration and always-on-top toggle.
  - Automatic Windows Station & Desktop routing (`WinSta0\Default`) ensuring physical monitor visibility.

- **Dual-Channel WASAPI Audio Capture (Zero Cloud Cost):**
  - Separate hardware capture for your microphone (`You`) and speaker loopback (`Caller`) via `pyaudiowpatch`.
  - Non-blocking PortAudio callbacks and queues with instant, clean stop without process crash.
  - Native hardware sample rate probing (48kHz/44.1kHz stereo) with in-memory downmixing to 16kHz mono.
  - Background `faster-whisper` (CTranslate2) worker with automatic CUDA / INT8 CPU fallback.
  - Continuous speech concatenation grouping successive turns into single conversational blocks.

- **In-Place Chat Highlighting (Book Highlighter Aesthetic):**
  - Slices the last **50 words** within the latest message turn (ignoring speaker tags).
  - Highlights directly inside the chat bubble in bold text with a marker glow matching the speaker's color (`Caller` green or `You` purple).
  - No duplicate message boxes or cluttered raw tags in chat.
  - Configurable highlight word budget (default 50 words) in Settings.

- **Antigravity 2.0 Floating Actions Prompt Modal:**
  - Floats above the dock with single-key shortcuts:
    - **`[1]`**: *Ask AI about...* (Expands, confirms, or researches via Google Antigravity SDK).
    - **`[2]`**: *Copy to Clipboard* (Copies highlighted text).
    - **`[3]`**: *Save for later* (Pins to Saved Highlights drawer).
    - **`Esc`**: *Skip*
    - **`Enter`**: *Submit*

- **Expandable Right Sidepanel & Dynamic Window Expansion:**
  - Smoothly expands the native window width from **460px to 860px towards the left**, keeping the right border docked against your monitor border.
  - **Saved Highlights:** Chronological drawer of saved excerpts. Clicking any excerpt scrolls the transcript smoothly to that passage.
  - **AI Threads:** Deep-dive research view querying the Google Antigravity Agent, displaying reasoning traces and structured answers.

- **Uninterrupted Background Capture:**
  - Recording, loopback audio, and live Whisper transcription continue running seamlessly in the background while interacting with highlights, opening menus, or querying the AI.

- **Window Transparency Slider (50% – 100%):**
  - Smooth application opacity slider in the title bar allowing background windows to show through without losing legibility.

- **Independent Always-On-Top Font Controls:**
  - Pinned transcript header with dedicated `-` / `+` font sizing for live transcripts.
  - Independent font scaling for the AI thread sidepanel.

- **Per-Conversation AI Prompts:**
  - Customize AI system instructions and persona per session note for tailored highlights and screenshot explanations.

---

## Getting Started

### Prerequisites
- Windows 10/11
- Python 3.11+ (or [`uv`](https://github.com/astral-sh/uv))
- Node.js 18+

### Installation & Launch

1. **Clone the repository:**
   ```bash
   git clone https://github.com/neobenjax/companion.git
   cd companion
   ```

2. **Install Frontend Dependencies & Build:**
   ```powershell
   cd frontend
   npm install
   npm run build
   cd ..
   ```

3. **Run the Application (Recommended with `uv`):**
   ```powershell
   uv run python run.py
   ```
   *Alternatively, if using a standard python venv:*
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\pip install -e .
   .\.venv\Scripts\python.exe run.py
   ```

---

## Development Mode

To run with live Vite hot reloading:
```powershell
uv run python run.py --dev
```
*Or with venv:*
```powershell
.\.venv\Scripts\python.exe run.py --dev
```

---

## Testing

Run the automated test suite with pytest:
```powershell
uv run pytest tests/
```
*Or with venv:*
```powershell
.\.venv\Scripts\python.exe -m pytest tests/
```

---

## License

MIT License.

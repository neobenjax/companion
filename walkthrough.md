# Walkthrough: Prompt Preset Engine & Per-Session Switch Guardrails

## Overview
This release finalizes the **Per-Session Prompt & Preset Management** workflow in Ambient Copilot. It ensures immediate prompt visibility on initial load, adds an inviolable **Unsaved Changes Guard** across both preset and tab transitions, introduces **per-preset session storage**, and restricts **"Reset to Defaults"** to the active preset.

---

## Key Changes Implemented

### 1. Reliable Active Preset Initial Loading
- **`SessionPromptModal.tsx`**:
  - When opening the Session Prompts & Presets window, the active preset's configured instruction is **immediately populated and visible** in the Custom Session Instruction textarea.
  - The textarea is never blank on initial load (even if `has_custom_prompts` is false or default settings were changed).
  - Intentional blank overrides are respected if the user explicitly clears all text in the textarea, with factory fail-safe fallback under the hood.

### 2. Dual Unsaved Changes Guard (Preset Switch & Tab Switch)
- **Dirty Checking**: Triggers whenever the user has modified the textarea for the currently selected preset.
- **Triggers**:
  1. Clicking a different Preset card.
  2. Clicking the other Tab (**Transcript Prompt Preset** $\leftrightarrow$ **Screenshot Vision Preset**).
- **Exact Dialog Layout**:
  - **Title**: `"Unsaved changes"`
  - **Warning**: `"You have modified the prompt for this preset. Switching before saving will discard your edits unless saved."`
  - **Three Action Buttons**:
    - **`"Keep editing"`**: Cancels the switch, closes the confirmation dialog, and remains on the current preset and tab with edits intact.
    - **`"Lose changes"`**: Discards unsaved edits for the current preset, reverts the draft to its baseline, and completes the switch (to the new preset or new tab).
    - **`"Save and Switch"`**: Saves the edited prompt into the session's preset overrides, updates the baseline, and completes the switch (to the new preset or new tab).

### 3. Per-Preset Session Storage
- **`backend/storage/session_db.py`**:
  - Added `preset_prompts_json TEXT DEFAULT '{}'` column to SQLite `sessions` table (auto-migrated via `init_db`).
  - `create_session`, `get_session`, `list_sessions`, and `update_session` now persist and return `preset_prompts`.
- **`frontend/src/components/SessionPromptModal.tsx`**:
  - Maintains `presetDrafts: Record<string, string>` and `presetBaselines: Record<string, string>`.
  - Edits made to multiple presets within the same session are preserved independently. Switching between presets allows each to retain its own customized instructions.
- **`backend/bridge.py`**:
  - When AI queries execute (`analyze_intent` / `analyze_vision`), the resolution hierarchy checks `session.preset_prompts[active_preset_id]` first, then `prompt_highlight`/`prompt_image`, then the preset's configured instruction.

### 4. Single-Preset "Reset to Defaults" Scope
- Clicking **"Reset to Defaults"** reverts **only the currently active preset** in the active tab to its global default prompt, keeping all other presets untouched.

---

## How to Test Manually

### Step 1: Launch Application
Run the application using `uv`:
```powershell
uv run python run.py
```
Verify the Ambient Copilot HUD opens.

---

### Step 2: Verify Initial Prompt Loading
1. Open **Settings** (gear icon in TitleBar).
2. Go to **Prompt Presets**, select **"Live Verbal Interview Copilot"** as the **Default Transcript Preset**, and click **Save Changes**.
3. Create a new session / note (`+` button in Sidebar).
4. Click the **Sparkles** button (or Preset Quick Selector $\rightarrow$ **Edit**).
5. **Expected Result**:
   - **"Live Verbal Interview Copilot"** is selected.
   - The Custom Session Instruction textarea is **immediately populated** with the interview prompt framework (*Opening Hook*, *Core Architecture*, etc.). It is **NOT** blank!

---

### Step 3: Test Unsaved Changes on Preset Switch
1. In the Session Prompts & Presets modal (with "Live Verbal Interview Copilot" selected):
2. Type an edit into the textarea (e.g., `"Candidate note: Prioritize system design tradeoffs."`).
3. Click on **"Layman Explainer"**.
4. **Expected Result**:
   - The **"Unsaved changes"** dialog appears.
   - The warning says: *"You have modified the prompt for this preset. Switching before saving will discard your edits unless saved."*
   - Buttons are: **"Keep editing"**, **"Lose changes"**, and **"Save and Switch"**.
5. Test **"Keep editing"**:
   - Click "Keep editing".
   - Dialog closes, and you remain on "Live Verbal Interview Copilot" with your edits intact.
6. Test **"Lose changes"**:
   - Click on "Layman Explainer" again.
   - Click **"Lose changes"**.
   - The switch proceeds to "Layman Explainer", loading its default prompt. If you switch back to "Live Verbal Interview Copilot", the unsaved edit was discarded.
7. Test **"Save and Switch"**:
   - On "Live Verbal Interview Copilot", type another edit: `"Remember to mention CAP theorem."`.
   - Click **"Layman Explainer"**.
   - Click **"Save and Switch"**.
   - "Layman Explainer" is now selected.
   - Now click back to **"Live Verbal Interview Copilot"**.
   - Notice: Your saved custom prompt (`"Remember to mention CAP theorem."`) is **still there!**

---

### Step 4: Test Unsaved Changes on Tab Switch
1. On the **Transcript Prompt Preset** tab, modify the prompt in the textarea.
2. Click the **Screenshot Vision Preset** tab.
3. **Expected Result**:
   - The **"Unsaved changes"** dialog appears with the exact warning and buttons.
4. Test clicking **"Keep editing"**:
   - Stays on the Transcript tab with edits intact.
5. Test clicking **"Save and Switch"**:
   - Saves your transcript prompt edit for this session and switches to the Screenshot Vision tab.

---

### Step 5: Test Single-Preset "Reset to Defaults"
1. Edit the prompt for the currently selected preset.
2. Click **"Reset to Defaults"** in the bottom left of the modal.
3. **Expected Result**:
   - Only the currently selected preset resets back to its global configured instruction.
   - Other presets in the session retain their custom state.
4. Click **"Save Session Settings"**.

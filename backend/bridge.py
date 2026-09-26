import json
import threading
import time
from typing import Dict, Any, Optional, List
import webview

from backend.config import load_config, save_config
from backend.storage.session_db import SessionStorage
from backend.audio.buffer import RollingTranscriptBuffer, TranscriptSegment
from backend.audio.transcriber import TranscriberWorker
from backend.audio.capture import AudioCaptureManager
from backend.hotkeys.manager import GlobalHotkeyManager
from backend.agent.orchestrator import AgentOrchestrator
from backend.agent.tools import execute_tool


class CompanionBridge:
    """
    Two-way bridge between Python and WebView2 JavaScript.
    All internal non-JS members MUST be prefixed with '_' to prevent
    pywebview from attempting to introspect COM / WinForms objects.
    """
    def __init__(self):
        self._window: Optional[webview.Window] = None
        self._config = load_config()
        self._storage = SessionStorage()

        # Audio and buffer
        self._buffer = RollingTranscriptBuffer(max_retention_sec=900.0)
        self._transcriber = TranscriberWorker(
            buffer=self._buffer,
            model_size=self._config.get("whisper_model", "base.en"),
            on_segment=self._on_transcribed_segment,
        )
        self._capture = AudioCaptureManager(transcriber=self._transcriber)

        # Agent
        self._agent = AgentOrchestrator(api_key=self._config.get("gemini_api_key", ""))

        # Hotkeys
        self._hotkeys = GlobalHotkeyManager()
        self._active_session_id: Optional[str] = None
        self._init_hotkeys()

    def set_window(self, window: webview.Window):
        self._window = window

    def _init_hotkeys(self):
        hotkey_str = self._config.get("audio_intent_hotkey", "<ctrl>+<shift>+a")
        self._hotkeys.register(hotkey_str, self._on_audio_hotkey_fired)

    def _emit_to_ui(self, func_name: str, data: Any):
        if hasattr(self, "_emit_custom") and self._emit_custom:
            self._emit_custom(func_name, data)
            return
        if not self._window:
            return
        try:
            json_str = json.dumps(data)
            js_code = f"if (window.{func_name}) {{ window.{func_name}({json_str}); }}"
            self._window.evaluate_js(js_code)
        except Exception as e:
            print(f"[Bridge] Error emitting {func_name}: {e}")

    def _on_transcribed_segment(self, segment: TranscriptSegment):
        self._emit_to_ui("onNewTranscript", segment.model_dump())

    def _on_audio_hotkey_fired(self):
        print("[Bridge] Global audio shortcut fired -> Triggering in-place highlight")
        words = int(self._config.get("lookback_words", 50))
        self._emit_to_ui("onTriggerHighlight", {"words": words})

    # --- JS Exposed Methods (Only public methods without leading '_') ---

    def get_settings(self) -> Dict[str, Any]:
        return self._config

    def save_settings(self, settings_data: Dict[str, Any]) -> Dict[str, Any]:
        old_hotkey = self._config.get("audio_intent_hotkey")
        self._config = save_config(settings_data)

        # Update hotkey if changed
        new_hotkey = self._config.get("audio_intent_hotkey")
        if old_hotkey != new_hotkey:
            self._hotkeys.register(new_hotkey, self._on_audio_hotkey_fired)

        # Update API key if changed
        api_key = self._config.get("gemini_api_key", "")
        self._agent.set_api_key(api_key)

        # Update always_on_top if changed
        if self._window and "always_on_top" in settings_data:
            self._window.on_top = bool(settings_data["always_on_top"])

        return self._config

    def get_audio_devices(self) -> Dict[str, Any]:
        return self._capture.get_audio_devices()

    def start_recording(self, session_id: Optional[str] = None) -> Dict[str, Any]:
        self._active_session_id = session_id
        input_idx = self._config.get("input_device_index")
        loopback_idx = self._config.get("loopback_device_index")
        self._capture.start(input_index=input_idx, loopback_index=loopback_idx)
        state = {"is_recording": True, "is_paused": False}
        self._emit_to_ui("onRecordingStateChanged", state)
        return state

    def pause_recording(self) -> Dict[str, Any]:
        self._capture.pause()
        state = {"is_recording": True, "is_paused": True}
        self._emit_to_ui("onRecordingStateChanged", state)
        return state

    def resume_recording(self) -> Dict[str, Any]:
        self._capture.resume()
        state = {"is_recording": True, "is_paused": False}
        self._emit_to_ui("onRecordingStateChanged", state)
        return state

    def stop_recording(self) -> Dict[str, Any]:
        self._capture.stop()
        state = {"is_recording": False, "is_paused": False}
        self._emit_to_ui("onRecordingStateChanged", state)
        return state

    def get_recording_state(self) -> Dict[str, Any]:
        return {
            "is_recording": self._capture.is_recording(),
            "is_paused": self._capture.is_paused(),
        }

    def trigger_highlight(self) -> Dict[str, Any]:
        words = int(self._config.get("lookback_words", 50))
        self._emit_to_ui("onTriggerHighlight", {"words": words})
        return {"status": "triggered", "words": words}

    def trigger_audio_intent(self) -> Dict[str, Any]:
        return self.trigger_highlight()

    def resize_window(self, expand: Any = True) -> Dict[str, Any]:
        if isinstance(expand, dict):
            expand = expand.get("expand", True)
        expand = bool(expand)

        if not self._window:
            return {"status": "no_window", "expanded": expand}

        try:
            curr_w = self._window.width
            curr_h = self._window.height
            curr_x = self._window.x
            curr_y = self._window.y

            target_w = 860 if expand else 460
            delta = target_w - curr_w

            if delta != 0:
                new_x = curr_x - delta
                if new_x < 0:
                    new_x = 0
                self._window.move(new_x, curr_y)
                self._window.resize(target_w, curr_h)

            return {"status": "ok", "expanded": expand, "width": target_w}
        except Exception as e:
            print(f"[Bridge] Error resizing window: {e}")
            return {"status": "error", "message": str(e)}

    def ask_ai_about_highlight(self, session_id: Any = None, highlight_id: str = "", text: str = "") -> Dict[str, Any]:
        if isinstance(session_id, dict):
            d = session_id
            session_id = d.get("session_id", "")
            highlight_id = d.get("highlight_id", "")
            text = d.get("text", "")

        def _worker():
            try:
                print(f"[Bridge] Querying AI about highlight: {highlight_id} ({len(text)} chars)")
                prompt = f"The user wants to expand on the following content: {text}"
                result = self._agent.analyze_intent(
                    text_excerpt=prompt,
                    is_hotkey=True,
                    segment_ids=[],
                )
                highlight_update = {
                    "id": highlight_id,
                    "ai_response": result["content"],
                    "thought": result.get("thought", ""),
                    "action_cards": result.get("action_cards", []),
                }
                if session_id:
                    self._storage.add_or_update_highlight(session_id, highlight_update)

                self._emit_to_ui("onHighlightAiResponse", {
                    "session_id": session_id,
                    "highlight_id": highlight_id,
                    "ai_response": result["content"],
                    "thought": result.get("thought", ""),
                    "action_cards": result.get("action_cards", []),
                })
            except Exception as e:
                print(f"[Bridge] Error in ask_ai_about_highlight: {e}")
                self._emit_to_ui("onHighlightAiResponse", {
                    "session_id": session_id,
                    "highlight_id": highlight_id,
                    "error": str(e),
                    "ai_response": f"Error contacting AI: {e}",
                })

        threading.Thread(target=_worker, daemon=True).start()
        return {"status": "started", "highlight_id": highlight_id}

    def save_highlight(self, session_id: Any = None, highlight: Any = None) -> Dict[str, Any]:
        if isinstance(session_id, dict):
            d = session_id
            session_id = d.get("session_id", "")
            highlight = d.get("highlight", {})
        if session_id and highlight:
            saved_list = self._storage.add_or_update_highlight(session_id, highlight)
            return {"status": "saved", "highlights": saved_list}
        return {"status": "failed"}

    def get_highlights(self, session_id: Any = None) -> List[Dict[str, Any]]:
        if isinstance(session_id, dict):
            session_id = session_id.get("session_id", "")
        return self._storage.get_highlights(str(session_id or ""))

    def copy_to_clipboard(self, text: Any = "") -> Dict[str, Any]:
        if isinstance(text, dict):
            text = text.get("text", "")
        text_to_copy = str(text)
        try:
            import pyclip
            pyclip.copy(text_to_copy)
        except Exception:
            try:
                import subprocess
                subprocess.run(["clip"], input=text_to_copy.strip().encode("utf-8"), check=True)
            except Exception as e:
                print(f"[Bridge] Clipboard error: {e}")
        return {"status": "copied", "text": text_to_copy}

    def send_user_message(self, text: str) -> Dict[str, Any]:
        result = self._agent.analyze_intent(text_excerpt=text, is_hotkey=False)
        payload = {
            "trigger": "user_input",
            "excerpt": text,
            "highlight_segment_ids": [],
            "thought": result["thought"],
            "content": result["content"],
            "action_cards": result["action_cards"],
            "timestamp": time.time(),
        }
        return payload

    def execute_action_card(self, action_id: Any = None, tool_name: str = "", parameters: Any = None) -> Dict[str, Any]:
        if isinstance(action_id, dict):
            d = action_id
            action_id = d.get("action_id", "")
            tool_name = d.get("tool_name", "")
            parameters = d.get("parameters", {})

        if parameters is None:
            parameters = {}

        if tool_name == "copy_clipboard":
            text_to_copy = parameters.get("text", "")
            try:
                import pyclip
                pyclip.copy(text_to_copy)
            except Exception:
                try:
                    import subprocess
                    subprocess.run(["clip"], input=text_to_copy.strip().encode("utf-8"), check=True)
                except Exception as e:
                    print(f"[Bridge] Clipboard error: {e}")
            return {"status": "executed", "actionId": action_id, "result": "Copied to clipboard"}
        else:
            res = execute_tool(tool_name, parameters)
            return {"status": "executed", "actionId": action_id, "result": res}

    # Session storage
    def get_sessions(self) -> List[Dict[str, Any]]:
        return self._storage.list_sessions()

    def create_session(self, title: str = "New note") -> Dict[str, Any]:
        sess = self._storage.create_session(title=title)
        self._active_session_id = sess["id"]
        self._buffer.clear()
        return sess

    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        return self._storage.get_session(session_id)

    def save_session(self, session_id: Any = None, title: str = "", notes: str = "", messages: Any = None) -> bool:
        if isinstance(session_id, dict):
            d = session_id
            session_id = d.get("session_id", "")
            title = d.get("title", "")
            notes = d.get("notes", "")
            messages = d.get("messages", [])

        return self._storage.update_session(session_id, title=title, notes=notes, messages=messages or [])

    def delete_session(self, session_id: str) -> bool:
        return self._storage.delete_session(session_id)

    # Window controls
    def toggle_always_on_top(self) -> bool:
        if self._window:
            self._window.on_top = not self._window.on_top
            self._config["always_on_top"] = self._window.on_top
            save_config(self._config)
            return self._window.on_top
        return True

    def minimize_window(self):
        if self._window:
            self._window.minimize()

    def close_window(self):
        if self._window:
            self.stop_recording()
            self._hotkeys.unregister_all()
            self._window.destroy()

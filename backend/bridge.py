import json
import os
import sys
import threading
import time
from typing import Dict, Any, Optional, List
import webview

from backend.config import load_config, save_config
from backend.storage.session_db import SessionStorage, _SENTINEL
from backend.audio.buffer import RollingTranscriptBuffer, TranscriptSegment
from backend.audio.transcriber import TranscriberWorker
from backend.audio.capture import AudioCaptureManager
from backend.hotkeys.manager import GlobalHotkeyManager
from backend.agent.orchestrator import (
    AgentOrchestrator,
    DEFAULT_HIGHLIGHT_SYSTEM_INSTRUCTION,
    DEFAULT_VISION_SYSTEM_INSTRUCTION,
)
from backend.agent.tools import execute_tool
from backend.vision.capture import VisionCaptureManager


def _normalize_id(id_val: Any) -> str:
    if isinstance(id_val, dict):
        return str(id_val.get("id") or id_val.get("session_id") or id_val.get("0") or "")
    if isinstance(id_val, (list, tuple)) and id_val:
        return _normalize_id(id_val[0])
    return str(id_val or "").strip()


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
            model_size=self._config.get("whisper_model", "small.en"),
            on_segment=self._on_transcribed_segment,
        )
        self._capture = AudioCaptureManager(
            transcriber=self._transcriber,
            on_speech_activity=self._on_speech_activity,
        )

        # Vision
        self._vision = VisionCaptureManager()
        self._selected_target: Optional[Dict[str, Any]] = None

        # Agent
        self._agent = AgentOrchestrator(api_key=self._config.get("gemini_api_key", ""))

        # Hotkeys
        self._hotkeys = GlobalHotkeyManager()
        self._active_session_id: Optional[str] = None
        self._init_hotkeys()

    def _set_window(self, window: webview.Window):
        self._window = window

    def set_window(self, window: webview.Window):
        self._set_window(window)

    def _init_hotkeys(self):
        audio_hotkey = self._config.get("audio_intent_hotkey", "<ctrl>+<shift>+a")
        self._hotkeys.register(audio_hotkey, self._on_audio_hotkey_fired)

        vision_hotkey = self._config.get("vision_intent_hotkey", "<ctrl>+<shift>+v")
        self._hotkeys.register(vision_hotkey, self._on_vision_hotkey_fired)

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

    def _on_speech_activity(self, activity_data: Dict[str, Any]):
        self._emit_to_ui("onSpeechActivity", activity_data)

    def _on_audio_hotkey_fired(self):
        print("[Bridge] Global audio shortcut fired -> Triggering in-place highlight")
        words = int(self._config.get("lookback_words", 50))
        self._emit_to_ui("onTriggerHighlight", {"words": words})

    def _on_vision_hotkey_fired(self):
        print("[Bridge] Global vision shortcut fired -> Capturing target")
        self.capture_selected_target()

    # --- JS Exposed Methods (Only public methods without leading '_') ---

    def get_settings(self) -> Dict[str, Any]:
        return self._config

    def save_settings(self, settings_data: Dict[str, Any]) -> Dict[str, Any]:
        old_audio_hotkey = self._config.get("audio_intent_hotkey")
        old_vision_hotkey = self._config.get("vision_intent_hotkey")
        old_whisper_model = self._config.get("whisper_model")
        self._config = save_config(settings_data)

        # Update hotkeys if changed
        new_audio_hotkey = self._config.get("audio_intent_hotkey")
        new_vision_hotkey = self._config.get("vision_intent_hotkey")
        if old_audio_hotkey != new_audio_hotkey or old_vision_hotkey != new_vision_hotkey:
            self._hotkeys.unregister_all()
            self._init_hotkeys()

        # Update whisper model if changed
        new_whisper_model = self._config.get("whisper_model")
        if old_whisper_model != new_whisper_model and hasattr(self._transcriber, "set_model_size"):
            self._transcriber.set_model_size(new_whisper_model)

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

    def resize_window(self, expand: Any = True, width: Any = None) -> Dict[str, Any]:
        if isinstance(expand, dict):
            d = expand
            expand = d.get("expand", True)
            width = d.get("width", None)
        expand = bool(expand)

        if not self._window:
            return {"status": "no_window", "expanded": expand}

        try:
            curr_w = self._window.width
            curr_h = self._window.height
            curr_x = self._window.x
            curr_y = self._window.y

            if not expand:
                target_w = 560
            elif width is not None and int(width) > 0:
                target_w = int(width)
            else:
                target_w = 960

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

    def ask_ai_about_highlight(
        self,
        session_id: Any = None,
        highlight_id: str = "",
        text: str = "",
        custom_instruction: Optional[str] = None,
    ) -> Dict[str, Any]:
        if isinstance(session_id, dict):
            d = session_id
            session_id = d.get("session_id", "")
            highlight_id = d.get("highlight_id", "")
            text = d.get("text", "")
            custom_instruction = d.get("custom_instruction", None)

        sid = _normalize_id(session_id)
        # Resolve prompt instruction: explicitly passed > session db record > None (agent falls back to default)
        instruction_to_use = custom_instruction
        if instruction_to_use is None and sid:
            sess_rec = self._storage.get_session(sid)
            if sess_rec:
                instruction_to_use = sess_rec.get("prompt_highlight")

        def _worker():
            try:
                print(f"[Bridge] >>> Triggering AI highlight query for: '{text}' (Highlight ID: {highlight_id})", flush=True)
                prompt = f"The user wants to expand on the following content: {text}"
                result = self._agent.analyze_intent(
                    text_excerpt=prompt,
                    is_hotkey=True,
                    segment_ids=[],
                    custom_system_instruction=instruction_to_use,
                )
                highlight_update = {
                    "id": highlight_id,
                    "ai_response": result["content"],
                    "thought": result.get("thought", ""),
                    "action_cards": result.get("action_cards", []),
                }
                if sid:
                    self._storage.add_or_update_highlight(sid, highlight_update)

                self._emit_to_ui("onHighlightAiResponse", {
                    "session_id": sid,
                    "highlight_id": highlight_id,
                    "ai_response": result["content"],
                    "thought": result.get("thought", ""),
                    "action_cards": result.get("action_cards", []),
                })
            except Exception as e:
                print(f"[Bridge] Error in ask_ai_about_highlight: {e}", flush=True)
                self._emit_to_ui("onHighlightAiResponse", {
                    "session_id": sid,
                    "highlight_id": highlight_id,
                    "error": str(e),
                    "ai_response": f"Error contacting AI: {e}",
                })

        threading.Thread(target=_worker, daemon=True).start()
        return {"status": "started", "highlight_id": highlight_id}

    def save_highlight(self, session_id: Any = None, highlight: Any = None) -> Dict[str, Any]:
        if isinstance(session_id, dict):
            d = session_id
            session_id = d.get("session_id") or d.get("id") or ""
            highlight = d.get("highlight", {})
        sid = _normalize_id(session_id)
        if sid and highlight:
            saved_list = self._storage.add_or_update_highlight(sid, highlight)
            return {"status": "saved", "highlights": saved_list}
        return {"status": "failed"}

    def delete_highlight(self, session_id: Any = None, highlight_id: Any = None) -> Dict[str, Any]:
        if isinstance(session_id, dict):
            d = session_id
            session_id = d.get("session_id") or d.get("id") or ""
            highlight_id = d.get("highlight_id") or d.get("highlightId") or ""
        sid = _normalize_id(session_id)
        hid = _normalize_id(highlight_id)
        if sid and hid:
            updated = self._storage.delete_highlight(sid, hid)
            return {"status": "ok", "highlights": updated}
        return {"status": "failed"}

    def get_highlights(self, session_id: Any = None) -> List[Dict[str, Any]]:
        sid = _normalize_id(session_id)
        return self._storage.get_highlights(sid)


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

    # Vision & Screen Capture Methods
    def get_capture_targets(self) -> Dict[str, Any]:
        return self._vision.list_capture_targets()

    def set_selected_target(self, target_data: Any = None) -> Dict[str, Any]:
        if isinstance(target_data, dict):
            self._selected_target = target_data
        return {"status": "ok", "target": self._selected_target}

    def capture_selected_target(self, target_data: Any = None) -> Optional[Dict[str, Any]]:
        target = target_data if isinstance(target_data, dict) else self._selected_target
        if not target:
            print("[Bridge] No capture target selected.")
            self._emit_to_ui("onScreenshotError", {"message": "Please select a screen or application first."})
            return None

        t_type = target.get("type", "screen")
        t_id = target.get("id") or target.get("hwnd") or target.get("index") or 1
        t_name = target.get("name", "")

        snap = self._vision.capture_target(t_type, t_id, t_name)
        if snap:
            self._emit_to_ui("onNewScreenshot", snap)
        return snap

    def copy_image_to_clipboard(self, image_path: Any = "") -> Dict[str, Any]:
        if isinstance(image_path, dict):
            image_path = image_path.get("image_path", "")
        success = self._vision.copy_image_to_clipboard(str(image_path))
        return {"status": "copied" if success else "failed", "success": success}

    def explain_image_with_ai(
        self,
        session_id: Any = None,
        image_id: str = "",
        image_path: str = "",
        prompt: str = "",
        target_title: str = "",
        custom_instruction: Optional[str] = None,
    ) -> Dict[str, Any]:
        if isinstance(session_id, dict):
            d = session_id
            session_id = d.get("session_id", "")
            image_id = d.get("image_id", "")
            image_path = d.get("image_path", "")
            prompt = d.get("prompt", "")
            target_title = d.get("target_title", "")
            custom_instruction = d.get("custom_instruction", None)

        sid = _normalize_id(session_id)
        instruction_to_use = custom_instruction
        if instruction_to_use is None and sid:
            sess_rec = self._storage.get_session(sid)
            if sess_rec:
                instruction_to_use = sess_rec.get("prompt_image")

        def _worker():
            try:
                print(f"[Bridge] >>> Triggering Vision AI query for: '{target_title}' (Image ID: {image_id})", flush=True)
                result = self._agent.analyze_vision(
                    image_path=image_path,
                    prompt=prompt,
                    target_title=target_title,
                    custom_system_instruction=instruction_to_use,
                )
                self._emit_to_ui("onVisionAiResponse", {
                    "session_id": sid,
                    "image_id": image_id,
                    "image_path": image_path,
                    "target_title": target_title,
                    "ai_response": result["content"],
                    "thought": result["thought"],
                    "timestamp": time.time(),
                })
            except Exception as e:
                print(f"[Bridge] Error in explain_image_with_ai: {e}", flush=True)
                self._emit_to_ui("onVisionAiResponse", {
                    "session_id": sid,
                    "image_id": image_id,
                    "image_path": image_path,
                    "target_title": target_title,
                    "error": str(e),
                    "ai_response": f"Error analyzing screenshot: {e}",
                    "thought": "Failed during AI inference.",
                })

        threading.Thread(target=_worker, daemon=True).start()
        return {"status": "started", "image_id": image_id}

    def delete_screenshot(self, image_id: Any = None, image_path: str = "") -> Dict[str, Any]:
        if isinstance(image_id, dict):
            image_path = image_id.get("image_path", "")
            image_id = image_id.get("image_id", "")
        success = self._vision.delete_screenshot(str(image_path))
        return {"status": "ok" if success else "failed", "image_id": image_id, "deleted": success}

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

    def get_session(self, session_id: Any = None) -> Optional[Dict[str, Any]]:
        sid = _normalize_id(session_id)
        if not sid:
            return None
        self._active_session_id = sid
        self._buffer.clear()
        return self._storage.get_session(sid)

    def save_session(
        self,
        session_id: Any = None,
        title: str = "",
        notes: str = "",
        messages: Any = None,
        highlights: Any = None,
        prompt_highlight: Any = _SENTINEL,
        prompt_image: Any = _SENTINEL,
    ) -> bool:
        if isinstance(session_id, dict):
            d = session_id
            session_id = d.get("session_id") or d.get("id") or ""
            title = d.get("title", "")
            notes = d.get("notes", "")
            messages = d.get("messages", [])
            highlights = d.get("highlights", None)
            if "prompt_highlight" in d:
                prompt_highlight = d["prompt_highlight"]
            if "prompt_image" in d:
                prompt_image = d["prompt_image"]

        sid = _normalize_id(session_id)
        if not sid:
            return False

        return self._storage.update_session(
            sid,
            title=title if title else None,
            notes=notes if notes is not None else None,
            messages=messages,
            highlights=highlights,
            prompt_highlight=prompt_highlight,
            prompt_image=prompt_image,
        )

    def delete_session(self, session_id: Any = None) -> bool:
        sid = _normalize_id(session_id)
        if not sid:
            return False
        if self._active_session_id == sid:
            self._active_session_id = None
            self._buffer.clear()
        return self._storage.delete_session(sid)

    def get_default_prompts(self) -> Dict[str, str]:
        return {
            "highlight": DEFAULT_HIGHLIGHT_SYSTEM_INSTRUCTION,
            "image": DEFAULT_VISION_SYSTEM_INSTRUCTION,
        }

    # Window controls & Transparency
    def set_window_opacity(self, opacity: Any = 1.0) -> Dict[str, Any]:
        if isinstance(opacity, dict):
            opacity = opacity.get("opacity", 1.0)
        try:
            val = float(opacity)
        except (ValueError, TypeError):
            val = 1.0
        # Clamp to 50% (0.5) - 100% (1.0)
        val = max(0.5, min(1.0, val))

        self._config["window_opacity"] = val
        save_config(self._config)

        if sys.platform == "win32":
            try:
                # 1. Native WinForms non-blocking Form.Opacity
                if self._window:
                    try:
                        import webview.platforms.winforms as wf
                        form = wf.BrowserView.instances.get(self._window.uid)
                        if form:
                            def _apply_opacity():
                                try:
                                    form.Opacity = val
                                except Exception:
                                    pass

                            if hasattr(form, "InvokeRequired") and form.InvokeRequired:
                                import System
                                form.BeginInvoke(System.Action(_apply_opacity))
                            else:
                                _apply_opacity()
                            return {"status": "ok", "opacity": val}
                    except Exception as wf_err:
                        pass

                # 2. Win32 fallback via window handle
                import win32gui
                import win32con

                hwnd = win32gui.FindWindow(None, "Ambient Copilot")
                if hwnd:
                    alpha = int(round(val * 255))
                    ex_style = win32gui.GetWindowLong(hwnd, win32con.GWL_EXSTYLE)
                    if not (ex_style & win32con.WS_EX_LAYERED):
                        win32gui.SetWindowLong(hwnd, win32con.GWL_EXSTYLE, ex_style | win32con.WS_EX_LAYERED)
                    win32gui.SetLayeredWindowAttributes(hwnd, 0, alpha, win32con.LWA_ALPHA)
                    return {"status": "ok", "opacity": val, "hwnd": hwnd}
            except Exception as e:
                print(f"[Bridge] Error setting native window opacity: {e}", flush=True)
                return {"status": "error", "message": str(e), "opacity": val}

        return {"status": "ok", "opacity": val}

    def get_window_opacity(self) -> float:
        return float(self._config.get("window_opacity", 1.0))

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


import threading
from typing import Dict, Callable, Optional
from pynput import keyboard


class GlobalHotkeyManager:
    def __init__(self):
        self._listener: Optional[keyboard.GlobalHotKeys] = None
        self._callbacks: Dict[str, Callable[[], None]] = {}
        self._lock = threading.Lock()

    def register(self, hotkey_str: str, callback: Callable[[], None]):
        """
        Registers or updates a hotkey string.
        Examples: '<ctrl>+<shift>+a', '<cmd>+<shift>+a' (where <cmd> is Windows Key)
        """
        with self._lock:
            # Normalize hotkey format if user typed Win+Shift+A
            normalized = self._normalize_key_string(hotkey_str)
            self._callbacks[normalized] = callback
            self._restart_listener()

    def unregister_all(self):
        with self._lock:
            self._callbacks.clear()
            self._stop_listener()

    def update_hotkey(self, old_hotkey: str, new_hotkey: str, callback: Callable[[], None]):
        with self._lock:
            old_norm = self._normalize_key_string(old_hotkey)
            if old_norm in self._callbacks:
                del self._callbacks[old_norm]
            new_norm = self._normalize_key_string(new_hotkey)
            self._callbacks[new_norm] = callback
            self._restart_listener()

    def _normalize_key_string(self, key_str: str) -> str:
        s = key_str.lower().strip()
        s = s.replace("win", "<cmd>")
        s = s.replace("ctrl", "<ctrl>")
        s = s.replace("control", "<ctrl>")
        s = s.replace("shift", "<shift>")
        s = s.replace("alt", "<alt>")
        # Fix potential double brackets like <<ctrl>>
        while "<<" in s:
            s = s.replace("<<", "<")
        while ">>" in s:
            s = s.replace(">>", ">")
        return s

    def _restart_listener(self):
        self._stop_listener()
        if not self._callbacks:
            return

        def wrap_cb(cb):
            def handler():
                threading.Thread(target=cb, daemon=True).start()
            return handler

        hotkey_dict = {
            k: wrap_cb(v) for k, v in self._callbacks.items()
        }

        try:
            self._listener = keyboard.GlobalHotKeys(hotkey_dict)
            self._listener.start()
            print(f"[HotkeyManager] Global hotkeys active: {list(hotkey_dict.keys())}")
        except Exception as e:
            print(f"[HotkeyManager] Failed to start hotkey listener: {e}")

    def _stop_listener(self):
        if self._listener:
            try:
                self._listener.stop()
            except Exception:
                pass
            self._listener = None

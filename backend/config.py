import os
import json
from pathlib import Path
from typing import Optional, Dict, Any

DEFAULT_CONFIG: Dict[str, Any] = {
    "audio_intent_hotkey": "<ctrl>+<shift>+a",
    "vision_intent_hotkey": "<ctrl>+<shift>+v",
    "preset_switcher_hotkey": "<ctrl>+p",
    "default_audio_preset_id": "default-audio-ambient",
    "default_vision_preset_id": "default-vision-ambient",
    "lookback_duration_sec": 10,
    "lookback_words": 50,
    "whisper_model": "small.en",
    "input_device_index": None,
    "loopback_device_index": None,
    "gemini_api_key": "",
    "always_on_top": True,
    "window_width": 560,
    "window_height": 720,
    "window_x": None,
    "window_y": None,
}

CONFIG_DIR = Path.home() / ".ambient_copilot"
CONFIG_FILE = CONFIG_DIR / "config.json"


def get_config_dir() -> Path:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    return CONFIG_DIR


def load_config() -> Dict[str, Any]:
    get_config_dir()
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                config = DEFAULT_CONFIG.copy()
                config.update(data)
                return config
        except Exception as e:
            print(f"Error loading config, using defaults: {e}")
    return DEFAULT_CONFIG.copy()


def save_config(config_data: Dict[str, Any]) -> Dict[str, Any]:
    get_config_dir()
    current = load_config()
    current.update(config_data)
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(current, f, indent=2)
    except Exception as e:
        print(f"Error saving config: {e}")
    return current

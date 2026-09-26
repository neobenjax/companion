import os
import sys
import threading
from pathlib import Path

# Add project root to sys.path
root_dir = str(Path(__file__).parent.parent.resolve())
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

import webview
from backend.bridge import CompanionBridge
from backend.config import load_config


def start_native_app():
    print("=" * 65, flush=True)
    print("   Ambient Multimodal Windows Copilot (Granola + Antigravity)   ", flush=True)
    print("=" * 65, flush=True)

    config = load_config()
    bridge = CompanionBridge()

    frontend_dist = (Path(__file__).parent.parent / "frontend" / "dist").resolve()
    index_html = frontend_dist / "index.html"
    if not index_html.exists():
        print(f"[Desktop] ERROR: {index_html} does not exist! Please run 'npm run build' first.", flush=True)
        return

    # Dedicated UserDataFolder for Edge WebView2 to prevent access denied errors
    user_data_dir = Path.home() / "AppData" / "Local" / "AmbientCopilot" / "WebViewData"
    user_data_dir.mkdir(parents=True, exist_ok=True)
    print(f"[Desktop] WebView2 UserDataFolder: {user_data_dir}", flush=True)

    width = int(config.get("window_width", 460))
    height = int(config.get("window_height", 720))
    on_top = bool(config.get("always_on_top", True))

    # Enable native drag region from CSS class .drag-region
    webview.settings["DRAG_REGION_SELECTOR"] = ".drag-region"

    # Multi-monitor coordinate detection
    screens = webview.screens
    x = None
    y = None
    if screens:
        print(f"[Desktop] Connected screens detected ({len(screens)}):", flush=True)
        for i, s in enumerate(screens):
            print(f"  - Screen {i}: {s.width}x{s.height} at ({s.x}, {s.y})", flush=True)
        primary = screens[0]
        # Position window docked to the right edge of primary screen with a 25px margin
        x = primary.x + primary.width - width - 25
        y = primary.y + max(20, (primary.height - height) // 2)
        print(f"[Desktop] Docking window to Primary Screen at X={x}, Y={y}", flush=True)

    # Create the native desktop window
    window = webview.create_window(
        title="Ambient Copilot",
        url=str(index_html),
        js_api=bridge,
        width=width,
        height=height,
        x=x,
        y=y,
        resizable=True,
        frameless=False,
        on_top=on_top,
        text_select=True,
        background_color="#09090b",
    )
    bridge.set_window(window)

    def on_window_ready():
        print("\n" + "=" * 65, flush=True)
        print("   >>> AMBIENT COPILOT WINDOW IS VISIBLE ON SCREEN <<<   ", flush=True)
        print("=" * 65, flush=True)
        print(f"  - Title: Ambient Copilot", flush=True)
        print(f"  - Coordinates: X={x}, Y={y}, Size={width}x{height}", flush=True)
        print(f"  - Always on Top: {on_top}", flush=True)
        print(f"  - Global Audio Intent Hotkey: {config.get('audio_intent_hotkey', '<ctrl>+<shift>+a')}", flush=True)
        print("=" * 65 + "\n", flush=True)

    try:
        print("[Desktop] Starting native EdgeChromium window...", flush=True)
        webview.start(
            on_window_ready,
            storage_path=str(user_data_dir),
            private_mode=False,
            gui="edgechromium",
        )
    finally:
        print("[Desktop] Window closed, cleaning up background workers...", flush=True)
        try:
            bridge.stop_recording()
            bridge._hotkeys.unregister_all()
        except Exception:
            pass
        print("[Desktop] Application shutdown complete.", flush=True)


if __name__ == "__main__":
    start_native_app()

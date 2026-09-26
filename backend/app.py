import os
import sys
from pathlib import Path

# Ensure project root is in sys.path
root_dir = str(Path(__file__).parent.parent.resolve())
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

import webview
from backend.bridge import CompanionBridge
from backend.config import load_config


def main():
    config = load_config()
    bridge = CompanionBridge()

    # Determine URL
    dist_index = (Path(__file__).parent.parent / "frontend" / "dist" / "index.html").resolve()
    dev_url = "http://localhost:5173"

    if not os.environ.get("VITE_DEV") and dist_index.exists():
        target_url = str(dist_index)
        use_http_server = True
    else:
        target_url = dev_url
        use_http_server = False

    width = int(config.get("window_width", 480))
    height = int(config.get("window_height", 740))
    on_top = bool(config.get("always_on_top", True))
    frameless = bool(config.get("frameless", False))

    print(f"[Copilot] Target URL: {target_url}", flush=True)
    print(f"[Copilot] Initializing window ({width}x{height}, always_on_top={on_top}, frameless={frameless})...", flush=True)

    window = webview.create_window(
        title="Ambient Copilot",
        url=target_url,
        js_api=bridge,
        width=width,
        height=height,
        min_size=(360, 520),
        resizable=True,
        on_top=on_top,
        frameless=frameless,
        easy_drag=False,
        background_color="#18181b",  # zinc-900
    )

    bridge.set_window(window)

    def on_shown():
        print("[Copilot] Ambient Copilot HUD window is now visible on screen!", flush=True)
        try:
            import ctypes
            hwnd = window.native.Handle.ToInt32()
            user32 = ctypes.windll.user32
            # Force window to show, bring to top and activate
            user32.ShowWindow(hwnd, 5)  # SW_SHOW
            user32.SetForegroundWindow(hwnd)
            user32.BringWindowToTop(hwnd)
            try:
                window.native.ShowInTaskbar = True
            except Exception:
                pass
            print(f"[Copilot] Window {hwnd} focused and brought to foreground.", flush=True)
        except Exception as e:
            print(f"[Copilot] Foreground notification: {e}", flush=True)

    def on_loaded():
        print("[Copilot] Frontend UI loaded successfully.", flush=True)

    window.events.shown += on_shown
    window.events.loaded += on_loaded

    print(f"[Copilot] Starting desktop runtime...", flush=True)
    webview.start(
        debug=bool(os.environ.get("DEBUG", False)),
        http_server=use_http_server,
    )
    print("[Copilot] Application closed.", flush=True)


if __name__ == "__main__":
    main()

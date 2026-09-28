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

    if getattr(sys, "frozen", False):
        base_dir = Path(getattr(sys, "_MEIPASS", Path(sys.executable).parent))
    else:
        base_dir = Path(__file__).parent.parent.resolve()

    frontend_dist = (base_dir / "frontend" / "dist").resolve()
    if not (frontend_dist / "index.html").exists() and getattr(sys, "frozen", False):
        frontend_dist = (Path(sys.executable).parent / "frontend" / "dist").resolve()

    index_html = frontend_dist / "index.html"
    if not index_html.exists():
        print(f"[Desktop] ERROR: {index_html} does not exist! Please run 'npm run build' first.", flush=True)
        return

    # Dedicated UserDataFolder for Edge WebView2 to prevent access denied errors
    user_data_dir = Path.home() / "AppData" / "Local" / "AmbientCopilot" / "WebViewData"
    user_data_dir.mkdir(parents=True, exist_ok=True)
    print(f"[Desktop] WebView2 UserDataFolder: {user_data_dir}", flush=True)

    # Purge any stale browser cache in WebView2 profile so frontend updates reflect immediately
    default_dir = user_data_dir / "EBWebView" / "Default"
    if default_dir.exists():
        import shutil
        for cache_name in ["Cache", "Code Cache", "GPUCache", "DawnGraphiteCache", "DawnWebGPUCache"]:
            cf = default_dir / cache_name
            if cf.exists():
                try:
                    shutil.rmtree(cf, ignore_errors=True)
                except Exception:
                    pass

    width = int(config.get("window_width", 560))
    if width < 560:
        width = 560
    height = int(config.get("window_height", 720))
    on_top = bool(config.get("always_on_top", True))

    # Enable native drag region from CSS class .drag-region
    webview.settings["DRAG_REGION_SELECTOR"] = ".drag-region"

    # Multi-monitor coordinate detection with Primary Monitor WorkArea calibration
    x = None
    y = None
    if sys.platform == "win32":
        try:
            import win32api
            import win32con
            mons = win32api.EnumDisplayMonitors()
            primary_mon = None
            for m in mons:
                info = win32api.GetMonitorInfo(m[0])
                if info.get("Flags", 0) & win32con.MONITORINFOF_PRIMARY:
                    primary_mon = info
                    break
            if not primary_mon and mons:
                primary_mon = win32api.GetMonitorInfo(mons[0][0])

            if primary_mon:
                work_left, work_top, work_right, work_bottom = primary_mon["Work"]
                work_w = work_right - work_left
                work_h = work_bottom - work_top
                x = work_right - width - 20
                y = work_top + max(20, (work_h - height) // 2)
                print(f"[Desktop] Docking window to Primary Screen at X={x}, Y={y} (WorkArea: {primary_mon['Work']})", flush=True)
        except Exception as e:
            print(f"[Desktop] Win32 primary monitor detection note: {e}", flush=True)

    if x is None:
        screens = webview.screens
        if screens:
            primary = screens[0]
            x = primary.x + primary.width - width - 25
            y = primary.y + max(20, (primary.height - height) // 2)
            print(f"[Desktop] Fallback docking window to Screen 0 at X={x}, Y={y}", flush=True)

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
    bridge._set_window(window)

    def on_window_ready():
        print("\n" + "=" * 65, flush=True)
        print("   >>> AMBIENT COPILOT WINDOW IS VISIBLE ON SCREEN <<<   ", flush=True)
        print("=" * 65, flush=True)
        print(f"  - Title: Ambient Copilot", flush=True)
        print(f"  - Coordinates: X={x}, Y={y}, Size={width}x{height}", flush=True)
        print(f"  - Always on Top: {on_top}", flush=True)
        print(f"  - Global Audio Intent Hotkey: {config.get('audio_intent_hotkey', '<ctrl>+<shift>+a')}", flush=True)

        saved_opacity = max(0.5, min(1.0, float(config.get("window_opacity", 1.0))))
        if saved_opacity < 1.0:
            print(f"  - Configured Window Opacity: {int(saved_opacity * 100)}%", flush=True)

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

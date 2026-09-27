import os
import io
import time
import base64
import ctypes
from pathlib import Path
from typing import List, Dict, Any, Optional

from PIL import Image
import mss
import win32gui
import win32ui
import win32con
import win32clipboard


MEDIA_DIR = Path.home() / ".ambient_copilot" / "media"


def ensure_media_dir() -> Path:
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    return MEDIA_DIR


def attach_default_desktop():
    r"""
    Attaches the current thread to the interactive WinSta0\Default desktop station
    and sets Per-Monitor DPI Awareness V2 if running in Windows.
    """
    if os.name != "nt":
        return
    try:
        user32 = ctypes.windll.user32
        # Set Per-Monitor DPI Awareness V2 on this capture thread (-4)
        try:
            user32.SetThreadDpiAwarenessContext(ctypes.c_void_p(-4))
        except Exception:
            pass

        h_winsta = user32.OpenWindowStationW("WinSta0", False, 0x10000000)
        if h_winsta:
            user32.SetProcessWindowStation(h_winsta)
        h_desk = user32.OpenDesktopW("Default", 0, False, 0x10000000)
        if h_desk:
            user32.SetThreadDesktop(h_desk)
    except Exception as e:
        print(f"[Vision] attach_default_desktop note: {e}")


def get_process_info(hwnd: int) -> str:
    """Returns friendly process/application name for an hwnd"""
    try:
        import win32process
        import win32api
        import win32con
        _, pid = win32process.GetWindowThreadProcessId(hwnd)
        exe_name = ""
        h_proc = win32api.OpenProcess(win32con.PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
        if h_proc:
            try:
                path = win32process.GetModuleFileNameEx(h_proc, 0)
                exe_name = os.path.basename(path)
            finally:
                win32api.CloseHandle(h_proc)

        app_map = {
            "antigravity.exe": "Antigravity",
            "code.exe": "VS Code",
            "chrome.exe": "Google Chrome",
            "msedge.exe": "Microsoft Edge",
            "whatsapp.exe": "WhatsApp",
            "whatsapp.root.exe": "WhatsApp",
            "taskmgr.exe": "Task Manager",
            "spotify.exe": "Spotify",
            "slack.exe": "Slack",
            "discord.exe": "Discord",
            "notepad.exe": "Notepad",
            "explorer.exe": "File Explorer",
        }
        app_name = app_map.get(exe_name.lower())
        if not app_name and exe_name:
            app_name = os.path.splitext(exe_name)[0].split(".")[0].replace("_", " ").strip()
        return app_name or "Application"
    except Exception:
        return "Application"


class VisionCaptureManager:
    def __init__(self):
        ensure_media_dir()

    def list_capture_targets(self) -> Dict[str, List[Dict[str, Any]]]:
        attach_default_desktop()
        screens: List[Dict[str, Any]] = []
        applications: List[Dict[str, Any]] = []

        # 1. Enumerate Monitors with exact physical pixel rects via win32api
        try:
            import win32api
            mon_handles = win32api.EnumDisplayMonitors()
            for i, (hmon, hdc, rect) in enumerate(mon_handles, start=1):
                info = win32api.GetMonitorInfo(hmon)
                m_left, m_top, m_right, m_bottom = rect
                m_w = m_right - m_left
                m_h = m_bottom - m_top
                is_prim = bool(info.get("Flags", 0) & 1)

                label = f"Screen {i}"
                if is_prim:
                    label += " (Primary)"
                label += f" ({m_w}x{m_h})"

                screens.append({
                    "id": f"screen_{i}",
                    "type": "screen",
                    "index": i,
                    "name": label,
                    "width": m_w,
                    "height": m_h,
                    "left": m_left,
                    "top": m_top,
                    "is_primary": is_prim,
                })
        except Exception as e:
            print(f"[Vision] Error enumerating monitors with win32api: {e}")
            try:
                with mss.MSS() as sct:
                    for i, m in enumerate(sct.monitors[1:], start=1):
                        screens.append({
                            "id": f"screen_{i}",
                            "type": "screen",
                            "index": i,
                            "name": f"Screen {i} ({m['width']}x{m['height']})",
                            "width": m["width"],
                            "height": m["height"],
                            "left": m["left"],
                            "top": m["top"],
                            "is_primary": i == 1,
                        })
            except Exception as e2:
                print(f"[Vision] Fallback error enumerating monitors: {e2}")

        # 2. Enumerate Top-level Application Windows
        try:
            user32 = ctypes.windll.user32
            dwmapi = ctypes.windll.dwmapi
            h_desk = user32.OpenDesktopW("Default", 0, False, 0x10000000)

            def is_cloaked(hwnd):
                try:
                    cloaked = ctypes.c_int(0)
                    res = dwmapi.DwmGetWindowAttribute(hwnd, 14, ctypes.byref(cloaked), ctypes.sizeof(cloaked))
                    return res == 0 and bool(cloaked.value)
                except Exception:
                    return False

            def _enum_cb(hwnd, lparam):
                if not user32.IsWindowVisible(hwnd) or is_cloaked(hwnd):
                    return True

                exstyle = user32.GetWindowLongW(hwnd, win32con.GWL_EXSTYLE)
                if exstyle & win32con.WS_EX_TOOLWINDOW:
                    return True

                length = user32.GetWindowTextLengthW(hwnd)
                if length <= 0:
                    return True

                buf = ctypes.create_unicode_buffer(length + 1)
                user32.GetWindowTextW(hwnd, buf, length + 1)
                title = buf.value.strip()

                # Filter out system and utility windows
                if not title or title in (
                    "Program Manager", "Settings", "Windows Input Experience", 
                    "NVIDIA GeForce Overlay", "Charger Daemon", "Default IME", "MSCTFIME UI"
                ):
                    return True
                if "Ambient Copilot" in title:
                    return True

                rect = win32gui.GetWindowRect(hwnd)
                w = rect[2] - rect[0]
                h = rect[3] - rect[1]

                if w > 120 and h > 100:
                    app_name = get_process_info(hwnd)
                    if app_name.lower() in ("python", "pythonw") and "ambient" in title.lower():
                        return True
                    # Format as [Application Name] - [Current Name]
                    formatted_name = f"[{app_name}] - {title}"
                    applications.append({
                        "id": f"win_{hwnd}",
                        "type": "window",
                        "hwnd": hwnd,
                        "name": formatted_name,
                        "app_name": app_name,
                        "raw_title": title,
                        "width": w,
                        "height": h,
                    })
                return True

            WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)
            user32.EnumDesktopWindows(h_desk, WNDENUMPROC(_enum_cb), 0)

            # Sort applications alphabetically by name
            applications.sort(key=lambda x: x["name"].lower())
        except Exception as e:
            print(f"[Vision] Error enumerating windows: {e}")

        return {
            "screens": screens,
            "applications": applications,
        }

    def capture_target(self, target_type: str, target_id: Any, target_name: str = "") -> Optional[Dict[str, Any]]:
        attach_default_desktop()
        pil_image: Optional[Image.Image] = None
        target_title = target_name

        try:
            if target_type == "screen":
                # target_id might be "screen_1" or integer 1
                try:
                    idx = int(str(target_id).replace("screen_", ""))
                except Exception:
                    idx = 1

                import win32api
                grab_rect = None
                try:
                    mon_handles = win32api.EnumDisplayMonitors()
                    if 1 <= idx <= len(mon_handles):
                        hmon, _, rect = mon_handles[idx - 1]
                        m_left, m_top, m_right, m_bottom = rect
                        grab_rect = {
                            "left": m_left,
                            "top": m_top,
                            "width": m_right - m_left,
                            "height": m_bottom - m_top,
                        }
                except Exception as e:
                    print(f"[Vision] win32api monitor rect error: {e}")

                with mss.MSS() as sct:
                    if grab_rect is not None:
                        sct_img = sct.grab(grab_rect)
                    else:
                        if idx < len(sct.monitors):
                            mon = sct.monitors[idx]
                        else:
                            mon = sct.monitors[1]
                        sct_img = sct.grab(mon)

                    pil_image = Image.frombytes("RGB", sct_img.size, sct_img.bgra, "raw", "BGRX")
                    if not target_title:
                        target_title = f"Screen {idx}"

            elif target_type == "window":
                try:
                    hwnd = int(str(target_id).replace("win_", ""))
                except Exception:
                    hwnd = int(target_id)

                if not target_title:
                    target_title = win32gui.GetWindowText(hwnd) or f"Window {hwnd}"

                # Restore if minimized
                if win32gui.IsIconic(hwnd):
                    win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
                    time.sleep(0.15)

                rect = win32gui.GetWindowRect(hwnd)
                w = max(1, rect[2] - rect[0])
                h = max(1, rect[3] - rect[1])

                # Use GDI PrintWindow (PW_RENDERFULLCONTENT = 2)
                hwndDC = win32gui.GetWindowDC(hwnd)
                mfcDC = win32ui.CreateDCFromHandle(hwndDC)
                saveDC = mfcDC.CreateCompatibleDC()
                saveBitMap = win32ui.CreateBitmap()
                saveBitMap.CreateCompatibleBitmap(mfcDC, w, h)
                saveDC.SelectObject(saveBitMap)

                ctypes.windll.user32.PrintWindow(hwnd, saveDC.GetSafeHdc(), 2)
                bmpinfo = saveBitMap.GetInfo()
                bmpstr = saveBitMap.GetBitmapBits(True)
                pil_image = Image.frombuffer("RGB", (bmpinfo["bmWidth"], bmpinfo["bmHeight"]), bmpstr, "raw", "BGRX", 0, 1)

                win32gui.DeleteObject(saveBitMap.GetHandle())
                saveDC.DeleteDC()
                mfcDC.DeleteDC()
                win32gui.ReleaseDC(hwnd, hwndDC)

        except Exception as e:
            print(f"[Vision] Error during capture: {e}")

        if not pil_image:
            return None

        # Save high-res PNG file
        snap_id = f"snap_{int(time.time() * 1000)}"
        file_path = ensure_media_dir() / f"{snap_id}.png"
        pil_image.save(file_path, format="PNG")

        # Generate thumbnail data URI (~400px max width/height for snappy UI rendering)
        thumb = pil_image.copy()
        thumb.thumbnail((480, 320), Image.Resampling.LANCZOS)
        thumb_buf = io.BytesIO()
        thumb.save(thumb_buf, format="JPEG", quality=85)
        b64_str = base64.b64encode(thumb_buf.getvalue()).decode("utf-8")
        thumb_data_uri = f"data:image/jpeg;base64,{b64_str}"

        return {
            "id": snap_id,
            "target_type": target_type,
            "target_id": str(target_id),
            "target_title": target_title,
            "image_path": str(file_path),
            "thumbnail_url": thumb_data_uri,
            "width": pil_image.width,
            "height": pil_image.height,
            "timestamp": time.time(),
        }

    def copy_image_to_clipboard(self, image_path: str) -> bool:
        if not os.path.exists(image_path):
            print(f"[Vision] Cannot copy: image path does not exist {image_path}")
            return False

        try:
            im = Image.open(image_path)
            output = io.BytesIO()
            im.convert("RGB").save(output, "BMP")
            data = output.getvalue()[14:]  # Strip BMP header for CF_DIB

            win32clipboard.OpenClipboard()
            win32clipboard.EmptyClipboard()
            win32clipboard.SetClipboardData(win32clipboard.CF_DIB, data)
            win32clipboard.CloseClipboard()
            print(f"[Vision] Successfully copied {image_path} to clipboard as CF_DIB")
            return True
        except Exception as e:
            print(f"[Vision] Error copying image to clipboard: {e}")
            return False

    def delete_screenshot(self, image_path: str) -> bool:
        try:
            if not image_path:
                return False
            p = Path(image_path)
            if p.exists() and p.is_file():
                p.unlink()
                print(f"[Vision] Successfully deleted screenshot file: {image_path}")
                return True
        except Exception as e:
            print(f"[Vision] Error deleting screenshot file {image_path}: {e}")
        return False


import os
import sys
import subprocess
import time
from pathlib import Path


def ensure_default_desktop():
    """
    Detects if the process was launched inside an isolated virtual desktop sandbox
    (e.g., Antigravity IDE terminal 'exebox-...'). If so, transparently respawns
    the process targeting the interactive 'WinSta0\\Default' desktop so the window
    physically renders on the user's active monitor display.
    """
    if sys.platform != "win32" or os.environ.get("DESKTOP_ATTACHED") == "1":
        return

    try:
        import ctypes
        from ctypes import wintypes

        user32 = ctypes.windll.user32
        kernel32 = ctypes.windll.kernel32

        h_desk = user32.GetThreadDesktop(kernel32.GetCurrentThreadId())
        buf = ctypes.create_unicode_buffer(256)
        user32.GetUserObjectInformationW(h_desk, 2, buf, 256, None)
        current_desktop = buf.value.lower()

        if current_desktop != "default":
            print(f"[Launcher] Detected sandbox desktop '{buf.value}'. Relaunching onto user's physical 'WinSta0\\Default' screen...", flush=True)

            STARTF_USESTDHANDLES = 0x00000100

            class STARTUPINFOW(ctypes.Structure):
                _fields_ = [
                    ('cb', wintypes.DWORD),
                    ('lpReserved', wintypes.LPWSTR),
                    ('lpDesktop', wintypes.LPWSTR),
                    ('lpTitle', wintypes.LPWSTR),
                    ('dwX', wintypes.DWORD),
                    ('dwY', wintypes.DWORD),
                    ('dwXSize', wintypes.DWORD),
                    ('dwYSize', wintypes.DWORD),
                    ('dwXCountChars', wintypes.DWORD),
                    ('dwYCountChars', wintypes.DWORD),
                    ('dwFillAttribute', wintypes.DWORD),
                    ('dwFlags', wintypes.DWORD),
                    ('wShowWindow', wintypes.WORD),
                    ('cbReserved2', wintypes.WORD),
                    ('lpReserved2', ctypes.c_char_p),
                    ('hStdInput', wintypes.HANDLE),
                    ('hStdOutput', wintypes.HANDLE),
                    ('hStdError', wintypes.HANDLE),
                ]

            class PROCESS_INFORMATION(ctypes.Structure):
                _fields_ = [
                    ('hProcess', wintypes.HANDLE),
                    ('hThread', wintypes.HANDLE),
                    ('dwProcessId', wintypes.DWORD),
                    ('dwThreadId', wintypes.DWORD),
                ]

            si = STARTUPINFOW()
            si.cb = ctypes.sizeof(STARTUPINFOW)
            si.lpDesktop = "WinSta0\\Default"
            si.dwFlags = STARTF_USESTDHANDLES
            si.hStdInput = kernel32.GetStdHandle(-10)
            si.hStdOutput = kernel32.GetStdHandle(-11)
            si.hStdError = kernel32.GetStdHandle(-12)

            pi = PROCESS_INFORMATION()
            os.environ["DESKTOP_ATTACHED"] = "1"
            cmd = f'"{sys.executable}" ' + " ".join([f'"{a}"' for a in sys.argv])

            success = kernel32.CreateProcessW(
                None,
                cmd,
                None,
                None,
                True,
                0,
                None,
                None,
                ctypes.byref(si),
                ctypes.byref(pi)
            )
            if success:
                print(f"[Launcher] Successfully spawned GUI process PID {pi.dwProcessId} on Default interactive desktop!", flush=True)
                kernel32.WaitForSingleObject(pi.hProcess, 0xFFFFFFFF)
                kernel32.CloseHandle(pi.hProcess)
                kernel32.CloseHandle(pi.hThread)
                sys.exit(0)
    except Exception as e:
        print(f"[Launcher] Desktop routing note: {e}", flush=True)


def main():
    if getattr(sys, "frozen", False):
        from backend.desktop import start_native_app
        start_native_app()
        return

    ensure_default_desktop()
    root = Path(__file__).parent.resolve()
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))
    frontend_dir = root / "frontend"
    dist_dir = frontend_dir / "dist"

    is_dev = "--dev" in sys.argv

    if is_dev:
        print("[Launcher] Starting in DEV mode with Vite...")
        os.environ["VITE_DEV"] = "1"
        # Start vite dev server
        vite_proc = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=str(frontend_dir),
            shell=True,
        )
        time.sleep(2.0)  # Wait for Vite to warm up
        try:
            from backend.app import main as start_app
            start_app()
        finally:
            vite_proc.terminate()
    else:
        # Auto-detect frontend source changes or missing dist
        needs_build = not (dist_dir / "index.html").exists() or "--build" in sys.argv
        if not needs_build:
            dist_mtime = (dist_dir / "index.html").stat().st_mtime
            idx_file = frontend_dir / "index.html"
            if idx_file.exists() and idx_file.stat().st_mtime > dist_mtime:
                needs_build = True
            if not needs_build:
                src_dir = frontend_dir / "src"
                if src_dir.exists():
                    for f in src_dir.rglob("*"):
                        if f.is_file() and f.stat().st_mtime > dist_mtime:
                            needs_build = True
                            break

        if needs_build:
            print("[Launcher] Detected frontend changes. Rebuilding production assets...", flush=True)
            subprocess.run(["npm", "run", "build"], cwd=str(frontend_dir), shell=True, check=True)

        from backend.desktop import start_native_app as start_app
        start_app()


if __name__ == "__main__":
    main()

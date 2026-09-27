import os
import sys
import shutil
import zipfile
import subprocess
from pathlib import Path


def build():
    root = Path(__file__).parent.resolve()
    frontend_dir = root / "frontend"
    dist_frontend = frontend_dir / "dist"

    print("[Build] Step 1: Building frontend production assets with Vite...", flush=True)
    subprocess.run(["npm", "run", "build"], cwd=str(frontend_dir), shell=True, check=True)

    print("[Build] Step 2: Running PyInstaller to bundle AmbientCopilot.exe...", flush=True)
    cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--name=AmbientCopilot",
        "--noconsole",
        "--clean",
        "--noconfirm",
        f"--add-data={dist_frontend};frontend/dist",
        "--collect-all=webview",
        "--collect-all=faster_whisper",
        "--collect-all=ctranslate2",
        "--collect-all=pyaudiowpatch",
        "--collect-all=mss",
        "--collect-all=PIL",
        "--collect-all=google.genai",
        "--hidden-import=backend",
        "--hidden-import=backend.desktop",
        "--hidden-import=backend.bridge",
        "--hidden-import=backend.config",
        "--hidden-import=backend.agent.orchestrator",
        "--hidden-import=backend.audio.capture",
        "--hidden-import=backend.audio.transcriber",
        "--hidden-import=backend.vision.capture",
        "--hidden-import=win32api",
        "--hidden-import=win32con",
        "--hidden-import=win32gui",
        "--hidden-import=win32print",
        str(root / "run.py"),
    ]
    subprocess.run(cmd, cwd=str(root), check=True)

    output_dir = root / "dist" / "AmbientCopilot"
    exe_file = output_dir / "AmbientCopilot.exe"
    if not exe_file.exists():
        raise RuntimeError(f"Expected executable {exe_file} was not produced!")

    print(f"\n[Build] SUCCESS: Binary executable created at: {exe_file}", flush=True)

    # Step 3: Package into release zip for GitHub
    zip_path = root / "dist" / "AmbientCopilot-v0.5.0-windows-x64.zip"
    print(f"[Build] Step 3: Compressing into release archive: {zip_path}...", flush=True)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for file in output_dir.rglob("*"):
            if file.is_file():
                rel_path = file.relative_to(output_dir)
                zipf.write(file, arcname=str(Path("AmbientCopilot") / rel_path))

    print(f"[Build] SUCCESS: Release package created at: {zip_path}", flush=True)
    print(f"  Archive size: {zip_path.stat().st_size / (1024 * 1024):.2f} MB\n", flush=True)


if __name__ == "__main__":
    build()

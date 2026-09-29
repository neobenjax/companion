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
        f"--splash={root / 'assets' / 'splash.png'}",
        "--exclude-module=torch",
        "--exclude-module=torchvision",
        "--exclude-module=torchaudio",
        "--exclude-module=google.genai.tests",
        "--exclude-module=pytest",
        "--exclude-module=unittest",
        "--exclude-module=tkinter",
        "--exclude-module=matplotlib",
        "--exclude-module=scipy",
        "--collect-all=pythonnet",
        "--collect-all=clr_loader",
        "--collect-all=webview",
        "--collect-all=faster_whisper",
        "--collect-all=ctranslate2",
        "--collect-all=pyaudiowpatch",
        "--collect-all=mss",
        "--collect-all=PIL",
        "--collect-all=google.genai",
        "--hidden-import=clr",
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

    # Step 2.1: Ensure root folder contains Python runtime DLLs and .NET config alongside AmbientCopilot.exe
    # This guarantees that .NET CLR and Win32 LoadLibrary find pythonXX.dll on clean Windows machines
    internal_dir = output_dir / "_internal"
    if internal_dir.exists():
        print("\n[Build] Step 2.1: Copying runtime DLLs to application root...", flush=True)
        for dll_pattern in ["python3*.dll", "python*.dll", "vcruntime140*.dll", "msvcp140*.dll"]:
            for dll_file in internal_dir.glob(dll_pattern):
                target_dest = output_dir / dll_file.name
                if not target_dest.exists():
                    shutil.copy2(dll_file, target_dest)
                    print(f"  - Placed in root: {dll_file.name}", flush=True)

    # Step 2.2: Copy AmbientCopilot.exe.config to root folder
    config_src = root / "AmbientCopilot.exe.config"
    if config_src.exists():
        shutil.copy2(config_src, output_dir / "AmbientCopilot.exe.config")
        print("  - Placed in root: AmbientCopilot.exe.config (loadFromRemoteSources enabled)", flush=True)

    print(f"\n[Build] SUCCESS: Binary executable created at: {exe_file}", flush=True)

    # Step 3: Package into release zip for GitHub
    version = "0.6.0"
    try:
        import tomllib
        with open(root / "pyproject.toml", "rb") as f:
            data = tomllib.load(f)
            version = data.get("project", {}).get("version", version)
    except Exception:
        pass
    zip_path = root / "dist" / f"AmbientCopilot-v{version}-windows-x64.zip"
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

import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path


def publish():
    print("[Publish] Step 1: Retrieving GitHub credentials...", flush=True)
    p = subprocess.run(
        ["git", "credential", "fill"],
        input="protocol=https\nhost=github.com\n",
        capture_output=True,
        text=True,
        check=True,
    )
    token = None
    for line in p.stdout.splitlines():
        if line.startswith("password="):
            token = line.split("=", 1)[1]
    if not token:
        raise RuntimeError("Could not extract GitHub token from Git Credential Manager")

    owner = "neobenjax"
    repo = "companion"
    root = Path(__file__).parent
    version = "0.6.1"
    try:
        import tomllib
        with open(root / "pyproject.toml", "rb") as f:
            data = tomllib.load(f)
            version = data.get("project", {}).get("version", version)
    except Exception:
        pass

    tag = f"v{version}"
    release_name = f"Ambient Copilot v{version} - Standalone Runtime DLL & CLR Fix"
    release_body = f"""## What's Changed in v{version}

### Fixes & Enhancements
- **Standalone Runtime DLL Resolution**: Fixed `RuntimeError: Failed to resolve Python.Runtime.Loader.Initialize` when launching `AmbientCopilot.exe` on clean Windows systems without Python installed in PATH or registry.
- **Dynamic `PYTHONNET_PYDLL` Discovery**: Automatically resolves the exact bundled Python DLL at startup.
- **Root Runtime DLL Placement**: Bundles `python313.dll`, `python3.dll`, and `vcruntime140*.dll` directly into the application root folder for immediate discovery.
- **All Features from v0.6.0**: Includes the native window transparency slider (50%–100%), independent pinned font size controls, per-conversation AI prompts, and startup stability.

### Installation & Standalone Binary
Download `AmbientCopilot-v{version}-windows-x64.zip`, extract to any folder, and run `AmbientCopilot.exe`.
"""

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "User-Agent": "AmbientCopilot-Publisher",
    }

    print(f"[Publish] Step 2: Checking GitHub Release for tag '{tag}'...", flush=True)
    req = urllib.request.Request(
        f"https://api.github.com/repos/{owner}/{repo}/releases/tags/{tag}",
        headers=headers,
    )
    release = None
    try:
        with urllib.request.urlopen(req) as resp:
            release = json.loads(resp.read().decode("utf-8"))
            print(f"[Publish] Release {tag} already exists (ID: {release['id']})", flush=True)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            print(f"[Publish] Creating new release '{tag}'...", flush=True)
            create_payload = json.dumps({
                "tag_name": tag,
                "name": release_name,
                "body": release_body,
                "draft": False,
                "prerelease": False,
            }).encode("utf-8")
            creq = urllib.request.Request(
                f"https://api.github.com/repos/{owner}/{repo}/releases",
                data=create_payload,
                headers={"Content-Type": "application/json", **headers},
                method="POST",
            )
            with urllib.request.urlopen(creq) as resp:
                release = json.loads(resp.read().decode("utf-8"))
                print(f"[Publish] Release created successfully! (ID: {release['id']})", flush=True)
        else:
            raise

    release_id = release["id"]
    zip_file = root / "dist" / f"AmbientCopilot-v{version}-windows-x64.zip"
    if not zip_file.exists():
        raise FileNotFoundError(f"{zip_file} not found")

    file_size = zip_file.stat().st_size
    file_name = zip_file.name
    print(
        f"[Publish] Step 3: Uploading binary asset '{file_name}' ({file_size / (1024 * 1024):.2f} MB)...",
        flush=True,
    )

    for asset in release.get("assets", []):
        if asset["name"] == file_name:
            print(f"[Publish] Asset '{file_name}' already exists (ID: {asset['id']}). Deleting old asset first...", flush=True)
            dreq = urllib.request.Request(
                f"https://api.github.com/repos/{owner}/{repo}/releases/assets/{asset['id']}",
                headers=headers,
                method="DELETE",
            )
            with urllib.request.urlopen(dreq) as resp:
                print("[Publish] Old asset deleted successfully.", flush=True)

    upload_url = f"https://uploads.github.com/repos/{owner}/{repo}/releases/{release_id}/assets?name={file_name}"
    with open(zip_file, "rb") as f:
        data = f.read()

    ureq = urllib.request.Request(
        upload_url,
        data=data,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/zip",
            "User-Agent": "AmbientCopilot-Publisher",
        },
        method="POST",
    )
    with urllib.request.urlopen(ureq) as resp:
        result = json.loads(resp.read().decode("utf-8"))
        download_url = result.get("browser_download_url")
        print("\n" + "=" * 65, flush=True)
        print("   >>> GITHUB RELEASE ASSET PUBLISHED SUCCESSFULLY! <<<   ", flush=True)
        print("=" * 65, flush=True)
        print(f"  - Release Tag: {tag}", flush=True)
        print(f"  - Asset: {file_name}", flush=True)
        print(f"  - Download URL: {download_url}", flush=True)
        print("=" * 65 + "\n", flush=True)


if __name__ == "__main__":
    publish()

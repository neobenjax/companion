---
name: windows-release-packaging
description: Build standalone Windows executables with PyInstaller, package distribution zips, and publish GitHub releases with binary assets when gh CLI is unavailable.
---

# Windows Standalone Packaging & GitHub Release Runbook

Use this skill when building Windows `.exe` releases for the Companion application and uploading binary distribution archives to GitHub.

## 1. Building the Windows Binary & ZIP Archive
Run the automated packaging script from the virtual environment:
```powershell
.venv\Scripts\python.exe build_exe.py
```
This performs:
1. Production Vite frontend build (`npm run build` inside `frontend/`).
2. PyInstaller compilation with `--onedir`, `--windowed`, and bundled assets (`AmbientCopilot.exe`).
3. ZIP compression into `dist/AmbientCopilot-v<version>-windows-x64.zip`.

## 2. Publishing to GitHub Releases Without `gh` CLI
When GitHub CLI (`gh`) is not installed on Windows:
1. Extract OAuth/Personal Access Token from Windows Git Credential Manager:
   ```python
   import subprocess
   p = subprocess.run(
       ["git", "credential", "fill"],
       input="protocol=https\nhost=github.com\n",
       capture_output=True, text=True, check=True
   )
   # Extract line starting with 'password='
   ```
2. Create GitHub Release via REST API:
   - Endpoint: `POST https://api.github.com/repos/{owner}/{repo}/releases`
   - Body: `tag_name`, `name`, `body`, `draft: false`, `prerelease: false`.
3. Upload binary archive (e.g. 250MB `.zip`) to Uploads API:
   - Endpoint: `POST https://uploads.github.com/repos/{owner}/{repo}/releases/{release_id}/assets?name={filename}`
   - Header: `Content-Type: application/zip`, `Authorization: Bearer {token}`.

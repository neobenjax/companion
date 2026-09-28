---
name: windows-packaging-and-release
description: Critical invariants for PowerShell execution, standalone PyInstaller packaging, and mandatory GitHub release publishing on main integration.
trigger: always_on
---

# Windows Packaging, Shell & Release Invariants

## 1. PowerShell Syntax Guardrails
- **Never use `&&` to chain commands in Windows PowerShell**:
  Standard PowerShell environments treat `&&` as a syntax error (`The token '&&' is not a valid statement separator in this version.`).
- **Always separate sequential commands with `;`**:
  Example: `git add . ; git commit -m "..." ; git push origin main`.
- **Recommended Local Execution**:
  Always use and document `uv run python run.py` to launch the application. This automatically targets the project virtual environment (`.venv`) and avoids PowerShell script execution policy (`Restricted`) blocks.

## 2. Standalone PyInstaller & Desktop Guardrails
- **Frozen Environment Detection**:
  In desktop applications built with PyInstaller, `getattr(sys, 'frozen', False)` is `True`.
  - Always guard launchers (`run.py`) against respawn or dev-server loops when frozen: launch native desktop mode directly.
  - In `backend/desktop.py`, resolve bundled frontend assets using `sys._MEIPASS` or `Path(sys.executable).parent / 'frontend' / 'dist'`.
- **Packaging Maintenance**:
  Keep `build_exe.py` up to date with all backend hidden imports (`faster_whisper`, `ctranslate2`, `torch`, `google.genai`, `pywebview`).

## 3. Mandatory Release Packaging & GitHub Publication on Main Integration
Every time a feature branch is integrated and merged into the primary branch (`main`), immediately execute the full release workflow:
1. **Version Bump**: Increment semantic version in `pyproject.toml`, `frontend/package.json`, and ensure `build_exe.py` targets the new version archive name.
2. **Push & Tag**: Commit the version bump, push `main`, and tag the release (`git tag -a v<version> -m "..." ; git push origin v<version>`).
3. **Compile Binary**: Run `build_exe.py` (`uv run python build_exe.py`) to produce `AmbientCopilot.exe` and package `dist/AmbientCopilot-v<version>-windows-x64.zip`.
4. **Publish GitHub Release**: Execute `publish_release.py` to create the release on GitHub (authenticating via Git Credential Manager) and upload the `.zip` binary archive.
5. **Branch Purge**: Delete the merged feature branch locally (`git branch -d <branch>`) and remotely on GitHub (`git push origin --delete <branch>`).

## 4. Remote Git Branch Purge & Default Branch Verification
- **GitHub Default Branch Constraint**:
  Attempting to delete a remote branch that GitHub designates as the repository default will fail (`refusing to delete the current branch: refs/heads/...`).
- **Remediation**:
  Always verify or update the default branch on GitHub to `main` (via GitHub API `PATCH /repos/{owner}/{repo}` with `{"default_branch": "main"}`) before attempting to purge stale merged feature branches.

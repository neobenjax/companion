# Windows Packaging, Shell & Release Invariants

## 1. PowerShell Syntax Guardrails
- **Never use `&&` to chain commands in Windows PowerShell**:
  Standard PowerShell environments treat `&&` as a syntax error (`The token '&&' is not a valid statement separator in this version.`).
- **Always separate sequential commands with `;`**:
  Example: `git add . ; git commit -m "..." ; git push origin main`.

## 2. Standalone PyInstaller & Desktop Guardrails
- **Frozen Environment Detection**:
  In desktop applications built with PyInstaller, `getattr(sys, 'frozen', False)` is `True`.
  - Always guard launchers (`run.py`) against respawn or dev-server loops when frozen: launch native desktop mode directly.
  - In `backend/desktop.py`, resolve bundled frontend assets using `sys._MEIPASS` or `Path(sys.executable).parent / 'frontend' / 'dist'`.
- **Packaging Maintenance**:
  Keep `build_exe.py` up to date with all backend hidden imports (`faster_whisper`, `ctranslate2`, `torch`, `google.genai`, `pywebview`).

## 3. Remote Git Branch Purge & Default Branch Verification
- **GitHub Default Branch Constraint**:
  Attempting to delete a remote branch that GitHub designates as the repository default will fail (`refusing to delete the current branch: refs/heads/...`).
- **Remediation**:
  Always verify or update the default branch on GitHub to `main` (via GitHub API `PATCH /repos/{owner}/{repo}` with `{"default_branch": "main"}`) before attempting to purge stale merged feature branches.

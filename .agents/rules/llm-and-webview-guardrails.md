---
name: llm-and-webview-guardrails
description: Critical guardrails for LLM generation parameters (thinking tokens, headroom), Windows WebView2 desktop packaging, and WinForms/WebView2 concurrency and deadlock prevention.
trigger: always_on
---

# LLM Generation & Desktop WebView2 Guardrails

## 1. Gemini Reasoning & Output Token Headroom
- **Never artificially cap `max_output_tokens` below the combined thinking + content threshold.**
  In reasoning-enabled models (e.g., Gemini 3.8 Flash, Gemini 2.5), internal thoughts count toward `max_output_tokens`. Setting low token ceilings (e.g. 350) causes the model to spend all tokens on reasoning and truncate the visible response mid-sentence with `FinishReason.MAX_TOKENS`.
- **Enforce brevity via prompt engineering, not token clamping:**
  Specify exact output constraints in the system prompt (`Under 150 words`, `Summarizing bullet points only`, `No conversational filler`).
- **Disable thinking tokens when appropriate:**
  For fast, single-turn summaries where deep reasoning is unnecessary, set `thinking_config=types.ThinkingConfig(thinking_budget=0)` to eliminate latency and save tokens.

## 2. Windows WebView2 & Desktop Packaging
- **Never append query parameters (e.g. `?v=...`) to local `file://` URIs:**
  Windows NTFS treats `?` as part of the physical filesystem filename and throws `ERR_FILE_NOT_FOUND`.
- **Rely on bundler content-hashes:**
  Use Vite/Webpack content hashing (`index-[hash].js`) and HTML cache-control meta tags (`no-cache, no-store, must-revalidate`) for cache busting.
- **Auto-rebuild on source changes:**
  Desktop launchers should compare source file `mtime` against `dist/index.html` to automatically run the production build if files were edited.

## 3. Real-Time Console Traceability
- In desktop webview bridges (e.g. `pywebview`), background worker threads must use explicit `print(..., flush=True)` to prevent output buffering.
- Always log:
  - **Outbound:** Model name, target/highlight ID, generation parameters (`temperature`, `thinking_budget`), and query excerpt.
  - **Inbound:** Finish reason (`STOP`, `MAX_TOKENS`), token usage breakdown (`prompt`, `candidates`, `thoughts`, `total`), response word count, and content.

## 4. WinForms & WebView2 Concurrency & Deadlock Prevention
- **Non-blocking UI Thread Invocations**:
  In WinForms bridges, never call synchronous `form.Invoke(...)` from Python background threads. `form.Invoke` blocks the calling thread waiting for the message loop. When pywebview is simultaneously evaluating JavaScript (`window.evaluate_js` acquiring synchronization semaphores), calling `form.Invoke` deadlocks the UI pump. Always use non-blocking `form.BeginInvoke(System.Action(...))` or direct Win32 calls.
- **Single-Flight Startup & Re-entrancy Locks**:
  Never register redundant `window.addEventListener('pywebviewready')` handlers inside React components if an IPC service already awaits or polls `waitForBridge()`. Doing so triggers duplicate concurrent initialization pipelines. Always guard initial data loading with re-entrancy refs (`isInitializingRef`, `isLoadedRef`).
- **Per-Call IPC Safety Timeouts**:
  Wrap all bridge method calls in JavaScript with a `Promise.race` safety timeout (e.g. 10s) with graceful fallbacks. No IPC bridge call should ever hang an `await` indefinitely.
- **No Background Timers During Window Creation**:
  Never spawn uncoordinated background timers (`threading.Timer`) to manipulate window properties or opacity while Microsoft CoreWebView2 is initializing COM controllers and navigating. Apply initial styles after the DOM and session state are ready.

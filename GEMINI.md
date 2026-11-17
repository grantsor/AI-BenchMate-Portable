# AI BenchMate (Portable Zero-Server Edition) — Antigravity Context

This standalone edition is part of **AI BenchMate** (`https://github.com/grantsor/AI-BenchMate-Portable`), mirrored from the `portable/` directory of `https://github.com/grantsor/AI-BenchMate`.

## Key Files
- `index.html` — Entry point (double-click `file://` ready)
- `css/styles.css` — Light default + Dark/System themes, Pause Animations / Stealth Mode, hover tooltips, lifecycle & model-discovery banners
- `js/benchmate-data.js` — 4 Hardware/OS profiles (`$env:USERPROFILE\.lmstudio\models` default on Windows), `QUICK_MODELS` (`Qwen3.8-27B` & `Qwen3.6-35B-A3B`), `PARITY_DEFAULTS`, `HELP_TOOLTIPS`
- `js/benchmate-engine.js` — Smart path & Explorer quote cleaner, LM Studio `\models\` recursive scanner (`scanModelFolderEntries`) & single-file resolver (`resolvePickedModelFile`), dynamic naming engine, action-first setup cards (`setup_llamacpp`, `setup_env`, `setup_models`, `setup_verify`), server lifecycle analyzer (`getServerLifecycleInfo`), guardrails, folder auditor, result parsers, `localStorage` + `IndexedDB` persistence
- `js/benchmate-ui.js` — Interactive 3-tab controller (`1. Setup & Pre-flight`, `2. Benchmarks`, `3. Results & Audit`), floating hover tooltip manager, model discovery status banners, drag-and-drop auditing
- `launch-local.bat` / `launch-local.sh` — Optional 1-click Python static server (`http://127.0.0.1:8765/`) unlocking `window.showDirectoryPicker()`

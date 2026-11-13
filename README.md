# AI Benchmate — Portable Zero-Server Edition

> Ultra-lightweight, zero-dependency static web edition of **AI Benchmate** designed to stay open on any Windows or Linux test rig while LLM benchmarks run (~25–40 MB RAM, 0.0% idle CPU, zero `node_modules`).

- **Portable Standalone Repo:** `https://github.com/grantsor/AI-BenchMate-Portable`
- **Full React + Vite + Portable Repo:** `https://github.com/grantsor/AI-BenchMate`

## How to Run

### Method 1: Instant Double-Click (`file://`, Zero Server Overhead)
1. Double-click `index.html`.
2. Everything works immediately—including **Folder Auditing** via `Select Folder (file:// Safe)` or folder Drag-and-Drop, all 6 Benchmark Suites, Dark/Light Themes, Benchmark Stealth Mode (`Pause Animations`), and automatic `localStorage` + `IndexedDB` persistence.

### Method 2: Optional 1-Click Local Static Server (Unlocks `window.showDirectoryPicker()`)
- **Windows:** Double-click `launch-local.bat`
- **Linux / macOS:** Run `bash launch-local.sh`
- Opens `http://127.0.0.1:8765/` using Python's built-in static server.

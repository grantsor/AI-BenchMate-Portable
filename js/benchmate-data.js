/* ==========================================================================
   AI Benchmate — Data Definitions, Profiles, Parity Defaults & Sample Dataset
   Works identically via file:// (<script defer>) and HTTP static server
   ========================================================================== */
(function (global) {
  "use strict";

  const HARDWARE_PROFILES = {
    dgx_spark_linux_arm64: {
      id: "dgx_spark_linux_arm64",
      shortName: "DGX Spark ARM64",
      name: "NVIDIA DGX Spark — Linux ARM64",
      arch: "aarch64 · Grace Blackwell CUDA",
      os: "linux",
      shell: "bash",
      defaultVramGb: 128,
      vramChips: [64, 96, 128],
      defaultBinDir: "$HOME/llama.cpp/build/bin",
      defaultRepoDir: "$HOME/llama.cpp",
      defaultBenchRoot: "$HOME/benchmarks",
      defaultResultsDir: "$HOME/benchmarks/dgx_spark",
      defaultModelsDir: "$HOME/models",
      llamaBenchBin: "llama-bench",
      llamaServerBin: "llama-server",
      backendLabel: "CUDA (Grace Blackwell)",
      deviceFlag: "",
      defaultFa: "1",
      supportsMultiGpu: false
    },
    rtx_spark_win_arm64: {
      id: "rtx_spark_win_arm64",
      shortName: "RTX Spark Win-ARM64",
      name: "NVIDIA RTX Spark — Windows ARM64",
      arch: "ARM64 · NVIDIA CUDA",
      os: "windows",
      shell: "powershell",
      defaultVramGb: 128,
      vramChips: [16, 24, 32, 48, 96, 128],
      defaultBinDir: "C:\\llama.cpp\\cuda",
      defaultRepoDir: "$HOME\\llama.cpp",
      defaultBenchRoot: "$HOME\\benchmarks",
      defaultResultsDir: "$HOME\\benchmarks\\rtx_spark",
      defaultModelsDir: "$HOME\\.lmstudio\\models",
      llamaBenchBin: ".\\llama-bench.exe",
      llamaServerBin: ".\\llama-server.exe",
      backendLabel: "CUDA (Windows ARM64)",
      deviceFlag: "CUDA0",
      defaultFa: "1",
      supportsMultiGpu: true
    },
    nvidia_win_x64: {
      id: "nvidia_win_x64",
      shortName: "NVIDIA Win x64",
      name: "NVIDIA GPU (RTX 5090 / CUDA) — Windows x64",
      arch: "x86_64 · NVIDIA CUDA",
      os: "windows",
      shell: "powershell",
      defaultVramGb: 32,
      vramChips: [16, 24, 32, 48, 96],
      defaultBinDir: "C:\\llama.cpp\\cuda",
      defaultRepoDir: "$HOME\\llama.cpp",
      defaultBenchRoot: "$HOME\\benchmarks",
      defaultResultsDir: "$HOME\\benchmarks\\nvidia_x64",
      defaultModelsDir: "$HOME\\.lmstudio\\models",
      llamaBenchBin: ".\\llama-bench.exe",
      llamaServerBin: ".\\llama-server.exe",
      backendLabel: "CUDA (Windows x64)",
      deviceFlag: "CUDA0",
      defaultFa: "1",
      supportsMultiGpu: true
    },
    amd_win_x64: {
      id: "amd_win_x64",
      shortName: "AMD R9700 Win x64",
      name: "AMD GPU (Radeon AI Pro R9700) — Windows x64",
      arch: "x86_64 · Vulkan / ROCm HIP",
      os: "windows",
      shell: "powershell",
      defaultVramGb: 32,
      vramChips: [16, 24, 32, 48, 64],
      defaultBinDir: "C:\\llama.cpp\\vulkan",
      defaultRepoDir: "$HOME\\llama.cpp",
      defaultBenchRoot: "$HOME\\benchmarks",
      defaultResultsDir: "$HOME\\benchmarks\\radeon_r9700",
      defaultModelsDir: "$HOME\\.lmstudio\\models",
      llamaBenchBin: ".\\llama-bench.exe",
      llamaServerBin: ".\\llama-server.exe",
      backendLabel: "Vulkan / ROCm HIP",
      deviceFlag: "Vulkan0",
      defaultFa: "1",
      supportsMultiGpu: false
    }
  };

  const QUICK_MODELS = [
    {
      id: "qwen38_27b",
      label: "Qwen3.8-27B",
      tag: "Dense 27B",
      quant: "UD-Q4_K_M",
      kind: "hybrid",
      relativeWin: "unsloth\\Qwen3.8-27B-GGUF\\Qwen3.8-27B-UD-Q4_K_M.gguf",
      relativeLinux: "Qwen3.8-27B-UD-Q4_K_M.gguf",
      alias: "Qwen3.8-27B",
      slug: "qwen38",
      tokenizer: "Qwen/Qwen3.8-27B",
      weightGb: 15.8,
      paramsB: 27,
      archType: "dense"
    },
    {
      id: "qwen36_35b_moe",
      label: "Qwen3.6-35B-A3B",
      tag: "MoE 35B-A3B",
      quant: "UD-Q4_K_M",
      kind: "moe+hybrid",
      relativeWin: "unsloth\\Qwen3.6-35B-A3B-GGUF\\Qwen3.6-35B-A3B-UD-Q4_K_M.gguf",
      relativeLinux: "Qwen3.6-35B-A3B-UD-Q4_K_M.gguf",
      alias: "Qwen3.6-35B-A3B",
      slug: "qwen36",
      tokenizer: "Qwen/Qwen3.6-35B-A3B",
      weightGb: 21.0,
      paramsB: 35,
      archType: "moe"
    }
  ];

  // Locked Baseline Parity Defaults from AI Benchmate Prompt.md & Reference Guide
  const PARITY_DEFAULTS = {
    llama_bench: {
      ngl: 99,
      fa: "1",
      p: "512,2048",
      n: "128,512",
      r: 3,
      b: 2048,
      ub: 512,
      format: "md"
    },
    llama_benchy: {
      c: 32768,
      np: 1,
      ctk: "fp16",
      ctv: "fp16",
      fa: "1",
      pp: "512 2048",
      tg: "128 512",
      depth: "0 4096",
      runs: 3,
      format: "md"
    },
    llmperf: {
      c: 32768,
      np: 1,
      ctk: "fp16",
      ctv: "fp16",
      fa: "1",
      meanInput: 1024,
      stddevInput: 128,
      meanOutput: 256,
      stddevOutput: 32,
      concurrency: 4,
      maxCompleted: 20
    },
    speed_bench: {
      contextPreset: "32768", // 16384 | 32768 | 65536 | custom
      c: 32768,
      np: 1,
      ctk: "fp16",
      ctv: "fp16",
      fa: "on",
      jinja: true,
      bench: "qualitative",
      category: "all",
      osl: 1024,
      concurrency: 1,
      limit: 5,
      extraInputs: "{}",
      compareBaselineFile: "speedbench_qwen38.json",
      compareSpeculativeFile: "speedbench_qwen36.json"
    },
    agentperf: {
      c: 32768,
      np: 1,
      ctk: "fp16",
      ctv: "fp16",
      fa: "1",
      extraFlags: ""
    },
    aiperf_std: {
      c: 32768,
      np: 1,
      ctk: "fp16",
      ctv: "fp16",
      fa: "1",
      concurrency: 4,
      requestCount: 20,
      islMean: 1024,
      oslMean: 256,
      ignoreEos: true
    },
    aiperf_sweep: {
      c: 70000,
      np: 1,
      ctk: "q8_0",
      ctv: "q8_0",
      fa: "1",
      islList: "16384,32768,65536",
      oslList: "1024,1024,1024",
      islStddev: 0,
      oslStddev: 0,
      concurrency: 1,
      warmupCount: 1,
      requestCount: 3,
      randomSeed: 42,
      ignoreEos: true,
      cachePrompt: false,
      uiMode: "simple"
    }
  };

  const SUITE_METADATA = [
    {
      id: "llama_bench",
      shortLabel: "llama-bench",
      index: "01",
      title: "Native C++ llama-bench",
      category: "NATIVE C++",
      badgeClass: "badge-cyan",
      duration: "~2–4 min",
      hasServer: false,
      description: "Direct .gguf inference throughput (raw compute pp & memory-bandwidth tg) without HTTP overhead."
    },
    {
      id: "llama_benchy",
      shortLabel: "llama-benchy",
      index: "02",
      title: "llama-benchy HTTP & Depth Sweep",
      category: "HTTP DEPTH",
      badgeClass: "badge-cyan",
      duration: "~5–9 min",
      hasServer: true,
      description: "Measures HTTP server API latency and KV cache depth drag (--depth 0 4096) with Gutenberg cache cleanup."
    },
    {
      id: "llmperf",
      shortLabel: "llmperf",
      index: "03",
      title: "llmperf Ray Concurrency",
      category: "CONCURRENCY",
      badgeClass: "badge-amber",
      duration: "~4–8 min",
      hasServer: true,
      description: "Multi-stream parallel load test reporting TTFT, ITL, E2E latency, and request throughput via Ray."
    },
    {
      id: "speed_bench",
      shortLabel: "speed-bench",
      index: "04",
      title: "SPEED-Bench Workload & Comparator",
      category: "QUALITATIVE",
      badgeClass: "badge-amber",
      duration: "~8–15 min",
      hasServer: true,
      description: "Multi-category qualitative tasks (--jinja) plus speed_bench_compare.py Dense vs MoE comparison."
    },
    {
      id: "agentperf",
      shortLabel: "agentperf",
      index: "05",
      title: "AA-AgentPerf-Local",
      category: "AGENTIC",
      badgeClass: "badge-emerald",
      duration: "~6–12 min",
      hasServer: true,
      description: "Isolated .venv-agentperf multi-turn agentic workflow replay measuring realistic tool-loop latency."
    },
    {
      id: "aiperf_std",
      shortLabel: "aiperf",
      index: "06A",
      title: "AIPerf Standard Concurrency",
      category: "CONCURRENCY",
      badgeClass: "badge-cyan",
      duration: "~4–7 min",
      hasServer: true,
      description: "4-stream concurrent OpenAI chat profile (1024 in / 256 out, 20 requests, ignore_eos:true)."
    },
    {
      id: "aiperf_sweep",
      shortLabel: "aiperf-64k",
      index: "06B",
      title: "AIPerf 64k Long-Context Zip Sweep",
      category: "LONG-CONTEXT SWEEP",
      badgeClass: "badge-crimson",
      duration: "~15–30 min",
      hasServer: true,
      description: "NVIDIA Reviewer's Guide 16k/32k/64k zip sweep with cache_prompt:false & 70k q8_0 KV safeguard."
    }
  ];

  // Reference parity guide table (from DGX Spark vs Radeon AI Pro 9700.md)
  const REFERENCE_PARITY_GUIDE = [
    { suite: "Native C++ llama-bench (Qwen 3.8)", r9700: "Completed", dgx: "Completed", purpose: "Raw compute (pp) & memory bandwidth (tg)" },
    { suite: "Native C++ llama-bench (Qwen 3.6)", r9700: "Completed", dgx: "Completed", purpose: "MoE sparse routing raw throughput" },
    { suite: "llama-benchy HTTP (Qwen 3.8)", r9700: "Completed", dgx: "Completed", purpose: "HTTP API overhead & --depth 0 4096 KV drag" },
    { suite: "llama-benchy HTTP (Qwen 3.6)", r9700: "Completed", dgx: "Completed", purpose: "HTTP API depth scaling on MoE" },
    { suite: "llmperf Concurrency (Qwen 3.8)", r9700: "Completed", dgx: "Configured", purpose: "4-stream parallel load, TTFT, ITL & QPS" },
    { suite: "llmperf Concurrency (Qwen 3.6)", r9700: "Completed", dgx: "Completed", purpose: "4-stream parallel load on MoE" },
    { suite: "SPEED-Bench Multi-Category", r9700: "Completed", dgx: "Completed (16k & 64k)", purpose: "Qualitative tasks (--category all --osl 1024 --limit 5)" },
    { suite: "AA-AgentPerf-Local", r9700: "Completed", dgx: "Pending", purpose: "Multi-turn agentic replay latency" },
    { suite: "AIPerf Standard Concurrency", r9700: "Completed", dgx: "Pending", purpose: "4 concurrent streams, 20 requests (1024 in / 256 out)" },
    { suite: "AIPerf Reviewer 64k Sweep", r9700: "Completed", dgx: "Pending", purpose: "Long-context sweep (16k, 32k, 64k) cache_prompt:false" }
  ];

  // Sample dataset (clearly labeled in UI as [SAMPLE DATA] for instant visual preview)
  const SAMPLE_RESULTS_DATASET = [
    {
      id: "sample-dgx-qwen38-bench",
      isSample: true,
      sourceFile: "[SAMPLE] llama_bench_qwen38_dgx_spark.md",
      gpuLabel: "DGX Spark (CUDA)",
      modelLabel: "Qwen3.8-27B (Dense)",
      suiteType: "llama_bench",
      metrics: { pp512: 1945.2, pp2048: 1862.8, tg128: 22.4, tg512: 21.8 }
    },
    {
      id: "sample-r9700-qwen38-bench",
      isSample: true,
      sourceFile: "[SAMPLE] llama_bench_qwen38_r9700_vulkan.md",
      gpuLabel: "Radeon AI Pro R9700 (Vulkan)",
      modelLabel: "Qwen3.8-27B (Dense)",
      suiteType: "llama_bench",
      metrics: { pp512: 1320.5, pp2048: 1245.0, tg128: 41.2, tg512: 39.8 }
    },
    {
      id: "sample-dgx-qwen36-bench",
      isSample: true,
      sourceFile: "[SAMPLE] llama_bench_qwen36_dgx_spark.md",
      gpuLabel: "DGX Spark (CUDA)",
      modelLabel: "Qwen3.6-35B-A3B (MoE)",
      suiteType: "llama_bench",
      metrics: { pp512: 2410.0, pp2048: 2295.4, tg128: 68.5, tg512: 65.2 }
    },
    {
      id: "sample-r9700-qwen36-bench",
      isSample: true,
      sourceFile: "[SAMPLE] llama_bench_qwen36_r9700_vulkan.md",
      gpuLabel: "Radeon AI Pro R9700 (Vulkan)",
      modelLabel: "Qwen3.6-35B-A3B (MoE)",
      suiteType: "llama_bench",
      metrics: { pp512: 1680.3, pp2048: 1590.1, tg128: 98.4, tg512: 94.1 }
    },
    {
      id: "sample-dgx-qwen38-benchy",
      isSample: true,
      sourceFile: "[SAMPLE] llama_benchy_qwen38_dgx_spark.md",
      gpuLabel: "DGX Spark (CUDA)",
      modelLabel: "Qwen3.8-27B (Dense)",
      suiteType: "llama_benchy",
      metrics: { depth0Tg: 21.9, depth4096Tg: 19.6, degradationPct: 10.5 }
    },
    {
      id: "sample-r9700-qwen38-benchy",
      isSample: true,
      sourceFile: "[SAMPLE] llama_benchy_qwen38_r9700_vulkan.md",
      gpuLabel: "Radeon AI Pro R9700 (Vulkan)",
      modelLabel: "Qwen3.8-27B (Dense)",
      suiteType: "llama_benchy",
      metrics: { depth0Tg: 39.4, depth4096Tg: 32.7, degradationPct: 17.0 }
    },
    {
      id: "sample-dgx-qwen38-llmperf",
      isSample: true,
      sourceFile: "[SAMPLE] llmperf_qwen38_dgx_spark/summary.json",
      gpuLabel: "DGX Spark (CUDA)",
      modelLabel: "Qwen3.8-27B (Dense)",
      suiteType: "llmperf",
      metrics: { ttftMs: 740, itlMs: 56.2, reqPerMin: 12.4, totalTps: 52.8 }
    },
    {
      id: "sample-r9700-qwen38-llmperf",
      isSample: true,
      sourceFile: "[SAMPLE] llmperf_qwen38_r9700/summary.json",
      gpuLabel: "Radeon AI Pro R9700 (Vulkan)",
      modelLabel: "Qwen3.8-27B (Dense)",
      suiteType: "llmperf",
      metrics: { ttftMs: 1120, itlMs: 38.4, reqPerMin: 14.9, totalTps: 63.5 }
    },
    {
      id: "sample-dgx-speedbench",
      isSample: true,
      sourceFile: "[SAMPLE] speedbench_qwen38_dgx_spark.json",
      gpuLabel: "DGX Spark (CUDA)",
      modelLabel: "Qwen3.8-27B (Dense)",
      suiteType: "speed_bench",
      metrics: { coding: 21.8, reasoning: 20.9, writing: 22.1, math: 21.3, overall: 21.5 }
    },
    {
      id: "sample-r9700-speedbench",
      isSample: true,
      sourceFile: "[SAMPLE] speedbench_qwen38_r9700.json",
      gpuLabel: "Radeon AI Pro R9700 (Vulkan)",
      modelLabel: "Qwen3.8-27B (Dense)",
      suiteType: "speed_bench",
      metrics: { coding: 38.2, reasoning: 36.4, writing: 39.5, math: 37.1, overall: 37.8 }
    },
    {
      id: "sample-dgx-aiperf64k",
      isSample: true,
      sourceFile: "[SAMPLE] aiperf_qwen38_dgx_sweep/profile_export_aiperf.json",
      gpuLabel: "DGX Spark (CUDA)",
      modelLabel: "Qwen3.8-27B (Dense)",
      suiteType: "aiperf_sweep",
      metrics: { ttft16k: 8900, ttft32k: 18400, ttft64k: 39200, tps16k: 20.2, tps32k: 18.4, tps64k: 15.1 }
    },
    {
      id: "sample-r9700-aiperf64k",
      isSample: true,
      sourceFile: "[SAMPLE] aiperf_qwen38_r9700_nv64k/profile_export_aiperf.json",
      gpuLabel: "Radeon AI Pro R9700 (Vulkan)",
      modelLabel: "Qwen3.8-27B (Dense)",
      suiteType: "aiperf_sweep",
      metrics: { ttft16k: 13200, ttft32k: 27900, ttft64k: 61800, tps16k: 34.5, tps32k: 28.9, tps64k: 21.4 }
    }
  ];

  const HELP_TOOLTIPS = {
    chk_rtxArmTdigestCompile: {
      title: "Compile aiperf[tdigest] (crick C Extension)",
      desc: "Controls whether pip requests the optional crick C extension (aiperf[tdigest]) for T-Digest percentile estimation. Note: Setup Card 03 installs x64 Python 3.12 on Windows ARM64 by default so pre-built wheels work under Prism emulation.",
      rec: "Default / Recommended: OFF (Unticked). Tick ON only if you have Visual Studio C++ Build Tools installed or are using x64 Python 3.12 with pre-built wheels."
    },
    chk_nonSudoSetup: {
      title: "Non-Sudo Setup Mode (Linux ARM64)",
      desc: "Skips 'sudo apt install python3-dev build-essential' and installs base 'aiperf' without compiling the crick C extension, avoiding sudo password prompts and missing Python.h errors.",
      rec: "Default / Recommended: OFF (Unticked) if you have sudo access on DGX Spark; tick ON if running on a restricted account without sudo privileges."
    },
    chk_includeVllmInStartAi: {
      title: "Include vLLM in Post-Benchmark Restore",
      desc: "Appends the vLLM server launch command (port 8000, capped at 70% GPU memory) to the 'Restore start-ai Stack' script alongside Ollama (11434), LM Studio (1234), and ComfyUI (8189).",
      rec: "Default / Recommended: ON (Ticked) if your Hermes Agent uses a vLLM Safetensors/NVFP4 model; untick OFF if you only use GGUF models in Ollama/LM Studio."
    },
    chk_amdEnableFa: {
      title: "Enable Flash Attention (-fa 1) on AMD Vulkan",
      desc: "Adds '-fa 1' ('-fa on' for SPEED-Bench) to llama-bench.exe and llama-server.exe when using the AMD Vulkan backend. Some RDNA3/RDNA4 Vulkan driver builds experience shader compilation overhead or instability with Flash Attention.",
      rec: "Default / Recommended: OFF (Unticked) for baseline Radeon AI Pro R9700 Vulkan parity runs; tick ON only to test Vulkan Flash Attention specifically."
    },
    chk_jinja: {
      title: "--jinja (Server Jinja2 Chat Template Engine)",
      desc: "Enables llama-server's built-in Jinja2 chat template processor, required by speed_bench.py for multi-turn coding, reasoning, and tool-use prompt formatting.",
      rec: "Default / Recommended: ON (Enabled). Always keep enabled for SPEED-Bench runs."
    },
    chk_ignoreEos: {
      title: "ignore_eos:true (Force Exact Output Token Length)",
      desc: "Instructs llama-server to ignore the model's End-of-Sequence (<|im_end|>) stop token and continue generating until the exact target Output Sequence Length (OSL) is reached.",
      rec: "Default / Recommended: ON (Enabled). Essential for benchmarking so short answers do not terminate early and skew decode throughput."
    },
    chk_cachePrompt: {
      title: "cache_prompt (Server KV Prefix Caching)",
      desc: "Controls whether llama-server reuses cached KV states from matching prompt prefixes across consecutive requests (cache_prompt:true vs cache_prompt:false).",
      rec: "Default / Recommended: OFF (Disabled -> cache_prompt:false). Must stay OFF for the 64k sweep so every 16k/32k/64k pass computes real prefill TTFT."
    },
    chk_playbookMissingOnly: {
      title: "Missing / Incomplete Runs Only Filter",
      desc: "Excludes any benchmark suite already marked VERIFIED COMPLETE in the Results Folder Auditor when copying or downloading the all-in-one playbook script.",
      rec: "Default / Recommended: OFF for a full fresh benchmark run; tick ON when resuming an interrupted session to run only remaining suites."
    },

    suite_llama_bench: {
      title: "01 · Native C++ llama-bench",
      desc: "Direct C++ .gguf execution without an HTTP server. Measures raw GPU compute prefill speed (pp512, pp2048) and memory-bandwidth token generation speed (tg128, tg512).",
      rec: "Default: -ngl 99 -fa 1 -p 512,2048 -n 128,512 -r 3 -o md (~2-4 min)."
    },
    suite_llama_benchy: {
      title: "02 · llama-benchy HTTP & Depth Sweep",
      desc: "Measures OpenAI HTTP API overhead and quantifies KV cache depth drag between depth 0 and depth 4096. Automatically clears ~/.cache/llama-benchy to prevent ZeroDivisionError.",
      rec: "Default: Server -c 32768 -np 1 | Client --pp 512 2048 --tg 128 512 --depth 0 4096 --runs 3 (~5-9 min)."
    },
    suite_llmperf: {
      title: "03 · llmperf Ray Multi-Stream Concurrency",
      desc: "Fires 4 parallel streaming requests via Ray workers (token_benchmark_ray.py) to benchmark multi-stream TTFT, Inter-Token Latency (ITL), and total token throughput.",
      rec: "Default: Server -c 32768 | Client 1024 in / 256 out, 4 concurrent requests, 20 total completed requests (~4-8 min)."
    },
    suite_speed_bench: {
      title: "04 · SPEED-Bench Workload & Comparator",
      desc: "Runs llama.cpp's official speed_bench.py qualitative suite across coding, math, reasoning, writing, and RAG categories, plus speed_bench_compare.py for Dense vs MoE or Standard vs 64K comparison.",
      rec: "Default: Server -c 32768 -fa on --jinja | Client --category all --osl 1024 --limit 5 (~8-15 min)."
    },
    suite_agentperf: {
      title: "05 · AA-AgentPerf-Local",
      desc: "Runs inside isolated .venv-agentperf to replay multi-turn agentic coding and tool-use trajectories against llama-server.",
      rec: "Default: Server -c 32768 -np 1 | Client agentperf-local run (~6-12 min)."
    },
    suite_aiperf_std: {
      title: "06A · AIPerf Standard Concurrency",
      desc: "NVIDIA AIPerf 4-stream concurrent OpenAI chat profile measuring streaming TTFT, ITL, and output throughput with ignore_eos:true and cache_prompt:false.",
      rec: "Default: Server -c 32768 | Client --concurrency 4 --request-count 20, 1024 in / 256 out (~4-7 min)."
    },
    suite_aiperf_sweep: {
      title: "06B · AIPerf 64k Long-Context Zip Sweep",
      desc: "NVIDIA Reviewer's Guide long-context stress test sweeping 16k, 32k, and 64k input sequence lengths (--sweep-type zip --ui simple) with cache_prompt:false.",
      rec: "Default: Server -c 70000 -ctk q8_0 -ctv q8_0 (prevents 65588 > 65536 overflow & 32 GB VRAM OOM) | Client --isl 16384,32768,65536 --osl 1024,1024,1024 (~15-30 min)."
    },

    setup_llamacpp: {
      title: "01 · Install & Verify Git, VC++ Runtime, llama.cpp Binaries & SPEED-Bench",
      desc: "Automatically installs Git and Microsoft VC++ Redistributable via winget if missing, clones https://github.com/ggml-org/llama.cpp (for speed_bench.py), and automatically downloads & extracts official pre-built llama-bench.exe, llama-server.exe, and CUDA/Vulkan/ROCm runtime DLLs from GitHub Releases (or compiles CUDA binaries on DGX Spark).",
      rec: "Recommended: Run FIRST on any new machine. Automatically installs and extracts everything needed for Step 01 with zero manual downloads."
    },
    setup_env: {
      title: "02 · Install & Verify Python 3.12, Venvs & Benchmark Suites",
      desc: "Automatically installs Python 3.12 via winget if missing, creates isolated .venv-aiperf and .venv-agentperf virtual environments, clones & patches llmperf (<3.11 constraint removed), and installs llama-benchy, aiperf (with automatic fallback if C++ build tools are absent), and aa-agentperf-local.",
      rec: "Recommended: Run SECOND on initial setup so all Python benchmark clients and virtual environments are ready."
    },
    setup_models: {
      title: "03 · Download & Verify Benchmark GGUF Models",
      desc: "Checks if Qwen3.8-27B-UD-Q4_K_M.gguf (~15.8 GB) and Qwen3.6-35B-A3B-UD-Q4_K_M.gguf (~21.0 GB) exist on disk and automatically downloads any missing model via huggingface_hub (hf_hub_download) or resumable curl/wget fallback.",
      rec: "Recommended: Run THIRD to ensure both parity GGUF models are downloaded and verified in your Models directory."
    },
    setup_verify: {
      title: "04 · Complete Pre-Flight Verification & Self-Healing Check",
      desc: "Verifies GPU driver (nvidia-smi / amd-smi), Git, llama-bench & llama-server binaries, speed_bench.py, active .gguf model files, Python 3.12 venv packages (llama_benchy, aiperf, ray, agentperf-local), clears the llama-benchy Gutenberg cache, and checks port 8080—automatically fixing missing tools on the spot.",
      rec: "Recommended: Run FOURTH after Cards 01–03 (or before any benchmark session) to confirm 100% readiness."
    },
    setup_cleanup: {
      title: "05 · Free VRAM & Stop Running AI Servers",
      desc: "Terminates running llama-server processes (plus Ollama, LM Studio, ComfyUI, and vLLM on DGX Spark) and releases TCP port 8080 so 100% of GPU VRAM is available for benchmarking.",
      rec: "Recommended: Run before starting benchmarks if other AI apps were open."
    },
    setup_fixes: {
      title: "06 · Clear llama-benchy Gutenberg Cache",
      desc: "Deletes cached Project Gutenberg text in ~/.cache/llama-benchy that can cause a Python ZeroDivisionError if a prior download was truncated.",
      rec: "Recommended: Run if llama-benchy throws ZeroDivisionError (also included automatically in Suite 02)."
    },
    setup_hermes_dgx: {
      title: "07 · DGX Spark /models Symlink, Ollama Override & stop-ai",
      desc: "Safely migrates and symlinks ~/.lmstudio/models to $HOME/models, creates ~/.lmstudio/.internal/temp (fixing mkdtemp Jinja errors), configures Ollama systemd override, and installs the sudo-free stop-ai command.",
      rec: "Recommended: Run once when configuring DGX Spark as a shared central model server."
    },
    ssh_psTrigger: {
      title: "Remote SSH Trigger (Windows PowerShell -> DGX Spark)",
      desc: "Connects from Windows PowerShell to the remote DGX Spark over SSH and attaches to (or creates) a persistent tmux session so benchmarks continue running even if Wi-Fi drops.",
      rec: "Recommended when controlling DGX Spark remotely from a Windows PC."
    },
    ssh_tmuxLaunch: {
      title: "tmux Split Benchmark Session (DGX Spark)",
      desc: "Creates a 2-pane split terminal inside tmux on DGX Spark: Left pane for Terminal 1 (llama-server) and Right pane for Terminal 2 (client benchmarks).",
      rec: "Recommended for single-window SSH benchmarking."
    },
    ssh_scpPull: {
      title: "scp Pull Remote Results (DGX Spark -> Local PC)",
      desc: "Copies all completed .md and .json benchmark results from the DGX Spark results folder into your local Windows PC folder for auditing and comparison.",
      rec: "Run after completing remote DGX Spark benchmarks."
    },
    ssh_startAiRestore: {
      title: "Restore start-ai Stack (DGX Spark Post-Benchmark)",
      desc: "Restarts Ollama (11434), LM Studio (1234), ComfyUI (8189), and optionally vLLM (8000) in background tmux sessions after benchmarking finishes.",
      rec: "Run on DGX Spark after all benchmarks are done to bring Hermes Agent backends back online."
    },

    sec_setup: {
      title: "Pre-flight Verification & Environment Setup",
      desc: "Step-by-step verification and one-time installation scripts tailored to your active Hardware/OS profile. Ensures GPU drivers, llama.cpp binaries, .gguf models, and Python 3.12 venvs are ready before benchmarking.",
      rec: "Start with Card 01 (Pre-flight Check), then run Cards 02-04 for any items marked [MISSING]."
    },
    sec_audit: {
      title: "Results Folder Audit (Anti-1KB Stub Inspector)",
      desc: "Scans your benchmark results directory to verify that all 7 suites produced complete, non-empty metric files (>1 KB with valid rows/JSON) and extracts exact errors from logs/aiperf.log if a run failed.",
      rec: "Click 'Select Folder' and choose your Results Dir (shown to the right) after running benchmarks."
    },
    sec_compare: {
      title: "Parsed Results Comparison Matrix",
      desc: "Parses .md and .json benchmark output files across GPUs (DGX Spark, RTX Spark, RTX 5090, Radeon AI Pro R9700) and models (Qwen 3.8 Dense vs Qwen 3.6 MoE) into a unified table with charts and .md/.csv exports.",
      rec: "Automatically populated when you audit a folder above, or upload additional .md/.json files from other GPUs to compare."
    },
    sec_playbook: {
      title: "All-in-One Benchmark Playbook",
      desc: "Combines all server and client commands for the active hardware profile and model into a single copyable or downloadable script (.ps1 on Windows, .sh on Linux).",
      rec: "Use 'Missing / Incomplete Runs Only' to generate a script containing only unaudited or failed suites."
    },

    hw_profile: {
      title: "Hardware & OS Platform Profile",
      desc: "Adapts all terminal syntax (PowerShell vs bash), path separators (\\ vs /), binary extensions (.exe), GPU device flags (--device CUDA0 / Vulkan0 / HIP0), and Python venv commands.",
      rec: "Default: Select the exact hardware and OS you are benchmarking."
    },
    hw_amdBackend: {
      title: "AMD Compute Backend (Vulkan vs ROCm HIP)",
      desc: "Switches AMD GPU commands between Vulkan (--device Vulkan0) and ROCm (--device HIP0 -fa 1).",
      rec: "Default / Recommended: Vulkan (used for baseline Radeon AI Pro R9700 parity benchmarks)."
    },
    hw_vramGb: {
      title: "Hardware VRAM / Unified Memory Capacity (GB)",
      desc: "Total GPU memory ceiling used by the Guardrails VRAM Estimator (Model Weights + KV Cache + 1.5 GB Compute Buffer) to warn before Out-Of-Memory crashes.",
      rec: "Default: 128 GB (DGX Spark / RTX Spark) or 32 GB (Radeon AI Pro R9700 / RTX 5090)."
    },
    hw_binDir: {
      title: "Llama Bin Dir (Compiled Binaries Folder)",
      desc: "Directory containing llama-bench(.exe) and llama-server(.exe).",
      rec: "Default: $HOME/llama.cpp/build/bin (DGX Linux), C:\\llama.cpp\\cuda (Win NVIDIA), C:\\llama.cpp\\vulkan (Win AMD)."
    },
    hw_repoDir: {
      title: "Repo Dir (Cloned llama.cpp Git Repository)",
      desc: "Root directory of the cloned llama.cpp repository containing tools/server/bench/speed-bench/speed_bench.py and speed_bench_compare.py.",
      rec: "Default: $HOME/llama.cpp (Linux) or $HOME\\llama.cpp (Windows)."
    },
    hw_benchRoot: {
      title: "Bench Root (Python Venvs & llmperf Folder)",
      desc: "Base directory where .venv-aiperf, .venv-agentperf, and the cloned llmperf repository live.",
      rec: "Default: $HOME/benchmarks (Linux) or $HOME\\benchmarks (Windows)."
    },
    hw_resultsDir: {
      title: "Results Dir (Default Benchmark Output Folder)",
      desc: "Centralized directory where all benchmark .md tables, .json metrics, and AIPerf/llmperf/AgentPerf output folders are saved. Select this folder in '3. Results & Audit' to verify runs.",
      rec: "Default: $HOME/benchmarks/dgx_spark, $HOME\\benchmarks\\rtx_spark, $HOME\\benchmarks\\nvidia_x64, or $HOME\\benchmarks\\radeon_r9700."
    },
    model_fullPath: {
      title: "Active Model (.gguf File Path)",
      desc: "Full path to the .gguf model file passed to '-m'. Pasting any .gguf path automatically extracts the Model Alias, Output Slug, Hugging Face Tokenizer ID, and estimated weight size.",
      rec: "Default: Qwen3.8-27B-UD-Q4_K_M.gguf (Dense) or Qwen3.6-35B-A3B-UD-Q4_K_M.gguf (MoE)."
    },
    model_alias: {
      title: "Served Model Alias (--alias)",
      desc: "Clean model identifier passed to llama-server '--alias' and requested by HTTP benchmark clients.",
      rec: "Default: Auto-extracted from filename (e.g. Qwen3.8-27B or Qwen3.6-35B-A3B)."
    },
    model_slug: {
      title: "Output Filename Slug",
      desc: "Short tag embedded into generated result filenames and folders (e.g. 'qwen38' -> llama_bench_qwen38.md).",
      rec: "Default: qwen38 or qwen36."
    },
    model_tokenizer: {
      title: "Hugging Face Tokenizer ID (--tokenizer)",
      desc: "Hugging Face repository ID used by llama-benchy and AIPerf to tokenize prompts and count tokens accurately.",
      rec: "Default: Qwen/Qwen3.8-27B or Qwen/Qwen3.6-35B-A3B."
    },
    model_weightGb: {
      title: "Model Weight Size (GB)",
      desc: "Size of the .gguf model weights in GB, used by the Guardrails VRAM Estimator.",
      rec: "Default: 15.8 GB (Qwen 3.8 27B Q4_K_M) or 21.0 GB (Qwen 3.6 35B-A3B Q4_K_M)."
    },
    model_paramsB: {
      title: "Model Parameter Count (Billions)",
      desc: "Total parameter count in billions, used to estimate KV cache memory growth across context lengths.",
      rec: "Default: 27 (Qwen 3.8) or 35 (Qwen 3.6)."
    },
    hw_host: {
      title: "Server Bind Host (--host)",
      desc: "Network interface address llama-server binds to.",
      rec: "Default / Recommended: 0.0.0.0 (listens on localhost 127.0.0.1 and LAN)."
    },
    hw_port: {
      title: "Server HTTP Port (--port)",
      desc: "TCP port used by llama-server and all HTTP benchmark clients.",
      rec: "Default / Recommended: 8080."
    },
    model_clientModelMode: {
      title: "Client --model Argument Mode",
      desc: "Selects whether HTTP clients pass the short Model Alias (matching llama-server --alias) or the full .gguf file path.",
      rec: "Default / Recommended: Alias (--alias)."
    },
    naming_mode: {
      title: "Result Filename Naming Mode",
      desc: "Auto mode uses compact filenames (llama_bench_qwen38.md) on Default Settings and switches to parameter-stamped filenames (_ctx32k_kvfp16...) when parameters are customized so baseline files are never overwritten.",
      rec: "Default / Recommended: Auto (Classic on Default, Stamped on Edit)."
    },
    hw_nvidiaDevice: {
      title: "NVIDIA CUDA Device (--device)",
      desc: "Specifies which NVIDIA GPU device llama-bench and llama-server execute on.",
      rec: "Default / Recommended: CUDA0."
    },
    hw_tensorSplit: {
      title: "Multi-GPU Tensor Split (--tensor-split)",
      desc: "Comma-separated VRAM split ratios across multiple GPUs (e.g. '1,1' for two equal GPUs). Leave blank for single-GPU runs.",
      rec: "Default / Recommended: Blank (Single GPU)."
    },

    param_ngl: {
      title: "-ngl (Number of GPU Layers)",
      desc: "Number of transformer layers offloaded to GPU VRAM in llama-bench / llama-server. A value of 99 offloads all layers for 100% GPU execution.",
      rec: "Default / Recommended: 99 (Full GPU Offload)."
    },
    param_fa: {
      title: "-fa (Flash Attention)",
      desc: "Controls fused Flash Attention kernels ('1' or 'on' = enabled, '0' or 'off' = disabled, 'auto' = automatic). Accelerates long-context prefill and reduces KV memory overhead.",
      rec: "Default / Recommended: 1 ('on' for SPEED-Bench)."
    },
    param_p: {
      title: "-p (Prompt Prefill Token Lengths)",
      desc: "Comma-separated input prompt token counts tested for prefill (pp) compute throughput in llama-bench.",
      rec: "Default / Recommended: 512,2048."
    },
    param_n: {
      title: "-n (Token Generation Lengths)",
      desc: "Comma-separated output token counts tested for decode (tg) memory-bandwidth speed in llama-bench.",
      rec: "Default / Recommended: 128,512."
    },
    param_r: {
      title: "-r (Repetitions / Passes)",
      desc: "Number of benchmark repetitions averaged per test point in llama-bench.",
      rec: "Default / Recommended: 3."
    },
    param_b: {
      title: "-b (Logical Batch Size)",
      desc: "Maximum number of tokens processed per logical batch during prompt prefill in llama-bench.",
      rec: "Default / Recommended: 2048."
    },
    param_ub: {
      title: "-ub (Physical Micro-Batch Size)",
      desc: "Physical compute micro-batch size per GPU kernel launch in llama-bench.",
      rec: "Default / Recommended: 512."
    },
    param_format: {
      title: "Output Format (-o / --format)",
      desc: "Output table format saved to the results file (md = Markdown table, json, csv).",
      rec: "Default / Recommended: md (required for automatic Markdown table parsing in Results & Audit)."
    },
    param_c: {
      title: "Server -c (Total KV Context Capacity)",
      desc: "Total token context window allocated by llama-server. Must be greater than (Max Input Tokens + Depth + Max Output Tokens + ~64 chat template tokens) to avoid context overflow errors.",
      rec: "Default / Recommended: 32768 for standard suites (02-06A); 70000 for 06B AIPerf 64k Sweep."
    },
    param_np: {
      title: "Server -np (Parallel Server Decode Slots)",
      desc: "Number of concurrent decoding slots allocated in llama-server.",
      rec: "Default / Recommended: 1 (matches DGX Spark & R9700 parity baseline)."
    },
    param_ctk: {
      title: "-ctk (KV Cache Key Precision)",
      desc: "Quantization type for KV cache Key tensors (fp16 = 16-bit full precision, q8_0 = 8-bit, q4_0 = 4-bit). Using q8_0 cuts KV cache VRAM in half with negligible quality impact.",
      rec: "Default / Recommended: fp16 for 32k runs; q8_0 for 06B 64k Sweep (-c 70000) to prevent 32 GB VRAM OOM."
    },
    param_ctv: {
      title: "-ctv (KV Cache Value Precision)",
      desc: "Quantization type for KV cache Value tensors (fp16, q8_0, q4_0). Should match -ctk.",
      rec: "Default / Recommended: fp16 for 32k runs; q8_0 for 06B 64k Sweep (-c 70000)."
    },
    param_pp: {
      title: "--pp (HTTP Prompt Prefill Lengths)",
      desc: "Space-separated input token lengths tested over HTTP in llama-benchy.",
      rec: "Default / Recommended: 512 2048."
    },
    param_tg: {
      title: "--tg (HTTP Token Generation Lengths)",
      desc: "Space-separated output token lengths generated per HTTP request in llama-benchy.",
      rec: "Default / Recommended: 128 512."
    },
    param_depth: {
      title: "--depth (Pre-existing KV Cache Depth)",
      desc: "Space-separated context depths (tokens pre-loaded into KV cache before measuring) to test how deeper context slows down generation (0 vs 4096).",
      rec: "Default / Recommended: 0 4096."
    },
    param_runs: {
      title: "--runs (Iterations per Matrix Point)",
      desc: "Number of runs averaged for each (pp, tg, depth) combination in llama-benchy.",
      rec: "Default / Recommended: 3."
    },
    param_concurrency: {
      title: "Concurrent Request Streams",
      desc: "Number of parallel client requests sent simultaneously to llama-server.",
      rec: "Default / Recommended: 4 for 03 llmperf & 06A AIPerf Standard; 1 for 04 SPEED-Bench & 06B AIPerf 64k Sweep."
    },
    param_maxCompleted: {
      title: "--max-num-completed-requests (Total Requests)",
      desc: "Total number of completed requests across all concurrent workers before llmperf finishes.",
      rec: "Default / Recommended: 20."
    },
    param_meanInput: {
      title: "--mean-input-tokens (Mean Input Length)",
      desc: "Average input prompt token length per request in llmperf.",
      rec: "Default / Recommended: 1024 (or 512 for Fast preset)."
    },
    param_stddevInput: {
      title: "--stddev-input-tokens (Input Length Stddev)",
      desc: "Standard deviation (variance) of input prompt token counts across requests in llmperf.",
      rec: "Default / Recommended: 128 (or 64 for Fast preset)."
    },
    param_meanOutput: {
      title: "--mean-output-tokens (Mean Output Length)",
      desc: "Average number of output tokens generated per request in llmperf.",
      rec: "Default / Recommended: 256 (or 128 for Fast preset)."
    },
    param_stddevOutput: {
      title: "--stddev-output-tokens (Output Length Stddev)",
      desc: "Standard deviation of generated output token counts across requests in llmperf.",
      rec: "Default / Recommended: 32 (or 16 for Fast preset)."
    },
    param_contextPreset: {
      title: "SPEED-Bench Context Quick Select",
      desc: "Quickly sets llama-server -c to 16K (16384), 32K (32768), or 64K (65536). Selecting 64K automatically suffixes output filenames with _ctx64k.json.",
      rec: "Default / Recommended: 32K (32768) for standard runs; 64K (65536) for long-context comparison."
    },
    param_category: {
      title: "--category (SPEED-Bench Task Categories)",
      desc: "Selects which qualitative benchmark categories to run ('all' runs coding, math, reasoning, writing, rag, roleplay, and tool_use).",
      rec: "Default / Recommended: all."
    },
    param_osl: {
      title: "--osl (Output Sequence Length)",
      desc: "Maximum output tokens generated per prompt in SPEED-Bench.",
      rec: "Default / Recommended: 1024."
    },
    param_limit: {
      title: "--limit (Prompts per Category Cap)",
      desc: "Caps the number of prompts executed per category so the full qualitative suite finishes in ~8-15 minutes.",
      rec: "Default / Recommended: 5."
    },
    param_compareBaselineFile: {
      title: "Compare Baseline JSON (--baseline)",
      desc: "Baseline result JSON file passed to speed_bench_compare.py (e.g. Dense Qwen 3.8 or Standard 32K run).",
      rec: "Default / Recommended: speedbench_qwen38.json."
    },
    param_compareSpeculativeFile: {
      title: "Compare Speculative / Target JSON (--speculative)",
      desc: "Target result JSON file compared against the baseline in speed_bench_compare.py (e.g. MoE Qwen 3.6 or 64K _ctx64k.json run).",
      rec: "Default / Recommended: speedbench_qwen36.json."
    },
    param_extraFlags: {
      title: "Extra Client Flags (agentperf-local)",
      desc: "Optional additional CLI arguments appended to 'agentperf-local run'.",
      rec: "Default / Recommended: Blank (none required)."
    },
    param_requestCount: {
      title: "--request-count (Measured Requests)",
      desc: "Number of benchmarked requests executed per profile or per sweep point in AIPerf.",
      rec: "Default / Recommended: 20 for 06A Standard Concurrency; 3 per ISL point for 06B 64k Sweep."
    },
    param_islMean: {
      title: "--synthetic-input-tokens-mean (Input Tokens)",
      desc: "Mean synthetic input prompt length in tokens for 06A AIPerf Standard Concurrency.",
      rec: "Default / Recommended: 1024."
    },
    param_oslMean: {
      title: "--output-tokens-mean (Output Tokens)",
      desc: "Mean generated output token length per request for 06A AIPerf Standard Concurrency.",
      rec: "Default / Recommended: 256."
    },
    param_islList: {
      title: "Sweep ISLs (--isl Input Sequence Lengths)",
      desc: "Comma-separated input context lengths swept sequentially in 06B AIPerf Long-Context Zip Sweep.",
      rec: "Default / Recommended: 16384,32768,65536 (16k, 32k, 64k)."
    },
    param_oslList: {
      title: "Sweep OSLs (--osl Output Sequence Lengths)",
      desc: "Comma-separated output token counts paired 1:1 (--sweep-type zip) with each ISL in 06B.",
      rec: "Default / Recommended: 1024,1024,1024."
    },
    param_warmupCount: {
      title: "--warmup-request-count (Warmup Requests)",
      desc: "Untimed warmup requests sent before timing begins to prime GPU clocks and memory allocations.",
      rec: "Default / Recommended: 1."
    },
    param_randomSeed: {
      title: "--random-seed (Deterministic Prompt Seed)",
      desc: "Fixes synthetic prompt generation so every GPU testbed processes identical token sequences.",
      rec: "Default / Recommended: 42."
    },
    preset_llmperf_default: {
      title: "Default Workload (1024 in / 256 out)",
      desc: "Sets --mean-input-tokens 1024 (--stddev-input-tokens 128) and --mean-output-tokens 256 (--stddev-output-tokens 32).",
      rec: "Default / Recommended: Use for standard parity concurrency comparisons."
    },
    preset_llmperf_fast: {
      title: "Fast Workload (512 in / 128 out)",
      desc: "Sets --mean-input-tokens 512 (--stddev-input-tokens 64) and --mean-output-tokens 128 (--stddev-output-tokens 16) for quicker smoke testing.",
      rec: "Use when you want a fast concurrency check (~2-3 min)."
    },
    cmp_dense_vs_moe: {
      title: "Dense vs MoE Comparator Preset",
      desc: "Configures speed_bench_compare.py to compare Qwen3.8-27B Dense (speedbench_qwen38.json) against Qwen3.6-35B-A3B MoE (speedbench_qwen36.json).",
      rec: "Use after running SPEED-Bench on both Qwen 3.8 and Qwen 3.6."
    },
    cmp_std_vs_64k: {
      title: "Standard (32K) vs 64K Comparator Preset",
      desc: "Configures speed_bench_compare.py to compare the active model's standard context run against its 64K long-context run (_ctx64k.json).",
      rec: "Use after running SPEED-Bench at both 32K and 64K context."
    },
    ssh_user: {
      title: "Remote SSH Username",
      desc: "Linux user account on the remote DGX Spark server.",
      rec: "Default: $USER (or e.g. gadgetpilipinas)."
    },
    ssh_host: {
      title: "Remote SSH Host / LAN IP",
      desc: "LAN IP address or hostname of the DGX Spark server.",
      rec: "Default: 192.168.50.55."
    },
    ssh_port: {
      title: "Remote SSH Port",
      desc: "TCP port for SSH connections.",
      rec: "Default / Recommended: 22."
    },
    ssh_tmuxSession: {
      title: "Remote tmux Session Name",
      desc: "Name of the persistent tmux session created on the remote Linux host.",
      rec: "Default / Recommended: ai_bench."
    },
    ssh_remoteResultsDir: {
      title: "Remote Results Directory (DGX Spark)",
      desc: "Directory on the remote DGX Spark where benchmark output files are written.",
      rec: "Default: $HOME/benchmarks/dgx_spark."
    },
    ssh_localPullDir: {
      title: "Local Pull Directory (Windows PC)",
      desc: "Destination folder on your Windows PC where 'scp -r' copies remote DGX Spark results.",
      rec: "Default: $HOME\\Desktop\\GPU AI Benchmarks\\DGX Spark."
    },
    ssh_hermesServerIp: {
      title: "Hermes Agent Server IP",
      desc: "LAN IP address used by Hermes Agent instances to route requests to Ollama (11434) and vLLM (8000).",
      rec: "Default: 192.168.50.55."
    }
  };

  function createDefaultState() {
    const p = HARDWARE_PROFILES.dgx_spark_linux_arm64;
    const m = QUICK_MODELS[0];
    return {
      schemaVersion: 1,
      ui: {
        theme: "light", // light | dark | system
        lightTerminal: false,
        pauseAnimations: false, // Option 2A unified toggle (motion + stealth GPU blur removal)
        activeTab: "setup", // setup | benchmarks | results
        showPathsAndNaming: false,
        showDeepAuditScript: false,
        playbookMissingOnly: false,
        showMissingOnly: false,
        selectedRunSuites: ["aiperf_std", "aiperf_sweep", "speed_bench"],
        runNote: "",
        previewMode: "selected", // selected | outstanding | prereqs
        showParamCustomize: false,
        fitKv: "fp16",
        showCharts: false,
        remoteSection: "ssh_ps",
        expandedDrawers: {
          llama_bench: false,
          llama_benchy: false,
          llmperf: false,
          speed_bench: false,
          agentperf: false,
          aiperf_std: false,
          aiperf_sweep: false
        }
      },
      hardware: {
        profileId: p.id,
        vramGb: p.defaultVramGb,
        nvidiaDevice: "CUDA0",
        tensorSplit: "",
        amdBackend: "vulkan", // vulkan | rocm
        amdEnableFa: false,
        rtxArmTdigestCompile: false,
        nonSudoSetup: false,
        binDir: p.defaultBinDir,
        repoDir: p.defaultRepoDir,
        benchRoot: p.defaultBenchRoot,
        resultsDir: p.defaultResultsDir,
        host: "0.0.0.0",
        port: 8080
      },
      model: {
        fullPath: p.defaultModelsDir + "/" + m.relativeLinux,
        baseDir: p.defaultModelsDir,
        filename: m.relativeLinux,
        alias: m.alias,
        slug: m.slug,
        tokenizer: m.tokenizer,
        weightGb: m.weightGb,
        paramsB: m.paramsB,
        clientModelMode: "alias" // alias | fullpath (Optimization #3)
      },
      naming: {
        mode: "auto", // auto | stamped | classic
        activePresetName: "Default Settings"
      },
      suites: JSON.parse(JSON.stringify(PARITY_DEFAULTS)),
      completedSteps: {},
      customPresets: [],
      customModels: [],
      ssh: {
        user: "$USER",
        host: "192.168.50.55",
        port: 22,
        tmuxSession: "ai_bench",
        remoteResultsDir: "$HOME/benchmarks/dgx_spark",
        localPullDir: "$HOME\\Desktop\\GPU AI Benchmarks\\DGX Spark",
        hermesServerIp: "192.168.50.55",
        includeVllmInStartAi: true,
        vllmModel: "nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4",
        vllmGpuUtil: "0.70"
      },
      audit: {
        lastFolderName: "",
        lastAuditedAt: "",
        items: {}
      },
      results: {
        includeSampleData: false,
        loadedRecords: []
      }
    };
  }

  global.BenchmateData = {
    HARDWARE_PROFILES,
    QUICK_MODELS,
    PARITY_DEFAULTS,
    SUITE_METADATA,
    REFERENCE_PARITY_GUIDE,
    SAMPLE_RESULTS_DATASET,
    HELP_TOOLTIPS,
    createDefaultState
  };
})(window);

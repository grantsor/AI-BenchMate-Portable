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

  function createDefaultState() {
    const p = HARDWARE_PROFILES.dgx_spark_linux_arm64;
    const m = QUICK_MODELS[0];
    return {
      schemaVersion: 1,
      ui: {
        theme: "light", // light | dark | system
        lightTerminal: false,
        pauseAnimations: false, // Option 2A unified toggle (motion + stealth GPU blur removal)
        activeTab: "benchmarks", // benchmarks | results | ssh
        showPathsAndNaming: false,
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
        activePresetName: "Baseline Parity Defaults"
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
    createDefaultState
  };
})(window);

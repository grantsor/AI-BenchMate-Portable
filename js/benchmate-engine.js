/* ==========================================================================
   AI Benchmate — Core Engine
   Persistence (localStorage + IndexedDB), Smart Path Parser,
   Dynamic Naming Engine, Command Builders, Guardrails, Auditor & Parsers
   ========================================================================== */
(function (global) {
  "use strict";

  const STORAGE_KEY = "ai_benchmate_state_v1";
  const IDB_NAME = "ai_benchmate_db";
  const IDB_STORE = "snapshots";

  function deepMerge(target, source) {
    if (!source || typeof source !== "object") return target;
    const out = Array.isArray(target) ? target.slice() : Object.assign({}, target);
    Object.keys(source).forEach((key) => {
      const srcVal = source[key];
      const tgtVal = out[key];
      if (srcVal && typeof srcVal === "object" && !Array.isArray(srcVal) && tgtVal && typeof tgtVal === "object" && !Array.isArray(tgtVal)) {
        out[key] = deepMerge(tgtVal, srcVal);
      } else if (srcVal !== undefined) {
        out[key] = srcVal;
      }
    });
    return out;
  }

  function loadState() {
    const fallback = global.BenchmateData.createDefaultState();
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return fallback;
      const merged = deepMerge(fallback, JSON.parse(raw));
      const legacyTabMap = {
        builder: "benchmarks",
        run: "benchmarks",
        models: "benchmarks",
        system: "benchmarks",
        coverage: "results",
        ssh: "setup",
        setup: "setup",
        remote: "setup"
      };
      if (legacyTabMap[merged.ui.activeTab]) {
        merged.ui.activeTab = legacyTabMap[merged.ui.activeTab];
      }
      return merged;
    } catch (_) {
      return fallback;
    }
  }

  function saveState(state) {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) {
      // Storage quota fallback handled gracefully
    }
  }

  function openIDB() {
    return new Promise((resolve, reject) => {
      if (!global.indexedDB) {
        reject(new Error("IndexedDB unavailable"));
        return;
      }
      const req = global.indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function saveSnapshotIDB(key, value) {
    try {
      const db = await openIDB();
      return await new Promise((resolve) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).put(value, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch (_) {
      return false;
    }
  }

  async function loadSnapshotIDB(key) {
    try {
      const db = await openIDB();
      return await new Promise((resolve) => {
        const tx = db.transaction(IDB_STORE, "readonly");
        const req = tx.objectStore(IDB_STORE).get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (_) {
      return null;
    }
  }

  // ---------- Path Utilities (Zero Hardcoded Usernames) ----------
  function detectSep(pathStr, os) {
    if (pathStr && pathStr.indexOf("\\") !== -1 && pathStr.indexOf("/") === -1) return "\\";
    if (pathStr && pathStr.indexOf("/") !== -1 && pathStr.indexOf("\\") === -1) return "/";
    return os === "windows" ? "\\" : "/";
  }

  function joinPath(base, leaf, sep) {
    const cleanBase = String(base || "").replace(/[\\/]+$/, "");
    const cleanLeaf = String(leaf || "").replace(/^[\\/]+/, "");
    if (!cleanBase) return cleanLeaf;
    if (!cleanLeaf) return cleanBase;
    return cleanBase + sep + cleanLeaf;
  }

  function parseModelPath(rawPath) {
    const trimmed = String(rawPath || "").trim();
    const isWin = trimmed.indexOf("\\") !== -1 || /^[A-Za-z]:/.test(trimmed);
    const sep = isWin ? "\\" : "/";
    const parts = trimmed.split(/[\\/]+/).filter(Boolean);
    const filename = parts.length ? parts[parts.length - 1] : "model.gguf";
    let baseDir = "";
    if (parts.length > 1) {
      baseDir = (trimmed.startsWith("/") ? "/" : "") + parts.slice(0, -1).join(sep);
    }

    // Strip extension and common quant suffixes to obtain clean alias
    const withoutExt = filename.replace(/\.gguf$/i, "");
    const alias = withoutExt
      .replace(/-(UD-)?(IQ\d+_[A-Z0-9_]+|Q\d+_[A-Z0-9_]+|F16|BF16|F32|FP8|NVFP4|QAT)$/i, "")
      .replace(/-(Q\d+_K_[MS]|Q\d+_\d+|Q8_0|Q4_0)$/i, "") || withoutExt;

    // Derive compact clean output slug: e.g., Qwen3.8-27B -> qwen38, Qwen3.6-35B-A3B -> qwen36
    let slug = alias.toLowerCase();
    const qwenVer = alias.match(/qwen\s*([0-9]+)\.([0-9]+)/i);
    if (qwenVer) {
      slug = "qwen" + qwenVer[1] + qwenVer[2];
    } else {
      slug = alias
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 22) || "model";
    }

    // Suggest Hugging Face Tokenizer ID
    let tokenizer = alias;
    if (/^qwen/i.test(alias)) tokenizer = "Qwen/" + alias;
    else if (/^gemma/i.test(alias)) tokenizer = "google/" + alias;
    else if (/^hermes/i.test(alias)) tokenizer = "NousResearch/" + alias;
    else if (/nemotron/i.test(alias)) tokenizer = "nvidia/" + alias;
    else if (/llama/i.test(alias)) tokenizer = "meta-llama/" + alias;
    else if (/mistral/i.test(alias)) tokenizer = "mistralai/" + alias;

    // Estimate weight GB from parameter count and quant
    let paramsB = 27;
    const bMatch = filename.match(/(\d+(?:\.\d+)?)\s*[Bb](?:[^a-zA-Z]|$)/);
    if (bMatch) paramsB = parseFloat(bMatch[1]);

    let bytesPerParam = 0.58; // Q4_K_M default
    if (/q8_0/i.test(filename)) bytesPerParam = 1.06;
    else if (/q6_k/i.test(filename)) bytesPerParam = 0.82;
    else if (/q5_k/i.test(filename)) bytesPerParam = 0.70;
    else if (/q4_0|nvfp4/i.test(filename)) bytesPerParam = 0.56;
    else if (/q3_k/i.test(filename)) bytesPerParam = 0.45;
    else if (/q2_k/i.test(filename)) bytesPerParam = 0.34;
    else if (/fp16|bf16/i.test(filename)) bytesPerParam = 2.0;

    const weightGb = Math.max(1.5, Math.round(paramsB * bytesPerParam * 10) / 10);

    return {
      osStyle: isWin ? "windows" : "linux",
      sep,
      baseDir,
      filename,
      alias,
      slug,
      tokenizer,
      paramsB,
      weightGb
    };
  }

  // ---------- Dynamic Naming Engine ----------
  function formatShortToken(val) {
    const num = parseInt(String(val || "").trim(), 10);
    if (!Number.isFinite(num) || num <= 0) return String(val || "").trim();
    if (num >= 1024 && num % 1024 === 0) return (num / 1024) + "k";
    if (num >= 1000 && num % 1000 === 0) return (num / 1000) + "k";
    if (num === 70000) return "70k";
    if (num === 65536) return "64k";
    if (num === 32768) return "32k";
    if (num === 16384) return "16k";
    if (num === 8192) return "8k";
    if (num === 4096) return "4k";
    return String(num);
  }

  function formatTokenList(str, useShort) {
    return String(str || "")
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => (useShort ? formatShortToken(s) : s))
      .join("-") || "0";
  }

  function isSuiteCustomized(state, suiteId) {
    const def = global.BenchmateData.PARITY_DEFAULTS[suiteId];
    const cur = state.suites[suiteId];
    if (!def || !cur) return false;
    return Object.keys(def).some((k) => {
      if (k === "compareBaselineFile" || k === "compareSpeculativeFile") return false;
      return String(def[k]) !== String(cur[k]);
    });
  }

  function resolveNamingMode(state, suiteId) {
    if (state.naming.mode === "stamped") return "stamped";
    if (state.naming.mode === "classic") return "classic";
    return isSuiteCustomized(state, suiteId) ? "stamped" : "classic";
  }

  function getOutputTarget(state, suiteId) {
    const profile = global.BenchmateData.HARDWARE_PROFILES[state.hardware.profileId];
    const sep = profile.os === "windows" ? "\\" : "/";
    const slug = (state.model.slug || "model").trim();
    const s = state.suites[suiteId];
    const mode = resolveNamingMode(state, suiteId);
    const centralDir = state.hardware.resultsDir || profile.defaultResultsDir;

    let leaf = "";
    let isDir = false;

    if (mode === "classic") {
      switch (suiteId) {
        case "llama_bench":
          leaf = `llama_bench_${slug}.${s.format || "md"}`;
          break;
        case "llama_benchy":
          leaf = `llama_benchy_${slug}.${s.format || "md"}`;
          break;
        case "llmperf":
          leaf = `llmperf_${slug}`;
          isDir = true;
          break;
        case "speed_bench":
          leaf = Number(s.c) >= 65536 ? `speedbench_${slug}_ctx64k.json` : `speedbench_${slug}.json`;
          break;
        case "agentperf":
          leaf = `agentperf_${slug}`;
          isDir = true;
          break;
        case "aiperf_std":
          leaf = `aiperf_${slug}_std`;
          isDir = true;
          break;
        case "aiperf_sweep":
          leaf = `aiperf_${slug}_nv64k`;
          isDir = true;
          break;
      }
    } else {
      switch (suiteId) {
        case "llama_bench":
          leaf = `llama_bench_${slug}_pp${formatTokenList(s.p, false)}_tg${formatTokenList(s.n, false)}_r${s.r}.${s.format || "md"}`;
          break;
        case "llama_benchy":
          leaf = `llama_benchy_${slug}_ctx${formatShortToken(s.c)}_kv${s.ctk}_pp${formatTokenList(s.pp, false)}_tg${formatTokenList(s.tg, false)}_d${formatTokenList(s.depth, false)}_r${s.runs}.${s.format || "md"}`;
          break;
        case "llmperf":
          leaf = `llmperf_${slug}_ctx${formatShortToken(s.c)}_in${s.meanInput}_out${s.meanOutput}_c${s.concurrency}_req${s.maxCompleted}`;
          isDir = true;
          break;
        case "speed_bench": {
          const catSlug = String(s.category || "all").toLowerCase().replace(/[^a-z0-9]+/g, "-");
          leaf = `speedbench_${slug}_ctx${formatShortToken(s.c)}_osl${s.osl}_c${s.concurrency}_lim${s.limit}_${catSlug}.json`;
          break;
        }
        case "agentperf":
          leaf = `agentperf_${slug}_ctx${formatShortToken(s.c)}_kv${s.ctk}`;
          isDir = true;
          break;
        case "aiperf_std":
          leaf = `aiperf_${slug}_std_ctx${formatShortToken(s.c)}_in${s.islMean}_out${s.oslMean}_c${s.concurrency}_req${s.requestCount}`;
          isDir = true;
          break;
        case "aiperf_sweep": {
          const oslFirst = String(s.oslList || "1024").split(/[,\s]+/)[0] || "1024";
          leaf = `aiperf_${slug}_sweep_ctx${formatShortToken(s.c)}_kv${s.ctk}_isl${formatTokenList(s.islList, true)}_osl${oslFirst}_c${s.concurrency}_r${s.requestCount}`;
          isDir = true;
          break;
        }
      }
    }

    const fullPath = joinPath(centralDir, leaf, sep) + (isDir ? sep : "");
    return { leaf: leaf + (isDir ? sep : ""), fullPath, isDir, mode };
  }

  // ---------- Driver Flags & Syntax Helpers ----------
  function getDeviceFlags(state, faOverride) {
    const pid = state.hardware.profileId;
    const hw = state.hardware;
    const parts = [];

    if (pid === "rtx_spark_win_arm64" || pid === "nvidia_win_x64") {
      parts.push(`--device ${hw.nvidiaDevice || "CUDA0"}`);
      if (hw.tensorSplit && hw.tensorSplit.trim()) {
        parts.push(`--tensor-split ${hw.tensorSplit.trim()}`);
      }
    } else if (pid === "amd_win_x64") {
      const dev = hw.amdBackend === "rocm" ? "HIP0" : "Vulkan0";
      parts.push(`--device ${dev}`);
    }

    return parts.join(" ");
  }

  function getFaFlag(state, faValue, isSpeedBench) {
    const pid = state.hardware.profileId;
    if (pid === "amd_win_x64" && state.hardware.amdBackend === "vulkan" && !state.hardware.amdEnableFa) {
      return "";
    }
    if (isSpeedBench) return "-fa on";
    return faValue ? `-fa ${faValue}` : "-fa 1";
  }

  function getClientModelArg(state) {
    const mode = String(state.model.clientModelMode || "alias").toLowerCase();
    return mode === "fullpath"
      ? state.model.fullPath
      : (state.model.alias || "model");
  }

  function formatMultiline(lines, os) {
    const cont = os === "windows" ? " `" : " \\";
    return lines
      .filter((l) => l !== null && l !== undefined && String(l).trim() !== "")
      .map((line, idx, arr) => (idx < arr.length - 1 ? line + cont : line))
      .join("\n");
  }

  // ---------- Server & Client Command Builders ----------
  function buildServerCommand(state, suiteId) {
    if (suiteId === "llama_bench") return "";
    const profile = global.BenchmateData.HARDWARE_PROFILES[state.hardware.profileId];
    const isWin = profile.os === "windows";
    const s = state.suites[suiteId];
    const binDir = state.hardware.binDir || profile.defaultBinDir;
    const port = state.hardware.port || 8080;
    const serverBin = profile.llamaServerBin;
    const devFlags = getDeviceFlags(state);
    const isSpeed = suiteId === "speed_bench";
    const faFlag = getFaFlag(state, s.fa || "1", isSpeed);
    const kvFlags = (s.ctk && s.ctk !== "fp16") ? `-ctk ${s.ctk} -ctv ${s.ctv || s.ctk}` : "";
    const jinjaFlag = isSpeed && s.jinja ? "--jinja" : "";
    const aliasFlag = `--alias "${state.model.alias}"`;

    const cmdLines = [
      `${serverBin}`,
      `  -m "${state.model.fullPath}"`,
      `  ${aliasFlag}`,
      `  ${[devFlags, `--host ${state.hardware.host}`, `--port ${port}`, "-ngl 99", faFlag, `-c ${s.c}`, kvFlags, `-np ${s.np || 1}`, jinjaFlag].filter(Boolean).join(" ")}`
    ];

    const preamble = isWin
      ? `# Terminal 1 — Launch llama-server (${profile.shortName})\nStop-Process -Name "llama-server" -Force -ErrorAction SilentlyContinue\nSet-Location "${binDir}"\n`
      : `# Terminal 1 — Launch llama-server (${profile.shortName})\npkill -u "$USER" -9 -f "llama-server" 2>/dev/null || true; fuser -k ${port}/tcp 2>/dev/null || true\ncd "${binDir}"\n`;

    return preamble + formatMultiline(cmdLines, profile.os);
  }

  function buildSuiteClientCommand(state, suiteId) {
    const profile = global.BenchmateData.HARDWARE_PROFILES[state.hardware.profileId];
    const isWin = profile.os === "windows";
    const s = state.suites[suiteId];
    const binDir = state.hardware.binDir || profile.defaultBinDir;
    const benchRoot = state.hardware.benchRoot || profile.defaultBenchRoot;
    const repoDir = state.hardware.repoDir || profile.defaultRepoDir;
    const resultsDir = state.hardware.resultsDir || profile.defaultResultsDir;
    const baseUrl = `http://127.0.0.1:${state.hardware.port}`;
    const v1Url = `${baseUrl}/v1`;
    const clientModel = getClientModelArg(state);
    const outTarget = getOutputTarget(state, suiteId);
    const venvActivate = isWin
      ? `$env:Path = "${benchRoot}\\.venv-aiperf\\Scripts;" + [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")\nSet-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force\n& "${benchRoot}\\.venv-aiperf\\Scripts\\Activate.ps1"`
      : `export PATH="${benchRoot}/.venv-aiperf/bin:$HOME/.local/bin:$PATH"\nsource "${benchRoot}/.venv-aiperf/bin/activate"`;

    const mkdirCmd = isWin
      ? `New-Item -ItemType Directory -Force -Path "${resultsDir}" | Out-Null`
      : `mkdir -p "${resultsDir}"`;

    if (suiteId === "llama_bench") {
      const devFlags = getDeviceFlags(state);
      const faFlag = getFaFlag(state, s.fa || "1", false);
      const batchFlags = (Number(s.b) !== 2048 || Number(s.ub) !== 512) ? `-b ${s.b} -ub ${s.ub}` : "";
      const teeCmd = isWin
        ? `| Tee-Object -FilePath "${outTarget.fullPath}"`
        : `| tee "${outTarget.fullPath}"`;

      const lines = [
        `${profile.llamaBenchBin}`,
        `  -m "${state.model.fullPath}"`,
        `  ${[devFlags, `-ngl ${s.ngl}`, faFlag, `-p ${s.p}`, `-n ${s.n}`, `-r ${s.r}`, batchFlags, `-o ${s.format}`].filter(Boolean).join(" ")} ${teeCmd}`
      ];

      return (isWin
        ? `# Direct Native C++ Run (No Server Needed)\n${mkdirCmd}\nSet-Location "${binDir}"\n`
        : `# Direct Native C++ Run (No Server Needed)\n${mkdirCmd}\ncd "${binDir}"\n`) + formatMultiline(lines, profile.os);
    }

    if (suiteId === "llama_benchy") {
      const pyBin = isWin ? "python" : "python3";
      const cacheClean = isWin
        ? `Remove-Item -Recurse -Force "$env:USERPROFILE\\.cache\\llama-benchy" -ErrorAction SilentlyContinue`
        : `rm -rf ~/.cache/llama-benchy`;
      const teeCmd = isWin
        ? `| Tee-Object -FilePath "${outTarget.fullPath}"`
        : `| tee "${outTarget.fullPath}"`;

      const lines = [
        `${pyBin} -u -m llama_benchy`,
        `  --base-url ${v1Url}`,
        `  --model "${clientModel}" --tokenizer "${state.model.tokenizer}"`,
        `  --pp ${s.pp} --tg ${s.tg} --depth ${s.depth} --runs ${s.runs} --format ${s.format} ${teeCmd}`
      ];

      return `# Terminal 2 — llama-benchy (with Gutenberg Cache Cleanup)\n${mkdirCmd}\n${venvActivate}\n${cacheClean}\n` + formatMultiline(lines, profile.os);
    }

    if (suiteId === "llmperf") {
      const pyBin = isWin ? "python" : "python3";
      const sep = isWin ? "\\" : "/";
      const llmperfDir = joinPath(benchRoot, "llmperf", sep);
      const cdLlmperf = isWin ? `Set-Location "${llmperfDir}"` : `cd "${llmperfDir}"`;
      const envSet = isWin
        ? `$env:OPENAI_API_BASE = "${v1Url}"\n$env:OPENAI_API_KEY = "dummy"`
        : `export OPENAI_API_BASE="${v1Url}"\nexport OPENAI_API_KEY="dummy"`;
      const scriptPath = joinPath(llmperfDir, "token_benchmark_ray.py", sep);

      const lines = [
        `${pyBin} "${scriptPath}"`,
        `  --model "${clientModel}"`,
        `  --mean-input-tokens ${s.meanInput} --stddev-input-tokens ${s.stddevInput}`,
        `  --mean-output-tokens ${s.meanOutput} --stddev-output-tokens ${s.stddevOutput}`,
        `  --num-concurrent-requests ${s.concurrency} --max-num-completed-requests ${s.maxCompleted}`,
        `  --results-dir "${outTarget.fullPath.replace(/[\\/]$/, "")}"`
      ];

      return `# Terminal 2 — llmperf Ray Multi-Stream Concurrency\n${mkdirCmd}\n${venvActivate}\n${cdLlmperf}\n${envSet}\n` + formatMultiline(lines, profile.os);
    }

    if (suiteId === "speed_bench") {
      const pyBin = isWin ? "python" : "python3";
      const sep = isWin ? "\\" : "/";
      const relScript = isWin
        ? "tools\\server\\bench\\speed-bench\\speed_bench.py"
        : "tools/server/bench/speed-bench/speed_bench.py";
      const relCompare = isWin
        ? "tools\\server\\bench\\speed-bench\\speed_bench_compare.py"
        : "tools/server/bench/speed-bench/speed_bench_compare.py";
      const extraEsc = isWin ? `'${s.extraInputs || "{}"}'` : `'${s.extraInputs || "{}"}'`;

      const lines = [
        `${pyBin} "${relScript}"`,
        `  --url ${baseUrl} --bench ${s.bench} --category ${s.category}`,
        `  --osl ${s.osl} --concurrency ${s.concurrency} --extra-inputs ${extraEsc} --limit ${s.limit}`,
        `  --output "${outTarget.fullPath}"`
      ];

      const cmpLines = [
        `${pyBin} "${relCompare}"`,
        `  --baseline "${joinPath(resultsDir, s.compareBaselineFile || "run_a.json", sep)}"`,
        `  --speculative "${joinPath(resultsDir, s.compareSpeculativeFile || "run_b.json", sep)}"`
      ];

      return `# Terminal 2 — SPEED-Bench Qualitative Suite\n${mkdirCmd}\n${isWin ? `Set-Location "${repoDir}"` : `cd "${repoDir}"`}\n${venvActivate}\n` +
        formatMultiline(lines, profile.os) +
        `\n\n# Built-in Comparator Step\n` +
        formatMultiline(cmpLines, profile.os);
    }

    if (suiteId === "agentperf") {
      const agentVenv = isWin
        ? `$env:Path = "${benchRoot}\\.venv-agentperf\\Scripts;" + [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")\nSet-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force\n& "${benchRoot}\\.venv-agentperf\\Scripts\\Activate.ps1"`
        : `export PATH="${benchRoot}/.venv-agentperf/bin:$HOME/.local/bin:$PATH"\nsource "${benchRoot}/.venv-agentperf/bin/activate"`;
      const outDirClean = outTarget.fullPath.replace(/[\\/]$/, "");
      const mkdirOut = isWin
        ? `New-Item -ItemType Directory -Force -Path "${outDirClean}" | Out-Null`
        : `mkdir -p "${outDirClean}"`;

      const lines = [
        `agentperf-local run`,
        `  --base-url ${v1Url}`,
        `  --model "${clientModel}"`,
        `  --output-dir "${outDirClean}"${s.extraFlags ? " " + s.extraFlags : ""}`
      ];

      return `# Terminal 2 — AA-AgentPerf-Local (.venv-agentperf)\n${mkdirOut}\n${agentVenv}\n` + formatMultiline(lines, profile.os);
    }

    if (suiteId === "aiperf_std") {
      const outDirClean = outTarget.fullPath.replace(/[\\/]$/, "");
      const mkdirOut = isWin
        ? `New-Item -ItemType Directory -Force -Path "${outDirClean}" | Out-Null`
        : `mkdir -p "${outDirClean}"`;
      const lines = [
        `aiperf profile`,
        `  --model "${clientModel}" --tokenizer "${state.model.tokenizer}" --url "${baseUrl}"`,
        `  --endpoint-type chat --streaming --ui simple`,
        `  --concurrency ${s.concurrency} --request-count ${s.requestCount}`,
        `  --synthetic-input-tokens-mean ${s.islMean} --output-tokens-mean ${s.oslMean}`,
        `  ${[s.ignoreEos ? '--extra-inputs "ignore_eos:true"' : "", '--extra-inputs "cache_prompt:false"'].filter(Boolean).join(" ")}`,
        `  --random-seed 42 --use-server-token-count --artifact-dir "${outDirClean}"`
      ];
      return `# Terminal 2 — AIPerf Standard Concurrency\n${mkdirOut}\n${venvActivate}\n` + formatMultiline(lines, profile.os);
    }

    if (suiteId === "aiperf_sweep") {
      const outDirClean = outTarget.fullPath.replace(/[\\/]$/, "");
      const mkdirOut = isWin
        ? `New-Item -ItemType Directory -Force -Path "${outDirClean}" | Out-Null`
        : `mkdir -p "${outDirClean}"`;
      const lines = [
        `aiperf profile`,
        `  --model "${clientModel}" --tokenizer "${state.model.tokenizer}" --url "${baseUrl}"`,
        `  --endpoint-type chat --streaming --ui ${s.uiMode || "simple"} --sweep-type zip`,
        `  --isl "${s.islList}" --osl "${s.oslList}" --isl-stddev ${s.islStddev} --osl-stddev ${s.oslStddev}`,
        `  ${[s.ignoreEos ? '--extra-inputs "ignore_eos:true"' : "", `--extra-inputs "cache_prompt:${s.cachePrompt ? "true" : "false"}"`].filter(Boolean).join(" ")}`,
        `  --concurrency ${s.concurrency} --warmup-request-count ${s.warmupCount} --request-count ${s.requestCount}`,
        `  --random-seed ${s.randomSeed} --use-server-token-count --artifact-dir "${outDirClean}"`
      ];
      return `# Terminal 2 — AIPerf Long-Context Zip Sweep\n${mkdirOut}\n${venvActivate}\n` + formatMultiline(lines, profile.os);
    }

    return "";
  }

  function buildAllInOnePlaybook(state, onlyIncomplete) {
    const profile = global.BenchmateData.HARDWARE_PROFILES[state.hardware.profileId];
    const header = [
      `# =====================================================================`,
      `# AI Benchmate Playbook — ${profile.name}`,
      `# Model: ${state.model.alias} (${state.model.fullPath})`,
      `# Naming Mode: ${state.naming.mode.toUpperCase()} | Preset: ${state.naming.activePresetName}`,
      `# =====================================================================`,
      ""
    ].join("\n");

    const chunks = global.BenchmateData.SUITE_METADATA.map((meta) => {
      if (onlyIncomplete) {
        const auditItem = state.audit.items[meta.id];
        if (auditItem && auditItem.status === "verified") return "";
      }
      const srv = buildServerCommand(state, meta.id);
      const cli = buildSuiteClientCommand(state, meta.id);
      return [
        `### [${meta.index}] ${meta.title}`,
        srv ? srv + "\n" : "",
        cli,
        ""
      ].filter(Boolean).join("\n");
    }).filter(Boolean);

    return header + (chunks.length ? chunks.join("\n") : "# All suites are currently verified complete!");
  }

  function buildDeepAuditScript(state) {
    const profile = global.BenchmateData.HARDWARE_PROFILES[state.hardware.profileId];
    const dir = state.hardware.resultsDir || profile.defaultResultsDir;
    if (profile.os === "windows") {
      return [
        `# PowerShell Deep Audit Script (Anti-1KB Stub Verification)`,
        `$resultsDir = "${dir}"`,
        `Get-ChildItem -Path $resultsDir -Recurse -File | ForEach-Object {`,
        `  $kb = [math]::Round($_.Length / 1024, 2)`,
        `  $status = if ($_.Length -lt 1024) { "STUB(<1KB)" } else { "OK" }`,
        `  [PSCustomObject]@{ Status=$status; SizeKB=$kb; File=$_.FullName.Replace($resultsDir, "") }`,
        `} | Format-Table -AutoSize`
      ].join("\n");
    }
    return [
      `# Bash Deep Audit Script (Anti-1KB Stub Verification)`,
      `RESULTS_DIR="${dir}"`,
      `find "$RESULTS_DIR" -maxdepth 3 -type f -exec ls -lh {} +`,
      `echo "--- Checking for <= 1KB Stubs ---"`,
      `find "$RESULTS_DIR" -maxdepth 3 -type f -size -1024c -print`,
      `echo "--- Checking AIPerf Errors ---"`,
      `grep -rn "ERROR\\|Exception\\|context" "$RESULTS_DIR"/*/logs/aiperf.log 2>/dev/null || true`
    ].join("\n");
  }

  // ---------- Proactive Hardware Guardrails ----------
  function evaluateGuardrails(state) {
    const warnings = [];
    const profile = global.BenchmateData.HARDWARE_PROFILES[state.hardware.profileId];
    const vramCeiling = Number(state.hardware.vramGb) || profile.defaultVramGb;

    // 1. Dynamic Context Overflow Guardrail (65588 > 65536 Trap)
    const sweep = state.suites.aiperf_sweep;
    const sweepIslMax = Math.max(...String(sweep.islList || "16384").split(/[,\s]+/).map((n) => parseInt(n, 10) || 0), 0);
    const sweepOslMax = Math.max(...String(sweep.oslList || "1024").split(/[,\s]+/).map((n) => parseInt(n, 10) || 0), 0);
    const sweepReqCtx = sweepIslMax + sweepOslMax + 64;
    if (sweepReqCtx > Number(sweep.c)) {
      warnings.push({
        id: "ctx_aiperf_sweep",
        severity: "crimson",
        suiteId: "aiperf_sweep",
        title: `Context Overflow Trap (${sweepReqCtx} > ${sweep.c}) on AIPerf 64k Sweep`,
        detail: `Max ISL (${sweepIslMax}) + OSL (${sweepOslMax}) + ~64 tokens chat template wrapper = ${sweepReqCtx} tokens, exceeding Server -c ${sweep.c}. Auto-fix sets -c 70000 -ctk q8_0 -ctv q8_0.`,
        fixLabel: "1-Click Auto-Fix (-c 70000 -ctk q8_0 -ctv q8_0)"
      });
    }

    const benchy = state.suites.llama_benchy;
    const benchyPpMax = Math.max(...String(benchy.pp || "512").split(/[,\s]+/).map((n) => parseInt(n, 10) || 0), 0);
    const benchyTgMax = Math.max(...String(benchy.tg || "128").split(/[,\s]+/).map((n) => parseInt(n, 10) || 0), 0);
    const benchyDepthMax = Math.max(...String(benchy.depth || "0").split(/[,\s]+/).map((n) => parseInt(n, 10) || 0), 0);
    const benchyReqCtx = benchyPpMax + benchyDepthMax + benchyTgMax + 64;
    if (benchyReqCtx > Number(benchy.c)) {
      warnings.push({
        id: "ctx_benchy",
        severity: "crimson",
        suiteId: "llama_benchy",
        title: `Context Overflow on llama-benchy (${benchyReqCtx} > ${benchy.c})`,
        detail: `Max pp (${benchyPpMax}) + max depth (${benchyDepthMax}) + max tg (${benchyTgMax}) + 64 template overhead exceeds Server -c ${benchy.c}.`,
        fixLabel: `Auto-Fix (-c ${Math.max(70000, benchyReqCtx + 1024)})`
      });
    }

    const lp = state.suites.llmperf;
    const lpReqCtx = (Number(lp.meanInput) || 1024) + 2 * (Number(lp.stddevInput) || 0) + (Number(lp.meanOutput) || 256) + 64;
    if (lpReqCtx > Number(lp.c)) {
      warnings.push({
        id: "ctx_llmperf",
        severity: "crimson",
        suiteId: "llmperf",
        title: `Context Overflow on llmperf (${lpReqCtx} > ${lp.c})`,
        detail: `Mean input (${lp.meanInput}) + 2x stddev (${2 * (Number(lp.stddevInput) || 0)}) + output (${lp.meanOutput}) + 64 overhead exceeds Server -c ${lp.c}.`,
        fixLabel: `Auto-Fix (-c ${Math.max(32768, lpReqCtx + 1024)})`
      });
    }

    const sb = state.suites.speed_bench;
    const sbReqCtx = 16384 + (Number(sb.osl) || 1024) + 64;
    if (sbReqCtx > Number(sb.c)) {
      warnings.push({
        id: "ctx_speed_bench",
        severity: "crimson",
        suiteId: "speed_bench",
        title: `Context Overflow Risk on SPEED-Bench (${sbReqCtx} > ${sb.c})`,
        detail: `Long-context qualitative prompts + OSL (${sb.osl}) + 64 template overhead exceed Server -c ${sb.c}.`,
        fixLabel: `Auto-Fix (-c ${Math.max(32768, sbReqCtx + 1024)})`
      });
    }

    const astd = state.suites.aiperf_std;
    const astdReqCtx = (Number(astd.islMean) || 1024) + (Number(astd.oslMean) || 256) + 64;
    if (astdReqCtx > Number(astd.c)) {
      warnings.push({
        id: "ctx_aiperf_std",
        severity: "crimson",
        suiteId: "aiperf_std",
        title: `Context Overflow on AIPerf Standard (${astdReqCtx} > ${astd.c})`,
        detail: `Mean ISL (${astd.islMean}) + mean OSL (${astd.oslMean}) + 64 template overhead exceeds Server -c ${astd.c}.`,
        fixLabel: `Auto-Fix (-c ${Math.max(32768, astdReqCtx + 1024)})`
      });
    }

    if (sweep.cachePrompt === true) {
      warnings.push({
        id: "sweep_cache_prompt",
        severity: "amber",
        suiteId: "aiperf_sweep",
        title: `AIPerf 64k Sweep has cache_prompt:true enabled`,
        detail: `Reviewer's Guide requires cache_prompt:false so long-context TTFT is not artificially cached between sweep runs.`,
        fixLabel: `1-Click Set cache_prompt:false`
      });
    }

    if (Number(sweep.c) >= 65536 && (sweep.ctk === "fp16" || sweep.ctv === "fp16") && vramCeiling <= 32) {
      warnings.push({
        id: "vram_fp16_64k",
        severity: "amber",
        suiteId: "aiperf_sweep",
        title: `FP16 KV cache at 64k+ context risks OOM on ${vramCeiling} GB GPU`,
        detail: `64k-70k context with FP16 KV exceeds 32 GB VRAM alongside weights; q8_0 KV halves memory overhead.`,
        fixLabel: `1-Click Enable q8_0 KV Cache`
      });
    }

    // 2. VRAM & KV Cache Estimator (Model Weight GB + KV Cache GB + 1.5 GB Compute Buffer)
    const maxServerCtx = Math.max(
      Number(state.suites.llama_benchy.c) || 0,
      Number(state.suites.llmperf.c) || 0,
      Number(state.suites.speed_bench.c) || 0,
      Number(state.suites.aiperf_sweep.c) || 0
    );
    const kvSuiteref = Number(state.suites.aiperf_sweep.c) >= maxServerCtx ? state.suites.aiperf_sweep : state.suites.llama_benchy;
    const kvPrecision = kvSuiteref.ctk || "fp16";
    const kvFactor = kvPrecision === "q4_0" ? 0.28 : kvPrecision === "q8_0" ? 0.53 : 1.0;
    const paramsB = Number(state.model.paramsB) || 27;
    // Approximate FP16 KV cache ~0.25 GB per 1k tokens for 27B class (scaled proportionally by paramsB/27)
    const kvGb = Math.round(((maxServerCtx / 1024) * 0.24 * (paramsB / 27) * kvFactor) * 10) / 10;
    const weightGb = Number(state.model.weightGb) || 15.8;
    const computeBufferGb = 1.5;
    const totalVramGb = Math.round((weightGb + kvGb + computeBufferGb) * 10) / 10;

    if (totalVramGb > vramCeiling) {
      warnings.push({
        id: "vram_overflow",
        severity: "amber",
        suiteId: "vram",
        title: `Estimated VRAM (${totalVramGb} GB) exceeds ${profile.shortName} (${vramCeiling} GB)`,
        detail: `Model (${weightGb} GB) + KV Cache (${kvGb} GB @ ${kvPrecision}, c=${maxServerCtx}) + Compute Buffer (1.5 GB) = ${totalVramGb} GB.`,
        fixLabel: kvPrecision === "fp16" ? "1-Click Enable q8_0 KV Cache" : "1-Click Enable q4_0 KV Cache"
      });
    }

    return {
      warnings,
      vramEstimate: {
        weightGb,
        kvGb,
        computeBufferGb,
        totalVramGb,
        vramCeiling,
        kvPrecision,
        maxServerCtx
      }
    };
  }

  // ---------- Content-Aware Folder Auditor (Anti-1KB Stub Auditor) ----------
  async function auditFileList(fileEntries, state) {
    // fileEntries: array of { path, name, size, textLoader: () => Promise<string> }
    const results = {};
    const suites = global.BenchmateData.SUITE_METADATA;

    // Normalize paths
    const entries = fileEntries.map((f) => ({
      ...f,
      norm: String(f.path || f.name || "").replace(/\\/g, "/")
    }));

    for (const meta of suites) {
      const expected = getOutputTarget(state, meta.id);
      const expectedBase = expected.leaf.replace(/[\\/]+$/, "").toLowerCase();
      const slug = (state.model.slug || "model").toLowerCase();

      let matched = [];
      if (meta.id === "llama_bench") {
        matched = entries.filter((e) => {
          const n = e.norm.toLowerCase();
          return n.includes(expectedBase) || (n.includes("llama_bench") && !n.includes("llama_benchy") && n.includes(slug));
        });
      } else if (meta.id === "llama_benchy") {
        matched = entries.filter((e) => {
          const n = e.norm.toLowerCase();
          return n.includes(expectedBase) || (n.includes("llama_benchy") && n.includes(slug));
        });
      } else if (meta.id === "llmperf") {
        matched = entries.filter((e) => {
          const n = e.norm.toLowerCase();
          return n.includes(expectedBase) || (n.includes("llmperf") && n.includes(slug));
        });
      } else if (meta.id === "speed_bench") {
        matched = entries.filter((e) => {
          const n = e.norm.toLowerCase();
          return n.includes(expectedBase) || (n.includes("speedbench") && n.includes(slug) && n.endsWith(".json"));
        });
      } else if (meta.id === "agentperf") {
        matched = entries.filter((e) => {
          const n = e.norm.toLowerCase();
          return n.includes(expectedBase) || (n.includes("agentperf") && n.includes(slug));
        });
      } else if (meta.id === "aiperf_std") {
        matched = entries.filter((e) => {
          const n = e.norm.toLowerCase();
          return n.includes(expectedBase) || (n.includes("aiperf") && n.includes(slug) && n.includes("std"));
        });
      } else if (meta.id === "aiperf_sweep") {
        matched = entries.filter((e) => {
          const n = e.norm.toLowerCase();
          return n.includes(expectedBase) || (n.includes("aiperf") && n.includes(slug) && (n.includes("sweep") || n.includes("nv64k") || n.includes("64k")));
        });
      }

      if (!matched.length) {
        results[meta.id] = {
          suiteId: meta.id,
          status: "not_run",
          label: "NOT RUN",
          fileCount: 0,
          totalBytes: 0,
          detail: `Expected target "${expected.leaf}" not found in folder.`
        };
        continue;
      }

      const totalBytes = matched.reduce((acc, m) => acc + (m.size || 0), 0);

      // Suite-specific deep content inspection
      if (meta.id === "llama_bench" || meta.id === "llama_benchy") {
        const primary = matched.sort((a, b) => b.size - a.size)[0];
        const text = await primary.textLoader();
        if (primary.size <= 1024 || text.trim().length < 80) {
          results[meta.id] = {
            suiteId: meta.id,
            status: "stub",
            label: "INCOMPLETE STUB / FAILED",
            fileCount: matched.length,
            totalBytes,
            detail: `${primary.name} is only ${primary.size} bytes (<= 1 KB stub or empty output).`
          };
          continue;
        }
        const dataRows = text.split(/\r?\n/).filter((l) => /\|/.test(l) && /\d+\.\d+/.test(l));
        if (dataRows.length === 0) {
          results[meta.id] = {
            suiteId: meta.id,
            status: "stub",
            label: "INCOMPLETE STUB / FAILED",
            fileCount: matched.length,
            totalBytes,
            detail: `${primary.name} contains headers/text without valid formatted numeric rows.`
          };
          continue;
        }
        const hasDepth4096 = meta.id === "llama_benchy" ? /4096/.test(text) : true;
        if (meta.id === "llama_benchy" && !hasDepth4096 && String(state.suites.llama_benchy.depth).includes("4096")) {
          results[meta.id] = {
            suiteId: meta.id,
            status: "partial",
            label: "PARTIAL / SETTING MISMATCH",
            fileCount: matched.length,
            totalBytes,
            detail: `${primary.name} has ${dataRows.length} data rows, but depth 4096 was not found.`
          };
          continue;
        }
        results[meta.id] = {
          suiteId: meta.id,
          status: "verified",
          label: "VERIFIED COMPLETE",
          fileCount: matched.length,
          totalBytes,
          detail: `Confirmed ${dataRows.length} formatted metric rows in ${primary.name} (${Math.round(totalBytes / 1024 * 10) / 10} KB).`
        };
      } else if (meta.id === "speed_bench") {
        const primary = matched.sort((a, b) => b.size - a.size)[0];
        const text = await primary.textLoader();
        if (primary.size <= 1500) {
          results[meta.id] = {
            suiteId: meta.id,
            status: "stub",
            label: "INCOMPLETE STUB / FAILED",
            fileCount: matched.length,
            totalBytes,
            detail: `${primary.name} is ${primary.size} bytes (<= 1.5 KB stub).`
          };
          continue;
        }
        try {
          const json = JSON.parse(text);
          const rawStr = JSON.stringify(json);
          const expectedOsl = String(state.suites.speed_bench.osl);
          const recordedOsl = json.osl || (Array.isArray(json.results) && json.results[0] && json.results[0].osl);
          if (recordedOsl && String(recordedOsl) !== expectedOsl) {
            results[meta.id] = {
              suiteId: meta.id,
              status: "partial",
              label: "PARTIAL / SETTING MISMATCH",
              fileCount: matched.length,
              totalBytes,
              detail: `SPEED-Bench used OSL=${recordedOsl} instead of active OSL=${expectedOsl}.`
            };
          } else if (/\d+\.\d+/.test(rawStr)) {
            const itemCount = Array.isArray(json.results) ? ` (${json.results.length} runs)` : "";
            results[meta.id] = {
              suiteId: meta.id,
              status: "verified",
              label: "VERIFIED COMPLETE",
              fileCount: matched.length,
              totalBytes,
              detail: `Valid SPEED-Bench JSON verified${itemCount} (${Math.round(totalBytes / 1024 * 10) / 10} KB).`
            };
          } else {
            results[meta.id] = {
              suiteId: meta.id,
              status: "stub",
              label: "INCOMPLETE STUB / FAILED",
              fileCount: matched.length,
              totalBytes,
              detail: `${primary.name} parsed as JSON but lacks numeric benchmark metrics.`
            };
          }
        } catch (_) {
          results[meta.id] = {
            suiteId: meta.id,
            status: "stub",
            label: "INCOMPLETE STUB / FAILED",
            fileCount: matched.length,
            totalBytes,
            detail: `${primary.name} is malformed/truncated JSON.`
          };
        }
      } else if (meta.id === "aiperf_std" || meta.id === "aiperf_sweep") {
        const exportJson = matched.find((m) => m.name.toLowerCase() === "profile_export_aiperf.json");
        const logFile = matched.find((m) => m.name.toLowerCase() === "aiperf.log");
        if (!exportJson) {
          let errSnippet = "Missing profile_export_aiperf.json.";
          if (logFile) {
            const logText = await logFile.textLoader();
            const errLines = logText.split(/\r?\n/).filter((l) => /error|exception|exceed|oom|fail|traceback/i.test(l));
            if (errLines.length) errSnippet = `aiperf.log error: "${errLines[errLines.length - 1].trim().slice(0, 140)}"`;
            else errSnippet = `Only logs/aiperf.log found (${logFile.size} B) without profile_export_aiperf.json.`;
          }
          results[meta.id] = {
            suiteId: meta.id,
            status: "stub",
            label: "INCOMPLETE STUB / FAILED",
            fileCount: matched.length,
            totalBytes,
            detail: errSnippet
          };
          continue;
        }
        const jsonText = await exportJson.textLoader();
        if (exportJson.size <= 1500) {
          results[meta.id] = {
            suiteId: meta.id,
            status: "stub",
            label: "INCOMPLETE STUB / FAILED",
            fileCount: matched.length,
            totalBytes,
            detail: `profile_export_aiperf.json is only ${exportJson.size} bytes.`
          };
          continue;
        }
        if (meta.id === "aiperf_sweep") {
          const has16k = /16384/.test(jsonText);
          const has32k = /32768/.test(jsonText);
          const has64k = /65536/.test(jsonText);
          if (!(has16k && has32k && has64k)) {
            const missing = [!has16k && "16k", !has32k && "32k", !has64k && "64k"].filter(Boolean).join(", ");
            results[meta.id] = {
              suiteId: meta.id,
              status: "partial",
              label: "PARTIAL / SETTING MISMATCH",
              fileCount: matched.length,
              totalBytes,
              detail: `AIPerf export found (${Math.round(exportJson.size / 1024)} KB), missing sweep points: ${missing}.`
            };
            continue;
          }
        }
        results[meta.id] = {
          suiteId: meta.id,
          status: "verified",
          label: "VERIFIED COMPLETE",
          fileCount: matched.length,
          totalBytes,
          detail: `profile_export_aiperf.json verified (${Math.round(exportJson.size / 1024 * 10) / 10} KB).`
        };
      } else {
        // llmperf or agentperf
        const jsonFile = matched.find((m) => m.name.toLowerCase().endsWith(".json") && m.size > 512);
        if (!jsonFile || totalBytes <= 1024) {
          results[meta.id] = {
            suiteId: meta.id,
            status: "stub",
            label: "INCOMPLETE STUB / FAILED",
            fileCount: matched.length,
            totalBytes,
            detail: `Directory present (${matched.length} files, ${totalBytes} B) without valid non-stub JSON metrics.`
          };
          continue;
        }
        results[meta.id] = {
          suiteId: meta.id,
          status: "verified",
          label: "VERIFIED COMPLETE",
          fileCount: matched.length,
          totalBytes,
          detail: `Verified ${matched.length} output files including ${jsonFile.name} (${Math.round(totalBytes / 1024 * 10) / 10} KB).`
        };
      }
    }

    return results;
  }

  // ---------- Result File Parser (for 03 Results & Charts) ----------
  function inferMetaFromPath(name) {
    const lower = name.toLowerCase();
    let gpuLabel = "Custom GPU";
    if (lower.includes("dgx") || lower.includes("spark")) gpuLabel = "DGX Spark (CUDA)";
    else if (lower.includes("5090")) gpuLabel = "RTX 5090 (CUDA)";
    else if (lower.includes("9700") || lower.includes("vulkan")) gpuLabel = "Radeon AI Pro R9700 (Vulkan)";
    else if (lower.includes("rocm") || lower.includes("hip")) gpuLabel = "Radeon AI Pro (ROCm)";

    let modelLabel = "Custom Model";
    if (lower.includes("38") || lower.includes("3.8")) modelLabel = "Qwen3.8-27B (Dense)";
    else if (lower.includes("36") || lower.includes("3.6")) modelLabel = "Qwen3.6-35B-A3B (MoE)";
    else if (lower.includes("nemotron")) modelLabel = "Nemotron-3";
    else if (lower.includes("gemma")) modelLabel = "Gemma-4-31B";

    return { gpuLabel, modelLabel };
  }

  function parseResultFile(fileName, content) {
    const meta = inferMetaFromPath(fileName);
    const lower = fileName.toLowerCase();

    if (lower.endsWith(".md") && lower.includes("llama_benchy")) {
      const lines = content.split(/\r?\n/).filter((l) => l.includes("|") && /\d+\.\d+/.test(l));
      let depth0Tg = 0;
      let depth4096Tg = 0;
      lines.forEach((l) => {
        const nums = l.match(/\d+(?:\.\d+)?/g);
        if (nums && nums.length >= 2) {
          const val = parseFloat(nums[nums.length - 1]);
          if (l.includes("4096")) depth4096Tg = val;
          else if (!depth0Tg) depth0Tg = val;
        }
      });
      const degradationPct = depth0Tg > 0 && depth4096Tg > 0
        ? Math.round(((depth0Tg - depth4096Tg) / depth0Tg) * 1000) / 10
        : 0;
      return {
        id: "parsed-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
        isSample: false,
        sourceFile: fileName,
        gpuLabel: meta.gpuLabel,
        modelLabel: meta.modelLabel,
        suiteType: "llama_benchy",
        metrics: { depth0Tg, depth4096Tg, degradationPct }
      };
    }

    if (lower.endsWith(".md")) {
      const rows = content.split(/\r?\n/).filter((l) => l.includes("|") && /\d+\.\d+/.test(l));
      let pp512 = 0, pp2048 = 0, tg128 = 0, tg512 = 0;
      rows.forEach((r) => {
        const nums = r.match(/\d+\.\d+/g);
        const last = nums && nums.length ? parseFloat(nums[nums.length - 1]) : 0;
        if (/\bpp512\b/i.test(r)) pp512 = last;
        else if (/\bpp2048\b/i.test(r)) pp2048 = last;
        else if (/\btg128\b/i.test(r)) tg128 = last;
        else if (/\btg512\b/i.test(r)) tg512 = last;
      });
      return {
        id: "parsed-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
        isSample: false,
        sourceFile: fileName,
        gpuLabel: meta.gpuLabel,
        modelLabel: meta.modelLabel,
        suiteType: "llama_bench",
        metrics: { pp512, pp2048, tg128, tg512 }
      };
    }

    if (lower.endsWith(".json")) {
      try {
        const j = JSON.parse(content);
        if (lower.includes("speedbench") || Array.isArray(j.results) || j.results || j.categories) {
          const cats = j.categories || {};
          const catBuckets = { coding: [], reasoning: [], writing: [], math: [], all: [] };
          if (Array.isArray(j.results)) {
            j.results.forEach((item) => {
              if (!item || typeof item !== "object") return;
              const catName = String(item.category || item.task || item.domain || "").toLowerCase();
              const tps = Number(
                item.tg_tps ??
                item.decode_tps ??
                item.tps ??
                item.tokens_per_second ??
                item.speed ??
                (item.eval_tokens && item.eval_time ? item.eval_tokens / item.eval_time : 0)
              ) || 0;
              if (tps > 0) {
                catBuckets.all.push(tps);
                if (catName.includes("cod")) catBuckets.coding.push(tps);
                else if (catName.includes("reason")) catBuckets.reasoning.push(tps);
                else if (catName.includes("writ") || catName.includes("rag") || catName.includes("role")) catBuckets.writing.push(tps);
                else if (catName.includes("math")) catBuckets.math.push(tps);
              }
            });
          }
          const avg = (arr) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0);
          const coding = Number(cats.coding?.tg_tps || j.coding || avg(catBuckets.coding) || 0);
          const reasoning = Number(cats.reasoning?.tg_tps || j.reasoning || avg(catBuckets.reasoning) || 0);
          const writing = Number(cats.writing?.tg_tps || j.writing || avg(catBuckets.writing) || 0);
          const math = Number(cats.math?.tg_tps || j.math || avg(catBuckets.math) || 0);
          const overall = Number(j.overall_tps || j.mean_tps || avg(catBuckets.all) || avg([coding, reasoning, writing, math].filter(Boolean)) || 0);
          return {
            id: "parsed-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
            isSample: false,
            sourceFile: fileName,
            gpuLabel: meta.gpuLabel,
            modelLabel: meta.modelLabel,
            suiteType: "speed_bench",
            metrics: { coding, reasoning, writing, math, overall }
          };
        }
        if (lower.includes("aiperf")) {
          return {
            id: "parsed-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
            isSample: false,
            sourceFile: fileName,
            gpuLabel: meta.gpuLabel,
            modelLabel: meta.modelLabel,
            suiteType: "aiperf_sweep",
            metrics: {
              ttft16k: Number(j.ttft_16k || j.time_to_first_token?.avg || 0),
              ttft32k: Number(j.ttft_32k || 0),
              ttft64k: Number(j.ttft_64k || 0),
              tps16k: Number(j.tps_16k || j.output_token_throughput?.avg || 0),
              tps32k: Number(j.tps_32k || 0),
              tps64k: Number(j.tps_64k || 0)
            }
          };
        }
        return {
          id: "parsed-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
          isSample: false,
          sourceFile: fileName,
          gpuLabel: meta.gpuLabel,
          modelLabel: meta.modelLabel,
          suiteType: "llmperf",
          metrics: {
            ttftMs: Number(j.results_ttft_s_mean ? j.results_ttft_s_mean * 1000 : (j.ttft_ms || 0)),
            itlMs: Number(j.results_inter_token_latency_s_mean ? j.results_inter_token_latency_s_mean * 1000 : (j.itl_ms || 0)),
            reqPerMin: Number(j.results_num_completed_requests_per_min || j.req_per_min || 0),
            totalTps: Number(j.results_mean_output_throughput_token_per_s || j.total_tps || 0)
          }
        };
      } catch (_) {
        return null;
      }
    }
    return null;
  }

  function exportComparisonMarkdown(records) {
    const lines = [
      "# AI Benchmate — Comparison Summary",
      "",
      "| Source | GPU / Backend | Model | Suite | Key Metrics |",
      "| :--- | :--- | :--- | :--- | :--- |"
    ];
    records.forEach((r) => {
      const mStr = Object.entries(r.metrics || {}).map(([k, v]) => `${k}: ${v}`).join(", ");
      lines.push(`| ${r.sourceFile} | ${r.gpuLabel} | ${r.modelLabel} | ${r.suiteType} | ${mStr} |`);
    });
    return lines.join("\n");
  }

  function exportComparisonCsv(records) {
    const rows = ["Source,GPU,Model,Suite,MetricsJSON"];
    records.forEach((r) => {
      const esc = (v) => `"${String(v || "").replace(/"/g, '""')}"`;
      rows.push([esc(r.sourceFile), esc(r.gpuLabel), esc(r.modelLabel), esc(r.suiteType), esc(JSON.stringify(r.metrics || {}))].join(","));
    });
    return rows.join("\n");
  }

  // ---------- SSH Remote & DGX Spark Hermes Commands (Tabs 04 & 05) ----------
  function buildSshCommands(state) {
    const ssh = state.ssh;
    const hostTarget = `${ssh.user || "$USER"}@${ssh.host || "192.168.50.55"}`;
    const portFlag = Number(ssh.port) !== 22 ? `-p ${ssh.port} ` : "";
    const scpPortFlag = Number(ssh.port) !== 22 ? `-P ${ssh.port} ` : "";
    const srvCmd = buildServerCommand(state, "aiperf_sweep").replace(/\n/g, "\n  ");
    const cliCmd = buildSuiteClientCommand(state, "aiperf_sweep").replace(/\n/g, "\n  ");

    const tmuxLaunch = [
      `# Run persistent benchmark session in tmux on remote Linux host`,
      `tmux kill-session -t ${ssh.tmuxSession || "ai_bench"} 2>/dev/null || true`,
      `tmux new-session -d -s ${ssh.tmuxSession || "ai_bench"}`,
      `tmux send-keys -t ${ssh.tmuxSession || "ai_bench"} 'mkdir -p "${ssh.remoteResultsDir}"' C-m`,
      `# Pane 0: Server | Split Pane 1: Client`,
      `tmux split-window -h -t ${ssh.tmuxSession || "ai_bench"}`,
      `tmux attach -t ${ssh.tmuxSession || "ai_bench"}`
    ].join("\n");

    const psTrigger = [
      `# One-Line Windows PowerShell SSH Trigger`,
      `ssh ${portFlag}-t ${hostTarget} "tmux new-session -A -s ${ssh.tmuxSession || "ai_bench"}"`
    ].join("\n");

    const scpPull = [
      `# Pull Remote Results Directly to Local Centralized Results Folder`,
      `New-Item -ItemType Directory -Force -Path "${ssh.localPullDir}" | Out-Null`,
      `scp ${scpPortFlag}-r "${hostTarget}:${ssh.remoteResultsDir}/*" "${ssh.localPullDir}\\"`
    ].join("\n");

    const vramSweep = [
      `# Pre-Benchmark VRAM Sweep (Terminates Ollama systemd/tmux, LM Studio, ComfyUI, vLLM & llama-server)`,
      `sudo systemctl stop ollama 2>/dev/null || true`,
      `"$HOME/.lmstudio/bin/lms" server stop 2>/dev/null || true`,
      `pkill -u "$USER" -9 -f "llama-server" 2>/dev/null || true`,
      `pkill -u "$USER" -9 -f "ollama serve" 2>/dev/null || true`,
      `pkill -u "$USER" -9 -f "ComfyUI" 2>/dev/null || true`,
      `pkill -u "$USER" -9 -f "lm-studio" 2>/dev/null || true`,
      `pkill -u "$USER" -9 -f "vllm serve" 2>/dev/null || true`,
      `tmux kill-session -t ollama 2>/dev/null || true`,
      `tmux kill-session -t comfyui 2>/dev/null || true`,
      `tmux kill-session -t vllm_nemotron 2>/dev/null || true`,
      `fuser -k -9 8080/tcp 11434/tcp 1234/tcp 8000/tcp 8189/tcp 2>/dev/null || true`,
      `nvidia-smi`
    ].join("\n");

    const startAiRestore = [
      `# Post-Benchmark Restore: Bring DGX Spark AI Stack Back Online for Hermes`,
      `tmux kill-session -t ollama 2>/dev/null; tmux new-session -d -s ollama "bash -c 'OLLAMA_HOST=0.0.0.0:11434 OLLAMA_MODELS=$HOME/models ollama serve'"`,
      `$HOME/.lmstudio/bin/lms server start --bind 0.0.0.0 --port 1234 --cors`,
      `tmux kill-session -t comfyui 2>/dev/null; tmux new-session -d -s comfyui "bash -c 'source $HOME/ComfyUI/venv/bin/activate && python $HOME/ComfyUI/main.py --listen 0.0.0.0 --port 8189'"`,
      ssh.includeVllmInStartAi
        ? `tmux kill-session -t vllm_nemotron 2>/dev/null; tmux new-session -d -s vllm_nemotron "bash -c 'vllm serve ${ssh.vllmModel} --host 0.0.0.0 --port 8000 --gpu-memory-utilization ${ssh.vllmGpuUtil} --trust-remote-code --dtype auto'"`
        : `# (vLLM restore disabled)`,
      `sleep 3 && ss -tulpn | grep -E '11434|1234|8000|8189'`
    ].join("\n");

    const hermesYaml = [
      `# Hermes Agent Multi-Instance Routing (${ssh.hermesServerIp || "192.168.50.55"})`,
      `agent_coder:`,
      `  base_url: "http://${ssh.hermesServerIp || "192.168.50.55"}:11434/v1"`,
      `  api_key: "ollama"`,
      `  model: "${state.model.alias || "Qwen3.8-27B"}"`,
      `agent_orchestrator:`,
      `  base_url: "http://${ssh.hermesServerIp || "192.168.50.55"}:8000/v1"`,
      `  api_key: "empty"`,
      `  model: "${ssh.vllmModel}"`
    ].join("\n");

    return { tmuxLaunch, psTrigger, scpPull, vramSweep, startAiRestore, hermesYaml, srvCmd, cliCmd };
  }

  function buildSetupCards(state) {
    const profile = global.BenchmateData.HARDWARE_PROFILES[state.hardware.profileId];
    const isWin = profile.os === "windows";
    const benchRoot = state.hardware.benchRoot || profile.defaultBenchRoot;
    const binDir = state.hardware.binDir || profile.defaultBinDir;
    const repoDir = state.hardware.repoDir || profile.defaultRepoDir;
    const modelPath = state.model.fullPath;
    const modelDir = state.model.baseDir || profile.defaultModelsDir;
    const port = state.hardware.port || 8080;

    const cards = [];

    if (isWin) {
      cards.push({
        id: "setup_verify",
        title: `01 · Pre-flight Check: Verify GPU, Git, Binaries, Model .gguf, Python 3.12 & Venvs (${profile.shortName})`,
        badge: "PRE-FLIGHT",
        cmd: [
          `# Pre-flight Verification — ${profile.name}`,
          `$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User") + ";C:\\Program Files\\Git\\cmd;C:\\Program Files (x86)\\Git\\cmd;$env:LOCALAPPDATA\\Programs\\Git\\cmd"`,
          `Write-Host "=== 1. GPU Driver Check ==="`,
          profile.id === "amd_win_x64"
            ? `if (Get-Command amd-smi -ErrorAction SilentlyContinue) { amd-smi } else { Write-Host "[INFO] amd-smi CLI not in PATH (check Task Manager GPU tab)" }`
            : `if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) { nvidia-smi } else { Write-Host "[MISSING] nvidia-smi not found in PATH" }`,
          `Write-Host "=== 2. Git, Binaries & SPEED-Bench Check ==="`,
          `if (Get-Command git -ErrorAction SilentlyContinue) { Write-Host "[OK] $(git --version)" } else { Write-Host "[MISSING] git (Run Card 02 to install automatically)" }`,
          `@("${binDir}\\llama-bench.exe", "${binDir}\\llama-server.exe", "${repoDir}\\tools\\server\\bench\\speed-bench\\speed_bench.py") | ForEach-Object { if (Test-Path $_) { Write-Host "[OK] $_" } else { Write-Host "[MISSING] $_ (Run Card 02 to install automatically)" } }`,
          `Write-Host "=== 3. Active GGUF Model & Models Directory ==="`,
          `if (Test-Path "${modelPath}") { Write-Host "[OK] Active model found: ${modelPath}" } else { Write-Host "[MISSING] Active model not found: ${modelPath} (Run Card 04 to download)" }`,
          `Get-ChildItem -Path "${modelDir}" -Filter "*.gguf" -Recurse -ErrorAction SilentlyContinue | ForEach-Object { Write-Host ("  {0} ({1} GB)" -f $_.FullName, [math]::Round($_.Length / 1GB, 2)) }`,
          `Write-Host "=== 4. Installed Python Versions, Venvs & Packages ==="`,
          `if (Get-Command py -ErrorAction SilentlyContinue) { py -0p } elseif (Get-Command python -ErrorAction SilentlyContinue) { python --version } else { Write-Host "[MISSING] Python 3.12 not installed yet (Run Card 03 to install automatically)" }`,
          `if (Test-Path "${benchRoot}\\.venv-aiperf\\Scripts\\python.exe") {`,
          `  & "${benchRoot}\\.venv-aiperf\\Scripts\\python.exe" -c "import sys, importlib.util; print('venv Python:', sys.version.split()[0]); [print('[OK]' if importlib.util.find_spec(m) else '[MISSING]', m) for m in ('llama_benchy','aiperf','ray')]"`,
          `} else { Write-Host "[MISSING] ${benchRoot}\\.venv-aiperf (Run Card 03 to create)" }`,
          `if (Test-Path "${benchRoot}\\llmperf\\token_benchmark_ray.py") { Write-Host "[OK] token_benchmark_ray.py" } else { Write-Host "[MISSING] llmperf repo (Run Card 03 to install)" }`,
          `if (Test-Path "${benchRoot}\\.venv-agentperf\\Scripts\\agentperf-local.exe") { Write-Host "[OK] agentperf-local" } else { Write-Host "[MISSING] ${benchRoot}\\.venv-agentperf (Run Card 03 to create)" }`,
          `Write-Host "=== 5. Port ${port} Availability ==="`,
          `Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue`
        ].join("\n")
      });
    } else {
      cards.push({
        id: "setup_verify",
        title: `01 · Pre-flight Check: Verify GPU, Git, Binaries, Model .gguf, Python 3.12 & Venvs (${profile.shortName})`,
        badge: "PRE-FLIGHT",
        cmd: [
          `# Pre-flight Verification — ${profile.name}`,
          `export PATH="/usr/local/cuda/bin:$HOME/.local/bin:$PATH"`,
          `echo "=== 1. GPU Driver Check ===" && nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv,noheader`,
          `echo "=== 2. Git, Binaries & SPEED-Bench Check ==="`,
          `command -v git >/dev/null 2>&1 && echo "[OK] $(git --version)" || echo "[MISSING] git (Run Card 02)"`,
          `for f in "${binDir}/llama-bench" "${binDir}/llama-server" "${repoDir}/tools/server/bench/speed-bench/speed_bench.py"; do test -e "$f" && echo "[OK] $f" || echo "[MISSING] $f (Run Card 02)"; done`,
          `echo "=== 3. Active GGUF Model & Models Directory ==="`,
          `test -f "${modelPath}" && ls -lh "${modelPath}" || echo "[MISSING] Active model not found: ${modelPath} (Run Card 04)"`,
          `find "${modelDir}" -maxdepth 3 -name "*.gguf" -exec ls -lh {} + 2>/dev/null || true`,
          `echo "=== 4. Python, Venvs & Packages ==="`,
          `python3 --version`,
          `if [ ! -e "${benchRoot}/.venv-aiperf" ] && [ -d "$HOME/.venv-aiperf" ]; then ln -sfn "$HOME/.venv-aiperf" "${benchRoot}/.venv-aiperf"; fi`,
          `if [ -x "${benchRoot}/.venv-aiperf/bin/python3" ]; then "${benchRoot}/.venv-aiperf/bin/python3" -c "import importlib.util; [print('[OK]' if importlib.util.find_spec(m) else '[MISSING]', m) for m in ('llama_benchy','aiperf','ray')]"; else echo "[MISSING] ${benchRoot}/.venv-aiperf (Run Card 03)"; fi`,
          `test -f "${benchRoot}/llmperf/token_benchmark_ray.py" && echo "[OK] token_benchmark_ray.py" || echo "[MISSING] llmperf repo (Run Card 03)"`,
          `test -x "${benchRoot}/.venv-agentperf/bin/agentperf-local" && echo "[OK] agentperf-local" || echo "[MISSING] ${benchRoot}/.venv-agentperf (Run Card 03)"`,
          `echo "=== 5. Port ${port} Availability ==="`,
          `ss -tulpn | grep ":${port} " || echo "[OK] Port ${port} is free"`
        ].join("\n")
      });
    }

    if (profile.id === "dgx_spark_linux_arm64") {
      cards.push({
        id: "setup_llamacpp",
        title: "02 · Install / Build llama.cpp CUDA Binaries & SPEED-Bench Repo (DGX Spark ARM64)",
        badge: "LLAMA.CPP",
        cmd: [
          `export PATH="/usr/local/cuda/bin:$HOME/.local/bin:$PATH"`,
          `sudo apt update && sudo apt install -y build-essential cmake git curl wget libcurl4-openssl-dev`,
          `if [ ! -d "${repoDir}/.git" ]; then rm -rf "${repoDir}"; git clone --depth 1 https://github.com/ggml-org/llama.cpp.git "${repoDir}"; fi`,
          `cd "${repoDir}"`,
          `cmake -B build -DGGML_CUDA=ON`,
          `cmake --build build --config Release -j "$(nproc)"`,
          `ls -lh "${binDir}/llama-bench" "${binDir}/llama-server" "${repoDir}/tools/server/bench/speed-bench/speed_bench.py"`
        ].join("\n")
      });
    } else {
      const assetRegex =
        profile.id === "rtx_spark_win_arm64"
          ? "^(llama-.*-bin-win-cuda-.*-arm64|cudart-llama-bin-win-cuda-.*-arm64)\\.zip$"
          : profile.id === "nvidia_win_x64"
            ? "^(llama-.*-bin-win-cuda-13.*-x64|cudart-llama-bin-win-cuda-13.*-x64)\\.zip$"
            : state.hardware.amdBackend === "rocm"
              ? "^llama-.*-bin-win-rocm-.*-x64\\.zip$"
              : "^llama-.*-bin-win-vulkan-x64\\.zip$";
      const vcRedistCmd =
        profile.id === "rtx_spark_win_arm64"
          ? `winget install --id Microsoft.VCRedist.2015+.arm64 -e --source winget --accept-package-agreements --accept-source-agreements 2>$null; winget install --id Microsoft.VCRedist.2015+.x64 -e --source winget --accept-package-agreements --accept-source-agreements 2>$null`
          : `winget install --id Microsoft.VCRedist.2015+.x64 -e --source winget --accept-package-agreements --accept-source-agreements 2>$null`;
      cards.push({
        id: "setup_llamacpp",
        title: `02 · Install Git & VC++ Runtime, Clone llama.cpp Repo & Download Pre-Built Binaries (${profile.shortName})`,
        badge: "LLAMA.CPP",
        cmd: [
          `# 1. Refresh PATH & automatically install Git + VC++ Runtime via winget if missing`,
          `$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User") + ";C:\\Program Files\\Git\\cmd;C:\\Program Files (x86)\\Git\\cmd;$env:LOCALAPPDATA\\Programs\\Git\\cmd"`,
          `if (-not (Get-Command git -ErrorAction SilentlyContinue)) {`,
          `  Write-Host "[+] Installing Git via winget..."`,
          `  winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements`,
          `  $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User") + ";C:\\Program Files\\Git\\cmd;C:\\Program Files (x86)\\Git\\cmd;$env:LOCALAPPDATA\\Programs\\Git\\cmd"`,
          `}`,
          `if (-not (Test-Path "$env:SystemRoot\\System32\\vcruntime140.dll")) {`,
          `  Write-Host "[+] Installing Microsoft VC++ Redistributable..."`,
          `  ${vcRedistCmd}`,
          `}`,
          `# 2. Clone llama.cpp repository (with automatic HTTPS ZIP fallback if git is unavailable) for speed_bench.py`,
          `if (-not (Test-Path "${repoDir}\\tools\\server\\bench\\speed-bench\\speed_bench.py")) {`,
          `  if (Get-Command git -ErrorAction SilentlyContinue) {`,
          `    git clone --depth 1 https://github.com/ggml-org/llama.cpp.git "${repoDir}"`,
          `  } else {`,
          `    Write-Host "[+] Downloading llama.cpp repository archive via HTTPS..."`,
          `    curl.exe -L "https://github.com/ggml-org/llama.cpp/archive/refs/heads/master.zip" -o "$env:TEMP\\llamacpp_repo.zip"`,
          `    Remove-Item -Recurse -Force "$env:TEMP\\llamacpp_repo_ext" -ErrorAction SilentlyContinue`,
          `    Expand-Archive -Path "$env:TEMP\\llamacpp_repo.zip" -DestinationPath "$env:TEMP\\llamacpp_repo_ext" -Force`,
          `    New-Item -ItemType Directory -Force -Path "${repoDir}" | Out-Null`,
          `    Copy-Item -Path "$env:TEMP\\llamacpp_repo_ext\\llama.cpp-master\\*" -Destination "${repoDir}" -Recurse -Force`,
          `  }`,
          `}`,
          `# 3. Automatically download & extract official pre-built llama-bench.exe, llama-server.exe & runtime DLLs`,
          `New-Item -ItemType Directory -Force -Path "${binDir}" | Out-Null`,
          `if (-not ((Test-Path "${binDir}\\llama-bench.exe") -and (Test-Path "${binDir}\\llama-server.exe"))) {`,
          `  Write-Host "[+] Downloading latest official llama.cpp release binaries for ${profile.shortName}..."`,
          `  $rel = (Invoke-RestMethod -Uri "https://api.github.com/repos/ggml-org/llama.cpp/releases?per_page=1")[0]`,
          `  $assets = $rel.assets | Where-Object { $_.name -match "${assetRegex}" }`,
          `  foreach ($a in $assets) {`,
          `    $zipFile = "$env:TEMP\\$($a.name)"`,
          `    $extDir = "$env:TEMP\\llama_ext_$($a.id)"`,
          `    Write-Host "[+] Fetching $($a.name) ($([math]::Round($a.size / 1MB, 1)) MB)..."`,
          `    curl.exe -L "$($a.browser_download_url)" -o "$zipFile"`,
          `    Remove-Item -Recurse -Force "$extDir" -ErrorAction SilentlyContinue`,
          `    Expand-Archive -Path "$zipFile" -DestinationPath "$extDir" -Force`,
          `    Get-ChildItem -Path "$extDir" -Recurse -File | Copy-Item -Destination "${binDir}" -Force`,
          `  }`,
          `}`,
          `@("${binDir}\\llama-bench.exe", "${binDir}\\llama-server.exe", "${repoDir}\\tools\\server\\bench\\speed-bench\\speed_bench.py") | ForEach-Object {`,
          `  if (Test-Path $_) { Write-Host "[READY] $_" } else { Write-Host "[MISSING] $_" }`,
          `}`
        ].join("\n")
      });
    }

    if (profile.id === "dgx_spark_linux_arm64") {
      const aipPkg = state.hardware.nonSudoSetup ? "aiperf" : '"aiperf[tdigest]"';
      cards.push({
        id: "setup_env",
        title: "03 · Install Python Venvs & Benchmark Dependencies (DGX Spark ARM64)",
        badge: "AARCH64 SETUP",
        cmd: [
          `export PATH="$HOME/.local/bin:$PATH"`,
          state.hardware.nonSudoSetup
            ? `# Non-sudo fallback (skips crick C extension compilation)`
            : `sudo apt update && sudo apt install -y python3-dev python3.12-dev python3-venv python3-pip build-essential cmake git curl wget`,
          `mkdir -p "${benchRoot}"`,
          `cd "${benchRoot}"`,
          `python3 -m venv "${benchRoot}/.venv-aiperf"`,
          `source "${benchRoot}/.venv-aiperf/bin/activate"`,
          `pip install --upgrade pip setuptools wheel requests tqdm tabulate huggingface_hub`,
          `if [ ! -f "${benchRoot}/llmperf/token_benchmark_ray.py" ]; then rm -rf "${benchRoot}/llmperf"; git clone https://github.com/ray-project/llmperf.git "${benchRoot}/llmperf"; fi`,
          `if [ -f "${benchRoot}/llmperf/pyproject.toml" ]; then sed -i 's/<3.11,\\s*//g; s/,\\s*<3.11//g' "${benchRoot}/llmperf/pyproject.toml"; fi`,
          `if [ -f "${benchRoot}/llmperf/setup.py" ]; then sed -i 's/<3.11,\\s*//g; s/,\\s*<3.11//g' "${benchRoot}/llmperf/setup.py"; fi`,
          `pip install -e "${benchRoot}/llmperf"`,
          `pip install llama-benchy`,
          `pip install ${aipPkg} || pip install aiperf`,
          `python3 -m venv "${benchRoot}/.venv-agentperf"`,
          `"${benchRoot}/.venv-agentperf/bin/pip" install --upgrade pip setuptools wheel aa-agentperf-local`
        ].join("\n")
      });
    } else if (profile.id === "rtx_spark_win_arm64") {
      const aipPkg = state.hardware.rtxArmTdigestCompile ? '"aiperf[tdigest]"' : "aiperf";
      cards.push({
        id: "setup_env",
        title: "03 · Install Python 3.12, Venvs & Benchmark Dependencies (Windows ARM64)",
        badge: "WIN ARM64 SETUP",
        cmd: [
          `# 1. Refresh PATH & install Git + Python 3.12 x64 (required on Win-ARM64 so ray/llmperf & aiperf pre-built wheels install without C++ compiler errors)`,
          `$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User") + ";C:\\Program Files\\Git\\cmd;C:\\Program Files (x86)\\Git\\cmd;$env:LOCALAPPDATA\\Programs\\Git\\cmd"`,
          `if (-not (Get-Command git -ErrorAction SilentlyContinue)) {`,
          `  winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements`,
          `  $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User") + ";C:\\Program Files\\Git\\cmd;C:\\Program Files (x86)\\Git\\cmd;$env:LOCALAPPDATA\\Programs\\Git\\cmd"`,
          `}`,
          `$pyPaths = @("$env:LOCALAPPDATA\\Programs\\Python\\Python312\\python.exe", "C:\\Program Files\\Python312\\python.exe", "$env:LOCALAPPDATA\\Programs\\Python\\Python311\\python.exe", "C:\\Program Files\\Python311\\python.exe")`,
          `$foundPy = $pyPaths | Where-Object { Test-Path $_ } | Select-Object -First 1`,
          `if (-not $foundPy) {`,
          `  Write-Host "[+] Installing Python 3.12 (x64) via winget..."`,
          `  winget install -e --id Python.Python.3.12 --architecture x64 --source winget --accept-package-agreements --accept-source-agreements`,
          `  $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User") + ";C:\\Program Files\\Git\\cmd;C:\\Program Files (x86)\\Git\\cmd;$env:LOCALAPPDATA\\Programs\\Git\\cmd"`,
          `  $foundPy = $pyPaths | Where-Object { Test-Path $_ } | Select-Object -First 1`,
          `}`,
          `New-Item -ItemType Directory -Force -Path "${benchRoot}" | Out-Null`,
          `Set-Location "${benchRoot}"`,
          `if ($foundPy) { & "$foundPy" -m venv "${benchRoot}\\.venv-aiperf" } elseif (Get-Command py -ErrorAction SilentlyContinue) { py -3.12 -m venv "${benchRoot}\\.venv-aiperf" } else { python -m venv "${benchRoot}\\.venv-aiperf" }`,
          `$venvPy = "${benchRoot}\\.venv-aiperf\\Scripts\\python.exe"`,
          `& "$venvPy" -m pip install --upgrade pip setuptools wheel requests tqdm tabulate huggingface_hub`,
          `if (-not (Test-Path "${benchRoot}\\llmperf\\token_benchmark_ray.py")) {`,
          `  if (Get-Command git -ErrorAction SilentlyContinue) {`,
          `    git clone https://github.com/ray-project/llmperf.git "${benchRoot}\\llmperf"`,
          `  } else {`,
          `    curl.exe -L "https://github.com/ray-project/llmperf/archive/refs/heads/main.zip" -o "$env:TEMP\\llmperf.zip"`,
          `    Remove-Item -Recurse -Force "$env:TEMP\\llmperf_ext" -ErrorAction SilentlyContinue`,
          `    Expand-Archive -Path "$env:TEMP\\llmperf.zip" -DestinationPath "$env:TEMP\\llmperf_ext" -Force`,
          `    New-Item -ItemType Directory -Force -Path "${benchRoot}\\llmperf" | Out-Null`,
          `    Copy-Item -Path "$env:TEMP\\llmperf_ext\\llmperf-main\\*" -Destination "${benchRoot}\\llmperf" -Recurse -Force`,
          `  }`,
          `}`,
          `if (Test-Path "${benchRoot}\\llmperf\\pyproject.toml") { (Get-Content "${benchRoot}\\llmperf\\pyproject.toml") -replace '<3\\.11,?\\s*|,\\s*<3\\.11', '' | Set-Content "${benchRoot}\\llmperf\\pyproject.toml" }`,
          `if (Test-Path "${benchRoot}\\llmperf\\setup.py") { (Get-Content "${benchRoot}\\llmperf\\setup.py") -replace '<3\\.11,?\\s*|,\\s*<3\\.11', '' | Set-Content "${benchRoot}\\llmperf\\setup.py" }`,
          `& "$venvPy" -m pip install -e "${benchRoot}\\llmperf"`,
          `& "$venvPy" -m pip install ${aipPkg} llama-benchy`,
          `if ($foundPy) { & "$foundPy" -m venv "${benchRoot}\\.venv-agentperf" } elseif (Get-Command py -ErrorAction SilentlyContinue) { py -3.12 -m venv "${benchRoot}\\.venv-agentperf" } else { python -m venv "${benchRoot}\\.venv-agentperf" }`,
          `& "${benchRoot}\\.venv-agentperf\\Scripts\\python.exe" -m pip install --upgrade pip setuptools wheel aa-agentperf-local`
        ].join("\n")
      });
    } else {
      cards.push({
        id: "setup_env",
        title: `03 · Install Python 3.12, Venvs & Benchmark Dependencies (${profile.shortName})`,
        badge: "WIN X64 SETUP",
        cmd: [
          `# 1. Refresh PATH & ensure Git + Python 3.12 are installed (ray/llmperf & aiperf require Python 3.11/3.12 wheels)`,
          `$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User") + ";C:\\Program Files\\Git\\cmd;C:\\Program Files (x86)\\Git\\cmd;$env:LOCALAPPDATA\\Programs\\Git\\cmd"`,
          `if (-not (Get-Command git -ErrorAction SilentlyContinue)) {`,
          `  winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements`,
          `  $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User") + ";C:\\Program Files\\Git\\cmd;C:\\Program Files (x86)\\Git\\cmd;$env:LOCALAPPDATA\\Programs\\Git\\cmd"`,
          `}`,
          `$pyPaths = @("$env:LOCALAPPDATA\\Programs\\Python\\Python312\\python.exe", "C:\\Program Files\\Python312\\python.exe", "$env:LOCALAPPDATA\\Programs\\Python\\Python311\\python.exe", "C:\\Program Files\\Python311\\python.exe")`,
          `$foundPy = $pyPaths | Where-Object { Test-Path $_ } | Select-Object -First 1`,
          `if (-not $foundPy) {`,
          `  Write-Host "[+] Installing Python 3.12 via winget..."`,
          `  winget install -e --id Python.Python.3.12 --source winget --accept-package-agreements --accept-source-agreements`,
          `  $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User") + ";C:\\Program Files\\Git\\cmd;C:\\Program Files (x86)\\Git\\cmd;$env:LOCALAPPDATA\\Programs\\Git\\cmd"`,
          `  $foundPy = $pyPaths | Where-Object { Test-Path $_ } | Select-Object -First 1`,
          `}`,
          `New-Item -ItemType Directory -Force -Path "${benchRoot}" | Out-Null`,
          `Set-Location "${benchRoot}"`,
          `if ($foundPy) { & "$foundPy" -m venv "${benchRoot}\\.venv-aiperf" } elseif (Get-Command py -ErrorAction SilentlyContinue) { py -3.12 -m venv "${benchRoot}\\.venv-aiperf" } else { python -m venv "${benchRoot}\\.venv-aiperf" }`,
          `$venvPy = "${benchRoot}\\.venv-aiperf\\Scripts\\python.exe"`,
          `& "$venvPy" -m pip install --upgrade pip setuptools wheel requests tqdm tabulate huggingface_hub`,
          `if (-not (Test-Path "${benchRoot}\\llmperf\\token_benchmark_ray.py")) {`,
          `  if (Get-Command git -ErrorAction SilentlyContinue) {`,
          `    git clone https://github.com/ray-project/llmperf.git "${benchRoot}\\llmperf"`,
          `  } else {`,
          `    curl.exe -L "https://github.com/ray-project/llmperf/archive/refs/heads/main.zip" -o "$env:TEMP\\llmperf.zip"`,
          `    Remove-Item -Recurse -Force "$env:TEMP\\llmperf_ext" -ErrorAction SilentlyContinue`,
          `    Expand-Archive -Path "$env:TEMP\\llmperf.zip" -DestinationPath "$env:TEMP\\llmperf_ext" -Force`,
          `    New-Item -ItemType Directory -Force -Path "${benchRoot}\\llmperf" | Out-Null`,
          `    Copy-Item -Path "$env:TEMP\\llmperf_ext\\llmperf-main\\*" -Destination "${benchRoot}\\llmperf" -Recurse -Force`,
          `  }`,
          `}`,
          `if (Test-Path "${benchRoot}\\llmperf\\pyproject.toml") { (Get-Content "${benchRoot}\\llmperf\\pyproject.toml") -replace '<3\\.11,?\\s*|,\\s*<3\\.11', '' | Set-Content "${benchRoot}\\llmperf\\pyproject.toml" }`,
          `if (Test-Path "${benchRoot}\\llmperf\\setup.py") { (Get-Content "${benchRoot}\\llmperf\\setup.py") -replace '<3\\.11,?\\s*|,\\s*<3\\.11', '' | Set-Content "${benchRoot}\\llmperf\\setup.py" }`,
          `& "$venvPy" -m pip install -e "${benchRoot}\\llmperf"`,
          `& "$venvPy" -m pip install "aiperf[tdigest]" llama-benchy`,
          `if ($foundPy) { & "$foundPy" -m venv "${benchRoot}\\.venv-agentperf" } elseif (Get-Command py -ErrorAction SilentlyContinue) { py -3.12 -m venv "${benchRoot}\\.venv-agentperf" } else { python -m venv "${benchRoot}\\.venv-agentperf" }`,
          `& "${benchRoot}\\.venv-agentperf\\Scripts\\python.exe" -m pip install --upgrade pip setuptools wheel aa-agentperf-local`
        ].join("\n")
      });
    }

    if (isWin) {
      cards.push({
        id: "setup_models",
        title: `04 · Download / Verify Benchmark GGUF Models (Qwen3.8-27B & Qwen3.6-35B-A3B)`,
        badge: "MODELS",
        cmd: [
          `# Conflict-free GGUF Model Downloader (uses huggingface_hub or direct resumable curl.exe fallback)`,
          `$q38Dir = "${modelDir}\\unsloth\\Qwen3.8-27B-GGUF"`,
          `$q36Dir = "${modelDir}\\unsloth\\Qwen3.6-35B-A3B-GGUF"`,
          `New-Item -ItemType Directory -Force -Path $q38Dir, $q36Dir | Out-Null`,
          `if (Test-Path "${benchRoot}\\.venv-aiperf\\Scripts\\python.exe") {`,
          `  & "${benchRoot}\\.venv-aiperf\\Scripts\\python.exe" -m pip install -U huggingface_hub`,
          `  & "${benchRoot}\\.venv-aiperf\\Scripts\\python.exe" -c "from huggingface_hub import hf_hub_download; hf_hub_download('unsloth/Qwen3.8-27B-GGUF', 'Qwen3.8-27B-UD-Q4_K_M.gguf', local_dir=r'$q38Dir'); hf_hub_download('unsloth/Qwen3.6-35B-A3B-GGUF', 'Qwen3.6-35B-A3B-UD-Q4_K_M.gguf', local_dir=r'$q36Dir')"`,
          `} else {`,
          `  curl.exe -L -C - "https://huggingface.co/unsloth/Qwen3.8-27B-GGUF/resolve/main/Qwen3.8-27B-UD-Q4_K_M.gguf" -o "$q38Dir\\Qwen3.8-27B-UD-Q4_K_M.gguf"`,
          `  curl.exe -L -C - "https://huggingface.co/unsloth/Qwen3.6-35B-A3B-GGUF/resolve/main/Qwen3.6-35B-A3B-UD-Q4_K_M.gguf" -o "$q36Dir\\Qwen3.6-35B-A3B-UD-Q4_K_M.gguf"`,
          `}`,
          `Get-ChildItem -Path "${modelDir}" -Filter "*.gguf" -Recurse | Select-Object FullName, @{Name="SizeGB";Expression={[math]::Round($_.Length/1GB,2)}}`
        ].join("\n")
      });
    } else {
      cards.push({
        id: "setup_models",
        title: `04 · Download / Verify Benchmark GGUF Models (Qwen3.8-27B & Qwen3.6-35B-A3B)`,
        badge: "MODELS",
        cmd: [
          `# Conflict-free GGUF Model Downloader (uses huggingface_hub or resumable wget fallback)`,
          `mkdir -p "${modelDir}"`,
          `if [ -x "${benchRoot}/.venv-aiperf/bin/python3" ]; then`,
          `  "${benchRoot}/.venv-aiperf/bin/pip" install -U huggingface_hub`,
          `  "${benchRoot}/.venv-aiperf/bin/python3" -c "from huggingface_hub import hf_hub_download; hf_hub_download('unsloth/Qwen3.8-27B-GGUF', 'Qwen3.8-27B-UD-Q4_K_M.gguf', local_dir='${modelDir}'); hf_hub_download('unsloth/Qwen3.6-35B-A3B-GGUF', 'Qwen3.6-35B-A3B-UD-Q4_K_M.gguf', local_dir='${modelDir}')"`,
          `else`,
          `  wget -c "https://huggingface.co/unsloth/Qwen3.8-27B-GGUF/resolve/main/Qwen3.8-27B-UD-Q4_K_M.gguf" -O "${modelDir}/Qwen3.8-27B-UD-Q4_K_M.gguf"`,
          `  wget -c "https://huggingface.co/unsloth/Qwen3.6-35B-A3B-GGUF/resolve/main/Qwen3.6-35B-A3B-UD-Q4_K_M.gguf" -O "${modelDir}/Qwen3.6-35B-A3B-UD-Q4_K_M.gguf"`,
          `fi`,
          `ls -lh "${modelDir}"/*.gguf`
        ].join("\n")
      });
    }

    if (isWin) {
      cards.push({
        id: "setup_cleanup",
        title: `05 · Free VRAM & Stop Running llama-server (${profile.shortName})`,
        badge: "VRAM SWEEP",
        cmd: [
          `Stop-Process -Name "llama-server" -Force -ErrorAction SilentlyContinue`,
          profile.id === "amd_win_x64" ? `amd-smi` : `nvidia-smi`
        ].join("\n")
      });
    } else {
      cards.push({
        id: "setup_cleanup",
        title: "05 · Free VRAM & Stop Background AI Services (DGX Spark)",
        badge: "VRAM SWEEP",
        cmd: buildSshCommands(state).vramSweep
      });
    }

    cards.push({
      id: "setup_fixes",
      title: "06 · Clear llama-benchy Gutenberg Cache (ZeroDivisionError Fix)",
      badge: "HOTFIX",
      cmd: isWin
        ? `Remove-Item -Recurse -Force "$env:USERPROFILE\\.cache\\llama-benchy" -ErrorAction SilentlyContinue`
        : `rm -rf ~/.cache/llama-benchy`
    });

    if (profile.id === "dgx_spark_linux_arm64") {
      cards.push({
        id: "setup_hermes_dgx",
        title: "07 · DGX Spark /models Symlink, Ollama Override & start-ai / stop-ai Scripts",
        badge: "DGX HOST",
        cmd: [
          `mkdir -p "$HOME/models" "$HOME/.lmstudio/.internal/temp" "$HOME/.cache/lm-studio" "$HOME/.local/bin"`,
          `chmod -R 755 "$HOME/.lmstudio/.internal"`,
          `if [ -d "$HOME/.lmstudio/models" ] && [ ! -L "$HOME/.lmstudio/models" ]; then cp -rn "$HOME/.lmstudio/models/"* "$HOME/models/" 2>/dev/null || true; rm -rf "$HOME/.lmstudio/models"; fi`,
          `if [ -d "$HOME/.cache/lm-studio/models" ] && [ ! -L "$HOME/.cache/lm-studio/models" ]; then cp -rn "$HOME/.cache/lm-studio/models/"* "$HOME/models/" 2>/dev/null || true; rm -rf "$HOME/.cache/lm-studio/models"; fi`,
          `ln -sfn "$HOME/models" "$HOME/.lmstudio/models"`,
          `ln -sfn "$HOME/models" "$HOME/.cache/lm-studio/models"`,
          ``,
          `sudo mkdir -p /etc/systemd/system/ollama.service.d`,
          `sudo bash -c "cat << EOF > /etc/systemd/system/ollama.service.d/override.conf`,
          `[Service]`,
          `User=\${SUDO_USER:-$USER}`,
          `Group=\${SUDO_USER:-$USER}`,
          `Environment=\\"OLLAMA_HOST=0.0.0.0:11434\\"`,
          `Environment=\\"OLLAMA_MODELS=$HOME/models\\"`,
          `EOF"`,
          `sudo systemctl daemon-reload && sudo systemctl restart ollama`,
          ``,
          `# Create sudo-free stop-ai shortcut`,
          `cat << 'EOF' > "$HOME/stop_ai_stack.sh"`,
          `#!/usr/bin/env bash`,
          `sudo systemctl stop ollama 2>/dev/null || true`,
          `"$HOME/.lmstudio/bin/lms" server stop 2>/dev/null || true`,
          `pkill -u "$USER" -9 -f "llama-server|ollama serve|ComfyUI|lm-studio|vllm serve" 2>/dev/null || true`,
          `tmux kill-session -t ollama 2>/dev/null || true`,
          `tmux kill-session -t comfyui 2>/dev/null || true`,
          `fuser -k -9 8080/tcp 11434/tcp 1234/tcp 8000/tcp 8189/tcp 2>/dev/null || true`,
          `EOF`,
          `chmod +x "$HOME/stop_ai_stack.sh" && ln -sf "$HOME/stop_ai_stack.sh" "$HOME/.local/bin/stop-ai"`
        ].join("\n")
      });
    }

    return cards;
  }

  // ---------- Lightweight Syntax Highlighter ----------
  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function highlightShell(code) {
    return String(code || "")
      .split("\n")
      .map((line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("#")) {
          return `<span class="tok-comment">${escapeHtml(line)}</span>`;
        }
        let html = escapeHtml(line);
        // Strings
        html = html.replace(/(&quot;[^&]*&quot;|"[^"]*"|'[^']*')/g, '<span class="tok-str">$1</span>');
        // CLI flags
        html = html.replace(/(^|\s)(--?[a-zA-Z0-9_-]+)/g, '$1<span class="tok-flag">$2</span>');
        // Leading commands
        html = html.replace(/^(\s*)(llama-bench|llama-server|\.\\llama-bench\.exe|\.\\llama-server\.exe|python3?|aiperf|agentperf-local|tmux|ssh|scp|sudo|pip|git|source|export|mkdir|rm|pkill|fuser|nvidia-smi|amd-smi|Set-Location|New-Item|Remove-Item|Stop-Process|Set-ExecutionPolicy|Tee-Object)\b/g, '$1<span class="tok-kw">$2</span>');
        return html;
      })
      .join("\n");
  }

  const FIT_CONTEXT_TIERS = [
    { ctx: 262144, label: "256K" },
    { ctx: 131072, label: "128K" },
    { ctx: 65536, label: "64K" },
    { ctx: 32768, label: "32K" },
    { ctx: 16384, label: "16K" },
    { ctx: 8192, label: "8K" },
    { ctx: 4096, label: "4K" }
  ];

  function computeModelFitRows(state) {
    const { QUICK_MODELS } = global.BenchmateData;
    const vramGb = Number(state.hardware.vramGb) || 64;
    const budgetGib = Math.round(vramGb * 0.9 * 10) / 10;
    const kvPrecision = (state.ui && state.ui.fitKv) || "fp16";
    const kvFactor = kvPrecision === "q4_0" ? 0.28 : kvPrecision === "q8_0" ? 0.53 : 1.0;

    const allModels = QUICK_MODELS.slice();
    (state.customModels || []).forEach((cm, idx) => {
      if (!allModels.some((m) => m.alias === cm.alias)) {
        allModels.push({
          id: "custom_" + idx,
          label: cm.alias || cm.slug || "Custom Model " + (idx + 1),
          quant: "Custom",
          kind: "dense",
          alias: cm.alias,
          slug: cm.slug,
          tokenizer: cm.tokenizer,
          weightGb: Number(cm.weightGb) || 15.8,
          paramsB: Number(cm.paramsB) || 27,
          archType: "dense",
          isCustom: true,
          customModel: cm
        });
      }
    });

    return allModels.map((m) => {
      const kind = m.kind || m.archType || "dense";
      const quant = m.quant || "Q4_K_M";
      const paramsB = Number(m.paramsB) || 27;
      const weightGb = Number(m.weightGb) || 15.8;
      const computeOverhead = 1.1;

      const kvRatePer1k = kind.indexOf("hybrid") !== -1
        ? 0.06 * Math.max(0.25, paramsB / 27)
        : kind === "moe"
          ? 0.10 * Math.max(0.25, paramsB / 30)
          : 0.15 * Math.max(0.2, paramsB / 27);

      let chosenTier = null;
      let chosenTotal = 0;

      for (let i = 0; i < FIT_CONTEXT_TIERS.length; i++) {
        const tier = FIT_CONTEXT_TIERS[i];
        const kvGb = (tier.ctx / 1024) * kvRatePer1k * kvFactor;
        const total = weightGb + kvGb + computeOverhead;
        if (total <= budgetGib) {
          chosenTier = tier;
          chosenTotal = total;
          break;
        }
      }

      if (!chosenTier) {
        const minTier = FIT_CONTEXT_TIERS[FIT_CONTEXT_TIERS.length - 1];
        const kvGb = (minTier.ctx / 1024) * kvRatePer1k * kvFactor;
        chosenTotal = weightGb + kvGb + computeOverhead;
        return {
          id: m.id,
          modelLabel: m.label,
          quant,
          kind,
          bestCtxLabel: "4K (Over)",
          totalGib: Number(chosenTotal.toFixed(2)),
          budgetGib,
          headroomGib: Number((budgetGib - chosenTotal).toFixed(2)),
          fits: false,
          rawModel: m
        };
      }

      return {
        id: m.id,
        modelLabel: m.label,
        quant,
        kind,
        bestCtxLabel: chosenTier.label,
        totalGib: Number(chosenTotal.toFixed(2)),
        budgetGib,
        headroomGib: Number((budgetGib - chosenTotal).toFixed(2)),
        fits: true,
        rawModel: m
      };
    });
  }

  function buildSelectedSuitesPreview(state) {
    const { HARDWARE_PROFILES, SUITE_METADATA } = global.BenchmateData;
    const mode = (state.ui && state.ui.previewMode) || "selected";
    const profile = HARDWARE_PROFILES[state.hardware.profileId];
    const noteLine = state.ui && state.ui.runNote ? "# Run Note: " + state.ui.runNote + "\n" : "";

    if (mode === "prereqs") {
      const cards = buildSetupCards(state);
      return (
        noteLine +
        "# Prerequisites & Environment Verification — " + profile.name + "\n\n" +
        cards.slice(0, 3).map((c) => "### " + c.title + "\n" + c.cmd).join("\n\n")
      );
    }

    if (mode === "outstanding") {
      return noteLine + buildAllInOnePlaybook(state, true);
    }

    const selectedArr = Array.isArray(state.ui && state.ui.selectedRunSuites)
      ? state.ui.selectedRunSuites
      : [];

    if (!selectedArr.length) {
      return "# Pick one or more suites above and click Preview commands (or click Run / Copy everything outstanding).";
    }

    const chunks = SUITE_METADATA.filter((m) => selectedArr.indexOf(m.id) !== -1).map((meta) => {
      const srv = buildServerCommand(state, meta.id);
      const cli = buildSuiteClientCommand(state, meta.id);
      return ["# === [" + meta.index + "] " + meta.title + " ===", srv ? srv + "\n" : "", cli].filter(Boolean).join("\n");
    });

    return (
      noteLine +
      "# Target: " + profile.name + " | Model: " + state.model.alias + " (" + state.naming.mode.toUpperCase() + " naming)\n\n" +
      chunks.join("\n\n")
    );
  }

  global.BenchmateEngine = {
    STORAGE_KEY,
    loadState,
    saveState,
    saveSnapshotIDB,
    loadSnapshotIDB,
    detectSep,
    joinPath,
    parseModelPath,
    formatShortToken,
    isSuiteCustomized,
    resolveNamingMode,
    getOutputTarget,
    buildServerCommand,
    buildSuiteClientCommand,
    buildAllInOnePlaybook,
    buildDeepAuditScript,
    evaluateGuardrails,
    auditFileList,
    parseResultFile,
    exportComparisonMarkdown,
    exportComparisonCsv,
    buildSshCommands,
    buildSetupCards,
    highlightShell,
    computeModelFitRows,
    buildSelectedSuitesPreview
  };
})(window);

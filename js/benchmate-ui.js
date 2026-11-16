/* ==========================================================================
   AI Benchmate — Portable Edition UI Renderer (Setup -> Benchmarks -> Results)
   Synced 1:1 with src/App.jsx
   ========================================================================== */
(function (global) {
  "use strict";

  const D = global.BenchmateData;
  const E = global.BenchmateEngine;
  if (!D || !E) return;

  let state = E.loadState();

  function esc(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function persistState() {
    E.saveState(state);
    try {
      E.saveSnapshotIDB("latest_state", state);
    } catch {
      /* ignore */
    }
  }

  function applyThemeAndStealth() {
    let resolved = state.ui.theme || "light";
    if (resolved === "system") {
      try {
        resolved =
          global.matchMedia && global.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
      } catch {
        resolved = "light";
      }
    }
    if (document.documentElement) {
      document.documentElement.setAttribute("data-theme", resolved);
    }
    if (document.body) {
      document.body.classList.toggle("pause-animations", Boolean(state.ui.pauseAnimations));
    }
  }

  function flashCopied(btn) {
    if (!btn) return;
    const prev = btn.textContent;
    btn.classList.add("copied");
    btn.textContent = "Copied";
    setTimeout(() => {
      btn.classList.remove("copied");
      btn.textContent = prev;
    }, 1300);
  }

  function copyText(text, btn) {
    const val = String(text || "");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(val)
        .then(() => flashCopied(btn))
        .catch(() => fallbackCopy(val, btn));
      return;
    }
    fallbackCopy(val, btn);
  }

  function fallbackCopy(val, btn) {
    try {
      const ta = document.createElement("textarea");
      ta.value = val;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      flashCopied(btn);
    } catch {
      /* ignore */
    }
  }

  function downloadText(filename, content) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function allModelChoices() {
    return [...D.QUICK_MODELS, ...(state.customModels || [])];
  }

  function applyQuickModel(modelObj) {
    const profile = D.HARDWARE_PROFILES[state.hardware.profileId];
    const isWin = profile.os === "windows";
    const sep = isWin ? "\\" : "/";
    const baseDir = state.model.baseDir || profile.defaultModelsDir;
    const rel = isWin
      ? modelObj.relativeWin || modelObj.filename || modelObj.relativeLinux
      : modelObj.relativeLinux || modelObj.filename || modelObj.relativeWin;
    const cleanRel = String(rel || "").replace(/^[\\/]+/, "");
    const cleanBase = String(baseDir || profile.defaultModelsDir).replace(/[\\/]+$/, "");
    const fullPath = modelObj.fullPath
      ? modelObj.fullPath
      : cleanBase + sep + cleanRel;

    state.model.fullPath = fullPath;
    state.model.baseDir = cleanBase;
    state.model.filename = cleanRel.split(/[\\/]/).pop() || cleanRel;
    state.model.alias = modelObj.alias;
    state.model.slug = modelObj.slug;
    state.model.tokenizer = modelObj.tokenizer;
    state.model.weightGb = Number(modelObj.weightGb) || 15.8;
    state.model.paramsB = Number(modelObj.paramsB) || 27;
  }

  function switchHardwareProfile(newProfileId) {
    const prevProfile = D.HARDWARE_PROFILES[state.hardware.profileId];
    const nextProfile = D.HARDWARE_PROFILES[newProfileId];
    if (!nextProfile) return;

    state.hardware.profileId = newProfileId;
    state.hardware.vramGb = nextProfile.defaultVramGb;
    state.hardware.binDir = nextProfile.defaultBinDir;
    state.hardware.repoDir = nextProfile.defaultRepoDir;
    state.hardware.benchRoot = nextProfile.defaultBenchRoot;
    state.hardware.resultsDir = nextProfile.defaultResultsDir;
    state.hardware.nvidiaDevice = nextProfile.deviceFlag || "CUDA0";

    const sep = nextProfile.os === "windows" ? "\\" : "/";
    const matchedQuick = allModelChoices().find(
      (m) => m.slug === state.model.slug || m.alias === state.model.alias
    );
    state.model.baseDir = nextProfile.defaultModelsDir;
    if (matchedQuick && matchedQuick.relativeWin && matchedQuick.relativeLinux) {
      applyQuickModel(matchedQuick);
    } else if (prevProfile.os !== nextProfile.os) {
      const fileOnly = String(state.model.fullPath || state.model.filename || "").split(/[\\/]/).pop();
      state.model.fullPath = nextProfile.defaultModelsDir + sep + fileOnly;
      state.model.filename = fileOnly;
    }
  }

  function applyAutoFix(warningId) {
    if (warningId === "ctx_aiperf_sweep") {
      state.suites.aiperf_sweep.c = 70000;
      state.suites.aiperf_sweep.ctk = "q8_0";
      state.suites.aiperf_sweep.ctv = "q8_0";
    } else if (warningId === "ctx_benchy") {
      state.suites.llama_benchy.c = 70000;
    } else if (warningId === "ctx_llmperf") {
      const lp = state.suites.llmperf;
      const req = (Number(lp.meanInput) || 1024) + 2 * (Number(lp.stddevInput) || 0) + (Number(lp.meanOutput) || 256) + 64;
      lp.c = Math.max(32768, req + 1024);
    } else if (warningId === "ctx_speed_bench") {
      const sb = state.suites.speed_bench;
      const req = 16384 + (Number(sb.osl) || 1024) + 64;
      sb.c = Math.max(32768, req + 1024);
      sb.contextPreset = [16384, 32768, 65536].includes(sb.c) ? String(sb.c) : "custom";
    } else if (warningId === "ctx_aiperf_std") {
      const astd = state.suites.aiperf_std;
      const req = (Number(astd.islMean) || 1024) + (Number(astd.oslMean) || 256) + 64;
      astd.c = Math.max(32768, req + 1024);
    } else if (warningId === "sweep_cache_prompt") {
      state.suites.aiperf_sweep.cachePrompt = false;
    } else if (warningId === "vram_fp16_64k") {
      state.suites.aiperf_sweep.ctk = "q8_0";
      state.suites.aiperf_sweep.ctv = "q8_0";
    } else if (warningId === "vram_overflow") {
      const targetKv = state.suites.aiperf_sweep.ctk === "fp16" ? "q8_0" : "q4_0";
      Object.keys(state.suites).forEach((k) => {
        if ("ctk" in state.suites[k]) state.suites[k].ctk = targetKv;
        if ("ctv" in state.suites[k]) state.suites[k].ctv = targetKv;
      });
    }
    persistState();
    renderApp();
  }

  /* ---------- Guardrails Always-Visible Status & Warnings ---------- */
  function renderGuardrailsHtml() {
    const { warnings, vramEstimate } = E.evaluateGuardrails(state);
    if (!warnings.length) {
      return `<div class="sb-banner sb-banner-ok">
        <span><strong>Guardrails Active (All Parameters Valid)</strong> — Est. Peak VRAM: ${esc(vramEstimate.totalVramGb)} GB / ${esc(vramEstimate.vramCeiling)} GB (Weights ${esc(vramEstimate.weightGb)} GB + KV ${esc(vramEstimate.kvGb)} GB @ ${esc(vramEstimate.kvPrecision)} + 1.5 GB Buffer) · Max Server Context: ${esc(vramEstimate.maxServerCtx)}</span>
      </div>`;
    }
    return warnings
      .map(
        (w) =>
          `<div class="sb-banner ${w.severity === "crimson" ? "sb-banner-danger" : "sb-banner-warn"}">
            <span><strong>${esc(w.title)}</strong> — ${esc(w.detail)}</span>
            <button type="button" class="btn btn-sm btn-outline" data-autofix="${esc(w.id)}">${esc(w.fixLabel)}</button>
          </div>`
      )
      .join("");
  }

  /* ---------- Tab 1: 1. Setup & Pre-flight (Strictly Platform-Filtered) ---------- */
  function renderSetupTab() {
    const profile = D.HARDWARE_PROFILES[state.hardware.profileId];
    const isDgx = profile.id === "dgx_spark_linux_arm64";
    const cards = E.buildSetupCards(state);

    let platformTogglesHtml = "";
    if (profile.id === "rtx_spark_win_arm64") {
      platformTogglesHtml = `<label class="sb-field-inline" data-tip="chk_rtxArmTdigestCompile">
        <input type="checkbox" data-hw-check="rtxArmTdigestCompile" ${state.hardware.rtxArmTdigestCompile ? "checked" : ""} />
        <span>Compile aiperf[tdigest] (requires VS C++ ARM64 build tools)</span>
      </label>`;
    } else if (isDgx) {
      platformTogglesHtml = `
        <label class="sb-field-inline" data-tip="chk_nonSudoSetup">
          <input type="checkbox" data-hw-check="nonSudoSetup" ${state.hardware.nonSudoSetup ? "checked" : ""} />
          <span>Non-sudo setup (skip python3-dev / crick C extension)</span>
        </label>
        <label class="sb-field-inline" data-tip="chk_includeVllmInStartAi">
          <input type="checkbox" data-ssh-check="includeVllmInStartAi" ${state.ssh.includeVllmInStartAi ? "checked" : ""} />
          <span>Include vLLM in start-ai restore</span>
        </label>`;
    }

    const cardsHtml = cards
      .map(
        (c) => `<div class="sb-terminal-wrap">
          <div class="sb-terminal-bar">
            <span data-tip="${esc(c.id)}">${esc(c.title)}</span>
            <button type="button" class="btn btn-sm" data-copy-setup="${esc(c.id)}">Copy</button>
          </div>
          <pre class="sb-terminal-pre" data-setup-pre="${esc(c.id)}">${E.highlightShell(c.cmd)}</pre>
        </div>`
      )
      .join("");

    let dgxRemoteHtml = "";
    if (isDgx) {
      const s = state.ssh;
      const sshCmds = E.buildSshCommands(state);
      const sshCards = [
        { id: "psTrigger", title: "Remote SSH Trigger (from Windows PowerShell to DGX Spark)", cmd: sshCmds.psTrigger },
        { id: "tmuxLaunch", title: "tmux Split Benchmark Session (DGX Spark)", cmd: sshCmds.tmuxLaunch },
        { id: "scpPull", title: "scp Pull Remote Results (from DGX Spark to PC)", cmd: sshCmds.scpPull },
        { id: "startAiRestore", title: "Restore start-ai Stack (DGX Spark Post-Benchmark)", cmd: sshCmds.startAiRestore }
      ];
      dgxRemoteHtml = `
        <div class="config-section" style="margin-top:20px; padding-top:16px; border-top:1px solid var(--border-soft);">
          <h3 class="sb-sub-title" style="margin-top:0">DGX Spark Remote SSH &amp; Post-Benchmark Stack</h3>
          <div class="sb-form-grid">
            <div class="sb-field"><label data-tip="ssh_user">SSH User</label><input type="text" class="sb-input" data-ssh-field="user" value="${esc(s.user)}" /></div>
            <div class="sb-field"><label data-tip="ssh_host">SSH Host / IP</label><input type="text" class="sb-input" data-ssh-field="host" value="${esc(s.host)}" /></div>
            <div class="sb-field"><label data-tip="ssh_port">SSH Port</label><input type="number" class="sb-input" data-ssh-field="port" value="${esc(s.port)}" /></div>
            <div class="sb-field"><label data-tip="ssh_tmuxSession">tmux Session</label><input type="text" class="sb-input" data-ssh-field="tmuxSession" value="${esc(s.tmuxSession)}" /></div>
            <div class="sb-field"><label data-tip="ssh_remoteResultsDir">Remote Results Dir</label><input type="text" class="sb-input" data-ssh-field="remoteResultsDir" value="${esc(s.remoteResultsDir)}" /></div>
            <div class="sb-field"><label data-tip="ssh_localPullDir">Local Pull Dir</label><input type="text" class="sb-input" data-ssh-field="localPullDir" value="${esc(s.localPullDir)}" /></div>
            <div class="sb-field"><label data-tip="ssh_hermesServerIp">Hermes Server IP</label><input type="text" class="sb-input" data-ssh-field="hermesServerIp" value="${esc(s.hermesServerIp)}" /></div>
          </div>
          <div class="ssh-stack">${sshCards
            .map(
              (c) => `<div class="sb-terminal-wrap">
                <div class="sb-terminal-bar">
                  <span data-tip="ssh_${esc(c.id)}">${esc(c.title)}</span>
                  <button type="button" class="btn btn-sm" data-copy-ssh="${esc(c.id)}">Copy</button>
                </div>
                <pre class="sb-terminal-pre" data-ssh-pre="${esc(c.id)}">${E.highlightShell(c.cmd)}</pre>
              </div>`
            )
            .join("")}</div>
        </div>
      `;
    }

    return `
      <div class="config-section">
        <div class="sb-inline-row" style="justify-content:space-between; margin-bottom:10px;">
          <h2 class="sb-section-title" style="margin:0" data-tip="sec_setup">Pre-flight Verification &amp; Environment Setup — ${esc(profile.shortName)}</h2>
          <button type="button" class="btn btn-sm btn-primary" data-tab="benchmarks">Continue to Benchmarks &rarr;</button>
        </div>
        <div class="sb-form-grid">
          <div class="sb-field"><label data-tip="hw_binDir">Llama Bin Dir</label><input type="text" class="sb-input" data-hw-field="binDir" value="${esc(state.hardware.binDir)}" /></div>
          <div class="sb-field"><label data-tip="hw_repoDir">Repo Dir</label><input type="text" class="sb-input" data-hw-field="repoDir" value="${esc(state.hardware.repoDir)}" /></div>
          <div class="sb-field"><label data-tip="hw_benchRoot">Bench Root (Venvs &amp; llmperf)</label><input type="text" class="sb-input" data-hw-field="benchRoot" value="${esc(state.hardware.benchRoot)}" /></div>
          <div class="sb-field"><label data-tip="hw_resultsDir">Results Dir (Benchmark Outputs)</label><input type="text" class="sb-input" data-hw-field="resultsDir" value="${esc(state.hardware.resultsDir)}" /></div>
          <div class="sb-field"><label data-tip="model_fullPath">Active Model (.gguf)</label><input type="text" class="sb-input" data-model-field="fullPath" value="${esc(state.model.fullPath)}" /></div>
        </div>
        ${platformTogglesHtml ? `<div class="sb-inline-row" style="margin-top:10px;">${platformTogglesHtml}</div>` : ""}
      </div>
      <div class="ssh-stack" id="setup-cards-root">${cardsHtml}</div>
      ${dgxRemoteHtml}
    `;
  }

  /* ---------- Tab 2: 2. Benchmarks ---------- */
  function renderFieldInput(suiteId, field, label, type, val, attrs) {
    return `<div class="sb-field">
      <label data-tip="param_${esc(field)}">${esc(label)}</label>
      <input type="${type}" class="sb-input" data-suite-id="${esc(suiteId)}" data-suite-field="${esc(field)}" value="${esc(val)}" ${attrs || ""} />
    </div>`;
  }

  function renderFieldSelect(suiteId, field, label, val, options) {
    const opts = options
      .map((o) => {
        const v = typeof o === "object" ? o.value : o;
        const t = typeof o === "object" ? o.label : o;
        return `<option value="${esc(v)}" ${String(val) === String(v) ? "selected" : ""}>${esc(t)}</option>`;
      })
      .join("");
    return `<div class="sb-field">
      <label data-tip="param_${esc(field)}">${esc(label)}</label>
      <select class="sb-select" data-suite-id="${esc(suiteId)}" data-suite-field="${esc(field)}">${opts}</select>
    </div>`;
  }

  function renderFieldCheck(suiteId, field, label, checked) {
    return `<div class="sb-field">
      <label data-tip="chk_${esc(field)}">${esc(label)}</label>
      <label class="sb-field-inline" style="height:32px" data-tip="chk_${esc(field)}">
        <input type="checkbox" data-suite-id="${esc(suiteId)}" data-suite-field="${esc(field)}" ${checked ? "checked" : ""} />
        <span>${checked ? "Enabled" : "Disabled"}</span>
      </label>
    </div>`;
  }

  function renderSuiteDrawerFields(suiteId) {
    const s = state.suites[suiteId];
    const kvOpts = ["fp16", "q8_0", "q4_0"];
    const faOpts = ["1", "on", "0", "off", "auto"];

    if (suiteId === "llama_bench") {
      return `<div class="sb-form-grid">${
        renderFieldInput(suiteId, "ngl", "-ngl", "number", s.ngl) +
        renderFieldSelect(suiteId, "fa", "-fa", s.fa, faOpts) +
        renderFieldInput(suiteId, "p", "-p (Prompt Sizes)", "text", s.p) +
        renderFieldInput(suiteId, "n", "-n (Gen Tokens)", "text", s.n) +
        renderFieldInput(suiteId, "r", "-r (Repetitions)", "number", s.r) +
        renderFieldInput(suiteId, "b", "-b (Batch)", "number", s.b) +
        renderFieldInput(suiteId, "ub", "-ub (uBatch)", "number", s.ub) +
        renderFieldSelect(suiteId, "format", "-o Format", s.format, ["md", "json", "csv"])
      }</div>`;
    }
    if (suiteId === "llama_benchy") {
      return `<div class="sb-form-grid">${
        renderFieldInput(suiteId, "c", "Server -c", "number", s.c) +
        renderFieldInput(suiteId, "np", "Server -np", "number", s.np) +
        renderFieldSelect(suiteId, "ctk", "-ctk", s.ctk, kvOpts) +
        renderFieldSelect(suiteId, "ctv", "-ctv", s.ctv, kvOpts) +
        renderFieldSelect(suiteId, "fa", "-fa", s.fa, faOpts) +
        renderFieldInput(suiteId, "pp", "--pp", "text", s.pp) +
        renderFieldInput(suiteId, "tg", "--tg", "text", s.tg) +
        renderFieldInput(suiteId, "depth", "--depth", "text", s.depth) +
        renderFieldInput(suiteId, "runs", "--runs", "number", s.runs)
      }</div>`;
    }
    if (suiteId === "llmperf") {
      const isDefault = Number(s.meanInput) === 1024 && Number(s.meanOutput) === 256;
      const isFast = Number(s.meanInput) === 512 && Number(s.meanOutput) === 128;
      return `
        <div class="sb-inline-row" style="margin-bottom:10px">
          <span style="font-size:12px;font-weight:600;color:var(--text-secondary)">Token Workload Preset:</span>
          <button type="button" class="sb-chip ${isDefault ? "active" : ""}" data-llmperf-preset="default" data-tip="preset_llmperf_default">Default: 1024 in / 256 out</button>
          <button type="button" class="sb-chip ${isFast ? "active" : ""}" data-llmperf-preset="fast" data-tip="preset_llmperf_fast">Fast: 512 in / 128 out</button>
        </div>
        <div class="sb-form-grid">${
          renderFieldInput(suiteId, "c", "Server -c", "number", s.c) +
          renderFieldInput(suiteId, "np", "Server -np", "number", s.np) +
          renderFieldSelect(suiteId, "ctk", "-ctk", s.ctk, kvOpts) +
          renderFieldSelect(suiteId, "ctv", "-ctv", s.ctv, kvOpts) +
          renderFieldInput(suiteId, "concurrency", "--num-concurrent-requests", "number", s.concurrency) +
          renderFieldInput(suiteId, "maxCompleted", "--max-num-completed-requests", "number", s.maxCompleted) +
          renderFieldInput(suiteId, "meanInput", "--mean-input-tokens", "number", s.meanInput) +
          renderFieldInput(suiteId, "stddevInput", "--stddev-input-tokens", "number", s.stddevInput) +
          renderFieldInput(suiteId, "meanOutput", "--mean-output-tokens", "number", s.meanOutput) +
          renderFieldInput(suiteId, "stddevOutput", "--stddev-output-tokens", "number", s.stddevOutput)
        }</div>`;
    }
    if (suiteId === "speed_bench") {
      const presetVal = ["16384", "32768", "65536"].includes(String(s.c)) ? String(s.c) : "custom";
      const slug = state.model.slug || "qwen38";
      const isDenseVsMoe = s.compareBaselineFile === "speedbench_qwen38.json" && s.compareSpeculativeFile === "speedbench_qwen36.json";
      const isStdVs64k = s.compareBaselineFile === `speedbench_${slug}.json` && s.compareSpeculativeFile === `speedbench_${slug}_ctx64k.json`;
      return `
        <div class="sb-inline-row" style="margin-bottom:10px">
          <span style="font-size:12px;font-weight:600;color:var(--text-secondary)">Comparator Preset:</span>
          <button type="button" class="sb-chip ${isDenseVsMoe ? "active" : ""}" data-speedbench-cmp="dense_vs_moe" data-tip="cmp_dense_vs_moe">Dense vs MoE (qwen38 vs qwen36)</button>
          <button type="button" class="sb-chip ${isStdVs64k ? "active" : ""}" data-speedbench-cmp="std_vs_64k" data-tip="cmp_std_vs_64k">Standard vs 64K (${esc(slug)} vs ${esc(slug)}_ctx64k)</button>
        </div>
        <div class="sb-form-grid">${
        renderFieldSelect(suiteId, "contextPreset", "Context Quick Select", presetVal, [
          { value: "16384", label: "16K (16384)" },
          { value: "32768", label: "32K (32768)" },
          { value: "65536", label: "64K (65536)" },
          { value: "custom", label: "Custom (-c below)" }
        ]) +
        renderFieldInput(suiteId, "c", "Server -c", "number", s.c) +
        renderFieldInput(suiteId, "np", "Server -np", "number", s.np) +
        renderFieldSelect(suiteId, "ctk", "-ctk", s.ctk, kvOpts) +
        renderFieldSelect(suiteId, "ctv", "-ctv", s.ctv, kvOpts) +
        renderFieldSelect(suiteId, "fa", "-fa", s.fa, faOpts) +
        renderFieldCheck(suiteId, "jinja", "--jinja Flag", s.jinja) +
        renderFieldInput(suiteId, "category", "--category", "text", s.category) +
        renderFieldInput(suiteId, "osl", "--osl", "number", s.osl) +
        renderFieldInput(suiteId, "concurrency", "--concurrency", "number", s.concurrency) +
        renderFieldInput(suiteId, "limit", "--limit", "number", s.limit) +
        renderFieldInput(suiteId, "compareBaselineFile", "Compare Baseline JSON", "text", s.compareBaselineFile) +
        renderFieldInput(suiteId, "compareSpeculativeFile", "Compare Speculative JSON", "text", s.compareSpeculativeFile)
      }</div>`;
    }
    if (suiteId === "agentperf") {
      return `<div class="sb-form-grid">${
        renderFieldInput(suiteId, "c", "Server -c", "number", s.c) +
        renderFieldInput(suiteId, "np", "Server -np", "number", s.np) +
        renderFieldSelect(suiteId, "ctk", "-ctk", s.ctk, kvOpts) +
        renderFieldSelect(suiteId, "ctv", "-ctv", s.ctv, kvOpts) +
        renderFieldSelect(suiteId, "fa", "-fa", s.fa, faOpts) +
        renderFieldInput(suiteId, "extraFlags", "Extra Client Flags", "text", s.extraFlags || "")
      }</div>`;
    }
    if (suiteId === "aiperf_std") {
      return `<div class="sb-form-grid">${
        renderFieldInput(suiteId, "c", "Server -c", "number", s.c) +
        renderFieldInput(suiteId, "np", "Server -np", "number", s.np) +
        renderFieldSelect(suiteId, "ctk", "-ctk", s.ctk, kvOpts) +
        renderFieldSelect(suiteId, "ctv", "-ctv", s.ctv, kvOpts) +
        renderFieldSelect(suiteId, "fa", "-fa", s.fa, faOpts) +
        renderFieldInput(suiteId, "concurrency", "--concurrency", "number", s.concurrency) +
        renderFieldInput(suiteId, "requestCount", "--request-count", "number", s.requestCount) +
        renderFieldInput(suiteId, "islMean", "--synthetic-input-tokens-mean", "number", s.islMean) +
        renderFieldInput(suiteId, "oslMean", "--output-tokens-mean", "number", s.oslMean) +
        renderFieldCheck(suiteId, "ignoreEos", "ignore_eos:true", s.ignoreEos)
      }</div>`;
    }
    if (suiteId === "aiperf_sweep") {
      return `<div class="sb-form-grid">${
        renderFieldInput(suiteId, "c", "Server -c", "number", s.c) +
        renderFieldInput(suiteId, "np", "Server -np", "number", s.np) +
        renderFieldSelect(suiteId, "ctk", "-ctk", s.ctk, kvOpts) +
        renderFieldSelect(suiteId, "ctv", "-ctv", s.ctv, kvOpts) +
        renderFieldSelect(suiteId, "fa", "-fa", s.fa, faOpts) +
        renderFieldInput(suiteId, "islList", "Sweep ISLs", "text", s.islList) +
        renderFieldInput(suiteId, "oslList", "Sweep OSLs", "text", s.oslList) +
        renderFieldInput(suiteId, "concurrency", "--concurrency", "number", s.concurrency) +
        renderFieldInput(suiteId, "warmupCount", "--warmup-request-count", "number", s.warmupCount) +
        renderFieldInput(suiteId, "requestCount", "--request-count", "number", s.requestCount) +
        renderFieldInput(suiteId, "randomSeed", "--random-seed", "number", s.randomSeed) +
        renderFieldCheck(suiteId, "ignoreEos", "ignore_eos:true", s.ignoreEos) +
        renderFieldCheck(suiteId, "cachePrompt", "cache_prompt", s.cachePrompt)
      }</div>`;
    }
    return "";
  }

  function renderPathsDrawer() {
    if (!state.ui.showPathsAndNaming) return "";
    const profile = D.HARDWARE_PROFILES[state.hardware.profileId];
    const presetsHtml = (state.customPresets || [])
      .map(
        (p) =>
          `<span class="sb-chip-group">
            <button type="button" class="sb-chip ${state.naming.activePresetName === p.name ? "active" : ""}" data-apply-preset="${esc(p.name)}">${esc(p.name)}</button>
            <button type="button" class="sb-chip-x" title="Delete preset" data-delete-preset="${esc(p.name)}">&times;</button>
          </span>`
      )
      .join("");

    const multiGpuHtml = profile.supportsMultiGpu
      ? `<div class="sb-field"><label data-tip="hw_nvidiaDevice">Device (-dev)</label><input type="text" class="sb-input" data-hw-field="nvidiaDevice" value="${esc(state.hardware.nvidiaDevice || "")}" /></div>
         <div class="sb-field"><label data-tip="hw_tensorSplit">Tensor Split (-ts)</label><input type="text" class="sb-input" data-hw-field="tensorSplit" value="${esc(state.hardware.tensorSplit || "")}" placeholder="e.g. 1,1" /></div>`
      : "";

    return `<div class="sb-drawer">
      <div class="sb-form-grid">
        <div class="sb-field"><label data-tip="hw_binDir">Llama Bin Dir</label><input type="text" class="sb-input" data-hw-field="binDir" value="${esc(state.hardware.binDir)}" /></div>
        <div class="sb-field"><label data-tip="hw_repoDir">Repo Dir</label><input type="text" class="sb-input" data-hw-field="repoDir" value="${esc(state.hardware.repoDir)}" /></div>
        <div class="sb-field"><label data-tip="hw_benchRoot">Bench Root</label><input type="text" class="sb-input" data-hw-field="benchRoot" value="${esc(state.hardware.benchRoot)}" /></div>
        <div class="sb-field"><label data-tip="hw_resultsDir">Results Dir</label><input type="text" class="sb-input" data-hw-field="resultsDir" value="${esc(state.hardware.resultsDir)}" /></div>
        <div class="sb-field"><label data-tip="model_alias">Model Alias</label><input type="text" class="sb-input" data-model-field="alias" value="${esc(state.model.alias)}" /></div>
        <div class="sb-field"><label data-tip="model_slug">Output Slug</label><input type="text" class="sb-input" data-model-field="slug" value="${esc(state.model.slug)}" /></div>
        <div class="sb-field"><label data-tip="model_tokenizer">Tokenizer ID</label><input type="text" class="sb-input" data-model-field="tokenizer" value="${esc(state.model.tokenizer)}" /></div>
        <div class="sb-field"><label data-tip="model_weightGb">Weight (GB)</label><input type="number" step="0.1" class="sb-input" data-model-field="weightGb" value="${esc(state.model.weightGb)}" /></div>
        <div class="sb-field"><label data-tip="model_paramsB">Params (B)</label><input type="number" step="0.5" class="sb-input" data-model-field="paramsB" value="${esc(state.model.paramsB)}" /></div>
        <div class="sb-field"><label data-tip="hw_host">Server Host</label><input type="text" class="sb-input" data-hw-field="host" value="${esc(state.hardware.host)}" /></div>
        <div class="sb-field"><label data-tip="hw_port">Server Port</label><input type="number" class="sb-input" data-hw-field="port" value="${esc(state.hardware.port)}" /></div>
        <div class="sb-field">
          <label data-tip="model_clientModelMode">Client --model Flag</label>
          <select class="sb-select" data-model-field="clientModelMode">
            <option value="alias" ${state.model.clientModelMode === "alias" ? "selected" : ""}>Alias (--alias)</option>
            <option value="fullPath" ${state.model.clientModelMode === "fullPath" ? "selected" : ""}>Full GGUF Path</option>
          </select>
        </div>
        <div class="sb-field">
          <label data-tip="naming_mode">Filename Naming</label>
          <select class="sb-select" data-naming-mode>
            <option value="auto" ${state.naming.mode === "auto" ? "selected" : ""}>Auto (Classic on Default, Stamped on Edit)</option>
            <option value="stamped" ${state.naming.mode === "stamped" ? "selected" : ""}>Always Stamped (_c32k_fp16)</option>
            <option value="classic" ${state.naming.mode === "classic" ? "selected" : ""}>Always Classic</option>
          </select>
        </div>
        ${multiGpuHtml}
      </div>
      <div class="sb-inline-row" style="margin-top:12px; padding-top:10px; border-top:1px solid var(--border-soft);">
        <input type="text" class="sb-input" id="preset-name-input" placeholder="Save current parameters as preset..." style="min-width:220px" />
        <button type="button" class="btn btn-sm btn-outline" data-action="save-preset">+ Save Preset</button>
        ${presetsHtml}
        <button type="button" class="btn btn-sm btn-danger" data-action="reset-all-suites">Reset to Defaults</button>
      </div>
    </div>`;
  }

  function renderBenchmarksTab() {
    const profile = D.HARDWARE_PROFILES[state.hardware.profileId];
    const profileOpts = Object.values(D.HARDWARE_PROFILES)
      .map(
        (p) =>
          `<option value="${esc(p.id)}" ${p.id === state.hardware.profileId ? "selected" : ""}>${esc(p.name)}</option>`
      )
      .join("");

    const amdControls =
      profile.id === "amd_win_x64"
        ? `<label class="sb-field-inline" data-tip="hw_amdBackend"><span>Backend</span>
             <select class="sb-select" data-action="change-amd-backend">
               <option value="vulkan" ${state.hardware.amdBackend === "vulkan" ? "selected" : ""}>Vulkan</option>
               <option value="rocm" ${state.hardware.amdBackend === "rocm" ? "selected" : ""}>ROCm HIP</option>
             </select>
           </label>
           <label class="sb-field-inline" data-tip="chk_amdEnableFa">
             <input type="checkbox" data-hw-check="amdEnableFa" ${state.hardware.amdEnableFa ? "checked" : ""} />
             <span>Enable -fa 1 on Vulkan</span>
           </label>`
        : "";

    const quickChips = D.QUICK_MODELS.map((m) => {
      const isAct = state.model.slug === m.slug || state.model.alias === m.alias;
      return `<button type="button" class="sb-chip ${isAct ? "active" : ""}" data-select-model="${esc(m.id)}">${esc(m.label)}</button>`;
    }).join("");

    const customChips = (state.customModels || [])
      .map((m) => {
        const isAct = state.model.slug === m.slug || state.model.alias === m.alias;
        return `<span class="sb-chip-group">
          <button type="button" class="sb-chip ${isAct ? "active" : ""}" data-select-model="${esc(m.id)}">${esc(m.label || m.alias)}</button>
          <button type="button" class="sb-chip-x" title="Remove model" data-remove-model="${esc(m.id)}">&times;</button>
        </span>`;
      })
      .join("");

    const suiteCardsHtml = D.SUITE_METADATA.map((meta) => {
      const modified = E.isSuiteCustomized(state, meta.id);
      const target = E.getOutputTarget(state, meta.id);
      const expanded = Boolean(state.ui.expandedDrawers[meta.id]);
      const serverCmd = meta.hasServer ? E.buildServerCommand(state, meta.id) : "";
      const clientCmd = E.buildSuiteClientCommand(state, meta.id);
      const lifecycle = E.getServerLifecycleInfo(state, meta.id);

      const modBadge = modified
        ? `<span class="sb-badge sb-badge-warn" data-suite-mod="${esc(meta.id)}">Modified</span>`
        : `<span class="sb-badge sb-badge-warn" data-suite-mod="${esc(meta.id)}" style="display:none">Modified</span>`;

      const resetBtn = modified
        ? `<button type="button" class="btn btn-sm btn-danger" data-reset-suite="${esc(meta.id)}">Reset to Default</button>`
        : "";

      const serverBox = meta.hasServer
        ? `<div class="sb-terminal-wrap">
             <div class="sb-terminal-bar">
               <span>Terminal 1 — Server</span>
               <button type="button" class="btn btn-sm" data-copy-server="${esc(meta.id)}">Copy Server</button>
             </div>
             <pre class="sb-terminal-pre" data-server-pre="${esc(meta.id)}">${E.highlightShell(serverCmd)}</pre>
           </div>`
        : "";

      const drawerHtml = expanded
        ? `<div class="sb-drawer">${renderSuiteDrawerFields(meta.id)}</div>`
        : "";

      return `<div class="suite-card" data-suite-card="${esc(meta.id)}">
        <div class="suite-card-header">
          <div class="suite-card-title" data-tip="suite_${esc(meta.id)}">
            <span class="suite-card-num">${esc(meta.index)}</span>
            <span>${esc(meta.title)}</span>
            <code class="suite-output-tag" data-output-tag="${esc(meta.id)}" data-tip="hw_resultsDir">-&gt; ${esc(target.leaf)}</code>
            <span class="sb-badge sb-srv-badge-${esc(lifecycle.tone)}" data-suite-srv-badge="${esc(meta.id)}">${esc(lifecycle.badge)}</span>
            ${modBadge}
          </div>
          <div class="suite-card-actions">
            <button type="button" class="btn btn-sm" data-toggle-drawer="${esc(meta.id)}">Parameters ${expanded ? "&#9652;" : "&#9662;"}</button>
            ${resetBtn}
          </div>
        </div>
        <div class="suite-lifecycle-bar suite-lifecycle-${esc(lifecycle.tone)}" data-suite-srv-note="${esc(meta.id)}">
          <strong>Server / Terminal Action:</strong> ${esc(lifecycle.summary)}
        </div>
        ${drawerHtml}
        <div class="suite-terminals-stack">
          ${serverBox}
          <div class="sb-terminal-wrap">
            <div class="sb-terminal-bar">
              <span>${meta.hasServer ? "Terminal 2 — Client" : "Command"}</span>
              <button type="button" class="btn btn-sm btn-primary" data-copy-client="${esc(meta.id)}">Copy Command</button>
            </div>
            <pre class="sb-terminal-pre" data-client-pre="${esc(meta.id)}">${E.highlightShell(clientCmd)}</pre>
          </div>
        </div>
      </div>`;
    }).join("");

    const playbookExt = profile.shell === "powershell" ? ".ps1" : ".sh";
    const missingOnly = Boolean(state.ui.playbookMissingOnly);

    return `
      <div class="config-section">
        <div class="config-bar">
          <label class="sb-field-inline" data-tip="hw_profile"><span>Platform</span>
            <select class="sb-select" data-action="change-profile">${profileOpts}</select>
          </label>
          ${amdControls}
          <label class="sb-field-inline" data-tip="hw_vramGb"><span>VRAM (GB)</span>
            <input type="number" class="sb-input" style="width:76px" data-hw-field="vramGb" value="${esc(state.hardware.vramGb)}" />
          </label>
          <div class="sb-pill-row">${quickChips}${customChips}</div>
          <button type="button" class="btn btn-sm btn-outline" style="margin-left:auto" data-action="toggle-paths-drawer">
            Paths &amp; Naming ${state.ui.showPathsAndNaming ? "&#9652;" : "&#9662;"}
          </button>
        </div>

        <div class="config-model-row">
          <label class="sb-field-inline" style="flex:1.3; min-width:240px;" data-tip="model_fullPath"><span>Model (.gguf)</span>
            <input type="text" class="sb-input sb-input-wide" data-model-field="fullPath" value="${esc(state.model.fullPath)}" />
          </label>
          <button type="button" class="btn btn-sm btn-outline" data-action="add-custom-model">+ Add Model</button>
          <label class="sb-field-inline" style="flex:1; min-width:220px;" data-tip="hw_resultsDir"><span>Results Dir</span>
            <input type="text" class="sb-input sb-input-wide" data-hw-field="resultsDir" value="${esc(state.hardware.resultsDir)}" />
          </label>
        </div>

        ${renderPathsDrawer()}
      </div>

      <div class="sb-banner" style="margin-top:0; margin-bottom:10px; background:var(--bg-subtle); border:1px solid var(--border); color:var(--text-secondary);">
        <span><strong>00 · Pre-flight Check</strong> — Verify GPU, binaries, <code>.gguf</code> model, Python &amp; venvs before benchmarking.</span>
        <div class="sb-inline-row" style="gap:6px">
          <button type="button" class="btn btn-sm btn-outline" data-copy-setup="setup_verify">Copy Pre-flight Script</button>
          <button type="button" class="btn btn-sm" data-tab="setup">Open 1. Setup &amp; Pre-flight</button>
        </div>
      </div>

      <div class="guardrails-wrap" id="guardrails-root">${renderGuardrailsHtml()}</div>

      <div class="sb-banner sb-lifecycle-guide">
        <div>
          <strong>Terminal &amp; Server Lifecycle Guide (<span id="lifecycle-model-label">${esc(state.model.alias)}</span>):</strong>
          <div class="sb-lifecycle-grid">
            <span><strong class="sb-lc-tag sb-lc-cyan">01 · llama-bench:</strong> No server (stop Terminal 1 first).</span>
            <span><strong class="sb-lc-tag sb-lc-green">02, 03, 05, 06A (Shared 32K Server):</strong> Share the exact same <code>llama-server (-c 32768 -np 1)</code> — keep Terminal 1 running across all four!</span>
            <span><strong class="sb-lc-tag sb-lc-amber">04 (--jinja) &amp; 06B (-c 70000 q8_0):</strong> Press <code>Ctrl+C</code> in Terminal 1 and relaunch <code>llama-server</code> with that card's Server command.</span>
            <span><strong class="sb-lc-tag sb-lc-amber">Switching Models:</strong> Always press <code>Ctrl+C</code> in Terminal 1 and relaunch <code>llama-server</code> when changing models.</span>
          </div>
        </div>
      </div>

      <div class="suite-list">${suiteCardsHtml}</div>

      <div class="playbook-footer">
        <span class="playbook-footer-title" data-tip="sec_playbook">Playbook (${esc(profile.shortName)} · ${esc(state.model.alias || state.model.slug)})</span>
        <div class="playbook-footer-actions">
          <label class="sb-field-inline" data-tip="chk_playbookMissingOnly" style="cursor:pointer;">
            <input type="checkbox" data-action="check-playbook-missing" ${missingOnly ? "checked" : ""} />
            <span>Missing / Incomplete Runs Only</span>
          </label>
          <button type="button" class="btn btn-sm btn-outline" data-action="copy-playbook">Copy Playbook</button>
          <button type="button" class="btn btn-sm btn-primary" data-action="download-playbook">Download ${esc(playbookExt)}</button>
        </div>
      </div>
    `;
  }

  /* ---------- Tab 3: 3. Results & Audit (No Sample Data, Clean Columns) ---------- */
  function formatRecordCells(r) {
    const m = r.metrics || {};
    if (r.suiteType === "llama_bench") {
      return {
        headline: `tg128: ${m.tg128 || 0} t/s · pp512: ${m.pp512 || 0} t/s`,
        details: `pp2048: ${m.pp2048 || 0} t/s · tg512: ${m.tg512 || 0} t/s`
      };
    }
    if (r.suiteType === "llama_benchy") {
      return {
        headline: `depth 0: ${m.depth0Tg || 0} t/s · depth 4096: ${m.depth4096Tg || 0} t/s`,
        details: `KV degradation: ${m.degradationPct || 0}%`
      };
    }
    if (r.suiteType === "llmperf") {
      return {
        headline: `${m.totalTps || 0} t/s · ${m.reqPerMin || 0} req/min`,
        details: `TTFT: ${m.ttftMs || 0} ms · ITL: ${m.itlMs || 0} ms`
      };
    }
    if (r.suiteType === "speed_bench") {
      return {
        headline: `Overall: ${m.overall || 0} t/s`,
        details: `Code ${m.coding || 0} · Reason ${m.reasoning || 0} · Write ${m.writing || 0} · Math ${m.math || 0} t/s`
      };
    }
    if (r.suiteType === "aiperf_sweep" || r.suiteType === "aiperf_std") {
      return {
        headline: `16k: ${m.tps16k || 0} · 32k: ${m.tps32k || 0} · 64k: ${m.tps64k || 0} t/s`,
        details: `TTFT 16k/32k/64k: ${m.ttft16k || 0} / ${m.ttft32k || 0} / ${m.ttft64k || 0} ms`
      };
    }
    return {
      headline: Object.entries(m)
        .map(([k, v]) => `${k}: ${v}`)
        .join(" · "),
      details: "—"
    };
  }

  function renderSvgBars(title, rows, unit) {
    const valid = rows.filter((r) => r.value > 0);
    if (!valid.length) return "";
    const maxVal = Math.max(...valid.map((r) => r.value), 1);
    const barH = 22;
    const gap = 8;
    const svgH = valid.length * (barH + gap) + 12;

    const bars = valid
      .map((r, i) => {
        const y = 6 + i * (barH + gap);
        const pct = Math.max(4, Math.round((r.value / maxVal) * 230));
        const fill = r.gpuLabel.includes("DGX") ? "#10b981" : "#1b5698";
        return `<g>
          <text x="0" y="${y + 15}" fill="currentColor" font-size="11">${esc(r.label)}</text>
          <rect x="195" y="${y + 2}" width="${pct}" height="16" rx="4" fill="${fill}" opacity="0.88"></rect>
          <text x="${202 + pct}" y="${y + 14}" fill="currentColor" font-size="11" font-weight="600">${r.value}${esc(unit)}</text>
        </g>`;
      })
      .join("");

    return `<div class="sb-chart-card">
      <div style="font-size:12.5px;font-weight:700">${esc(title)}</div>
      <svg class="sb-chart-svg" viewBox="0 0 490 ${svgH}" aria-label="${esc(title)}">${bars}</svg>
    </div>`;
  }

  function renderResultsTab() {
    const auditRows = D.SUITE_METADATA.map((meta) => {
      const target = E.getOutputTarget(state, meta.id);
      const item = (state.audit.items || {})[meta.id];
      const badgeClass = !item
        ? ""
        : item.status === "verified"
          ? "sb-badge-ok"
          : item.status === "partial"
            ? "sb-badge-warn"
            : item.status === "stub"
              ? "sb-badge-danger"
              : "";
      const statusLabel = item ? item.label : "NOT AUDITED";
      const subText = item ? item.detail : "Run folder audit or drop files above.";
      return `<tr>
        <td><strong data-tip="suite_${esc(meta.id)}">${esc(meta.index)} · ${esc(meta.title)}</strong></td>
        <td><code data-tip="hw_resultsDir">${esc(target.leaf)}</code></td>
        <td>
          <span class="sb-badge ${badgeClass}">${esc(statusLabel)}</span>
          <div class="sb-audit-sub">${esc(subText)}</div>
        </td>
      </tr>`;
    }).join("");

    const activeRecords = state.results.loadedRecords || [];
    const recordRows = activeRecords.length
      ? activeRecords
          .map((r) => {
            const cells = formatRecordCells(r);
            return `<tr>
              <td><code>${esc(r.suiteType)}</code></td>
              <td>${esc(r.gpuLabel)}</td>
              <td>${esc(r.modelLabel)}</td>
              <td><strong>${esc(cells.headline)}</strong></td>
              <td>${esc(cells.details)}</td>
              <td><code>${esc(r.sourceFile)}</code></td>
            </tr>`;
          })
          .join("")
      : `<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">Upload benchmark result files (.md / .json) or drop your Results folder above to populate the comparison table.</td></tr>`;

    let chartsHtml = "";
    if (state.ui.showCharts && activeRecords.length) {
      const tg128Rows = activeRecords
        .filter((r) => r.suiteType === "llama_bench" && r.metrics?.tg128)
        .map((r) => ({
          label: `${r.gpuLabel.split(" ")[0]} · ${r.modelLabel.split(" ")[0]}`,
          gpuLabel: r.gpuLabel,
          value: r.metrics.tg128
        }));
      const speedRows = activeRecords
        .filter((r) => r.suiteType === "speed_bench" && r.metrics?.overall)
        .map((r) => ({
          label: `${r.gpuLabel.split(" ")[0]} · ${r.modelLabel.split(" ")[0]}`,
          gpuLabel: r.gpuLabel,
          value: r.metrics.overall
        }));
      chartsHtml = `<div class="sb-chart-grid">
        ${renderSvgBars("llama-bench Decode tg128 (tok/s)", tg128Rows, " t/s")}
        ${renderSvgBars("SPEED-Bench Overall Decode (tok/s)", speedRows, " t/s")}
      </div>`;
    }

    const deepAuditBox = state.ui.showDeepAuditScript
      ? `<div class="sb-terminal-wrap">
           <div class="sb-terminal-bar">
             <span>Terminal Audit Script (1 KB Stub Check)</span>
             <button type="button" class="btn btn-sm" data-action="copy-deep-audit">Copy</button>
           </div>
           <pre class="sb-terminal-pre" id="deep-audit-pre">${E.highlightShell(E.buildDeepAuditScript(state))}</pre>
         </div>`
      : "";

    return `
      <div class="config-section">
        <div class="sb-inline-row">
          <h2 class="sb-section-title" style="margin:0" data-tip="sec_audit">Results Folder Audit</h2>
          <label class="btn btn-sm btn-primary" style="cursor:pointer" data-tip="hw_resultsDir">
            Select Folder
            <input type="file" id="audit-dir-input" webkitdirectory directory multiple style="display:none" />
          </label>
          <button type="button" class="btn btn-sm" data-action="toggle-deep-audit">
            Terminal Audit Script ${state.ui.showDeepAuditScript ? "&#9652;" : "&#9662;"}
          </button>
          ${state.audit.lastFolderName ? `<span class="sb-badge">${esc(state.audit.lastFolderName)}</span>` : ""}
          ${Object.keys(state.audit.items || {}).length ? `<button type="button" class="btn btn-sm btn-danger" data-action="clear-audit">Clear Audit</button>` : ""}
        </div>

        <div class="sb-results-folder-bar">
          <span data-tip="hw_resultsDir"><strong>Default Results Folder:</strong></span>
          <code id="results-dir-code">${esc(state.hardware.resultsDir)}</code>
          <button type="button" class="btn btn-sm" data-action="copy-results-dir">Copy Path</button>
        </div>

        <div class="sb-dropzone" id="audit-dropzone">Drop your benchmark results folder (${esc(state.hardware.resultsDir)}) here</div>

        ${deepAuditBox}

        <div class="sb-table-wrap">
          <table class="sb-table">
            <thead><tr><th>Benchmark</th><th>Expected Output</th><th>Status</th></tr></thead>
            <tbody>${auditRows}</tbody>
          </table>
        </div>
      </div>

      <div>
        <div class="sb-inline-row">
          <h2 class="sb-section-title" style="margin:0" data-tip="sec_compare">Parsed Results Comparison</h2>
          <label class="btn btn-sm btn-outline" style="cursor:pointer">
            Upload .md / .json
            <input type="file" id="compare-files-input" multiple accept=".md,.json" style="display:none" />
          </label>
          <button type="button" class="btn btn-sm" data-action="toggle-charts">${state.ui.showCharts ? "Hide Charts" : "Show Charts"}</button>
          <button type="button" class="btn btn-sm" data-action="export-md">Export .md</button>
          <button type="button" class="btn btn-sm" data-action="export-csv">Export .csv</button>
          ${activeRecords.length ? `<button type="button" class="btn btn-sm btn-danger" data-action="clear-loaded-records">Clear Uploaded</button>` : ""}
        </div>

        ${chartsHtml}

        <div class="sb-table-wrap">
          <table class="sb-table">
            <thead><tr><th>Benchmark</th><th>Platform</th><th>Model</th><th>Headline Throughput</th><th>Latency / Details</th><th>File</th></tr></thead>
            <tbody>${recordRows}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  /* ---------- Interactive Header Pills & Live Updates ---------- */
  function renderHeaderPillsHtml() {
    const profileOpts = Object.values(D.HARDWARE_PROFILES)
      .map(
        (p) =>
          `<option value="${esc(p.id)}" ${p.id === state.hardware.profileId ? "selected" : ""}>${esc(p.shortName)}</option>`
      )
      .join("");

    const baseVram = [16, 24, 32, 48, 64, 96, 128];
    const curVram = Number(state.hardware.vramGb) || 32;
    const vramList = baseVram.includes(curVram) ? baseVram : [...baseVram, curVram].sort((a, b) => a - b);
    const vramOpts = vramList
      .map((gb) => `<option value="${gb}" ${gb === curVram ? "selected" : ""}>${gb} GB</option>`)
      .join("");

    const choices = allModelChoices();
    const matched = choices.find((m) => m.slug === state.model.slug || m.alias === state.model.alias);
    const modelOpts = [
      !matched
        ? `<option value="__current__" selected>${esc(state.model.alias || state.model.slug || "Custom")}</option>`
        : "",
      ...choices.map((m) => {
        const isSel = matched && m.id === matched.id;
        return `<option value="${esc(m.id)}" ${isSel ? "selected" : ""}>${esc(m.label || m.alias)}</option>`;
      })
    ].join("");

    return `
      <span class="sb-pill sb-pill-interactive">
        <span>platform:</span>
        <select class="sb-pill-select" id="pill-platform-select" data-action="change-profile" aria-label="Platform">${profileOpts}</select>
      </span>
      <span class="sb-pill sb-pill-interactive">
        <span>vram:</span>
        <select class="sb-pill-select" id="pill-vram-select" data-action="change-vram-pill" aria-label="VRAM">${vramOpts}</select>
      </span>
      <span class="sb-pill sb-pill-interactive">
        <span>model:</span>
        <select class="sb-pill-select" id="pill-model-select" data-action="change-model-pill" aria-label="Model">${modelOpts}</select>
      </span>
    `;
  }

  function refreshLiveDom() {
    const pillsEl = document.getElementById("header-pills-cluster");
    if (pillsEl) pillsEl.innerHTML = renderHeaderPillsHtml();

    if (state.ui.activeTab === "benchmarks") {
      const guardRoot = document.getElementById("guardrails-root");
      if (guardRoot) guardRoot.innerHTML = renderGuardrailsHtml();

      D.SUITE_METADATA.forEach((meta) => {
        const target = E.getOutputTarget(state, meta.id);
        const mod = E.isSuiteCustomized(state, meta.id);
        const lifecycle = E.getServerLifecycleInfo(state, meta.id);
        const tagEl = document.querySelector(`[data-output-tag="${meta.id}"]`);
        if (tagEl) tagEl.textContent = `-> ${target.leaf}`;
        const modEl = document.querySelector(`[data-suite-mod="${meta.id}"]`);
        if (modEl) modEl.style.display = mod ? "inline-flex" : "none";

        const srvBadgeEl = document.querySelector(`[data-suite-srv-badge="${meta.id}"]`);
        if (srvBadgeEl) {
          srvBadgeEl.className = `sb-badge sb-srv-badge-${lifecycle.tone}`;
          srvBadgeEl.textContent = lifecycle.badge;
        }
        const srvNoteEl = document.querySelector(`[data-suite-srv-note="${meta.id}"]`);
        if (srvNoteEl) {
          srvNoteEl.className = `suite-lifecycle-bar suite-lifecycle-${lifecycle.tone}`;
          srvNoteEl.innerHTML = `<strong>Server / Terminal Action:</strong> ${esc(lifecycle.summary)}`;
        }

        const sPre = document.querySelector(`[data-server-pre="${meta.id}"]`);
        if (sPre && meta.hasServer) sPre.innerHTML = E.highlightShell(E.buildServerCommand(state, meta.id));
        const cPre = document.querySelector(`[data-client-pre="${meta.id}"]`);
        if (cPre) cPre.innerHTML = E.highlightShell(E.buildSuiteClientCommand(state, meta.id));
      });
      const lcModelEl = document.getElementById("lifecycle-model-label");
      if (lcModelEl) lcModelEl.textContent = state.model.alias;
    } else if (state.ui.activeTab === "setup") {
      E.buildSetupCards(state).forEach((c) => {
        const pre = document.querySelector(`[data-setup-pre="${c.id}"]`);
        if (pre) pre.innerHTML = E.highlightShell(c.cmd);
      });
      const profile = D.HARDWARE_PROFILES[state.hardware.profileId];
      if (profile.id === "dgx_spark_linux_arm64") {
        const sshCmds = E.buildSshCommands(state);
        ["psTrigger", "tmuxLaunch", "scpPull", "startAiRestore"].forEach((k) => {
          const pre = document.querySelector(`[data-ssh-pre="${k}"]`);
          if (pre && sshCmds[k]) pre.innerHTML = E.highlightShell(sshCmds[k]);
        });
      }
    } else if (state.ui.activeTab === "results") {
      const deepPre = document.getElementById("deep-audit-pre");
      if (deepPre) deepPre.innerHTML = E.highlightShell(E.buildDeepAuditScript(state));
    }
  }

  function renderApp() {
    applyThemeAndStealth();
    const root = document.getElementById("app");
    if (!root) return;

    const tab = state.ui.activeTab || "setup";

    let bodyHtml = "";
    if (tab === "setup") bodyHtml = renderSetupTab();
    else if (tab === "benchmarks") bodyHtml = renderBenchmarksTab();
    else bodyHtml = renderResultsTab();

    root.innerHTML = `
      <div class="sb-container">
        <header class="sb-header">
          <div class="sb-brand-cluster">
            <span class="sb-brand">ai-benchmate</span>
            <span class="sb-version">1.0.0</span>
            <span class="sb-pill-row" id="header-pills-cluster">${renderHeaderPillsHtml()}</span>
          </div>
          <div class="sb-header-controls">
            <button type="button" class="sb-ctrl-btn ${state.ui.pauseAnimations ? "is-active" : ""}" data-action="toggle-stealth">
              ${state.ui.pauseAnimations ? "Resume Animations" : "Pause Animations"}
            </button>
            <select class="sb-ctrl-select" data-action="change-theme" aria-label="Theme">
              <option value="light" ${state.ui.theme === "light" ? "selected" : ""}>Light</option>
              <option value="dark" ${state.ui.theme === "dark" ? "selected" : ""}>Dark</option>
              <option value="system" ${state.ui.theme === "system" ? "selected" : ""}>System</option>
            </select>
          </div>
        </header>

        <nav class="folder-tabs" aria-label="Primary Tabs">
          <button type="button" class="folder-tab ${tab === "setup" ? "active" : ""}" data-tab="setup">1. Setup &amp; Pre-flight</button>
          <button type="button" class="folder-tab ${tab === "benchmarks" ? "active" : ""}" data-tab="benchmarks">2. Benchmarks</button>
          <button type="button" class="folder-tab ${tab === "results" ? "active" : ""}" data-tab="results">3. Results &amp; Audit</button>
        </nav>

        <main class="sb-card">${bodyHtml}</main>
      </div>
    `;
  }

  /* ---------- File Audit & Drag-and-Drop ---------- */
  async function handleAuditEntries(entries, folderLabel) {
    if (!entries.length) return;
    state.audit.items = await E.auditFileList(entries, state);
    state.audit.lastFolderName = folderLabel || (entries[0].path.includes("/") ? entries[0].path.split("/")[0] : `${entries.length} file(s)`);
    state.audit.lastAuditedAt = new Date().toLocaleTimeString();

    for (const ent of entries) {
      if (/\.(md|json)$/i.test(ent.name) && ent.size > 120) {
        const parsed = E.parseResultFile(ent.name, await ent.textLoader());
        if (parsed) {
          const exists = (state.results.loadedRecords || []).some((r) => r.sourceFile === parsed.sourceFile);
          if (!exists) state.results.loadedRecords.push(parsed);
        }
      }
    }
    persistState();
    renderApp();
  }

  async function handleAuditFiles(fileList, folderLabel) {
    const entries = Array.from(fileList || []).map((f) => ({
      name: f.name,
      path: f.webkitRelativePath || f.name,
      size: f.size,
      textLoader: () => f.text()
    }));
    await handleAuditEntries(entries, folderLabel);
  }

  async function handleCompareUpload(fileList) {
    for (const f of Array.from(fileList || [])) {
      const content = await f.text();
      const parsed = E.parseResultFile(f.name, content);
      if (parsed) state.results.loadedRecords.push(parsed);
    }
    persistState();
    renderApp();
  }

  function readDroppedEntry(entry, list) {
    return new Promise((resolve) => {
      if (entry.isFile) {
        entry.file((file) => {
          list.push({
            name: file.name,
            path: entry.fullPath ? entry.fullPath.replace(/^\//, "") : file.name,
            size: file.size,
            textLoader: () => file.text()
          });
          resolve();
        }, resolve);
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const readAll = () => {
          reader.readEntries(async (entries) => {
            if (!entries.length) return resolve();
            for (const sub of entries) await readDroppedEntry(sub, list);
            readAll();
          }, resolve);
        };
        readAll();
      } else {
        resolve();
      }
    });
  }

  /* ---------- Global Delegated Event Listeners ---------- */
  document.addEventListener("click", (ev) => {
    const t = ev.target.closest("button");
    if (!t) return;

    if (t.dataset.tab) {
      state.ui.activeTab = t.dataset.tab;
      persistState();
      renderApp();
      return;
    }
    if (t.dataset.action === "toggle-stealth") {
      state.ui.pauseAnimations = !state.ui.pauseAnimations;
      persistState();
      renderApp();
      return;
    }
    if (t.dataset.action === "toggle-paths-drawer") {
      state.ui.showPathsAndNaming = !state.ui.showPathsAndNaming;
      persistState();
      renderApp();
      return;
    }
    if (t.dataset.selectModel) {
      const m = allModelChoices().find((item) => item.id === t.dataset.selectModel);
      if (m) {
        applyQuickModel(m);
        persistState();
        renderApp();
      }
      return;
    }
    if (t.dataset.removeModel) {
      state.customModels = (state.customModels || []).filter((m) => m.id !== t.dataset.removeModel);
      persistState();
      renderApp();
      return;
    }
    if (t.dataset.action === "add-custom-model") {
      const parsed = E.parseModelPath(state.model.fullPath);
      const alias = state.model.alias || parsed.alias;
      const slug = state.model.slug || parsed.slug;
      const newEntry = {
        id: "custom-" + Date.now(),
        label: alias,
        alias,
        slug,
        tokenizer: state.model.tokenizer || parsed.tokenizer,
        weightGb: Number(state.model.weightGb) || parsed.weightGb,
        paramsB: Number(state.model.paramsB) || parsed.paramsB,
        fullPath: state.model.fullPath
      };
      state.customModels = (state.customModels || []).filter((m) => m.slug !== slug && m.alias !== alias);
      state.customModels.push(newEntry);
      persistState();
      renderApp();
      return;
    }
    if (t.dataset.action === "save-preset") {
      const inp = document.getElementById("preset-name-input");
      const name = inp && inp.value.trim() ? inp.value.trim() : `Preset ${(state.customPresets || []).length + 1}`;
      state.customPresets = (state.customPresets || []).filter((p) => p.name !== name);
      state.customPresets.push({
        name,
        suites: JSON.parse(JSON.stringify(state.suites))
      });
      state.naming.activePresetName = name;
      persistState();
      renderApp();
      return;
    }
    if (t.dataset.applyPreset) {
      const found = (state.customPresets || []).find((p) => p.name === t.dataset.applyPreset);
      if (found) {
        state.suites = JSON.parse(JSON.stringify(found.suites));
        state.naming.activePresetName = found.name;
        persistState();
        renderApp();
      }
      return;
    }
    if (t.dataset.deletePreset) {
      state.customPresets = (state.customPresets || []).filter((p) => p.name !== t.dataset.deletePreset);
      if (state.naming.activePresetName === t.dataset.deletePreset) state.naming.activePresetName = "Default Settings";
      persistState();
      renderApp();
      return;
    }
    if (t.dataset.action === "reset-all-suites") {
      state.suites = JSON.parse(JSON.stringify(D.PARITY_DEFAULTS));
      state.naming.activePresetName = "Default Settings";
      persistState();
      renderApp();
      return;
    }
    if (t.dataset.autofix) {
      applyAutoFix(t.dataset.autofix);
      return;
    }
    if (t.dataset.llmperfPreset) {
      const lp = state.suites.llmperf;
      if (t.dataset.llmperfPreset === "fast") {
        lp.meanInput = 512;
        lp.stddevInput = 64;
        lp.meanOutput = 128;
        lp.stddevOutput = 16;
      } else {
        lp.meanInput = 1024;
        lp.stddevInput = 128;
        lp.meanOutput = 256;
        lp.stddevOutput = 32;
      }
      persistState();
      renderApp();
      return;
    }
    if (t.dataset.speedbenchCmp) {
      const sb = state.suites.speed_bench;
      const slug = state.model.slug || "qwen38";
      if (t.dataset.speedbenchCmp === "std_vs_64k") {
        sb.compareBaselineFile = `speedbench_${slug}.json`;
        sb.compareSpeculativeFile = `speedbench_${slug}_ctx64k.json`;
      } else {
        sb.compareBaselineFile = "speedbench_qwen38.json";
        sb.compareSpeculativeFile = "speedbench_qwen36.json";
      }
      persistState();
      renderApp();
      return;
    }
    if (t.dataset.toggleDrawer) {
      const sid = t.dataset.toggleDrawer;
      state.ui.expandedDrawers[sid] = !state.ui.expandedDrawers[sid];
      persistState();
      renderApp();
      return;
    }
    if (t.dataset.resetSuite) {
      const sid = t.dataset.resetSuite;
      state.suites[sid] = JSON.parse(JSON.stringify(D.PARITY_DEFAULTS[sid]));
      persistState();
      renderApp();
      return;
    }
    if (t.dataset.copyServer) {
      copyText(E.buildServerCommand(state, t.dataset.copyServer), t);
      return;
    }
    if (t.dataset.copyClient) {
      copyText(E.buildSuiteClientCommand(state, t.dataset.copyClient), t);
      return;
    }
    if (t.dataset.copySetup) {
      const match = E.buildSetupCards(state).find((c) => c.id === t.dataset.copySetup);
      if (match) copyText(match.cmd, t);
      return;
    }
    if (t.dataset.action === "toggle-playbook-missing") {
      state.ui.playbookMissingOnly = !state.ui.playbookMissingOnly;
      persistState();
      renderApp();
      return;
    }
    if (t.dataset.action === "copy-playbook") {
      copyText(E.buildAllInOnePlaybook(state, Boolean(state.ui.playbookMissingOnly)), t);
      return;
    }
    if (t.dataset.action === "download-playbook") {
      const profile = D.HARDWARE_PROFILES[state.hardware.profileId];
      const ext = profile.shell === "powershell" ? "ps1" : "sh";
      downloadText(`benchmate_${state.model.slug || "run"}.${ext}`, E.buildAllInOnePlaybook(state, Boolean(state.ui.playbookMissingOnly)));
      return;
    }
    if (t.dataset.action === "toggle-deep-audit") {
      state.ui.showDeepAuditScript = !state.ui.showDeepAuditScript;
      persistState();
      renderApp();
      return;
    }
    if (t.dataset.action === "clear-audit") {
      state.audit = { lastFolderName: "", lastAuditedAt: "", items: {} };
      persistState();
      renderApp();
      return;
    }
    if (t.dataset.action === "copy-deep-audit") {
      copyText(E.buildDeepAuditScript(state), t);
      return;
    }
    if (t.dataset.action === "copy-results-dir") {
      copyText(state.hardware.resultsDir, t);
      return;
    }
    if (t.dataset.action === "toggle-charts") {
      state.ui.showCharts = !state.ui.showCharts;
      persistState();
      renderApp();
      return;
    }
    if (t.dataset.action === "export-md") {
      downloadText("ai_benchmate_comparison.md", E.exportComparisonMarkdown(state.results.loadedRecords || []));
      return;
    }
    if (t.dataset.action === "export-csv") {
      downloadText("ai_benchmate_comparison.csv", E.exportComparisonCsv(state.results.loadedRecords || []));
      return;
    }
    if (t.dataset.action === "clear-loaded-records") {
      state.results.loadedRecords = [];
      persistState();
      renderApp();
      return;
    }
    if (t.dataset.copySsh) {
      const sshCmds = E.buildSshCommands(state);
      const cmd = sshCmds[t.dataset.copySsh];
      if (cmd) copyText(cmd, t);
    }
  });

  document.addEventListener("change", (ev) => {
    const t = ev.target;
    if (t.dataset.action === "change-theme") {
      state.ui.theme = t.value;
      persistState();
      applyThemeAndStealth();
      return;
    }
    if (t.dataset.action === "change-profile") {
      switchHardwareProfile(t.value);
      persistState();
      renderApp();
      return;
    }
    if (t.dataset.action === "change-vram-pill") {
      state.hardware.vramGb = Number(t.value) || 32;
      persistState();
      renderApp();
      return;
    }
    if (t.dataset.action === "change-model-pill") {
      const m = allModelChoices().find((item) => item.id === t.value);
      if (m) {
        applyQuickModel(m);
        persistState();
        renderApp();
      }
      return;
    }
    if (t.dataset.action === "change-amd-backend") {
      state.hardware.amdBackend = t.value;
      state.hardware.binDir = t.value === "rocm" ? "C:\\llama.cpp\\rocm" : "C:\\llama.cpp\\vulkan";
      persistState();
      renderApp();
      return;
    }
    if (t.dataset.action === "check-playbook-missing") {
      state.ui.playbookMissingOnly = t.checked;
      persistState();
      renderApp();
      return;
    }
    if (t.dataset.hwCheck) {
      state.hardware[t.dataset.hwCheck] = t.checked;
      persistState();
      renderApp();
      return;
    }
    if (t.dataset.sshCheck) {
      state.ssh[t.dataset.sshCheck] = t.checked;
      persistState();
      renderApp();
      return;
    }
    if (t.dataset.namingMode !== undefined) {
      state.naming.mode = t.value;
      persistState();
      refreshLiveDom();
      return;
    }
    if (t.dataset.modelField && t.tagName === "SELECT") {
      state.model[t.dataset.modelField] = t.value;
      persistState();
      refreshLiveDom();
      return;
    }
    if (t.dataset.suiteId && t.dataset.suiteField) {
      const sid = t.dataset.suiteId;
      const fld = t.dataset.suiteField;
      if (t.type === "checkbox") {
        state.suites[sid][fld] = t.checked;
        persistState();
        renderApp();
      } else if (t.tagName === "SELECT") {
        state.suites[sid][fld] = t.value;
        if (sid === "speed_bench" && fld === "contextPreset" && t.value !== "custom") {
          state.suites.speed_bench.c = Number(t.value) || 32768;
          const cInput = document.querySelector(`[data-suite-id="speed_bench"][data-suite-field="c"]`);
          if (cInput) cInput.value = state.suites.speed_bench.c;
        }
        persistState();
        refreshLiveDom();
      }
      return;
    }
    if (t.id === "audit-dir-input" || t.id === "audit-files-input") {
      handleAuditFiles(t.files);
      return;
    }
    if (t.id === "compare-files-input") {
      handleCompareUpload(t.files);
    }
  });

  document.addEventListener("input", (ev) => {
    const t = ev.target;
    if (t.dataset.hwField) {
      const f = t.dataset.hwField;
      state.hardware[f] = t.type === "number" ? Number(t.value) || 0 : t.value;
      persistState();
      refreshLiveDom();
      return;
    }
    if (t.dataset.modelField && t.tagName !== "SELECT") {
      const f = t.dataset.modelField;
      if (f === "fullPath") {
        state.model.fullPath = t.value;
        const parsed = E.parseModelPath(t.value);
        state.model.baseDir = parsed.baseDir;
        state.model.filename = parsed.filename;
        state.model.alias = parsed.alias;
        state.model.slug = parsed.slug;
        state.model.tokenizer = parsed.tokenizer;
        state.model.weightGb = parsed.weightGb;
        state.model.paramsB = parsed.paramsB;
        ["alias", "slug", "tokenizer", "weightGb", "paramsB"].forEach((k) => {
          const el = document.querySelector(`[data-model-field="${k}"]`);
          if (el && document.activeElement !== el) el.value = state.model[k];
        });
      } else {
        state.model[f] = t.type === "number" ? Number(t.value) || 0 : t.value;
      }
      persistState();
      refreshLiveDom();
      return;
    }
    if (t.dataset.suiteId && t.dataset.suiteField && t.tagName !== "SELECT" && t.type !== "checkbox") {
      const sid = t.dataset.suiteId;
      const fld = t.dataset.suiteField;
      state.suites[sid][fld] = t.type === "number" ? Number(t.value) || 0 : t.value;
      if (sid === "speed_bench" && fld === "c") {
        const strC = String(state.suites.speed_bench.c);
        state.suites.speed_bench.contextPreset = ["16384", "32768", "65536"].includes(strC) ? strC : "custom";
        const sel = document.querySelector(`[data-suite-id="speed_bench"][data-suite-field="contextPreset"]`);
        if (sel) sel.value = state.suites.speed_bench.contextPreset;
      }
      persistState();
      refreshLiveDom();
      return;
    }
    if (t.dataset.sshField) {
      const f = t.dataset.sshField;
      state.ssh[f] = t.type === "number" ? Number(t.value) || 0 : t.value;
      persistState();
      refreshLiveDom();
    }
  });

  document.addEventListener("dragover", (ev) => {
    const dz = ev.target.closest("#audit-dropzone");
    if (dz) {
      ev.preventDefault();
      dz.classList.add("dragover");
    }
  });
  document.addEventListener("dragleave", (ev) => {
    const dz = ev.target.closest("#audit-dropzone");
    if (dz) dz.classList.remove("dragover");
  });
  document.addEventListener("drop", async (ev) => {
    const dz = ev.target.closest("#audit-dropzone");
    if (!dz) return;
    ev.preventDefault();
    dz.classList.remove("dragover");
    const items = ev.dataTransfer?.items;
    if (items && items.length && items[0].webkitGetAsEntry) {
      const entries = [];
      for (const item of Array.from(items)) {
        const entry = item.webkitGetAsEntry();
        if (entry) await readDroppedEntry(entry, entries);
      }
      await handleAuditEntries(entries);
    } else if (ev.dataTransfer?.files?.length) {
      await handleAuditFiles(ev.dataTransfer.files);
    }
  });

  /* ---------- Floating Hover Tooltip Popup ---------- */
  let tipEl = null;
  function ensureTooltipEl() {
    if (tipEl) return tipEl;
    tipEl = document.getElementById("sb-floating-tooltip");
    if (!tipEl) {
      tipEl = document.createElement("div");
      tipEl.id = "sb-floating-tooltip";
      tipEl.className = "sb-floating-tooltip";
      tipEl.setAttribute("role", "tooltip");
      document.body.appendChild(tipEl);
    }
    return tipEl;
  }

  function showTooltipFor(targetEl) {
    if (!targetEl) return;
    const key = targetEl.getAttribute("data-tip");
    const info = key && D.HELP_TOOLTIPS ? D.HELP_TOOLTIPS[key] : null;
    if (!info) return;

    const el = ensureTooltipEl();
    el.innerHTML = `
      <div class="sb-tip-title">${esc(info.title)}</div>
      <div class="sb-tip-desc">${esc(info.desc)}</div>
      ${info.rec ? `<div class="sb-tip-rec">${esc(info.rec)}</div>` : ""}
    `;
    el.classList.add("visible");

    if (typeof targetEl.getBoundingClientRect === "function") {
      const rect = targetEl.getBoundingClientRect();
      const vw = global.innerWidth || 1200;
      const vh = global.innerHeight || 800;
      const tipW = 360;
      const tipH = el.offsetHeight || 110;
      let left = Math.max(10, Math.min(rect.left, vw - tipW - 14));
      let top = rect.bottom + 8;
      if (top + tipH > vh - 10 && rect.top > tipH + 16) {
        top = rect.top - tipH - 8;
      }
      el.style.left = `${Math.round(left)}px`;
      el.style.top = `${Math.round(top)}px`;
    }
  }

  function hideTooltip() {
    if (tipEl) tipEl.classList.remove("visible");
  }

  document.addEventListener("mouseover", (ev) => {
    const t = ev.target && ev.target.closest ? ev.target.closest("[data-tip]") : null;
    if (t) showTooltipFor(t);
    else hideTooltip();
  });

  document.addEventListener("mouseout", (ev) => {
    const related = ev.relatedTarget && ev.relatedTarget.closest ? ev.relatedTarget.closest("[data-tip]") : null;
    if (!related) hideTooltip();
  });

  function init() {
    applyThemeAndStealth();
    renderApp();
    try {
      E.loadSnapshotIDB("latest_state").then((snap) => {
        if (snap && snap.schemaVersion && !localStorage.getItem(E.STORAGE_KEY)) {
          state = E.loadState();
          renderApp();
        }
      });
    } catch {
      /* ignore */
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : globalThis);

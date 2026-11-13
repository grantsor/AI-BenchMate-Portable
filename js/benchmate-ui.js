/* ==========================================================================
   AI Benchmate — Portable Edition UI Renderer (3-Tab Clean Card Architecture)
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

  /* ---------- Renderers ---------- */
  function renderGuardrailsHtml() {
    const { warnings } = E.evaluateGuardrails(state);
    if (!warnings.length) return "";
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

  function renderFieldInput(suiteId, field, label, type, val, attrs) {
    return `<div class="sb-field">
      <label>${esc(label)}</label>
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
      <label>${esc(label)}</label>
      <select class="sb-select" data-suite-id="${esc(suiteId)}" data-suite-field="${esc(field)}">${opts}</select>
    </div>`;
  }

  function renderFieldCheck(suiteId, field, label, checked) {
    return `<div class="sb-field">
      <label>${esc(label)}</label>
      <label class="sb-field-inline" style="height:32px">
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
      return (
        renderFieldInput(suiteId, "ngl", "-ngl", "number", s.ngl) +
        renderFieldSelect(suiteId, "fa", "-fa", s.fa, faOpts) +
        renderFieldInput(suiteId, "p", "-p (Prompt Sizes)", "text", s.p) +
        renderFieldInput(suiteId, "n", "-n (Gen Tokens)", "text", s.n) +
        renderFieldInput(suiteId, "r", "-r (Repetitions)", "number", s.r) +
        renderFieldInput(suiteId, "b", "-b (Batch)", "number", s.b) +
        renderFieldInput(suiteId, "ub", "-ub (uBatch)", "number", s.ub) +
        renderFieldSelect(suiteId, "format", "-o Format", s.format, ["md", "json", "csv"])
      );
    }
    if (suiteId === "llama_benchy") {
      return (
        renderFieldInput(suiteId, "c", "Server -c", "number", s.c) +
        renderFieldInput(suiteId, "np", "Server -np", "number", s.np) +
        renderFieldSelect(suiteId, "ctk", "-ctk", s.ctk, kvOpts) +
        renderFieldSelect(suiteId, "ctv", "-ctv", s.ctv, kvOpts) +
        renderFieldSelect(suiteId, "fa", "-fa", s.fa, faOpts) +
        renderFieldInput(suiteId, "pp", "--pp", "text", s.pp) +
        renderFieldInput(suiteId, "tg", "--tg", "text", s.tg) +
        renderFieldInput(suiteId, "depth", "--depth", "text", s.depth) +
        renderFieldInput(suiteId, "runs", "--runs", "number", s.runs)
      );
    }
    if (suiteId === "llmperf") {
      return (
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
      );
    }
    if (suiteId === "speed_bench") {
      return (
        renderFieldSelect(suiteId, "contextPreset", "Server Context (-c)", s.contextPreset || String(s.c), [
          { value: "16384", label: "16K (16384)" },
          { value: "32768", label: "32K (32768)" },
          { value: "65536", label: "64K (65536)" }
        ]) +
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
      );
    }
    if (suiteId === "agentperf") {
      return (
        renderFieldInput(suiteId, "c", "Server -c", "number", s.c) +
        renderFieldInput(suiteId, "np", "Server -np", "number", s.np) +
        renderFieldSelect(suiteId, "ctk", "-ctk", s.ctk, kvOpts) +
        renderFieldSelect(suiteId, "ctv", "-ctv", s.ctv, kvOpts) +
        renderFieldSelect(suiteId, "fa", "-fa", s.fa, faOpts) +
        renderFieldInput(suiteId, "extraFlags", "Extra Client Flags", "text", s.extraFlags || "")
      );
    }
    if (suiteId === "aiperf_std") {
      return (
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
      );
    }
    if (suiteId === "aiperf_sweep") {
      return (
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
      );
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
      ? `<div class="sb-field"><label>Device (-dev)</label><input type="text" class="sb-input" data-hw-field="nvidiaDevice" value="${esc(state.hardware.nvidiaDevice || "")}" /></div>
         <div class="sb-field"><label>Tensor Split (-ts)</label><input type="text" class="sb-input" data-hw-field="tensorSplit" value="${esc(state.hardware.tensorSplit || "")}" placeholder="e.g. 1,1" /></div>`
      : "";

    return `<div class="sb-drawer">
      <div class="sb-form-grid">
        <div class="sb-field"><label>Llama Bin Dir</label><input type="text" class="sb-input" data-hw-field="binDir" value="${esc(state.hardware.binDir)}" /></div>
        <div class="sb-field"><label>Repo Dir</label><input type="text" class="sb-input" data-hw-field="repoDir" value="${esc(state.hardware.repoDir)}" /></div>
        <div class="sb-field"><label>Bench Root</label><input type="text" class="sb-input" data-hw-field="benchRoot" value="${esc(state.hardware.benchRoot)}" /></div>
        <div class="sb-field"><label>Results Dir</label><input type="text" class="sb-input" data-hw-field="resultsDir" value="${esc(state.hardware.resultsDir)}" /></div>
        <div class="sb-field"><label>Model Alias</label><input type="text" class="sb-input" data-model-field="alias" value="${esc(state.model.alias)}" /></div>
        <div class="sb-field"><label>Output Slug</label><input type="text" class="sb-input" data-model-field="slug" value="${esc(state.model.slug)}" /></div>
        <div class="sb-field"><label>Tokenizer ID</label><input type="text" class="sb-input" data-model-field="tokenizer" value="${esc(state.model.tokenizer)}" /></div>
        <div class="sb-field"><label>Weight (GB)</label><input type="number" step="0.1" class="sb-input" data-model-field="weightGb" value="${esc(state.model.weightGb)}" /></div>
        <div class="sb-field"><label>Params (B)</label><input type="number" step="0.5" class="sb-input" data-model-field="paramsB" value="${esc(state.model.paramsB)}" /></div>
        <div class="sb-field"><label>Server Host</label><input type="text" class="sb-input" data-hw-field="host" value="${esc(state.hardware.host)}" /></div>
        <div class="sb-field"><label>Server Port</label><input type="number" class="sb-input" data-hw-field="port" value="${esc(state.hardware.port)}" /></div>
        <div class="sb-field">
          <label>Client --model Flag</label>
          <select class="sb-select" data-model-field="clientModelMode">
            <option value="alias" ${state.model.clientModelMode === "alias" ? "selected" : ""}>Alias (--alias)</option>
            <option value="fullPath" ${state.model.clientModelMode === "fullPath" ? "selected" : ""}>Full GGUF Path</option>
          </select>
        </div>
        <div class="sb-field">
          <label>Filename Naming</label>
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
        <button type="button" class="btn btn-sm btn-danger" data-action="reset-all-suites">Reset Parity Defaults</button>
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

    const amdBackendSelect =
      profile.id === "amd_win_x64"
        ? `<label class="sb-field-inline">Backend
             <select class="sb-select" data-action="change-amd-backend">
               <option value="vulkan" ${state.hardware.amdBackend === "vulkan" ? "selected" : ""}>Vulkan</option>
               <option value="rocm" ${state.hardware.amdBackend === "rocm" ? "selected" : ""}>ROCm HIP</option>
             </select>
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

      const modBadge = modified
        ? `<span class="sb-badge sb-badge-warn" data-suite-mod="${esc(meta.id)}">Modified</span>`
        : `<span class="sb-badge sb-badge-warn" data-suite-mod="${esc(meta.id)}" style="display:none">Modified</span>`;

      const resetBtn = modified
        ? `<button type="button" class="btn btn-sm btn-danger" data-reset-suite="${esc(meta.id)}">Reset</button>`
        : "";

      const copyServerBtn = meta.hasServer
        ? `<button type="button" class="btn btn-sm btn-outline" data-copy-server="${esc(meta.id)}">Copy Server</button>`
        : "";

      const serverBox = meta.hasServer
        ? `<div class="sb-terminal-wrap">
             <div class="sb-terminal-bar">
               <span>Terminal 1 — Server</span>
               <button type="button" class="btn btn-sm" data-copy-server="${esc(meta.id)}">Copy</button>
             </div>
             <pre class="sb-terminal-pre" data-server-pre="${esc(meta.id)}">${E.highlightShell(serverCmd)}</pre>
           </div>`
        : "";

      const drawerHtml = expanded
        ? `<div class="sb-drawer"><div class="sb-form-grid">${renderSuiteDrawerFields(meta.id)}</div></div>`
        : "";

      return `<div class="suite-card" data-suite-card="${esc(meta.id)}">
        <div class="suite-card-header">
          <div class="suite-card-title">
            <span class="suite-card-num">${esc(meta.index)}</span>
            <span>${esc(meta.title)}</span>
            <code class="suite-output-tag" data-output-tag="${esc(meta.id)}">-&gt; ${esc(target.leaf)}</code>
            ${modBadge}
          </div>
          <div class="suite-card-actions">
            <button type="button" class="btn btn-sm" data-toggle-drawer="${esc(meta.id)}">Parameters ${expanded ? "&#9652;" : "&#9662;"}</button>
            ${resetBtn}
            ${copyServerBtn}
            <button type="button" class="btn btn-sm btn-primary" data-copy-client="${esc(meta.id)}">Copy Command</button>
          </div>
        </div>
        ${drawerHtml}
        <div class="suite-terminals-stack">
          ${serverBox}
          <div class="sb-terminal-wrap">
            <div class="sb-terminal-bar">
              <span>${meta.hasServer ? "Terminal 2 — Client" : "Command"}</span>
              <button type="button" class="btn btn-sm" data-copy-client="${esc(meta.id)}">Copy</button>
            </div>
            <pre class="sb-terminal-pre" data-client-pre="${esc(meta.id)}">${E.highlightShell(clientCmd)}</pre>
          </div>
        </div>
      </div>`;
    }).join("");

    const playbookExt = profile.shell === "powershell" ? ".ps1" : ".sh";

    return `
      <div class="config-section">
        <div class="config-bar">
          <label class="sb-field-inline">Platform
            <select class="sb-select" data-action="change-profile">${profileOpts}</select>
          </label>
          ${amdBackendSelect}
          <label class="sb-field-inline">VRAM (GB)
            <input type="number" class="sb-input" style="width:76px" data-hw-field="vramGb" value="${esc(state.hardware.vramGb)}" />
          </label>
          <div class="sb-pill-row">${quickChips}${customChips}</div>
          <button type="button" class="btn btn-sm btn-outline" style="margin-left:auto" data-action="toggle-paths-drawer">
            Paths &amp; Naming ${state.ui.showPathsAndNaming ? "&#9652;" : "&#9662;"}
          </button>
        </div>

        <div class="config-model-row">
          <label class="sb-field-inline" style="flex:1; min-width:260px;">Model (.gguf)
            <input type="text" class="sb-input sb-input-wide" data-model-field="fullPath" value="${esc(state.model.fullPath)}" />
          </label>
          <button type="button" class="btn btn-sm btn-outline" data-action="add-custom-model">+ Add Model</button>
        </div>

        ${renderPathsDrawer()}
      </div>

      <div id="guardrails-root">${renderGuardrailsHtml()}</div>

      <div class="suite-list">${suiteCardsHtml}</div>

      <div class="playbook-footer">
        <span class="playbook-footer-title">Full Playbook (${esc(profile.shortName)} · ${esc(state.model.alias || state.model.slug)})</span>
        <div class="playbook-footer-actions">
          <button type="button" class="btn btn-sm btn-outline" data-action="copy-playbook">Copy Playbook</button>
          <button type="button" class="btn btn-sm btn-primary" data-action="download-playbook">Download ${esc(playbookExt)}</button>
        </div>
      </div>
    `;
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
      const detail = item ? item.detail : `Expected: ${target.leaf}`;
      return `<tr>
        <td><strong>${esc(meta.index)} ${esc(meta.title)}</strong></td>
        <td><code>${esc(target.leaf)}</code></td>
        <td><span class="sb-badge ${badgeClass}">${esc(statusLabel)}</span></td>
        <td>${esc(detail)}</td>
      </tr>`;
    }).join("");

    const activeRecords = [
      ...(state.results.includeSampleData ? D.SAMPLE_RESULTS_DATASET : []),
      ...(state.results.loadedRecords || [])
    ];

    const recordRows = activeRecords.length
      ? activeRecords
          .map((r) => {
            const mStr = Object.entries(r.metrics || {})
              .map(([k, v]) => `${k}: ${v}`)
              .join(" · ");
            return `<tr>
              <td><code>${esc(r.suiteType)}</code></td>
              <td>${esc(r.gpuLabel)}</td>
              <td>${esc(r.modelLabel)}</td>
              <td><code>${esc(mStr)}</code></td>
              <td>${esc(r.sourceFile)}</td>
            </tr>`;
          })
          .join("")
      : `<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">Load .md/.json output files or toggle the DGX vs R9700 sample dataset.</td></tr>`;

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

    const deepAuditCmd = E.buildDeepAuditScript(state);

    return `
      <div class="config-section">
        <div class="sb-inline-row">
          <h2 class="sb-section-title" style="margin:0">Results Folder Audit</h2>
          <label class="btn btn-sm btn-primary" style="cursor:pointer">
            Select Folder
            <input type="file" id="audit-dir-input" webkitdirectory directory multiple style="display:none" />
          </label>
          <label class="btn btn-sm btn-outline" style="cursor:pointer">
            Select Files
            <input type="file" id="audit-files-input" multiple accept=".md,.json,.log" style="display:none" />
          </label>
          ${state.audit.lastFolderName ? `<span class="sb-badge">${esc(state.audit.lastFolderName)}</span>` : ""}
          ${Object.keys(state.audit.items || {}).length ? `<button type="button" class="btn btn-sm btn-danger" data-action="clear-audit">Clear Audit</button>` : ""}
        </div>

        <div class="sb-dropzone" id="audit-dropzone">Drop a benchmark results folder or .md / .json / .log files here</div>

        <div class="sb-table-wrap">
          <table class="sb-table">
            <thead><tr><th>Suite</th><th>Target Output</th><th>Status</th><th>Audit Detail</th></tr></thead>
            <tbody>${auditRows}</tbody>
          </table>
        </div>

        <div class="sb-terminal-wrap">
          <div class="sb-terminal-bar">
            <span>Deep Audit Script (1 KB Stub Verification)</span>
            <button type="button" class="btn btn-sm" data-action="copy-deep-audit">Copy</button>
          </div>
          <pre class="sb-terminal-pre" id="deep-audit-pre">${E.highlightShell(deepAuditCmd)}</pre>
        </div>
      </div>

      <div>
        <div class="sb-inline-row">
          <h2 class="sb-section-title" style="margin:0">Comparison Matrix</h2>
          <button type="button" class="btn btn-sm ${state.results.includeSampleData ? "btn-primary" : "btn-outline"}" data-action="toggle-sample-data">
            ${state.results.includeSampleData ? "Hide Sample (DGX vs R9700)" : "Load Sample (DGX vs R9700)"}
          </button>
          <label class="btn btn-sm btn-outline" style="cursor:pointer">
            Upload .md / .json
            <input type="file" id="compare-files-input" multiple accept=".md,.json" style="display:none" />
          </label>
          <button type="button" class="btn btn-sm" data-action="toggle-charts">${state.ui.showCharts ? "Hide Charts" : "Show Charts"}</button>
          <button type="button" class="btn btn-sm" data-action="export-md">Export .md</button>
          <button type="button" class="btn btn-sm" data-action="export-csv">Export .csv</button>
          ${(state.results.loadedRecords || []).length ? `<button type="button" class="btn btn-sm btn-danger" data-action="clear-loaded-records">Clear Uploaded</button>` : ""}
        </div>

        ${chartsHtml}

        <div class="sb-table-wrap">
          <table class="sb-table">
            <thead><tr><th>Suite</th><th>GPU / Backend</th><th>Model</th><th>Metrics</th><th>Source</th></tr></thead>
            <tbody>${recordRows}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderSshCardsHtml() {
    const sshCmds = E.buildSshCommands(state);
    const setupCards = E.buildSetupCards(state).filter((c) => {
      const isWin = D.HARDWARE_PROFILES[state.hardware.profileId].os === "windows";
      return isWin || c.id !== "setup_cleanup";
    });

    const cards = [
      { id: "psTrigger", title: "Windows PowerShell SSH Trigger", cmd: sshCmds.psTrigger },
      { id: "tmuxLaunch", title: "tmux Split Session", cmd: sshCmds.tmuxLaunch },
      { id: "scpPull", title: "scp Pull Remote Results", cmd: sshCmds.scpPull },
      { id: "vramSweep", title: "DGX Pre-Benchmark VRAM Sweep", cmd: sshCmds.vramSweep },
      { id: "startAiRestore", title: "Restore start-ai Stack (DGX)", cmd: sshCmds.startAiRestore },
      ...setupCards.map((c) => ({ id: c.id, title: c.title, cmd: c.cmd }))
    ];

    return cards
      .map(
        (c) =>
          `<div class="sb-terminal-wrap">
            <div class="sb-terminal-bar">
              <span>${esc(c.title)}</span>
              <button type="button" class="btn btn-sm" data-copy-ssh="${esc(c.id)}">Copy</button>
            </div>
            <pre class="sb-terminal-pre" data-ssh-pre="${esc(c.id)}">${E.highlightShell(c.cmd)}</pre>
          </div>`
      )
      .join("");
  }

  function renderSshTab() {
    const s = state.ssh;
    return `
      <div class="config-section">
        <div class="sb-form-grid">
          <div class="sb-field"><label>SSH User</label><input type="text" class="sb-input" data-ssh-field="user" value="${esc(s.user)}" /></div>
          <div class="sb-field"><label>SSH Host / IP</label><input type="text" class="sb-input" data-ssh-field="host" value="${esc(s.host)}" /></div>
          <div class="sb-field"><label>SSH Port</label><input type="number" class="sb-input" data-ssh-field="port" value="${esc(s.port)}" /></div>
          <div class="sb-field"><label>tmux Session</label><input type="text" class="sb-input" data-ssh-field="tmuxSession" value="${esc(s.tmuxSession)}" /></div>
          <div class="sb-field"><label>Remote Results Dir</label><input type="text" class="sb-input" data-ssh-field="remoteResultsDir" value="${esc(s.remoteResultsDir)}" /></div>
          <div class="sb-field"><label>Local Pull Dir</label><input type="text" class="sb-input" data-ssh-field="localPullDir" value="${esc(s.localPullDir)}" /></div>
          <div class="sb-field"><label>Hermes Server IP</label><input type="text" class="sb-input" data-ssh-field="hermesServerIp" value="${esc(s.hermesServerIp)}" /></div>
        </div>
      </div>
      <div class="ssh-stack" id="ssh-cards-root">${renderSshCardsHtml()}</div>
    `;
  }

  function refreshLiveDom() {
    const profile = D.HARDWARE_PROFILES[state.hardware.profileId];
    const pillPlat = document.getElementById("pill-platform");
    const pillVram = document.getElementById("pill-vram");
    const pillModel = document.getElementById("pill-model");
    if (pillPlat) pillPlat.innerHTML = `platform: <strong>${esc(profile.shortName)}</strong>`;
    if (pillVram) pillVram.innerHTML = `vram: <strong>${esc(state.hardware.vramGb)} GB</strong>`;
    if (pillModel) pillModel.innerHTML = `model: <strong>${esc(state.model.alias || state.model.slug)}</strong>`;

    if (state.ui.activeTab === "benchmarks") {
      const guardRoot = document.getElementById("guardrails-root");
      if (guardRoot) guardRoot.innerHTML = renderGuardrailsHtml();

      D.SUITE_METADATA.forEach((meta) => {
        const target = E.getOutputTarget(state, meta.id);
        const mod = E.isSuiteCustomized(state, meta.id);
        const tagEl = document.querySelector(`[data-output-tag="${meta.id}"]`);
        if (tagEl) tagEl.textContent = `-> ${target.leaf}`;
        const modEl = document.querySelector(`[data-suite-mod="${meta.id}"]`);
        if (modEl) modEl.style.display = mod ? "inline-flex" : "none";

        const sPre = document.querySelector(`[data-server-pre="${meta.id}"]`);
        if (sPre && meta.hasServer) sPre.innerHTML = E.highlightShell(E.buildServerCommand(state, meta.id));
        const cPre = document.querySelector(`[data-client-pre="${meta.id}"]`);
        if (cPre) cPre.innerHTML = E.highlightShell(E.buildSuiteClientCommand(state, meta.id));
      });
    } else if (state.ui.activeTab === "ssh") {
      const sshRoot = document.getElementById("ssh-cards-root");
      if (sshRoot) sshRoot.innerHTML = renderSshCardsHtml();
    } else if (state.ui.activeTab === "results") {
      const deepPre = document.getElementById("deep-audit-pre");
      if (deepPre) deepPre.innerHTML = E.highlightShell(E.buildDeepAuditScript(state));
    }
  }

  function renderApp() {
    applyThemeAndStealth();
    const root = document.getElementById("app");
    if (!root) return;

    const profile = D.HARDWARE_PROFILES[state.hardware.profileId];
    const tab = state.ui.activeTab || "benchmarks";

    let bodyHtml = "";
    if (tab === "benchmarks") bodyHtml = renderBenchmarksTab();
    else if (tab === "results") bodyHtml = renderResultsTab();
    else bodyHtml = renderSshTab();

    root.innerHTML = `
      <div class="sb-container">
        <header class="sb-header">
          <div class="sb-brand-cluster">
            <span class="sb-brand">ai-benchmate</span>
            <span class="sb-version">1.0.0</span>
            <span class="sb-pill" id="pill-platform">platform: <strong>${esc(profile.shortName)}</strong></span>
            <span class="sb-pill" id="pill-vram">vram: <strong>${esc(state.hardware.vramGb)} GB</strong></span>
            <span class="sb-pill" id="pill-model">model: <strong>${esc(state.model.alias || state.model.slug)}</strong></span>
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
          <button type="button" class="folder-tab ${tab === "benchmarks" ? "active" : ""}" data-tab="benchmarks">Benchmarks</button>
          <button type="button" class="folder-tab ${tab === "results" ? "active" : ""}" data-tab="results">Results &amp; Audit</button>
          <button type="button" class="folder-tab ${tab === "ssh" ? "active" : ""}" data-tab="ssh">SSH &amp; Setup</button>
        </nav>

        <main class="sb-card">${bodyHtml}</main>
      </div>
    `;
  }

  /* ---------- Event Delegation ---------- */
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
      if (state.naming.activePresetName === t.dataset.deletePreset) state.naming.activePresetName = "Baseline Parity Defaults";
      persistState();
      renderApp();
      return;
    }
    if (t.dataset.action === "reset-all-suites") {
      state.suites = JSON.parse(JSON.stringify(D.PARITY_DEFAULTS));
      state.naming.activePresetName = "Baseline Parity Defaults";
      persistState();
      renderApp();
      return;
    }
    if (t.dataset.autofix) {
      applyAutoFix(t.dataset.autofix);
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
    if (t.dataset.action === "copy-playbook") {
      copyText(E.buildAllInOnePlaybook(state, false), t);
      return;
    }
    if (t.dataset.action === "download-playbook") {
      const profile = D.HARDWARE_PROFILES[state.hardware.profileId];
      const ext = profile.shell === "powershell" ? "ps1" : "sh";
      downloadText(`benchmate_${state.model.slug || "run"}.${ext}`, E.buildAllInOnePlaybook(state, false));
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
    if (t.dataset.action === "toggle-sample-data") {
      state.results.includeSampleData = !state.results.includeSampleData;
      persistState();
      renderApp();
      return;
    }
    if (t.dataset.action === "toggle-charts") {
      state.ui.showCharts = !state.ui.showCharts;
      persistState();
      renderApp();
      return;
    }
    if (t.dataset.action === "export-md") {
      const recs = [...(state.results.includeSampleData ? D.SAMPLE_RESULTS_DATASET : []), ...(state.results.loadedRecords || [])];
      downloadText("ai_benchmate_comparison.md", E.exportComparisonMarkdown(recs));
      return;
    }
    if (t.dataset.action === "export-csv") {
      const recs = [...(state.results.includeSampleData ? D.SAMPLE_RESULTS_DATASET : []), ...(state.results.loadedRecords || [])];
      downloadText("ai_benchmate_comparison.csv", E.exportComparisonCsv(recs));
      return;
    }
    if (t.dataset.action === "clear-loaded-records") {
      state.results.loadedRecords = [];
      persistState();
      renderApp();
      return;
    }
    if (t.dataset.copySsh) {
      const key = t.dataset.copySsh;
      const sshCmds = E.buildSshCommands(state);
      const setupMatch = E.buildSetupCards(state).find((c) => c.id === key);
      const cmd = sshCmds[key] || (setupMatch ? setupMatch.cmd : "");
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
    if (t.dataset.action === "change-amd-backend") {
      state.hardware.amdBackend = t.value;
      state.hardware.binDir = t.value === "rocm" ? "C:\\llama.cpp\\rocm" : "C:\\llama.cpp\\vulkan";
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
        if (sid === "speed_bench" && fld === "contextPreset") {
          state.suites.speed_bench.c = Number(t.value) || 32768;
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

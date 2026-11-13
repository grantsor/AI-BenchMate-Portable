/* ==========================================================================
   AI Benchmate — Clean sparkbench-Inspired Portable UI (Vanilla JS)
   100% Universal Persistence (localStorage + IndexedDB)
   Works identically via file:// double-click AND HTTP local server
   ========================================================================== */
(function (global) {
  "use strict";

  const Data = global.BenchmateData;
  const Engine = global.BenchmateEngine;

  let state = Engine.loadState();

  function persist() {
    Engine.saveState(state);
  }

  function applyThemeAndMotion() {
    const html = document.documentElement;
    let resolved = state.ui.theme || "light";
    if (resolved === "system") {
      resolved = global.matchMedia && global.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    html.setAttribute("data-theme", resolved);
    html.setAttribute("data-light-terminal", state.ui.lightTerminal ? "true" : "false");
    html.classList.toggle("pause-animations", Boolean(state.ui.pauseAnimations));
  }

  function esc(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function copyText(btn, text, origLabel) {
    const done = () => {
      if (!btn) return;
      btn.classList.add("copied");
      btn.textContent = "Copied!";
      setTimeout(() => {
        btn.classList.remove("copied");
        btn.textContent = origLabel || "Copy";
      }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, cb) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (_) {}
    document.body.removeChild(ta);
    if (cb) cb();
  }

  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  // Preserves focus when typing inside text inputs
  function refreshLiveDom() {
    const preRun = document.getElementById("run-terminal-pre");
    if (preRun) {
      preRun.innerHTML = Engine.highlightShell(Engine.buildSelectedSuitesPreview(state));
    }
    const barRun = document.getElementById("run-terminal-meta");
    if (barRun) {
      const prof = Data.HARDWARE_PROFILES[state.hardware.profileId];
      barRun.textContent = `${state.ui.previewMode || "selected"} · ${prof.shell} · ${state.model.alias}`;
    }
    const preRem = document.getElementById("remote-terminal-pre");
    if (preRem) {
      preRem.innerHTML = Engine.highlightShell(getActiveRemoteCode());
    }
    const grHost = document.getElementById("run-guardrails-host");
    if (grHost) {
      grHost.innerHTML = renderGuardrailsHtml();
      bindGuardrailButtons(grHost);
    }
    const pillRow = document.getElementById("header-pills-host");
    if (pillRow) {
      pillRow.innerHTML = renderHeaderPillsInner();
    }
  }

  function selectQuickModel(qm) {
    const profile = Data.HARDWARE_PROFILES[state.hardware.profileId];
    const sep = profile.os === "windows" ? "\\" : "/";
    const rel = profile.os === "windows" ? qm.relativeWin : qm.relativeLinux;
    state.model.fullPath = Engine.joinPath(profile.defaultModelsDir, rel, sep);
    state.model.baseDir = profile.defaultModelsDir;
    state.model.filename = rel;
    state.model.alias = qm.alias;
    state.model.slug = qm.slug;
    state.model.tokenizer = qm.tokenizer;
    state.model.weightGb = qm.weightGb;
    state.model.paramsB = qm.paramsB;
    persist();
    renderApp();
  }

  function selectModelById(modelId) {
    const quick = Data.QUICK_MODELS.find((m) => m.id === modelId);
    if (quick) {
      selectQuickModel(quick);
      return;
    }
    if (modelId.startsWith("custom_")) {
      const idx = parseInt(modelId.replace("custom_", ""), 10);
      const cm = (state.customModels || [])[idx];
      if (cm) {
        state.model = { ...state.model, ...cm };
        persist();
        renderApp();
      }
    }
  }

  function switchHardwareProfile(newProfileId) {
    const prevProfile = Data.HARDWARE_PROFILES[state.hardware.profileId];
    const nextProfile = Data.HARDWARE_PROFILES[newProfileId];
    if (!nextProfile) return;

    state.hardware.profileId = nextProfile.id;
    state.hardware.vramGb = nextProfile.defaultVramGb;
    state.hardware.binDir = nextProfile.defaultBinDir;
    state.hardware.repoDir = nextProfile.defaultRepoDir;
    state.hardware.benchRoot = nextProfile.defaultBenchRoot;
    state.hardware.resultsDir = nextProfile.defaultResultsDir;
    if (nextProfile.deviceFlag) state.hardware.nvidiaDevice = nextProfile.deviceFlag;

    const sep = nextProfile.os === "windows" ? "\\" : "/";
    const matchQuick = Data.QUICK_MODELS.find((m) => m.alias === state.model.alias);
    if (matchQuick) {
      const rel = nextProfile.os === "windows" ? matchQuick.relativeWin : matchQuick.relativeLinux;
      state.model.fullPath = Engine.joinPath(nextProfile.defaultModelsDir, rel, sep);
    } else if (prevProfile.os !== nextProfile.os) {
      const filenameOnly = (state.model.filename || "model.gguf").split(/[\\/]+/).pop();
      state.model.fullPath = Engine.joinPath(nextProfile.defaultModelsDir, filenameOnly, sep);
    }
    const parsed = Engine.parseModelPath(state.model.fullPath);
    state.model.baseDir = parsed.baseDir;
    state.model.filename = parsed.filename;
    persist();
    renderApp();
  }

  function renderHeaderPillsInner() {
    const profile = Data.HARDWARE_PROFILES[state.hardware.profileId];
    const vramGb = Number(state.hardware.vramGb) || profile.defaultVramGb;
    const budget = (vramGb * 0.9).toFixed(1);
    const poolType = profile.os === "linux" ? "unified" : "discrete";
    return `
      <span class="sb-pill">platform: <strong>${esc(profile.id)}</strong></span>
      <span class="sb-pill">memory: <strong>${poolType} ${vramGb} GiB</strong></span>
      <span class="sb-pill">binding: <strong>system_usable ${budget} GiB</strong></span>
      <span class="sb-pill sb-pill-quiet">localhost only · publishes nothing</span>
    `;
  }

  function renderHeader() {
    return `
      <header class="sb-header">
        <div class="sb-brand-cluster">
          <span class="sb-brand">ai-benchmate</span>
          <span class="sb-version">1.0.0</span>
          <div class="sb-inline-row" id="header-pills-host" style="gap:6px;">
            ${renderHeaderPillsInner()}
          </div>
        </div>
        <div class="sb-header-controls">
          <button type="button" class="sb-ctrl-btn ${state.ui.pauseAnimations ? "is-active" : ""}" id="btn-stealth-mode" title="Pause Animations & Benchmark Stealth Mode">
            ${state.ui.pauseAnimations ? "Stealth: ON" : "Pause Animations"}
          </button>
          <select class="sb-ctrl-select" id="select-theme" aria-label="Theme">
            <option value="light" ${state.ui.theme === "light" ? "selected" : ""}>Light</option>
            <option value="dark" ${state.ui.theme === "dark" ? "selected" : ""}>Dark</option>
            <option value="system" ${state.ui.theme === "system" ? "selected" : ""}>System</option>
          </select>
        </div>
      </header>
    `;
  }

  function renderTabs() {
    const tabs = [
      { id: "system", label: "System" },
      { id: "models", label: "Models" },
      { id: "run", label: "Run" },
      { id: "results", label: "Results" },
      { id: "remote", label: "Remote & Setup" }
    ];
    return `
      <nav class="folder-tabs" aria-label="Primary Tabs">
        ${tabs.map((t) => `
          <button type="button" class="folder-tab ${state.ui.activeTab === t.id ? "active" : ""}" data-tab="${t.id}">
            ${esc(t.label)}
          </button>
        `).join("")}
      </nav>
    `;
  }

  // ---------- TAB 1: SYSTEM ----------
  function renderSystemTab() {
    const hw = state.hardware;
    const profile = Data.HARDWARE_PROFILES[hw.profileId];
    return `
      <h2 class="sb-section-title">System & Platform Configuration</h2>
      <div class="sb-form-grid">
        <div class="sb-field">
          <label>Target Compute Profile</label>
          <select class="sb-select" id="sys-profile-sel">
            ${Object.values(Data.HARDWARE_PROFILES).map((p) => `
              <option value="${p.id}" ${hw.profileId === p.id ? "selected" : ""}>${esc(p.name)} (${p.shell})</option>
            `).join("")}
          </select>
        </div>

        <div class="sb-field">
          <label>VRAM Capacity (GiB)</label>
          <input type="number" class="sb-input mono" id="sys-vram" value="${esc(hw.vramGb)}" min="4" max="512" />
        </div>

        ${hw.profileId === "amd_win_x64" ? `
          <div class="sb-field">
            <label>AMD Compute Backend</label>
            <select class="sb-select" id="sys-amd-backend">
              <option value="vulkan" ${hw.amdBackend === "vulkan" ? "selected" : ""}>Vulkan0 (Default)</option>
              <option value="rocm" ${hw.amdBackend === "rocm" ? "selected" : ""}>ROCm / HIP0</option>
            </select>
          </div>` : ""}

        ${profile.supportsMultiGpu ? `
          <div class="sb-field">
            <label>CUDA Device (--device)</label>
            <input type="text" class="sb-input mono" id="sys-nvidia-dev" value="${esc(hw.nvidiaDevice)}" />
          </div>
          <div class="sb-field">
            <label>Multi-GPU Tensor Split (Optional)</label>
            <input type="text" class="sb-input mono" id="sys-tensor-split" value="${esc(hw.tensorSplit)}" placeholder="0.5,0.5" />
          </div>` : ""}

        <div class="sb-field">
          <label>Server Host & Port</label>
          <div class="sb-inline-row" style="gap:6px; flex-wrap:nowrap;">
            <input type="text" class="sb-input mono" id="sys-host" value="${esc(hw.host)}" style="flex:1; min-width:90px;" />
            <input type="number" class="sb-input mono" id="sys-port" value="${esc(hw.port)}" style="width:82px;" />
          </div>
        </div>

        <div class="sb-field">
          <label>Dynamic Result Naming</label>
          <select class="sb-select" id="sys-naming-mode">
            <option value="auto" ${state.naming.mode === "auto" ? "selected" : ""}>Auto (Stamp on Customize)</option>
            <option value="stamped" ${state.naming.mode === "stamped" ? "selected" : ""}>Mode A · Parameter-Stamped</option>
            <option value="classic" ${state.naming.mode === "classic" ? "selected" : ""}>Mode B · Classic Parity</option>
          </select>
        </div>

        <div class="sb-field">
          <label>Client --model Argument</label>
          <select class="sb-select" id="sys-client-model-mode">
            <option value="alias" ${state.model.clientModelMode === "alias" ? "selected" : ""}>Served Alias (--alias)</option>
            <option value="fullpath" ${state.model.clientModelMode === "fullpath" ? "selected" : ""}>Full GGUF File Path</option>
          </select>
        </div>
      </div>

      <h3 class="sb-sub-title">Directory Paths</h3>
      <div class="sb-form-grid">
        <div class="sb-field"><label>llama.cpp Binaries</label><input type="text" class="sb-input mono" id="sys-bin-dir" value="${esc(hw.binDir)}" /></div>
        <div class="sb-field"><label>Centralized Results</label><input type="text" class="sb-input mono" id="sys-results-dir" value="${esc(hw.resultsDir)}" /></div>
        <div class="sb-field"><label>Benchmarks Root (Venvs)</label><input type="text" class="sb-input mono" id="sys-bench-root" value="${esc(hw.benchRoot)}" /></div>
        <div class="sb-field"><label>llama.cpp Repo Root</label><input type="text" class="sb-input mono" id="sys-repo-dir" value="${esc(hw.repoDir)}" /></div>
      </div>

      <div class="sb-inline-row" style="margin-top:16px; justify-content:space-between;">
        <div class="sb-inline-row">
          ${hw.profileId === "dgx_spark_linux_arm64" ? `<label class="suite-check-label"><input type="checkbox" id="sys-non-sudo" ${hw.nonSudoSetup ? "checked" : ""} /> Non-sudo setup (skip apt python3-dev)</label>` : ""}
          ${hw.profileId === "rtx_spark_win_arm64" ? `<label class="suite-check-label"><input type="checkbox" id="sys-rtx-tdigest" ${hw.rtxArmTdigestCompile ? "checked" : ""} /> Compile aiperf[tdigest] C extension</label>` : ""}
          ${hw.profileId === "amd_win_x64" && hw.amdBackend === "vulkan" ? `<label class="suite-check-label"><input type="checkbox" id="sys-amd-fa" ${hw.amdEnableFa ? "checked" : ""} /> Enable -fa 1 on Vulkan</label>` : ""}
          <label class="suite-check-label"><input type="checkbox" id="sys-light-term" ${state.ui.lightTerminal ? "checked" : ""} /> Light Terminal (#F0EFEA)</label>
        </div>
        <button type="button" class="btn btn-outline" id="btn-sys-reset-parity">Reset Suites to Parity Defaults</button>
      </div>
    `;
  }

  // ---------- TAB 2: MODELS ("What fits, and at what context") ----------
  function renderModelsTab() {
    const vramNum = Number(state.hardware.vramGb) || 64;
    const baseTiers = [16, 24, 32, 48, 64, 96, 128];
    if (!baseTiers.includes(vramNum)) baseTiers.push(vramNum);
    baseTiers.sort((a, b) => a - b);

    const rows = Engine.computeModelFitRows(state);
    const kv = state.ui.fitKv || "fp16";

    return `
      <h2 class="sb-section-title">What fits, and at what context</h2>

      <div class="sb-inline-row">
        <label class="sb-field-inline">
          <span>Tier</span>
          <select class="sb-select" id="models-tier-sel">
            ${baseTiers.map((t) => `<option value="${t}" ${vramNum === t ? "selected" : ""}>${t}</option>`).join("")}
          </select>
        </label>

        <label class="sb-field-inline">
          <span>KV</span>
          <select class="sb-select" id="models-kv-sel">
            <option value="fp16" ${kv === "fp16" ? "selected" : ""}>f16</option>
            <option value="q8_0" ${kv === "q8_0" ? "selected" : ""}>q8_0</option>
            <option value="q4_0" ${kv === "q4_0" ? "selected" : ""}>q4_0</option>
          </select>
        </label>

        <button type="button" class="btn btn-outline" id="btn-models-refresh">Refresh</button>
        <span class="small muted">Every answer is a model and a context. A fit at 2K is not a usable result. Click a row to select.</span>
      </div>

      <div class="sb-table-wrap">
        <table class="sb-table">
          <thead>
            <tr>
              <th>Model</th>
              <th>Quant</th>
              <th>Kind</th>
              <th class="num">Best ctx</th>
              <th class="num">Total</th>
              <th class="num">Budget</th>
              <th class="num">Headroom</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r) => {
              const isSelected = state.model.alias === r.rawModel.alias;
              const headroomStyle = r.fits ? "" : `style="color:var(--danger);font-weight:600;"`;
              return `
                <tr class="${isSelected ? "is-selected" : ""}" data-fit-model-id="${esc(r.id)}" title="Click to select ${esc(r.modelLabel)}">
                  <td>${esc(r.modelLabel)}</td>
                  <td class="mono">${esc(r.quant)}</td>
                  <td class="mono">${esc(r.kind)}</td>
                  <td class="num mono">${esc(r.bestCtxLabel)}</td>
                  <td class="num mono">${r.totalGib.toFixed(2)}</td>
                  <td class="num mono">${r.budgetGib.toFixed(1)}</td>
                  <td class="num mono" ${headroomStyle}>${r.headroomGib.toFixed(2)}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>

      <div class="sb-inline-row" style="margin-top:14px;">
        <span class="small muted" style="font-weight:600;">Custom .gguf:</span>
        <input type="text" class="sb-input sb-input-wide mono" id="inp-custom-gguf" value="${esc(state.model.fullPath)}" placeholder="Paste full Windows or Linux .gguf path to auto-fill alias & slug" />
        <button type="button" class="btn btn-outline" id="btn-save-custom-model">+ Save Model</button>
      </div>
    `;
  }

  // ---------- TAB 3: RUN ("Run benchmarks" — Screenshot 2) ----------
  function renderGuardrailsHtml() {
    const { warnings } = Engine.evaluateGuardrails(state);
    if (!warnings.length) return "";
    return warnings.map((w) => `
      <div class="sb-banner ${w.severity === "crimson" ? "sb-banner-danger" : "sb-banner-warn"}">
        <div>
          <strong>${esc(w.title)}:</strong> ${esc(w.detail)}
        </div>
        <button type="button" class="btn btn-sm btn-outline" data-guardrail-fix="${esc(w.id)}">${esc(w.fixLabel)}</button>
      </div>
    `).join("");
  }

  function bindGuardrailButtons(container) {
    container.querySelectorAll("[data-guardrail-fix]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const fixId = btn.getAttribute("data-guardrail-fix");
        if (fixId === "ctx_aiperf_sweep") {
          state.suites.aiperf_sweep.c = 70000;
          state.suites.aiperf_sweep.ctk = "q8_0";
          state.suites.aiperf_sweep.ctv = "q8_0";
        } else if (fixId === "ctx_benchy") {
          state.suites.llama_benchy.c = 70000;
        } else if (fixId === "vram_overflow") {
          const { vramEstimate } = Engine.evaluateGuardrails(state);
          const nextKv = vramEstimate.kvPrecision === "fp16" ? "q8_0" : "q4_0";
          ["llama_benchy", "llmperf", "speed_bench", "agentperf", "aiperf_std", "aiperf_sweep"].forEach((sid) => {
            state.suites[sid].ctk = nextKv;
            state.suites[sid].ctv = nextKv;
          });
        }
        persist();
        renderApp();
      });
    });
  }

  function renderParamCustomizerDrawer() {
    if (!state.ui.showParamCustomize) return "";
    const selected = state.ui.selectedRunSuites || [];
    const sBench = state.suites.llama_bench;
    const sBenchy = state.suites.llama_benchy;
    const sLlm = state.suites.llmperf;
    const sSb = state.suites.speed_bench;
    const sStd = state.suites.aiperf_std;
    const sSwp = state.suites.aiperf_sweep;

    return `
      <div class="sb-drawer">
        <div class="sb-inline-row" style="justify-content:space-between; margin-bottom:10px;">
          <strong style="font-size:13px;">Customize Model Fields, Naming & Active Suite Parameters</strong>
          <div class="sb-inline-row" style="gap:6px;">
            <button type="button" class="btn btn-sm btn-outline" id="btn-run-save-preset">+ Save Preset</button>
            <button type="button" class="btn btn-sm btn-outline" id="btn-run-reset-parity">Reset to Parity Defaults</button>
          </div>
        </div>

        <div class="sb-form-grid" style="margin-bottom:12px;">
          <div class="sb-field"><label>Model Alias (--alias)</label><input type="text" class="sb-input mono" id="run-mod-alias" value="${esc(state.model.alias)}" /></div>
          <div class="sb-field"><label>Output File Slug</label><input type="text" class="sb-input mono" id="run-mod-slug" value="${esc(state.model.slug)}" /></div>
          <div class="sb-field"><label>HF Tokenizer ID</label><input type="text" class="sb-input mono" id="run-mod-tok" value="${esc(state.model.tokenizer)}" /></div>
          <div class="sb-field">
            <label>Result Naming Mode</label>
            <select class="sb-select" id="run-naming-mode">
              <option value="auto" ${state.naming.mode === "auto" ? "selected" : ""}>Auto (Stamp on Customize)</option>
              <option value="stamped" ${state.naming.mode === "stamped" ? "selected" : ""}>Mode A · Parameter-Stamped</option>
              <option value="classic" ${state.naming.mode === "classic" ? "selected" : ""}>Mode B · Classic Parity</option>
            </select>
          </div>
        </div>

        <div class="sb-form-grid">
          ${selected.includes("llama_bench") ? `
            <div class="sb-field"><label>llama-bench (-p / -n / -r)</label>
              <div class="sb-inline-row" style="gap:6px;">
                <input type="text" class="sb-input mono" data-suite-field="llama_bench.p" value="${esc(sBench.p)}" style="width:92px;" />
                <input type="text" class="sb-input mono" data-suite-field="llama_bench.n" value="${esc(sBench.n)}" style="width:82px;" />
                <input type="number" class="sb-input mono" data-suite-field="llama_bench.r" value="${esc(sBench.r)}" style="width:58px;" />
              </div>
            </div>` : ""}

          ${selected.includes("llama_benchy") ? `
            <div class="sb-field"><label>llama-benchy (-c / depth / runs)</label>
              <div class="sb-inline-row" style="gap:6px;">
                <input type="number" class="sb-input mono" data-suite-field="llama_benchy.c" value="${esc(sBenchy.c)}" style="width:84px;" />
                <input type="text" class="sb-input mono" data-suite-field="llama_benchy.depth" value="${esc(sBenchy.depth)}" style="width:84px;" />
                <input type="number" class="sb-input mono" data-suite-field="llama_benchy.runs" value="${esc(sBenchy.runs)}" style="width:54px;" />
              </div>
            </div>` : ""}

          ${selected.includes("llmperf") ? `
            <div class="sb-field"><label>llmperf (in / out / conc / max)</label>
              <div class="sb-inline-row" style="gap:6px;">
                <input type="number" class="sb-input mono" data-suite-field="llmperf.meanInput" value="${esc(sLlm.meanInput)}" style="width:68px;" />
                <input type="number" class="sb-input mono" data-suite-field="llmperf.meanOutput" value="${esc(sLlm.meanOutput)}" style="width:64px;" />
                <input type="number" class="sb-input mono" data-suite-field="llmperf.concurrency" value="${esc(sLlm.concurrency)}" style="width:52px;" />
                <input type="number" class="sb-input mono" data-suite-field="llmperf.maxCompleted" value="${esc(sLlm.maxCompleted)}" style="width:54px;" />
              </div>
            </div>` : ""}

          ${selected.includes("speed_bench") ? `
            <div class="sb-field"><label>SPEED-Bench (-c / category / limit)</label>
              <div class="sb-inline-row" style="gap:6px;">
                <input type="number" class="sb-input mono" data-suite-field="speed_bench.c" value="${esc(sSb.c)}" style="width:82px;" />
                <input type="text" class="sb-input mono" data-suite-field="speed_bench.category" value="${esc(sSb.category)}" style="width:68px;" />
                <input type="number" class="sb-input mono" data-suite-field="speed_bench.limit" value="${esc(sSb.limit)}" style="width:54px;" />
              </div>
            </div>` : ""}

          ${selected.includes("aiperf_std") ? `
            <div class="sb-field"><label>AIPerf Standard (-c / conc / reqs)</label>
              <div class="sb-inline-row" style="gap:6px;">
                <input type="number" class="sb-input mono" data-suite-field="aiperf_std.c" value="${esc(sStd.c)}" style="width:82px;" />
                <input type="number" class="sb-input mono" data-suite-field="aiperf_std.concurrency" value="${esc(sStd.concurrency)}" style="width:54px;" />
                <input type="number" class="sb-input mono" data-suite-field="aiperf_std.requestCount" value="${esc(sStd.requestCount)}" style="width:60px;" />
              </div>
            </div>` : ""}

          ${selected.includes("aiperf_sweep") ? `
            <div class="sb-field"><label>AIPerf 64k (-c / KV / isl)</label>
              <div class="sb-inline-row" style="gap:6px;">
                <input type="number" class="sb-input mono" data-suite-field="aiperf_sweep.c" value="${esc(sSwp.c)}" style="width:82px;" />
                <select class="sb-select" id="run-sweep-kv" style="width:74px;">
                  <option value="fp16" ${sSwp.ctk === "fp16" ? "selected" : ""}>fp16</option>
                  <option value="q8_0" ${sSwp.ctk === "q8_0" ? "selected" : ""}>q8_0</option>
                  <option value="q4_0" ${sSwp.ctk === "q4_0" ? "selected" : ""}>q4_0</option>
                </select>
                <input type="text" class="sb-input mono" data-suite-field="aiperf_sweep.islList" value="${esc(sSwp.islList)}" style="width:140px;" />
              </div>
            </div>` : ""}
        </div>
      </div>
    `;
  }

  function renderRunTab() {
    const profile = Data.HARDWARE_PROFILES[state.hardware.profileId];
    const auditItems = state.audit.items || {};
    const suiteOrder = ["agentperf", "aiperf_std", "aiperf_sweep", "llama_bench", "llama_benchy", "llmperf", "speed_bench"];
    const metaMap = {};
    Data.SUITE_METADATA.forEach((m) => { metaMap[m.id] = m; });

    const selectedIds = state.ui.selectedRunSuites || [];
    const modelOptions = Data.QUICK_MODELS.map((m) => ({
      id: m.id,
      label: `${m.alias} (${m.quant || "Q4_K_M"})`,
      alias: m.alias
    }));
    (state.customModels || []).forEach((cm, idx) => {
      modelOptions.push({ id: `custom_${idx}`, label: `${cm.alias} (Custom)`, alias: cm.alias });
    });
    const activeMatch = modelOptions.find((o) => o.alias === state.model.alias);

    const outstandingSuitesText = Data.SUITE_METADATA
      .filter((m) => !(auditItems[m.id] && auditItems[m.id].status === "verified"))
      .map((m) => m.shortLabel || m.id)
      .join(", ") || "all verified";

    const previewCode = Engine.buildSelectedSuitesPreview(state);

    return `
      <h2 class="sb-section-title">Run benchmarks</h2>

      <div class="outstanding-box">
        <div class="outstanding-heading">One click: the outstanding parity benchmarks.</div>
        <div class="outstanding-list">
          <div class="outstanding-row ${state.model.slug === "qwen38" ? "is-active" : ""}" data-outstanding-model="qwen38_27b">
            <div class="outstanding-left"><strong>qwen38-27b</strong> · ${esc(outstandingSuitesText)}</div>
            <div class="outstanding-right">AIPerf 64k/1k TTFT and E2E, plus Dense 27B parity suites</div>
          </div>
          <div class="outstanding-row ${state.model.slug === "qwen36" ? "is-active" : ""}" data-outstanding-model="qwen36_35b_moe">
            <div class="outstanding-left"><strong>qwen36-35b-a3b</strong> · aiperf-64k, speed-bench, llama-bench, llama-benchy, llmperf</div>
            <div class="outstanding-right">AIPerf 64k/1k TTFT and E2E on the MoE model</div>
          </div>
        </div>
      </div>

      <div class="sb-inline-row" style="margin-bottom:18px;">
        <button type="button" class="btn btn-primary" id="btn-run-outstanding">Run everything outstanding</button>
        <button type="button" class="btn btn-outline" id="btn-check-prereqs">Check prerequisites only</button>
      </div>

      <h3 class="sb-sub-title">Or a single run</h3>

      <div class="sb-inline-row" style="margin-bottom:10px;">
        <label class="sb-field-inline">
          <span>Model</span>
          <select class="sb-select" id="run-model-sel">
            ${!activeMatch ? `<option value="__current__" selected>${esc(state.model.alias)} (Custom Path)</option>` : ""}
            ${modelOptions.map((o) => `<option value="${esc(o.id)}" ${activeMatch && activeMatch.id === o.id ? "selected" : ""}>${esc(o.label)}</option>`).join("")}
          </select>
        </label>

        <span class="sb-field-inline"><span>Suites</span></span>
        <div class="suite-checks">
          ${suiteOrder.map((sid) => {
            const m = metaMap[sid];
            const checked = selectedIds.includes(sid);
            const verified = auditItems[sid] && auditItems[sid].status === "verified";
            return `
              <label class="suite-check-label ${verified ? "is-verified" : ""}" title="${esc(m.title)}">
                <input type="checkbox" data-run-suite-chk="${sid}" ${checked ? "checked" : ""} />
                <span>${esc(m.shortLabel || sid)}</span>
              </label>
            `;
          }).join("")}
        </div>
      </div>

      <div class="sb-inline-row">
        <label class="sb-field-inline" style="min-width:240px;">
          <span>Note</span>
          <input type="text" class="sb-input" id="run-note-inp" value="${esc(state.ui.runNote || "")}" placeholder="Performance fan profile" style="min-width:190px;" />
        </label>
        <button type="button" class="btn btn-outline" id="btn-preview-commands">Preview commands</button>
        <button type="button" class="btn btn-primary" id="btn-copy-run-commands">Copy commands</button>
        <button type="button" class="btn btn-outline" id="btn-toggle-customize">Customize parameters ${state.ui.showParamCustomize ? "▴" : "▾"}</button>
        <button type="button" class="btn btn-outline" id="btn-dl-run-script">Download ${profile.os === "windows" ? ".ps1" : ".sh"}</button>
      </div>

      <div id="run-guardrails-host">${renderGuardrailsHtml()}</div>
      ${renderParamCustomizerDrawer()}

      <div class="sb-terminal-wrap">
        <div class="sb-terminal-bar">
          <span id="run-terminal-meta">${esc(state.ui.previewMode || "selected")} · ${esc(profile.shell)} · ${esc(state.model.alias)}</span>
          <button type="button" class="btn btn-sm btn-outline" id="btn-copy-terminal-inline">Copy</button>
        </div>
        <pre class="sb-terminal-pre" id="run-terminal-pre">${Engine.highlightShell(previewCode)}</pre>
      </div>
    `;
  }

  // ---------- TAB 4: RESULTS ----------
  function renderSvgBarChart(title, subtitle, items, unit) {
    if (!items.length) {
      return `<div class="sb-chart-card"><h4 style="margin:0;">${esc(title)}</h4><p class="small muted">${esc(subtitle)}</p><div class="small muted">No matching parsed files loaded yet.</div></div>`;
    }
    const maxVal = Math.max(...items.map((i) => i.value), 1);
    const rowH = 30;
    const svgH = items.length * rowH + 20;
    return `
      <div class="sb-chart-card">
        <h4 style="margin:0; font-size:13.5px;">${esc(title)}</h4>
        <div class="small muted">${esc(subtitle)}</div>
        <svg class="sb-chart-svg" viewBox="0 0 560 ${svgH}">
          ${items.map((item, idx) => {
            const y = idx * rowH + 10;
            const barW = Math.max(4, Math.round((item.value / maxVal) * 280));
            const color = item.color || "var(--accent)";
            return `
              <text x="4" y="${y + 13}" fill="var(--text-secondary)" font-size="11" font-family="var(--font-mono)">${esc(item.label.slice(0, 26))}</text>
              <rect x="205" y="${y + 2}" width="280" height="14" rx="4" fill="var(--chart-grid)" />
              <rect x="205" y="${y + 2}" width="${barW}" height="14" rx="4" fill="${color}" />
              <text x="${213 + barW}" y="${y + 13}" fill="var(--text-primary)" font-size="11" font-weight="700" font-family="var(--font-mono)">${item.value} ${esc(unit)}</text>
            `;
          }).join("")}
        </svg>
      </div>
    `;
  }

  function renderResultsTab() {
    const items = state.audit.items || {};
    const verifiedCount = Object.values(items).filter((i) => i && i.status === "verified").length;
    const hasShowDir = typeof global.showDirectoryPicker === "function";
    const records = state.results.loadedRecords || [];

    const benchBars = [];
    const depthBars = [];
    const concBars = [];
    if (state.ui.showCharts) {
      records.filter((r) => r.suiteType === "llama_bench").forEach((r) => {
        if (r.metrics.tg128) benchBars.push({ label: `${r.gpuLabel.split(" ")[0]} ${r.modelLabel.split(" ")[0]} tg128`, value: r.metrics.tg128, color: "var(--accent)" });
        if (r.metrics.pp512) benchBars.push({ label: `${r.gpuLabel.split(" ")[0]} ${r.modelLabel.split(" ")[0]} pp/10`, value: Math.round(r.metrics.pp512 / 10), color: "var(--ok)" });
      });
      records.filter((r) => r.suiteType === "llama_benchy").forEach((r) => {
        depthBars.push({ label: `${r.gpuLabel.split(" ")[0]} ${r.modelLabel.split(" ")[0]}`, value: r.metrics.degradationPct || 0, color: "var(--warn)" });
      });
      records.filter((r) => r.suiteType === "llmperf").forEach((r) => {
        concBars.push({ label: `${r.gpuLabel.split(" ")[0]} ${r.modelLabel.split(" ")[0]}`, value: r.metrics.totalTps || 0, color: "var(--accent)" });
      });
    }

    return `
      <h2 class="sb-section-title">Results & Anti-1KB Audit Coverage (${verifiedCount}/7 Verified)</h2>

      <div class="sb-inline-row">
        ${hasShowDir ? `<button type="button" class="btn btn-primary" id="btn-pick-dir-api">Open Results Folder</button>` : ""}
        <label class="btn btn-outline" style="cursor:pointer;">
          Select Folder (file:// Safe)
          <input type="file" id="inp-webkit-dir" webkitdirectory multiple class="hidden" />
        </label>
        <button type="button" class="btn btn-outline" id="btn-gen-missing-run">Select Missing in Run Tab</button>
        <span class="small muted">
          ${state.audit.lastFolderName ? `Last Audited: <strong>${esc(state.audit.lastFolderName)}</strong> (${esc(state.audit.lastAuditedAt)})` : "Drops inspect byte sizes & parsed JSON/MD rows."}
        </span>
      </div>

      <div class="sb-dropzone" id="audit-dropzone">
        <strong>Drop Centralized Results Folder or Benchmark Files Here</strong>
        <div class="small muted">Detects &gt;1 KB stubs, incomplete <code>llama-benchy</code> depth runs, and <code>aiperf.log</code> overflow errors.</div>
      </div>

      <div class="sb-table-wrap">
        <table class="sb-table">
          <thead><tr><th>Suite</th><th>Expected Output Target</th><th>Status</th><th>Audit Findings</th></tr></thead>
          <tbody>
            ${Data.SUITE_METADATA.map((meta) => {
              const exp = Engine.getOutputTarget(state, meta.id);
              const r = items[meta.id] || { status: "not_run", label: "NOT RUN", detail: "Select or drop a folder to audit." };
              const cls = r.status === "verified" ? "sb-badge-ok" : r.status === "partial" ? "sb-badge-warn" : r.status === "stub" ? "sb-badge-danger" : "";
              return `
                <tr>
                  <td><strong>${esc(meta.shortLabel || meta.id)}</strong></td>
                  <td class="mono small">${esc(exp.leaf)}</td>
                  <td><span class="sb-badge ${cls}">${esc(r.label)}</span></td>
                  <td class="small muted">${esc(r.detail)}</td>
                </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>

      <h3 class="sb-sub-title">Parsed Benchmark Comparisons (${records.length})</h3>
      <div class="sb-inline-row">
        <button type="button" class="btn btn-outline" id="btn-load-sample-data">Load Sample Dataset (DGX vs R9700)</button>
        <label class="btn btn-outline" style="cursor:pointer;">
          Load .md / .json Files
          <input type="file" id="inp-result-files" multiple accept=".md,.json,.csv" class="hidden" />
        </label>
        <button type="button" class="btn btn-outline" id="btn-toggle-charts">${state.ui.showCharts ? "Hide Charts" : "Show Charts"}</button>
        <button type="button" class="btn btn-outline" id="btn-export-md">Export .md</button>
        <button type="button" class="btn btn-outline" id="btn-export-csv">Export .csv</button>
        ${records.length ? `<button type="button" class="btn btn-danger" id="btn-clear-results">Clear</button>` : ""}
      </div>

      ${state.ui.showCharts ? `
        <div class="sb-chart-grid">
          ${renderSvgBarChart("Decode (tg128) & Prefill (/10)", "Native llama-bench throughput", benchBars, "t/s")}
          ${renderSvgBarChart("Depth 4096 KV Degradation (%)", "Lower is better KV stability", depthBars, "% drop")}
          ${renderSvgBarChart("4-Stream Parallel Throughput", "llmperf concurrent output", concBars, "t/s")}
        </div>` : ""}

      <div class="sb-table-wrap">
        <table class="sb-table">
          <thead><tr><th>Source File</th><th>GPU / Backend</th><th>Model</th><th>Suite</th><th>Metrics</th></tr></thead>
          <tbody>
            ${records.length ? records.map((r) => `
              <tr>
                <td class="mono small">${esc(r.sourceFile)}</td>
                <td>${esc(r.gpuLabel)}</td>
                <td>${esc(r.modelLabel)}</td>
                <td><span class="sb-badge">${esc(r.suiteType)}</span></td>
                <td class="mono small">${esc(Object.entries(r.metrics || {}).map(([k, v]) => `${k}=${v}`).join(" · "))}</td>
              </tr>`).join("") : `<tr><td colspan="5" class="muted">No result files loaded. Click "Load Sample Dataset" or drop .md/.json files above.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  // ---------- TAB 5: REMOTE & SETUP ----------
  function getRemoteSectionsList() {
    const cmds = Engine.buildSshCommands(state);
    const setupCards = Engine.buildSetupCards(state);
    const items = [
      { id: "ssh_ps", label: "SSH PowerShell", code: cmds.psTrigger },
      { id: "ssh_tmux", label: "tmux Split", code: cmds.tmuxLaunch },
      { id: "ssh_scp", label: "SCP Pull Results", code: cmds.scpPull },
      { id: "ssh_vram", label: "DGX VRAM Sweep", code: cmds.vramSweep },
      { id: "ssh_startai", label: "Restore start-ai", code: cmds.startAiRestore },
      { id: "ssh_hermes", label: "Hermes YAML", code: cmds.hermesYaml },
      { id: "audit_deep", label: "Deep Audit Script", code: Engine.buildDeepAuditScript(state) }
    ];
    setupCards.forEach((c) => {
      items.push({ id: c.id, label: c.badge, code: c.cmd });
    });
    return items;
  }

  function getActiveRemoteCode() {
    const list = getRemoteSectionsList();
    const active = list.find((it) => it.id === state.ui.remoteSection) || list[0];
    return active ? active.code : "";
  }

  function renderRemoteTab() {
    const s = state.ssh;
    const list = getRemoteSectionsList();
    const active = list.find((it) => it.id === state.ui.remoteSection) || list[0];

    return `
      <h2 class="sb-section-title">SSH Remote, Hermes Stack & Platform Setup Fixes</h2>

      <div class="sb-form-grid" style="margin-bottom:14px;">
        <div class="sb-field"><label>SSH User</label><input type="text" class="sb-input mono" data-ssh-field="user" value="${esc(s.user)}" /></div>
        <div class="sb-field"><label>Remote Host / IP</label><input type="text" class="sb-input mono" data-ssh-field="host" value="${esc(s.host)}" /></div>
        <div class="sb-field"><label>Port / tmux Session</label>
          <div class="sb-inline-row" style="gap:6px; flex-wrap:nowrap;">
            <input type="number" class="sb-input mono" data-ssh-field="port" value="${esc(s.port)}" style="width:72px;" />
            <input type="text" class="sb-input mono" data-ssh-field="tmuxSession" value="${esc(s.tmuxSession)}" style="flex:1; min-width:80px;" />
          </div>
        </div>
        <div class="sb-field"><label>Remote Results Dir</label><input type="text" class="sb-input mono" data-ssh-field="remoteResultsDir" value="${esc(s.remoteResultsDir)}" /></div>
        <div class="sb-field"><label>Local Pull Folder</label><input type="text" class="sb-input mono" data-ssh-field="localPullDir" value="${esc(s.localPullDir)}" /></div>
        <div class="sb-field"><label>Hermes LAN IP</label><input type="text" class="sb-input mono" data-ssh-field="hermesServerIp" value="${esc(s.hermesServerIp)}" /></div>
      </div>

      <div class="sb-inline-row" style="justify-content:space-between; margin-bottom:10px;">
        <div class="sb-pill-row">
          ${list.map((it) => `
            <button type="button" class="sb-chip ${active.id === it.id ? "active" : ""}" data-remote-sec="${esc(it.id)}">
              ${esc(it.label)}
            </button>
          `).join("")}
        </div>
        <label class="suite-check-label">
          <input type="checkbox" id="chk-vllm-restore" ${s.includeVllmInStartAi ? "checked" : ""} />
          <span>Include vLLM (${esc(s.vllmGpuUtil)})</span>
        </label>
      </div>

      <div class="sb-terminal-wrap">
        <div class="sb-terminal-bar">
          <span>${esc(active.label)}</span>
          <button type="button" class="btn btn-sm btn-outline" id="btn-copy-remote-inline">Copy</button>
        </div>
        <pre class="sb-terminal-pre" id="remote-terminal-pre">${Engine.highlightShell(active.code)}</pre>
      </div>
    `;
  }

  // ---------- Root Render & Event Wiring ----------
  function renderApp() {
    applyThemeAndMotion();
    const root = document.getElementById("app");
    if (!root) return;

    const tab = state.ui.activeTab || "run";
    let bodyHtml = "";
    if (tab === "system") bodyHtml = renderSystemTab();
    else if (tab === "models") bodyHtml = renderModelsTab();
    else if (tab === "results") bodyHtml = renderResultsTab();
    else if (tab === "remote") bodyHtml = renderRemoteTab();
    else bodyHtml = renderRunTab();

    root.innerHTML = `
      <div class="sb-container">
        ${renderHeader()}
        ${renderTabs()}
        <main class="sb-card">${bodyHtml}</main>
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    // Tabs
    document.querySelectorAll("[data-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.ui.activeTab = btn.getAttribute("data-tab");
        persist();
        renderApp();
      });
    });

    // Header Controls
    const stealthBtn = document.getElementById("btn-stealth-mode");
    if (stealthBtn) {
      stealthBtn.addEventListener("click", () => {
        state.ui.pauseAnimations = !state.ui.pauseAnimations;
        persist();
        renderApp();
      });
    }

    const themeSel = document.getElementById("select-theme");
    if (themeSel) {
      themeSel.addEventListener("change", () => {
        state.ui.theme = themeSel.value;
        persist();
        renderApp();
      });
    }

    const wireInput = (id, fn) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener(el.type === "checkbox" || el.tagName === "SELECT" ? "change" : "input", () => {
        fn(el);
        persist();
        refreshLiveDom();
      });
    };

    // System Tab
    const sysProf = document.getElementById("sys-profile-sel");
    if (sysProf) sysProf.addEventListener("change", () => switchHardwareProfile(sysProf.value));

    wireInput("sys-vram", (el) => { state.hardware.vramGb = Number(el.value) || 32; });
    const amdSel = document.getElementById("sys-amd-backend");
    if (amdSel) {
      amdSel.addEventListener("change", () => {
        state.hardware.amdBackend = amdSel.value;
        state.hardware.binDir = amdSel.value === "rocm" ? "C:\\llama.cpp\\hip" : "C:\\llama.cpp\\vulkan";
        persist();
        renderApp();
      });
    }
    wireInput("sys-nvidia-dev", (el) => { state.hardware.nvidiaDevice = el.value; });
    wireInput("sys-tensor-split", (el) => { state.hardware.tensorSplit = el.value; });
    wireInput("sys-host", (el) => { state.hardware.host = el.value; });
    wireInput("sys-port", (el) => { state.hardware.port = Number(el.value) || 8080; });
    wireInput("sys-naming-mode", (el) => { state.naming.mode = el.value; });
    wireInput("sys-client-model-mode", (el) => { state.model.clientModelMode = el.value; });
    wireInput("sys-bin-dir", (el) => { state.hardware.binDir = el.value; });
    wireInput("sys-results-dir", (el) => { state.hardware.resultsDir = el.value; });
    wireInput("sys-bench-root", (el) => { state.hardware.benchRoot = el.value; });
    wireInput("sys-repo-dir", (el) => { state.hardware.repoDir = el.value; });
    wireInput("sys-non-sudo", (el) => { state.hardware.nonSudoSetup = el.checked; });
    wireInput("sys-rtx-tdigest", (el) => { state.hardware.rtxArmTdigestCompile = el.checked; });
    wireInput("sys-amd-fa", (el) => { state.hardware.amdEnableFa = el.checked; });

    const lightTermChk = document.getElementById("sys-light-term");
    if (lightTermChk) {
      lightTermChk.addEventListener("change", () => {
        state.ui.lightTerminal = lightTermChk.checked;
        persist();
        applyThemeAndMotion();
      });
    }

    const resetSysBtn = document.getElementById("btn-sys-reset-parity");
    if (resetSysBtn) {
      resetSysBtn.addEventListener("click", () => {
        state.suites = JSON.parse(JSON.stringify(Data.PARITY_DEFAULTS));
        state.naming.activePresetName = "Baseline Parity Defaults";
        persist();
        renderApp();
      });
    }

    // Models Tab
    const tierSel = document.getElementById("models-tier-sel");
    if (tierSel) {
      tierSel.addEventListener("change", () => {
        state.hardware.vramGb = Number(tierSel.value) || 64;
        persist();
        renderApp();
      });
    }
    const kvSel = document.getElementById("models-kv-sel");
    if (kvSel) {
      kvSel.addEventListener("change", () => {
        state.ui.fitKv = kvSel.value;
        persist();
        renderApp();
      });
    }
    const refBtn = document.getElementById("btn-models-refresh");
    if (refBtn) refBtn.addEventListener("click", () => renderApp());

    document.querySelectorAll("[data-fit-model-id]").forEach((tr) => {
      tr.addEventListener("click", () => selectModelById(tr.getAttribute("data-fit-model-id")));
    });

    const customGgufInp = document.getElementById("inp-custom-gguf");
    if (customGgufInp) {
      customGgufInp.addEventListener("input", () => {
        state.model.fullPath = customGgufInp.value;
        const parsed = Engine.parseModelPath(customGgufInp.value);
        state.model.baseDir = parsed.baseDir;
        state.model.filename = parsed.filename;
        state.model.alias = parsed.alias;
        state.model.slug = parsed.slug;
        state.model.tokenizer = parsed.tokenizer;
        state.model.weightGb = parsed.weightGb;
        state.model.paramsB = parsed.paramsB;
        persist();
        refreshLiveDom();
      });
    }

    const saveModelBtn = document.getElementById("btn-save-custom-model");
    if (saveModelBtn) {
      saveModelBtn.addEventListener("click", () => {
        if (!state.customModels.some((m) => m.fullPath === state.model.fullPath)) {
          state.customModels.push({ ...state.model });
        }
        persist();
        renderApp();
      });
    }

    // Run Tab
    document.querySelectorAll("[data-outstanding-model]").forEach((row) => {
      row.addEventListener("click", () => {
        selectModelById(row.getAttribute("data-outstanding-model"));
      });
    });

    const runOutBtn = document.getElementById("btn-run-outstanding");
    if (runOutBtn) {
      runOutBtn.addEventListener("click", () => {
        state.ui.previewMode = "outstanding";
        persist();
        renderApp();
        copyText(document.getElementById("btn-run-outstanding"), Engine.buildSelectedSuitesPreview(state), "Run everything outstanding");
      });
    }

    const prereqBtn = document.getElementById("btn-check-prereqs");
    if (prereqBtn) {
      prereqBtn.addEventListener("click", () => {
        state.ui.previewMode = "prereqs";
        persist();
        renderApp();
      });
    }

    const runModelSel = document.getElementById("run-model-sel");
    if (runModelSel) {
      runModelSel.addEventListener("change", () => {
        if (runModelSel.value !== "__current__") selectModelById(runModelSel.value);
      });
    }

    document.querySelectorAll("[data-run-suite-chk]").forEach((chk) => {
      chk.addEventListener("change", () => {
        const sid = chk.getAttribute("data-run-suite-chk");
        const set = new Set(state.ui.selectedRunSuites || []);
        if (chk.checked) set.add(sid);
        else set.delete(sid);
        state.ui.selectedRunSuites = Array.from(set);
        state.ui.previewMode = "selected";
        persist();
        renderApp();
      });
    });

    wireInput("run-note-inp", (el) => { state.ui.runNote = el.value; });

    const previewBtn = document.getElementById("btn-preview-commands");
    if (previewBtn) {
      previewBtn.addEventListener("click", () => {
        state.ui.previewMode = "selected";
        persist();
        renderApp();
      });
    }

    const copyRunBtn = document.getElementById("btn-copy-run-commands");
    if (copyRunBtn) {
      copyRunBtn.addEventListener("click", () => {
        copyText(copyRunBtn, Engine.buildSelectedSuitesPreview(state), "Copy commands");
      });
    }

    const copyTermInline = document.getElementById("btn-copy-terminal-inline");
    if (copyTermInline) {
      copyTermInline.addEventListener("click", () => {
        copyText(copyTermInline, Engine.buildSelectedSuitesPreview(state), "Copy");
      });
    }

    const toggleCustBtn = document.getElementById("btn-toggle-customize");
    if (toggleCustBtn) {
      toggleCustBtn.addEventListener("click", () => {
        state.ui.showParamCustomize = !state.ui.showParamCustomize;
        persist();
        renderApp();
      });
    }

    const dlRunBtn = document.getElementById("btn-dl-run-script");
    if (dlRunBtn) {
      dlRunBtn.addEventListener("click", () => {
        const prof = Data.HARDWARE_PROFILES[state.hardware.profileId];
        const ext = prof.os === "windows" ? "ps1" : "sh";
        downloadFile(`ai_benchmate_${state.model.slug || "run"}.${ext}`, Engine.buildSelectedSuitesPreview(state));
      });
    }

    // Parameter customizer inside Run drawer
    wireInput("run-mod-alias", (el) => { state.model.alias = el.value; });
    wireInput("run-mod-slug", (el) => { state.model.slug = el.value; });
    wireInput("run-mod-tok", (el) => { state.model.tokenizer = el.value; });
    wireInput("run-naming-mode", (el) => { state.naming.mode = el.value; });

    const runSweepKv = document.getElementById("run-sweep-kv");
    if (runSweepKv) {
      runSweepKv.addEventListener("change", () => {
        state.suites.aiperf_sweep.ctk = runSweepKv.value;
        state.suites.aiperf_sweep.ctv = runSweepKv.value;
        persist();
        refreshLiveDom();
      });
    }

    document.querySelectorAll("[data-suite-field]").forEach((el) => {
      const [sid, field] = el.getAttribute("data-suite-field").split(".");
      el.addEventListener("input", () => {
        state.suites[sid][field] = el.type === "number" ? (Number(el.value) || 0) : el.value;
        persist();
        refreshLiveDom();
      });
    });

    const runSavePresetBtn = document.getElementById("btn-run-save-preset");
    if (runSavePresetBtn) {
      runSavePresetBtn.addEventListener("click", () => {
        const name = global.prompt("Preset name:", `Custom ${state.model.slug}`);
        if (!name || !name.trim()) return;
        state.customPresets.push({ name: name.trim(), suites: JSON.parse(JSON.stringify(state.suites)) });
        state.naming.activePresetName = name.trim();
        persist();
        renderApp();
      });
    }

    const runResetParityBtn = document.getElementById("btn-run-reset-parity");
    if (runResetParityBtn) {
      runResetParityBtn.addEventListener("click", () => {
        state.suites = JSON.parse(JSON.stringify(Data.PARITY_DEFAULTS));
        state.naming.activePresetName = "Baseline Parity Defaults";
        persist();
        renderApp();
      });
    }

    const grHost = document.getElementById("run-guardrails-host");
    if (grHost) bindGuardrailButtons(grHost);

    // Results Tab
    async function runAuditEntries(entries, folderName) {
      const items = await Engine.auditFileList(entries, state);
      state.audit.items = items;
      state.audit.lastFolderName = folderName;
      state.audit.lastAuditedAt = new Date().toLocaleTimeString();
      persist();
      await Engine.saveSnapshotIDB("latest_audit", state.audit);
      renderApp();
    }

    const pickDirBtn = document.getElementById("btn-pick-dir-api");
    if (pickDirBtn) {
      pickDirBtn.addEventListener("click", async () => {
        try {
          const dirHandle = await global.showDirectoryPicker();
          const entries = [];
          async function walk(handle, prefix) {
            for await (const [name, child] of handle.entries()) {
              const rel = prefix ? prefix + "/" + name : name;
              if (child.kind === "file") {
                const file = await child.getFile();
                entries.push({ path: rel, name, size: file.size, textLoader: () => file.text() });
              } else if (child.kind === "directory") {
                await walk(child, rel);
              }
            }
          }
          await walk(dirHandle, "");
          await runAuditEntries(entries, dirHandle.name);
        } catch (_) {}
      });
    }

    const webkitDirInp = document.getElementById("inp-webkit-dir");
    if (webkitDirInp) {
      webkitDirInp.addEventListener("change", async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        const entries = files.map((f) => ({ path: f.webkitRelativePath || f.name, name: f.name, size: f.size, textLoader: () => f.text() }));
        const rootName = (files[0].webkitRelativePath || "").split("/")[0] || "Selected Folder";
        await runAuditEntries(entries, rootName);
      });
    }

    const auditDrop = document.getElementById("audit-dropzone");
    if (auditDrop) {
      auditDrop.addEventListener("dragover", (e) => { e.preventDefault(); auditDrop.classList.add("dragover"); });
      auditDrop.addEventListener("dragleave", () => auditDrop.classList.remove("dragover"));
      auditDrop.addEventListener("drop", async (e) => {
        e.preventDefault();
        auditDrop.classList.remove("dragover");
        const items = Array.from(e.dataTransfer.items || []);
        const entries = [];
        async function readEntry(entry, prefix) {
          if (entry.isFile) {
            await new Promise((res) => entry.file((file) => {
              entries.push({ path: prefix + entry.name, name: entry.name, size: file.size, textLoader: () => file.text() });
              res();
            }));
          } else if (entry.isDirectory) {
            const reader = entry.createReader();
            await new Promise((res) => {
              const all = [];
              const batch = () => reader.readEntries(async (list) => {
                if (!list.length) {
                  for (const c of all) await readEntry(c, prefix + entry.name + "/");
                  res();
                } else {
                  all.push(...list);
                  batch();
                }
              });
              batch();
            });
          }
        }
        for (const it of items) {
          const entry = it.webkitGetAsEntry ? it.webkitGetAsEntry() : null;
          if (entry) await readEntry(entry, "");
        }
        if (!entries.length && e.dataTransfer.files) {
          Array.from(e.dataTransfer.files).forEach((f) => entries.push({ path: f.name, name: f.name, size: f.size, textLoader: () => f.text() }));
        }
        if (entries.length) await runAuditEntries(entries, "Dropped Folder");
      });
    }

    const genMissingRunBtn = document.getElementById("btn-gen-missing-run");
    if (genMissingRunBtn) {
      genMissingRunBtn.addEventListener("click", () => {
        const auditItems = state.audit.items || {};
        state.ui.selectedRunSuites = Data.SUITE_METADATA
          .filter((m) => !(auditItems[m.id] && auditItems[m.id].status === "verified"))
          .map((m) => m.id);
        state.ui.previewMode = "outstanding";
        state.ui.activeTab = "run";
        persist();
        renderApp();
      });
    }

    const sampleBtn = document.getElementById("btn-load-sample-data");
    if (sampleBtn) {
      sampleBtn.addEventListener("click", async () => {
        const nonSample = (state.results.loadedRecords || []).filter((r) => !r.isSample);
        state.results.loadedRecords = [...nonSample, ...Data.SAMPLE_RESULTS_DATASET];
        state.results.includeSampleData = true;
        persist();
        await Engine.saveSnapshotIDB("latest_results", state.results.loadedRecords);
        renderApp();
      });
    }

    const resFileInp = document.getElementById("inp-result-files");
    if (resFileInp) {
      resFileInp.addEventListener("change", async (e) => {
        const parsed = [];
        for (const f of Array.from(e.target.files || [])) {
          const rec = Engine.parseResultFile(f.name, await f.text());
          if (rec) parsed.push(rec);
        }
        if (parsed.length) {
          state.results.loadedRecords = [...(state.results.loadedRecords || []), ...parsed];
          persist();
          await Engine.saveSnapshotIDB("latest_results", state.results.loadedRecords);
          renderApp();
        }
      });
    }

    const toggleChartsBtn = document.getElementById("btn-toggle-charts");
    if (toggleChartsBtn) {
      toggleChartsBtn.addEventListener("click", () => {
        state.ui.showCharts = !state.ui.showCharts;
        persist();
        renderApp();
      });
    }

    const expMdBtn = document.getElementById("btn-export-md");
    if (expMdBtn) {
      expMdBtn.addEventListener("click", () => {
        downloadFile("ai_benchmate_comparison.md", Engine.exportComparisonMarkdown(state.results.loadedRecords || []), "text/markdown");
      });
    }

    const expCsvBtn = document.getElementById("btn-export-csv");
    if (expCsvBtn) {
      expCsvBtn.addEventListener("click", () => {
        downloadFile("ai_benchmate_comparison.csv", Engine.exportComparisonCsv(state.results.loadedRecords || []), "text/csv");
      });
    }

    const clearResBtn = document.getElementById("btn-clear-results");
    if (clearResBtn) {
      clearResBtn.addEventListener("click", async () => {
        state.results.loadedRecords = [];
        state.results.includeSampleData = false;
        persist();
        await Engine.saveSnapshotIDB("latest_results", []);
        renderApp();
      });
    }

    // Remote & Setup Tab
    document.querySelectorAll("[data-ssh-field]").forEach((el) => {
      const key = el.getAttribute("data-ssh-field");
      el.addEventListener("input", () => {
        state.ssh[key] = el.type === "number" ? (Number(el.value) || 22) : el.value;
        persist();
        refreshLiveDom();
      });
    });

    document.querySelectorAll("[data-remote-sec]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.ui.remoteSection = btn.getAttribute("data-remote-sec");
        persist();
        renderApp();
      });
    });

    const chkVllm = document.getElementById("chk-vllm-restore");
    if (chkVllm) {
      chkVllm.addEventListener("change", () => {
        state.ssh.includeVllmInStartAi = chkVllm.checked;
        persist();
        renderApp();
      });
    }

    const copyRemoteBtn = document.getElementById("btn-copy-remote-inline");
    if (copyRemoteBtn) {
      copyRemoteBtn.addEventListener("click", () => {
        copyText(copyRemoteBtn, getActiveRemoteCode(), "Copy");
      });
    }
  }

  async function init() {
    applyThemeAndMotion();
    renderApp();
    try {
      const savedAudit = await Engine.loadSnapshotIDB("latest_audit");
      let updated = false;
      if (savedAudit && savedAudit.items && Object.keys(state.audit.items || {}).length === 0) {
        state.audit = savedAudit;
        updated = true;
      }
      const savedResults = await Engine.loadSnapshotIDB("latest_results");
      if (Array.isArray(savedResults) && savedResults.length && (!state.results.loadedRecords || !state.results.loadedRecords.length)) {
        state.results.loadedRecords = savedResults;
        updated = true;
      }
      if (updated) renderApp();
    } catch (_) {}
  }

  global.BenchmateUI = { init, renderApp };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window);

/* ==========================================================================
   AI Benchmate — Portable UI Controller (Vanilla JS + BrewedOps Motion UI)
   100% Universal Persistence (localStorage + IndexedDB)
   Works via file:// double-click AND HTTP local server
   ========================================================================== */
(function (global) {
  "use strict";

  const Data = global.BenchmateData;
  const Engine = global.BenchmateEngine;

  let state = Engine.loadState();
  let scrambleTimer = null;

  function persist() {
    Engine.saveState(state);
  }

  // ---------- Theme & Option 2A Unified Benchmark Stealth Toggle ----------
  function applyThemeAndMotion() {
    const html = document.documentElement;
    let resolvedTheme = state.ui.theme;
    if (resolvedTheme === "system") {
      resolvedTheme = global.matchMedia && global.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    }
    html.setAttribute("data-theme", resolvedTheme);
    html.setAttribute("data-light-terminal", state.ui.lightTerminal ? "true" : "false");
    html.classList.toggle("pause-animations", Boolean(state.ui.pauseAnimations));
  }

  function scrambleText(el, finalStr) {
    if (!el) return;
    if (state.ui.pauseAnimations) {
      el.textContent = finalStr;
      return;
    }
    if (scrambleTimer) clearInterval(scrambleTimer);
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
    let frame = 0;
    const total = 10;
    scrambleTimer = setInterval(() => {
      frame += 1;
      if (frame >= total) {
        clearInterval(scrambleTimer);
        el.textContent = finalStr;
        return;
      }
      const revealCount = Math.floor((frame / total) * finalStr.length);
      let out = "";
      for (let i = 0; i < finalStr.length; i++) {
        if (i < revealCount || finalStr[i] === " ") out += finalStr[i];
        else out += chars[Math.floor(Math.random() * chars.length)];
      }
      el.textContent = out;
    }, 22);
  }

  // ---------- Clipboard & Download Helpers ----------
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

  function esc(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ---------- Partial Live Updates (Preserves Input Focus While Typing) ----------
  function refreshLiveOutputs() {
    updateTopTelemetry();
    updateGuardrailsDOM();
    updateRailDOM();

    Data.SUITE_METADATA.forEach((meta) => {
      const card = document.querySelector(`[data-suite-card="${meta.id}"]`);
      if (!card) return;
      const out = Engine.getOutputTarget(state, meta.id);
      const outEl = card.querySelector("[data-output-preview]");
      if (outEl) {
        outEl.innerHTML = `<span class="badge ${out.mode === "stamped" ? "badge-amber" : "badge-cyan"}">${out.mode === "stamped" ? "MODE A · STAMPED" : "MODE B · PARITY"}</span> <code>${esc(out.fullPath)}</code>`;
      }
      if (meta.hasServer) {
        const srvPre = card.querySelector("[data-srv-code]");
        if (srvPre) srvPre.innerHTML = Engine.highlightShell(Engine.buildServerCommand(state, meta.id));
      }
      const cliPre = card.querySelector("[data-cli-code]");
      if (cliPre) cliPre.innerHTML = Engine.highlightShell(Engine.buildSuiteClientCommand(state, meta.id));
    });

    const playbookPre = document.getElementById("playbook-code");
    if (playbookPre) {
      playbookPre.innerHTML = Engine.highlightShell(Engine.buildAllInOnePlaybook(state, state.ui.showMissingOnly));
    }

    const deepAuditPre = document.getElementById("deep-audit-code");
    if (deepAuditPre) {
      deepAuditPre.innerHTML = Engine.highlightShell(Engine.buildDeepAuditScript(state));
    }
  }

  function updateTopTelemetry() {
    const profile = Data.HARDWARE_PROFILES[state.hardware.profileId];
    const targetEl = document.getElementById("pill-target-val");
    if (targetEl && targetEl.textContent !== profile.shortName) {
      scrambleText(targetEl, profile.shortName);
    }
    const modelEl = document.getElementById("pill-model-val");
    if (modelEl) modelEl.textContent = state.model.alias || state.model.slug || "Model";

    const verifiedCount = Object.values(state.audit.items || {}).filter((i) => i && i.status === "verified").length;
    const totalSuites = Data.SUITE_METADATA.length;
    const auditEl = document.getElementById("pill-audit-val");
    if (auditEl) auditEl.textContent = `${verifiedCount}/${totalSuites} Verified`;
  }

  function updateRailDOM() {
    const railMeta = document.getElementById("rail-mini-summary");
    if (!railMeta) return;
    const { warnings, vramEstimate } = Engine.evaluateGuardrails(state);
    const overVram = vramEstimate.totalVramGb > vramEstimate.vramCeiling;
    const completedCount = Object.values(state.completedSteps || {}).filter(Boolean).length;
    railMeta.innerHTML = `
      <div class="rail-mini-row"><span>VRAM Est.</span><strong style="color:${overVram ? "var(--accent-amber)" : "var(--accent-emerald)"}">${vramEstimate.totalVramGb} / ${vramEstimate.vramCeiling} GB</strong></div>
      <div class="rail-mini-row"><span>Guardrails</span><strong style="color:${warnings.length ? "var(--accent-crimson)" : "var(--accent-emerald)"}">${warnings.length ? warnings.length + " Alert(s)" : "Healthy"}</strong></div>
      <div class="rail-mini-row"><span>Steps Done</span><strong>${completedCount}/${Data.SUITE_METADATA.length}</strong></div>
      <div class="rail-mini-row"><span>Naming</span><strong>${state.naming.mode.toUpperCase()}</strong></div>
    `;
  }

  function updateGuardrailsDOM() {
    const host = document.getElementById("guardrails-host");
    if (!host) return;
    const { warnings, vramEstimate } = Engine.evaluateGuardrails(state);
    if (!warnings.length) {
      host.innerHTML = `
        <div class="banner banner-emerald">
          <div class="banner-body">
            <div class="banner-title">Guardrails Healthy — Zero Context Overflow or VRAM Violations</div>
            <div class="small muted">Estimated peak VRAM: <strong>${vramEstimate.totalVramGb} GB</strong> (Model ${vramEstimate.weightGb} GB + KV ${vramEstimate.kvGb} GB @ ${vramEstimate.kvPrecision} + 1.5 GB Compute) within ${vramEstimate.vramCeiling} GB ceiling.</div>
          </div>
        </div>`;
      return;
    }

    host.innerHTML = warnings.map((w) => `
      <div class="banner banner-${w.severity}">
        <div class="banner-body">
          <div class="banner-title">${esc(w.title)}</div>
          <div class="small">${esc(w.detail)}</div>
        </div>
        <button class="btn ${w.severity === "crimson" ? "btn-crimson" : "btn-amber"}" data-guardrail-fix="${esc(w.id)}">${esc(w.fixLabel)}</button>
      </div>
    `).join("");

    host.querySelectorAll("[data-guardrail-fix]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const fixId = btn.getAttribute("data-guardrail-fix");
        if (fixId === "ctx_aiperf_sweep") {
          state.suites.aiperf_sweep.c = 70000;
          state.suites.aiperf_sweep.ctk = "q8_0";
          state.suites.aiperf_sweep.ctv = "q8_0";
        } else if (fixId === "ctx_benchy") {
          state.suites.llama_benchy.c = 70000;
        } else if (fixId === "vram_overflow") {
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

  // ---------- Profile Switching Helper ----------
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

    // Adapt model path OS separators automatically if using default/template path
    const sep = nextProfile.os === "windows" ? "\\" : "/";
    const filenameOnly = (state.model.filename || "Qwen3.8-27B-UD-Q4_K_M.gguf").split(/[\\/]+/).pop();
    const matchQuick = Data.QUICK_MODELS.find((m) => m.alias === state.model.alias);
    if (matchQuick) {
      const rel = nextProfile.os === "windows" ? matchQuick.relativeWin : matchQuick.relativeLinux;
      state.model.fullPath = Engine.joinPath(nextProfile.defaultModelsDir, rel, sep);
    } else if (prevProfile.os !== nextProfile.os) {
      state.model.fullPath = Engine.joinPath(nextProfile.defaultModelsDir, filenameOnly, sep);
    }
    const parsed = Engine.parseModelPath(state.model.fullPath);
    state.model.baseDir = parsed.baseDir;
    state.model.filename = parsed.filename;

    persist();
    renderApp();
  }

  function applyQuickModel(quickModel) {
    const profile = Data.HARDWARE_PROFILES[state.hardware.profileId];
    const sep = profile.os === "windows" ? "\\" : "/";
    const rel = profile.os === "windows" ? quickModel.relativeWin : quickModel.relativeLinux;
    state.model.fullPath = Engine.joinPath(profile.defaultModelsDir, rel, sep);
    state.model.baseDir = profile.defaultModelsDir;
    state.model.filename = rel;
    state.model.alias = quickModel.alias;
    state.model.slug = quickModel.slug;
    state.model.tokenizer = quickModel.tokenizer;
    state.model.weightGb = quickModel.weightGb;
    state.model.paramsB = quickModel.paramsB;
    persist();
    renderApp();
  }

  // ---------- Main Shell Rendering ----------
  function renderNavbar() {
    const profile = Data.HARDWARE_PROFILES[state.hardware.profileId];
    const verifiedCount = Object.values(state.audit.items || {}).filter((i) => i && i.status === "verified").length;
    const tabs = [
      { id: "builder", idx: "01", label: "Builder" },
      { id: "coverage", idx: "02", label: "Coverage Matrix" },
      { id: "results", idx: "03", label: "Results & Charts" },
      { id: "ssh", idx: "04", label: "SSH Remote" },
      { id: "setup", idx: "05", label: "Setup & Fixes" }
    ];

    const resolvedTheme = state.ui.theme === "system"
      ? (global.matchMedia && global.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
      : state.ui.theme;

    return `
      <header class="top-island-wrap">
        <nav class="top-island-nav">
          <div class="brand-cluster">
            <div class="brand-mark">BM</div>
            <div class="brand-title">
              <span>AI Benchmate</span>
              <span class="edition-badge">PORTABLE</span>
            </div>
            <div class="telemetry-pills">
              <span class="telemetry-pill"><span class="dot-pulse"></span>Target: <strong id="pill-target-val">${esc(profile.shortName)}</strong></span>
              <span class="telemetry-pill">Model: <strong id="pill-model-val">${esc(state.model.alias)}</strong></span>
              <span class="telemetry-pill">Audit: <strong id="pill-audit-val">${verifiedCount}/${Data.SUITE_METADATA.length} Verified</strong></span>
            </div>
          </div>

          <div class="nav-tabs">
            ${tabs.map((t) => `
              <button class="nav-tab-btn ${state.ui.activeTab === t.id ? "active" : ""}" data-tab="${t.id}">
                <span class="idx">${t.idx}</span><span>${t.label}</span>
              </button>
            `).join("")}
          </div>

          <div class="nav-controls">
            <button class="control-pill ${state.ui.pauseAnimations ? "is-active" : ""}" id="btn-pause-anim" title="Option 2A Benchmark Stealth Mode: Pauses motion, timers, backdrop blurs & GPU shadows">
              ${state.ui.pauseAnimations ? "● Stealth / Paused" : "❚❚ Pause Animations"}
            </button>
            ${resolvedTheme === "light" ? `
              <button class="control-pill ${state.ui.lightTerminal ? "is-active" : ""}" id="btn-light-term" title="Toggle Light Terminal (#F0EFEA) vs Dark Terminal (#18181B)">
                ${state.ui.lightTerminal ? "Light Terminal" : "Dark Terminal"}
              </button>` : ""}
            <select class="theme-select" id="select-theme" aria-label="Theme Mode">
              <option value="dark" ${state.ui.theme === "dark" ? "selected" : ""}>Dark · Obsidian</option>
              <option value="light" ${state.ui.theme === "light" ? "selected" : ""}>Light · Editorial</option>
              <option value="system" ${state.ui.theme === "system" ? "selected" : ""}>System</option>
            </select>
          </div>
        </nav>
      </header>
    `;
  }

  function renderSidebarRail() {
    const sections = [
      { id: "sec-hardware", num: "01", label: "Hardware & OS", tab: "builder" },
      { id: "sec-model", num: "02", label: "Model & Paths", tab: "builder" },
      { id: "sec-presets", num: "03", label: "Server & Presets", tab: "builder" },
      { id: "sec-suites", num: "04", label: "Benchmark Suites", tab: "builder" },
      { id: "sec-playbook", num: "05", label: "Playbook Output", tab: "builder" },
      { id: "sec-verify", num: "06", label: "Folder Verification", tab: "coverage" }
    ];

    const completedCount = Object.values(state.completedSteps || {}).filter(Boolean).length;
    const { warnings } = Engine.evaluateGuardrails(state);

    return `
      <aside class="section-rail">
        <div class="rail-heading">Section Index</div>
        ${sections.map((s) => {
          let pill = "";
          let cls = "";
          if (s.id === "sec-hardware") pill = Data.HARDWARE_PROFILES[state.hardware.profileId].os.toUpperCase();
          if (s.id === "sec-presets") { pill = warnings.length ? `${warnings.length} WARN` : "OK"; cls = warnings.length ? "err" : "ok"; }
          if (s.id === "sec-suites") { pill = `${completedCount}/7`; cls = completedCount === 7 ? "ok" : ""; }
          return `
            <button class="rail-link ${state.ui.activeSection === s.id ? "active" : ""}" data-rail-sec="${s.id}" data-rail-tab="${s.tab}">
              <span class="rail-link-left"><span class="rail-num">${s.num}</span><span>${s.label}</span></span>
              ${pill ? `<span class="rail-status ${cls}">${pill}</span>` : ""}
            </button>
          `;
        }).join("")}

        <div class="rail-divider"></div>
        <div class="rail-heading">Session State (Auto-Saved)</div>
        <div class="rail-mini-meta" id="rail-mini-summary"></div>
        <button class="chip-btn ${state.ui.showMissingOnly ? "amber active" : ""}" id="btn-rail-missing" style="justify-content:center; margin-top:4px;">
          ${state.ui.showMissingOnly ? "✓ Showing Missing/Incomplete Only" : "Filter: Missing Runs Only"}
        </button>
      </aside>
    `;
  }

  // ---------- View 01: Builder ----------
  function renderBuilderView() {
    const profile = Data.HARDWARE_PROFILES[state.hardware.profileId];
    const hw = state.hardware;
    const mod = state.model;

    // Section 01: Hardware & OS
    const secHardware = `
      <section class="panel-card section-block" id="sec-hardware">
        <div class="card-header" style="margin-bottom:12px;">
          <div class="card-title-group">
            <div class="card-kicker"><span class="index-num">01</span><span class="badge badge-cyan">HARDWARE & OS MATRIX</span></div>
            <h2 class="card-title">Target Compute Profile & Tool Paths</h2>
            <p class="card-desc">Adapts shell syntax (${profile.shell}), binary names, GPU flags, venv activation, and cleanup commands automatically.</p>
          </div>
        </div>

        <div class="profile-grid" style="margin-bottom:14px;">
          ${Object.values(Data.HARDWARE_PROFILES).map((p) => `
            <button class="profile-btn ${hw.profileId === p.id ? "active" : ""}" data-profile-id="${p.id}">
              <div class="profile-btn-top">
                <span class="profile-name">${esc(p.shortName)}</span>
                <span class="badge ${p.os === "linux" ? "badge-emerald" : "badge-cyan"}">${p.shell}</span>
              </div>
              <div class="profile-meta">${esc(p.arch)}</div>
              <div class="profile-meta">Default VRAM: ${p.defaultVramGb} GB</div>
            </button>
          `).join("")}
        </div>

        <div class="form-grid" style="margin-bottom:12px;">
          <div class="field">
            <label>VRAM Capacity (GB)</label>
            <input type="number" id="inp-vram-gb" value="${esc(hw.vramGb)}" min="4" max="512" />
            <div class="chip-row" style="margin-top:4px;">
              ${profile.vramChips.map((gb) => `<button class="chip-btn ${Number(hw.vramGb) === gb ? "active" : ""}" data-vram-chip="${gb}">${gb} GB</button>`).join("")}
            </div>
          </div>

          ${hw.profileId === "amd_win_x64" ? `
            <div class="field">
              <label>AMD Compute Backend</label>
              <div class="chip-row">
                <button class="chip-btn ${hw.amdBackend === "vulkan" ? "active" : ""}" data-amd-backend="vulkan">Vulkan0 (Default)</button>
                <button class="chip-btn ${hw.amdBackend === "rocm" ? "active" : ""}" data-amd-backend="rocm">ROCm / HIP0</button>
              </div>
              ${hw.amdBackend === "vulkan" ? `
                <label style="margin-top:6px; font-weight:500;">
                  <span><input type="checkbox" id="chk-amd-fa" ${hw.amdEnableFa ? "checked" : ""} /> Include <code>-fa 1</code> on Vulkan</span>
                </label>` : ""}
            </div>
          ` : ""}

          ${profile.supportsMultiGpu ? `
            <div class="field">
              <label>CUDA Device (--device)</label>
              <input class="mono" id="inp-nvidia-dev" value="${esc(hw.nvidiaDevice)}" placeholder="CUDA0" />
            </div>
            <div class="field">
              <label>Multi-GPU Tensor Split (Optional)</label>
              <input class="mono" id="inp-tensor-split" value="${esc(hw.tensorSplit)}" placeholder="e.g. 0.5,0.5" />
            </div>
          ` : ""}

          ${hw.profileId === "dgx_spark_linux_arm64" ? `
            <div class="field">
              <label>DGX Setup Mode</label>
              <label style="font-weight:500;"><input type="checkbox" id="chk-non-sudo" ${hw.nonSudoSetup ? "checked" : ""} /> Non-sudo fallback (skip <code>apt install python3-dev</code>)</label>
            </div>
          ` : ""}

          ${hw.profileId === "rtx_spark_win_arm64" ? `
            <div class="field">
              <label>ARM64 Optional Wheels</label>
              <label style="font-weight:500;"><input type="checkbox" id="chk-rtx-tdigest" ${hw.rtxArmTdigestCompile ? "checked" : ""} /> Compile <code>aiperf[tdigest]</code> (VS C++ ARM64 required)</label>
            </div>
          ` : ""}

          <div class="field">
            <label>Server Host & Port</label>
            <div style="display:flex; gap:6px;">
              <input class="mono" id="inp-srv-host" value="${esc(hw.host)}" placeholder="0.0.0.0" />
              <input class="mono" id="inp-srv-port" type="number" value="${esc(hw.port)}" style="max-width:95px;" />
            </div>
          </div>
        </div>

        <div class="form-grid-2">
          <div class="field">
            <label>llama.cpp Binaries Folder</label>
            <input class="mono" id="inp-bin-dir" value="${esc(hw.binDir)}" />
          </div>
          <div class="field">
            <label>Centralized Results Folder</label>
            <input class="mono" id="inp-results-dir" value="${esc(hw.resultsDir)}" />
          </div>
          <div class="field">
            <label>Benchmarks Root (Venvs / llmperf)</label>
            <input class="mono" id="inp-bench-root" value="${esc(hw.benchRoot)}" />
          </div>
          <div class="field">
            <label>llama.cpp Repo Root (for SPEED-Bench)</label>
            <input class="mono" id="inp-repo-dir" value="${esc(hw.repoDir)}" />
          </div>
        </div>
      </section>
    `;

    // Section 02: Smart Model Path Extractor & Model Library
    const secModel = `
      <section class="panel-card section-block" id="sec-model">
        <div class="card-header" style="margin-bottom:12px;">
          <div class="card-title-group">
            <div class="card-kicker"><span class="index-num">02</span><span class="badge badge-cyan">SMART PATH PARSER & LIBRARY</span></div>
            <h2 class="card-title">Paste Model Path — Auto-Fill Everything</h2>
            <p class="card-desc">Zero hardcoded usernames. Paste any Windows or Linux <code>.gguf</code> path to derive alias, slug, tokenizer ID & weight estimate.</p>
          </div>
          <button class="btn" id="btn-save-custom-model">+ Save Model to Library</button>
        </div>

        <div class="chip-row" style="margin-bottom:10px;">
          <span class="small muted" style="font-weight:600;">Quick Presets:</span>
          ${Data.QUICK_MODELS.map((qm) => `
            <button class="chip-btn ${mod.alias === qm.alias ? "active" : ""}" data-quick-model="${qm.id}" title="${esc(qm.tag)}">
              ${esc(qm.label)}
            </button>
          `).join("")}
        </div>

        ${state.customModels.length ? `
          <div class="chip-row" style="margin-bottom:10px;">
            <span class="small muted" style="font-weight:600;">Saved Models:</span>
            ${state.customModels.map((cm, idx) => `
              <span class="chip-btn ${mod.fullPath === cm.fullPath ? "active" : ""}">
                <span data-load-custom-model="${idx}" style="cursor:pointer;">${esc(cm.alias)}</span>
                <span data-del-custom-model="${idx}" style="cursor:pointer; opacity:0.65; margin-left:4px;">×</span>
              </span>
            `).join("")}
          </div>
        ` : ""}

        <div class="field" style="margin-bottom:12px;">
          <label>
            <span>Full Model File Path (.gguf)</span>
            <span class="small muted">Paste full path to auto-extract fields below</span>
          </label>
          <input class="mono" id="inp-model-path" value="${esc(mod.fullPath)}" placeholder="Paste .gguf path e.g. C:\\Users\\Admin\\.lmstudio\\models\\...\\Qwen3.8-27B-UD-Q4_K_M.gguf" />
        </div>

        <div class="form-grid">
          <div class="field">
            <label>Served Model Alias (--alias)</label>
            <input class="mono" id="inp-model-alias" value="${esc(mod.alias)}" />
          </div>
          <div class="field">
            <label>Clean Output Slug</label>
            <input class="mono" id="inp-model-slug" value="${esc(mod.slug)}" />
          </div>
          <div class="field">
            <label>HF Tokenizer ID</label>
            <input class="mono" id="inp-model-tok" value="${esc(mod.tokenizer)}" />
          </div>
          <div class="field">
            <label>Model Weight (GB) / Params (B)</label>
            <div style="display:flex; gap:6px;">
              <input class="mono" type="number" step="0.1" id="inp-model-gb" value="${esc(mod.weightGb)}" />
              <input class="mono" type="number" step="1" id="inp-model-params" value="${esc(mod.paramsB)}" style="max-width:80px;" />
            </div>
          </div>
          <div class="field">
            <label>Client --model Argument</label>
            <div class="chip-row">
              <button class="chip-btn ${mod.clientModelMode === "alias" ? "active" : ""}" data-client-model-mode="alias">Served Alias</button>
              <button class="chip-btn ${mod.clientModelMode === "fullpath" ? "active" : ""}" data-client-model-mode="fullpath">Full Path</button>
            </div>
          </div>
        </div>
      </section>
    `;

    // Section 03: Naming Engine, Presets & Proactive Guardrails
    const secPresets = `
      <section class="panel-card section-block" id="sec-presets">
        <div class="card-header" style="margin-bottom:12px;">
          <div class="card-title-group">
            <div class="card-kicker"><span class="index-num">03</span><span class="badge badge-amber">NAMING ENGINE, PRESETS & GUARDRAILS</span></div>
            <h2 class="card-title">Dynamic Result Naming, Presets & Context/VRAM Safety</h2>
          </div>
          <div class="action-group">
            <button class="btn" id="btn-save-preset">+ Save Current Settings as Preset</button>
            <button class="btn btn-amber" id="btn-reset-all-parity">Reset All to Parity Defaults</button>
          </div>
        </div>

        <div class="form-grid-2" style="margin-bottom:14px;">
          <div class="field">
            <label>Dynamic Result Naming Mode</label>
            <div class="chip-row">
              <button class="chip-btn ${state.naming.mode === "auto" ? "active" : ""}" data-naming-mode="auto">Auto (Stamp on Customize)</button>
              <button class="chip-btn amber ${state.naming.mode === "stamped" ? "active" : ""}" data-naming-mode="stamped">Mode A · Parameter-Stamped</button>
              <button class="chip-btn ${state.naming.mode === "classic" ? "active" : ""}" data-naming-mode="classic">Mode B · Classic Parity</button>
            </div>
          </div>

          <div class="field">
            <label>Saved Parameter Presets (${esc(state.naming.activePresetName)})</label>
            <div class="chip-row">
              <button class="chip-btn ${state.naming.activePresetName === "Baseline Parity Defaults" ? "active" : ""}" id="btn-load-parity-preset">Baseline Parity Defaults</button>
              ${state.customPresets.map((cp, idx) => `
                <span class="chip-btn ${state.naming.activePresetName === cp.name ? "active" : ""}">
                  <span data-load-preset="${idx}" style="cursor:pointer;">${esc(cp.name)}</span>
                  <span data-del-preset="${idx}" style="cursor:pointer; opacity:0.65; margin-left:4px;">×</span>
                </span>
              `).join("")}
            </div>
          </div>
        </div>

        <div class="guardrail-stack" id="guardrails-host"></div>
      </section>
    `;

    // Section 04: 6 Benchmark Suites (7 Cards)
    const secSuites = `
      <section class="section-block" id="sec-suites" style="display:flex; flex-direction:column; gap:14px;">
        <div class="action-bar" style="padding:0 2px;">
          <div>
            <span class="index-num">04</span>
            <strong style="margin-left:6px; font-size:15px;">Benchmark Suites (${state.ui.showMissingOnly ? "Filtered: Missing/Incomplete Only" : "All 6 Core Suites"})</strong>
          </div>
          <button class="chip-btn ${state.ui.showMissingOnly ? "amber active" : ""}" id="btn-builder-missing-toggle">
            ${state.ui.showMissingOnly ? "Showing Missing / Incomplete Only (Show All)" : "Generate Commands for Missing / Incomplete Runs Only"}
          </button>
        </div>
        ${Data.SUITE_METADATA.map((meta) => renderSuiteCard(meta)).join("")}
      </section>
    `;

    // Section 05: Playbook Output
    const secPlaybook = `
      <section class="panel-card section-block" id="sec-playbook">
        <div class="card-header" style="margin-bottom:12px;">
          <div class="card-title-group">
            <div class="card-kicker"><span class="index-num">05</span><span class="badge badge-emerald">ALL-IN-ONE PLAYBOOK</span></div>
            <h2 class="card-title">Complete Copy-Pasteable Runbook (${esc(profile.shortName)})</h2>
            <p class="card-desc">Combines every active suite using your live paths, naming rules, and preset settings.</p>
          </div>
          <div class="action-group">
            <button class="btn btn-primary" id="btn-copy-playbook">Copy Full Playbook</button>
            <button class="btn" id="btn-dl-playbook">Download Script (${profile.os === "windows" ? ".ps1" : ".sh"})</button>
          </div>
        </div>
        <div class="terminal-box">
          <div class="terminal-header">
            <span>${profile.shell} · ${state.ui.showMissingOnly ? "Missing/Incomplete Runs Only" : "Full 6-Suite Playbook"}</span>
            <span>${esc(state.model.alias)}</span>
          </div>
          <pre class="terminal-pre" id="playbook-code">${Engine.highlightShell(Engine.buildAllInOnePlaybook(state, state.ui.showMissingOnly))}</pre>
        </div>
      </section>
    `;

    return secHardware + secModel + secPresets + secSuites + secPlaybook;
  }

  function renderSuiteParamsDrawer(suiteId) {
    const s = state.suites[suiteId];
    if (suiteId === "llama_bench") {
      return `
        <div class="form-grid">
          <div class="field"><label>Prompt Tokens (-p)</label><input class="mono" data-suite-field="llama_bench.p" value="${esc(s.p)}" /></div>
          <div class="field"><label>Gen Tokens (-n)</label><input class="mono" data-suite-field="llama_bench.n" value="${esc(s.n)}" /></div>
          <div class="field"><label>Repetitions (-r)</label><input type="number" data-suite-field="llama_bench.r" value="${esc(s.r)}" /></div>
          <div class="field"><label>GPU Layers (-ngl)</label><input type="number" data-suite-field="llama_bench.ngl" value="${esc(s.ngl)}" /></div>
          <div class="field"><label>Batch (-b) / Micro (-ub)</label>
            <div style="display:flex; gap:6px;"><input type="number" data-suite-field="llama_bench.b" value="${esc(s.b)}" /><input type="number" data-suite-field="llama_bench.ub" value="${esc(s.ub)}" /></div>
          </div>
          <div class="field"><label>Flash Attn (-fa) / Output (-o)</label>
            <div style="display:flex; gap:6px;">
              <select data-suite-field="llama_bench.fa"><option value="1" ${s.fa === "1" ? "selected" : ""}>-fa 1</option><option value="0" ${s.fa === "0" ? "selected" : ""}>-fa 0</option></select>
              <select data-suite-field="llama_bench.format"><option value="md" ${s.format === "md" ? "selected" : ""}>md</option><option value="csv" ${s.format === "csv" ? "selected" : ""}>csv</option><option value="json" ${s.format === "json" ? "selected" : ""}>json</option></select>
            </div>
          </div>
        </div>`;
    }
    if (suiteId === "llama_benchy") {
      return `
        <div class="form-grid">
          <div class="field"><label>Server Context (-c)</label><input type="number" data-suite-field="llama_benchy.c" value="${esc(s.c)}" /></div>
          <div class="field"><label>KV Cache (-ctk / -ctv)</label>
            <select data-kv-pair="llama_benchy"><option value="fp16" ${s.ctk === "fp16" ? "selected" : ""}>fp16 (Default)</option><option value="q8_0" ${s.ctk === "q8_0" ? "selected" : ""}>q8_0 (Half VRAM)</option><option value="q4_0" ${s.ctk === "q4_0" ? "selected" : ""}>q4_0 (Quarter VRAM)</option></select>
          </div>
          <div class="field"><label>--pp List</label><input class="mono" data-suite-field="llama_benchy.pp" value="${esc(s.pp)}" /></div>
          <div class="field"><label>--tg List</label><input class="mono" data-suite-field="llama_benchy.tg" value="${esc(s.tg)}" /></div>
          <div class="field"><label>--depth List</label><input class="mono" data-suite-field="llama_benchy.depth" value="${esc(s.depth)}" /></div>
          <div class="field"><label>--runs / --format</label>
            <div style="display:flex; gap:6px;"><input type="number" data-suite-field="llama_benchy.runs" value="${esc(s.runs)}" /><select data-suite-field="llama_benchy.format"><option value="md" ${s.format === "md" ? "selected" : ""}>md</option><option value="json" ${s.format === "json" ? "selected" : ""}>json</option></select></div>
          </div>
        </div>`;
    }
    if (suiteId === "llmperf") {
      return `
        <div class="chip-row" style="margin-bottom:6px;">
          <span class="small muted">Quick Profile:</span>
          <button class="chip-btn ${Number(s.meanInput) === 1024 && Number(s.meanOutput) === 256 ? "active" : ""}" data-llmperf-chip="1024-256">1024 in / 256 out (Parity)</button>
          <button class="chip-btn ${Number(s.meanInput) === 512 && Number(s.meanOutput) === 128 ? "active" : ""}" data-llmperf-chip="512-128">512 in / 128 out (Fast)</button>
        </div>
        <div class="form-grid">
          <div class="field"><label>Server Context (-c) / Slots (-np)</label>
            <div style="display:flex; gap:6px;"><input type="number" data-suite-field="llmperf.c" value="${esc(s.c)}" /><input type="number" data-suite-field="llmperf.np" value="${esc(s.np)}" style="max-width:75px;" /></div>
          </div>
          <div class="field"><label>Mean / Stddev Input Tokens</label>
            <div style="display:flex; gap:6px;"><input type="number" data-suite-field="llmperf.meanInput" value="${esc(s.meanInput)}" /><input type="number" data-suite-field="llmperf.stddevInput" value="${esc(s.stddevInput)}" /></div>
          </div>
          <div class="field"><label>Mean / Stddev Output Tokens</label>
            <div style="display:flex; gap:6px;"><input type="number" data-suite-field="llmperf.meanOutput" value="${esc(s.meanOutput)}" /><input type="number" data-suite-field="llmperf.stddevOutput" value="${esc(s.stddevOutput)}" /></div>
          </div>
          <div class="field"><label>Concurrency / Max Requests</label>
            <div style="display:flex; gap:6px;"><input type="number" data-suite-field="llmperf.concurrency" value="${esc(s.concurrency)}" /><input type="number" data-suite-field="llmperf.maxCompleted" value="${esc(s.maxCompleted)}" /></div>
          </div>
        </div>`;
    }
    if (suiteId === "speed_bench") {
      return `
        <div class="chip-row" style="margin-bottom:6px;">
          <span class="small muted">Server Context Quick Toggle:</span>
          <button class="chip-btn ${Number(s.c) === 16384 ? "active" : ""}" data-sb-ctx="16384">Standard 16k</button>
          <button class="chip-btn ${Number(s.c) === 32768 ? "active" : ""}" data-sb-ctx="32768">Standard 32k</button>
          <button class="chip-btn ${Number(s.c) === 65536 ? "active" : ""}" data-sb-ctx="65536">64k Long Context</button>
        </div>
        <div class="form-grid">
          <div class="field"><label>Server Context (-c)</label><input type="number" data-suite-field="speed_bench.c" value="${esc(s.c)}" /></div>
          <div class="field"><label>--category / --osl</label>
            <div style="display:flex; gap:6px;"><input class="mono" data-suite-field="speed_bench.category" value="${esc(s.category)}" /><input type="number" data-suite-field="speed_bench.osl" value="${esc(s.osl)}" style="max-width:85px;" /></div>
          </div>
          <div class="field"><label>--concurrency / --limit</label>
            <div style="display:flex; gap:6px;"><input type="number" data-suite-field="speed_bench.concurrency" value="${esc(s.concurrency)}" /><input type="number" data-suite-field="speed_bench.limit" value="${esc(s.limit)}" /></div>
          </div>
          <div class="field"><label>Comparator Baseline / Speculative JSON</label>
            <div style="display:flex; gap:6px;"><input class="mono" data-suite-field="speed_bench.compareBaselineFile" value="${esc(s.compareBaselineFile)}" /><input class="mono" data-suite-field="speed_bench.compareSpeculativeFile" value="${esc(s.compareSpeculativeFile)}" /></div>
          </div>
        </div>`;
    }
    if (suiteId === "agentperf") {
      return `
        <div class="form-grid">
          <div class="field"><label>Server Context (-c)</label><input type="number" data-suite-field="agentperf.c" value="${esc(s.c)}" /></div>
          <div class="field"><label>KV Cache (-ctk / -ctv)</label>
            <select data-kv-pair="agentperf"><option value="fp16" ${s.ctk === "fp16" ? "selected" : ""}>fp16</option><option value="q8_0" ${s.ctk === "q8_0" ? "selected" : ""}>q8_0</option><option value="q4_0" ${s.ctk === "q4_0" ? "selected" : ""}>q4_0</option></select>
          </div>
          <div class="field"><label>Extra CLI Flags</label><input class="mono" data-suite-field="agentperf.extraFlags" value="${esc(s.extraFlags)}" placeholder="Optional extra flags" /></div>
        </div>`;
    }
    if (suiteId === "aiperf_std") {
      return `
        <div class="form-grid">
          <div class="field"><label>Server Context (-c)</label><input type="number" data-suite-field="aiperf_std.c" value="${esc(s.c)}" /></div>
          <div class="field"><label>Concurrency / Request Count</label>
            <div style="display:flex; gap:6px;"><input type="number" data-suite-field="aiperf_std.concurrency" value="${esc(s.concurrency)}" /><input type="number" data-suite-field="aiperf_std.requestCount" value="${esc(s.requestCount)}" /></div>
          </div>
          <div class="field"><label>ISL Mean / OSL Mean</label>
            <div style="display:flex; gap:6px;"><input type="number" data-suite-field="aiperf_std.islMean" value="${esc(s.islMean)}" /><input type="number" data-suite-field="aiperf_std.oslMean" value="${esc(s.oslMean)}" /></div>
          </div>
        </div>`;
    }
    if (suiteId === "aiperf_sweep") {
      return `
        <div class="form-grid">
          <div class="field"><label>Server Context (-c)</label><input type="number" data-suite-field="aiperf_sweep.c" value="${esc(s.c)}" /></div>
          <div class="field"><label>KV Cache (-ctk / -ctv)</label>
            <select data-kv-pair="aiperf_sweep"><option value="fp16" ${s.ctk === "fp16" ? "selected" : ""}>fp16</option><option value="q8_0" ${s.ctk === "q8_0" ? "selected" : ""}>q8_0 (Recommended)</option><option value="q4_0" ${s.ctk === "q4_0" ? "selected" : ""}>q4_0</option></select>
          </div>
          <div class="field"><label>Sweep --isl List</label><input class="mono" data-suite-field="aiperf_sweep.islList" value="${esc(s.islList)}" /></div>
          <div class="field"><label>Sweep --osl List</label><input class="mono" data-suite-field="aiperf_sweep.oslList" value="${esc(s.oslList)}" /></div>
          <div class="field"><label>Concurrency / Warmup / Req Count</label>
            <div style="display:flex; gap:6px;"><input type="number" data-suite-field="aiperf_sweep.concurrency" value="${esc(s.concurrency)}" /><input type="number" data-suite-field="aiperf_sweep.warmupCount" value="${esc(s.warmupCount)}" /><input type="number" data-suite-field="aiperf_sweep.requestCount" value="${esc(s.requestCount)}" /></div>
          </div>
          <div class="field"><label>Options</label>
            <label style="font-weight:500;"><input type="checkbox" data-suite-bool="aiperf_sweep.cachePrompt" ${s.cachePrompt ? "checked" : ""} /> <code>cache_prompt:true</code> (uncheck for parity)</label>
          </div>
        </div>`;
    }
    return "";
  }

  function renderSuiteCard(meta) {
    const auditItem = (state.audit.items || {})[meta.id];
    if (state.ui.showMissingOnly && auditItem && auditItem.status === "verified") {
      return "";
    }

    const isDone = Boolean((state.completedSteps || {})[meta.id]);
    const isExpanded = Boolean((state.ui.expandedDrawers || {})[meta.id]);
    const isCustom = Engine.isSuiteCustomized(state, meta.id);
    const out = Engine.getOutputTarget(state, meta.id);
    const profile = Data.HARDWARE_PROFILES[state.hardware.profileId];
    const srvCmd = meta.hasServer ? Engine.buildServerCommand(state, meta.id) : "";
    const cliCmd = Engine.buildSuiteClientCommand(state, meta.id);

    let auditBadge = `<span class="badge">⚪ NOT AUDITED</span>`;
    if (auditItem) {
      if (auditItem.status === "verified") auditBadge = `<span class="badge badge-emerald">🟢 VERIFIED COMPLETE</span>`;
      else if (auditItem.status === "partial") auditBadge = `<span class="badge badge-amber">🟡 PARTIAL / MISMATCH</span>`;
      else if (auditItem.status === "stub") auditBadge = `<span class="badge badge-crimson">🔴 STUB / FAILED</span>`;
      else auditBadge = `<span class="badge">⚪ NOT RUN</span>`;
    }

    return `
      <article class="suite-card ${isDone ? "is-complete" : ""}" data-suite-card="${meta.id}">
        <div class="card-header">
          <div class="card-title-group">
            <div class="card-kicker">
              <span class="index-num">${meta.index}</span>
              <span class="badge ${meta.badgeClass}">${meta.category}</span>
              <span class="badge">${meta.duration}</span>
              ${isCustom ? `<span class="badge badge-amber">CUSTOMIZED</span>` : `<span class="badge">PARITY DEFAULT</span>`}
              ${auditBadge}
            </div>
            <h3 class="card-title">${esc(meta.title)}</h3>
            <p class="card-desc">${esc(meta.description)}</p>
          </div>

          <div class="action-group">
            <button class="btn" data-toggle-drawer="${meta.id}">${isExpanded ? "Hide Parameters" : "Customize Parameters"}</button>
            ${isCustom ? `<button class="btn btn-amber" data-reset-suite="${meta.id}">Reset to Parity Default</button>` : ""}
          </div>
        </div>

        <div class="output-preview-bar" data-output-preview>
          <span class="badge ${out.mode === "stamped" ? "badge-amber" : "badge-cyan"}">${out.mode === "stamped" ? "MODE A · STAMPED" : "MODE B · PARITY"}</span>
          <code>${esc(out.fullPath)}</code>
        </div>

        ${isExpanded ? `<div class="drawer-panel">${renderSuiteParamsDrawer(meta.id)}</div>` : ""}

        ${meta.hasServer ? `
          <div class="terminal-box">
            <div class="terminal-header"><span>Terminal 1 · llama-server (${profile.shell})</span><span>--alias "${esc(state.model.alias)}"</span></div>
            <pre class="terminal-pre" data-srv-code>${Engine.highlightShell(srvCmd)}</pre>
          </div>` : ""}

        <div class="terminal-box">
          <div class="terminal-header"><span>${meta.hasServer ? "Terminal 2 · Client Benchmark" : "Terminal · Native Direct Execution"} (${profile.shell})</span><span>Live Preview</span></div>
          <pre class="terminal-pre" data-cli-code>${Engine.highlightShell(cliCmd)}</pre>
        </div>

        <div class="action-bar">
          <div class="action-group">
            <button class="btn btn-primary" data-copy-client="${meta.id}">Copy Command</button>
            ${meta.hasServer ? `<button class="btn" data-copy-server="${meta.id}">Copy Server Launch</button>` : ""}
          </div>
          <button class="btn ${isDone ? "btn-emerald" : ""}" data-mark-complete="${meta.id}">
            ${isDone ? "✓ Step Complete" : "Mark Step Complete"}
          </button>
        </div>
      </article>
    `;
  }

  // ---------- View 02: Coverage Matrix (Anti-1KB Stub Auditor) ----------
  function renderCoverageView() {
    const items = state.audit.items || {};
    const verified = Object.values(items).filter((i) => i && i.status === "verified").length;
    const partial = Object.values(items).filter((i) => i && i.status === "partial").length;
    const stub = Object.values(items).filter((i) => i && i.status === "stub").length;
    const hasShowDir = typeof global.showDirectoryPicker === "function";

    return `
      <section class="panel-card">
        <div class="card-header" style="margin-bottom:14px;">
          <div class="card-title-group">
            <div class="card-kicker"><span class="index-num">02</span><span class="badge badge-cyan">ANTI-1KB STUB AUDITOR</span></div>
            <h2 class="card-title">Content-Aware Benchmark Folder Auditor</h2>
            <p class="card-desc">Inspects both file size (&gt;1–2 KB) and internal formatted metric rows/JSON exports—works via <code>file://</code> folder selection, drag-and-drop, or Directory Picker.</p>
          </div>
          <div class="action-group">
            ${hasShowDir ? `<button class="btn btn-primary" id="btn-pick-dir-api">Open Results Folder (Picker)</button>` : ""}
            <label class="btn" style="cursor:pointer;">
              Select Folder (file:// Safe)
              <input type="file" id="inp-webkit-dir" webkitdirectory multiple class="hidden" />
            </label>
            <button class="btn btn-amber" id="btn-gen-missing-builder">Generate Commands for Missing / Incomplete Only</button>
          </div>
        </div>

        <div class="dropzone" id="audit-dropzone" style="margin-bottom:16px;">
          <div style="font-weight:700; margin-bottom:4px;">Drop Centralized Results Folder or Files Here</div>
          <div class="small muted">
            ${state.audit.lastFolderName ? `Last Audited: <strong>${esc(state.audit.lastFolderName)}</strong> (${esc(state.audit.lastAuditedAt)})` : "Drag your results folder here (or click Select Folder above) to verify all 6 benchmark suites."}
          </div>
        </div>

        <div class="summary-kpi-row" style="margin-bottom:16px;">
          <div class="kpi-box"><div class="kpi-label">Verified Complete</div><div class="kpi-value" style="color:var(--accent-emerald);">${verified} / 7</div></div>
          <div class="kpi-box"><div class="kpi-label">Partial / Mismatch</div><div class="kpi-value" style="color:var(--accent-amber);">${partial}</div></div>
          <div class="kpi-box"><div class="kpi-label">Stub / Failed</div><div class="kpi-value" style="color:var(--accent-crimson);">${stub}</div></div>
          <div class="kpi-box"><div class="kpi-label">Not Run</div><div class="kpi-value">${7 - verified - partial - stub}</div></div>
        </div>

        <div class="data-table-wrap" style="margin-bottom:16px;">
          <table class="data-table">
            <thead>
              <tr><th>Suite</th><th>Expected Output Target</th><th>Status</th><th>Audit Findings</th></tr>
            </thead>
            <tbody>
              ${Data.SUITE_METADATA.map((meta) => {
                const exp = Engine.getOutputTarget(state, meta.id);
                const r = items[meta.id] || { status: "not_run", label: "NOT RUN", detail: "Select or drop a folder to audit." };
                const badgeCls = r.status === "verified" ? "badge-emerald" : r.status === "partial" ? "badge-amber" : r.status === "stub" ? "badge-crimson" : "";
                const icon = r.status === "verified" ? "🟢" : r.status === "partial" ? "🟡" : r.status === "stub" ? "🔴" : "⚪";
                return `
                  <tr>
                    <td><strong>${meta.index} · ${esc(meta.title)}</strong></td>
                    <td><code>${esc(exp.leaf)}</code></td>
                    <td><span class="badge ${badgeCls}">${icon} ${esc(r.label)}</span></td>
                    <td class="small">${esc(r.detail)}</td>
                  </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>

        <div class="terminal-box" style="margin-bottom:16px;">
          <div class="terminal-header">
            <span>Terminal Deep Audit Script (Fallback / Headless SSH)</span>
            <button class="btn" id="btn-copy-deep-audit" style="padding:3px 9px;">Copy Audit Script</button>
          </div>
          <pre class="terminal-pre" id="deep-audit-code">${Engine.highlightShell(Engine.buildDeepAuditScript(state))}</pre>
        </div>

        <h3 style="margin:0 0 8px; font-size:14px;">Reference Parity Matrix (Radeon AI Pro 9700 vs. DGX Spark)</h3>
        <div class="data-table-wrap">
          <table class="data-table">
            <thead><tr><th>Suite / Config</th><th>Radeon AI Pro 9700</th><th>DGX Spark</th><th>Purpose</th></tr></thead>
            <tbody>
              ${Data.REFERENCE_PARITY_GUIDE.map((row) => `
                <tr>
                  <td><strong>${esc(row.suite)}</strong></td>
                  <td><span class="badge badge-emerald">${esc(row.r9700)}</span></td>
                  <td><span class="badge ${row.dgx.startsWith("Completed") ? "badge-emerald" : "badge-amber"}">${esc(row.dgx)}</span></td>
                  <td class="small muted">${esc(row.purpose)}</td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  // ---------- View 03: Results & Charts Studio ----------
  function renderSvgBarChart(title, subtitle, items, unit) {
    if (!items.length) {
      return `<div class="chart-card"><h4 style="margin:0;">${esc(title)}</h4><p class="small muted">${esc(subtitle)}</p><div class="small muted">No matching parsed files loaded yet.</div></div>`;
    }
    const maxVal = Math.max(...items.map((i) => i.value), 1);
    const rowH = 34;
    const svgH = items.length * rowH + 24;
    return `
      <div class="chart-card">
        <div>
          <h4 style="margin:0; font-size:14px;">${esc(title)}</h4>
          <div class="small muted">${esc(subtitle)}</div>
        </div>
        <svg class="chart-svg" viewBox="0 0 560 ${svgH}">
          ${items.map((item, idx) => {
            const y = idx * rowH + 12;
            const barW = Math.max(4, Math.round((item.value / maxVal) * 280));
            const color = item.color || "var(--accent-primary)";
            return `
              <text x="4" y="${y + 14}" fill="var(--text-secondary)" font-size="11" font-family="var(--font-mono)">${esc(item.label.slice(0, 28))}</text>
              <rect x="210" y="${y + 2}" width="280" height="16" rx="4" fill="var(--chart-grid)" />
              <rect x="210" y="${y + 2}" width="${barW}" height="16" rx="4" fill="${color}" />
              <text x="${218 + barW}" y="${y + 14}" fill="var(--text-primary)" font-size="11" font-weight="700" font-family="var(--font-mono)">${item.value} ${esc(unit)}</text>
            `;
          }).join("")}
        </svg>
      </div>
    `;
  }

  function renderResultsView() {
    const records = state.results.loadedRecords || [];

    const benchBars = [];
    records.filter((r) => r.suiteType === "llama_bench").forEach((r) => {
      const color = r.gpuLabel.includes("DGX") ? "var(--accent-emerald)" : "var(--accent-primary)";
      if (r.metrics.tg128) benchBars.push({ label: `${r.gpuLabel.split(" ")[0]} ${r.modelLabel.split(" ")[0]} tg128`, value: r.metrics.tg128, color });
      if (r.metrics.pp512) benchBars.push({ label: `${r.gpuLabel.split(" ")[0]} ${r.modelLabel.split(" ")[0]} pp512/10`, value: Math.round(r.metrics.pp512 / 10), color: "var(--accent-amber)" });
    });

    const depthBars = records.filter((r) => r.suiteType === "llama_benchy").map((r) => ({
      label: `${r.gpuLabel.split(" ")[0]} ${r.modelLabel.split(" ")[0]} Drop`,
      value: r.metrics.degradationPct || 0,
      color: "var(--accent-crimson)"
    }));

    const concBars = records.filter((r) => r.suiteType === "llmperf").map((r) => ({
      label: `${r.gpuLabel.split(" ")[0]} ${r.modelLabel.split(" ")[0]} Total`,
      value: r.metrics.totalTps || 0,
      color: "var(--accent-primary)"
    }));

    const sbBars = records.filter((r) => r.suiteType === "speed_bench").map((r) => ({
      label: `${r.gpuLabel.split(" ")[0]} Overall`,
      value: r.metrics.overall || 0,
      color: "var(--accent-emerald)"
    }));

    const sweepRecs = records.filter((r) => r.suiteType === "aiperf_sweep");

    return `
      <section class="panel-card">
        <div class="card-header" style="margin-bottom:14px;">
          <div class="card-title-group">
            <div class="card-kicker"><span class="index-num">03</span><span class="badge badge-cyan">RESULT PARSER & COMPARISON STUDIO</span></div>
            <h2 class="card-title">Interactive Comparison Tables, SVG Charts & Exports</h2>
            <p class="card-desc">Drop or load <code>.md</code> and <code>.json</code> benchmark files across DGX Spark, RTX 5090 & Radeon AI Pro R9700.</p>
          </div>
          <div class="action-group">
            <button class="btn btn-amber" id="btn-load-sample-data">Load Sample Dataset (DGX Spark vs R9700)</button>
            <label class="btn btn-primary" style="cursor:pointer;">
              Load Result Files (.md / .json)
              <input type="file" id="inp-result-files" multiple accept=".md,.json,.csv" class="hidden" />
            </label>
            <button class="btn" id="btn-export-md">Export .md</button>
            <button class="btn" id="btn-export-csv">Export .csv</button>
            ${records.length ? `<button class="btn btn-crimson" id="btn-clear-results">Clear</button>` : ""}
          </div>
        </div>

        <div class="dropzone" id="results-dropzone" style="margin-bottom:16px;">
          <strong>Drag & Drop Benchmark <code>.md</code> or <code>.json</code> Result Files Here</strong>
          <div class="small muted" style="margin-top:4px;">Supports <code>llama-bench</code>, <code>llama-benchy</code>, <code>llmperf</code>, <code>SPEED-Bench</code>, and <code>AIPerf</code> exports (${records.length} record(s) active).</div>
        </div>

        <div class="chart-grid" style="margin-bottom:16px;">
          ${renderSvgBarChart("Prefill (pp512 / 10) & Decode (tg128) Throughput", "Native C++ llama-bench comparison", benchBars, "t/s")}
          ${renderSvgBarChart("Depth 4096 KV Cache Degradation (%)", "Lower % drop = better long-context cache stability", depthBars, "% drop")}
          ${renderSvgBarChart("4-Stream Concurrency Output Throughput", "llmperf / AIPerf parallel stream total t/s", concBars, "t/s")}
          ${renderSvgBarChart("SPEED-Bench Qualitative Mean Throughput", "Multi-category qualitative average speed", sbBars, "t/s")}
        </div>

        <div class="chart-card" style="margin-bottom:16px;">
          <div>
            <h4 style="margin:0; font-size:14px;">16k / 32k / 64k Long-Context Scaling Curve (AIPerf Sweep)</h4>
            <div class="small muted">Decode t/s scaling across 16k, 32k, and 64k input token prompts</div>
          </div>
          ${sweepRecs.length ? `
            <svg class="chart-svg" viewBox="0 0 560 175">
              <line x1="60" y1="20" x2="60" y2="140" stroke="var(--border-strong)" />
              <line x1="60" y1="140" x2="520" y2="140" stroke="var(--border-strong)" />
              <text x="110" y="160" fill="var(--text-secondary)" font-size="11" font-family="var(--font-mono)">16k ISL</text>
              <text x="275" y="160" fill="var(--text-secondary)" font-size="11" font-family="var(--font-mono)">32k ISL</text>
              <text x="455" y="160" fill="var(--text-secondary)" font-size="11" font-family="var(--font-mono)">64k ISL</text>
              ${sweepRecs.map((rec, idx) => {
                const maxT = Math.max(...sweepRecs.flatMap((r) => [r.metrics.tps16k || 0, r.metrics.tps32k || 0, r.metrics.tps64k || 0]), 40);
                const yMap = (v) => 135 - Math.round(((v || 0) / maxT) * 105);
                const p1 = `125,${yMap(rec.metrics.tps16k)}`;
                const p2 = `295,${yMap(rec.metrics.tps32k)}`;
                const p3 = `470,${yMap(rec.metrics.tps64k)}`;
                const col = idx % 2 === 0 ? "var(--accent-emerald)" : "var(--accent-primary)";
                return `
                  <polyline fill="none" stroke="${col}" stroke-width="2.5" points="${p1} ${p2} ${p3}" />
                  <circle cx="125" cy="${yMap(rec.metrics.tps16k)}" r="4" fill="${col}" />
                  <circle cx="295" cy="${yMap(rec.metrics.tps32k)}" r="4" fill="${col}" />
                  <circle cx="470" cy="${yMap(rec.metrics.tps64k)}" r="4" fill="${col}" />
                  <text x="72" y="${18 + idx * 15}" fill="${col}" font-size="11" font-family="var(--font-mono)">● ${esc(rec.gpuLabel)} (${rec.metrics.tps16k} → ${rec.metrics.tps64k} t/s)</text>
                `;
              }).join("")}
            </svg>
          ` : `<div class="small muted">Load an AIPerf 64k sweep JSON or click "Load Sample Dataset" above to render the 16k → 64k scaling curve.</div>`}
        </div>

        <div class="data-table-wrap">
          <table class="data-table">
            <thead><tr><th>Source File</th><th>GPU / Backend</th><th>Model</th><th>Suite</th><th>Parsed Metrics</th></tr></thead>
            <tbody>
              ${records.length ? records.map((r) => `
                <tr>
                  <td><code>${esc(r.sourceFile)}</code> ${r.isSample ? `<span class="badge badge-amber">SAMPLE</span>` : ""}</td>
                  <td>${esc(r.gpuLabel)}</td>
                  <td>${esc(r.modelLabel)}</td>
                  <td><span class="badge">${esc(r.suiteType)}</span></td>
                  <td class="mono small">${esc(Object.entries(r.metrics || {}).map(([k, v]) => `${k}=${v}`).join(" · "))}</td>
                </tr>`).join("") : `<tr><td colspan="5" class="muted">No result files loaded yet. Drop files above or click "Load Sample Dataset".</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  // ---------- View 04: SSH Remote & DGX Hermes Stack ----------
  function renderSshView() {
    const s = state.ssh;
    const cmds = Engine.buildSshCommands(state);

    const blocks = [
      { id: "ssh-ps", title: "01 · Windows PowerShell 1-Line SSH Trigger (Persistent tmux)", code: cmds.psTrigger },
      { id: "ssh-tmux", title: "02 · Remote Linux tmux Split Session Setup", code: cmds.tmuxLaunch },
      { id: "ssh-scp", title: "03 · Pull Remote Results via scp -r into Local Centralized Folder", code: cmds.scpPull },
      { id: "ssh-vram", title: "04 · Pre-Benchmark DGX Spark VRAM Sweep (Free All AI Ports)", code: cmds.vramSweep },
      { id: "ssh-startai", title: "05 · Post-Benchmark Restore: Bring Hermes AI Stack Back Online (start-ai)", code: cmds.startAiRestore },
      { id: "ssh-hermes", title: "06 · Hermes Agent Multi-Instance Routing YAML Snippet", code: cmds.hermesYaml }
    ];

    return `
      <section class="panel-card">
        <div class="card-header" style="margin-bottom:14px;">
          <div class="card-title-group">
            <div class="card-kicker"><span class="index-num">04</span><span class="badge badge-emerald">SSH REMOTE & HERMES HOST</span></div>
            <h2 class="card-title">Remote Linux/DGX Execution, tmux, scp & Hermes Stack Control</h2>
            <p class="card-desc">All SSH parameters and Hermes LAN routing settings auto-save to <code>localStorage</code>.</p>
          </div>
        </div>

        <div class="form-grid" style="margin-bottom:16px;">
          <div class="field"><label>SSH User</label><input class="mono" data-ssh-field="user" value="${esc(s.user)}" /></div>
          <div class="field"><label>Remote Host / IP</label><input class="mono" data-ssh-field="host" value="${esc(s.host)}" /></div>
          <div class="field"><label>SSH Port</label><input type="number" class="mono" data-ssh-field="port" value="${esc(s.port)}" /></div>
          <div class="field"><label>tmux Session Name</label><input class="mono" data-ssh-field="tmuxSession" value="${esc(s.tmuxSession)}" /></div>
          <div class="field"><label>Remote Results Directory</label><input class="mono" data-ssh-field="remoteResultsDir" value="${esc(s.remoteResultsDir)}" /></div>
          <div class="field"><label>Local Windows Pull Folder</label><input class="mono" data-ssh-field="localPullDir" value="${esc(s.localPullDir)}" /></div>
          <div class="field"><label>Hermes Host LAN IP</label><input class="mono" data-ssh-field="hermesServerIp" value="${esc(s.hermesServerIp)}" /></div>
          <div class="field"><label>vLLM Restore Options</label>
            <label style="font-weight:500;"><input type="checkbox" id="chk-vllm-restore" ${s.includeVllmInStartAi ? "checked" : ""} /> Include vLLM (${esc(s.vllmGpuUtil)} VRAM) in restore</label>
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:14px;">
          ${blocks.map((b) => `
            <div class="terminal-box">
              <div class="terminal-header">
                <span>${esc(b.title)}</span>
                <button class="btn" data-copy-raw="${esc(b.id)}" style="padding:3px 9px;">Copy</button>
              </div>
              <pre class="terminal-pre" id="code-${esc(b.id)}">${Engine.highlightShell(b.code)}</pre>
            </div>
          `).join("")}
        </div>
      </section>
    `;
  }

  // ---------- View 05: Setup & Fixes ----------
  function renderSetupView() {
    const profile = Data.HARDWARE_PROFILES[state.hardware.profileId];
    const cards = Engine.buildSetupCards(state);
    return `
      <section class="panel-card">
        <div class="card-header" style="margin-bottom:14px;">
          <div class="card-title-group">
            <div class="card-kicker"><span class="index-num">05</span><span class="badge badge-amber">ENVIRONMENT SETUP & HOTFIXES</span></div>
            <h2 class="card-title">Platform Setup, Python 3.12+ Patches & Troubleshooting (${esc(profile.shortName)})</h2>
            <p class="card-desc">Tailored for ${esc(profile.name)} (${esc(profile.arch)}).</p>
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:14px;">
          ${cards.map((c) => `
            <div class="terminal-box">
              <div class="terminal-header">
                <span><strong>${esc(c.title)}</strong> <span class="badge badge-cyan" style="margin-left:6px;">${esc(c.badge)}</span></span>
                <button class="btn" data-copy-setup="${esc(c.id)}" style="padding:3px 9px;">Copy Command</button>
              </div>
              <pre class="terminal-pre" id="setup-pre-${esc(c.id)}">${Engine.highlightShell(c.cmd)}</pre>
            </div>
          `).join("")}
        </div>
      </section>
    `;
  }

  // ---------- Root Render & Event Wiring ----------
  function renderApp() {
    applyThemeAndMotion();
    const root = document.getElementById("app");
    if (!root) return;

    let mainHtml = "";
    if (state.ui.activeTab === "builder") mainHtml = renderBuilderView();
    else if (state.ui.activeTab === "coverage") mainHtml = renderCoverageView();
    else if (state.ui.activeTab === "results") mainHtml = renderResultsView();
    else if (state.ui.activeTab === "ssh") mainHtml = renderSshView();
    else if (state.ui.activeTab === "setup") mainHtml = renderSetupView();

    root.innerHTML = `
      ${renderNavbar()}
      <div class="app-shell">
        ${renderSidebarRail()}
        <main class="main-content">${mainHtml}</main>
      </div>
    `;

    updateGuardrailsDOM();
    updateRailDOM();
    bindEvents();
  }

  function bindEvents() {
    // Navbar Tabs
    document.querySelectorAll("[data-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.ui.activeTab = btn.getAttribute("data-tab");
        persist();
        renderApp();
      });
    });

    // Pause Animations / Benchmark Stealth Mode (Option 2A)
    const pauseBtn = document.getElementById("btn-pause-anim");
    if (pauseBtn) {
      pauseBtn.addEventListener("click", () => {
        state.ui.pauseAnimations = !state.ui.pauseAnimations;
        persist();
        renderApp();
      });
    }

    const lightTermBtn = document.getElementById("btn-light-term");
    if (lightTermBtn) {
      lightTermBtn.addEventListener("click", () => {
        state.ui.lightTerminal = !state.ui.lightTerminal;
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

    // Sidebar Rail
    document.querySelectorAll("[data-rail-sec]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const secId = btn.getAttribute("data-rail-sec");
        const tabId = btn.getAttribute("data-rail-tab");
        state.ui.activeSection = secId;
        state.ui.activeTab = tabId;
        persist();
        renderApp();
        setTimeout(() => {
          const el = document.getElementById(secId);
          if (el) el.scrollIntoView({ behavior: state.ui.pauseAnimations ? "auto" : "smooth" });
        }, 20);
      });
    });

    const railMissingBtn = document.getElementById("btn-rail-missing");
    if (railMissingBtn) {
      railMissingBtn.addEventListener("click", () => {
        state.ui.showMissingOnly = !state.ui.showMissingOnly;
        persist();
        renderApp();
      });
    }

    // Hardware Profile & Settings
    document.querySelectorAll("[data-profile-id]").forEach((btn) => {
      btn.addEventListener("click", () => switchHardwareProfile(btn.getAttribute("data-profile-id")));
    });

    document.querySelectorAll("[data-vram-chip]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.hardware.vramGb = Number(btn.getAttribute("data-vram-chip"));
        persist();
        renderApp();
      });
    });

    document.querySelectorAll("[data-amd-backend]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.hardware.amdBackend = btn.getAttribute("data-amd-backend");
        state.hardware.binDir = state.hardware.amdBackend === "rocm" ? "C:\\llama.cpp\\hip" : "C:\\llama.cpp\\vulkan";
        persist();
        renderApp();
      });
    });

    const wireInput = (id, handler) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener(el.type === "checkbox" ? "change" : "input", (e) => {
        handler(e.target);
        persist();
        refreshLiveOutputs();
      });
    };

    wireInput("inp-vram-gb", (el) => { state.hardware.vramGb = Number(el.value) || 32; });
    wireInput("chk-amd-fa", (el) => { state.hardware.amdEnableFa = el.checked; });
    wireInput("inp-nvidia-dev", (el) => { state.hardware.nvidiaDevice = el.value; });
    wireInput("inp-tensor-split", (el) => { state.hardware.tensorSplit = el.value; });
    wireInput("chk-non-sudo", (el) => { state.hardware.nonSudoSetup = el.checked; });
    wireInput("chk-rtx-tdigest", (el) => { state.hardware.rtxArmTdigestCompile = el.checked; });
    wireInput("inp-srv-host", (el) => { state.hardware.host = el.value; });
    wireInput("inp-srv-port", (el) => { state.hardware.port = Number(el.value) || 8080; });
    wireInput("inp-bin-dir", (el) => { state.hardware.binDir = el.value; });
    wireInput("inp-results-dir", (el) => { state.hardware.resultsDir = el.value; });
    wireInput("inp-bench-root", (el) => { state.hardware.benchRoot = el.value; });
    wireInput("inp-repo-dir", (el) => { state.hardware.repoDir = el.value; });

    // Smart Model Path Parser & Library
    const modelPathInp = document.getElementById("inp-model-path");
    if (modelPathInp) {
      modelPathInp.addEventListener("input", () => {
        state.model.fullPath = modelPathInp.value;
        const parsed = Engine.parseModelPath(modelPathInp.value);
        state.model.baseDir = parsed.baseDir;
        state.model.filename = parsed.filename;
        state.model.alias = parsed.alias;
        state.model.slug = parsed.slug;
        state.model.tokenizer = parsed.tokenizer;
        state.model.weightGb = parsed.weightGb;
        state.model.paramsB = parsed.paramsB;
        const setVal = (id, v) => { const f = document.getElementById(id); if (f) f.value = v; };
        setVal("inp-model-alias", parsed.alias);
        setVal("inp-model-slug", parsed.slug);
        setVal("inp-model-tok", parsed.tokenizer);
        setVal("inp-model-gb", parsed.weightGb);
        setVal("inp-model-params", parsed.paramsB);
        persist();
        refreshLiveOutputs();
      });
    }

    wireInput("inp-model-alias", (el) => { state.model.alias = el.value; });
    wireInput("inp-model-slug", (el) => { state.model.slug = el.value; });
    wireInput("inp-model-tok", (el) => { state.model.tokenizer = el.value; });
    wireInput("inp-model-gb", (el) => { state.model.weightGb = parseFloat(el.value) || 15.8; });
    wireInput("inp-model-params", (el) => { state.model.paramsB = parseFloat(el.value) || 27; });

    document.querySelectorAll("[data-quick-model]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const qm = Data.QUICK_MODELS.find((m) => m.id === btn.getAttribute("data-quick-model"));
        if (qm) applyQuickModel(qm);
      });
    });

    document.querySelectorAll("[data-client-model-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.model.clientModelMode = btn.getAttribute("data-client-model-mode");
        persist();
        renderApp();
      });
    });

    const saveModelBtn = document.getElementById("btn-save-custom-model");
    if (saveModelBtn) {
      saveModelBtn.addEventListener("click", () => {
        state.customModels.push({ ...state.model });
        persist();
        renderApp();
      });
    }

    document.querySelectorAll("[data-load-custom-model]").forEach((el) => {
      el.addEventListener("click", () => {
        const cm = state.customModels[Number(el.getAttribute("data-load-custom-model"))];
        if (cm) {
          state.model = { ...state.model, ...cm };
          persist();
          renderApp();
        }
      });
    });

    document.querySelectorAll("[data-del-custom-model]").forEach((el) => {
      el.addEventListener("click", () => {
        state.customModels.splice(Number(el.getAttribute("data-del-custom-model")), 1);
        persist();
        renderApp();
      });
    });

    // Naming & Presets
    document.querySelectorAll("[data-naming-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.naming.mode = btn.getAttribute("data-naming-mode");
        persist();
        renderApp();
      });
    });

    const savePresetBtn = document.getElementById("btn-save-preset");
    if (savePresetBtn) {
      savePresetBtn.addEventListener("click", () => {
        const name = global.prompt("Enter a name for this parameter preset:", `Custom ${state.model.slug} (${new Date().toLocaleDateString()})`);
        if (!name || !name.trim()) return;
        state.customPresets.push({ name: name.trim(), suites: JSON.parse(JSON.stringify(state.suites)) });
        state.naming.activePresetName = name.trim();
        persist();
        renderApp();
      });
    }

    const loadParityBtn = document.getElementById("btn-load-parity-preset");
    if (loadParityBtn) {
      loadParityBtn.addEventListener("click", () => {
        state.suites = JSON.parse(JSON.stringify(Data.PARITY_DEFAULTS));
        state.naming.activePresetName = "Baseline Parity Defaults";
        persist();
        renderApp();
      });
    }

    const resetAllBtn = document.getElementById("btn-reset-all-parity");
    if (resetAllBtn) {
      resetAllBtn.addEventListener("click", () => {
        state.suites = JSON.parse(JSON.stringify(Data.PARITY_DEFAULTS));
        state.naming.activePresetName = "Baseline Parity Defaults";
        persist();
        renderApp();
      });
    }

    document.querySelectorAll("[data-load-preset]").forEach((el) => {
      el.addEventListener("click", () => {
        const p = state.customPresets[Number(el.getAttribute("data-load-preset"))];
        if (p) {
          state.suites = JSON.parse(JSON.stringify(p.suites));
          state.naming.activePresetName = p.name;
          persist();
          renderApp();
        }
      });
    });

    document.querySelectorAll("[data-del-preset]").forEach((el) => {
      el.addEventListener("click", () => {
        state.customPresets.splice(Number(el.getAttribute("data-del-preset")), 1);
        persist();
        renderApp();
      });
    });

    // Suite Cards, Drawers & Live Fields
    const missingToggle = document.getElementById("btn-builder-missing-toggle");
    if (missingToggle) {
      missingToggle.addEventListener("click", () => {
        state.ui.showMissingOnly = !state.ui.showMissingOnly;
        persist();
        renderApp();
      });
    }

    document.querySelectorAll("[data-toggle-drawer]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sid = btn.getAttribute("data-toggle-drawer");
        state.ui.expandedDrawers[sid] = !state.ui.expandedDrawers[sid];
        persist();
        renderApp();
      });
    });

    document.querySelectorAll("[data-reset-suite]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sid = btn.getAttribute("data-reset-suite");
        state.suites[sid] = JSON.parse(JSON.stringify(Data.PARITY_DEFAULTS[sid]));
        persist();
        renderApp();
      });
    });

    document.querySelectorAll("[data-suite-field]").forEach((el) => {
      const [sid, field] = el.getAttribute("data-suite-field").split(".");
      el.addEventListener(el.tagName === "SELECT" ? "change" : "input", () => {
        state.suites[sid][field] = el.type === "number" ? (Number(el.value) || 0) : el.value;
        persist();
        refreshLiveOutputs();
      });
    });

    document.querySelectorAll("[data-suite-bool]").forEach((el) => {
      const [sid, field] = el.getAttribute("data-suite-bool").split(".");
      el.addEventListener("change", () => {
        state.suites[sid][field] = el.checked;
        persist();
        refreshLiveOutputs();
      });
    });

    document.querySelectorAll("[data-kv-pair]").forEach((sel) => {
      const sid = sel.getAttribute("data-kv-pair");
      sel.addEventListener("change", () => {
        state.suites[sid].ctk = sel.value;
        state.suites[sid].ctv = sel.value;
        persist();
        refreshLiveOutputs();
      });
    });

    document.querySelectorAll("[data-llmperf-chip]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.getAttribute("data-llmperf-chip");
        if (mode === "512-128") {
          state.suites.llmperf.meanInput = 512;
          state.suites.llmperf.meanOutput = 128;
        } else {
          state.suites.llmperf.meanInput = 1024;
          state.suites.llmperf.meanOutput = 256;
        }
        persist();
        renderApp();
      });
    });

    document.querySelectorAll("[data-sb-ctx]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.suites.speed_bench.c = Number(btn.getAttribute("data-sb-ctx"));
        persist();
        renderApp();
      });
    });

    document.querySelectorAll("[data-copy-client]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sid = btn.getAttribute("data-copy-client");
        copyText(btn, Engine.buildSuiteClientCommand(state, sid), "Copy Command");
      });
    });

    document.querySelectorAll("[data-copy-server]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sid = btn.getAttribute("data-copy-server");
        copyText(btn, Engine.buildServerCommand(state, sid), "Copy Server Launch");
      });
    });

    document.querySelectorAll("[data-mark-complete]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sid = btn.getAttribute("data-mark-complete");
        state.completedSteps[sid] = !state.completedSteps[sid];
        persist();
        renderApp();
      });
    });

    // Playbook Copy & Download
    const copyPlayBtn = document.getElementById("btn-copy-playbook");
    if (copyPlayBtn) {
      copyPlayBtn.addEventListener("click", () => {
        copyText(copyPlayBtn, Engine.buildAllInOnePlaybook(state, state.ui.showMissingOnly), "Copy Full Playbook");
      });
    }
    const dlPlayBtn = document.getElementById("btn-dl-playbook");
    if (dlPlayBtn) {
      dlPlayBtn.addEventListener("click", () => {
        const prof = Data.HARDWARE_PROFILES[state.hardware.profileId];
        const ext = prof.os === "windows" ? "ps1" : "sh";
        downloadFile(`ai_benchmate_${state.model.slug || "run"}.${ext}`, Engine.buildAllInOnePlaybook(state, state.ui.showMissingOnly));
      });
    }

    // Coverage Matrix / Folder Auditor
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
        const entries = files.map((f) => ({
          path: f.webkitRelativePath || f.name,
          name: f.name,
          size: f.size,
          textLoader: () => f.text()
        }));
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

    const genMissingBtn = document.getElementById("btn-gen-missing-builder");
    if (genMissingBtn) {
      genMissingBtn.addEventListener("click", () => {
        state.ui.showMissingOnly = true;
        state.ui.activeTab = "builder";
        persist();
        renderApp();
      });
    }

    const copyAuditBtn = document.getElementById("btn-copy-deep-audit");
    if (copyAuditBtn) {
      copyAuditBtn.addEventListener("click", () => {
        copyText(copyAuditBtn, Engine.buildDeepAuditScript(state), "Copy Audit Script");
      });
    }

    // Results & Charts
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

    async function handleResultFiles(fileList) {
      const arr = Array.from(fileList || []);
      const parsed = [];
      for (const f of arr) {
        const txt = await f.text();
        const rec = Engine.parseResultFile(f.name, txt);
        if (rec) parsed.push(rec);
      }
      if (parsed.length) {
        state.results.loadedRecords = [...(state.results.loadedRecords || []), ...parsed];
        persist();
        await Engine.saveSnapshotIDB("latest_results", state.results.loadedRecords);
        renderApp();
      }
    }

    const resFileInp = document.getElementById("inp-result-files");
    if (resFileInp) resFileInp.addEventListener("change", (e) => handleResultFiles(e.target.files));

    const resDrop = document.getElementById("results-dropzone");
    if (resDrop) {
      resDrop.addEventListener("dragover", (e) => { e.preventDefault(); resDrop.classList.add("dragover"); });
      resDrop.addEventListener("dragleave", () => resDrop.classList.remove("dragover"));
      resDrop.addEventListener("drop", (e) => {
        e.preventDefault();
        resDrop.classList.remove("dragover");
        handleResultFiles(e.dataTransfer.files);
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

    // SSH Remote
    document.querySelectorAll("[data-ssh-field]").forEach((el) => {
      const key = el.getAttribute("data-ssh-field");
      el.addEventListener("input", () => {
        state.ssh[key] = el.type === "number" ? (Number(el.value) || 22) : el.value;
        persist();
        const cmds = Engine.buildSshCommands(state);
        const map = {
          "ssh-ps": cmds.psTrigger,
          "ssh-tmux": cmds.tmuxLaunch,
          "ssh-scp": cmds.scpPull,
          "ssh-vram": cmds.vramSweep,
          "ssh-startai": cmds.startAiRestore,
          "ssh-hermes": cmds.hermesYaml
        };
        Object.entries(map).forEach(([id, txt]) => {
          const pre = document.getElementById("code-" + id);
          if (pre) pre.innerHTML = Engine.highlightShell(txt);
        });
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

    document.querySelectorAll("[data-copy-raw]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-copy-raw");
        const pre = document.getElementById("code-" + id);
        if (pre) copyText(btn, pre.textContent, "Copy");
      });
    });

    // Setup & Fixes
    document.querySelectorAll("[data-copy-setup]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-copy-setup");
        const pre = document.getElementById("setup-pre-" + id);
        if (pre) copyText(btn, pre.textContent, "Copy Command");
      });
    });
  }

  async function init() {
    applyThemeAndMotion();
    const savedAudit = await Engine.loadSnapshotIDB("latest_audit");
    if (savedAudit && savedAudit.items && Object.keys(state.audit.items || {}).length === 0) {
      state.audit = savedAudit;
    }
    const savedResults = await Engine.loadSnapshotIDB("latest_results");
    if (Array.isArray(savedResults) && savedResults.length && (!state.results.loadedRecords || !state.results.loadedRecords.length)) {
      state.results.loadedRecords = savedResults;
    }
    renderApp();
  }

  global.BenchmateUI = { init };
  document.addEventListener("DOMContentLoaded", init);
})(window);

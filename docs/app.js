(() => {
  "use strict";

  // --- Utilities ---
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const clamp = (min, val, max) => Math.min(max, Math.max(min, val));
  const storage = {
    get(key, fallback) {
      try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
    },
    del(key) { try { localStorage.removeItem(key); } catch {} }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied");
    } catch {
      toast("Copy failed", true);
    }
  };

  // Toasts
  let toastTimer;
  const toast = (msg, isError = false) => {
    let el = $("#toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      el.style.cssText = "position:fixed;bottom:16px;right:16px;background:#0b1220;border:1px solid var(--border);color:var(--text);padding:10px 12px;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.3);z-index:9999;opacity:0;transform:translateY(10px);transition:all .2s";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.borderColor = isError ? "var(--err)" : "var(--border)";
    el.style.opacity = "1";
    el.style.transform = "translateY(0)";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateY(10px)";
    }, 1600);
  };

  // --- Theme ---
  const applyTheme = (mode) => {
    document.documentElement.classList.toggle("light", mode === "light");
    $("#themeToggle").checked = mode === "light";
    storage.set("theme", mode);
  };
  const savedTheme = storage.get("theme", window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? "light" : "dark");
  applyTheme(savedTheme);
  $("#themeToggle").addEventListener("change", (e) => applyTheme(e.target.checked ? "light" : "dark"));

  // --- Tools ---
  const tools = [
    { id: "json", emoji: "{ }", name: "JSON Formatter", desc: "Pretty-print, minify, and validate JSON", render: renderJson },
    { id: "regex", emoji: "🔎", name: "Regex Tester", desc: "Test JavaScript regex with flags and groups", render: renderRegex },
    { id: "codec", emoji: "🔐", name: "Base64 & URL", desc: "Encode/decode Base64 and URL", render: renderCodec },
    { id: "uuid", emoji: "🆔", name: "UUID v4", desc: "Generate and validate UUIDs", render: renderUuid },
    { id: "color", emoji: "🎨", name: "Color Converter", desc: "HEX ↔ RGB ↔ HSL", render: renderColor },
    { id: "epoch", emoji: "⏱️", name: "Epoch Converter", desc: "Unix time ↔ Date", render: renderEpoch },
  ];

  // Sidebar population
  const toolList = $("#toolList");
  function renderSidebar(filter = "") {
    toolList.innerHTML = "";
    const frag = document.createDocumentFragment();
    tools.filter(t => (t.name + t.desc).toLowerCase().includes(filter.toLowerCase()))
      .forEach(t => {
        const a = document.createElement("button");
        a.className = "tool-item";
        a.setAttribute("role", "tab");
        a.setAttribute("data-id", t.id);
        a.innerHTML = `<span class="emoji">${t.emoji}</span><div><div class="name">${t.name}</div><div class="desc">${t.desc}</div></div>`;
        a.addEventListener("click", () => activateTool(t.id));
        frag.appendChild(a);
      });
    toolList.appendChild(frag);
  }
  renderSidebar();
  $("#toolSearch").addEventListener("input", (e) => renderSidebar(e.target.value));

  // Router
  const content = $("#content");
  function activateTool(id) {
    const tool = tools.find(t => t.id === id) || tools[0];
    history.replaceState({}, "", `#${tool.id}`);
    $$(".tool-item").forEach(b => b.setAttribute("aria-selected", b.getAttribute("data-id") === tool.id ? "true" : "false"));
    content.innerHTML = "";
    tool.render(content);
    content.focus();
    storage.set("lastTool", tool.id);
  }
  const initial = location.hash.slice(1) || storage.get("lastTool", tools[0].id);
  requestAnimationFrame(() => activateTool(initial));

  // Reset
  $("#clearStateBtn").addEventListener("click", () => {
    localStorage.clear();
    toast("State cleared");
  });

  // --- Renderers ---
  function panel(title, bodyHtml, footerHtml = "") {
    const el = document.createElement("div");
    el.className = "panel";
    el.innerHTML = `<h2>${title}</h2>${bodyHtml}${footerHtml ? `<div class="hint">${footerHtml}</div>` : ""}`;
    return el;
  }

  // JSON Formatter
  function renderJson(root) {
    const stateKey = "json_tool";
    const saved = storage.get(stateKey, { input: "{\n  \"hello\": \"world\"\n}", indent: 2 });
    const container = document.createElement("div");
    container.appendChild(panel("Input JSON", `
      <div class="row">
        <textarea id="jsonIn" spellcheck="false" aria-label="JSON input">${escapeHtml(saved.input)}</textarea>
      </div>
      <div class="btns">
        <button id="jsonFormat" class="primary">Format</button>
        <button id="jsonMinify">Minify</button>
        <button id="jsonSort">Sort Keys</button>
        <button id="jsonCopy">Copy</button>
        <button id="jsonClear" class="ghost">Clear</button>
      </div>
      <div class="kv" style="margin-top:8px">
        <label for="jsonIndent">Indent</label>
        <input id="jsonIndent" type="number" min="0" max="10" value="${saved.indent}">
      </div>
    `, "Tip: Use Ctrl+Enter to format"));

    container.appendChild(panel("Result", `
      <div class="row">
        <textarea id="jsonOut" spellcheck="false" aria-label="JSON result"></textarea>
      </div>
      <div class="stat" id="jsonStatus">Ready.</div>
    `));

    root.appendChild(container);

    const jsonIn = $("#jsonIn", container);
    const jsonOut = $("#jsonOut", container);
    const jsonIndent = $("#jsonIndent", container);
    const setStatus = (msg, isErr = false) => {
      const st = $("#jsonStatus", container); st.textContent = msg; st.style.color = isErr ? "var(--err)" : "var(--muted)";
    };
    const doFormat = (minify = false, sort = false) => {
      try {
        const obj = JSON.parse(jsonIn.value);
        const replacer = sort ? Object.keys(obj).sort().reduce((acc, k) => (acc[k] = obj[k], acc), {}) : obj;
        jsonOut.value = JSON.stringify(replacer, null, minify ? 0 : clamp(0, Number(jsonIndent.value) || 0, 10));
        setStatus("Valid JSON ✓");
        storage.set(stateKey, { input: jsonIn.value, indent: Number(jsonIndent.value) });
      } catch (e) {
        setStatus("Invalid JSON: " + e.message, true);
      }
    };
    $("#jsonFormat", container).addEventListener("click", () => doFormat(false, false));
    $("#jsonMinify", container).addEventListener("click", () => doFormat(true, false));
    $("#jsonSort", container).addEventListener("click", () => doFormat(false, true));
    $("#jsonCopy", container).addEventListener("click", () => copyToClipboard(jsonOut.value));
    $("#jsonClear", container).addEventListener("click", () => { jsonIn.value = ""; jsonOut.value = ""; setStatus("Cleared"); });
    jsonIn.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); doFormat(false, false); } });
    doFormat(false, false);
  }

  // Regex Tester
  function renderRegex(root) {
    const stateKey = "regex_tool";
    const saved = storage.get(stateKey, { source: "(foo|bar)", flags: "g", input: "foobar foo baz" });
    const container = document.createElement("div");
    container.appendChild(panel("Pattern", `
      <div class="row">
        <input id="reSource" value="${escapeHtml(saved.source)}" spellcheck="false" placeholder="Pattern e.g. (foo|bar)">
        <input id="reFlags" value="${escapeHtml(saved.flags)}" spellcheck="false" placeholder="Flags e.g. gimuy">
      </div>
      <div class="btns"><button id="reRun" class="primary">Run</button><button id="reCopy">Copy matches</button></div>
    `));
    container.appendChild(panel("Input", `
      <textarea id="reInput" spellcheck="false">${escapeHtml(saved.input)}</textarea>
    `));
    container.appendChild(panel("Matches", `
      <div class="row"><textarea id="reOutput" spellcheck="false"></textarea></div>
      <div class="stat" id="reStatus">Ready.</div>
    `));
    root.appendChild(container);

    const reSource = $("#reSource", container);
    const reFlags = $("#reFlags", container);
    const reInput = $("#reInput", container);
    const reOutput = $("#reOutput", container);
    const setStatus = (m, err) => { const el = $("#reStatus", container); el.textContent = m; el.style.color = err ? "var(--err)" : "var(--muted)"; };
    const run = () => {
      try {
        const r = new RegExp(reSource.value, reFlags.value);
        let match; const matches = []; const groups = [];
        if (!r.global) {
          match = r.exec(reInput.value);
          if (match) { matches.push(match[0]); if (match.groups) groups.push(match.groups); }
        } else {
          while ((match = r.exec(reInput.value)) !== null) {
            matches.push(match[0]); if (match.groups) groups.push(match.groups);
            if (match[0] === "") r.lastIndex++; // avoid infinite loop on empty matches
          }
        }
        reOutput.value = JSON.stringify({ count: matches.length, matches, groups }, null, 2);
        setStatus(`${matches.length} match(es)`);
        storage.set(stateKey, { source: reSource.value, flags: reFlags.value, input: reInput.value });
      } catch (e) {
        setStatus("Error: " + e.message, true);
      }
    };
    $("#reRun", container).addEventListener("click", run);
    $("#reCopy", container).addEventListener("click", () => copyToClipboard(reOutput.value));
    run();
  }

  // Base64 & URL
  function renderCodec(root) {
    const stateKey = "codec_tool";
    const saved = storage.get(stateKey, { input: "Hello, world!", mode: "b64" });
    const container = document.createElement("div");
    container.appendChild(panel("Text", `
      <textarea id="cdIn" spellcheck="false">${escapeHtml(saved.input)}</textarea>
      <div class="row">
        <select id="cdMode">
          <option value="b64" ${saved.mode === "b64" ? "selected" : ""}>Base64</option>
          <option value="url" ${saved.mode === "url" ? "selected" : ""}>URL</option>
        </select>
        <div class="btns">
          <button id="cdEncode" class="primary">Encode</button>
          <button id="cdDecode">Decode</button>
          <button id="cdSwap" class="ghost">Swap</button>
          <button id="cdCopy">Copy</button>
        </div>
      </div>
    `));
    container.appendChild(panel("Result", `
      <textarea id="cdOut" spellcheck="false"></textarea>
      <div class="stat" id="cdStatus">Ready.</div>
    `));
    root.appendChild(container);

    const cdIn = $("#cdIn", container);
    const cdOut = $("#cdOut", container);
    const cdMode = $("#cdMode", container);
    const setStatus = (m, err) => { const el = $("#cdStatus", container); el.textContent = m; el.style.color = err ? "var(--err)" : "var(--muted)"; };

    const b64encode = (s) => btoa(unescape(encodeURIComponent(s)));
    const b64decode = (s) => decodeURIComponent(escape(atob(s)));

    const encode = () => {
      try {
        cdOut.value = cdMode.value === "b64" ? b64encode(cdIn.value) : encodeURIComponent(cdIn.value);
        setStatus("Encoded ✓");
        storage.set(stateKey, { input: cdIn.value, mode: cdMode.value });
      } catch (e) { setStatus("Error: " + e.message, true); }
    };
    const decode = () => {
      try {
        cdOut.value = cdMode.value === "b64" ? b64decode(cdIn.value) : decodeURIComponent(cdIn.value);
        setStatus("Decoded ✓");
        storage.set(stateKey, { input: cdIn.value, mode: cdMode.value });
      } catch (e) { setStatus("Error: " + e.message, true); }
    };

    $("#cdEncode", container).addEventListener("click", encode);
    $("#cdDecode", container).addEventListener("click", decode);
    $("#cdCopy", container).addEventListener("click", () => copyToClipboard(cdOut.value));
    $("#cdSwap", container).addEventListener("click", () => { const t = cdIn.value; cdIn.value = cdOut.value; cdOut.value = t; });
    encode();
  }

  // UUID
  function renderUuid(root) {
    const stateKey = "uuid_tool";
    const saved = storage.get(stateKey, { count: 5 });
    const container = document.createElement("div");
    container.appendChild(panel("Generate", `
      <div class="row">
        <input id="udCount" type="number" min="1" max="1000" value="${saved.count}">
        <div class="btns"><button id="udGen" class="primary">Generate</button><button id="udCopy">Copy</button></div>
      </div>
    `));
    container.appendChild(panel("Output", `
      <textarea id="udOut" spellcheck="false"></textarea>
      <div class="stat" id="udStatus">Ready.</div>
    `));
    root.appendChild(container);

    const udCount = $("#udCount", container);
    const udOut = $("#udOut", container);
    const setStatus = (m, err) => { const el = $("#udStatus", container); el.textContent = m; el.style.color = err ? "var(--err)" : "var(--muted)"; };

    const genV4 = () => {
      const buf = new Uint8Array(16);
      crypto.getRandomValues(buf);
      buf[6] = (buf[6] & 0x0f) | 0x40; // version 4
      buf[8] = (buf[8] & 0x3f) | 0x80; // variant RFC4122
      const bth = Array.from(buf, b => b.toString(16).padStart(2, "0"));
      return `${bth[0]}${bth[1]}${bth[2]}${bth[3]}-${bth[4]}${bth[5]}-${bth[6]}${bth[7]}-${bth[8]}${bth[9]}-${bth[10]}${bth[11]}${bth[12]}${bth[13]}${bth[14]}${bth[15]}`;
    };
    const run = () => {
      const n = clamp(1, Number(udCount.value) || 1, 1000);
      const list = Array.from({ length: n }, genV4).join("\n");
      udOut.value = list;
      setStatus(`${n} UUID(s)`);
      storage.set(stateKey, { count: n });
    };
    $("#udGen", container).addEventListener("click", run);
    $("#udCopy", container).addEventListener("click", () => copyToClipboard(udOut.value));
    run();
  }

  // Color converter
  function renderColor(root) {
    const stateKey = "color_tool";
    const saved = storage.get(stateKey, { hex: "#4f46e5" });
    const container = document.createElement("div");
    container.appendChild(panel("Color", `
      <div class="row">
        <input id="clHex" value="${saved.hex}" placeholder="#RRGGBB or #RGB">
        <input id="clRgb" placeholder="rgb(r, g, b)">
        <input id="clHsl" placeholder="hsl(h, s%, l%)">
      </div>
      <div class="row">
        <div class="pill"><span id="clSwatch" style="width:14px;height:14px;border-radius:50%;display:inline-block;background:${saved.hex};border:1px solid var(--border)"></span><span id="clName">Preview</span></div>
        <div class="btns"><button id="clCopyHex">Copy HEX</button><button id="clCopyRgb">Copy RGB</button><button id="clCopyHsl">Copy HSL</button></div>
      </div>
    `));
    root.appendChild(container);

    const clHex = $("#clHex", container);
    const clRgb = $("#clRgb", container);
    const clHsl = $("#clHsl", container);
    const clSwatch = $("#clSwatch", container);
    const clName = $("#clName", container);

    const hexToRgb = (hex) => {
      const m = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec(hex.trim());
      if (!m) return null;
      let h = m[1].toLowerCase();
      if (h.length === 3) h = h.split("").map(ch => ch + ch).join("");
      const r = parseInt(h.slice(0,2), 16), g = parseInt(h.slice(2,4), 16), b = parseInt(h.slice(4,6), 16);
      return { r, g, b };
    };
    const rgbToHex = ({ r, g, b }) => `#${[r,g,b].map(n => clamp(0,n,255).toString(16).padStart(2,"0")).join("")}`;
    const rgbToHsl = ({ r, g, b }) => {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r,g,b), min = Math.min(r,g,b);
      let h, s, l = (max + min) / 2;
      if (max === min) { h = s = 0; }
      else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
      }
      return { h: Math.round(h*360), s: Math.round(s*100), l: Math.round(l*100) };
    };
    const hslToRgb = ({ h, s, l }) => {
      h = (h % 360 + 360) % 360; s /= 100; l /= 100;
      const c = (1 - Math.abs(2*l - 1)) * s;
      const x = c * (1 - Math.abs((h/60) % 2 - 1));
      const m = l - c/2;
      let r1=0,g1=0,b1=0;
      if (0 <= h && h < 60) { r1=c; g1=x; }
      else if (60 <= h && h < 120) { r1=x; g1=c; }
      else if (120 <= h && h < 180) { g1=c; b1=x; }
      else if (180 <= h && h < 240) { g1=x; b1=c; }
      else if (240 <= h && h < 300) { r1=x; b1=c; }
      else { r1=c; b1=x; }
      return { r: Math.round((r1+m)*255), g: Math.round((g1+m)*255), b: Math.round((b1+m)*255) };
    };

    function updateFromHex() {
      const rgb = hexToRgb(clHex.value);
      if (!rgb) return;
      const hsl = rgbToHsl(rgb);
      clRgb.value = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
      clHsl.value = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
      clSwatch.style.background = clHex.value;
      clName.textContent = clHex.value.toUpperCase();
      storage.set(stateKey, { hex: clHex.value });
    }
    function updateFromRgb() {
      const m = /rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)/i.exec(clRgb.value);
      if (!m) return;
      const rgb = { r: clamp(0, +m[1], 255), g: clamp(0, +m[2], 255), b: clamp(0, +m[3], 255) };
      const hsl = rgbToHsl(rgb);
      clHex.value = rgbToHex(rgb);
      clHsl.value = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
      clSwatch.style.background = clHex.value;
      clName.textContent = clHex.value.toUpperCase();
      storage.set(stateKey, { hex: clHex.value });
    }
    function updateFromHsl() {
      const m = /hsl\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*\)/i.exec(clHsl.value);
      if (!m) return;
      const hsl = { h: clamp(0, +m[1], 360), s: clamp(0, +m[2], 100), l: clamp(0, +m[3], 100) };
      const rgb = hslToRgb(hsl);
      clRgb.value = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
      clHex.value = rgbToHex(rgb);
      clSwatch.style.background = clHex.value;
      clName.textContent = clHex.value.toUpperCase();
      storage.set(stateKey, { hex: clHex.value });
    }

    clHex.addEventListener("input", updateFromHex);
    clRgb.addEventListener("input", updateFromRgb);
    clHsl.addEventListener("input", updateFromHsl);
    $("#clCopyHex", container).addEventListener("click", () => copyToClipboard(clHex.value));
    $("#clCopyRgb", container).addEventListener("click", () => copyToClipboard(clRgb.value));
    $("#clCopyHsl", container).addEventListener("click", () => copyToClipboard(clHsl.value));
    updateFromHex();
  }

  // Epoch converter
  function renderEpoch(root) {
    const stateKey = "epoch_tool";
    const now = Date.now();
    const saved = storage.get(stateKey, { ms: now });
    const container = document.createElement("div");
    container.appendChild(panel("Epoch Time", `
      <div class="row">
        <input id="epMs" type="number" value="${saved.ms}" placeholder="Milliseconds since 1970-01-01">
        <input id="epSec" type="number" value="${Math.floor(saved.ms/1000)}" placeholder="Seconds since epoch">
      </div>
      <div class="btns">
        <button id="epNow" class="primary">Now</button>
        <button id="epCopy">Copy ISO</button>
      </div>
    `));
    container.appendChild(panel("ISO & Parts", `
      <div class="kv">
        <label>ISO</label><div id="epIso" class="value"></div>
        <label>Local</label><div id="epLocal" class="value"></div>
        <label>UTC</label><div id="epUtc" class="value"></div>
        <label>Offset</label><div id="epTz" class="value"></div>
      </div>
    `));
    root.appendChild(container);

    const epMs = $("#epMs", container);
    const epSec = $("#epSec", container);
    const epIso = $("#epIso", container);
    const epLocal = $("#epLocal", container);
    const epUtc = $("#epUtc", container);
    const epTz = $("#epTz", container);
    const update = (ms) => {
      const d = new Date(ms);
      epIso.textContent = d.toISOString();
      epLocal.textContent = d.toLocaleString();
      epUtc.textContent = d.toUTCString();
      const tz = -d.getTimezoneOffset();
      const sign = tz >= 0 ? "+" : "-";
      const abs = Math.abs(tz);
      epTz.textContent = `${sign}${String(Math.floor(abs/60)).padStart(2,'0')}:${String(abs%60).padStart(2,'0')}`;
      storage.set(stateKey, { ms });
    };
    const syncFromMs = () => { const ms = Number(epMs.value); epSec.value = Math.floor(ms/1000); update(ms); };
    const syncFromSec = () => { const sec = Number(epSec.value); const ms = sec*1000; epMs.value = ms; update(ms); };
    epMs.addEventListener("input", syncFromMs);
    epSec.addEventListener("input", syncFromSec);
    $("#epNow", container).addEventListener("click", () => { const ms = Date.now(); epMs.value = ms; epSec.value = Math.floor(ms/1000); update(ms); });
    $("#epCopy", container).addEventListener("click", () => copyToClipboard(epIso.textContent));
    update(saved.ms);
  }

  // --- Helpers ---
  function escapeHtml(str) {
    return String(str).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }
})();


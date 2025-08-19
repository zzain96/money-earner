// Utility Hub main script

// ----- Theme Toggle -----
(function initializeTheme() {
  const themeToggleButton = document.getElementById('themeToggle');
  const savedTheme = localStorage.getItem('uh-theme') || 'dark';
  document.documentElement.dataset.theme = savedTheme;
  themeToggleButton.textContent = savedTheme === 'dark' ? '🌙' : '☀️';
  themeToggleButton.addEventListener('click', () => {
    const current = document.documentElement.dataset.theme || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('uh-theme', next);
    themeToggleButton.textContent = next === 'dark' ? '🌙' : '☀️';
  });
})();

// Respect light theme if chosen
(function applyThemeColors() {
  const observer = new MutationObserver(() => {
    const theme = document.documentElement.dataset.theme || 'dark';
    if (theme === 'light') {
      document.documentElement.style.setProperty('--bg', '#f5f7ff');
      document.documentElement.style.setProperty('--panel', '#ffffff');
      document.documentElement.style.setProperty('--text', '#11193b');
      document.documentElement.style.setProperty('--muted', '#59648b');
      document.documentElement.style.setProperty('--primary-contrast', '#ffffff');
      document.documentElement.style.setProperty('--border', '#d9def0');
      document.documentElement.style.setProperty('--shadow', '0 8px 30px rgba(0, 0, 0, 0.08)');
    } else {
      document.documentElement.style.removeProperty('--bg');
      document.documentElement.style.removeProperty('--panel');
      document.documentElement.style.removeProperty('--text');
      document.documentElement.style.removeProperty('--muted');
      document.documentElement.style.removeProperty('--primary-contrast');
      document.documentElement.style.removeProperty('--border');
      document.documentElement.style.removeProperty('--shadow');
    }
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme']});
  // initialize once
  document.documentElement.dataset.theme = localStorage.getItem('uh-theme') || 'dark';
})();

// ----- Tabs -----
(function initializeTabs() {
  const tabs = Array.from(document.querySelectorAll('.tab'));
  const panels = Array.from(document.querySelectorAll('.panel'));
  function show(sectionId) {
    tabs.forEach(t => t.classList.toggle('active', t.dataset.section === sectionId));
    panels.forEach(p => p.classList.toggle('active', p.id === sectionId));
    history.replaceState({}, '', `#${sectionId}`);
  }
  tabs.forEach(tab => tab.addEventListener('click', () => show(tab.dataset.section)));
  const hash = (location.hash || '#password').slice(1);
  if (panels.some(p => p.id === hash)) show(hash);
})();

// ----- Password Generator -----
(function initializePasswordGenerator() {
  const lengthInput = document.getElementById('pwLength');
  const lengthValue = document.getElementById('pwLengthValue');
  const optLower = document.getElementById('optLower');
  const optUpper = document.getElementById('optUpper');
  const optNumber = document.getElementById('optNumber');
  const optSymbol = document.getElementById('optSymbol');
  const optNoAmbig = document.getElementById('optNoAmbig');
  const optNoRepeat = document.getElementById('optNoRepeat');
  const output = document.getElementById('pwOutput');
  const btnGenerate = document.getElementById('btnGenerate');
  const btnCopy = document.getElementById('btnCopy');
  const strengthBar = document.getElementById('strengthBar');
  const strengthText = document.getElementById('strengthText');

  const LOWER = 'abcdefghijklmnopqrstuvwxyz';
  const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const NUM = '0123456789';
  const SYM = '!@#$%^&*(){}[]<>/\\`~.,;:-_+|=?';
  const AMBIG = new Set('O0Il1|S5B8Z2');

  function updateLengthLabel() {
    lengthValue.textContent = String(lengthInput.value);
  }
  updateLengthLabel();
  lengthInput.addEventListener('input', updateLengthLabel);

  function buildCharset() {
    let pool = '';
    if (optLower.checked) pool += LOWER;
    if (optUpper.checked) pool += UPPER;
    if (optNumber.checked) pool += NUM;
    if (optSymbol.checked) pool += SYM;
    if (optNoAmbig.checked) {
      pool = Array.from(pool).filter(ch => !AMBIG.has(ch)).join('');
    }
    return Array.from(new Set(pool)).join('');
  }

  function getRandomInt(max) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] % max;
  }

  function generatePassword() {
    const length = Number(lengthInput.value);
    const categories = [];
    if (optLower.checked) categories.push(LOWER);
    if (optUpper.checked) categories.push(UPPER);
    if (optNumber.checked) categories.push(NUM);
    if (optSymbol.checked) categories.push(SYM);
    const charset = buildCharset();
    if (charset.length === 0) return '';

    const ensureChars = categories.map(cat => cat[getRandomInt(cat.length)]);
    const remainingLength = Math.max(0, length - ensureChars.length);
    const result = [];

    while (result.length < remainingLength) {
      const ch = charset[getRandomInt(charset.length)];
      if (optNoRepeat.checked && result.includes(ch)) continue;
      result.push(ch);
    }
    const combined = [...ensureChars, ...result];
    // Shuffle
    for (let i = combined.length - 1; i > 0; i--) {
      const j = getRandomInt(i + 1);
      [combined[i], combined[j]] = [combined[j], combined[i]];
    }
    return combined.join('').slice(0, length);
  }

  function estimateStrength(password) {
    if (!password) return { score: 0, label: 'Empty' };
    let variety = 0;
    if (/[a-z]/.test(password)) variety++;
    if (/[A-Z]/.test(password)) variety++;
    if (/[0-9]/.test(password)) variety++;
    if (/[^A-Za-z0-9]/.test(password)) variety++;
    const uniqueChars = new Set(password).size;
    const lengthScore = Math.min(4, Math.floor(password.length / 8));
    const score = Math.min(10, variety * 2 + lengthScore + Math.floor(uniqueChars / 6));
    const label = score >= 8 ? 'Strong' : score >= 5 ? 'Good' : 'Weak';
    return { score, label };
  }

  function renderStrength(pw) {
    const { score, label } = estimateStrength(pw);
    const pct = Math.max(10, Math.min(100, score * 10));
    strengthBar.style.width = pct + '%';
    strengthText.textContent = `Strength: ${label}`;
  }

  function doGenerate() {
    const pw = generatePassword();
    output.value = pw;
    renderStrength(pw);
  }

  btnGenerate.addEventListener('click', doGenerate);
  [optLower, optUpper, optNumber, optSymbol, optNoAmbig, optNoRepeat].forEach(el => el.addEventListener('change', doGenerate));
  lengthInput.addEventListener('change', doGenerate);

  btnCopy.addEventListener('click', async () => {
    if (!output.value) return;
    await navigator.clipboard.writeText(output.value);
    const original = btnCopy.textContent;
    btnCopy.textContent = 'Copied!';
    setTimeout(() => btnCopy.textContent = original, 900);
  });

  // Initial
  doGenerate();
})();

// ----- Unit Converter -----
(function initializeConverter() {
  const categorySelect = document.getElementById('convCategory');
  const fromSelect = document.getElementById('convFrom');
  const toSelect = document.getElementById('convTo');
  const valueInput = document.getElementById('convValue');
  const resultInput = document.getElementById('convResult');
  const btnSwap = document.getElementById('btnSwap');

  const units = {
    length: {
      meter: 1,
      kilometer: 1000,
      centimeter: 0.01,
      millimeter: 0.001,
      mile: 1609.344,
      yard: 0.9144,
      foot: 0.3048,
      inch: 0.0254
    },
    weight: {
      kilogram: 1,
      gram: 0.001,
      milligram: 0.000001,
      pound: 0.45359237,
      ounce: 0.0283495231
    },
    volume: {
      liter: 1,
      milliliter: 0.001,
      gallon: 3.785411784,
      quart: 0.946352946,
      pint: 0.473176473,
      cup: 0.24
    },
    temperature: {
      celsius: 'c', fahrenheit: 'f', kelvin: 'k'
    }
  };

  function titleCase(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function populateUnits() {
    const category = categorySelect.value;
    fromSelect.innerHTML = '';
    toSelect.innerHTML = '';
    const map = units[category];
    Object.keys(map).forEach(k => {
      const o1 = document.createElement('option'); o1.value = k; o1.textContent = titleCase(k);
      const o2 = document.createElement('option'); o2.value = k; o2.textContent = titleCase(k);
      fromSelect.appendChild(o1); toSelect.appendChild(o2);
    });
    fromSelect.selectedIndex = 0;
    toSelect.selectedIndex = Math.min(1, toSelect.options.length - 1);
    convert();
  }

  function convert() {
    const category = categorySelect.value;
    const from = fromSelect.value;
    const to = toSelect.value;
    const value = Number(valueInput.value);
    if (!Number.isFinite(value)) { resultInput.value = ''; return; }

    if (category === 'temperature') {
      const v = convertTemperature(value, from, to);
      resultInput.value = String(v);
      return;
    }

    const baseFrom = units[category][from];
    const baseTo = units[category][to];
    const inBase = value * baseFrom;
    const result = inBase / baseTo;
    resultInput.value = String(roundNice(result));
  }

  function convertTemperature(value, from, to) {
    let celsius;
    if (from === 'celsius') celsius = value;
    else if (from === 'fahrenheit') celsius = (value - 32) * 5 / 9;
    else celsius = value - 273.15; // kelvin
    let out;
    if (to === 'celsius') out = celsius;
    else if (to === 'fahrenheit') out = celsius * 9 / 5 + 32;
    else out = celsius + 273.15;
    return roundNice(out);
  }

  function roundNice(n) {
    if (Math.abs(n) < 1e-6) return 0;
    return Number.parseFloat(n.toPrecision(8));
  }

  categorySelect.addEventListener('change', populateUnits);
  fromSelect.addEventListener('change', convert);
  toSelect.addEventListener('change', convert);
  valueInput.addEventListener('input', convert);
  document.getElementById('btnSwap').addEventListener('click', () => {
    const i = fromSelect.selectedIndex;
    fromSelect.selectedIndex = toSelect.selectedIndex;
    toSelect.selectedIndex = i;
    convert();
  });

  populateUnits();
})();

// ----- Markdown Preview -----
(function initializeMarkdown() {
  const input = document.getElementById('mdInput');
  const preview = document.getElementById('mdPreview');
  function render() {
    try {
      const raw = input.value || '';
      const html = window.marked ? window.marked.parse(raw, { breaks: true }) : raw;
      preview.innerHTML = html;
    } catch (e) {
      preview.textContent = String(e);
    }
  }
  input.addEventListener('input', render);
  render();
})();

// ----- Pomodoro Timer -----
(function initializePomodoro() {
  const workInput = document.getElementById('workMinutes');
  const shortBreakInput = document.getElementById('shortBreak');
  const longBreakInput = document.getElementById('longBreak');
  const intervalsInput = document.getElementById('intervals');
  const timerEl = document.getElementById('timer');
  const labelEl = document.getElementById('timerLabel');
  const btnStart = document.getElementById('btnStart');
  const btnPause = document.getElementById('btnPause');
  const btnReset = document.getElementById('btnReset');

  let timerId = null;
  let mode = 'work'; // 'work' | 'short' | 'long'
  let remaining = 0; // seconds
  let completedWorkSessions = 0;

  function secondsForMode(m) {
    const mToS = (min) => Math.max(1, Math.floor(Number(min) || 0) * 60);
    if (m === 'work') return mToS(workInput.value);
    if (m === 'short') return mToS(shortBreakInput.value);
    return mToS(longBreakInput.value);
  }

  function updateDisplay() {
    const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
    const seconds = String(remaining % 60).padStart(2, '0');
    timerEl.textContent = `${minutes}:${seconds}`;
    const labelMap = { work: 'Work', short: 'Short Break', long: 'Long Break' };
    labelEl.textContent = labelMap[mode];
    document.title = `${minutes}:${seconds} • ${labelMap[mode]} — Utility Hub`;
  }

  function start(modeToStart) {
    if (timerId) clearInterval(timerId);
    if (modeToStart) mode = modeToStart;
    remaining = secondsForMode(mode);
    updateDisplay();
    timerId = setInterval(tick, 1000);
  }

  function tick() {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(timerId); timerId = null;
      if (mode === 'work') {
        completedWorkSessions += 1;
        const untilLong = Math.max(1, Math.floor(Number(intervalsInput.value) || 4));
        mode = (completedWorkSessions % untilLong === 0) ? 'long' : 'short';
      } else {
        mode = 'work';
      }
      notify();
      start();
      return;
    }
    updateDisplay();
  }

  function pause() {
    if (!timerId) return;
    clearInterval(timerId); timerId = null;
  }

  function reset() {
    pause();
    remaining = secondsForMode(mode);
    updateDisplay();
  }

  function notify() {
    if (Notification && Notification.permission === 'granted') {
      new Notification('Utility Hub', { body: `${labelEl.textContent} done!` });
    } else if (Notification && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
    try { new AudioContext(); } catch (_) {}
  }

  btnStart.addEventListener('click', () => start());
  btnPause.addEventListener('click', pause);
  btnReset.addEventListener('click', reset);

  // initialize
  remaining = secondsForMode(mode);
  updateDisplay();
})();

// ----- QR Code Generator -----
(function initializeQrCode() {
  const textInput = document.getElementById('qrText');
  const sizeInput = document.getElementById('qrSize');
  const output = document.getElementById('qrOutput');
  const btnGen = document.getElementById('btnQrGenerate');
  const btnDownload = document.getElementById('btnQrDownload');
  let qrInstance = null;

  function generate() {
    output.innerHTML = '';
    const size = Math.max(64, Math.min(512, Math.floor(Number(sizeInput.value) || 256)));
    const text = String(textInput.value || '').trim();
    if (!text) { output.textContent = 'Enter text to generate a QR code'; return; }
    const container = document.createElement('div');
    output.appendChild(container);
    if (window.QRCode) {
      qrInstance = new QRCode(container, { text, width: size, height: size, correctLevel: QRCode.CorrectLevel.M });
    } else {
      container.textContent = 'QR library failed to load.';
    }
  }

  function download() {
    if (!output.firstChild) return;
    const img = output.querySelector('img');
    const canvas = output.querySelector('canvas');
    if (!img && !canvas) return;
    let dataUrl = '';
    if (canvas) {
      dataUrl = canvas.toDataURL('image/png');
    } else {
      // Convert image to canvas then download
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      dataUrl = c.toDataURL('image/png');
    }
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'qrcode.png';
    a.click();
  }

  btnGen.addEventListener('click', generate);
  btnDownload.addEventListener('click', download);
})();


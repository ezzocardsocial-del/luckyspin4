// ==========================================
// PICKER WHEEL - COMPLETE LOGIC & ENGINE
// ==========================================

const COLOR_PALETTE = [
  "#f44336", "#e91e63", "#9c27b0", "#673ab7",
  "#3f51b5", "#2196f3", "#03a9f4", "#00bcd4",
  "#009688", "#4caf50", "#8bc34a", "#cddc39",
  "#ffeb3b", "#ffc107", "#ff9800", "#ff5722"
];

// App State
const state = {
  choices: [
    { id: 1, text: "Burger 🍔", enabled: true, color: COLOR_PALETTE[0], wins: 0 },
    { id: 2, text: "Pizza 🍕", enabled: true, color: COLOR_PALETTE[1], wins: 0 },
    { id: 3, text: "Biryani 🍚", enabled: true, color: COLOR_PALETTE[2], wins: 0 },
    { id: 4, text: "Pasta 🍝", enabled: true, color: COLOR_PALETTE[3], wins: 0 },
    { id: 5, text: "Shawarma 🌯", enabled: true, color: COLOR_PALETTE[4], wins: 0 },
    { id: 6, text: "Salad 🥗", enabled: true, color: COLOR_PALETTE[5], wins: 0 }
  ],
  currentMode: "normal", // 'normal' | 'elimination' | 'accumulation'
  history: [],
  settings: {
    duration: 5, // seconds
    soundTick: true,
    soundFanfare: true,
    confetti: true,
    theme: "light"
  },
  isSpinning: false,
  rotationAngle: 0, // current radians
  currentWinner: null
};

// DOM Elements
const canvas = document.getElementById("wheelCanvas");
const ctx = canvas.getContext("2d");
const spinBtn = document.getElementById("spinBtn");
const pointerNeedle = document.getElementById("pointerNeedle");
const choicesListEl = document.getElementById("choicesList");
const bulkTextarea = document.getElementById("bulkTextarea");
const choiceInput = document.getElementById("choiceInput");
const choiceCountBadge = document.getElementById("choiceCountBadge");
const historyListEl = document.getElementById("historyList");
const currentModeBadge = document.getElementById("currentModeBadge");

// Winner Modal Elements
const winnerModal = document.getElementById("winnerModal");
const winnerNameEl = document.getElementById("winnerName");
const removeWinnerBtn = document.getElementById("removeWinnerBtn");

// Settings Modal Elements
const settingsModal = document.getElementById("settingsModal");
const durationInput = document.getElementById("durationInput");
const durationVal = document.getElementById("durationVal");
const soundTickToggle = document.getElementById("soundTickToggle");
const soundFanfareToggle = document.getElementById("soundFanfareToggle");
const confettiToggle = document.getElementById("confettiToggle");

// Confetti Canvas
const confettiCanvas = document.getElementById("confettiCanvas");
const confettiCtx = confettiCanvas.getContext("2d");
let confettiParticles = [];
let confettiAnimationId = null;

// ==========================================
// AUDIO SYNTHESIZER (Web Audio API)
// ==========================================
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

// Tick Sound (Click as slice passes)
function playTickSound() {
  if (!state.settings.soundTick) return;
  try {
    const actx = getAudioContext();
    if (!actx) return;
    const osc = actx.createOscillator();
    const gain = actx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(450, actx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, actx.currentTime + 0.04);

    gain.gain.setValueAtTime(0.25, actx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.04);

    osc.connect(gain);
    gain.connect(actx.destination);

    osc.start();
    osc.stop(actx.currentTime + 0.04);
  } catch (e) {
    console.warn("Audio play error", e);
  }
}

// Celebration Fanfare Sound
function playCelebrationFanfare() {
  if (!state.settings.soundFanfare) return;
  try {
    const actx = getAudioContext();
    if (!actx) return;

    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99]; // C4, E4, G4, C5, E5, G5
    notes.forEach((freq, idx) => {
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      const startTime = actx.currentTime + idx * 0.09;
      const duration = 0.35;

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(actx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    });
  } catch (e) {
    console.warn("Fanfare error", e);
  }
}

// ==========================================
// CANVAS & WHEEL RENDERING
// ==========================================
function getActiveChoices() {
  return state.choices.filter(c => c.enabled);
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  drawWheel();
}

function drawWheel() {
  const rect = canvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(centerX, centerY) - 8;

  ctx.clearRect(0, 0, width, height);

  const active = getActiveChoices();

  // If no choices available
  if (active.length === 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fillStyle = "#e2e8f0";
    ctx.fill();
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = "#64748b";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Please add at least 1 choice!", centerX, centerY);
    ctx.restore();
    return;
  }

  const arcSize = (2 * Math.PI) / active.length;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(state.rotationAngle);

  // Draw Slices
  active.forEach((choice, index) => {
    const startAngle = index * arcSize;
    const endAngle = startAngle + arcSize;

    // Slice background
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, startAngle, endAngle);
    ctx.closePath();

    ctx.fillStyle = choice.color || COLOR_PALETTE[index % COLOR_PALETTE.length];
    ctx.fill();

    // Slice border
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    // Text Label inside Slice
    ctx.save();
    const textAngle = startAngle + arcSize / 2;
    ctx.rotate(textAngle);
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";

    // Dynamic Font Size based on choices count
    let fontSize = 16;
    if (active.length > 20) fontSize = 11;
    else if (active.length > 12) fontSize = 13;
    else if (active.length > 8) fontSize = 14;

    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
    ctx.shadowBlur = 3;

    // Truncate long text
    let label = choice.text;
    if (state.currentMode === "accumulation" && choice.wins > 0) {
      label += ` (${choice.wins})`;
    }
    const maxTextWidth = radius - 70;
    if (ctx.measureText(label).width > maxTextWidth) {
      while (ctx.measureText(label + "...").width > maxTextWidth && label.length > 1) {
        label = label.slice(0, -1);
      }
      label += "...";
    }

    ctx.fillText(label, radius - 24, 0);
    ctx.restore();
  });

  // Outer Rim Ring
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, 2 * Math.PI);
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
  ctx.stroke();

  ctx.restore();
}

// ==========================================
// SPIN ENGINE & PHYSICS ANIMATION
// ==========================================
let lastTickIndex = -1;

function spinWheel() {
  if (state.isSpinning) return;
  const active = getActiveChoices();
  if (active.length < 1) {
    alert("Please add at least 1 active choice to spin!");
    return;
  }

  getAudioContext(); // Initialize audio context on user gesture
  state.isSpinning = true;
  spinBtn.disabled = true;

  const duration = state.settings.duration * 1000;
  const startTime = performance.now();
  const startAngle = state.rotationAngle % (2 * Math.PI);

  // Minimum full rotations (between 6 and 10 full turns for dramatic tension)
  const fullRotations = (Math.floor(Math.random() * 4) + 6) * (2 * Math.PI);
  // Random extra stop offset
  const randomStop = Math.random() * 2 * Math.PI;
  const totalRotation = fullRotations + randomStop;

  const arcSize = (2 * Math.PI) / active.length;

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function frame(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = easeOutCubic(progress);

    state.rotationAngle = startAngle + totalRotation * ease;
    drawWheel();

    // Check pointer tick (The pointer needle is at 3 o'clock => Angle 0)
    // Slices are rotated by state.rotationAngle.
    // The slice currently at angle 0 is calculated:
    const normalizedAngle = (2 * Math.PI - (state.rotationAngle % (2 * Math.PI))) % (2 * Math.PI);
    const currentSliceIndex = Math.floor(normalizedAngle / arcSize) % active.length;

    if (currentSliceIndex !== lastTickIndex) {
      lastTickIndex = currentSliceIndex;
      playTickSound();
      pointerNeedle.classList.add("tick");
      setTimeout(() => pointerNeedle.classList.remove("tick"), 70);
    }

    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      // Finished spinning
      state.isSpinning = false;
      spinBtn.disabled = false;
      const winner = active[currentSliceIndex];
      handleSpinResult(winner);
    }
  }

  requestAnimationFrame(frame);
}

// ==========================================
// WINNER HANDLING & CONFETTI
// ==========================================
function handleSpinResult(winner) {
  state.currentWinner = winner;

  // Update wins count for Accumulation Mode
  if (state.currentMode === "accumulation") {
    winner.wins = (winner.wins || 0) + 1;
    drawWheel();
  }

  // Record History
  const record = {
    winner: winner.text,
    time: new Date().toLocaleTimeString(),
    mode: state.currentMode
  };
  state.history.unshift(record);
  renderHistory();

  // Play Celebration Fanfare
  playCelebrationFanfare();

  // Trigger Confetti
  if (state.settings.confetti) {
    launchConfetti();
  }

  // Display Winner Modal
  winnerNameEl.textContent = winner.text;
  if (state.currentMode === "elimination") {
    removeWinnerBtn.style.display = "inline-block";
  } else {
    removeWinnerBtn.style.display = "none";
  }
  winnerModal.classList.add("active");
  saveToLocalStorage();
}

function closeWinnerModal() {
  winnerModal.classList.remove("active");
  stopConfetti();
}

function removeCurrentWinner() {
  if (!state.currentWinner) return;
  const index = state.choices.findIndex(c => c.id === state.currentWinner.id);
  if (index !== -1) {
    state.choices.splice(index, 1);
    renderChoices();
    drawWheel();
    saveToLocalStorage();
  }
  closeWinnerModal();
}

// Confetti Particle System
function launchConfetti() {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
  confettiParticles = [];

  const count = 120;
  for (let i = 0; i < count; i++) {
    confettiParticles.push({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      vx: (Math.random() - 0.5) * 16,
      vy: (Math.random() - 0.7) * 18,
      size: Math.random() * 8 + 6,
      color: COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)],
      rotation: Math.random() * 360,
      rSpeed: (Math.random() - 0.5) * 10,
      gravity: 0.35,
      alpha: 1
    });
  }

  if (confettiAnimationId) cancelAnimationFrame(confettiAnimationId);
  animateConfetti();
}

function animateConfetti() {
  confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  let hasLiving = false;

  confettiParticles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += p.gravity;
    p.rotation += p.rSpeed;
    p.alpha -= 0.005;

    if (p.alpha > 0) {
      hasLiving = true;
      confettiCtx.save();
      confettiCtx.globalAlpha = Math.max(0, p.alpha);
      confettiCtx.translate(p.x, p.y);
      confettiCtx.rotate((p.rotation * Math.PI) / 180);
      confettiCtx.fillStyle = p.color;
      confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.4);
      confettiCtx.restore();
    }
  });

  if (hasLiving) {
    confettiAnimationId = requestAnimationFrame(animateConfetti);
  } else {
    stopConfetti();
  }
}

function stopConfetti() {
  if (confettiAnimationId) cancelAnimationFrame(confettiAnimationId);
  confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
}

// ==========================================
// INPUTS & CHOICES MANAGEMENT
// ==========================================
function renderChoices() {
  choicesListEl.innerHTML = "";
  const activeCount = state.choices.filter(c => c.enabled).length;
  choiceCountBadge.textContent = `${activeCount} / ${state.choices.length}`;

  state.choices.forEach((choice, index) => {
    const row = document.createElement("div");
    row.className = `choice-item-row ${choice.enabled ? "" : "disabled"}`;

    const left = document.createElement("div");
    left.className = "choice-main-left";

    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.checked = choice.enabled;
    chk.title = "Enable or disable this choice from the wheel";
    chk.addEventListener("change", () => {
      choice.enabled = chk.checked;
      renderChoices();
      drawWheel();
      saveToLocalStorage();
    });

    const dot = document.createElement("div");
    dot.className = "color-dot";
    dot.style.backgroundColor = choice.color || COLOR_PALETTE[index % COLOR_PALETTE.length];

    const label = document.createElement("span");
    label.className = "choice-name-text";
    label.textContent = choice.text;
    label.title = "Click to edit";
    label.addEventListener("click", () => {
      const newText = prompt("Edit choice:", choice.text);
      if (newText && newText.trim()) {
        choice.text = newText.trim();
        renderChoices();
        drawWheel();
        saveToLocalStorage();
      }
    });

    left.appendChild(chk);
    left.appendChild(dot);
    left.appendChild(label);

    const actions = document.createElement("div");
    actions.className = "choice-row-actions";

    const delBtn = document.createElement("button");
    delBtn.className = "btn-row-action delete";
    delBtn.innerHTML = "🗑️";
    delBtn.title = "Delete Choice";
    delBtn.addEventListener("click", () => {
      state.choices.splice(index, 1);
      renderChoices();
      drawWheel();
      saveToLocalStorage();
    });

    actions.appendChild(delBtn);
    row.appendChild(left);
    row.appendChild(actions);
    choicesListEl.appendChild(row);
  });

  // Sync Bulk Textarea
  bulkTextarea.value = state.choices.map(c => c.text).join("\n");
}

function addChoice(text) {
  if (!text || !text.trim()) return;
  const newId = Date.now() + Math.floor(Math.random() * 100);
  const color = COLOR_PALETTE[state.choices.length % COLOR_PALETTE.length];
  state.choices.push({
    id: newId,
    text: text.trim(),
    enabled: true,
    color: color,
    wins: 0
  });
  renderChoices();
  drawWheel();
  saveToLocalStorage();
}

function handleAddChoiceSubmit(e) {
  e.preventDefault();
  const val = choiceInput.value;
  if (val.trim()) {
    addChoice(val);
    choiceInput.value = "";
    choiceInput.focus();
  }
}

function applyBulkText() {
  const lines = bulkTextarea.value
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length === 0) {
    alert("Please enter at least one choice in the text area.");
    return;
  }

  state.choices = lines.map((line, idx) => ({
    id: Date.now() + idx,
    text: line,
    enabled: true,
    color: COLOR_PALETTE[idx % COLOR_PALETTE.length],
    wins: 0
  }));

  renderChoices();
  drawWheel();
  saveToLocalStorage();
  alert("Choices updated successfully!");
}

function shuffleChoices() {
  for (let i = state.choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.choices[i], state.choices[j]] = [state.choices[j], state.choices[i]];
  }
  renderChoices();
  drawWheel();
  saveToLocalStorage();
}

function sortChoices() {
  state.choices.sort((a, b) => a.text.localeCompare(b.text));
  renderChoices();
  drawWheel();
  saveToLocalStorage();
}

function clearAllChoices() {
  if (confirm("Are you sure you want to clear all choices?")) {
    state.choices = [];
    renderChoices();
    drawWheel();
    saveToLocalStorage();
  }
}

// ==========================================
// RESULTS & HISTORY
// ==========================================
function renderHistory() {
  historyListEl.innerHTML = "";
  if (state.history.length === 0) {
    historyListEl.innerHTML = '<div class="no-history-state">No spins recorded yet. Spin the wheel to see winners here!</div>';
    return;
  }

  state.history.forEach(item => {
    const row = document.createElement("div");
    row.className = "history-entry";
    row.innerHTML = `
      <span class="history-winner-label">🎯 ${item.winner}</span>
      <span class="history-time-stamp">${item.time}</span>
    `;
    historyListEl.appendChild(row);
  });
}

function clearHistory() {
  if (confirm("Clear spin history?")) {
    state.history = [];
    renderHistory();
    saveToLocalStorage();
  }
}

// ==========================================
// MODES MANAGEMENT
// ==========================================
function setMode(mode) {
  state.currentMode = mode;
  document.querySelectorAll(".mode-card").forEach(card => {
    card.classList.toggle("selected", card.dataset.mode === mode);
    const radio = card.querySelector("input");
    if (radio) radio.checked = card.dataset.mode === mode;
  });

  const modeNames = {
    normal: "Normal Mode",
    elimination: "Elimination Mode",
    accumulation: "Accumulation Mode"
  };
  currentModeBadge.textContent = modeNames[mode] || "Normal Mode";
  drawWheel();
  saveToLocalStorage();
}

// ==========================================
// THEME & SETTINGS
// ==========================================
function applyTheme(theme) {
  state.settings.theme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  const themeBtn = document.getElementById("themeToggleBtn");
  if (themeBtn) {
    themeBtn.innerHTML = theme === "dark" ? "☀️ Light" : "🌙 Dark";
  }
  drawWheel();
  saveToLocalStorage();
}

function toggleTheme() {
  applyTheme(state.settings.theme === "dark" ? "light" : "dark");
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      alert(`Error enabling fullscreen: ${err.message}`);
    });
    document.body.classList.add("is-fullscreen");
  } else {
    document.exitFullscreen();
    document.body.classList.remove("is-fullscreen");
  }
}

document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) {
    document.body.classList.remove("is-fullscreen");
  }
  setTimeout(resizeCanvas, 150);
});

// Settings Modal Controls
function openSettingsModal() {
  durationInput.value = state.settings.duration;
  durationVal.textContent = `${state.settings.duration}s`;
  soundTickToggle.checked = state.settings.soundTick;
  soundFanfareToggle.checked = state.settings.soundFanfare;
  confettiToggle.checked = state.settings.confetti;
  settingsModal.classList.add("active");
}

function closeSettingsModal() {
  settingsModal.classList.remove("active");
}

function saveSettingsFromModal() {
  state.settings.duration = parseInt(durationInput.value, 10) || 5;
  state.settings.soundTick = soundTickToggle.checked;
  state.settings.soundFanfare = soundFanfareToggle.checked;
  state.settings.confetti = confettiToggle.checked;
  closeSettingsModal();
  saveToLocalStorage();
}

// ==========================================
// LOCAL STORAGE PERSISTENCE
// ==========================================
function saveToLocalStorage() {
  try {
    const data = {
      choices: state.choices,
      history: state.history.slice(0, 50),
      settings: state.settings,
      mode: state.currentMode
    };
    localStorage.setItem("picker_wheel_data", JSON.stringify(data));
  } catch (e) {
    console.warn("Storage save error", e);
  }
}

function loadFromLocalStorage() {
  try {
    const saved = localStorage.getItem("picker_wheel_data");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed.choices) && parsed.choices.length > 0) {
        state.choices = parsed.choices;
      }
      if (Array.isArray(parsed.history)) {
        state.history = parsed.history;
      }
      if (parsed.settings) {
        state.settings = { ...state.settings, ...parsed.settings };
      }
      if (parsed.mode) {
        state.currentMode = parsed.mode;
      }
    }
  } catch (e) {
    console.warn("Storage load error", e);
  }
}

// ==========================================
// INITIALIZATION & EVENT LISTENERS
// ==========================================
window.addEventListener("DOMContentLoaded", () => {
  loadFromLocalStorage();

  // Apply Theme
  applyTheme(state.settings.theme || "light");

  // Render UI
  renderChoices();
  renderHistory();
  setMode(state.currentMode || "normal");
  resizeCanvas();

  // Listeners
  window.addEventListener("resize", () => {
    resizeCanvas();
    if (confettiCanvas) {
      confettiCanvas.width = window.innerWidth;
      confettiCanvas.height = window.innerHeight;
    }
  });

  spinBtn.addEventListener("click", spinWheel);

  document.getElementById("addChoiceForm").addEventListener("submit", handleAddChoiceSubmit);
  document.getElementById("applyBulkBtn").addEventListener("click", applyBulkText);
  document.getElementById("shuffleBtn").addEventListener("click", shuffleChoices);
  document.getElementById("sortBtn").addEventListener("click", sortChoices);
  document.getElementById("clearAllBtn").addEventListener("click", clearAllChoices);
  document.getElementById("clearHistoryBtn").addEventListener("click", clearHistory);

  // View Mode toggle (List vs Bulk Text Mode)
  const listModeBtn = document.getElementById("listModeBtn");
  const textModeBtn = document.getElementById("textModeBtn");
  const listModeSection = document.getElementById("listModeSection");
  const textModeSection = document.getElementById("textModeSection");

  listModeBtn.addEventListener("click", () => {
    listModeBtn.classList.add("active");
    textModeBtn.classList.remove("active");
    listModeSection.style.display = "block";
    textModeSection.style.display = "none";
  });

  textModeBtn.addEventListener("click", () => {
    textModeBtn.classList.add("active");
    listModeBtn.classList.remove("active");
    textModeSection.style.display = "block";
    listModeSection.style.display = "none";
    bulkTextarea.value = state.choices.map(c => c.text).join("\n");
  });

  // Sidebar Tabs
  document.querySelectorAll(".tab-link").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab-link").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
      tab.classList.add("active");
      const target = document.getElementById(tab.dataset.tab);
      if (target) target.classList.add("active");
    });
  });

  // Mode Selection Cards
  document.querySelectorAll(".mode-card").forEach(card => {
    card.addEventListener("click", () => {
      setMode(card.dataset.mode);
    });
  });

  // Header and action buttons
  document.getElementById("themeToggleBtn").addEventListener("click", toggleTheme);
  document.getElementById("fullscreenBtn").addEventListener("click", toggleFullscreen);
  document.getElementById("settingsBtn").addEventListener("click", openSettingsModal);
  document.getElementById("closeSettingsBtn").addEventListener("click", closeSettingsModal);
  document.getElementById("saveSettingsBtn").addEventListener("click", saveSettingsFromModal);
  document.getElementById("closeWinnerBtn").addEventListener("click", closeWinnerModal);
  removeWinnerBtn.addEventListener("click", removeCurrentWinner);

  durationInput.addEventListener("input", (e) => {
    durationVal.textContent = `${e.target.value}s`;
  });

  // FAQ Accordion Toggle
  document.querySelectorAll(".faq-title").forEach(title => {
    title.addEventListener("click", () => {
      const desc = title.nextElementSibling;
      if (desc.style.display === "none") {
        desc.style.display = "block";
      } else {
        desc.style.display = "none";
      }
    });
  });
});

(() => {
  "use strict";

  const STORAGE_KEY = "diario-estudos-v1";
  const THEME_KEY = "diario-estudos-theme";
  const FIELD_COLORS = ["#7A6A9E", "#3F7D6B", "#C4772E", "#9C4A3C", "#4F6D8C", "#6E7B4B", "#A85C7C", "#557A5A"];
  const RING_CIRCUMFERENCE = 2 * Math.PI * 88;

  /* ---------- state ---------- */
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { fields: [], sessions: [] };
      const parsed = JSON.parse(raw);
      return {
        fields: Array.isArray(parsed.fields) ? parsed.fields : [],
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      };
    } catch {
      return { fields: [], sessions: [] };
    }
  }

  let state = loadState();

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable — state stays in memory for this session */
    }
  }

  function uid() {
    return (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  }

  function fieldById(id) {
    return state.fields.find((f) => f.id === id);
  }

  /* ---------- theme ---------- */
  const root = document.documentElement;
  const themeToggle = document.getElementById("themeToggle");
  const themeToggleLabel = document.getElementById("themeToggleLabel");
  const THEME_CYCLE = ["system", "light", "dark"];
  const THEME_LABELS = { system: "Sistema", light: "Claro", dark: "Escuro" };

  function applyTheme(mode) {
    if (mode === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", mode);
    themeToggleLabel.textContent = THEME_LABELS[mode];
  }

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY) || "system";
    applyTheme(saved);
  }

  themeToggle.addEventListener("click", () => {
    const current = localStorage.getItem(THEME_KEY) || "system";
    const next = THEME_CYCLE[(THEME_CYCLE.indexOf(current) + 1) % THEME_CYCLE.length];
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  });

  initTheme();

  /* ---------- date/time helpers ---------- */
  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function nowHHMM() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  function formatMinutes(mins) {
    mins = Math.round(mins);
    if (mins < 60) return `${mins}min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}min` : `${h}h`;
  }

  function addMinutesToTime(hhmm, minutesToAdd) {
    const [h, m] = hhmm.split(":").map(Number);
    const total = h * 60 + m + minutesToAdd;
    const wrapped = ((total % 1440) + 1440) % 1440;
    return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
  }

  function formatDateLabel(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const today = todayISO();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yISO = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
    if (iso === today) return "Hoje";
    if (iso === yISO) return "Ontem";
    return date.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  }

  document.getElementById("todayLabel").textContent = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  /* ---------- fields: render + form ---------- */
  const fieldList = document.getElementById("fieldList");
  const timerFieldSelect = document.getElementById("timerField");
  const logFieldSelect = document.getElementById("logField");
  const fieldForm = document.getElementById("fieldForm");
  const fieldNameInput = document.getElementById("fieldNameInput");

  function colorForIndex(i) {
    return FIELD_COLORS[i % FIELD_COLORS.length];
  }

  function renderFields() {
    fieldList.innerHTML = "";

    if (state.fields.length === 0) {
      const note = document.createElement("p");
      note.className = "empty-note";
      note.textContent = "Nenhum campo cadastrado ainda. Adicione o primeiro abaixo.";
      fieldList.appendChild(note);
    } else {
      state.fields.forEach((field) => {
        const count = state.sessions.filter((s) => s.fieldId === field.id).length;
        const li = document.createElement("li");
        li.className = "field-chip";
        li.innerHTML = `
          <span class="field-dot" style="background:${field.color}"></span>
          <span>${escapeHTML(field.name)}</span>
          <span class="field-count">${count}</span>
          <button type="button" class="field-delete" aria-label="Remover campo ${escapeHTML(field.name)}" data-id="${field.id}">×</button>
        `;
        fieldList.appendChild(li);
      });
    }

    // populate selects
    const options = state.fields
      .map((f) => `<option value="${f.id}">${escapeHTML(f.name)}</option>`)
      .join("");
    const placeholder = state.fields.length === 0 ? '<option value="">Cadastre um campo primeiro</option>' : "";
    timerFieldSelect.innerHTML = placeholder + options;
    logFieldSelect.innerHTML = placeholder + options;
    timerFieldSelect.disabled = state.fields.length === 0;
    logFieldSelect.disabled = state.fields.length === 0;
  }

  function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  fieldForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = fieldNameInput.value.trim();
    if (!name) return;
    const field = { id: uid(), name, color: colorForIndex(state.fields.length), createdAt: Date.now() };
    state.fields.push(field);
    saveState();
    fieldNameInput.value = "";
    renderFields();
    renderHistoryFilters();
    renderHistory();
    renderStats();
  });

  fieldList.addEventListener("click", (e) => {
    const btn = e.target.closest(".field-delete");
    if (!btn) return;
    const id = btn.dataset.id;
    const field = fieldById(id);
    if (!field) return;
    const used = state.sessions.some((s) => s.fieldId === id);
    if (used && !confirm(`Remover "${field.name}"? As sessões registradas para este campo também serão apagadas.`)) return;
    state.fields = state.fields.filter((f) => f.id !== id);
    state.sessions = state.sessions.filter((s) => s.fieldId !== id);
    saveState();
    renderFields();
    renderHistoryFilters();
    renderHistory();
    renderStats();
  });

  /* ---------- log form ---------- */
  const logForm = document.getElementById("logForm");
  const logDate = document.getElementById("logDate");
  const logStart = document.getElementById("logStart");
  const logDuration = document.getElementById("logDuration");
  const logNotes = document.getElementById("logNotes");
  const logEndPreview = document.getElementById("logEndPreview");

  function resetLogDefaults() {
    logDate.value = todayISO();
    logStart.value = nowHHMM();
    logDuration.value = "";
    logNotes.value = "";
    updateEndPreview();
  }

  function updateEndPreview() {
    const start = logStart.value;
    const dur = Number(logDuration.value);
    if (start && dur > 0) {
      logEndPreview.textContent = `até ${addMinutesToTime(start, dur)}`;
    } else {
      logEndPreview.textContent = "";
    }
  }
  logStart.addEventListener("input", updateEndPreview);
  logDuration.addEventListener("input", updateEndPreview);

  logForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!logFieldSelect.value) return;
    const session = {
      id: uid(),
      fieldId: logFieldSelect.value,
      date: logDate.value,
      start: logStart.value,
      durationMin: Number(logDuration.value),
      notes: logNotes.value.trim(),
      createdAt: Date.now(),
    };
    state.sessions.push(session);
    saveState();
    resetLogDefaults();
    renderFields();
    renderHistoryFilters();
    renderHistory();
    renderStats();
  });

  /* ---------- history ---------- */
  const historyList = document.getElementById("historyList");
  const historyFilters = document.getElementById("historyFilters");
  let activeFilter = "all";

  function renderHistoryFilters() {
    historyFilters.innerHTML = "";
    const allChip = document.createElement("button");
    allChip.type = "button";
    allChip.className = "chip" + (activeFilter === "all" ? " is-active" : "");
    allChip.textContent = "Todos";
    allChip.dataset.filter = "all";
    historyFilters.appendChild(allChip);

    state.fields.forEach((f) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip" + (activeFilter === f.id ? " is-active" : "");
      chip.textContent = f.name;
      chip.dataset.filter = f.id;
      historyFilters.appendChild(chip);
    });
  }

  historyFilters.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    activeFilter = chip.dataset.filter;
    renderHistoryFilters();
    renderHistory();
  });

  function renderHistory() {
    historyList.innerHTML = "";
    const sessions = state.sessions
      .filter((s) => activeFilter === "all" || s.fieldId === activeFilter)
      .slice()
      .sort((a, b) => (a.date + a.start < b.date + b.start ? 1 : -1));

    if (sessions.length === 0) {
      const note = document.createElement("p");
      note.className = "empty-note";
      note.textContent = state.fields.length === 0
        ? "Cadastre um campo de estudo e registre sua primeira sessão para começar seu histórico."
        : "Nenhuma sessão registrada ainda.";
      historyList.appendChild(note);
      return;
    }

    const groups = new Map();
    sessions.forEach((s) => {
      if (!groups.has(s.date)) groups.set(s.date, []);
      groups.get(s.date).push(s);
    });

    groups.forEach((entries, date) => {
      const dayEl = document.createElement("div");
      dayEl.className = "history-day";

      const label = document.createElement("div");
      label.className = "history-day-label";
      const dayTotal = entries.reduce((sum, s) => sum + s.durationMin, 0);
      label.textContent = `${formatDateLabel(date)} · ${formatMinutes(dayTotal)}`;
      dayEl.appendChild(label);

      entries.forEach((s) => {
        const field = fieldById(s.fieldId);
        const row = document.createElement("div");
        row.className = "history-entry";
        row.innerHTML = `
          <span class="history-entry-time">${s.start}–${addMinutesToTime(s.start, s.durationMin)}</span>
          <div class="history-entry-main">
            <span class="history-entry-field">
              <span class="field-dot" style="background:${field ? field.color : "var(--ink-faint)"}"></span>
              ${escapeHTML(field ? field.name : "Campo removido")} · ${formatMinutes(s.durationMin)}
            </span>
            ${s.notes ? `<p class="history-entry-notes">${escapeHTML(s.notes)}</p>` : ""}
          </div>
          <button type="button" class="history-entry-delete" aria-label="Remover sessão" data-id="${s.id}">×</button>
        `;
        dayEl.appendChild(row);
      });

      historyList.appendChild(dayEl);
    });
  }

  historyList.addEventListener("click", (e) => {
    const btn = e.target.closest(".history-entry-delete");
    if (!btn) return;
    state.sessions = state.sessions.filter((s) => s.id !== btn.dataset.id);
    saveState();
    renderFields();
    renderHistory();
    renderStats();
  });

  /* ---------- stats ---------- */
  function renderStats() {
    const today = todayISO();
    const todayMin = state.sessions.filter((s) => s.date === today).reduce((sum, s) => sum + s.durationMin, 0);
    document.getElementById("statToday").textContent = formatMinutes(todayMin);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 6);
    const weekMin = state.sessions
      .filter((s) => new Date(s.date + "T00:00:00") >= new Date(cutoff.toDateString()))
      .reduce((sum, s) => sum + s.durationMin, 0);
    document.getElementById("statWeek").textContent = formatMinutes(weekMin);

    const daysWithSessions = new Set(state.sessions.map((s) => s.date));
    let streak = 0;
    const cursor = new Date();
    for (;;) {
      const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      if (daysWithSessions.has(iso)) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else break;
    }
    document.getElementById("statStreak").textContent = `${streak} dia${streak === 1 ? "" : "s"}`;

    const totalsByField = new Map();
    state.sessions
      .filter((s) => new Date(s.date + "T00:00:00") >= new Date(cutoff.toDateString()))
      .forEach((s) => totalsByField.set(s.fieldId, (totalsByField.get(s.fieldId) || 0) + s.durationMin));
    let topField = "—";
    let topMin = 0;
    totalsByField.forEach((min, id) => {
      if (min > topMin) {
        topMin = min;
        const f = fieldById(id);
        topField = f ? f.name : "—";
      }
    });
    document.getElementById("statTopField").textContent = topField;
  }

  /* ---------- focus timer ---------- */
  const ringProgress = document.getElementById("ringProgress");
  const timerClock = document.getElementById("timerClock");
  const timerSub = document.getElementById("timerSub");
  const timerStartBtn = document.getElementById("timerStart");
  const timerResetBtn = document.getElementById("timerReset");
  const presetChips = document.getElementById("presetChips");
  const timerSaveBox = document.getElementById("timerSaveBox");
  const timerSaveBtn = document.getElementById("timerSaveBtn");

  ringProgress.style.strokeDasharray = String(RING_CIRCUMFERENCE);
  ringProgress.style.strokeDashoffset = String(RING_CIRCUMFERENCE);

  let targetMin = 25;
  let running = false;
  let elapsedMs = 0;
  let startedAt = null;
  let intervalId = null;
  let sessionStartClock = null;

  function setPreset(min) {
    targetMin = min;
    [...presetChips.children].forEach((chip) => {
      chip.classList.toggle("is-active", Number(chip.dataset.min) === min);
    });
    if (!running) renderTimerFace();
  }

  presetChips.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    setPreset(Number(chip.dataset.min));
  });
  setPreset(25);

  function renderTimerFace() {
    const totalSec = Math.floor(elapsedMs / 1000);
    const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
    const ss = String(totalSec % 60).padStart(2, "0");
    timerClock.textContent = `${mm}:${ss}`;

    if (targetMin > 0) {
      const progress = Math.min(1, elapsedMs / (targetMin * 60000));
      ringProgress.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - progress));
      ringProgress.style.stroke = progress >= 1 ? "var(--accent)" : "var(--accent-2)";
    } else {
      ringProgress.style.strokeDashoffset = "0";
      ringProgress.style.stroke = "var(--accent-2)";
    }

    const field = fieldById(timerFieldSelect.value);
    if (running) {
      timerSub.textContent = field ? field.name : "estudando";
    } else if (elapsedMs > 0) {
      timerSub.textContent = "pausado";
    } else {
      timerSub.textContent = field ? "pronto para começar" : "selecione um campo";
    }
  }

  function tick() {
    elapsedMs = Date.now() - startedAt;
    renderTimerFace();
    if (targetMin > 0 && elapsedMs >= targetMin * 60000) {
      stopTimer();
    }
  }

  function startTimer() {
    if (!timerFieldSelect.value) {
      timerFieldSelect.focus();
      return;
    }
    running = true;
    startedAt = Date.now() - elapsedMs;
    if (elapsedMs === 0) sessionStartClock = nowHHMM();
    intervalId = setInterval(tick, 250);
    timerStartBtn.textContent = "Pausar";
    timerStartBtn.classList.add("is-active");
    ringProgress.classList.add("is-running");
    timerSaveBox.hidden = true;
    renderTimerFace();
  }

  function stopTimer() {
    running = false;
    clearInterval(intervalId);
    timerStartBtn.textContent = "Retomar";
    timerStartBtn.classList.remove("is-active");
    ringProgress.classList.remove("is-running");
    renderTimerFace();
    if (elapsedMs >= 30000) timerSaveBox.hidden = false;
  }

  timerStartBtn.addEventListener("click", () => {
    if (running) stopTimer();
    else startTimer();
  });

  timerResetBtn.addEventListener("click", () => {
    running = false;
    clearInterval(intervalId);
    elapsedMs = 0;
    sessionStartClock = null;
    timerStartBtn.textContent = "Iniciar foco";
    timerStartBtn.classList.remove("is-active");
    ringProgress.classList.remove("is-running");
    timerSaveBox.hidden = true;
    renderTimerFace();
  });

  timerFieldSelect.addEventListener("change", renderTimerFace);

  timerSaveBtn.addEventListener("click", () => {
    logFieldSelect.value = timerFieldSelect.value;
    logDate.value = todayISO();
    logStart.value = sessionStartClock || nowHHMM();
    logDuration.value = String(Math.max(1, Math.round(elapsedMs / 60000)));
    updateEndPreview();
    logNotes.focus();
    document.getElementById("logForm").scrollIntoView({ behavior: "smooth", block: "center" });

    elapsedMs = 0;
    sessionStartClock = null;
    timerStartBtn.textContent = "Iniciar foco";
    timerSaveBox.hidden = true;
    renderTimerFace();
  });

  /* ---------- init ---------- */
  resetLogDefaults();
  renderFields();
  renderHistoryFilters();
  renderHistory();
  renderStats();
  renderTimerFace();
})();

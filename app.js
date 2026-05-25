const STORAGE_KEY = "simpleSymptomTracker.v1";
const APP_VERSION = "0.3.0";
const APP_BUILD = "20260525.003";
const APP_BUILD_DATE = "2026-05-25 14:24 -07:00";

const PHYSICAL_OPTIONS = [
  "Fatigue",
  "Poor sleep",
  "Pain",
  "Illness",
  "Digestive upset",
  "Headache",
  "Temperature sensitivity",
  "Exercise strain"
];

const STRESS_GROUPS = {
  "Life stressors": ["Work stress", "Travel", "Conflict", "Grief", "Caregiving", "Schedule disruption"],
  "Psychological symptoms": ["Anxiety", "Panic", "Depression", "Irritability", "Overwhelm"],
  "Physiological stress markers": ["Poor sleep", "Fatigue", "Pain", "Illness", "Brain fog"],
  "Environmental factors": ["Heat", "Cold", "Sun exposure", "Pressure on skin", "New product", "Food change"]
};

const DEFAULT_COLORS = {
  light: {
    "--bg": "#005fba",
    "--surface": "#ffffff",
    "--text": "#172126",
    "--primary": "#005fba",
    "--accent": "#ffe700",
    "--border": "#ccd4d9"
  },
  dark: {
    "--bg": "#00386e",
    "--surface": "#17232a",
    "--text": "#eef4f6",
    "--primary": "#66b5ff",
    "--accent": "#ffe65c",
    "--border": "#3a4a53"
  }
};

let state = loadState();
let currentPage = "setup";
let currentEntryId = null;
let saveTimer = null;
let recognition = null;
let recognizing = false;

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  seedDefaults();
  renderChecklists();
  bindEvents();
  applyTheme();
  hydrateSettings();

  setTimeout(() => {
    $("splash").classList.add("is-hidden");
    $("app").classList.remove("is-hidden");
  }, 850);

  if (state.profile.completed) {
    showPage("record");
    prepareTodayEntry();
  } else {
    hydrateSetup();
    showPage("setup");
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
});

function seedDefaults() {
  state.profile ||= {};
  state.profile.medications ||= [];
  state.profile.physical ||= { checks: [], notes: "" };
  state.profile.mentalNotes ||= "";
  state.profile.stress ||= [];
  state.profile.ab ||= {
    enabled: false,
    mode: "manual",
    current: "A",
    labelA: "A",
    labelB: "B",
    daysPerPhase: 7,
    phaseStartedAt: todayISO()
  };
  state.records ||= {};
  state.conditionHistory ||= [];
  state.settings ||= {
    theme: "light",
    activeCustomProfile: "",
    customProfiles: {}
  };
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function bindEvents() {
  $("settings-button").addEventListener("click", () => showPage("settings"));
  $("setup-help").addEventListener("click", () => openHelp("setup"));
  $("record-help").addEventListener("click", () => openHelp("record"));
  $("about-button").addEventListener("click", openAbout);
  $("modal-close").addEventListener("click", closeModal);
  $("modal-backdrop").addEventListener("click", (event) => {
    if (event.target.id === "modal-backdrop") closeModal();
  });
  $("setup-form").addEventListener("submit", saveSetup);
  $("add-setup-medication").addEventListener("click", () => addMedicationRow("setup-medications"));
  $("add-conditions-medication").addEventListener("click", () => addMedicationRow("conditions-medications"));
  $("conditions-link").addEventListener("click", () => {
    hydrateConditions();
    showPage("conditions");
  });
  $("conditions-cancel").addEventListener("click", () => showPage("record"));
  $("conditions-form").addEventListener("submit", saveConditions);
  $("type-mode").addEventListener("click", () => setInputMode("type"));
  $("speech-mode").addEventListener("click", () => setInputMode("speech"));
  $("speech-toggle").addEventListener("click", toggleSpeech);
  $("entry-text").addEventListener("input", scheduleEntrySave);
  $("entry-condition-change").addEventListener("input", scheduleEntrySave);
  $("save-entry").addEventListener("click", () => saveEntry(true));
  $("new-entry").addEventListener("click", newEntry);
  $("theme-dark-toggle").addEventListener("change", toggleTheme);
  $("save-profile").addEventListener("click", saveColorProfile);
  $("delete-profile").addEventListener("click", deleteColorProfile);
  $("profile-select").addEventListener("change", loadColorProfile);
  $("export-csv").addEventListener("click", exportCsv);
  $("reset-records").addEventListener("click", resetRecords);
  $("reset-all").addEventListener("click", resetAll);
  $("return-recording").addEventListener("click", () => {
    if (state.profile.completed) showPage("record");
  });
  $("setup-ab-enabled").addEventListener("change", updateSetupAbVisibility);
}

function openHelp(topic) {
  const help = {
    setup: {
      title: "First Launch Help",
      body: `
        <p>This page sets up the background information the tracker can save with future entries.</p>
        <h3>User name and start date</h3>
        <p>Your name helps identify the file later. The start date marks when this tracking period began.</p>
        <h3>Medication regimen</h3>
        <p>Add medications only if useful. Amount is the dose or strength, form/route is how it is taken, schedule is when or how often it is taken, and status shows whether it is active, paused, or stopped.</p>
        <h3>Physical condition</h3>
        <p>Use the checklist for common body-state notes, and use the text box for anything that does not fit neatly into a checkbox.</p>
        <h3>Mental condition</h3>
        <p>Use your own words. This is intentionally free text so you do not have to force your experience into a preset label.</p>
        <h3>Stress and context factors</h3>
        <p>These grouped checklists capture things that may affect symptoms, such as travel, poor sleep, anxiety, illness, heat, or routine changes.</p>
        <h3>A/B tracking</h3>
        <p>Turn this on if you want entries labeled by phase A or B. You can also enable or change this later in Settings.</p>
      `
    },
    record: {
      title: "Recording Help",
      body: `
        <p>This page is for quickly recording what is happening in your own words.</p>
        <h3>Type or Speech</h3>
        <p>Type is always available. Speech may appear if the device and browser support it. If speech is not available, the text box still works.</p>
        <h3>Symptom entry</h3>
        <p>Write what you notice, how it feels, when it changed, or anything else that seems relevant. There are no symptom scales here so the app does not suggest answers.</p>
        <h3>Saving</h3>
        <p>The app auto-saves shortly after you type. Save Entry forces an immediate save and overwrites the current entry. New Entry clears the boxes so you can make another timestamped entry for the same day.</p>
        <h3>Condition changes</h3>
        <p>Use the smaller box only when something changed, such as medication, sleep, travel, stress, or overall condition. Anything entered there is saved with the symptom entry and added to condition history.</p>
        <h3>Conditions button</h3>
        <p>Use this when you want to update the ongoing baseline profile used for future entries.</p>
      `
    }
  };
  openModal(help[topic].title, help[topic].body);
}

function openAbout() {
  openModal("About SST", `
    <p><strong>Simple Symptom Tracker</strong></p>
    <p>Version ${APP_VERSION}<br />Build ${APP_BUILD}<br />Build date ${APP_BUILD_DATE}</p>
    <p>SST is an offline-first personal symptom tracker for spontaneous chronic hives / urticaria. It stores data locally on this device unless you export it.</p>
    <p>This app was developed with Codex with Simon's direction and guidance.</p>
    <p class="helper">This tool is for personal tracking and is not medical advice.</p>
  `);
}

function openModal(title, body) {
  $("modal-title").textContent = title;
  $("modal-body").innerHTML = body;
  $("modal-backdrop").classList.remove("is-hidden");
  $("modal-close").focus();
}

function closeModal() {
  $("modal-backdrop").classList.add("is-hidden");
}
function showPage(page) {
  currentPage = page;
  ["setup", "record", "conditions", "settings"].forEach((name) => {
    $(`${name}-page`).classList.toggle("is-hidden", name !== page);
  });

  const titles = {
    setup: ["Setup", "Simple Symptom Tracker"],
    record: ["Recording", "Simple Symptom Tracker"],
    conditions: ["Conditions", "Simple Symptom Tracker"],
    settings: ["Settings", "Simple Symptom Tracker"]
  };
  $("page-kicker").textContent = titles[page][0];
  $("page-title").textContent = titles[page][1];
  $("settings-button").classList.toggle("is-hidden", page === "settings" || page === "setup");

  if (page === "record") {
    prepareTodayEntry();
    renderAbCounter();
  }
  if (page === "settings") {
    hydrateSettings();
  }
}

function renderChecklists() {
  renderPhysicalChecklist("setup-physical-checklist", []);
  renderPhysicalChecklist("conditions-physical-checklist", []);
  renderStressChecklist("setup-stress-checklist", []);
  renderStressChecklist("conditions-stress-checklist", []);
}

function renderPhysicalChecklist(containerId, selected) {
  $(containerId).innerHTML = PHYSICAL_OPTIONS.map((option) => checkMarkup(option, selected)).join("");
}

function renderStressChecklist(containerId, selected) {
  $(containerId).innerHTML = Object.entries(STRESS_GROUPS)
    .map(([group, options]) => `
      <div class="check-group">
        <h3>${escapeHtml(group)}</h3>
        <div class="check-grid">${options.map((option) => checkMarkup(option, selected)).join("")}</div>
      </div>
    `)
    .join("");
}

function checkMarkup(option, selected) {
  const checked = selected.includes(option) ? "checked" : "";
  return `<label class="check-item"><input type="checkbox" value="${escapeHtml(option)}" ${checked} /> <span>${escapeHtml(option)}</span></label>`;
}

function addMedicationRow(containerId, med = {}) {
  const row = document.createElement("div");
  row.className = "medication-row";
  row.innerHTML = `
    <label><span>Name</span><input data-med="name" value="${escapeAttr(med.name || "")}" /></label>
    <label><span>Amount</span><input data-med="dose" placeholder="Dose or strength" value="${escapeAttr(med.dose || "")}" /></label>
    <label><span>Form / route</span><select data-med="formRoute">
      ${["pill", "injection", "liquid", "topical", "inhaled", "other"].map((form) => `<option value="${form}" ${form === (med.formRoute || med.form || "pill") ? "selected" : ""}>${form}</option>`).join("")}
    </select></label>
    <label><span>Schedule</span><input data-med="frequency" placeholder="e.g. daily, weekly, as needed" value="${escapeAttr(med.frequency || "")}" /></label>
    <label><span>Start date</span><input data-med="startDate" type="date" value="${escapeAttr(med.startDate || "")}" /></label>
    <label><span>Status</span><select data-med="status">
      ${["active", "paused", "stopped"].map((status) => `<option value="${status}" ${status === (med.status || "active") ? "selected" : ""}>${status}</option>`).join("")}
    </select></label>
    <button class="secondary remove-med" type="button">Remove</button>
  `;
  row.querySelector(".remove-med").addEventListener("click", () => row.remove());
  $(containerId).appendChild(row);
}

function readMedications(containerId) {
  return [...$(containerId).querySelectorAll(".medication-row")].map((row) => {
    const med = {};
    row.querySelectorAll("[data-med]").forEach((input) => {
      med[input.dataset.med] = input.value.trim();
    });
    return med;
  }).filter((med) => Object.values(med).some(Boolean));
}

function selectedChecks(containerId) {
  return [...$(containerId).querySelectorAll("input:checked")].map((input) => input.value);
}

function hydrateSetup() {
  $("setup-name").value = state.profile.name || "";
  $("setup-start-date").value = state.profile.startDate || todayISO();
  $("setup-physical-notes").value = state.profile.physical.notes || "";
  $("setup-mental-notes").value = state.profile.mentalNotes || "";
  renderPhysicalChecklist("setup-physical-checklist", state.profile.physical.checks || []);
  renderStressChecklist("setup-stress-checklist", state.profile.stress || []);
  $("setup-medications").innerHTML = "";
  (state.profile.medications.length ? state.profile.medications : [{}]).forEach((med) => addMedicationRow("setup-medications", med));
  hydrateAbFields("setup");
  updateSetupAbVisibility();
}

function hydrateAbFields(prefix) {
  const ab = state.profile.ab;
  $(`${prefix}-ab-enabled`).checked = ab.enabled;
  $(`${prefix}-ab-label-a`).value = ab.labelA || "A";
  $(`${prefix}-ab-label-b`).value = ab.labelB || "B";
  $(`${prefix}-ab-mode`).value = ab.mode || "manual";
  $(`${prefix}-ab-current`).value = ab.current || "A";
  $(`${prefix}-ab-days`).value = ab.daysPerPhase || 7;
}

function updateSetupAbVisibility() {
  $("setup-ab-options").classList.toggle("is-muted", !$("setup-ab-enabled").checked);
}

function readAbFields(prefix) {
  return {
    enabled: $(`${prefix}-ab-enabled`).checked,
    labelA: $(`${prefix}-ab-label-a`).value.trim() || "A",
    labelB: $(`${prefix}-ab-label-b`).value.trim() || "B",
    mode: $(`${prefix}-ab-mode`).value,
    current: $(`${prefix}-ab-current`).value,
    daysPerPhase: Math.max(1, Number($(`${prefix}-ab-days`).value) || 7),
    phaseStartedAt: state.profile.ab.phaseStartedAt || todayISO()
  };
}

function saveSetup(event) {
  event.preventDefault();
  state.profile = {
    ...state.profile,
    completed: true,
    name: $("setup-name").value.trim(),
    startDate: $("setup-start-date").value || todayISO(),
    medications: readMedications("setup-medications"),
    physical: {
      checks: selectedChecks("setup-physical-checklist"),
      notes: $("setup-physical-notes").value.trim()
    },
    mentalNotes: $("setup-mental-notes").value.trim(),
    stress: selectedChecks("setup-stress-checklist"),
    ab: readAbFields("setup")
  };
  state.profile.ab.phaseStartedAt = todayISO();
  addConditionHistory("Initial setup");
  saveState();
  showPage("record");
}

function hydrateConditions() {
  $("conditions-medications").innerHTML = "";
  (state.profile.medications.length ? state.profile.medications : [{}]).forEach((med) => addMedicationRow("conditions-medications", med));
  $("conditions-physical-notes").value = state.profile.physical.notes || "";
  $("conditions-mental-notes").value = state.profile.mentalNotes || "";
  renderPhysicalChecklist("conditions-physical-checklist", state.profile.physical.checks || []);
  renderStressChecklist("conditions-stress-checklist", state.profile.stress || []);
}

function saveConditions(event) {
  event.preventDefault();
  state.profile.medications = readMedications("conditions-medications");
  state.profile.physical = {
    checks: selectedChecks("conditions-physical-checklist"),
    notes: $("conditions-physical-notes").value.trim()
  };
  state.profile.mentalNotes = $("conditions-mental-notes").value.trim();
  state.profile.stress = selectedChecks("conditions-stress-checklist");
  addConditionHistory("Conditions page update");
  saveState();
  $("conditions-status").textContent = "Saved. These conditions are now the baseline for future entries.";
}

function addConditionHistory(reason, note = "") {
  state.conditionHistory.push({
    id: createId(),
    reason,
    note,
    savedAt: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    profileSnapshot: snapshotProfile()
  });
}

function snapshotProfile() {
  return JSON.parse(JSON.stringify({
    medications: state.profile.medications || [],
    physical: state.profile.physical || {},
    mentalNotes: state.profile.mentalNotes || "",
    stress: state.profile.stress || [],
    ab: state.profile.ab || {}
  }));
}

function prepareTodayEntry() {
  const date = todayISO();
  state.records[date] ||= { date, entries: [] };
  const today = state.records[date];
  const entry = today.entries.find((item) => item.id === currentEntryId);
  $("entry-text").value = entry?.text || "";
  $("entry-condition-change").value = entry?.conditionChange || "";
  $("today-summary").textContent = `${formatDate(date)} - ${today.entries.length} entr${today.entries.length === 1 ? "y" : "ies"} today`;
  updateSaveStatus(entry?.savedAt || "");
}

function createEntry() {
  const now = new Date();
  return {
    id: createId(),
    date: todayISO(now),
    time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    timestamp: now.toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    text: "",
    conditionChange: "",
    abPhase: activePhaseLabel(),
    profileSnapshot: snapshotProfile(),
    savedAt: ""
  };
}

function scheduleEntrySave() {
  clearTimeout(saveTimer);
  $("save-status").textContent = "Saving...";
  saveTimer = setTimeout(() => saveEntry(false), 700);
}

function saveEntry(manual) {
  const date = todayISO();
  const text = $("entry-text").value.trim();
  const conditionChange = $("entry-condition-change").value.trim();
  if (!text && !conditionChange) {
    $("save-status").textContent = manual ? "Nothing to save yet" : "Not saved yet";
    return;
  }
  state.records[date] ||= { date, entries: [] };
  let entry = state.records[date].entries.find((item) => item.id === currentEntryId);
  if (!entry) {
    entry = createEntry();
    currentEntryId = entry.id;
    state.records[date].entries.push(entry);
  }
  entry.text = text;
  entry.conditionChange = conditionChange;
  entry.savedAt = new Date().toISOString();
  entry.abPhase = activePhaseLabel();
  entry.profileSnapshot = snapshotProfile();
  if (conditionChange && entry.lastConditionHistoryNote !== conditionChange) {
    addConditionHistory("Recorded with symptom entry", conditionChange);
    entry.lastConditionHistoryNote = conditionChange;
  }
  saveState();
  updateSaveStatus(entry.savedAt, manual);
  $("today-summary").textContent = `${formatDate(date)} - ${state.records[date].entries.length} entries today`;
}

function newEntry() {
  currentEntryId = null;
  $("entry-text").value = "";
  $("entry-condition-change").value = "";
  updateSaveStatus("");
  $("entry-text").focus();
}

function updateSaveStatus(savedAt, manual = false) {
  $("save-status").textContent = savedAt
    ? `${manual ? "Saved" : "Auto-saved"} at ${new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    : "Not saved yet";
}

function setInputMode(mode) {
  $("type-mode").classList.toggle("is-selected", mode === "type");
  $("speech-mode").classList.toggle("is-selected", mode === "speech");
  $("speech-panel").classList.toggle("is-hidden", mode !== "speech");
  if (mode === "speech") setupSpeech();
}

function setupSpeech() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    $("speech-toggle").disabled = true;
    $("speech-status").textContent = "Speech recognition is not available here. Manual entry will continue to work.";
    return;
  }
  if (recognition) return;
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.onresult = (event) => {
    let transcript = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      transcript += event.results[i][0].transcript;
    }
    $("entry-text").value = `${$("entry-text").value} ${transcript}`.trim();
    scheduleEntrySave();
  };
  recognition.onend = () => {
    recognizing = false;
    $("speech-toggle").textContent = "Start Listening";
    $("speech-status").textContent = "Listening stopped.";
  };
}

function toggleSpeech() {
  if (!recognition) return;
  if (recognizing) {
    recognition.stop();
    return;
  }
  try {
    recognition.start();
    recognizing = true;
    $("speech-toggle").textContent = "Stop Listening";
    $("speech-status").textContent = "Listening...";
  } catch {
    $("speech-status").textContent = "Speech recognition could not start. Manual entry is available.";
  }
}

function activePhaseLabel() {
  const ab = state.profile.ab;
  if (!ab?.enabled) return "";
  return ab.current === "A" ? ab.labelA : ab.labelB;
}

function renderAbCounter() {
  const ab = state.profile.ab;
  const counter = $("ab-counter");
  if (!ab?.enabled) {
    counter.classList.add("is-hidden");
    return;
  }
  const label = activePhaseLabel();
  if (ab.mode === "timed") {
    const elapsed = daysBetween(ab.phaseStartedAt, todayISO()) + 1;
    const remaining = Math.max(0, ab.daysPerPhase - elapsed);
    counter.textContent = `${label} phase - ${remaining} day${remaining === 1 ? "" : "s"} remaining`;
  } else {
    counter.textContent = `${label} phase - manual switching`;
  }
  counter.classList.remove("is-hidden");
}

function hydrateSettings() {
  $("theme-dark-toggle").checked = state.settings.theme === "dark";
  document.querySelectorAll("[data-color-var]").forEach((input) => {
    input.value = getComputedStyle(document.documentElement).getPropertyValue(input.dataset.colorVar).trim();
  });
  renderProfileOptions();
  renderAbSettings();
}

function toggleTheme() {
  state.settings.theme = $("theme-dark-toggle").checked ? "dark" : "light";
  state.settings.activeCustomProfile = "";
  saveState();
  applyTheme();
  hydrateSettings();
}

function applyTheme() {
  document.documentElement.dataset.theme = state.settings.theme || "light";
  const custom = state.settings.activeCustomProfile
    ? state.settings.customProfiles[state.settings.activeCustomProfile]
    : null;
  Object.entries(custom || {}).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value);
  });
  if (!custom) {
    Object.keys(DEFAULT_COLORS.light).forEach((key) => document.documentElement.style.removeProperty(key));
  }
}

function saveColorProfile() {
  const name = $("profile-name").value.trim();
  if (!name) return;
  const colors = {};
  document.querySelectorAll("[data-color-var]").forEach((input) => {
    colors[input.dataset.colorVar] = input.value;
  });
  state.settings.customProfiles[name] = colors;
  state.settings.activeCustomProfile = name;
  saveState();
  applyTheme();
  renderProfileOptions();
}

function deleteColorProfile() {
  const name = $("profile-select").value;
  if (!name) return;
  delete state.settings.customProfiles[name];
  if (state.settings.activeCustomProfile === name) state.settings.activeCustomProfile = "";
  saveState();
  applyTheme();
  hydrateSettings();
}

function loadColorProfile() {
  const name = $("profile-select").value;
  if (!name) return;
  state.settings.activeCustomProfile = name;
  $("profile-name").value = name;
  saveState();
  applyTheme();
  hydrateSettings();
}

function renderProfileOptions() {
  const select = $("profile-select");
  select.innerHTML = `<option value="">Choose saved profile</option>`;
  Object.keys(state.settings.customProfiles).forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    option.selected = name === state.settings.activeCustomProfile;
    select.appendChild(option);
  });
}

function renderAbSettings() {
  const panel = $("settings-ab-panel");
  const ab = state.profile.ab || {};
  panel.innerHTML = `
    <label class="toggle-row">
      <input id="settings-ab-enabled" type="checkbox" ${ab.enabled ? "checked" : ""} />
      <span>Enable A/B tracking</span>
    </label>
    <div class="field-row">
      <label>
        <span>Phase A label</span>
        <input id="settings-ab-label-a" value="${escapeAttr(ab.labelA || "A")}" />
      </label>
      <label>
        <span>Phase B label</span>
        <input id="settings-ab-label-b" value="${escapeAttr(ab.labelB || "B")}" />
      </label>
    </div>
    <label>
      <span>Phase mode</span>
      <select id="settings-ab-mode">
        <option value="manual" ${ab.mode === "manual" ? "selected" : ""}>Manual switching</option>
        <option value="timed" ${ab.mode === "timed" ? "selected" : ""}>Timed phases</option>
      </select>
    </label>
    <div class="field-row">
      <label>
        <span>Current phase</span>
        <select id="settings-ab-current">
          <option value="A" ${ab.current === "A" ? "selected" : ""}>A</option>
          <option value="B" ${ab.current === "B" ? "selected" : ""}>B</option>
        </select>
      </label>
      <label>
        <span>Days per phase</span>
        <input id="settings-ab-days" type="number" min="1" step="1" value="${ab.daysPerPhase || 7}" />
      </label>
    </div>
    <div class="button-row">
      <button class="secondary" id="settings-switch-phase" type="button">Switch Phase</button>
      <button class="primary" id="settings-save-ab" type="button">Save A/B Settings</button>
    </div>
  `;
  $("settings-switch-phase").disabled = !ab.enabled;
  $("settings-switch-phase").addEventListener("click", () => {
    state.profile.ab.current = state.profile.ab.current === "A" ? "B" : "A";
    state.profile.ab.phaseStartedAt = todayISO();
    addConditionHistory("A/B phase switched");
    saveState();
    renderAbSettings();
    renderAbCounter();
    $("settings-ab-status").textContent = "A/B phase switched.";
  });
  $("settings-save-ab").addEventListener("click", saveSettingsAb);
}

function saveSettingsAb() {
  const previous = state.profile.ab || {};
  const nextCurrent = $("settings-ab-current").value;
  const currentChanged = previous.current !== nextCurrent;
  state.profile.ab = {
    enabled: $("settings-ab-enabled").checked,
    labelA: $("settings-ab-label-a").value.trim() || "A",
    labelB: $("settings-ab-label-b").value.trim() || "B",
    mode: $("settings-ab-mode").value,
    current: nextCurrent,
    daysPerPhase: Math.max(1, Number($("settings-ab-days").value) || 7),
    phaseStartedAt: currentChanged ? todayISO() : previous.phaseStartedAt || todayISO()
  };
  addConditionHistory("A/B settings updated");
  saveState();
  renderAbSettings();
  renderAbCounter();
  $("settings-ab-status").textContent = state.profile.ab.enabled ? "A/B tracking settings saved." : "A/B tracking disabled.";
}

function exportCsv() {
  const rows = [[
    "date",
    "time",
    "timestamp",
    "timezone",
    "ab_phase",
    "symptom_entry",
    "condition_change",
    "medications",
    "physical_checks",
    "physical_notes",
    "mental_notes",
    "stress_context"
  ]];
  Object.values(state.records).forEach((day) => {
    day.entries.forEach((entry) => {
      const profile = entry.profileSnapshot || {};
      rows.push([
        entry.date,
        entry.time,
        entry.timestamp,
        entry.timezone,
        entry.abPhase,
        entry.text,
        entry.conditionChange,
        JSON.stringify(profile.medications || []),
        (profile.physical?.checks || []).join("; "),
        profile.physical?.notes || "",
        profile.mentalNotes || "",
        (profile.stress || []).join("; ")
      ]);
    });
  });
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `symptom-tracker-${todayISO()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function resetRecords() {
  if (!confirm("Reset all recorded symptom entries and condition history?")) return;
  state.records = {};
  state.conditionHistory = [];
  currentEntryId = null;
  saveState();
  if (currentPage === "record") prepareTodayEntry();
}

function resetAll() {
  if (!confirm("Reset all app data, including setup and settings?")) return;
  localStorage.removeItem(STORAGE_KEY);
  state = loadState();
  seedDefaults();
  currentEntryId = null;
  applyTheme();
  hydrateSetup();
  showPage("setup");
}

function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayISO(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function formatDate(value) {
  return new Date(`${value}T12:00:00`).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

function daysBetween(start, end) {
  const a = new Date(`${start}T00:00:00`);
  const b = new Date(`${end}T00:00:00`);
  return Math.floor((b - a) / 86400000);
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value);
}








const STORAGE_KEY = "simpleSymptomTracker.v2";
const APP_VERSION = "0.4.0";
const APP_BUILD = "20260602.004";
const APP_BUILD_DATE = "2026-06-02 05:21 -07:00";

let state = loadState();
let wizard = {};
let currentPage = "";
let activeEntryId = "";
let saveTimer = null;
let recognition = null;
let speechTargetId = "";
let abUnit = "days";
let settingsAbUnit = "days";

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  seedState();
  bindEvents();
  applyTheme();
  syncThemeToggles();
  updateSliderOutputs();

  document.addEventListener("pointerdown", hideSplash, { once: true });
  document.addEventListener("keydown", hideSplash, { once: true });
  setTimeout(hideSplash, 10000);

  if (state.settings.completed && currentProfile()) {
    showPage("record");
  } else {
    showPage("setup-choice");
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
});

function seedState() {
  state.settings ||= {
    completed: false,
    theme: "light",
    ab: { enabled: false, duration: 14, unit: "days", startedAt: todayISO() },
    activeProfileId: "",
    colorProfiles: {},
    activeColorProfile: ""
  };
  state.profiles ||= [];
  state.records ||= [];
}

function bindEvents() {
  $("setup-yes").addEventListener("click", () => { wizard = { wantsSetup: true }; showPage("ab-choice"); });
  $("setup-no").addEventListener("click", () => { wizard = { wantsSetup: false, ab: { enabled: false }, condition: null }; showPage("name"); });
  $("ab-yes").addEventListener("click", () => { wizard.ab = { enabled: true, duration: 14, unit: "days", startedAt: todayISO() }; showPage("ab-config"); });
  $("ab-no").addEventListener("click", () => { wizard.ab = { enabled: false, duration: 14, unit: "days", startedAt: todayISO() }; showPage("condition-choice"); });
  $("ab-days").addEventListener("click", () => setAbUnit("days"));
  $("ab-months").addEventListener("click", () => setAbUnit("months"));
  $("ab-config-next").addEventListener("click", saveWizardAb);
  $("condition-yes").addEventListener("click", () => showPage("condition-entry"));
  $("condition-no").addEventListener("click", () => { wizard.condition = null; showPage("name"); });
  $("condition-entry-next").addEventListener("click", saveWizardCondition);
  $("save-profile-start").addEventListener("click", saveWizardProfile);
  $("settings-button").addEventListener("click", () => showPage("settings"));
  $("settings-close").addEventListener("click", () => showPage("record"));
  $("switch-profile").addEventListener("click", () => showPage("settings"));
  $("switch-user-settings").addEventListener("click", switchProfileFromSettings);
  $("add-user").addEventListener("click", () => {
    wizard = { wantsSetup: false, ab: state.settings.ab, condition: null };
    $("first-name").value = "";
    $("last-name").value = "";
    showPage("name");
  });
  $("type-mode").addEventListener("click", () => setInputMode("text"));
  $("speech-mode").addEventListener("click", () => setInputMode("speech"));
  $("entry-text").addEventListener("input", scheduleEntrySave);
  $("save-entry").addEventListener("click", () => saveEntry(true));
  $("done-button").addEventListener("click", () => { saveEntry(true); activeEntryId = ""; showPage("thanks"); });
  $("record-help").addEventListener("click", openRecordHelp);
  $("about-button").addEventListener("click", openAbout);
  $("modal-close").addEventListener("click", closeModal);
  $("modal-backdrop").addEventListener("click", (event) => { if (event.target.id === "modal-backdrop") closeModal(); });
  $("theme-dark-toggle").addEventListener("change", (event) => setTheme(event.target.checked ? "dark" : "light"));
  $("save-color-profile").addEventListener("click", saveColorProfile);
  $("delete-color-profile").addEventListener("click", deleteColorProfile);
  $("color-profile-select").addEventListener("change", loadColorProfile);
  document.querySelectorAll("[data-theme-toggle], #setup-theme-toggle").forEach((input) => input.addEventListener("change", (event) => setTheme(event.target.checked ? "dark" : "light")));
  document.querySelectorAll("input[type='range']").forEach((input) => input.addEventListener("input", updateSliderOutputs));
  document.querySelectorAll(".mic-button").forEach((button) => button.addEventListener("click", () => startSpeechFor(button.dataset.speechTarget)));
  $("settings-ab-days").addEventListener("click", () => setSettingsAbUnit("days"));
  $("settings-ab-months").addEventListener("click", () => setSettingsAbUnit("months"));
  $("save-ab-settings").addEventListener("click", saveSettingsAb);
  $("export-csv").addEventListener("click", exportCsv);
  $("reset-records").addEventListener("click", resetRecords);
  $("reset-all").addEventListener("click", resetAll);
}

function hideSplash() {
  $("splash").classList.add("is-hidden");
  $("app").classList.remove("is-hidden");
}

function showPage(page) {
  currentPage = page;
  document.querySelectorAll(".page").forEach((section) => section.classList.add("is-hidden"));
  $(`${page}-page`).classList.remove("is-hidden");
  if (page === "record") prepareRecordPage();
  if (page === "settings") hydrateSettings();
}

function setTheme(theme) {
  state.settings.theme = theme;
  saveState();
  applyTheme();
  syncThemeToggles();
}

function applyTheme() {
  document.documentElement.dataset.theme = state.settings.theme || "light";
  ["--bg", "--surface", "--text", "--primary", "--border"].forEach((key) => document.documentElement.style.removeProperty(key));
  const profile = state.settings.activeColorProfile ? state.settings.colorProfiles[state.settings.activeColorProfile] : null;
  Object.entries(profile || {}).forEach(([key, value]) => document.documentElement.style.setProperty(key, value));
}

function syncThemeToggles() {
  const checked = state.settings.theme === "dark";
  document.querySelectorAll("[data-theme-toggle], #setup-theme-toggle, #theme-dark-toggle").forEach((input) => { input.checked = checked; });
}

function setAbUnit(unit) {
  abUnit = unit;
  $("ab-days").className = unit === "days" ? "primary" : "secondary";
  $("ab-months").className = unit === "months" ? "primary" : "secondary";
}

function saveWizardAb() {
  const duration = clampDuration($("ab-duration").value);
  wizard.ab = { enabled: true, duration, unit: abUnit, startedAt: todayISO() };
  state.settings.ab = wizard.ab;
  saveState();
  showPage("condition-choice");
}

function saveWizardCondition() {
  wizard.condition = {
    physical: Number($("setup-physical").value),
    mental: Number($("setup-mental").value),
    notes: $("setup-condition-notes").value.trim()
  };
  showPage("name");
}

function saveWizardProfile() {
  const firstName = $("first-name").value.trim();
  const lastName = $("last-name").value.trim();
  if (!firstName) { $("first-name").focus(); return; }
  const profile = { id: createId(), firstName, lastName, createdAt: new Date().toISOString(), theme: state.settings.theme, condition: wizard.condition };
  state.profiles.push(profile);
  state.settings.activeProfileId = profile.id;
  state.settings.completed = true;
  if (wizard.ab) state.settings.ab = wizard.ab;
  saveState();
  showPage("record");
}

function currentProfile() {
  return state.profiles.find((profile) => profile.id === state.settings.activeProfileId) || state.profiles[0] || null;
}

function profileDisplayName(profile = currentProfile()) {
  if (!profile) return "Profile";
  return [profile.firstName, profile.lastName].filter(Boolean).join(" ");
}

function prepareRecordPage() {
  const profile = currentProfile();
  if (!profile) { showPage("setup-choice"); return; }
  state.settings.activeProfileId = profile.id;
  $("record-profile-name").textContent = profileDisplayName(profile);
  const condition = latestCondition(profile.id);
  $("record-physical").value = condition?.physical || profile.condition?.physical || 5;
  $("record-mental").value = condition?.mental || profile.condition?.mental || 5;
  updateSliderOutputs();
  renderAbStatus();
  if (!activeEntryId) {
    $("entry-text").value = "";
    $("save-status").textContent = "Not saved yet";
  }
}

function latestCondition(profileId) {
  return [...state.records].reverse().find((entry) => entry.profileId === profileId && (entry.physical || entry.mental));
}

function setInputMode(mode) {
  $("type-mode").classList.toggle("is-selected", mode === "text");
  $("speech-mode").classList.toggle("is-selected", mode === "speech");
  if (mode === "speech") startSpeechFor("entry-text");
}

function startSpeechFor(targetId) {
  speechTargetId = targetId;
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) { setSaveStatus("Speech is not available here. Typing still works."); return; }
  if (!recognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      const target = $(speechTargetId);
      target.value = `${target.value} ${text}`.trim();
      target.dispatchEvent(new Event("input", { bubbles: true }));
    };
    recognition.onerror = () => setSaveStatus("Speech could not start. Typing still works.");
  }
  try { recognition.start(); setSaveStatus("Listening..."); } catch { setSaveStatus("Speech could not start. Typing still works."); }
}

function scheduleEntrySave() {
  clearTimeout(saveTimer);
  setSaveStatus("Saving...");
  saveTimer = setTimeout(() => saveEntry(false), 700);
}

function saveEntry(manual) {
  const profile = currentProfile();
  if (!profile) return;
  const text = $("entry-text").value.trim();
  const physical = Number($("record-physical").value);
  const mental = Number($("record-mental").value);
  if (!text && !manual) { setSaveStatus("Not saved yet"); return; }
  let entry = state.records.find((item) => item.id === activeEntryId);
  if (!entry) {
    entry = { id: createId(), profileId: profile.id, date: todayISO(), createdAt: new Date().toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
    activeEntryId = entry.id;
    state.records.push(entry);
  }
  entry.updatedAt = new Date().toISOString();
  entry.text = text;
  entry.physical = physical;
  entry.mental = mental;
  entry.ab = abSnapshot();
  saveState();
  setSaveStatus(`${manual ? "Saved" : "Auto-saved"} at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
}

function setSaveStatus(text) { $("save-status").textContent = text; }

function updateSliderOutputs() {
  [["setup-physical", "setup-physical-output"], ["setup-mental", "setup-mental-output"], ["record-physical", "record-physical-output"], ["record-mental", "record-mental-output"]].forEach(([inputId, outputId]) => {
    if ($(inputId) && $(outputId)) $(outputId).textContent = $(inputId).value;
  });
}

function renderAbStatus() {
  const ab = state.settings.ab;
  const pill = $("ab-status");
  if (!ab?.enabled) { pill.classList.add("is-hidden"); return; }
  pill.textContent = `A/B tracking - ${ab.duration} ${ab.unit}`;
  pill.classList.remove("is-hidden");
}

function abSnapshot() {
  const ab = state.settings.ab || {};
  return { enabled: Boolean(ab.enabled), duration: ab.duration || "", unit: ab.unit || "", startedAt: ab.startedAt || "" };
}

function hydrateSettings() {
  $("theme-dark-toggle").checked = state.settings.theme === "dark";
  renderColorProfiles();
  document.querySelectorAll("[data-color-var]").forEach((input) => {
    input.value = getComputedStyle(document.documentElement).getPropertyValue(input.dataset.colorVar).trim();
  });
  $("profile-select").innerHTML = state.profiles.map((profile) => `<option value="${profile.id}" ${profile.id === state.settings.activeProfileId ? "selected" : ""}>${escapeHtml(profileDisplayName(profile))}</option>`).join("");
  const ab = state.settings.ab || { enabled: false, duration: 14, unit: "days" };
  $("settings-ab-enabled").checked = Boolean(ab.enabled);
  $("settings-ab-duration").value = ab.duration || 14;
  setSettingsAbUnit(ab.unit || "days");
}

function switchProfileFromSettings() {
  const profileId = $("profile-select").value;
  if (!profileId) return;
  state.settings.activeProfileId = profileId;
  activeEntryId = "";
  saveState();
  showPage("record");
}

function renderColorProfiles() {
  const select = $("color-profile-select");
  select.innerHTML = `<option value="">Choose saved profile</option>`;
  Object.keys(state.settings.colorProfiles || {}).forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    option.selected = name === state.settings.activeColorProfile;
    select.appendChild(option);
  });
}

function saveColorProfile() {
  const name = $("color-profile-name").value.trim();
  if (!name) { $("color-profile-name").focus(); return; }
  const colors = {};
  document.querySelectorAll("[data-color-var]").forEach((input) => { colors[input.dataset.colorVar] = input.value; });
  state.settings.colorProfiles[name] = colors;
  state.settings.activeColorProfile = name;
  saveState();
  applyTheme();
  hydrateSettings();
}

function loadColorProfile() {
  const name = $("color-profile-select").value;
  state.settings.activeColorProfile = name;
  $("color-profile-name").value = name;
  saveState();
  applyTheme();
  hydrateSettings();
}

function deleteColorProfile() {
  const name = $("color-profile-select").value;
  if (!name) return;
  delete state.settings.colorProfiles[name];
  if (state.settings.activeColorProfile === name) state.settings.activeColorProfile = "";
  saveState();
  applyTheme();
  hydrateSettings();
}
function setSettingsAbUnit(unit) {
  settingsAbUnit = unit;
  $("settings-ab-days").className = unit === "days" ? "primary" : "secondary";
  $("settings-ab-months").className = unit === "months" ? "primary" : "secondary";
}

function saveSettingsAb() {
  state.settings.ab = { enabled: $("settings-ab-enabled").checked, duration: clampDuration($("settings-ab-duration").value), unit: settingsAbUnit, startedAt: state.settings.ab?.startedAt || todayISO() };
  saveState();
  renderAbStatus();
}

function openRecordHelp() {
  openModal("Recording Help", `<p>Use this page to record what you feel in your own words.</p><p><strong>Text or Speech:</strong> Type is always available. Speech starts dictation when your device supports it.</p><p><strong>How do you feel?</strong> Move the physical and mental sliders to match your current sense of how you are doing.</p><p><strong>Save:</strong> The text entry auto-saves. The Save button records the text and slider values immediately.</p>`);
}

function openAbout() {
  openModal("About SST", `<p><strong>Simple Symptom Tracker</strong></p><p>Version ${APP_VERSION}<br />Build ${APP_BUILD}</p>`);
}

function openModal(title, body) {
  $("modal-title").textContent = title;
  $("modal-body").innerHTML = body;
  $("modal-backdrop").classList.remove("is-hidden");
  $("modal-close").focus();
}

function closeModal() { $("modal-backdrop").classList.add("is-hidden"); }

function exportCsv() {
  const rows = [["profile", "date", "created_at", "updated_at", "timezone", "entry", "physical", "mental", "ab_enabled", "ab_duration", "ab_unit"]];
  state.records.forEach((entry) => {
    const profile = state.profiles.find((item) => item.id === entry.profileId);
    rows.push([profileDisplayName(profile), entry.date, entry.createdAt, entry.updatedAt, entry.timezone, entry.text, entry.physical, entry.mental, entry.ab?.enabled, entry.ab?.duration, entry.ab?.unit]);
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
  if (!confirm("Reset all recorded entries?")) return;
  state.records = [];
  activeEntryId = "";
  saveState();
  if (currentPage === "record") prepareRecordPage();
}

function resetAll() {
  if (!confirm("Reset all app data, including profiles and settings?")) return;
  localStorage.removeItem(STORAGE_KEY);
  state = {};
  wizard = {};
  activeEntryId = "";
  seedState();
  applyTheme();
  syncThemeToggles();
  showPage("setup-choice");
}

function clampDuration(value) {
  const digits = String(value).replace(/\D/g, "").slice(0, 3);
  return Math.max(1, Number(digits) || 1);
}

function loadState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function createId() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function todayISO(date = new Date()) { const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 10); }
function csvCell(value) { const text = String(value ?? ""); return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]); }



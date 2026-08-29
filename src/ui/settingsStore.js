// Settings persistence: profile.settings preferred, localStorage fallback.

import { loadProfile, saveProfile } from "../meta/profile.js";
import { setLocale } from "../meta/i18n.js";
import { FX_SPEEDS, normalizeFxSpeed, fxCssPace } from "./fxPace.js";
import {
  RESOLUTION_NATIVE,
  PC_RESOLUTIONS,
  PHONE_RESOLUTIONS,
  isKnownResolution,
  applyResolution,
} from "./resolution.js";

export { RESOLUTION_NATIVE, PC_RESOLUTIONS, PHONE_RESOLUTIONS };

export const SETTINGS_KEY = "chaind-blitz-settings-v1";

export const CHAIN_MODES = ["auto", "smart", "confirm", "off"];

export const AI_TIERS = ["easy", "normal", "hard"];
export const UI_SCALES = [0.75, 1, 1.25, 1.5];
export { FX_SPEEDS };

export function defaultSettings() {
  return {
    uiScale: 1,
    resolution: RESOLUTION_NATIVE,
    chainMode: "smart",
    board3d: false, // overlay only — 2D field stays clickable (i18n settings.board3d)
    locale: "en",
    music: 0.6,
    sfx: 0.8,
    musicMuted: false,
    sfxMuted: false,
    fxSpeed: 1,
    reducedMotion: false,
    colorblind: false,
    hidePlaza: false,
    classicHub: false,
    aiTier: "normal",
    cpuIntent: true,
    cloudSync: false,
    devMode: false,
  };
}

function clamp(v, lo, hi, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}

export function normalizeSettings(raw = {}) {
  const d = defaultSettings();
  const chainMode = CHAIN_MODES.includes(raw.chainMode) ? raw.chainMode : d.chainMode;
  const aiTier = AI_TIERS.includes(raw.aiTier) ? raw.aiTier : d.aiTier;
  const uiScale = UI_SCALES.includes(Number(raw.uiScale))
    ? Number(raw.uiScale)
    : clamp(raw.uiScale, 0.75, 1.5, d.uiScale);
  const resolution = isKnownResolution(raw.resolution) ? raw.resolution : d.resolution;
  return {
    uiScale,
    resolution,
    chainMode,
    board3d: !!raw.board3d,
    locale: typeof raw.locale === "string" && raw.locale ? raw.locale : d.locale,
    music: clamp(raw.music, 0, 1, d.music),
    sfx: clamp(raw.sfx, 0, 1, d.sfx),
    musicMuted: !!raw.musicMuted,
    sfxMuted: !!raw.sfxMuted,
    fxSpeed: normalizeFxSpeed(raw.fxSpeed ?? d.fxSpeed),
    reducedMotion: !!raw.reducedMotion,
    colorblind: !!raw.colorblind,
    hidePlaza: !!raw.hidePlaza,
    classicHub: !!raw.classicHub,
    aiTier,
    cpuIntent: raw.cpuIntent !== false,
    cloudSync: !!raw.cloudSync,
    devMode: !!raw.devMode,
  };
}

function readLocal() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

function writeLocal(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn("settings save failed", e);
  }
}

/** Load settings from profile.settings, else localStorage, else defaults. */
export function loadSettings(profile = null) {
  const p = profile || (() => {
    try { return loadProfile(); } catch { return null; }
  })();
  if (p?.settings && typeof p.settings === "object") {
    return normalizeSettings({ ...readLocal(), ...p.settings });
  }
  const local = readLocal();
  return normalizeSettings(local || {});
}

/** Persist to localStorage and, when possible, profile.settings. */
export function saveSettings(partial, profile = null) {
  const next = normalizeSettings({ ...loadSettings(profile), ...partial });
  writeLocal(next);
  try {
    const p = profile || loadProfile();
    p.settings = { ...(p.settings || {}), ...next };
    saveProfile(p);
  } catch { /* profile optional */ }
  return next;
}

export function applySettingsToDom(settings) {
  const s = normalizeSettings(settings);
  document.documentElement.style.setProperty("--ui-scale", String(s.uiScale));
  document.documentElement.style.setProperty("--fx-pace", String(fxCssPace(s.fxSpeed)));
  const steps = [0.75, 1, 1.25, 1.5];
  const snapped = steps.reduce((best, v) =>
    Math.abs(v - s.uiScale) < Math.abs(best - s.uiScale) ? v : best);
  document.documentElement.dataset.uiScale = String(snapped);
  document.documentElement.dataset.fxSkip = normalizeFxSpeed(s.fxSpeed) === 0 ? "1" : "0";
  document.documentElement.dataset.reducedMotion = s.reducedMotion ? "1" : "0";
  document.documentElement.dataset.colorblind = s.colorblind ? "1" : "0";
  document.documentElement.dataset.board3d = s.board3d ? "1" : "0";
  document.documentElement.dataset.classicHub = s.classicHub ? "1" : "0";
  document.documentElement.dataset.hidePlaza = s.hidePlaza ? "1" : "0";
  document.documentElement.lang = s.locale || "en";
  setLocale(s.locale || "en");
  applyResolution(s.resolution);
  bindResolutionResize();
  return s;
}

let resizeBound = false;
function bindResolutionResize() {
  if (resizeBound || typeof window === "undefined") return;
  resizeBound = true;
  window.addEventListener("resize", () => {
    applyResolution(loadSettings().resolution);
  });
}

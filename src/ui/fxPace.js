/** Duel FX speed. Skip zeros animation waits — it does not skip rules. */

export const FX_SPEEDS = [0.5, 1, 2, 0];

export function normalizeFxSpeed(v) {
  if (v === "skip" || v === "0" || v === 0) return 0;
  const n = Number(v);
  if (n === 0.5 || n === 1 || n === 2) return n;
  return 1;
}

export function fxSpeedLabel(v) {
  const n = normalizeFxSpeed(v);
  return n === 0 ? "Skip" : `${n}×`;
}

/** CSS animation-duration multiplier. Skip is near-zero, not a rules skip. */
export function fxCssPace(v) {
  const n = normalizeFxSpeed(v);
  if (n === 0) return 0.001;
  return 1 / n;
}

export function currentFxSpeed() {
  if (typeof window !== "undefined" && window.__CB_SETTINGS?.fxSpeed != null) {
    return normalizeFxSpeed(window.__CB_SETTINGS.fxSpeed);
  }
  return 1;
}

export function fxSkip(speed) {
  return normalizeFxSpeed(speed ?? currentFxSpeed()) === 0;
}

/** Scale a visual wait. `__CB_FAST` and Skip are 0. */
export function fxDelay(ms, speed) {
  if (typeof window !== "undefined" && window.__CB_FAST) return 0;
  const n = normalizeFxSpeed(speed ?? currentFxSpeed());
  if (n === 0) return 0;
  const raw = Number(ms);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.max(0, Math.round(raw / n));
}

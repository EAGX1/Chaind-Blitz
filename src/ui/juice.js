// Lightweight juice director: CSS class pulses on phase orb / body.

import { fxDelay, fxSkip } from "./fxPace.js";

const PHASE_MS = 800;
const WIN_MS = 1600;
const LOSE_MS = 1400;

function reducedMotion() {
  return document.documentElement.dataset.reducedMotion === "1";
}

/** Pulse the phase orb (and a light body flash). */
export function pulsePhase() {
  if (reducedMotion() || fxSkip()) return;
  const orb = document.getElementById("phase-orb");
  orb?.classList.add("pulse", "juice-phase");
  document.body.classList.add("juice-phase-flash");
  setTimeout(() => {
    orb?.classList.remove("pulse", "juice-phase");
    document.body.classList.remove("juice-phase-flash");
  }, fxDelay(PHASE_MS) || 1);
}

/** Victory burst on body + phase orb. */
export function burstWin() {
  if (reducedMotion() || fxSkip()) return;
  document.body.classList.add("juice-win");
  const orb = document.getElementById("phase-orb");
  orb?.classList.add("juice-win-orb");
  setTimeout(() => {
    document.body.classList.remove("juice-win");
    orb?.classList.remove("juice-win-orb");
  }, fxDelay(WIN_MS) || 1);
}

/** Defeat flash — red, not gold. */
export function burstLose() {
  if (reducedMotion() || fxSkip()) return;
  document.body.classList.add("juice-lose");
  const orb = document.getElementById("phase-orb");
  orb?.classList.add("juice-lose-orb");
  setTimeout(() => {
    document.body.classList.remove("juice-lose");
    orb?.classList.remove("juice-lose-orb");
  }, fxDelay(LOSE_MS) || 1);
}

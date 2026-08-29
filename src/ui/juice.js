// Lightweight juice director: CSS class pulses on phase orb / body.

import { fxDelay, fxSkip } from "./fxPace.js";

const PHASE_MS = 800;
const WIN_MS = 1600;
const LOSE_MS = 1400;

function reducedMotion() {
  return typeof document !== "undefined" && document.documentElement.dataset.reducedMotion === "1";
}

/** Summon/draw hops — skip when the player asked for less motion. */
export function juiceOk() {
  return typeof document !== "undefined" && !reducedMotion() && !fxSkip();
}

/** Master Duel–style center banner when the turn player flips. */
export function splashTurn(side) {
  if (typeof document === "undefined" || fxSkip()) return;
  const layer = document.getElementById("fx-layer");
  if (!layer) return;
  layer.querySelector(".turn-splash")?.remove();
  const el = document.createElement("div");
  el.className = "turn-splash";
  el.dataset.side = side === "you" ? "you" : "foe";
  el.setAttribute("role", "status");
  if (reducedMotion()) el.classList.add("is-static");
  const b = document.createElement("b");
  b.textContent = side === "you" ? "YOUR TURN" : "OPPONENT'S TURN";
  el.appendChild(b);
  layer.appendChild(el);
  // Stay readable even when __CB_FAST / 2× zeros other waits.
  setTimeout(() => el.remove(), reducedMotion() ? 900 : 1000);
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

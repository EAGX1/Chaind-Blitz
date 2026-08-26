// Idle-board keyboard: arrows cycle field/hand for inspect; Space/E ends a live phase.

import { cardByUid } from "../engine/index.js";
import { openGyBrowser } from "./gyBrowser.js";

const SELECTOR = "#hand-0 .cb-card, #mz-0 .cb-card, #stz-0 .cb-card, #mz-1 .cb-card, #stz-1 .cb-card";
const ZONE_JUMP = {
  h: "#hand-0 .cb-card",
  f: "#mz-0 .cb-card, #stz-0 .cb-card"
};

export function idleBoardCards() {
  return [...document.querySelectorAll(SELECTOR)];
}

/** TES / Master Duel: `/` focuses the side log search. Not a mill or deck search. */
export function isLogSearchHotkey(e) {
  return e?.key === "/" && !e.ctrlKey && !e.altKey && !e.metaKey;
}

export function focusLogSearch() {
  const box = document.getElementById("log-search");
  if (!box) return false;
  box.focus();
  box.select?.();
  return true;
}

function promptOpen() {
  const bar = document.getElementById("prompt");
  return bar && !bar.classList.contains("hidden");
}

function blocked(e) {
  if (e.target?.closest?.("input, textarea, select, [contenteditable]")) return true;
  if (document.querySelector(".cb-modal")) return true;
  if (document.body.classList.contains("cb-dragging")) return true;
  if (document.getElementById("mulligan-stage")) return true;
  const go = document.getElementById("gameover");
  if (go && !go.classList.contains("hidden")) return true;
  const duel = document.getElementById("screen-duel");
  if (!duel || duel.classList.contains("hidden")) return true;
  return false;
}

export function installIdleBoardKeys({ showInspector } = {}) {
  if (installIdleBoardKeys._wired) return;
  installIdleBoardKeys._wired = true;
  let focus = 0;
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (blocked(e)) return;
    if (promptOpen()) return;
    const els = idleBoardCards();
    const paint = () => {
      document.querySelectorAll(".cb-card.kb-focus").forEach((n) => n.classList.remove("kb-focus"));
      const el = els[focus];
      if (!el) return;
      el.classList.add("kb-focus");
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
      const uid = el.dataset?.uid;
      if (uid != null && uid !== "" && showInspector) {
        const G = window.__CB?.currentG;
        const card = G ? cardByUid(G, Number(uid)) : null;
        if (card) showInspector(card);
      }
    };
    if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "Tab") {
      e.preventDefault();
      if (!els.length) return;
      focus = (focus + 1) % els.length;
      paint();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!els.length) return;
      focus = (focus - 1 + els.length) % els.length;
      paint();
    } else if (e.key === "e" || e.key === "E" || e.key === " ") {
      const orb = document.getElementById("phase-orb");
      if (!orb?.classList.contains("clickable")) return;
      e.preventDefault();
      orb.click();
    } else if (e.key === "Home") {
      e.preventDefault();
      if (!els.length) return;
      focus = 0;
      paint();
    } else if (e.key === "End") {
      e.preventDefault();
      if (!els.length) return;
      focus = els.length - 1;
      paint();
    } else if (e.key === "h" || e.key === "H") {
      e.preventDefault();
      jumpZone(ZONE_JUMP.h, els, (i) => { focus = i; paint(); });
    } else if (e.key === "f" || e.key === "F") {
      e.preventDefault();
      jumpZone(ZONE_JUMP.f, els, (i) => { focus = i; paint(); });
    } else if (e.key === "g" || e.key === "G") {
      e.preventDefault();
      const G = window.__CB?.currentG;
      if (G) openGyBrowser(G, 0);
    } else if (isLogSearchHotkey(e)) {
      e.preventDefault();
      focusLogSearch();
    } else if (e.key >= "1" && e.key <= "9") {
      const i = Number(e.key) - 1;
      if (!els[i]) return;
      e.preventDefault();
      focus = i;
      paint();
    }
  });
}

function jumpZone(selector, els, setFocus) {
  const target = document.querySelector(selector);
  if (!target) return;
  const i = els.indexOf(target);
  if (i >= 0) setFocus(i);
}

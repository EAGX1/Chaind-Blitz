// Floating zoomed card + optional docked inspect pane (#deck-inspect).
// mouseenter on the card itself (not pointerover on children) so SVG art
// inside a face does not cancel the preview.

import { CARD_DB } from "../data/cards/index.js";
import { buildCardEl } from "./cardArt.js";

const POP_ID = "card-hover-pop";
let pop = null;
let shownFor = null;
let hideTimer = 0;

function ensurePop() {
  if (pop && document.body.contains(pop)) return pop;
  pop = document.createElement("div");
  pop.id = POP_ID;
  pop.className = "card-hover-pop";
  pop.setAttribute("aria-hidden", "true");
  document.body.appendChild(pop);
  return pop;
}

function defOf(el, fallback = null) {
  if (fallback && typeof fallback === "object" && fallback.id) return fallback;
  const id = typeof fallback === "string" ? fallback : el?.dataset?.cardId;
  return (id && CARD_DB[id]) || null;
}

function liveStats(el) {
  if (!el?.classList?.contains("cb-card")) return null;
  const atk = el.querySelector(".card-stats .atk")?.textContent;
  const defv = el.querySelector(".card-stats .def")?.textContent;
  if (atk == null || defv == null) return null;
  const a = Number(atk);
  const d = Number(defv);
  if (!Number.isFinite(a) || !Number.isFinite(d)) return null;
  return { atk: a, def: d };
}

function fillDock(def) {
  const dock = document.getElementById("deck-inspect");
  if (!dock || !def) return;
  dock.innerHTML = "";
  const card = buildCardEl(def, { tilt: false });
  card.style.setProperty("--cw", "168px");
  dock.appendChild(card);
  const text = document.createElement("p");
  text.className = "card-hover-text";
  text.textContent = def.text || "No effect text.";
  dock.appendChild(text);
}

function place(anchor) {
  const r = anchor.getBoundingClientRect();
  const pw = pop.offsetWidth || 260;
  const ph = pop.offsetHeight || 380;
  const gap = 14;
  let left = r.right + gap;
  if (left + pw > window.innerWidth - 8) left = r.left - pw - gap;
  if (left < 8) left = 8;
  let top = r.top + (r.height - ph) / 2;
  if (top + ph > window.innerHeight - 8) top = window.innerHeight - ph - 8;
  if (top < 8) top = 8;
  pop.style.left = `${Math.round(left)}px`;
  pop.style.top = `${Math.round(top)}px`;
}

export function hideCardHover() {
  clearTimeout(hideTimer);
  hideTimer = 0;
  shownFor = null;
  if (!pop) return;
  pop.classList.remove("on");
  pop.innerHTML = "";
}

/** Last hovered card element, if the zoom pop is showing. */
export function getHoverAnchor() {
  return shownFor;
}

export function showCardHover(anchor, def = null) {
  const resolved = defOf(anchor, def);
  if (!resolved || !anchor) return;
  clearTimeout(hideTimer);
  const box = ensurePop();
  box.innerHTML = "";
  const card = buildCardEl(resolved, { stats: liveStats(anchor), tilt: false });
  box.appendChild(card);
  const text = document.createElement("p");
  text.className = "card-hover-text";
  text.textContent = resolved.text || "No effect text.";
  box.appendChild(text);
  box.classList.add("on");
  shownFor = anchor;
  place(anchor);
  fillDock(resolved);
}

/** mouseenter/leave on the element — does not retrigger on child SVG moves. */
export function bindCardHover(el, def = null) {
  if (!el || el.dataset.cbHover === "1") return el;
  el.dataset.cbHover = "1";
  if (def?.id && !el.dataset.cardId) el.dataset.cardId = def.id;
  el.addEventListener("mouseenter", () => showCardHover(el, def));
  el.addEventListener("mouseleave", () => {
    hideTimer = window.setTimeout(hideCardHover, 80);
  });
  return el;
}

function sourceFromEvent(target) {
  if (!(target instanceof Element)) return null;
  if (target.closest(".card-hover-pop")) return null;
  const el = target.closest(".cb-card, [data-card-id]");
  if (!el || el.classList.contains("card-back") || el.id === POP_ID) return null;
  return el;
}

function onPointerOver(e) {
  const el = sourceFromEvent(e.target);
  if (!el) return;
  // Treat as mouseenter: ignore moves between descendants of the same card.
  if (sourceFromEvent(e.relatedTarget) === el) return;
  showCardHover(el);
}

function onPointerOut(e) {
  const el = sourceFromEvent(e.target);
  if (!el) return;
  if (sourceFromEvent(e.relatedTarget) === el) return;
  if (shownFor !== el) return;
  hideTimer = window.setTimeout(hideCardHover, 80);
}

export function installCardHover() {
  if (typeof window === "undefined" || window.__CB_CARD_HOVER) return;
  window.__CB_CARD_HOVER = true;
  document.addEventListener("pointerover", onPointerOver);
  document.addEventListener("pointerout", onPointerOut);
  window.addEventListener("resize", hideCardHover);
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") hideCardHover(); });
}

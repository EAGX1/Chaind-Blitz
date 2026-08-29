/** Drag-to-play helpers. Hearthstone / Hyperdraft / Midnight Suns steal.
 * Click + zone still works — drag is a second verb, not the only one. */

export const DRAG_PX = 8;

export function parseZoneToken(token) {
  const m = String(token || "").match(/^(mz|stz)-([01])-(\d+)$/);
  if (!m) return null;
  return { kind: m[1], p: Number(m[2]), z: Number(m[3]) };
}

export function dragExceeded(dx, dy, px = DRAG_PX) {
  return (Number(dx) * Number(dx) + Number(dy) * Number(dy)) >= px * px;
}

export function zoneKindForType(type, spellSubtype) {
  if (type === "summon" || type === "ambushSet" || type === "contactFusion") return "mz";
  if (type === "set") return "stz";
  if (type === "activate" && spellSubtype === "continuous") return "stz";
  return null;
}

const DROP_ORDER = ["summon", "activate", "activateSet", "ambushSet", "set", "contactFusion"];

export function actForZoneDrop(acts, kind) {
  const hits = (acts || []).filter((a) => zoneKindForType(a.type, a.card?.def?.spell?.subtype) === kind);
  if (!hits.length) return null;
  for (const t of DROP_ORDER) {
    const hit = hits.find((a) => a.type === t);
    if (hit) return hit;
  }
  return hits[0];
}

/** Drop a no-zone activate (normal spell) onto your board. */
export function actForBoardDrop(acts) {
  return (acts || []).find((a) => a.type === "activate" && !zoneKindForType(a.type, a.card?.def?.spell?.subtype)) || null;
}

export function dropFromElement(el) {
  if (!el || typeof el.closest !== "function") return null;
  const zoneEl = el.closest("[data-zone]");
  if (zoneEl) {
    const parsed = parseZoneToken(zoneEl.dataset.zone);
    if (parsed) return parsed;
  }
  const uidEl = el.closest("[data-uid]");
  if (uidEl && uidEl.closest("#mz-1, #stz-1")) return { kind: "foe", uid: Number(uidEl.dataset.uid) };
  if (el.closest("#hud-1, #lp-1, .opp-hud")) return { kind: "direct" };
  if (el.closest("#hand-0")) {
    const handEl = el.closest("#hand-0 [data-uid]");
    return { kind: "hand", uid: handEl ? Number(handEl.dataset.uid) : null };
  }
  if (el.closest("#mz-0, #stz-0, .you-mz, .board")) return { kind: "board" };
  return null;
}

/** Splice `fromUid` in front of `ontoUid` (or to the end). Does not mutate `list`. */
export function reorderHandList(list, fromUid, ontoUid) {
  const arr = [...(list || [])];
  const from = arr.findIndex((c) => c && c.uid === fromUid);
  if (from < 0) return arr;
  const [card] = arr.splice(from, 1);
  let insert = ontoUid == null ? arr.length : arr.findIndex((c) => c && c.uid === ontoUid);
  if (insert < 0) insert = arr.length;
  arr.splice(insert, 0, card);
  return arr;
}

export function attackFromDrop(drop) {
  if (!drop) return null;
  if (drop.kind === "foe" && Number.isFinite(drop.uid)) return { targetUid: drop.uid };
  if (drop.kind === "direct") return { targetUid: null };
  return null;
}

let ghost = null;
let liveCancel = null;

export function clearDragUi() {
  liveCancel?.();
  liveCancel = null;
  ghost?.remove();
  ghost = null;
  document.body?.classList.remove("cb-dragging");
  document.querySelectorAll(".drag-origin, .zone-drop").forEach((n) => {
    n.classList.remove("drag-origin", "zone-drop");
  });
}

function paintGhost(src, x, y) {
  if (!ghost) {
    ghost = src.cloneNode(true);
    ghost.classList.add("cb-drag-ghost");
    ghost.classList.remove("drag-origin", "selectable", "selected", "kb-focus", "combo-live", "teach-next");
    ghost.removeAttribute("data-uid");
    ghost.style.pointerEvents = "none";
    ghost.style.transform = "";
    document.body.appendChild(ghost);
  }
  ghost.style.left = `${x}px`;
  ghost.style.top = `${y}px`;
}

function installNoNativeDrag() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (root.dataset.cbNoNativeDrag) return;
  root.dataset.cbNoNativeDrag = "1";
  document.addEventListener("dragstart", (e) => {
    if (e.target?.closest?.(".cb-card, .cb-drag-ghost")) e.preventDefault();
  });
}

/**
 * Pointer-drag. Movement under DRAG_PX still fires click.
 * Bind the returned `down` with bindEv so unbindAll can drop it.
 */
export function watchDrag(el, { onDragStart, onHover, onDrop } = {}) {
  installNoNativeDrag();
  let armed = false;
  let dragging = false;
  let sx = 0;
  let sy = 0;
  let skipClick = false;
  let pointerId = null;
  const unbindWindow = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
    window.removeEventListener("blur", up);
  };
  const releaseCapture = () => {
    if (pointerId == null || typeof el.releasePointerCapture !== "function") {
      pointerId = null;
      return;
    }
    try {
      if (el.hasPointerCapture?.(pointerId)) el.releasePointerCapture(pointerId);
    } catch { /* already released */ }
    pointerId = null;
  };
  const move = (ev) => {
    if (!armed) return;
    const dx = ev.clientX - sx;
    const dy = ev.clientY - sy;
    if (!dragging && dragExceeded(dx, dy)) {
      dragging = true;
      skipClick = true;
      el.classList.add("drag-origin");
      document.body.classList.add("cb-dragging");
      onDragStart?.();
    }
    if (!dragging) return;
    paintGhost(el, ev.clientX, ev.clientY);
    const under = document.elementFromPoint(ev.clientX, ev.clientY);
    onHover?.(dropFromElement(under), under);
  };
  const up = (ev) => {
    if (!armed && !dragging) return;
    armed = false;
    const was = dragging;
    dragging = false;
    const clientX = ev?.clientX;
    const clientY = ev?.clientY;
    const under = was && Number.isFinite(clientX)
      ? document.elementFromPoint(clientX, clientY)
      : null;
    const drop = was ? dropFromElement(under) : null;
    liveCancel = null;
    unbindWindow();
    releaseCapture();
    ghost?.remove();
    ghost = null;
    document.body?.classList.remove("cb-dragging");
    document.querySelectorAll(".drag-origin, .zone-drop").forEach((n) => {
      n.classList.remove("drag-origin", "zone-drop");
    });
    if (was) {
      skipClick = true;
      setTimeout(() => { skipClick = false; }, 80);
      onDrop?.(drop);
    }
  };
  const down = (ev) => {
    if (ev.button != null && ev.button !== 0) return;
    if (ev.target?.closest?.("button, input, textarea, select")) return;
    armed = true;
    dragging = false;
    sx = ev.clientX;
    sy = ev.clientY;
    pointerId = ev.pointerId;
    liveCancel = () => {
      armed = false;
      dragging = false;
      unbindWindow();
      releaseCapture();
    };
    try { el.setPointerCapture?.(ev.pointerId); } catch { /* not a pointer event target */ }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("blur", up);
  };
  return {
    down,
    consumeClick() {
      if (!skipClick) return false;
      skipClick = false;
      return true;
    }
  };
}

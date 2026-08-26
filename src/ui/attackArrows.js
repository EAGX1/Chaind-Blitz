// SVG overlay helpers for battle targeting arrows.

const OVERLAY_ID = "cb-attack-arrows";

function ensureOverlay() {
  let svg = document.getElementById(OVERLAY_ID);
  if (svg) return svg;
  svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.id = OVERLAY_ID;
  svg.setAttribute("aria-hidden", "true");
  Object.assign(svg.style, {
    position: "fixed",
    inset: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: "9990",
    overflow: "visible",
  });
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  defs.innerHTML = `
    <marker id="cb-arrow-head" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L8,3 L0,6 Z" fill="#ff6b4a"/>
    </marker>
  `;
  svg.appendChild(defs);
  document.body.appendChild(svg);
  return svg;
}

function centerOf(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function drawLine(svg, fromEl, toEl) {
  const a = centerOf(fromEl);
  const b = centerOf(toEl);
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", String(a.x));
  line.setAttribute("y1", String(a.y));
  line.setAttribute("x2", String(b.x));
  line.setAttribute("y2", String(b.y));
  line.setAttribute("stroke", "#ff6b4a");
  line.setAttribute("stroke-width", "3");
  line.setAttribute("stroke-linecap", "round");
  line.setAttribute("marker-end", "url(#cb-arrow-head)");
  line.classList.add("cb-attack-arrow");
  svg.appendChild(line);
}

/** UIDs of every chain link, oldest to newest. */
export function chainLinkUids(chain) {
  return (chain || []).map((link) => link?.card?.uid).filter((uid) => uid != null);
}

export function chainLinkEls(chain, findEl) {
  return chainLinkUids(chain).map((uid) => findEl?.(uid)).filter(Boolean);
}

/** Draw (or replace) targeting arrows from `fromEl` to each target. */
export function showAttackArrows(fromEl, toEls) {
  if (!fromEl) return;
  const svg = ensureOverlay();
  clearAttackArrows({ keepOverlay: true });
  for (const toEl of toEls || []) {
    if (toEl) drawLine(svg, fromEl, toEl);
  }
}

/** Draw (or replace) a targeting arrow from `fromEl` to `toEl`. */
export function showAttackArrow(fromEl, toEl) {
  showAttackArrows(fromEl, toEl ? [toEl] : []);
}

/** Remove all attack arrows (and the overlay unless keepOverlay). */
export function clearAttackArrows({ keepOverlay = false } = {}) {
  const svg = document.getElementById(OVERLAY_ID);
  if (!svg) return;
  svg.querySelectorAll(".cb-attack-arrow").forEach((n) => n.remove());
  if (!keepOverlay && !svg.querySelector(".cb-attack-arrow")) svg.remove();
}

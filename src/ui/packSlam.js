import { buildCardEl, cardBackEl } from "./cardArt.js";
import { sfx } from "./fx.js";
import { playStinger } from "../meta/music.js";

function reduced() {
  return document.documentElement.dataset.reducedMotion === "1";
}

export function slamRarityClass(rarity) {
  if (rarity === "UR") return "hit-ur";
  if (rarity === "SR") return "hit-sr";
  if (rarity === "R") return "hit-r";
  return "hit-n";
}

export function packFocusWait(rarity) {
  if (rarity === "UR") return 1100;
  if (rarity === "SR") return 850;
  if (rarity === "R") return 650;
  return 700;
}

export function packHoldAfterFlip(rarity) {
  if (rarity === "UR") return 1500;
  if (rarity === "SR") return 1100;
  if (rarity === "R") return 700;
  return 520;
}

export function packRecapLine(defs) {
  const list = (defs || []).filter(Boolean);
  if (!list.length) return "";
  const counts = { UR: 0, SR: 0, R: 0, N: 0 };
  for (const d of list) counts[d.rarity] = (counts[d.rarity] || 0) + 1;
  const bits = ["UR", "SR", "R", "N"].filter((r) => counts[r]).map((r) => `${counts[r]}× ${r}`);
  const star = list.some((d) => d.rarity === "UR") ? "UR HIT · " : list.some((d) => d.rarity === "SR") ? "SR · " : "";
  return `${star}${bits.join(" · ")}`;
}

function closeOverlay() {
  document.getElementById("pack-cinema-overlay")?.remove();
}

/** Face-down pack. You click each card to flip it — nothing auto-reveals. */
export function slamPackCards(host, defs, { width = 105 } = {}) {
  const list = (defs || []).filter(Boolean);
  playStinger("pack");
  sfx.pack();
  closeOverlay();

  const overlay = !host || host === document.body;
  const root = overlay ? document.createElement("div") : host;
  if (overlay) {
    root.id = "pack-cinema-overlay";
    document.body.appendChild(root);
  }
  root.className = overlay
    ? "pack-cinema pack-cinema-overlay pack-slam"
    : `${host.className || ""} pack-cinema pack-slam`.trim();
  const cardW = overlay ? Math.max(width, 96) : width;
  root.style.setProperty("--cw", `${cardW}px`);
  root.innerHTML = "";
  root.title = "Click a card to flip it";

  const flash = document.createElement("div");
  flash.className = "pack-cinema-flash";
  flash.setAttribute("aria-hidden", "true");
  const row = document.createElement("div");
  row.className = "pack-cinema-row";
  const hint = document.createElement("p");
  hint.className = "pack-cinema-hint";
  hint.textContent = list.length ? "Click a card to flip it" : "";
  root.appendChild(flash);
  root.appendChild(row);
  root.appendChild(hint);

  const wraps = [];
  let closed = false;
  const motionOff = reduced();

  const burst = (rarity) => {
    if (rarity !== "UR" && rarity !== "SR") return;
    flash.className = "pack-cinema-flash";
    void flash.offsetWidth;
    flash.className = `pack-cinema-flash go ${slamRarityClass(rarity)}`;
  };

  const reveal = (wrap, def) => {
    if (wrap.classList.contains("flipped")) return false;
    wrap.classList.add("flipped");
    wrap.classList.add("is-focus");
    window.setTimeout(() => wrap.classList.remove("is-focus"), 420);
    if (def.rarity === "UR" || def.rarity === "SR") {
      sfx.evolve();
      burst(def.rarity);
    } else sfx.draw();
    return true;
  };

  const allFlipped = () => wraps.every(({ wrap }) => wrap.classList.contains("flipped"));

  const finish = () => {
    hint.textContent = packRecapLine(list) + (overlay ? " · Click empty space to close" : "");
  };

  const dismiss = () => {
    if (!overlay || closed) return;
    closed = true;
    window.removeEventListener("keydown", onEsc);
    closeOverlay();
  };

  const onEsc = (e) => {
    if (e.key !== "Escape" || !overlay) return;
    dismiss();
  };

  list.forEach((def) => {
    const wrap = document.createElement("div");
    wrap.className = `pack-slam-card ${slamRarityClass(def.rarity)}`;
    wrap.style.setProperty("--cw", `${cardW}px`);
    wrap.dataset.rarity = def.rarity || "N";
    wrap.tabIndex = 0;
    const back = cardBackEl();
    back.style.setProperty("--cw", `${cardW}px`);
    const face = buildCardEl(def, { tilt: false });
    face.style.setProperty("--cw", `${cardW}px`);
    wrap.appendChild(back);
    wrap.appendChild(face);
    wrap.addEventListener("click", (e) => {
      e.stopPropagation();
      if (closed) return;
      reveal(wrap, def);
      if (allFlipped()) finish();
    });
    wrap.addEventListener("keydown", (e) => {
      if (e.code !== "Space" && e.code !== "Enter") return;
      e.preventDefault();
      e.stopPropagation();
      wrap.click();
    });
    if (motionOff) wrap.style.transition = "none";
    row.appendChild(wrap);
    wraps.push({ wrap, def });
  });

  if (!list.length) {
    hint.textContent = "Empty pack";
    return;
  }

  root.addEventListener("click", (e) => {
    if (e.target !== root && e.target !== hint && e.target !== flash) return;
    if (allFlipped()) dismiss();
  });
  if (overlay) {
    root.tabIndex = 0;
    root.focus({ preventScroll: true });
    window.addEventListener("keydown", onEsc);
  }
}

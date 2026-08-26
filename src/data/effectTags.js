// Effect icons for card faces + deck-editor filters.
// Tags are inferred from keywords and printed text so every card is covered
// without hand-tagging the whole pool.

const ico = (d, fill) =>
  `<svg class="fx-ico" viewBox="0 0 16 16" aria-hidden="true"><path fill="${fill}" d="${d}"/></svg>`;

export const EFFECT_TAGS = [
  { id: "draw", label: "Draw", color: "#7ec8e3",
    icon: ico("M3 2h7v10H3zM6 4h7v10H9V4z", "#7ec8e3"),
    test: (d, t) => /\bdraw\b/.test(t) },
  { id: "heal", label: "Heal", color: "#58d68d",
    icon: ico("M7 2h2v5h5v2H9v5H7V9H2V7h5z", "#58d68d"),
    test: (d, t) => /\bheal\b/.test(t) },
  { id: "burn", label: "Damage", color: "#ff7a3c",
    icon: ico("M8 1c2 3 5 4 5 8a5 5 0 11-10 0c0-2 2-4 3-5 0 2 1 3 2 3S9 6 8 1z", "#ff7a3c"),
    test: (d, t) => /deal \d+|take \d+ damage|damage to (the )?(enemy )?leader|to the enemy leader/.test(t) },
  { id: "destroy", label: "Destroy", color: "#ff5d5d",
    icon: ico("M2 3l3 5-3 5h3l2-3 2 3h3L9 8l3-5h-3L8 6 6 3z", "#ff5d5d"),
    test: (d, t) => /\bdestroy\b/.test(t) },
  { id: "negate", label: "Negate", color: "#c084fc",
    icon: ico("M8 1a7 7 0 100 14A7 7 0 008 1zm3.5 3.1L4.1 11.5A5.5 5.5 0 0111.5 4.1z", "#c084fc"),
    test: (d, t) => /\bnegate\b/.test(t) },
  { id: "discard", label: "Discard", color: "#b08cff",
    icon: ico("M3 2h10v2H3zM5 5h6l-1 9H6z", "#b08cff"),
    test: (d, t) => /\bdiscard\b/.test(t) },
  { id: "mill", label: "Mill", color: "#8b96b3",
    icon: ico("M2 3h12v2H2zM3 6h10v2H3zM4 9h8v2H4zM5 12h6v2H5z", "#8b96b3"),
    test: (d, t) => /\bmill\b/.test(t) },
  { id: "bounce", label: "Bounce", color: "#4aa8ff",
    icon: ico("M3 8h7V5l4 4-4 4V10H3z", "#4aa8ff"),
    test: (d, t) => /\bbounce\b|return .{0,24}to (your |the |its )?hand/.test(t) },
  { id: "search", label: "Search", color: "#f5c542",
    icon: ico("M7 2a5 5 0 013.9 8.1L14 13.2 12.8 14.4 9.7 11.3A5 5 0 117 2zm0 2a3 3 0 100 6 3 3 0 000-6z", "#f5c542"),
    test: (d, t) => /\badd\b.{0,40}\bdeck\b|\bsearch\b/.test(t) },
  { id: "summon", label: "Summon", color: "#ffe08a",
    icon: ico("M8 1l2 5h5l-4 3.2 1.6 5L8 11.2 3.4 14.2 5 9.2 1 6h5z", "#ffe08a"),
    test: (d, t) => /special summon/.test(t) },
  { id: "fusion", label: "Fusion", color: "#e879f9",
    icon: ico("M8 1l6 3.5v7L8 15l-6-3.5v-7z", "#e879f9"),
    test: (d, t) => d.summon === "fusion" || !!d.fusion || /\bfusion\b|\bcontact\b/.test(t) },
  { id: "rush", label: "Rush", color: "#ffb04a",
    icon: ico("M9 1L3 9h4l-1 6 7-9H9z", "#ffb04a"),
    test: (d, t) => (d.keywords || []).includes("rush") || /\brush\b/.test(t) },
  { id: "ward", label: "Ward", color: "#58d68d",
    icon: ico("M8 1l6 2v5c0 4-3 6.5-6 8-3-1.5-6-4-6-8V3z", "#58d68d"),
    test: (d, t) => (d.keywords || []).includes("ward") || /\bward\b/.test(t) },
  { id: "drain", label: "Drain", color: "#ff5d5d",
    icon: ico("M8 1c3 4 5 6 5 8.5A5 5 0 118 1z", "#ff5d5d"),
    test: (d, t) => (d.keywords || []).includes("drain") || /\bdrain\b/.test(t) },
  { id: "buff", label: "Buff", color: "#f5c542",
    icon: ico("M8 2l5 6H9v6H7V8H3z", "#f5c542"),
    test: (d, t) => /\+\d+\s*(atk|def)|gets \+\d+/i.test(t) },
  { id: "counter", label: "Counter", color: "#c084fc",
    icon: ico("M8 1l6 3v4c0 3.5-2.5 6-6 7-3.5-1-6-3.5-6-7V4z", "#c084fc"),
    test: (d, t) => d.spell?.subtype === "counter" || /\bcounter\b/.test(t) },
];

const cache = new Map();

export function effectsOf(def) {
  if (!def) return [];
  const hit = cache.get(def.id);
  if (hit) return hit;
  const t = String(def.text || "").toLowerCase();
  const tags = EFFECT_TAGS.filter((tag) => tag.test(def, t));
  cache.set(def.id, tags);
  return tags;
}

export function hasEffect(def, id) {
  return effectsOf(def).some((t) => t.id === id);
}

export function fxStripHtml(def, max = 4) {
  const tags = effectsOf(def).slice(0, max);
  if (!tags.length) return "";
  return `<div class="card-fx">${tags.map((t) => {
    const kw = KEYWORD_TIPS[t.id] ? t.id : "";
    return `<span class="fx-pip" title="${t.label}" data-fx="${t.id}"${kw ? ` data-kw="${kw}"` : ""}>${t.icon}</span>`;
  }).join("")}</div>`;
}

export const KEYWORD_TIPS = {
  rush: "Can attack the turn it was summoned or evolved. Still cannot attack on the going-first player's first turn.",
  ward: "If you control a face-up Ward, the opponent must attack a Ward — they cannot snipe past or go direct.",
  drain: "Damage this card deals also heals your LP.",
  ambush: "Set face-down in a monster zone. Flips face-up when attacked; that flip can trigger its effect.",
  fanfare: "Optional trigger when this is summoned. Lane onSummon runs after this window, so a lane draw does not make it miss. It still misses if a cost, tribute, or a CL2+ death was already the last thing to happen.",
  contact: "Send the listed materials to the GY, then Special Summon from the Extra Deck. No Fusion Spell. Once per name per turn.",
  evolve: "Spend 1 EP: +2/+2 and Rush, then the Evolve effect starts a Speed 1 chain (Ash Whisper can answer)."
};

const KW_ORDER = Object.keys(KEYWORD_TIPS).sort((a, b) => b.length - a.length);
const KW_RE = new RegExp(`\\b(${KW_ORDER.join("|")})\\b`, "gi");

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function linkifyCardText(text) {
  return escapeHtml(text).replace(KW_RE, (m) => {
    const id = m.toLowerCase();
    if (!KEYWORD_TIPS[id]) return m;
    return `<button type="button" class="kw" data-kw="${id}">${m}</button>`;
  });
}

export function installKeywordTips() {
  if (typeof document === "undefined" || document.documentElement.dataset.kwTips) return;
  document.documentElement.dataset.kwTips = "1";
  let tip = null;
  function hide() {
    tip?.remove();
    tip = null;
  }
  document.addEventListener("click", (e) => {
    const btn = e.target.closest?.("[data-kw]");
    if (!btn) { hide(); return; }
    const id = btn.getAttribute("data-kw");
    const body = KEYWORD_TIPS[id];
    if (!body) return;
    e.preventDefault();
    e.stopPropagation();
    hide();
    tip = document.createElement("div");
    tip.className = "kw-tip";
    tip.setAttribute("role", "tooltip");
    tip.innerHTML = `<b>${id[0].toUpperCase() + id.slice(1)}</b><p>${body}</p>`;
    document.body.appendChild(tip);
    const r = btn.getBoundingClientRect();
    const x = Math.min(window.innerWidth - 280, Math.max(8, r.left));
    const y = r.bottom + 8;
    tip.style.left = `${x}px`;
    tip.style.top = `${Math.min(window.innerHeight - 120, y)}px`;
  }, true);
}

export function fxFilterBarHtml(selected) {
  const on = selected instanceof Set ? selected : new Set(selected || []);
  return `<div class="fx-filters" id="pool-fx">${EFFECT_TAGS.map((t) =>
    `<button type="button" class="fx-chip ${on.has(t.id) ? "on" : ""}" data-fx="${t.id}" title="${t.label}">${t.icon}<span>${t.label}</span></button>`
  ).join("")}</div>`;
}

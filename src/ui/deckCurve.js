// Deck editor ★1–10 histogram. MTGA / Omega steal. Spells sit in an S column.

import { monsterLevel } from "../engine/state.js";
import { CARD_DB } from "../data/cards/index.js";

export function deckStarCurve(cards, db = CARD_DB) {
  const stars = Array(10).fill(0);
  let spells = 0;
  for (const id of cards || []) {
    const def = db[id];
    if (!def) continue;
    if (def.type === "spell") {
      spells++;
      continue;
    }
    if (def.type !== "monster") continue;
    const lv = monsterLevel(def);
    const i = Math.min(9, Math.max(0, lv - 1));
    stars[i]++;
  }
  return { stars, spells };
}

export function deckCurveHtml(cards, db = CARD_DB) {
  const { stars, spells } = deckStarCurve(cards, db);
  const max = Math.max(1, ...stars, spells);
  const cols = stars.map((n, i) => {
    const h = Math.round((n / max) * 36);
    const lv = i + 1;
    const label = lv === 10 ? "10+" : String(lv);
    return `<div class="curve-col" title="★${label}: ${n}"><span class="curve-bar" style="height:${h}px"></span><span class="curve-n">${n}</span><span class="curve-lv">${label}</span></div>`;
  });
  const sh = Math.round((spells / max) * 36);
  cols.push(`<div class="curve-col spell" title="Spells: ${spells}"><span class="curve-bar" style="height:${sh}px"></span><span class="curve-n">${spells}</span><span class="curve-lv">S</span></div>`);
  return `<div class="deck-curve" aria-label="Star curve">${cols.join("")}</div>`;
}

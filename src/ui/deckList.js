// Deck-list text + opening-hand sim. Neuron / Arcanetable / XMage steal.
// Shuffle is seeded RNG — not a search.

import { makeRng } from "../engine/rng.js";
import { CARD_DB } from "../data/cards/index.js";
import { isExtraCard } from "../meta/banlist.js";

export function serializeDeckList({ main = [], extra = [] } = {}) {
  const lines = ["# Main", ...main];
  if (extra.length) lines.push("# Extra", ...extra);
  return lines.join("\n");
}

function resolveToken(token, db) {
  const raw = String(token || "").trim();
  if (!raw) return null;
  const idish = raw.toLowerCase().replace(/\s+/g, "_");
  if (db[idish]) return idish;
  const lower = raw.toLowerCase();
  const byName = Object.values(db).filter((d) => d.name?.toLowerCase() === lower);
  return byName.length === 1 ? byName[0].id : null;
}

function parseLine(line) {
  const t = line.trim();
  if (!t) return null;
  let n = 1;
  let token = t;
  const qtyFirst = t.match(/^(\d+)\s*[x×]?\s+(.+)$/i);
  const qtyLast = t.match(/^(.+?)\s*[x×]\s*(\d+)$/i);
  if (qtyFirst) {
    n = Math.max(1, Number(qtyFirst[1]) || 1);
    token = qtyFirst[2].trim();
  } else if (qtyLast) {
    token = qtyLast[1].trim();
    n = Math.max(1, Number(qtyLast[2]) || 1);
  }
  return { n, token };
}

/** One id per line, optional `3 ember_fox`, `# Main` / `# Extra` headers. */
export function parseDeckList(text, db = CARD_DB) {
  const main = [];
  const extra = [];
  const unknown = [];
  let section = "main";
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("//")) continue;
    if (/^#+\s*extra\b/i.test(line)) { section = "extra"; continue; }
    if (/^#+\s*main\b/i.test(line)) { section = "main"; continue; }
    if (line.startsWith("#")) continue;
    const parsed = parseLine(line);
    if (!parsed) continue;
    const id = resolveToken(parsed.token, db);
    if (!id) {
      unknown.push(parsed.token);
      continue;
    }
    const def = db[id];
    const dest = (def && isExtraCard(def)) || section === "extra" ? extra : main;
    for (let i = 0; i < parsed.n; i++) dest.push(id);
  }
  return { main, extra, unknown };
}

/** Seeded Fisher-Yates on a copy. Labelled shuffle, not a search. */
export function drawOpeningHand(mainIds, { seed = 1, n = 5 } = {}) {
  const rng = makeRng(seed >>> 0 || 1);
  const pile = [...(mainIds || [])];
  rng.shuffle(pile);
  const take = Math.min(n, pile.length);
  return {
    seed: seed >>> 0 || 1,
    cards: pile.slice(0, take),
    remaining: pile.length - take
  };
}

/** Blitz seats differ after the same 5 cards. Dueling Nexus Test-Hand steal. */
export const OPENING_SEATS = {
  first: {
    id: "first",
    label: "FIRST",
    ep: 2,
    caption: "Going first: 2 EP. No Battle Phase and no Main Phase 2."
  },
  second: {
    id: "second",
    label: "SECOND",
    ep: 3,
    caption: "Going second: 3 EP. You may attack this turn."
  }
};

export function openingSeatNote(seat) {
  return OPENING_SEATS[seat] || OPENING_SEATS.first;
}

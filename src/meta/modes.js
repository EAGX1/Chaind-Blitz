// Game modes: draft, cube draft, sealed, highlander, tournament, tavern brawl.
// All state is plain JSON (persisted on profile.modes) and all logic is DOM-free.

import { makeRng } from "../engine/rng.js";
import { BRONZE_CARDS } from "../data/cards/bronze.js";
import { CUBE } from "../data/cube.js";

export const DRAFT_PICKS = 40;      // pick-1-of-3, 40 times -> 40-card deck
export const SEALED_PACKS = 6;      // 6 packs x 6 cards = 36, trim to 30
export const SEALED_PACK_SIZE = 6;
export const SEALED_DECK_SIZE = 30;
export const GAUNTLET_ROUNDS = 3;   // arena-style: play up to 3 escalating duels
export const MAX_COPIES = 3;

/* ------------------------------ DRAFT ------------------------------ */
// Arena-style draft: 40 rounds of pick-1-of-3 (weighted by rarity), max 3 copies.
const RARITY_W = [["N", 0.55], ["R", 0.30], ["SR", 0.12], ["UR", 0.03]];
const CUBE_W = [["N", 0.30], ["R", 0.34], ["SR", 0.24], ["UR", 0.12]]; // bombs show up in the cube

export function newDraft(seed, { cube = false } = {}) {
  return {
    kind: cube ? "cube" : "draft",
    seed: seed >>> 0,
    calls: 0,
    picks: [],
    choices: null,          // current [id, id, id]
    cube,
    wins: 0,
    round: 0,               // gauntlet round (0..2)
    over: false,
    claimed: false
  };
}

function draftRng(state) {
  return makeRng((state.seed ^ (0x9e3779b9 + state.calls++ * 0x85ebca6b)) >>> 0);
}

export function draftPool(state) {
  return state.cube ? CUBE : BRONZE_CARDS;
}

export function rollDraftChoices(state) {
  const rng = draftRng(state);
  const pool = draftPool(state);
  const weights = state.cube ? CUBE_W : RARITY_W;
  const counts = {};
  for (const id of state.picks) counts[id] = (counts[id] || 0) + 1;
  const out = [];
  let guard = 200;
  while (out.length < 3 && guard-- > 0) {
    const roll = rng.next();
    let acc = 0, rarity = "N";
    for (const [r, w] of weights) { acc += w; if (roll < acc) { rarity = r; break; } }
    const bucket = pool.filter((d) => d.rarity === rarity && (counts[d.id] || 0) < MAX_COPIES);
    const pick = bucket.length ? rng.pick(bucket) : null;
    if (pick && !out.includes(pick.id)) out.push(pick.id);
  }
  state.choices = out;
  return out;
}

export function draftPick(state, cardId) {
  if (!state.choices?.includes(cardId) || state.picks.length >= DRAFT_PICKS) return false;
  state.picks.push(cardId);
  state.choices = null;
  if (state.picks.length < DRAFT_PICKS) rollDraftChoices(state);
  return true;
}

export const draftDone = (state) => state.picks.length >= DRAFT_PICKS;
export const draftDeck = (state) => state.picks.slice();

/* ------------------------------ SEALED ----------------------------- */
export function newSealed(seed, poolDefs = BRONZE_CARDS) {
  const rng = makeRng(seed >>> 0);
  const cards = [];
  for (let p = 0; p < SEALED_PACKS; p++) {
    const pack = [];
    while (pack.length < SEALED_PACK_SIZE) {
      const roll = rng.next();
      let acc = 0, rarity = "N";
      for (const [r, w] of RARITY_W) { acc += w; if (roll < acc) { rarity = r; break; } }
      const bucket = poolDefs.filter((d) => d.rarity === rarity);
      pack.push(rng.pick(bucket.length ? bucket : poolDefs).id);
    }
    cards.push(...pack);
  }
  return { kind: "sealed", seed: seed >>> 0, pool: cards, deck: null, wins: 0, round: 0, over: false, claimed: false };
}

export function sealedDeckValid(state, deckIds) {
  if (deckIds.length !== SEALED_DECK_SIZE) return `Deck must be exactly ${SEALED_DECK_SIZE} cards (${deckIds.length}/${SEALED_DECK_SIZE})`;
  const have = {}, use = {};
  for (const id of state.pool) have[id] = (have[id] || 0) + 1;
  for (const id of deckIds) {
    use[id] = (use[id] || 0) + 1;
    if (use[id] > (have[id] || 0)) return `Your sealed pool has no extra copies of ${id}`;
    if (use[id] > MAX_COPIES) return `Max ${MAX_COPIES} copies of ${id}`;
  }
  return null;
}

/* ---------------------------- GAUNTLET ----------------------------- */
// shared by draft/cube/sealed: 3 escalating duels, rewards by wins
export const GAUNTLET_FOE_LP = [0, 4, 8];
export const GAUNTLET_REWARDS = [
  { wins: 0, gems: 10, packs: 0 },
  { wins: 1, gems: 30, packs: 0 },
  { wins: 2, gems: 60, packs: 1 },
  { wins: 3, gems: 120, packs: 2 }
];

export function gauntletResult(state, won) {
  if (state.over) return null;
  if (won) state.wins++;
  state.round++;
  if (state.round >= GAUNTLET_ROUNDS) state.over = true;
  return { wins: state.wins, over: state.over };
}

export function gauntletRewards(state) {
  if (!state.over || state.claimed) return null;
  state.claimed = true;
  return GAUNTLET_REWARDS[Math.min(state.wins, GAUNTLET_REWARDS.length - 1)];
}

/* ---------------------------- HIGHLANDER --------------------------- */
export function isHighlander(deckIds) {
  return new Set(deckIds).size === deckIds.length;
}

// dedupe a deck, then refill to 40 with singletons drawn from the pool
export function highlanderize(deckIds, poolDefs = BRONZE_CARDS, rng = makeRng(1)) {
  const seen = new Set();
  const out = [];
  for (const id of deckIds) {
    if (!seen.has(id)) { seen.add(id); out.push(id); }
  }
  const filler = rng.shuffle(poolDefs.filter((d) => !seen.has(d.id)).map((d) => d.id));
  while (out.length < 40 && filler.length) out.push(filler.pop());
  return out;
}

/* ---------------------------- TOURNAMENT --------------------------- */
export const TOURNEY_ROUNDS = ["QUARTERFINAL", "SEMIFINAL", "FINAL"];
export const TOURNEY_REWARDS = [
  { gems: 20, packs: 0 },   // out in QF
  { gems: 45, packs: 0 },   // out in SF
  { gems: 80, packs: 1 },   // finalist
  { gems: 150, packs: 2 }   // champion
];

export function newTourney(seed, deckIds, extra = []) {
  return { kind: "tourney", seed: seed >>> 0, deck: deckIds.slice(), extra: extra.slice(), round: 0, alive: true, champion: false, claimed: false };
}

export function tourneyResult(state, won) {
  if (!state.alive) return null;
  if (won) {
    state.round++;
    if (state.round >= TOURNEY_ROUNDS.length) { state.champion = true; state.alive = false; }
  } else {
    state.alive = false;
  }
  return { round: state.round, alive: state.alive, champion: state.champion };
}

export function tourneyRewards(state) {
  if (state.alive || state.claimed) return null;
  state.claimed = true;
  return TOURNEY_REWARDS[state.champion ? 3 : state.round];
}

/* ---------------------------- TAVERN BRAWL ------------------------- */
// Weekly rotating rule modifiers. apply(G) mutates a fresh duel state.
export const BRAWLS = [
  {
    id: "mana_surge", name: "EP SURGE", icon: "⚡",
    desc: "Both duelists start with +1 Evolution Point.",
    apply(G) { for (const p of G.players) p.ep += 1; }
  },
  {
    id: "sudden_death", name: "SUDDEN DEATH", icon: "💀",
    desc: "Only 10 LP. Every chain matters twice.",
    apply(G) { for (const p of G.players) p.lp = 10; }
  },
  {
    id: "deep_pockets", name: "DEEP POCKETS", icon: "🃏",
    desc: "Both duelists open with 3 extra cards.",
    apply(G, { drawCards }) { for (const p of [0, 1]) drawCards(G, p, 3); }
  },
  {
    id: "evolutionary_war", name: "EVOLUTIONARY WAR", icon: "🧬",
    desc: "Evolution is unlocked from turn 1 and everyone holds 4 EP.",
    apply(G) { for (const p of G.players) { p.ep = 4; p.evolveTurn = 1; } }
  },
  {
    id: "landslide", name: "LANDSLIDE", icon: "🌋",
    desc: "All three field lanes are revealed from the first turn.",
    apply(G) { for (const l of G.lanes) l.revealed = true; }
  },
  {
    id: "counter_culture", name: "COUNTER CULTURE", icon: "⛓",
    desc: "Three extra Counter spells are shuffled into every deck.",
    apply(G, { addToDeck }) {
      for (const p of [0, 1]) {
        for (let i = 0; i < 3; i++) addToDeck(p, "null_seal");
        G.rng.shuffle(G.players[p].deck);
      }
    }
  }
];

// ISO-ish week key: year * 100 + week number
export function weekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return d.getUTCFullYear() * 100 + week;
}

export function brawlForWeek(date = new Date()) {
  return BRAWLS[weekKey(date) % BRAWLS.length];
}

export const BRAWL_WIN_REWARD = { gems: 60, packs: 1 };

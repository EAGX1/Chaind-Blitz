// Combo circuits: which cards FEED a verb and which cards PAY OFF on it.
//
// The tags are derived from what a card actually does — its trigger matchers,
// its spell body, its keywords — not from a hand-written pairing list. That way
// every card in the pool gets partners, including the older sets, and new cards
// join the web the moment they are printed.

import { ALL_CARDS, CARD_DB } from "./cards/index.js";

export const CIRCUITS = {
  SPELL: { id: "SPELL", label: "Spellchain", blurb: "You activate a spell", color: "#f5c542" },
  SUMMON: { id: "SUMMON", label: "Muster", blurb: "A monster reaches the field", color: "#39d0c8" },
  DRAW: { id: "DRAW", label: "Overdraw", blurb: "You draw outside your Draw Phase", color: "#c084fc" },
  DISCARD: { id: "DISCARD", label: "Pitch", blurb: "A card leaves your hand", color: "#fb923c" },
  DEATH: { id: "DEATH", label: "Harvest", blurb: "A monster reaches the graveyard", color: "#f87171" },
  BANISH: { id: "BANISH", label: "Exile", blurb: "A card is banished", color: "#7a9cff" }
};

export const CIRCUIT_IDS = Object.keys(CIRCUITS);

export function circuitClass(id) {
  return id ? `circuit-${String(id).toLowerCase()}` : "";
}

/** Hand-set circuits for cards whose text does not spell the verb out. */
const OVERRIDES = {
  // enablers whose wording hides the verb
  scroll_greed: { enables: ["SPELL", "DRAW"] },
  mind_surge: { enables: ["SPELL", "DRAW", "DISCARD"] },
  call_fallen: { enables: ["SPELL", "SUMMON"] },
  doomblade_novice: { enables: ["DEATH"] },
  jestling: { enables: ["SUMMON"], pays: ["DEATH"] },
  scav_wisp: { pays: ["DEATH"] },
  mawling: { pays: ["DEATH"] },
  grinning_echo: { pays: ["DISCARD"] },
  void_pilgrim: { enables: ["BANISH"] },
  star_banish: { enables: ["SPELL", "BANISH"] },
  ash_drifter: { pays: ["BANISH"] },
  ash_prophet: { pays: ["SPELL"] },
  ember_twin: { pays: ["SPELL"] },
  tithe_owl: { pays: ["SUMMON"] },
  flood_verdict: { pays: ["SUMMON"] },
  wolf_alpha: { pays: ["DEATH"] },
  seed_sage: { pays: ["DEATH"] },
  pyro_hydra: { pays: ["DEATH"] },
  silver_discard_wraith: { pays: ["DISCARD"] },
  hollow_tax: { pays: ["DEATH"] },
  fusion_deep_hollow: { pays: ["DEATH"] }
};

const TEXT_ENABLES = [
  [/\bdraw \d|\bdraw 1\b|draws? a card/i, "DRAW"],
  [/\bdiscard\b/i, "DISCARD"],
  [/\bbanish\b/i, "BANISH"],
  [/special summon|summon a|summon two|Recruit Token|Stonewall Token/i, "SUMMON"],
  [/send .*to the gy|destroy all|destroy 1|tribute/i, "DEATH"]
];

function baseTags(def) {
  const enables = new Set();
  const pays = new Set();
  if (!def) return { enables, pays };

  // Any spell you cast feeds the spell circuit.
  if (def.type === "spell") enables.add("SPELL");
  // Any monster you play feeds the muster circuit.
  if (def.type === "monster") enables.add("SUMMON");

  const text = String(def.text || "");
  for (const [re, id] of TEXT_ENABLES) {
    if (re.test(text)) enables.add(id);
  }
  // Monsters that die feed the harvest circuit for their controller.
  if (def.type === "monster") enables.add("DEATH");

  const ov = OVERRIDES[def.id];
  if (ov) {
    for (const id of ov.enables || []) enables.add(id);
    for (const id of ov.pays || []) pays.add(id);
  }
  return { enables, pays };
}

/** Trigger matchers are the honest signal for payoffs — read them by id. */
const TRIGGER_PAYS = [
  [/spell/i, "SPELL"],
  [/summon|drum|muster|toll/i, "SUMMON"],
  [/draw|refill|dig/i, "DRAW"],
  [/discard|pitch|wisp_refill/i, "DISCARD"],
  [/died|death|ledger_grow|bell_ping|harvest/i, "DEATH"],
  [/banish|exile|rift|void_ledger|warden_ping/i, "BANISH"]
];

function payoffTags(def) {
  const pays = new Set();
  if (!def) return pays;
  const trigs = def.triggers || [];
  for (const t of trigs) {
    const probe = `${t.id || ""} ${t.text || ""}`;
    // The matcher source is the ground truth for what the trigger listens to.
    const src = typeof t.match === "function" ? t.match.toString() : "";
    if (/spellActivated|evOwnSpell/.test(src) || /activate a spell/i.test(probe)) pays.add("SPELL");
    if (/normalSummon|specialSummon|evSelfSummon|evOtherSummon/.test(src)) {
      // Fanfares fire off your own summon: that is a payoff for the muster circuit
      // only when it watches OTHER monsters, otherwise it is just an ETB.
      if (/evOtherSummon|ev\.card !== card/.test(src)) pays.add("SUMMON");
    }
    if (/"draw"|'draw'|evDrawn/.test(src)) pays.add("DRAW");
    if (/discard|costDiscard|evDiscarded|evAnyDiscard/.test(src)) pays.add("DISCARD");
    if (/battleDestroy|destroyed|evSentFromField|evSentAnywhere|evAnyMonsterDied|evFriendlyDied|evFriendlyBattleDestroy|evEnemyBattleDestroy/.test(src)) pays.add("DEATH");
    if (/banished|evAnyBanish/.test(src)) pays.add("BANISH");
    if (!src) {
      for (const [re, id] of TRIGGER_PAYS) if (re.test(probe)) pays.add(id);
    }
  }
  return pays;
}

let CACHE = null;

function build() {
  const map = new Map();
  for (const def of ALL_CARDS) {
    const { enables, pays } = baseTags(def);
    for (const id of payoffTags(def)) pays.add(id);
    // A card never counts as its own partner through a circuit it only feeds.
    map.set(def.id, {
      id: def.id,
      enables: [...enables].filter((c) => CIRCUIT_IDS.includes(c)),
      pays: [...pays].filter((c) => CIRCUIT_IDS.includes(c))
    });
  }
  return map;
}

function index() {
  if (!CACHE) CACHE = build();
  return CACHE;
}

/** `{ enables: string[], pays: string[] }` for one card id. */
export function comboTagsFor(id) {
  return index().get(id) || { id, enables: [], pays: [] };
}

/** Cards that pay off on at least one circuit — the ones worth building around. */
export function isComboPayoff(id) {
  return comboTagsFor(id).pays.length > 0;
}

/**
 * Partners for a card, best first.
 * @returns {{ id: string, name: string, def: object, circuit: string, why: string }[]}
 */
export function comboPartnersFor(def, { limit = 10, pool = null } = {}) {
  if (!def) return [];
  const me = comboTagsFor(def.id);
  const ids = pool || ALL_CARDS.map((c) => c.id);
  const out = [];
  const seen = new Set([def.id]);
  for (const id of ids) {
    if (seen.has(id)) continue;
    const other = comboTagsFor(id);
    const d = CARD_DB[id];
    if (!d) continue;
    // I pay off on a circuit they feed…
    const iPay = me.pays.find((c) => other.enables.includes(c));
    // …or they pay off on a circuit I feed.
    const theyPay = other.pays.find((c) => me.enables.includes(c));
    const circuit = iPay || theyPay;
    if (!circuit) continue;
    seen.add(id);
    const why = iPay
      ? `${d.name} feeds ${CIRCUITS[circuit].label} — ${def.name} pays off`
      : `${def.name} feeds ${CIRCUITS[circuit].label} — ${d.name} pays off`;
    // Payoff-to-payoff pairs are the interesting ones; rank them first.
    const rank = (other.pays.length ? 0 : 1) + (d.archetypes?.includes("combo_core") ? 0 : 1);
    out.push({ id, name: d.name, def: d, circuit, why, rank });
  }
  out.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  return out.slice(0, limit).map(({ rank, ...rest }) => rest);
}

/**
 * Circuit health for a deck list: how much it feeds vs pays off on each verb.
 * @returns {{ circuit: string, label: string, enablers: number, payoffs: number, live: boolean }[]}
 */
export function deckCircuits(ids = []) {
  const counts = Object.fromEntries(CIRCUIT_IDS.map((c) => [c, { enablers: 0, payoffs: 0 }]));
  for (const id of ids) {
    const t = comboTagsFor(id);
    for (const c of t.enables) if (counts[c]) counts[c].enablers++;
    for (const c of t.pays) if (counts[c]) counts[c].payoffs++;
  }
  return CIRCUIT_IDS.map((c) => ({
    circuit: c,
    label: CIRCUITS[c].label,
    blurb: CIRCUITS[c].blurb,
    enablers: counts[c].enablers,
    payoffs: counts[c].payoffs,
    live: counts[c].payoffs > 0 && counts[c].enablers >= 3
  }));
}

/**
 * Glue cards a list is missing: payoffs for fed-but-dead circuits, or extra
 * feeds for a payoff that only has 1–2 enablers.
 */
export function suggestedGlueForDeck(ids = [], { limit = 6 } = {}) {
  const have = new Set(ids);
  const rows = deckCircuits(ids);
  const scores = new Map();
  for (const row of rows) {
    if (row.live) continue;
    const wantPays = row.payoffs === 0 && row.enablers > 0;
    const wantFeeds = row.payoffs > 0 && row.enablers < 3;
    if (!wantPays && !wantFeeds) continue;
    for (const def of ALL_CARDS) {
      if (have.has(def.id)) continue;
      const t = comboTagsFor(def.id);
      const hit = wantPays ? t.pays.includes(row.circuit) : t.enables.includes(row.circuit);
      if (!hit) continue;
      const prev = scores.get(def.id) || { id: def.id, name: def.name, def, circuit: row.circuit, why: "", score: 0 };
      prev.score += wantPays ? 3 : 1;
      if (def.archetypes?.includes("combo_core")) prev.score += 2;
      prev.circuit = row.circuit;
      prev.why = wantPays
        ? `You feed ${row.label} ${row.enablers}× with no payoff — ${def.name} pays it`
        : `You pay ${row.label} but only feed it ${row.enablers}× — ${def.name} feeds it`;
      scores.set(def.id, prev);
    }
  }
  return [...scores.values()]
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(({ score, ...rest }) => rest);
}

/** One-line verdict for the deck editor. */
export function deckComboLine(ids = []) {
  const circuits = deckCircuits(ids);
  const live = circuits.filter((c) => c.live);
  if (!live.length) {
    const best = circuits.slice().sort((a, b) => b.enablers - a.enablers)[0];
    return best
      ? `No live combo circuit yet — you feed ${best.label} ${best.enablers}× but run no payoff for it.`
      : "No combo circuits yet.";
  }
  const names = live.map((c) => `${c.label} (${c.payoffs} payoff${c.payoffs === 1 ? "" : "s"} on ${c.enablers} feeds)`);
  return `Live: ${names.join(" · ")}`;
}

/** Reset the derived index — tests that mutate the pool call this. */
export function _resetComboIndex() {
  CACHE = null;
}

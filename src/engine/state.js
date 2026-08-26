// Game state, card instances, zone queries and stat calculation.
// Pure logic: no DOM, no timers. All randomness flows through G.rng.

export const YOU = 0, AI = 1;
export const opp = (p) => 1 - p;

export const PHASES = ["DP", "SP", "M1", "BP", "M2", "EP"];

let UID = 1;
export function resetUid() { UID = 1; }
export function setUid(n) { UID = Math.max(1, n | 0); }
export function peekUid() { return UID; }

/** Map legacy `cost` onto YGO levels. Explicit `def.level` wins. */
export function monsterLevel(def) {
  if (!def || def.type !== "monster") return 0;
  if (def.level != null) return def.level;
  const c = def.cost || 1;
  if (c <= 2) return 4;
  if (c === 3) return 5;
  if (c === 4) return 6;
  return Math.min(12, 3 + c);
}

/** LV4: 0 tributes. LV5–6: 1. LV7+: 2. */
export function tributesNeeded(def) {
  const lv = monsterLevel(def);
  if (lv >= 7) return 2;
  if (lv >= 5) return 1;
  return 0;
}

export function makeCard(id, def, owner) {
  return {
    uid: UID++, id, def, owner, controller: owner,
    loc: "deck", zone: -1,
    faceup: false,            // face-down when set in a spell zone
    setTurn: 0,               // turn it was set (set cards locked that turn)
    summonedTurn: 0,
    evolved: false,
    atkMod: 0, defMod: 0,     // permanent modifiers
    tempAtk: 0, tempDef: 0, tempTurn: 0, // this-turn modifiers
    rushGranted: false,
    wardGranted: false,
    negated: false,           // effect negated (continuous suppression)
    dmg: 0,                   // persistent damage (Shadowverse combat model)
    attacksUsed: 0,
    _queued: false            // already queued a trigger this window
  };
}

export function newGame({ seed = 1, decks, laneDefs, meta = {} } = {}) {
  resetUid();
  const { makeRng } = rngDeps;
  const rng = makeRng(seed);
  const G = {
    rng, seed, meta,
    players: [0, 1].map((i) => ({
      lp: 20,
      ep: i === 0 ? 2 : 3,    // placeholder; assigned properly at setup once first player known
      hand: [], deck: [], extra: [], gy: [], ban: [],
      mz: [null, null, null, null, null, null],
      stz: [null, null, null, null, null, null],
      normalSummoned: false,
      ownTurnCount: 0,
      evolveUsedThisTurn: false,
      contactOpt: {},
      comebackUsed: false,
      comebackPending: null, // null | "draw" | "evolve" awaiting choice
      freeEvolvePending: false,
      bonusDrawNextTurn: 0,
      mulliganDone: false
    })),
    tp: 0, firstPlayer: 0, turnCount: 1,
    phase: "DP", battleStep: null,
    chain: [], resolving: false,
    events: [], eventsCheckedIdx: 0, lastThings: [],
    lanes: laneDefs.map((def, i) => ({ def, revealed: i === 0, index: i })),
    pendingTriggers: [],
    summonNegCtx: null, attackCtx: null,
    over: false, winner: null, winReason: "",
    log: [], io: null,
    stats: { turns: 0, chainsResolved: 0, evolutions: 0, fusions: 0, negates: 0 }
  };
  return G;
}

// rng is imported lazily to keep newGame's signature clean for tests
import { makeRng } from "./rng.js";
const rngDeps = { makeRng };

export const P = (G, p) => G.players[p];

export function log(G, msg, cls = "") {
  G.log.push({ msg, cls, t: G.turnCount, phase: G.phase });
  G.io?.onLog?.(msg, cls);
}

/* ---------------- zone queries ---------------- */
/** Face-up auras, negated cards, and revealed lanes currently rewriting the board. */
export function lingeringEffects(G) {
  const rows = [];
  for (const lane of G.lanes || []) {
    if (!lane.revealed || !lane.def) continue;
    rows.push({
      id: `lane-${lane.index}`,
      kind: "lane",
      name: `Lane ${lane.index + 1}: ${lane.def.name}`,
      text: lane.def.text || ""
    });
  }
  for (let p = 0; p < 2; p++) {
    const who = p === 0 ? "You" : "Foe";
    const pl = P(G, p);
    for (const c of pl.stz) {
      if (!c?.faceup) continue;
      if (c.def?.spell?.subtype === "continuous" || c.def?.spell?.ongoing || c.def?.continuous) {
        rows.push({ id: `stz-${c.uid}`, kind: "aura", name: `${who}: ${c.def.name}`, text: c.def.text || "Continuous." });
      }
    }
    for (const c of pl.mz) {
      if (!c) continue;
      if (c.negated) {
        rows.push({ id: `neg-${c.uid}`, kind: "negated", name: `${who}: ${c.def.name}`, text: "Negated — its effect is suppressed." });
      } else if (c.faceup && (c.def?.continuous || c.def?.spell?.ongoing)) {
        rows.push({ id: `mz-${c.uid}`, kind: "aura", name: `${who}: ${c.def.name}`, text: c.def.text || "Continuous." });
      }
    }
  }
  return rows;
}

export function allFieldCards(G) {
  const out = [];
  for (let p = 0; p < 2; p++) {
    for (const c of P(G, p).mz) if (c) out.push(c);
    for (const c of P(G, p).stz) if (c) out.push(c);
  }
  return out;
}
export const monstersOf = (G, p) => P(G, p).mz.filter(Boolean);
export function firstFreeMZ(G, p) { return P(G, p).mz.findIndex((z) => !z); }
export function firstFreeSTZ(G, p) { return P(G, p).stz.findIndex((z) => !z); }
export function findCard(G, uid) {
  for (let p = 0; p < 2; p++) {
    const pl = P(G, p);
    const found = pl.mz.find((c) => c && c.uid === uid) || pl.stz.find((c) => c && c.uid === uid)
      || pl.hand.find((c) => c.uid === uid) || pl.gy.find((c) => c.uid === uid)
      || pl.ban.find((c) => c.uid === uid) || pl.deck.find((c) => c.uid === uid);
    if (found) return found;
  }
  return null;
}
export function laneForZone(zoneIdx) {
  if (zoneIdx === 0 || zoneIdx === 1) return 0;
  if (zoneIdx === 2 || zoneIdx === 3) return 1;
  return 2;
}

/* ---------------- stat calculation ----------------
   Shadowverse-scale integers. Order: base + permanent mods + evolve (+2/+2)
   + this-turn mods, then revealed Field Lane modifiers and continuous effects
   from face-up monsters / continuous spells. Floored at 0. */
export function getATK(G, card) {
  if (!card?.def) return 0;
  let v = card.def.atk || 0;
  v += card.atkMod + (card.evolved ? 2 : 0);
  if (card.tempTurn === G.turnCount) v += card.tempAtk;
  v = applyStatMods(G, card, v, "atk");
  return Math.max(0, v);
}
export function getDEF(G, card) {
  if (!card?.def) return 0;
  let v = card.def.def || 0;
  v += card.defMod + (card.evolved ? 2 : 0);
  if (card.tempTurn === G.turnCount) v += card.tempDef;
  v = applyStatMods(G, card, v, "def");
  return Math.max(0, v);
}
// A monster is destroyed when its persistent damage >= its current DEF.
export function remainingHealth(G, card) { return getDEF(G, card) - card.dmg; }
export function isDestroyedByDamage(G, card) { return remainingHealth(G, card) <= 0; }

/**
 * Combat uses ATK vs ATK: each monster deals its ATK as damage to remaining DEF.
 * Direct attacks deal ATK to LP. Used by the attack-confirm UI (not a search).
 */
export function previewCombat(G, attacker, target = null) {
  const aAtk = getATK(G, attacker);
  if (!target) {
    const foe = P(G, opp(attacker.controller));
    const lethal = aAtk >= foe.lp;
    return {
      kind: "direct",
      aAtk,
      face: aAtk,
      lethal,
      theyDie: false,
      youDie: false,
      line: lethal
        ? `Direct ${aAtk} — LETHAL (${foe.lp} LP)`
        : `Direct ${aAtk} — foe ${foe.lp} → ${Math.max(0, foe.lp - aAtk)} LP`
    };
  }
  const dAtk = getATK(G, target);
  const aHp = remainingHealth(G, attacker);
  const dHp = remainingHealth(G, target);
  const theyDie = aAtk >= dHp;
  const youDie = dAtk >= aHp;
  let outcome = "both live";
  if (theyDie && youDie) outcome = "both die";
  else if (theyDie) outcome = "they die";
  else if (youDie) outcome = "you die";
  return {
    kind: "battle",
    aAtk,
    dAtk,
    aHp,
    dHp,
    theyDie,
    youDie,
    lethal: false,
    line: `${aAtk} vs ${dAtk} — ${outcome}`
  };
}
function applyStatMods(G, card, v, stat) {
  // Field lanes
  if (card.loc === "mz") {
    const lane = G.lanes[laneForZone(card.zone)];
    if (lane?.revealed && lane.def.modifyStat) {
      v = lane.def.modifyStat(G, lane, card, v, stat);
    }
  }
  // Continuous effects from face-up field cards (monster auras + spell auras)
  for (const c of allFieldCards(G)) {
    if (!c.faceup || c.negated) continue;
    if (c.def.continuous?.modifyStat) v = c.def.continuous.modifyStat(G, c, card, v, stat);
    if (c.def.spell?.ongoing) v = c.def.spell.ongoing(G, c, card, v, stat);
  }
  return v;
}

/* ---------------- sickness / attack legality ---------------- */
export function hasSummoningSickness(G, card) {
  if (card.summonedTurn !== G.turnCount) return false;
  if (card.def.keywords?.includes("rush")) return false;
  return !card.rushGranted;
}
export function hasKeyword(card, kw) {
  return !!(card?.def?.keywords?.includes(kw)
    || (kw === "rush" && card?.rushGranted)
    || (kw === "ward" && card?.wardGranted));
}

/** Yu-Gi-Oh: the player who goes first cannot attack on their first turn. */
export function isFirstTurnNoBattle(G) {
  if (G.meta?.allowFirstTurnBattle) return false;
  return G.turnCount === 1 && G.tp === G.firstPlayer;
}

export function cannotAttackReason(G, card) {
  if (!card || card.loc !== "mz") return "Not on the field.";
  if (!card.faceup) return "Face-down monsters cannot declare attacks.";
  if (isFirstTurnNoBattle(G)) return "The player who goes first cannot attack on their first turn.";
  if (card.attacksUsed >= 1) return "Already attacked this turn.";
  if (hasSummoningSickness(G, card)) {
    return "Summoning sickness — cannot attack the turn it was summoned (unless Rush).";
  }
  if (card.cannotAttackTurn === G.turnCount) return "An effect prevents this monster from attacking this turn.";
  const lane = G.lanes?.[laneForZone(card.zone)];
  if (lane?.revealed && lane.def.noAttack) {
    return `${lane.def.name} — monsters in this lane cannot attack.`;
  }
  if (getATK(G, card) <= 0) return "ATK is 0 — cannot declare an attack.";
  return null;
}

export function canAttack(G, card) {
  return cannotAttackReason(G, card) == null;
}

/** Master Duel-style status icons for the card face (negated / set-locked / sick). */
export function cardStatusBadges(G, card) {
  const badges = [];
  if (!G || !card) return badges;
  if (card.negated) {
    badges.push({ id: "negated", label: "NEG", title: "Negated — its effect is suppressed." });
  }
  const setLocked = !card.faceup && (
    (card.loc === "stz" && card.setTurn === G.turnCount)
    || (card.loc === "mz" && card.faceDownMz && card.summonedTurn === G.turnCount)
  );
  if (setLocked) {
    badges.push({ id: "locked", label: "SET", title: "Set this turn — cannot activate yet." });
  }
  if (card.loc === "mz" && card.faceup) {
    if (hasSummoningSickness(G, card)) {
      badges.push({
        id: "sickness",
        label: "SICK",
        title: "Summoning sickness — cannot attack the turn it was summoned (unless Rush)."
      });
    } else if (card.attacksUsed >= 1) {
      badges.push({ id: "noatk", label: "NO ATK", title: "Already attacked this turn." });
    } else if (card.cannotAttackTurn === G.turnCount) {
      badges.push({ id: "noatk", label: "NO ATK", title: "An effect prevents this monster from attacking this turn." });
    }
  }
  return badges;
}

/** Enemy must attack Ward monsters if any Ward is present (cannot direct / snipe past). */
export function wardBlockers(G, defendingPlayer) {
  return monstersOf(G, defendingPlayer).filter(
    (m) => m.faceup && hasKeyword(m, "ward") && !m.negated
  );
}

export function canEvolveNow(G, p) {
  const pl = P(G, p);
  const epOk = pl.freeEvolvePending || pl.ep > 0;
  return epOk && pl.ownTurnCount >= (pl.evolveTurn ?? 3) && !pl.evolveUsedThisTurn;
}

/* ---------------- events ----------------
   Every game occurrence is appended to G.events. "lastThings" is the batch of
   events that happened last (simultaneously) — the yardstick for optional
   "when... you can" triggers (missing the timing). */
export function pushEvents(G, batch) {
  for (const ev of batch) G.events.push(ev);
  G.lastThings = batch;
}

/** Lane onSummon runs after the summon's own trigger window so Fanfares do not miss. */
export function queueLaneSummon(G, card) {
  if (!card) return;
  (G._pendingLaneSummons ||= []).push(card);
}

export function flushLaneSummons(G) {
  const pending = G._pendingLaneSummons;
  if (!pending?.length) return false;
  G._pendingLaneSummons = [];
  const before = G.events.length;
  for (const c of pending) {
    if (c.loc === "mz") G.hooks?.onSummon?.(c);
  }
  return G.events.length > before;
}
export function newEvents(G) {
  return G.events.slice(G.eventsCheckedIdx);
}
export function markEventsChecked(G) {
  G.eventsCheckedIdx = G.events.length;
}

export function cardByUid(G, uid) {
  if (uid == null) return null;
  for (const pl of G.players) {
    for (const loc of ["hand", "deck", "extra", "gy", "ban"]) {
      const hit = (pl[loc] || []).find((c) => c && c.uid === uid);
      if (hit) return hit;
    }
    for (const z of [...pl.mz, ...pl.stz]) if (z?.uid === uid) return z;
  }
  return null;
}

/* ---------------- player helpers ---------------- */
export function pname(p) { return p === YOU ? "You" : "AI"; }

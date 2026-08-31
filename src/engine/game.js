// Game orchestrator: duel setup, turn loop (DP SP M1 BP M2 EP), main-phase
// action loop, Yu-Gi-Oh Battle Phase windows, evolution, Field Lane
// reveals, hand limit, win conditions.

import {
  P, opp, log, pushEvents, makeCard, monstersOf, canAttack, getATK,
  canEvolveNow, wardBlockers, queueLaneSummon, allFieldCards,
  tributesNeeded, isFirstTurnNoBattle, monsterLevel
} from "./state.js";
import {
  drawCards, dealDamageToPlayer, damageMonster, sweepDestroyed, sendToGY,
  placeMonster, setSpell, chooseTargets, legalTargets, discardCard,
  applyComebackChoice, bounceToHand
} from "./ops.js";
import {
  checkAndRespond, summonNegationWindow, performActivation,
  responseWindow, resolveChain, quickUsable, legalFastEffects
} from "./chain.js";
import { clearTriggerFlags } from "./triggers.js";
import { legalContactFusions, contactFusionSummon } from "./fusion.js";
import { serializeGame, applySnapshot } from "./snapshot.js";

/* ================= setup ================= */

export function setupDuel(G, { decks, extras = [[], []], firstPlayer }) {
  G.firstPlayer = firstPlayer;
  G.tp = firstPlayer;
  G.hooks = {
    onSummon: (card) => {
      for (const lane of G.lanes) {
        if (!lane.revealed || !lane.def.onSummon) continue;
        if (card.zone === lane.index * 2 || card.zone === lane.index * 2 + 1) {
          lane.def.onSummon(G, lane, card);
        }
      }
    }
  };
  for (let p = 0; p < 2; p++) {
    const pl = P(G, p);
    pl.ep = p === firstPlayer ? 2 : 3;
    pl.deck = decks[p].map((id) => makeCard(id, G.cardDb[id], p));
    pl.extra = (extras[p] || []).map((id) => {
      const c = makeCard(id, G.cardDb[id], p);
      c.loc = "extra";
      return c;
    });
    if (!G.meta?.noShuffle) G.rng.shuffle(pl.deck);
    drawCards(G, p, 5);
  }
  applyLabsBoard(G);
  log(G, `Duel start — ${firstPlayer === 0 ? "you" : "AI"} go first (no attacks on that first turn). LP 20 each.`, "system");
}

/** Stacked Labs boards: extra copies placed after the opening draw (Lorcana-style teaching). */
function applyLabsBoard(G) {
  const specs = G.meta?.labsBoard;
  if (!Array.isArray(specs)) return;
  for (const spec of specs) {
    const def = G.cardDb?.[spec.id];
    if (!def) continue;
    const c = makeCard(spec.id, def, spec.p);
    const pl = P(G, spec.p);
    if (spec.loc === "stz") {
      const z = spec.zone ?? pl.stz.findIndex((x) => !x);
      if (z < 0) continue;
      c.loc = "stz";
      c.zone = z;
      c.faceup = spec.faceup === true;
      c.setTurn = spec.setTurn ?? 0;
      pl.stz[z] = c;
      continue;
    }
    if (spec.loc === "hand") {
      c.loc = "hand";
      pl.hand.push(c);
      continue;
    }
    placeMonster(G, c, spec.p, spec.zone ?? null);
    if (spec.summonedTurn != null) c.summonedTurn = spec.summonedTurn;
    if (spec.faceup === false) {
      c.faceup = false;
      c.faceDownMz = true;
    }
  }
}

export function labsGoalMet(G) {
  const kind = G.meta?.labs;
  if (!kind) return false;
  if (kind === "fanfare_lane") {
    return monstersOf(G, 0).some((m) => m.id === "heal_bloom" && (m.zone === 0 || m.zone === 1));
  }
  if (kind === "ward") {
    return G.events.some((e) => e.type === "attackDeclared" && e.player === 0 && e.target?.id === "ward_sentinel");
  }
  if (kind === "contact") {
    return (G.stats.fusions || 0) > 0;
  }
  if (kind === "counter") {
    return (G.stats.negates || 0) > 0;
  }
  if (kind === "ambush") {
    return G.events.some((e) => e.type === "ambushFlip");
  }
  if (kind === "tribute") {
    return G.events.some((e) => e.type === "normalSummon" && e.player === 0 && tributesNeeded(e.card?.def) > 0);
  }
  if (kind === "damage_step") {
    return G.events.some((e) => e.type === "sentToGY" && e.kind === "costDiscard" && e.card?.id === "surge_imp");
  }
  return false;
}

export function checkLabsGoal(G) {
  if (!G.meta?.labs || G.over) return false;
  // Battle-phase beats (Ward, Ambush, Damage Step) must not cut Main 2 short.
  if (G.phase === "BP") return false;
  if (!labsGoalMet(G)) return false;
  G.over = true;
  G.winner = 0;
  G.winReason = "Lab complete.";
  log(G, "Lab complete — teaching beat hit.", "gameover");
  return true;
}

/** Face-down Spell/Trap set this turn — public lock, not hidden info. */
export const LOCKED_SET_REASON = "Set this turn — arms next turn";

export function isLockedSetThisTurn(G, card) {
  return !!(card && card.loc === "stz" && !card.faceup && card.setTurn === G.turnCount);
}

/** Player-facing reason a hand card has no legal main-phase action. */
export function cannotPlayReason(G, p, card) {
  const d = card.def;
  const pl = P(G, p);
  if (d.type === "monster") {
    if (d.summon === "fusion") return "Fusion monsters are summoned from the Extra Deck.";
    if (pl.normalSummoned) return "Normal Summon already used this turn.";
    const trib = tributesNeeded(d);
    if (trib > 0 && monstersOf(G, p).length < trib) {
      return `${d.name} is Level ${monsterLevel(d)} — tribute ${trib} monster${trib > 1 ? "s" : ""} first.`;
    }
    if (trib === 0 && freeMz(G, p) < 0) {
      const lockLanes = (G.lanes || []).filter((l) => l.revealed && l.def?.locksZone);
      if (lockLanes.length) return `${lockLanes[0].def.name} locks a monster zone.`;
      return "No free monster zone.";
    }
    return "Cannot be summoned right now.";
  }
  const sp = d.spell;
  if (!sp) return "Cannot be activated right now.";
  if (sp.subtype === "counter") {
    if (freeStz(G, p) < 0) return "No free spell zone — Counters must be Set, then arm next turn.";
    return "Counter spells must be Set first — they arm from the next turn.";
  }
  if (freeStz(G, p) < 0 && (sp.subtype === "continuous" || sp.subtype === "quick")) {
    const lockLanes = (G.lanes || []).filter((l) => l.revealed && l.def?.locksSpellZone);
    if (lockLanes.length) return `${lockLanes[0].def.name} locks a spell zone.`;
    return "No free spell zone.";
  }
  if (sp.condition && !sp.condition(G, card, {})) return "Its activation condition is not met.";
  for (const spec of sp.targets || []) {
    if (spec.optional) continue;
    if (legalTargets(G, spec, { controller: card.controller, card }).length === 0) {
      return "No legal targets right now.";
    }
  }
  if (sp.subtype === "quick") {
    return "No legal targets — Quick-Plays from hand need a target, or a free zone to Set.";
  }
  return "Cannot be activated right now.";
}

/** Opening mulligan: each player may redraw once (selected cards shuffled back). */
export async function openingMulligan(G) {
  for (let p = 0; p < 2; p++) {
    const pl = P(G, p);
    if (pl.mulliganDone) continue;
    const choice = await G.io?.askMulligan?.(p, pl.hand);
    pl.mulliganDone = true;
    if (!choice || !choice.length) continue;
    const keep = [];
    const bounce = [];
    for (const c of pl.hand) {
      if (choice.includes(c.uid)) bounce.push(c);
      else keep.push(c);
    }
    pl.hand = keep;
    for (const c of bounce) {
      c.loc = "deck";
      pl.deck.push(c);
    }
    G.rng.shuffle(pl.deck);
    drawCards(G, p, bounce.length);
    log(G, `${p === 0 ? "You" : "AI"} mulligan ${bounce.length} card(s).`, "system");
  }
  G.io?.onMulliganDone?.();
}

/* ================= Field Lanes ================= */

export function lockedMzZones(G, p) {
  const out = [];
  for (const lane of G.lanes) {
    if (!lane.revealed || !lane.def.locksZone) continue;
    for (let z = 0; z < 6; z++) if (lane.def.locksZone(G, lane, p, z)) out.push(z);
  }
  return out;
}

export function freeMz(G, p) {
  const locked = lockedMzZones(G, p);
  const pl = P(G, p);
  for (let z = 0; z < 6; z++) if (!pl.mz[z] && !locked.includes(z)) return z;
  return -1;
}

export function lockedStzZones(G, p) {
  const out = [];
  for (const lane of G.lanes) {
    if (!lane.revealed || !lane.def.locksSpellZone) continue;
    for (let z = 0; z < 6; z++) if (lane.def.locksSpellZone(G, lane, p, z)) out.push(z);
  }
  return out;
}

export function freeStz(G, p) {
  const locked = lockedStzZones(G, p);
  const pl = P(G, p);
  for (let z = 0; z < 6; z++) if (!pl.stz[z] && !locked.includes(z)) return z;
  return -1;
}

export async function revealLanes(G) {
  for (const lane of G.lanes) {
    const due = lane.index === 0 ? 1 : lane.index === 1 ? 3 : 5;
    if (G.turnCount < due) continue;
    const justRevealed = !lane.revealed;
    if (justRevealed) {
      lane.revealed = true;
      log(G, `Field Lane ${lane.index + 1} reveals: ${lane.def.name} — ${lane.def.text}`, "lane");
      pushEvents(G, [{ type: "laneReveal", lane: lane.index }]);
    }
    if (lane.def.onReveal && !lane.onRevealDone) {
      lane.onRevealDone = true;
      await lane.def.onReveal(G, lane);
    }
    if (justRevealed) await G.io?.onLaneReveal?.(lane);
  }
  sweepDestroyed(G); // stat reductions from a fresh lane can be lethal
}

/* ================= main phase ================= */

export function legalMainActions(G, p) {
  const pl = P(G, p);
  const acts = [];
  const mzFree = freeMz(G, p) >= 0;
  const stzFree = freeStz(G, p) >= 0;

  const mats = monstersOf(G, p);
  for (const c of pl.hand) {
    const d = c.def;
    if (d.type === "monster") {
      const trib = tributesNeeded(d);
      // Tribute frees zones, so a full board can still Tribute Summon.
      const canPlace = trib > 0 ? mats.length >= trib : mzFree;
      if (!pl.normalSummoned && canPlace && !d.summon) {
        const verb = trib > 0 ? "Tribute Summon" : "Normal Summon";
        acts.push({ type: "summon", card: c, tributes: trib, label: trib > 0 ? `${verb} ${d.name} (${trib})` : `${verb} ${d.name}` });
      }
      if (d.keywords?.includes("ambush") && !pl.normalSummoned && canPlace) {
        acts.push({ type: "ambushSet", card: c, tributes: trib, label: `Ambush Set ${d.name}` });
      }
    } else if (d.type === "spell" && d.spell) {
      const sp = d.spell;
      const handTrap = !!(d.handTrap || sp.handTrap);
      if (sp.subtype === "normal" && spellActivatable(G, c, true)) {
        acts.push({ type: "activate", card: c, label: `Activate ${d.name}` });
      }
      if (sp.subtype === "continuous" && stzFree && spellActivatable(G, c, true)) {
        acts.push({ type: "activate", card: c, label: `Activate ${d.name}` });
      }
      // YGO: Quick-Play from hand on YOUR turn as CL1 (SS2). Hand traps stay
      // response-only — they are not a Main Phase "Activate".
      if (sp.subtype === "quick" && !handTrap && spellActivatable(G, c, true)) {
        acts.push({ type: "activate", card: c, label: `Activate ${d.name}` });
      }
      if (stzFree) {
        acts.push({ type: "set", card: c, label: `Set ${d.name}` });
      }
    }
  }
  // set continuous/quick spells may be activated (flip) in your open main phase
  for (const c of pl.stz) {
    if (!c || c.faceup || !c.def.spell || c.setTurn === G.turnCount) continue;
    if (c.def.spell.subtype === "continuous" && spellActivatable(G, c, false)) {
      acts.push({ type: "activateSet", card: c, label: `Activate ${c.def.name} (set)` });
    } else if (c.def.spell.subtype === "quick" && spellActivatable(G, c, false)) {
      acts.push({ type: "activateSet", card: c, label: `Activate ${c.def.name} (set quick)` });
    }
  }
  for (const c of pl.mz) {
    if (!c?.faceup) continue;
    if (c.def.ignition && !c.negated) {
      c._ignTurns ||= {};
      if (c._ignTurns.used !== G.turnCount && effectActivatable(G, c, c.def.ignition)) {
        acts.push({ type: "ignition", card: c, label: `${d0(c)} effect: ${c.def.ignition.text}` });
      }
    }
    if (c.def.quick && !c.negated && quickUsable(G, c) && effectActivatable(G, c, c.def.quick)) {
      acts.push({ type: "quick", card: c, label: `${d0(c)} Quick: ${c.def.quick.text}` });
    }
    if (canEvolveNow(G, p) && !c.evolved) {
      const free = P(G, p).freeEvolvePending;
      acts.push({
        type: "evolve",
        card: c,
        label: `Evolve ${d0(c)} (+2/+2, Rush) — ${free ? "FREE" : "1 EP"}`
      });
    }
  }
  // Contact Fusion from Extra (Special Summon — never consumes NS).
  // Materials leave first, so a full board can still fuse (same as Tribute).
  for (const opt of legalContactFusions(G, p)) {
    acts.push({
      type: "contactFusion",
      fusion: opt.fusion,
      materials: opt.materials,
      label: `Contact Fusion ${opt.fusion.def.name}`
    });
  }
  acts.push({ type: "end", label: `End ${G.phase}` });
  return acts;
}
const d0 = (c) => c.def.name;

function spellActivatable(G, card, _fromHand) {
  return effectActivatable(G, card, card.def.spell);
}

function effectActivatable(G, card, eff) {
  if (!eff) return false;
  if (typeof eff.cost?.can === "function" && !eff.cost.can(G, card)) return false;
  if (eff.condition && !eff.condition(G, card, {})) return false;
  for (const spec of eff.targets || []) {
    if (spec.optional) continue;
    if (legalTargets(G, spec, { controller: card.controller, card }).length === 0) return false;
  }
  return true;
}

async function performMainAction(G, act, p) {
  const card = act.card;
  switch (act.type) {
    case "summon": return normalSummon(G, card, act.zone ?? null, act.tributeUids);
    case "ambushSet": return ambushSet(G, card, act.zone ?? null, act.tributeUids);
    case "contactFusion":
      return contactFusionSummon(G, p, act.fusion, act.materials, act.zone ?? null);
    case "activate": return activateHandSpell(G, card, p, act.zone ?? null);
    case "set": {
      setSpell(G, card, p, act.zone ?? null);
      return;
    }
    case "activateSet": {
      // flip activation: SS1 for continuous, SS2 for quick (CL1 either way here)
      card.faceup = true;
      const link = await activateSpellLink(G, card, p);
      if (link) await finishSingleActivation(G, link, p);
      else card.faceup = false;
      return;
    }
    case "quick": {
      const link = await performActivation(G, { type: "quick", card, speed: 2 });
      if (link) await finishSingleActivation(G, link, p);
      return;
    }
    case "ignition": {
      const eff = card.def.ignition;
      if (!eff) return;
      const link = { card, controller: p, kind: "monsterEffect", speed: 1, def: eff, targets: [], negated: false, ev: null };
      if (eff.targets?.length) {
        const picked = await chooseTargets(G, p, eff.targets, { controller: p, card }, `${card.def.name}: choose target(s)`);
        if (picked === null) return;
        link.targets = picked;
      }
      if (eff.cost?.pay) {
        const paid = await eff.cost.pay(G, card, link);
        if (paid === false) return;
      }
      card._ignTurns ||= {};
      card._ignTurns.used = G.turnCount;
      log(G, `${p === 0 ? "You" : "AI"} activate ${card.def.name}'s effect.`, "chain");
      pushEvents(G, [{ type: "effectActivated", card, player: p }]);
      await finishSingleActivation(G, link, p);
      return;
    }
    case "evolve": return evolveMonster(G, card);
  }
}

/* Activate a spell from hand in open main phase (SS1 normal/continuous). */
export async function activateHandSpell(G, card, p, zone = null) {
  const sp = card.def.spell;
  if (sp.subtype === "continuous") {
    // moves straight into a spell zone, face-up
    const pl0 = P(G, p);
    const legal = zone != null && !pl0.stz[zone] && !lockedStzZones(G, p).includes(zone);
    const z = legal ? zone : freeStz(G, p);
    const pl = P(G, p);
    const i = pl.hand.indexOf(card);
    if (i >= 0) pl.hand.splice(i, 1);
    card.loc = "stz"; card.zone = z; card.faceup = true; card.controller = p;
    pl.stz[z] = card;
  } else {
    const pl = P(G, p);
    const i = pl.hand.indexOf(card);
    if (i >= 0) pl.hand.splice(i, 1);
    card.loc = "chain"; card.zone = -1; card.faceup = true;
  }
  const link = await activateSpellLink(G, card, p);
  if (link) {
    await finishSingleActivation(G, link, p);
    return;
  }
  // Targeting cancelled — put the card back in hand so it is not eaten.
  const pl = P(G, p);
  if (card.loc === "stz" && card.zone >= 0) pl.stz[card.zone] = null;
  card.loc = "hand";
  card.zone = -1;
  card.faceup = false;
  if (!pl.hand.includes(card)) pl.hand.push(card);
  log(G, `${card.def.name} activation cancelled.`, "warn");
}

async function activateSpellLink(G, card, p) {
  const eff = { ...card.def.spell };
  const link = { card, controller: p, kind: "spell", speed: eff.speed, def: eff, targets: [], negated: false, ev: null };
  if (eff.targets?.length) {
    const picked = await chooseTargets(G, p, eff.targets, { controller: p, card }, `${card.def.name}: choose target(s)`);
    if (picked === null) return null;
    link.targets = picked;
  }
  if (eff.cost?.pay) {
    const paid = await eff.cost.pay(G, card, link);
    if (paid === false) return null;
  }
  log(G, `${p === 0 ? "You" : "AI"} activate ${card.def.name}.`, "chain");
  pushEvents(G, [{ type: "spellActivated", card, player: p }]);
  return link;
}

/* A freshly activated CL1: both players may respond, then resolve. */
async function finishSingleActivation(G, link, p) {
  await responseWindow(G, { startPlayer: p, initialLinks: [link] });
  await checkAndRespond(G, { startPlayer: G.tp });
}

/* ================= tribute (YGO cost of NS) ================= */

async function payTributes(G, p, n, tributeUids) {
  if (!n) return true;
  const mats = monstersOf(G, p);
  if (mats.length < n) return false;
  let chosen = [];
  if (Array.isArray(tributeUids) && tributeUids.length) {
    const seen = new Set();
    for (const uid of tributeUids) {
      const m = mats.find((c) => c.uid === uid);
      if (m && !seen.has(m.uid)) { chosen.push(m); seen.add(m.uid); }
    }
  }
  if (chosen.length < n && G.io?.choose) {
    const req = {
      kind: "tribute",
      min: n,
      max: n,
      uids: mats.map((m) => m.uid),
      title: `Tribute ${n} monster${n > 1 ? "s" : ""}`
    };
    const idxs = await G.io.choose(p, req);
    const seen = new Set(chosen.map((m) => m.uid));
    for (const i of idxs || []) {
      if (chosen.length >= n) break;
      const m = Number.isInteger(i) && i >= 0 && i < mats.length
        ? mats[i]
        : mats.find((c) => c.uid === i || c.uid === Number(i));
      if (m && !seen.has(m.uid)) { chosen.push(m); seen.add(m.uid); }
    }
  }
  if (chosen.length < n) return false;
  const events = [];
  for (const m of chosen.slice(0, n)) {
    events.push(sendToGY(G, m, { from: "mz", kind: "tribute" }));
    log(G, `Tribute ${m.def.name}.`, "summon");
  }
  pushEvents(G, events);
  return true;
}

/* ================= normal summon ================= */

export async function normalSummon(G, card, zone = null, tributeUids = null) {
  const p = card.controller;
  const n = tributesNeeded(card.def);
  if (n > 0) {
    const ok = await payTributes(G, p, n, tributeUids);
    if (!ok) {
      log(G, `Tribute Summon of ${card.def.name} cancelled.`, "warn");
      return;
    }
  }
  const pl = P(G, p);
  const i = pl.hand.indexOf(card);
  if (i >= 0) pl.hand.splice(i, 1);
  card.loc = "summoning";
  const verb = n > 0 ? "Tribute Summon" : "Normal Summon";
  log(G, `${p === 0 ? "You" : "AI"} attempt to ${verb} ${card.def.name}...`, "summon");
  const negated = await summonNegationWindow(G, card, p);
  pl.normalSummoned = true; // the normal summon is used either way
  if (negated) {
    const ev = sendToGY(G, card, { from: "summoning", kind: "summonNegated" });
    pushEvents(G, [ev]);
    log(G, `${card.def.name}'s summon is negated — it goes to the GY without hitting the field.`, "negate");
    await checkAndRespond(G, { startPlayer: G.tp });
    return;
  }
  // player-chosen zone if legal, else first free
  const legal = zone != null && !pl.mz[zone] && !lockedMzZones(G, p).includes(zone);
  const z = legal ? zone : freeMz(G, p);
  placeMonster(G, card, p, z);
  log(G, `${p === 0 ? "You" : "AI"} ${verb} ${card.def.name} (${getATK(G, card)}/${card.def.def}).`, "summon");
  pushEvents(G, [{ type: "normalSummon", card, player: p }]);
  queueLaneSummon(G, card);
  await checkAndRespond(G, { startPlayer: p });
}

/** Ambush Set — face-down MZ; shares Normal Summon/Set once-per-turn slot. */
export async function ambushSet(G, card, zone = null, tributeUids = null) {
  const p = card.controller;
  const pl = P(G, p);
  const n = tributesNeeded(card.def);
  if (freeMz(G, p) < 0 && n === 0) {
    log(G, "No free monster zone — Ambush Set fails.", "warn");
    return;
  }
  if (n > 0) {
    const ok = await payTributes(G, p, n, tributeUids);
    if (!ok) {
      log(G, `Ambush Set of ${card.def.name} cancelled.`, "warn");
      return;
    }
  }
  const i = pl.hand.indexOf(card);
  if (i >= 0) pl.hand.splice(i, 1);
  pl.normalSummoned = true;
  const legal = zone != null && !pl.mz[zone] && !lockedMzZones(G, p).includes(zone);
  const z = legal ? zone : freeMz(G, p);
  if (z < 0) {
    log(G, "No free monster zone — Ambush Set fails.", "warn");
    pl.hand.push(card);
    card.loc = "hand";
    return;
  }
  card.loc = "mz";
  card.zone = z;
  card.controller = p;
  card.faceup = false;
  card.faceDownMz = true;
  card.summonedTurn = G.turnCount;
  card.setTurn = G.turnCount;
  pl.mz[z] = card;
  log(G, `${p === 0 ? "You" : "AI"} Ambush Set a monster.`, "set");
  pushEvents(G, [{ type: "ambushSet", card, player: p }]);
  await checkAndRespond(G, { startPlayer: p });
}

/* ================= evolution ================= */

export async function evolveMonster(G, card) {
  const p = card.controller;
  const pl = P(G, p);
  if (pl.freeEvolvePending) {
    pl.freeEvolvePending = false;
  } else {
    pl.ep -= 1;
  }
  pl.evolveUsedThisTurn = true;
  card.evolved = true;
  card.rushGranted = true;
  G.stats.evolutions++;
  log(G, `${card.def.name} EVOLVES — +2/+2 and Rush!`, "evolve");
  pushEvents(G, [{ type: "evolve", card, player: p }]);
  G.io?.onEvolve?.(card);
  const eff = card.def.evolveEffect;
  if (eff) {
    const link = { card, controller: p, kind: "evolveEffect", speed: 1, def: eff, targets: [], negated: false, ev: null };
    if (eff.targets?.length) {
      const picked = await chooseTargets(G, p, eff.targets, { controller: p, card }, `${card.def.name} Evolve: choose target(s)`);
      if (picked) link.targets = picked;
    }
    await responseWindow(G, { startPlayer: p, initialLinks: [link] });
    sweepDestroyed(G);
  }
  await checkAndRespond(G, { startPlayer: p });
}

/* ================= battle phase ================= */

function clearTurnLocks(G) {
  G.mustAttackUid = null;
  G.mustAttackTurn = null;
  const stolen = [];
  for (const c of allFieldCards(G)) {
    if (!c) continue;
    if (c.negateUntilTurn != null && c.negateUntilTurn <= G.turnCount) {
      c.negated = false;
      c.negateUntilTurn = null;
    }
    if (c.stolenTurn === G.turnCount && c.stolenFrom != null) stolen.push(c);
  }
  for (const c of stolen) {
    if (c.loc !== "mz") continue;
    const ev = bounceToHand(G, c);
    pushEvents(G, [ev]);
    log(G, `${c.def.name} returns to its owner at the end of the turn.`, "system");
  }
}

export function attackTargets(G, attacker) {
  const defender = opp(attacker.controller);
  const all = monstersOf(G, defender).filter((m) => m.faceup || m.faceDownMz);
  if (G.mustAttackUid && G.mustAttackTurn === G.turnCount) {
    const forced = all.find((m) => m.uid === G.mustAttackUid);
    if (forced) {
      const blocked = all
        .filter((m) => m !== forced)
        .map((m) => ({ card: m, reason: "Must attack the marked monster." }));
      return { foes: [forced], canDirect: false, blocked };
    }
  }
  const wards = wardBlockers(G, defender);
  if (wards.length) {
    const blocked = all
      .filter((m) => !wards.includes(m))
      .map((m) => ({ card: m, reason: "Must attack a Ward — cannot snipe past or go direct." }));
    return { foes: wards, canDirect: false, blocked };
  }
  return { foes: all, canDirect: all.length === 0, blocked: [] };
}

function isBattleFastPick(choice) {
  const t = choice?.type;
  return t === "hand" || t === "set" || t === "quick" || t === "handQuick";
}

export async function battlePhase(G) {
  if (isFirstTurnNoBattle(G)) {
    log(G, "First turn — the going-first player cannot attack.", "phase");
    return;
  }

  // YGO Start Step: open game state, turn player priority, then NTP.
  G.battleStep = "start";
  log(G, "— Battle Phase: Start Step —", "phase");
  pushEvents(G, [{ type: "phase", phase: "BP", battleStep: "start", player: G.tp }]);
  await checkAndRespond(G, { startPlayer: G.tp, battleWindow: "start" });
  if (G.over) return;

  // Battle Step repeats until the turn player passes to End Step.
  // Open: declare an attack, activate SS2+ as CL1, or end Battle.
  // After each Damage Step the game returns here (not to End Step).
  let battleLoops = 0;
  while (!G.over) {
    if (++battleLoops > 24) break;
    G.battleStep = "battle";
    log(G, "— Battle Phase: Battle Step —", "phase");
    const tp = G.tp;
    const attackers = monstersOf(G, tp).filter((m) => canAttack(G, m));
    const fast = legalFastEffects(G, tp, {
      responseToSpeed: 0, lastLink: null, summonCtx: null, damageStep: null
    });
    const choice = await G.io.askAttack(tp, attackers, (a) => attackTargets(G, a), fast);
    if (!choice || choice.type === "end") break;
    if (isBattleFastPick(choice)) {
      const link = await performActivation(G, choice);
      if (link) await finishSingleActivation(G, link, tp);
      continue;
    }
    const attacker = attackers.find((a) => a.uid === choice.attackerUid);
    if (!attacker || !canAttack(G, attacker)) continue;
    await conductAttack(G, attacker, choice.targetUid ?? null);
    checkLabsGoal(G);
  }
  if (G.over) return;

  G.battleStep = "end";
  log(G, "— Battle Phase: End Step —", "phase");
  pushEvents(G, [{ type: "phase", phase: "BP", battleStep: "end", player: G.tp }]);
  await checkAndRespond(G, { startPlayer: G.tp, battleWindow: "end" });
  G.battleStep = null;
}

export async function conductAttack(G, attacker, targetUid, replayDepth = 0) {
  const p = attacker.controller;
  let uid = targetUid;
  while (replayDepth <= 3) {
    let target = uid == null ? null
      : monstersOf(G, opp(p)).find((m) => m.uid === uid) || null;

    if (target && target.faceDownMz && !target.faceup) {
      target.faceup = true;
      target.faceDownMz = false;
      log(G, `${target.def.name} Ambush flips face-up!`, "summon");
      pushEvents(G, [{ type: "ambushFlip", card: target, player: target.controller }]);
      await checkAndRespond(G, { startPlayer: opp(p) });
      if (G.over) return;
      if (attacker.loc !== "mz") { log(G, "The attacker left the field — the attack ends.", "warn"); return; }
      target = uid == null ? null
        : monstersOf(G, opp(p)).find((m) => m.uid === uid) || null;
      if (uid != null && (!target || target.loc !== "mz")) {
        log(G, "The attack target left the field — replay: choose a new attack target.", "warn");
        const { foes, canDirect } = attackTargets(G, attacker);
        if (!foes.length && !canDirect) {
          log(G, "No legal targets remain — the attack is cancelled.", "warn");
          return;
        }
        const choice = await G.io.askAttack(p, [attacker], (a) => attackTargets(G, a));
        if (!choice) {
          log(G, "Attack cancelled after replay.", "warn");
          return;
        }
        uid = choice.targetUid ?? null;
        replayDepth++;
        continue;
      }
    }

    log(G, `${attacker.def.name} attacks ${target ? target.def.name : "directly"}!`, "attack");
    pushEvents(G, [{ type: "attackDeclared", card: attacker, target, player: p }]);
    G.battleStep = "declare";
    log(G, "— Battle Step: Attack declaration window —", "phase");
    await checkAndRespond(G, { startPlayer: opp(p), battleWindow: "declare" });
    if (G.over) return;
    if (attacker.loc !== "mz") { log(G, "The attacker left the field — the attack ends.", "warn"); return; }

    target = uid == null ? null
      : monstersOf(G, opp(p)).find((m) => m.uid === uid) || null;
    if (uid != null && (!target || target.loc !== "mz")) {
      log(G, "The attack target left the field — replay: choose a new attack target.", "warn");
      const { foes, canDirect } = attackTargets(G, attacker);
      if (!foes.length && !canDirect) {
        log(G, "No legal targets remain — the attack is cancelled.", "warn");
        return;
      }
      const choice = await G.io.askAttack(p, [attacker], (a) => attackTargets(G, a));
      if (!choice) {
        log(G, "Attack cancelled after replay.", "warn");
        return;
      }
      uid = choice.targetUid ?? null;
      replayDepth++;
      continue;
    }

    attacker.attacksUsed++;
    await runDamageStep(G, attacker, uid, p);
    return;
  }
  log(G, "The attack target left the field — no further replay.", "warn");
}

const DS_WINDOWS_BEFORE = [
  ["dsStart", "Start of the Damage Step"],
  ["dsBefore", "Before damage calculation"]
];
const DS_WINDOWS_AFTER = [
  ["dsAfter", "After damage calculation"],
  ["dsEnd", "End of the Damage Step"]
];

async function runDamageStep(G, attacker, targetUid, p) {
  const gone = () => attacker.loc !== "mz" || G.over;
  for (const [id, label] of DS_WINDOWS_BEFORE) {
    G.battleStep = id;
    log(G, `— Damage Step: ${label} —`, "phase");
    await checkAndRespond(G, { startPlayer: opp(p), damageStep: id });
    if (gone()) { G.battleStep = null; return; }
  }
  G.battleStep = "dsDuring";
  log(G, "— Damage Step: During damage calculation —", "phase");
  await damageCalcWindow(G, p);
  if (gone()) { G.battleStep = null; return; }

  const target = targetUid == null ? null
    : monstersOf(G, opp(p)).find((m) => m.uid === targetUid) || null;
  if (targetUid != null && (!target || target.loc !== "mz")) {
    log(G, "The attack target left the field before damage — the attack deals no battle damage.", "warn");
  } else if (!target) {
    dealDamageToPlayer(G, opp(p), getATK(G, attacker), attacker);
  } else {
    const aAtk = getATK(G, attacker), dAtk = getATK(G, target);
    damageMonster(G, target, aAtk, attacker);
    damageMonster(G, attacker, dAtk, target);
    sweepDestroyed(G, "battle");
  }
  if (G.over) { G.battleStep = null; return; }

  for (const [id, label] of DS_WINDOWS_AFTER) {
    G.battleStep = id;
    log(G, `— Damage Step: ${label} —`, "phase");
    await checkAndRespond(G, { startPlayer: p, damageStep: id });
    if (G.over) { G.battleStep = null; return; }
  }
  G.battleStep = null;
  checkLabsGoal(G);
}

/* Damage-calculation window: only effects flagged damageCalc (e.g. hand
   "Surge" quicks) may activate. SS2 rules; counters may answer. */
async function damageCalcWindow(G, attackerController) {
  let cur = attackerController;
  let passes = 0;
  while (true) {
    const last = G.chain[G.chain.length - 1] || null;
    const legal = [];
    if (!last || last.speed < 3) {
      for (const c of P(G, cur).hand) {
        if (c.def.handQuick?.damageCalc) legal.push({ type: "handQuick", card: c, speed: 2 });
      }
      for (const c of P(G, cur).stz) {
        if (c && !c.faceup && c.def.spell?.speed === 3 && c.setTurn !== G.turnCount
          && (c.def.spell.counterWhat || []).includes("monsterEffect") && last) {
          legal.push({ type: "set", card: c, speed: 3 });
        }
      }
    }
    const pick = await G.io.askChain(cur, legal, G.chain, { damageCalc: true, damageStep: "dsDuring" });
    if (pick == null) {
      passes++;
      if (passes >= 2) break;
    } else {
      const act = legal[pick];
      let link = null;
      if (act.type === "handQuick") {
        const card = act.card;
        const eff = { ...card.def.handQuick };
        link = { card, controller: cur, kind: "monsterEffect", speed: 2, def: eff, targets: [], negated: false, ev: null };
        const ev = sendToGY(G, card, { from: "hand", kind: "costDiscard" });
        pushEvents(G, [ev]);
        log(G, `${cur === 0 ? "You" : "AI"} discard ${card.def.name} as cost for its damage-step effect.`, "chain");
        if (eff.targets?.length) {
          const picked = await chooseTargets(G, cur, eff.targets, { controller: cur, card }, `${card.def.name}: choose target(s)`);
          if (picked) link.targets = picked;
        }
      } else {
        link = await performActivation(G, act);
      }
      if (link) { G.chain.push(link); passes = 0; } else passes++;
    }
    cur = opp(cur);
  }
  if (G.chain.length) await resolveChain(G);
  G.chain = [];
  clearTriggerFlags(G);
}

/* ================= end phase / hand limit ================= */

export async function handLimit(G) {
  const pl = P(G, G.tp);
  while (pl.hand.length > 6 && !G.over) {
    const idxs = await G.io.choose(G.tp, {
      title: `Hand limit: discard down to 6 (${pl.hand.length - 6} to discard)`,
      options: pl.hand.map((c) => c.def.name),
      min: 1, max: 1, kind: "discard", uids: pl.hand.map((c) => c.uid)
    });
    const card = pl.hand[idxs?.[0]];
    if (!card || card.loc !== "hand") break;
    const ev = discardCard(G, card, { isCost: false });
    if (!ev) break;
    pushEvents(G, [ev]);
  }
  await checkAndRespond(G, { startPlayer: G.tp });
}

/* ================= turn loop ================= */

async function openLabsCounterChain(G) {
  if (G.meta?.labs !== "counter") return;
  const p = 1;
  const def = G.cardDb?.scroll_greed;
  if (!def) return;
  let card = P(G, p).hand.find((c) => c.id === "scroll_greed");
  if (!card) {
    card = makeCard("scroll_greed", def, p);
    card.loc = "hand";
    P(G, p).hand.push(card);
  }
  const i = P(G, p).hand.indexOf(card);
  if (i >= 0) P(G, p).hand.splice(i, 1);
  card.loc = "chain";
  card.zone = -1;
  card.faceup = true;
  const link = await activateSpellLink(G, card, p);
  if (!link) return;
  log(G, "LABS: opponent activates a Speed 1 spell — Counter it (SS3). A Speed 2 Quick cannot answer the counter.", "phase");
  await responseWindow(G, { startPlayer: 0, initialLinks: [link] });
  await checkAndRespond(G, { startPlayer: G.tp });
}

export async function runDuel(G) {
  setupDuel(G, G.setup);
  G.afterSetup?.(G);
  await openingMulligan(G);
  await revealLanes(G);
  await openLabsCounterChain(G);
  checkLabsGoal(G);
  let guard = 0;
  while (!G.over && guard++ < 400) {
    const tp = G.tp;
    const pl = P(G, tp);
    pl.ownTurnCount++;
    pl.normalSummoned = false;
    pl.evolveUsedThisTurn = false;
    for (const m of pl.mz) if (m) m.attacksUsed = 0;

    // Auto-resolve comeback for AI / if still pending choose → draw
    if (pl.comebackPending === "choose") {
      const choice = (await G.io?.askComeback?.(tp)) || "draw";
      applyComebackChoice(G, tp, choice);
    }

    G.phase = "DP";
    const skipDraw = tp === G.firstPlayer && G.turnCount === 1;
    log(G, skipDraw
      ? "— Draw Phase — opening draw skipped (going first)."
      : "— Draw Phase —", "phase");
    if (!skipDraw) drawCards(G, tp, 1, { phaseDraw: true });
    if (pl.bonusDrawNextTurn > 0) {
      const n = pl.bonusDrawNextTurn;
      pl.bonusDrawNextTurn = 0;
      drawCards(G, tp, n);
      log(G, `Comeback bonus: draw ${n}.`, "system");
    }
    if (G.over) break;
    await checkAndRespond(G, { startPlayer: tp });
    if (G.over) break;

    G.phase = "SP";
    log(G, "— Standby Phase —", "phase");
    pushEvents(G, [{ type: "phase", phase: "SP", player: tp }]);
    await checkAndRespond(G, { startPlayer: tp });
    if (G.over) break;

    G.phase = "M1";
    log(G, `— Turn ${G.turnCount} · ${tp === 0 ? "Your" : "AI's"} Main Phase 1 —`, "phase");
    await mainPhaseLoop(G);
    if (G.over) break;

    // YGO: no Battle Phase on the first turn ⇒ no Main Phase 2 either.
    // Do not paint BP on the orb for that skip — it reads as "I battled, then
    // the turn ended" and Main 2 looks missing.
    if (isFirstTurnNoBattle(G)) {
      log(G, "First turn — the going-first player cannot attack.", "phase");
      log(G, "First turn — Main Phase 2 is skipped (no Battle Phase).", "phase");
    } else {
      G.phase = "BP";
      await battlePhase(G);
      if (G.over) break;

      G.phase = "M2";
      log(G, `— Turn ${G.turnCount} · ${tp === 0 ? "Your" : "AI's"} Main Phase 2 —`, "phase");
      await mainPhaseLoop(G);
      checkLabsGoal(G);
      if (G.over) break;
    }

    G.phase = "EP";
    log(G, "— End Phase —", "phase");
    pushEvents(G, [{ type: "turnEnd", player: tp }]);
    clearTurnLocks(G);
    for (const lane of G.lanes) {
      if (lane.revealed && lane.def.onTurnEnd) lane.def.onTurnEnd(G, lane);
    }
    await checkAndRespond(G, { startPlayer: tp });
    await handLimit(G);
    if (G.over) break;

    G.tp = opp(tp);
    G.turnCount++;
    G.stats.turns++;
    await revealLanes(G);
  }
  if (!G.over) { // turn cap safety net
    G.over = true;
    const [a, b] = [P(G, 0).lp, P(G, 1).lp];
    G.winner = a === b ? null : a > b ? 0 : 1;
    G.winReason = "Turn limit — sudden death by LP.";
  }
  log(G, G.winner == null ? "The duel is a draw." : `${G.winner === 0 ? "You win" : "AI wins"} — ${G.winReason}`, "gameover");
  return { winner: G.winner, reason: G.winReason, stats: G.stats };
}

export async function mainPhaseLoop(G) {
  const tp = G.tp;
  G._mainUndo = null;
  G._canUndo = false;
  let steps = 0;
  while (!G.over) {
    if (++steps > 64) {
      log(G, "Main Phase action cap — ending the phase.", "system");
      return;
    }
    const actions = legalMainActions(G, tp);
    const pick = await G.io.chooseMain(tp, actions);
    if (pick?.type === "undo") {
      if (G._mainUndo) {
        applySnapshot(G, G._mainUndo);
        G._mainUndo = null;
        G._canUndo = false;
        log(G, "Undo — last Main Phase action taken back.", "system");
      }
      continue;
    }
    if (!pick || pick.type === "end") {
      // phase change: opponent gets fast-effect priority first
      const had = await checkAndRespondEx(G, { startPlayer: opp(tp) });
      if (!had) return; // window closed clean -> phase changes
      continue;         // something happened -> TP re-decides in open state
    }
    G._mainUndo = serializeGame(G);
    G._canUndo = true;
    await performMainAction(G, pick, tp);
    sweepDestroyed(G); // DEF reductions (lanes, auras) can kill without damage
    checkLabsGoal(G);
  }
}

// checkAndRespond that reports whether anything happened
async function checkAndRespondEx(G, opts) {
  const eventsBefore = G.events.length;
  const chainsBefore = G.stats.chainsResolved;
  await checkAndRespond(G, opts);
  return G.stats.chainsResolved > chainsBefore || G.events.length > eventsBefore;
}

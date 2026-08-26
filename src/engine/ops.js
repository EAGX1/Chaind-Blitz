// Effect operations — the verbs card effects use during resolution, plus the
// declarative targeting system. Ops mutate state and push events; they never
// build chains themselves (the engine does that after the action completes).

import {
  P, opp, log, pushEvents, monstersOf, firstFreeMZ, queueLaneSummon,
  getATK, getDEF, remainingHealth, isDestroyedByDamage, allFieldCards
} from "./state.js";

/* ================= movement ================= */

export function moveTo(G, card, loc, { faceup = true } = {}) {
  const pl = P(G, card.controller);
  if (card.loc === "mz") pl.mz[card.zone] = null;
  else if (card.loc === "stz") pl.stz[card.zone] = null;
  else if (card.loc === "hand" || card.loc === "deck" || card.loc === "gy"
    || card.loc === "ban" || card.loc === "extra") {
    const arr = pl[card.loc];
    const i = arr.indexOf(card);
    if (i >= 0) arr.splice(i, 1);
  }
  // "chain" and "summoning" are limbo states — the card is in no array/zone
  card.loc = loc; card.zone = -1; card.faceup = faceup;
  card.dmg = 0; card.attacksUsed = 0;
  card._queued = false;
  return card;
}

export function sendToGY(G, card, { from = null, kind = "effect" } = {}) {
  const src = from || card.loc;
  moveTo(G, card, "gy");
  P(G, card.owner).gy.push(card);
  return { type: "sentToGY", card, from: src, kind, player: card.controller };
}

export function banishCard(G, card, { from = null, kind = "effect" } = {}) {
  const src = from || card.loc;
  moveTo(G, card, "ban");
  P(G, card.owner).ban.push(card);
  return { type: "banished", card, from: src, kind, player: card.controller };
}

export function bounceToHand(G, card) {
  const src = card.loc;
  moveTo(G, card, "hand");
  P(G, card.owner).hand.push(card);
  card.evolved = false; card.atkMod = 0; card.defMod = 0; card.rushGranted = false; card.wardGranted = false;
  return { type: "bounced", card, from: src, player: card.controller };
}

/* ================= destruction / battle death ================= */

// Destroy by effect (not battle): immediate.
export function destroyByEffect(G, card, source = null) {
  const ev = sendToGY(G, card, { kind: "destroyed" });
  ev.destroyedBy = source?.def?.name || "a card effect";
  pushEvents(G, [ev]);
  log(G, `${card.def.name} is destroyed by ${ev.destroyedBy}.`, "destroy");
  return ev;
}

// Sweep monsters whose persistent damage >= DEF (battle/effect damage kills).
export function sweepDestroyed(G, reason = "damage") {
  const events = [];
  for (const c of allFieldCards(G)) {
    if (c.loc === "mz" && isDestroyedByDamage(G, c)) {
      events.push(sendToGY(G, c, { kind: reason === "battle" ? "battleDestroy" : "destroyed" }));
      log(G, `${c.def.name} is destroyed.`, "destroy");
    }
  }
  if (events.length) pushEvents(G, events);
  return events;
}

/* ================= damage / heal ================= */

export function maybeTriggerComeback(G, p) {
  const pl = P(G, p);
  if (pl.comebackUsed || pl.lp > 10) return;
  pl.comebackUsed = true;
  pl.comebackPending = "choose";
  log(G, `${p === 0 ? "You" : "AI"} hit ≤10 LP — Comeback! Choose +1 draw next turn or a free Evolve.`, "system");
  G.io?.onComeback?.(p);
}

export function applyComebackChoice(G, p, choice) {
  const pl = P(G, p);
  if (pl.comebackPending !== "choose") return;
  if (choice === "evolve") {
    pl.freeEvolvePending = true;
    pl.comebackPending = "evolve";
    log(G, `${p === 0 ? "You" : "AI"} choose Comeback: next Evolve is free.`, "system");
  } else {
    pl.bonusDrawNextTurn = (pl.bonusDrawNextTurn || 0) + 1;
    pl.comebackPending = "draw";
    log(G, `${p === 0 ? "You" : "AI"} choose Comeback: +1 draw next turn.`, "system");
  }
}

export function dealDamageToPlayer(G, p, amount, source = null) {
  if (amount <= 0) return;
  P(G, p).lp -= amount;
  pushEvents(G, [{ type: "damage", player: p, amount, source }]);
  log(G, `${p === 0 ? "You take" : "AI takes"} ${amount} damage. (LP ${P(G, p).lp})`, "dmg");
  if (source?.def?.keywords?.includes("drain")) {
    healPlayer(G, source.controller, amount);
  }
  maybeTriggerComeback(G, p);
  checkGameOver(G);
}

export function damageMonster(G, card, amount, source = null) {
  card.dmg += amount;
  log(G, `${card.def.name} takes ${amount} damage.`, "dmg");
  pushEvents(G, [{ type: "monsterDamaged", card, amount, source }]);
  if (source?.def?.keywords?.includes("drain") && amount > 0) {
    healPlayer(G, source.controller, amount);
  }
}

export function healPlayer(G, p, amount) {
  P(G, p).lp = Math.min(20, P(G, p).lp + amount);
  log(G, `${p === 0 ? "You recover" : "AI recovers"} ${amount} LP. (LP ${P(G, p).lp})`, "heal");
}

export function healMonster(G, card, amount) {
  card.dmg = Math.max(0, card.dmg - amount);
}

/* ================= draw / search / discard / mill ================= */

export function drawCards(G, p, n, { phaseDraw = false } = {}) {
  const pl = P(G, p);
  const k = Math.max(0, n | 0);
  const events = [];
  for (let i = 0; i < k; i++) {
    if (pl.deck.length === 0) {
      G.over = true; G.winner = opp(p);
      G.winReason = `${p === 0 ? "You" : "AI"} decked out.`;
      log(G, G.winReason, "gameover");
      return events;
    }
    const card = pl.deck.shift();
    card.loc = "hand";
    pl.hand.push(card);
    events.push({ type: "draw", card, player: p, phaseDraw });
  }
  if (events.length) {
    log(G, `${p === 0 ? "You draw" : "AI draws"} ${events.length} card(s).`, "draw");
    pushEvents(G, events);
  }
  return events;
}

export function discardCard(G, card, { isCost = false } = {}) {
  if (!card || card.loc !== "hand") return null;
  const ev = sendToGY(G, card, { from: "hand", kind: isCost ? "costDiscard" : "discard" });
  log(G, `${card.def.name} is discarded${isCost ? " as a cost" : ""}.`, "discard");
  return ev;
}

export function mill(G, p, n) {
  const pl = P(G, p);
  const k = Math.max(0, n | 0);
  const events = [];
  for (let i = 0; i < k && pl.deck.length; i++) {
    events.push(sendToGY(G, pl.deck.shift(), { from: "deck", kind: "mill" }));
  }
  if (events.length) pushEvents(G, events);
  return events;
}

/* ================= stat changes ================= */

export function buff(G, card, atk, def, { permanent = true } = {}) {
  if (permanent) { card.atkMod += atk; card.defMod += def; }
  else { card.tempAtk += atk; card.tempDef += def; card.tempTurn = G.turnCount; }
  log(G, `${card.def.name} gets ${atk >= 0 ? "+" : ""}${atk}/${def >= 0 ? "+" : ""}${def}${permanent ? "" : " until end of turn"}.`, "buff");
}

/* ================= summons ================= */

export function placeMonster(G, card, p, zone = null) {
  const pl = P(G, p);
  const z = zone ?? firstFreeMZ(G, p);
  if (z < 0) return null;
  moveTo(G, card, "mz", { faceup: true });
  card.controller = p;
  card.zone = z;
  card.summonedTurn = G.turnCount;
  pl.mz[z] = card;
  return card;
}

/** Steal a face-up monster until end of turn (then it bounces to its owner). */
export function takeControl(G, card, newController) {
  if (!card || card.loc !== "mz" || card.controller === newController) return false;
  const z = firstFreeMZ(G, newController);
  if (z < 0) return false;
  const from = card.controller;
  P(G, from).mz[card.zone] = null;
  card.stolenFrom = from;
  card.stolenTurn = G.turnCount;
  card.controller = newController;
  card.zone = z;
  P(G, newController).mz[z] = card;
  log(G, `${card.def.name} changes controller until end of turn.`, "summon");
  return true;
}

/** Book of Moon job: face-down in the monster zone. */
export function setMonsterFaceDown(G, card) {
  if (!card || card.loc !== "mz") return false;
  card.faceup = false;
  card.faceDownMz = true;
  log(G, `${card.def.name} is flipped face-down.`, "system");
  return true;
}

// Special summon from hand/deck/GY by an effect.
export function specialSummon(G, card, p, source = null) {
  const placed = placeMonster(G, card, p);
  if (!placed) { log(G, "No free monster zone — summon fails.", "warn"); return null; }
  pushEvents(G, [{ type: "specialSummon", card, player: p, source }]);
  log(G, `${p === 0 ? "You" : "AI"} Special Summon ${card.def.name}.`, "summon");
  queueLaneSummon(G, card);
  return placed;
}

export function setSpell(G, card, p, zone = null) {
  const pl = P(G, p);
  const locked = [];
  for (const lane of G.lanes || []) {
    if (!lane.revealed || !lane.def.locksSpellZone) continue;
    for (let zi = 0; zi < 6; zi++) if (lane.def.locksSpellZone(G, lane, p, zi)) locked.push(zi);
  }
  const z = (zone != null && !pl.stz[zone] && !locked.includes(zone))
    ? zone
    : pl.stz.findIndex((_, i) => !pl.stz[i] && !locked.includes(i));
  if (z < 0) return false;
  moveTo(G, card, "stz", { faceup: false });
  card.controller = p; card.zone = z; card.setTurn = G.turnCount;
  pl.stz[z] = card;
  log(G, `${p === 0 ? "You set" : "AI sets"} a card.`, "set");
  return true;
}

/* ================= game over ================= */

export function checkGameOver(G) {
  if (G.over) return;
  for (let p = 0; p < 2; p++) {
    if (P(G, p).lp <= 0) {
      G.over = true; G.winner = opp(p);
      G.winReason = `${p === 0 ? "Your" : "AI's"} LP hit 0.`;
      log(G, G.winReason, "gameover");
      return;
    }
  }
}

/* ================= targeting =================
   specs: { what:"monster"|"setSpell"|"faceupSpell"|"any", who:"self"|"enemy"|"either",
            count:1, filter?(G,c,ctx), optional?:false, upTo?:false } */

export function legalTargets(G, spec, ctx) {
  const me = ctx.controller;
  const players = spec.who === "self" ? [me] : spec.who === "enemy" ? [opp(me)] : [0, 1];
  const out = [];
  for (const p of players) {
    if (spec.what === "monster" || spec.what === "any") {
      for (const c of monstersOf(G, p)) {
        if (c.faceup && (!spec.filter || spec.filter(G, c, ctx))) out.push(c);
      }
    }
    if (spec.what === "setSpell" || spec.what === "faceupSpell" || spec.what === "anySpell" || spec.what === "any") {
      for (const c of P(G, p).stz) {
        if (!c) continue;
        if (spec.what === "setSpell" && c.faceup) continue;
        if (spec.what === "faceupSpell" && !c.faceup) continue;
        if (!spec.filter || spec.filter(G, c, ctx)) out.push(c);
      }
    }
    if (spec.what === "gyMonster") {
      for (const c of P(G, p).gy) {
        if (c.def.type === "monster" && (!spec.filter || spec.filter(G, c, ctx))) out.push(c);
      }
    }
  }
  return out;
}

// Ask the controlling player's io to pick targets for a spec list.
export async function chooseTargets(G, chooser, specs, ctx, title = "Choose a target") {
  const picked = [];
  for (const spec of specs) {
    const pool = legalTargets(G, spec, ctx);
    if (pool.length === 0) {
      if (spec.optional) { picked.push(null); continue; }
      return null; // fizzle: no legal target
    }
    if (spec.optional && ctx.autoOptional) { picked.push(null); continue; }
    const idxs = await G.io.choose(chooser, {
      title,
      options: pool.map((c) => describeTarget(G, c)),
      min: 1, max: spec.count || 1, kind: "target", uids: pool.map((c) => c.uid),
      sourceUid: ctx.card?.uid ?? ctx.sourceUid
    });
    if (!idxs || !idxs.length) {
      if (spec.optional) { picked.push(null); continue; }
      return null;
    }
    const count = spec.count || 1;
    picked.push(idxs.slice(0, count).map((i) => pool[i]).filter(Boolean));
    if (!picked[picked.length - 1].length && !spec.optional) return null;
  }
  return picked;
}

export function describeTarget(G, c) {
  if (c.def.type === "monster") return `${c.def.name} (${getATK(G, c)}/${getDEF(G, c)})`;
  return `${c.faceup ? c.def.name : "Set card"}`;
}

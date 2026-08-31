// Chain system: activation legality (spell speeds 1/2/3), chain building with
// priority passing, backwards resolution, simultaneous GY sends, summon
// negation window, counter lockout (SS3 answers only SS3).

import { P, opp, log, pushEvents, flushLaneSummons } from "./state.js";
import { legalTargets, chooseTargets, sendToGY } from "./ops.js";
import { collectTriggers, segocOrder, clearTriggerFlags } from "./triggers.js";

/* ================= legality ================= */

function mappedKind(link) {
  if (!link) return null;
  if (link.kind === "spell") return "spell";
  if (link.kind === "monsterEffect" || link.kind === "trigger") return "monsterEffect";
  return link.kind;
}

function counterApplies(G, card, ctx) {
  const cw = card.def.spell.counterWhat || [];
  const filter = card.def.spell.counterFilter;
  if (ctx.summonCtx) return cw.includes("summon");
  if (!ctx.lastLink) return false;
  if (!cw.includes(mappedKind(ctx.lastLink))) return false;
  if (filter && !filter(G, ctx.lastLink)) return false;
  return true;
}

function activationOk(G, card, ctx, fromHand) {
  const def = card.def;
  const eff = def.type === "spell" ? def.spell : null;
  const cond = eff?.condition || def.quick?.condition;
  if (cond && !cond(G, card, ctx)) return false;
  const specs = eff?.targets || (def.quick?.targets) || [];
  for (const spec of specs) {
    if (spec.optional) continue;
    if (legalTargets(G, spec, { controller: card.controller, card }).length === 0) return false;
  }
  return true;
}

export function quickUsable(G, card) {
  card._quickTurns ||= {};
  const q = card.def.quick;
  if (!q) return false;
  if (q.oncePerTurn !== false && card._quickTurns.used === G.turnCount) return false;
  return true;
}

/* All fast effects player p may activate right now. */
export function legalFastEffects(G, p, ctx) {
  const acts = [];
  const pl = P(G, p);
  const canAnswerSpeed = ctx.responseToSpeed < 3;

  // Set spells in own S/T zones (locked the turn they were set)
  for (const c of pl.stz) {
    if (!c || c.faceup || !c.def.spell) continue;
    if (c.setTurn === G.turnCount) continue;
    const sp = c.def.spell;
    if (sp.speed === 3) {
      if (counterApplies(G, c, ctx)) acts.push({ type: "set", card: c, speed: 3 });
    } else if (sp.speed === 2 && canAnswerSpeed && !ctx.summonCtx) {
      if (activationOk(G, c, ctx, false)) acts.push({ type: "set", card: c, speed: 2 });
    }
  }
  if (ctx.summonCtx) return acts; // summon-negation window: counters only

  // Quick-Play spells from hand — YOUR turn only (not hand traps; those answer)
  if (G.tp === p && canAnswerSpeed) {
    for (const c of pl.hand) {
      if (c.def?.handTrap || c.def?.spell?.handTrap) continue;
      if (c.def?.spell?.speed === 2 && activationOk(G, c, ctx, true)) {
        acts.push({ type: "hand", card: c, speed: 2 });
      }
    }
  }

  // Hand traps: printed Quick/Counter from hand on opponent's turn
  if (G.tp !== p && canAnswerSpeed) {
    for (const c of pl.hand) {
      if (!c.def?.handTrap) continue;
      const sp = c.def.spell;
      if (!sp) continue;
      if (sp.speed === 3) {
        if (counterApplies(G, c, ctx)) acts.push({ type: "hand", card: c, speed: 3 });
      } else if (sp.speed === 2 && !ctx.summonCtx && activationOk(G, c, ctx, true)) {
        acts.push({ type: "hand", card: c, speed: 2 });
      }
    }
  }

  // Monster Quick Effects (SS2) — same target/condition gate as spells
  if (canAnswerSpeed) {
    for (const c of pl.mz) {
      if (c?.faceup && c.def.quick && !c.negated && quickUsable(G, c) && activationOk(G, c, ctx, false)) {
        acts.push({ type: "quick", card: c, speed: 2 });
      }
    }
  }
  if (ctx.damageStep === "dsDuring") {
    return acts.filter((a) => a.card?.def?.handQuick?.damageCalc || a.speed >= 3);
  }
  if (ctx.damageStep) {
    return acts.filter((a) => {
      if (a.speed >= 3) return true;
      const d = a.card?.def;
      if (d?.handQuick?.damageCalc) return false;
      return !!(d?.spell?.damageStep || d?.quick?.damageStep || d?.handQuick?.damageStep);
    });
  }
  return acts;
}

/* ================= activation ================= */

async function payCostAndTarget(G, card, effDef, kind) {
  const link = {
    card, controller: card.controller, kind,
    speed: effDef.speed, def: effDef, targets: [], negated: false, ev: null
  };
  const specs = effDef.targets || [];
  if (specs.length) {
    const picked = await chooseTargets(G, card.controller, specs, { controller: card.controller, card }, `${card.def.name}: choose target(s)`);
    if (picked === null) return null; // should be pre-filtered by activationOk
    link.targets = picked;
  }
  if (effDef.cost?.pay) {
    const paid = await effDef.cost.pay(G, card, link);
    if (paid === false) return null;
  }
  return link;
}

function undoFailedActivation(G, act, card, wasFaceup) {
  if (act.type === "hand") {
    const pl = P(G, card.controller);
    card.loc = "hand";
    card.zone = -1;
    card.faceup = false;
    if (!pl.hand.includes(card)) pl.hand.push(card);
    return;
  }
  if (act.type === "set") card.faceup = wasFaceup;
}

export async function performActivation(G, act) {
  const card = act.card;
  const p = card.controller;
  let effDef, kind;
  const wasFaceup = card.faceup;
  if (act.type === "quick") {
    effDef = { ...card.def.quick, speed: 2 };
    kind = "monsterEffect";
  } else {
    effDef = { ...card.def.spell };
    kind = "spell";
    if (act.type === "hand") {
      moveCardToChainLimbo(G, card);
    } else {
      card.faceup = true; // set card flips face-up on activation
    }
  }
  const link = await payCostAndTarget(G, card, effDef, kind);
  if (!link) {
    undoFailedActivation(G, act, card, wasFaceup);
    return null;
  }
  if (act.type === "quick") {
    card._quickTurns ||= {};
    card._quickTurns.used = G.turnCount;
  }
  link.speed = act.speed;
  log(G, `${p === 0 ? "You" : "AI"} activate ${card.def.name} (Chain Link ${G.chain.length + 1}).`, "chain");
  pushEvents(G, [{ type: kind === "spell" ? "spellActivated" : "effectActivated", card, player: p }]);
  return link;
}

function moveCardToChainLimbo(G, card) {
  const pl = P(G, card.controller);
  const i = pl.hand.indexOf(card);
  if (i >= 0) pl.hand.splice(i, 1);
  card.loc = "chain"; card.zone = -1; card.faceup = true;
}

export function makeTriggerLink(G, f, clNum = 1) {
  const effDef = {
    speed: 1, text: f.trig.text, targets: f.trig.targets || [],
    resolve: f.trig.resolve, cost: f.trig.cost
  };
  return (async () => {
    const link = { card: f.card, controller: f.card.controller, kind: "trigger", speed: 1, def: effDef, targets: [], negated: false, ev: f.ev };
    if (f.trig.cost?.pay) await f.trig.cost.pay(G, f.card, link);
    if (effDef.targets.length) {
      const picked = await chooseTargets(G, link.controller, effDef.targets, { controller: link.controller, card: f.card }, `${f.card.def.name}: choose target(s)`);
      if (picked === null) return null;
      link.targets = picked;
    }
    log(G, `${f.card.def.name}'s triggered effect activates (Chain Link ${clNum}).`, "chain");
    return link;
  })();
}

/* ================= response windows =================
   startPlayer is asked first; priority alternates; two consecutive passes end
   the build. Triggers (already SEGOC-ordered) occupy CL1..n before fast effects. */
export async function responseWindow(G, { startPlayer, initialLinks = [], summonCtx = null, damageStep = null, battleWindow = null }) {
  G.chain = [...initialLinks];
  let passes = 0;
  let cur = startPlayer;
  while (true) {
    const last = G.chain[G.chain.length - 1] || null;
    const ctx = { responseToSpeed: last ? last.speed : 0, lastLink: last, summonCtx, damageStep };
    const legal = legalFastEffects(G, cur, ctx);
    const extra = { summonCtx, damageStep, damageCalc: damageStep === "dsDuring", turnPlayer: G.tp, battleWindow };
    const pick = await G.io.askChain(cur, legal, G.chain, extra);
    if (pick == null) {
      passes++;
      if (passes >= 2) break;
    } else {
      const link = await performActivation(G, legal[pick]);
      if (link) { G.chain.push(link); passes = 0; }
      else passes++; // activation fizzled pre-check; treat as pass
    }
    cur = opp(cur);
  }

  const hadChain = G.chain.length > 0;
  if (hadChain) await resolveChain(G);
  G.chain = [];
  clearTriggerFlags(G);
  return hadChain;
}

/* Full post-event protocol: collect triggers (SEGOC), open the response window,
   and repeat while chains keep resolving. This is the ONLY entry point the
   game flow uses after events. */
export async function checkAndRespond(G, { startPlayer = null, offerFast = true, damageStep = null, battleWindow = null } = {}) {
  startPlayer ??= G.tp;
  let windows = 0;
  while (true) {
    if (++windows > 48) return;
    const trigs = collectTriggers(G);
    const initial = [];
    if (trigs.length) {
      const ordered = await segocOrder(G, trigs);
      for (const f of ordered) {
        const link = await makeTriggerLink(G, f, initial.length + 1);
        if (link) initial.push(link);
      }
    }
    if (initial.length === 0 && !offerFast) return;
    const had = await responseWindow(G, { startPlayer, initialLinks: initial, summonCtx: null, damageStep, battleWindow });
    if (!had) {
      if (flushLaneSummons(G)) continue;
      return;
    }
    startPlayer = G.tp; // after a chain resolves, priority returns to turn player
    offerFast = true;
  }
}

/* Summon negation window: only counters with counterWhat:"summon" may respond. */
export async function summonNegationWindow(G, summonCard, summoner) {
  G.summonNegCtx = { card: summonCard, negated: false };
  await responseWindow(G, { startPlayer: opp(summoner), summonCtx: G.summonNegCtx });
  const negated = G.summonNegCtx.negated;
  G.summonNegCtx = null;
  return negated;
}

/* ================= resolution ================= */

export function negateLastLinkOfKind(G, kinds) {
  const arr = Array.isArray(kinds) ? kinds : [kinds];
  for (let i = G.chain.length - 1; i >= 0; i--) {
    const link = G.chain[i];
    if (arr.includes(mappedKind(link))) { link.negated = true; return link; }
  }
  return null;
}

export async function resolveChain(G) {
  G.resolving = true;
  const spellCardsToGY = [];
  let cl = G.chain.length;
  log(G, `— Chain resolves (${G.chain.length} link${G.chain.length > 1 ? "s" : ""}, backwards) —`, "chain");
  while (G.chain.length) {
    const link = G.chain.pop();
    const clNum = cl--;
    await G.io?.onResolveLink?.(link, clNum, G.chain.length);
    if (link.negated) {
      G.stats.negates = (G.stats.negates || 0) + 1;
      log(G, `CL${clNum}: ${link.card.def.name} — its activation is negated.`, "negate");
    } else {
      log(G, `CL${clNum}: ${link.card.def.name} resolves.`, "resolve");
      if (typeof link.def.resolve === "function") await link.def.resolve(G, link.card, link);
    }
    if (link.kind === "spell" && link.card.def.spell.subtype !== "continuous") {
      spellCardsToGY.push(link.card);
    }
    if (G.over) break; // duel ends the moment LP hits 0 or a deck-out occurs
  }
  // Activated spells hit the GY simultaneously with the last resolution.
  // For timing purposes they merge into "the last things to happen" alongside
  // the final link's events (so effect-discards still trigger, cost-discards
  // already missed long before).
  const gyEvents = [];
  for (const c of spellCardsToGY) {
    if (c.loc === "stz" || c.loc === "chain") {
      gyEvents.push(sendToGY(G, c, { kind: "spellResolved" }));
    }
  }
  if (gyEvents.length) {
    for (const ev of gyEvents) G.events.push(ev);
    G.lastThings = [...G.lastThings, ...gyEvents];
  }
  G.resolving = false;
  G.stats.chainsResolved++;
}

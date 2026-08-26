// Builders that keep card definitions terse and declarative.

import {
  drawCards, dealDamageToPlayer, healPlayer, damageMonster, sweepDestroyed,
  destroyByEffect, sendToGY, bounceToHand, buff, specialSummon, discardCard,
  healMonster
} from "../../engine/ops.js";
import { P, opp, monstersOf, pushEvents, log } from "../../engine/state.js";
import { negateLastLinkOfKind } from "../../engine/chain.js";

/* ---------- trigger matchers ---------- */
export const evSelfSummon = (G, card, ev) =>
  (ev.type === "normalSummon" || ev.type === "specialSummon") && ev.card === card;
export const evSentFromField = (G, card, ev) =>
  ev.type === "sentToGY" && ev.card === card && ev.from === "mz";
export const evSentAnywhere = (G, card, ev) =>
  ev.type === "sentToGY" && ev.card === card;
export const evDiscarded = (G, card, ev) =>
  ev.type === "sentToGY" && ev.card === card && (ev.kind === "discard" || ev.kind === "costDiscard");
export const evOwnSpell = (G, card, ev) =>
  ev.type === "spellActivated" && ev.player === card.controller;
export const evStandby = (G, card, ev) =>
  ev.type === "phase" && ev.phase === "SP" && ev.player === card.controller;
export const evFriendlyBattleDestroy = (G, card, ev) =>
  ev.type === "sentToGY" && ev.kind === "battleDestroy" && ev.card !== card
  && ev.card.controller === card.controller;
export const evEnemyBattleDestroy = (G, card, ev) =>
  ev.type === "sentToGY" && ev.kind === "battleDestroy"
  && ev.card.controller !== card.controller;
export const evAmbushFlip = (G, card, ev) =>
  ev.type === "ambushFlip" && ev.card === card;

/* ---------- trigger wrappers ---------- */
// Optional "when ... you can" — can miss the timing.
export const when = (id, text, match, resolve, extra = {}) =>
  ({ id, text, match, resolve, optional: true, whenVsIf: "when", ...extra });
// "If ..." — never misses the timing.
export const ifTrig = (id, text, match, resolve, extra = {}) =>
  ({ id, text, match, resolve, optional: false, whenVsIf: "if", ...extra });
// Mandatory "when ..." — never misses, must activate.
export const must = (id, text, match, resolve, extra = {}) =>
  ({ id, text, match, resolve, optional: false, whenVsIf: "when", ...extra });

/* ---------- resolve helpers ---------- */
export const rDraw = (n, who = "self") => async (G, card) => {
  drawCards(G, who === "self" ? card.controller : opp(card.controller), n);
  checkSweep(G);
};
export const rDamageLeader = (n, who = "enemy") => async (G, card) => {
  const p = who === "enemy" ? opp(card.controller) : card.controller;
  dealDamageToPlayer(G, p, n, card);
};
export const rHeal = (n) => async (G, card) => { healPlayer(G, card.controller, n); };
export const rDamageMonster = (n, slot = 0) => async (G, card, link) => {
  const t = link.targets?.[slot]?.[0];
  if (t && t.loc === "mz") { damageMonster(G, t, n, card); sweepDestroyed(G); }
};
export const rDestroyTarget = (slot = 0) => async (G, card, link) => {
  const t = link.targets?.[slot]?.[0];
  if (t) destroyByEffect(G, t, card);
};
export const rBounceTarget = (slot = 0) => async (G, card, link) => {
  const t = link.targets?.[slot]?.[0];
  if (t && t.loc === "mz") {
    const ev = bounceToHand(G, t);
    pushEvents(G, [ev]);
  }
};
export const rBuffTarget = (atk, def, permanent, slot = 0) => async (G, card, link) => {
  const t = link.targets?.[slot]?.[0];
  if (t && t.loc === "mz") buff(G, t, atk, def, { permanent });
};
export const rBuffSelf = (atk, def, permanent = true) => async (G, card) => {
  if (card.loc === "mz") buff(G, card, atk, def, { permanent });
};
export const rNegate = (...kinds) => async (G, card) => {
  const negated = negateLastLinkOfKind(G, kinds);
  if (negated) return negated;
};
export const checkSweep = (G) => sweepDestroyed(G);

/* ---------- target specs ---------- */
export const tEnemyMonster = (filter) => ({ what: "monster", who: "enemy", filter });
export const tOwnMonster = (filter) => ({ what: "monster", who: "self", filter });
export const tAnyMonster = (filter) => ({ what: "monster", who: "either", filter });
export const tAnySpell = (filter) => ({ what: "any", who: "either", filter });
export const tSetSpell = (filter) => ({ what: "setSpell", who: "either", filter });
export const tOwnGyMonster = (filter) => ({ what: "gyMonster", who: "self", filter });

/* ---------- cost helpers ---------- */
/** Map choose() indices or uids onto at most `n` cards from a snapshot pool. */
export function resolveChosenFromPool(pool, idxs, n) {
  const k = Math.min(Math.max(0, n | 0), pool.length);
  if (!k) return [];
  const byUid = new Map(pool.map((c, i) => [c.uid, i]));
  const used = new Set();
  const picks = [];
  const tryAdd = (i) => {
    if (i == null || i < 0 || i >= pool.length || used.has(i) || !pool[i]) return;
    used.add(i);
    picks.push(pool[i]);
  };
  for (const raw of idxs || []) {
    if (picks.length >= k) break;
    const asNum = Number(raw);
    const inRange = Number.isInteger(asNum) && asNum >= 0 && asNum < pool.length;
    if (inRange) tryAdd(asNum);
    else if (byUid.has(raw)) tryAdd(byUid.get(raw));
    else if (byUid.has(asNum)) tryAdd(byUid.get(asNum));
  }
  for (let i = 0; i < pool.length && picks.length < k; i++) tryAdd(i);
  return picks.slice(0, k);
}

export function discardNFromHand(G, p, n, { except = null, idxs = null, isCost = false } = {}) {
  const pl = P(G, p);
  const pool = pl.hand.filter((c) => c !== except && c.loc === "hand");
  const picks = resolveChosenFromPool(pool, idxs, n);
  const evs = [];
  for (const c of picks) {
    if (!c || c.loc !== "hand") continue;
    const ev = discardCard(G, c, { isCost });
    if (ev) evs.push(ev);
  }
  if (evs.length) pushEvents(G, evs);
  return evs;
}

export const costDiscardSelf = () => async (G, card) => {
  const ev = discardCard(G, card, { isCost: true });
  pushEvents(G, [ev]);
};
export const costDiscardRandom = () => async (G, card) => {
  const pl = P(G, card.controller);
  const others = pl.hand.filter((c) => c !== card && c.loc === "hand");
  if (!others.length) return;
  const pick = others[G.rng.int(others.length)];
  const ev = discardCard(G, pick, { isCost: true });
  pushEvents(G, [ev]);
};
export const costDiscardChosen = () => async (G, card) => {
  const pl = P(G, card.controller);
  const others = pl.hand.filter((c) => c !== card && c.loc === "hand");
  if (!others.length) return false;
  const idxs = await G.io.choose(card.controller, {
    title: "Choose 1 card to discard as cost",
    options: others.map((c) => c.def.name),
    min: 1, max: 1, kind: "cost", uids: others.map((c) => c.uid)
  });
  const evs = discardNFromHand(G, card.controller, 1, { except: card, idxs, isCost: true });
  return evs.length > 0;
};
export const costTributeSelf = () => async (G, card) => {
  const ev = sendToGY(G, card, { kind: "tribute" });
  pushEvents(G, [ev]);
};

export async function searchDeckToHand(G, p, filter, title = "Add 1 card from your deck") {
  const pl = P(G, p);
  const pool = pl.deck.filter(filter);
  if (!pool.length) return null;
  let pick = pool[0];
  if (pool.length > 1 && G.io?.choose) {
    const idxs = await G.io.choose(p, {
      title,
      options: pool.map((c) => c.def.name),
      min: 1, max: 1, kind: "search", uids: pool.map((c) => c.uid)
    });
    pick = resolveChosenFromPool(pool, idxs, 1)[0] || pick;
  }
  const i = pl.deck.indexOf(pick);
  if (i >= 0) pl.deck.splice(i, 1);
  pick.loc = "hand";
  pl.hand.push(pick);
  log(G, `${p === 0 ? "You add" : "AI adds"} ${pick.def.name} from the deck.`, "draw");
  return pick;
}

export const discardChosenN = (n) => async (G, card) => {
  const want = Math.max(0, n | 0);
  const pl = P(G, card.controller);
  const others = pl.hand.filter((c) => c !== card && c.loc === "hand");
  const k = Math.min(want, others.length);
  if (!k) return true;
  const idxs = await G.io.choose(card.controller, {
    title: `Discard ${k} card${k === 1 ? "" : "s"}`,
    options: others.map((c) => c.def.name),
    min: k, max: k, kind: "discard", uids: others.map((c) => c.uid)
  });
  discardNFromHand(G, card.controller, k, { except: card, idxs });
  return true;
};

/* ---------- misc ---------- */
export const enemyMonsters = (G, p) => monstersOf(G, opp(p)).filter((m) => m.faceup);
export { healMonster };

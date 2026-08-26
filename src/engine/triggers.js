// Trigger effects: detection after events, missing-the-timing, SEGOC ordering.
//
// Rules implemented:
// - Mandatory triggers and "if ..." triggers ALWAYS activate after their event
//   (queued for the next chain, never lost).
// - Optional "when ... you can" triggers activate only if their triggering event
//   is among the LAST THINGS to happen when triggers are checked. Dying at CL2+,
//   being discarded as a cost, or being tributed all miss the timing.
// - SEGOC: simultaneous triggers enter the chain as
//   TP-mandatory -> NTP-mandatory -> TP-optional -> NTP-optional,
//   each player ordering their own bucket, optional ones may be declined.

import { P, opp, log, newEvents, markEventsChecked, allFieldCards } from "./state.js";

// Cards whose triggers are "live": face-up on field, plus cards in GY/banished
// whose trigger defs declare they fire from there (fromGY etc.).
function triggerSources(G) {
  const out = [];
  for (const c of allFieldCards(G)) if (c.faceup && !c.negated) out.push(c);
  for (let p = 0; p < 2; p++) {
    for (const c of P(G, p).gy) if (c.def.triggers?.some((t) => t.from === "gy")) out.push(c);
  }
  return out;
}

function oncePerTurnUsed(G, card, trig) {
  card._trigTurns ||= {};
  return trig.oncePerTurn && card._trigTurns[trig.id] === G.turnCount;
}
function markTrigUsed(G, card, trig) {
  card._trigTurns ||= {};
  card._trigTurns[trig.id] = G.turnCount;
}

/* Collect triggers for events since the last check. Consumes the events. */
export function collectTriggers(G) {
  const evts = newEvents(G);
  markEventsChecked(G);
  if (!evts.length) return [];
  const found = [];
  for (const card of triggerSources(G)) {
    for (const trig of card.def.triggers || []) {
      if (card._queued || oncePerTurnUsed(G, card, trig)) continue;
      if (trig.from === "gy" && card.loc !== "gy") continue;
      if (trig.from !== "gy" && card.loc === "gy") continue;
      const ev = evts.find((e) => trig.match(G, card, e));
      if (!ev) continue;
      const optional = trig.optional !== false && trig.whenVsIf === "when";
      if (optional && !G.lastThings.includes(ev)) {
        log(G, `${card.def.name} misses the timing — its trigger was not the last thing to happen, so the optional "when... you can" window is gone.`, "miss");
        card._queued = true; // the chance is consumed forever
        continue;
      }
      found.push({ card, trig, ev });
      card._queued = true;
      if (trig.oncePerTurn) markTrigUsed(G, card, trig);
    }
  }
  return found;
}

/* Order collected triggers per SEGOC and let players decline/optionally order.
   Returns chain-link-ready descriptors in activation order (CL1 first). */
export async function segocOrder(G, found) {
  const tp = G.tp, ntp = opp(tp);
  const bucket = (p, optional) =>
    found.filter((f) => f.card.controller === p && (f.trig.optional !== false) === optional);

  const ordered = [];
  for (const [p, optional] of [[tp, false], [ntp, false], [tp, true], [ntp, true]]) {
    let items = bucket(p, optional);
    if (!items.length) continue;
    if (optional) {
      // Player chooses which optional triggers to activate, in order.
      const picks = await G.io.choose(p, {
        title: `${p === 0 ? "Your" : "AI's"} optional triggered effects — choose any, in chain order`,
        options: items.map((f) => `${f.card.def.name}: ${f.trig.text}`),
        min: 0, max: items.length, kind: "triggerOrder",
        ordered: true
      });
      items = picks.map((i) => items[i]);
      // Declined triggers are consumed (their window has passed).
    } else if (items.length > 1) {
      const picks = await G.io.choose(p, {
        title: `${p === 0 ? "Your" : "AI's"} mandatory triggers — choose chain order`,
        options: items.map((f) => `${f.card.def.name}: ${f.trig.text}`),
        min: items.length, max: items.length, kind: "triggerOrder",
        ordered: true
      });
      items = picks.map((i) => items[i]);
    }
    ordered.push(...items);
  }
  return ordered;
}

/* Clear per-window trigger flags after a response window fully closes. */
export function clearTriggerFlags(G) {
  for (let p = 0; p < 2; p++) {
    const pl = P(G, p);
    const all = [...pl.mz, ...pl.stz, ...pl.hand, ...pl.gy, ...pl.ban];
    for (const c of all) if (c) c._queued = false;
  }
}

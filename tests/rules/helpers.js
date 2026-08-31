// Scenario builders + configurable decision drivers for deterministic rules tests.
import {
  newGame, makeCard, P, firstFreeSTZ, placeMonster
} from "../../src/engine/index.js";
import { CARD_DB } from "../../src/data/cards/index.js";

const BRONZE_DB = CARD_DB;

export function mkState(seed = 1, laneDefs = []) {
  const G = newGame({ seed, laneDefs });
  G.cardDb = CARD_DB;
  G.io = makeDriver({});
  return G;
}

export function addHand(G, p, id) {
  const c = makeCard(id, BRONZE_DB[id], p);
  c.loc = "hand";
  P(G, p).hand.push(c);
  return c;
}

export function addField(G, p, id, z = null, { summonedTurn = 0 } = {}) {
  const c = makeCard(id, BRONZE_DB[id], p);
  placeMonster(G, c, p, z);
  c.summonedTurn = summonedTurn;
  return c;
}

export function addSet(G, p, id, z = null, setTurn = 0) {
  const c = makeCard(id, BRONZE_DB[id], p);
  const pl = P(G, p);
  const zz = z ?? firstFreeSTZ(G, p);
  c.loc = "stz"; c.zone = zz; c.faceup = false; c.setTurn = setTurn;
  pl.stz[zz] = c;
  return c;
}

export function addGy(G, p, id) {
  const c = makeCard(id, BRONZE_DB[id], p);
  c.loc = "gy";
  P(G, p).gy.push(c);
  return c;
}

export function addDeck(G, p, ids) {
  for (const id of ids) {
    const c = makeCard(id, BRONZE_DB[id], p);
    c.loc = "deck";
    P(G, p).deck.push(c);
  }
}

/* A driver whose every decision can be overridden; defaults: pass on chains,
   accept all triggers, first option on targets/discards, end phases, no attacks. */
export function makeDriver(handlers = {}) {
  const rec = { asks: [], mains: [], choices: [] };
  return {
    rec,
    onLog: handlers.onLog || (() => {}),
    onLaneReveal: handlers.onLaneReveal,
    onEvolve: handlers.onEvolve,
    async choose(p, req) {
      rec.choices.push({ p, kind: req.kind, title: req.title });
      if (handlers.choose) return handlers.choose(p, req);
      if (req.kind === "triggerOrder") return req.options.map((_, i) => i);
      return Array.from({ length: Math.max(1, req.min) }, (_, i) => i);
    },
    async askChain(p, legal, chain, extra) {
      rec.asks.push({ p, legal: legal.map((a) => a.card.def.id), extra });
      if (handlers.askChain) return handlers.askChain(p, legal, chain, extra);
      return null;
    },
    async chooseMain(p, actions) {
      rec.mains.push({ p, phase: actions.length ? actions[actions.length - 1].label : "", turn: undefined });
      if (handlers.chooseMain) return handlers.chooseMain(p, actions);
      return actions.find((a) => a.type === "end");
    },
    async askAttack(p, attackers, targetsFn, battleActs) {
      if (handlers.askAttack) return handlers.askAttack(p, attackers, targetsFn, battleActs);
      return null;
    },
    async askMulligan() { return []; },
    async askComeback() { return "draw"; }
  };
}

export const logText = (G) => G.log.map((l) => l.msg).join("\n");
export const gyIds = (G, p) => P(G, p).gy.map((c) => c.id);
export const handIds = (G, p) => P(G, p).hand.map((c) => c.id);

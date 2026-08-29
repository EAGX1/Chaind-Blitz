// Autopilot: an io implementation that plays the game with heuristics.
// Used for AI opponents, AI-vs-AI spectate mode, and deterministic engine tests.

import { P, opp, findCard, getATK, monstersOf, canAttack, laneForZone } from "../engine/index.js";
import { budgetFor } from "./budgets.ts";
import { pickAttack, pickChain, scoreMainAct } from "./cpuIntent.js";

function resolveTier(opts) {
  const raw = typeof opts.getTier === "function" ? opts.getTier() : (opts.tier || "normal");
  if (raw === "easy" || raw === "hard") return raw;
  return "normal";
}

export function makeAutopilot(G, opts = {}) {
  const style = { ...opts };
  const tierNow = () => resolveTier(style);
  const depthNow = () => budgetFor(tierNow()).depth;

  const worstOwnCardIdxs = (p, req) => {
    const pool = req.uids || [];
    const n = Math.min(Math.max(0, Number.isFinite(req.min) ? req.min : 1), pool.length);
    const scored = pool.map((uid, i) => {
      const c = findCard(G, uid);
      return { i, cost: c?.def?.cost ?? 0 };
    });
    scored.sort((a, b) => a.cost - b.cost);
    return scored.slice(0, n).map((s) => s.i);
  };

  const targetIdx = (p, req) => {
    // Role-based: heal own most-damaged, remove the biggest enemy threat
    // (Ward first on ties), buff the biggest attacker.
    const uids = req.uids || [];
    const cards = uids.map((uid) => findCard(G, uid)).filter(Boolean);
    const ownSide = cards.length > 0 && cards.every((c) => c.controller === p);
    const title = String(req.title || "").toLowerCase();
    const healish = /heal|restore|mend|recover/.test(title);
    let best = 0, bestS = -Infinity;
    uids.forEach((uid, i) => {
      const c = findCard(G, uid);
      if (!c) return;
      let s = getATK(G, c);
      if (ownSide && healish) s = (c.dmg || 0) * 10 + getATK(G, c) * 0.1;
      else if (!ownSide && c.def?.keywords?.includes("ward")) s += 0.5;
      if (s > bestS) { bestS = s; best = i; }
    });
    return best;
  };

  const scoreMain = (p, act) =>
    scoreMainAct(G, p, act, { tier: tierNow(), depth: depthNow() });

  const zoneKind = (act) => {
    if (!act) return null;
    if (act.type === "summon" || act.type === "ambushSet" || act.type === "contactFusion") return "mz";
    if (act.type === "set") return "stz";
    if (act.type === "activate" && act.card?.def?.spell?.subtype === "continuous") return "stz";
    return null;
  };

  const bestZone = (p, kind) => {
    const pl = P(G, p);
    let best = -1, bestS = -Infinity;
    for (let z = 0; z < 6; z++) {
      if (pl[kind][z]) continue;
      const lane = G.lanes?.[laneForZone(z)];
      if (kind === "mz" && lane?.revealed && lane.def.locksZone?.(G, lane, p, z)) continue;
      if (kind === "stz" && lane?.revealed && lane.def.locksSpellZone?.(G, lane, p, z)) continue;
      let s = 1;
      if (lane?.revealed) {
        const d = lane.def;
        if (d.noAttack && kind === "mz") s -= 5;
        if (d.onSummon && kind === "mz") s += 4;
        if (d.modifyStat && kind === "mz") s += 2;
        if (d.locksSpellZone && kind === "stz") s -= 8;
      }
      if (s > bestS) { bestS = s; best = z; }
    }
    return best >= 0 ? best : null;
  };

  return {
    onLog: opts.onLog || (() => {}),

    async askMulligan(p, hand) {
      // Opener roles: keep one hand trap and a playable curve; bounce bricks
      // and cheap clutter beyond what the first turns can use.
      const traps = hand.filter((c) => c.def?.handTrap || c.def?.spell?.handTrap);
      const keep = new Set(traps.slice(0, 1).map((c) => c.uid));
      const bricks = hand.filter((c) => (c.def?.cost || 0) >= 6 && !keep.has(c.uid));
      const cheap = hand.filter((c) => (c.def?.cost || 0) <= 1 && !keep.has(c.uid));
      const bounce = [];
      for (const c of bricks.slice(1)) bounce.push(c.uid);
      for (const c of cheap.slice(2)) bounce.push(c.uid);
      return bounce.slice(0, 3);
    },

    async askComeback(p) {
      // Free Evolve pays off when we already have a body; otherwise draw.
      const mine = monstersOf(G, p).length;
      const theirs = monstersOf(G, opp(p)).length;
      return mine > 0 && mine >= theirs ? "evolve" : "draw";
    },

    async choose(p, req) {
      if (req.kind === "triggerOrder") {
        if (req.min === 0 && req.max === req.options.length) {
          // optional triggers: accept all, in order
          return req.options.map((_, i) => i);
        }
        return req.options.map((_, i) => i);
      }
      if (req.kind === "gyFusion") {
        const scored = (req.options || []).map((_, i) => ({ i, atk: req.atk?.[i] || 0 }));
        scored.sort((a, b) => b.atk - a.atk);
        return [scored[0]?.i ?? 0];
      }
      if (req.kind === "discard" || req.kind === "cost") return worstOwnCardIdxs(p, req);
      if (req.kind === "tribute") {
        const scored = (req.uids || []).map((uid, i) => {
          const c = findCard(G, uid);
          return { i, atk: c ? getATK(G, c) : 0 };
        });
        scored.sort((a, b) => a.atk - b.atk);
        return scored.slice(0, req.min).map((s) => s.i);
      }
      if (req.kind === "target") {
        const n = Math.max(1, req.min);
        const picks = [];
        const used = new Set();
        for (let k = 0; k < n; k++) {
          let idx = targetIdx(p, { uids: req.uids?.filter((_, i) => !used.has(i)) });
          // map back to original indices
          const remaining = req.uids.map((_, i) => i).filter((i) => !used.has(i));
          const chosen = remaining[idx];
          picks.push(chosen);
          used.add(chosen);
        }
        return picks;
      }
      return Array.from({ length: req.min }, (_, i) => i);
    },

    async askChain(p, legal, chain) {
      return pickChain(G, p, legal, chain, { tier: tierNow(), counterGreed: style.counterGreed });
    },

    async chooseMain(p, actions) {
      let best = actions[actions.length - 1], bestScore = 0;
      for (const act of actions) {
        const s = scoreMain(p, act);
        if (s > bestScore) { bestScore = s; best = act; }
      }
      const kind = zoneKind(best);
      if (kind) return { ...best, zone: bestZone(p, kind) };
      return best;
    },

    async askAttack(_p, attackers, targetsFn) {
      return pickAttack(G, attackers, targetsFn, { snipeLethal: tierNow() !== "easy" });
    }
  };
}

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
    // enemy targets: highest ATK. own targets: highest ATK (buffs) — either way biggest.
    let best = 0, bestAtk = -1;
    (req.uids || []).forEach((uid, i) => {
      const c = findCard(G, uid);
      const atk = c ? getATK(G, c) : 0;
      if (atk > bestAtk) { bestAtk = atk; best = i; }
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
      // Keep high-cost bombs; mulligan cost-1 clutter if hand is heavy
      const bounce = hand.filter((c) => (c.def?.cost || 0) <= 1).slice(0, 2).map((c) => c.uid);
      return bounce;
    },

    async askComeback(_p) {
      return "draw";
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

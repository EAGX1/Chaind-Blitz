import { AI_BUDGETS, budgetFor } from "./budgets.ts";

function scoreMain(act, depth = 2) {
  const n = typeof act.cost === "number" ? act.cost : 0;
  let s = 1;
  switch (act.type) {
    case "contactFusion": s = 11 + (depth >= 3 ? 2 : depth <= 1 ? -4 : 0); break;
    case "summon": s = 6 + n * 0.2 - (act.tributes || 0) * 0.4; break;
    case "evolve": s = 8; break;
    case "activate":
      if (act.cardId === "research_burn" && (act.handRest ?? 9) >= 3) s = 0;
      else if (act.enemyCount >= 2 && (act.cardId === "starfall" || act.cardId === "lightning_tempest" || act.cardId === "empty_sky")) s = 12;
      else if (act.cardId === "helix_shot" || act.cardId === "twin_cut" || act.cardId === "equal_cut") s = 8;
      else s = 5;
      break;
    case "ambushSet": s = 5; break;
    case "set":
      if (act.handTrap) s = depth >= 3 ? 0 : 2;
      else if (act.cardId === "helix_shot" || act.cardId === "twin_cut" || act.cardId === "equal_cut") s = 6;
      else s = 2 + (depth >= 3 && act.speed === 3 ? 3 : 0);
      break;
    case "end": s = 0; break;
    default: s = 1;
  }
  if (act.lethalFace) s += 20;
  return s;
}

function scoreChain(act) {
  if (act.lastIsOurs && act.speed === 3) return 0;
  if (act.type === "set" && act.speed === 3) return 9;
  if (act.type === "handQuick" || act.type === "hand") return 6;
  if (act.type === "quick") return 3;
  return 2;
}

/** Hint-only: pick a labelled action. Live duels use makeAutopilot, not this loop. */
function heuristicPick(actions, scoreFn) {
  let best = actions[0] ?? null;
  let bestScore = -Infinity;
  const pv = [];
  for (const act of actions) {
    const s = scoreFn(act);
    if (s > bestScore) {
      bestScore = s;
      best = act;
    }
  }
  if (best) pv.push(best.label || best.type || "?");
  return { pick: best, pv };
}

self.onmessage = (ev) => {
  const msg = ev.data;
  const budget = budgetFor(msg.tier);
  let result;

  if (msg.type === "hint") {
    const { pick, pv } = heuristicPick(msg.actions || [], (a) => scoreMain(a, budget.depth));
    result = { id: msg.id, pick, pv, timedOut: false, budgetMs: budget.ms };
  } else if (msg.type === "think") {
    result = { id: msg.id, pick: null };
  } else {
    result = { id: msg.id, pick: null };
  }

  self.postMessage(result);
};

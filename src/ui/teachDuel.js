// First-duel coach: teach by highlighting the next legal click, not a rulebook.
import { P, monstersOf, isFirstTurnNoBattle, canEvolveNow, cannotAttackReason } from "../engine/state.js";

export function isTeachDuel(G) {
  if (!G) return false;
  if (G.meta?.labs) return false;
  return typeof globalThis !== "undefined" && !!globalThis.__CB_TEACH;
}

/** What the first duel wants you to click right now. */
export function teachStep(G) {
  if (!G) return null;
  if (G.tp !== 0) {
    return { id: "watch", tip: "Foe's turn. Illegal clicks stay grey — tap one to see why." };
  }
  const pl = P(G, 0);
  const field = monstersOf(G, 0);
  if ((G.phase === "M1" || G.phase === "M2") && !pl.normalSummoned) {
    return {
      id: "summon",
      tip: "Click a glowing Level 4 monster to Normal Summon. DEF is a health pool here — damage sticks as wounds; there are no battle positions."
    };
  }
  if ((G.phase === "M1" || G.phase === "M2") && canEvolveNow(G, 0) && field.length) {
    return {
      id: "evolve",
      tip: "Evolve ready: click a monster you control, then pick Evolve. +2/+2 and Rush for 1 EP."
    };
  }
  if (G.phase === "M1" && isFirstTurnNoBattle(G)) {
    return {
      id: "endFirst",
      tip: "First turn: no Battle Phase. Click the golden orb to end the turn."
    };
  }
  if (G.phase === "M1" || G.phase === "M2") {
    return {
      id: "main",
      tip: "Main Phase: click a glowing card, or the orb to go to Battle. Grey cards stay dead with a reason."
    };
  }
  if (G.phase === "BP") {
    return {
      id: "attack",
      tip: "Battle: click an attacker, then a target — combat compares ATK against ATK, and wounds stick. A blue WARD badge must be attacked first."
    };
  }
  return { id: "phase", tip: "Click the golden orb to advance the phase." };
}

function preferredSummon(actions) {
  const free = actions.filter((a) => a.type === "summon" && (a.tributes || 0) === 0);
  return free[0] || actions.find((a) => a.type === "summon") || null;
}

/** Highlight this action's card (or the end orb). Does not block other legal plays. */
export function teachRecommended(G, actions = []) {
  if (!isTeachDuel(G)) return null;
  const step = teachStep(G);
  if (!step) return null;
  if (step.id === "summon") return preferredSummon(actions);
  if (step.id === "evolve") return actions.find((a) => a.type === "evolve") || null;
  if (step.id === "endFirst") return actions.find((a) => a.type === "end") || null;
  if (step.id === "attack") return null;
  return null;
}

export function teachCoachLine(G) {
  if (!isTeachDuel(G) && !G?.meta?.labs) return "";
  return teachStep(G)?.tip || "";
}

export function teachAttackHint(G, attackers = []) {
  if (!isTeachDuel(G) || G.phase !== "BP") return null;
  const ready = attackers.find((a) => !cannotAttackReason(G, a));
  return ready || attackers[0] || null;
}

// First-duel coach: teach by highlighting the next legal click, not a rulebook.
import { P, monstersOf, isFirstTurnNoBattle, canEvolveNow, cannotAttackReason } from "../engine/state.js";
import { comboTagsFor, CIRCUITS } from "../data/comboTags.js";

export function isTeachDuel(G) {
  if (!G) return false;
  if (G.meta?.labs) return false;
  if (G.meta?.teachLesson) return true;
  return typeof globalThis !== "undefined" && !!globalThis.__CB_TEACH;
}

function handHasSpell(G, p) {
  return (P(G, p).hand || []).some((c) => c?.def?.type === "spell");
}

function alreadySet(G, p) {
  return P(G, p).stz.some(Boolean);
}

function chainableSet(G, p) {
  return P(G, p).stz.filter((c) => c && !c.faceup && c.setTurn !== G.turnCount);
}

/** What the first duel wants you to click right now. */
export function teachStep(G) {
  if (!G) return null;
  if (G.tp !== 0) {
    if (chainableSet(G, 0).length) {
      return {
        id: "chain",
        tip: "Chain: when a card glows, click your Set to answer. Pass if nothing applies."
      };
    }
    return { id: "watch", tip: "Foe's turn. Illegal clicks stay grey — tap one to see why." };
  }
  const pl = P(G, 0);
  const field = monstersOf(G, 0);
  if ((G.phase === "M1" || G.phase === "M2") && canEvolveNow(G, 0) && field.length) {
    return {
      id: "evolve",
      tip: "Evolve ready: click a monster you control, then pick Evolve. +2/+2 and Rush for 1 EP."
    };
  }
  if ((G.phase === "M1" || G.phase === "M2") && !pl.normalSummoned) {
    return {
      id: "summon",
      tip: "Click a glowing Level 4 monster to Normal Summon. DEF is a health pool here — damage sticks as wounds; there are no battle positions."
    };
  }
  if ((G.phase === "M1" || G.phase === "M2") && !alreadySet(G, 0) && handHasSpell(G, 0)) {
    return {
      id: "set",
      tip: "Click a glowing spell to Set it face-down. You'll chain it on their turn — traps cannot activate the turn they are Set."
    };
  }
  if (G.phase === "M1" && isFirstTurnNoBattle(G)) {
    return {
      id: "endFirst",
      tip: "First turn: no Battle Phase. Click the golden orb to end the turn."
    };
  }
  if (G.phase === "M1" || G.phase === "M2") {
    const combo = comboLiveTip(G);
    return {
      id: "main",
      tip: combo
        || "Main Phase: click a glowing card, or the orb to go to Battle. Grey cards stay dead with a reason."
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

function comboLiveTip(G) {
  const field = [...P(G, 0).mz, ...P(G, 0).stz].filter((c) => c && c.faceup);
  if (!field.length) return "";
  const enables = new Set();
  const pays = new Set();
  for (const c of field) {
    const t = comboTagsFor(c.id);
    for (const x of t.enables) enables.add(x);
    for (const x of t.pays) pays.add(x);
  }
  for (const c of P(G, 0).hand || []) {
    const t = comboTagsFor(c.id);
    const hit = t.pays.find((x) => enables.has(x)) || t.enables.find((x) => pays.has(x));
    if (!hit) continue;
    const name = c.def?.name || c.id;
    return `Pulsing ring: ${name} combos with a card on your board (${CIRCUITS[hit].label}). Play it to pay off.`;
  }
  return "";
}

function preferredSummon(actions) {
  const free = actions.filter((a) => a.type === "summon" && (a.tributes || 0) === 0);
  return free[0] || actions.find((a) => a.type === "summon") || null;
}

function preferredSet(actions) {
  const sets = actions.filter((a) => a.type === "set");
  return sets.find((a) => a.card?.def?.spell?.speed === 3) || sets[0] || null;
}

/** Highlight this action's card (or the end orb). Does not block other legal plays. */
export function teachRecommended(G, actions = []) {
  if (!isTeachDuel(G)) return null;
  const step = teachStep(G);
  if (!step) return null;
  if (step.id === "summon") return preferredSummon(actions);
  if (step.id === "set") return preferredSet(actions);
  if (step.id === "evolve") return actions.find((a) => a.type === "evolve") || null;
  if (step.id === "endFirst") return actions.find((a) => a.type === "end") || null;
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

export function teachChainHint(G, legal = []) {
  if (!isTeachDuel(G) || !legal.length) return null;
  return legal.find((a) => a.type === "set") || legal[0];
}

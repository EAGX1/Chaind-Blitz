// CPU Battle + chain telegraph. Same heuristic as autopilot — not a search.

import { P, opp, getATK, remainingHealth, cardByUid, monstersOf } from "../engine/index.js";
import { previewCombat } from "../engine/state.js";

/**
 * Pick the next attack the CPU would declare, or null to end Battle.
 * @param {{ snipeLethal?: boolean }} opts Easy skips the lethal-direct snipe.
 */
export function pickAttack(G, attackers, targetsFn, { snipeLethal = true } = {}) {
  if (!attackers?.length) return null;
  const p = attackers[0].controller;
  const enemyLp = P(G, opp(p)).lp;
  const sorted = [...attackers].sort((a, b) => getATK(G, b) - getATK(G, a));
  if (snipeLethal) {
    for (const a of sorted) {
      const { canDirect } = targetsFn(a);
      const aAtk = getATK(G, a);
      if (canDirect && aAtk >= enemyLp) return { attackerUid: a.uid, targetUid: null };
    }
  }
  for (const a of sorted) {
    const { foes, canDirect } = targetsFn(a);
    if (canDirect) return { attackerUid: a.uid, targetUid: null };
    const aAtk = getATK(G, a);
    const killable = foes
      .filter((f) => aAtk >= remainingHealth(G, f) && remainingHealth(G, a) > getATK(G, f))
      .sort((x, y) => getATK(G, y) - getATK(G, x));
    if (killable.length) return { attackerUid: a.uid, targetUid: killable[0].uid };
  }
  for (const a of sorted) {
    const { foes } = targetsFn(a);
    if (!foes.length) continue;
    const aAtk = getATK(G, a);
    const ranked = [...foes].sort((x, y) => {
      const xKill = aAtk >= remainingHealth(G, x) ? 1 : 0;
      const yKill = aAtk >= remainingHealth(G, y) ? 1 : 0;
      if (xKill !== yKill) return yKill - xKill;
      return getATK(G, y) - getATK(G, x);
    });
    return { attackerUid: a.uid, targetUid: ranked[0].uid };
  }
  return null;
}

/** Player-facing line for the vs-CPU Battle chip. */
export function describeCpuIntent(G, choice) {
  const base = { heuristic: true };
  if (!choice) {
    return { ...base, kind: "pass", line: "CPU will end Battle", lethal: false };
  }
  const atk = cardByUid(G, choice.attackerUid);
  if (!atk) {
    return { ...base, kind: "unknown", line: "CPU will attack", lethal: false };
  }
  const target = choice.targetUid == null ? null : cardByUid(G, choice.targetUid);
  const prev = previewCombat(G, atk, target);
  const atkName = atk.def?.name || "a monster";
  if (prev.kind === "direct") {
    return {
      ...base,
      kind: "direct",
      line: prev.lethal
        ? `CPU will Direct ${prev.aAtk} with ${atkName} — LETHAL`
        : `CPU will Direct ${prev.aAtk} with ${atkName}`,
      lethal: !!prev.lethal,
      attackerUid: atk.uid,
      targetUid: null,
      facePlayer: opp(atk.controller),
      prev
    };
  }
  const foeName = target?.def?.name || "a monster";
  const tag = prev.theyDie ? " (they die)" : prev.youDie ? " (you die)" : "";
  return {
    ...base,
    kind: "battle",
    line: `CPU will attack ${foeName}${tag}`,
    lethal: false,
    theyDie: !!prev.theyDie,
    attackerUid: atk.uid,
    targetUid: target?.uid ?? null,
    prev
  };
}

function isHandTrap(d) {
  return !!(d?.handTrap || d?.spell?.handTrap);
}

function enemySetCount(G, p) {
  return P(G, opp(p)).stz.filter((c) => c && !c.faceup).length;
}

function wipeNeed(tier) {
  return tier === "easy" ? 4 : 2;
}

/** Main-phase heuristic. Live duels use this — not a search. */
export function scoreMainAct(G, p, act, { tier = "normal", depth = 2 } = {}) {
  if (act.type === "undo") return -99;
  const d = act.card?.def;
  const numCost = typeof d?.cost === "number" ? d.cost : 0;
  switch (act.type) {
    case "summon": {
      const trib = act.tributes || 0;
      return 6 + numCost * 0.2 + (d?.keywords?.includes("rush") ? 1 : 0) - trib * 0.4;
    }
    case "evolve": {
      const pl = P(G, p);
      const canKill = monstersOf(G, opp(p)).length > 0 || pl.ep > 2;
      const base = canKill ? 8 + getATK(G, act.card) * 0.1 : 4;
      if (tier === "easy") return base * 0.4;
      if (tier === "hard") return base + 3;
      return base;
    }
    case "activate": {
      if (!d) return 0;
      if (isHandTrap(d)) return tier === "easy" ? 1 : 0;
      if (d.id === "starfall" || d.id === "lightning_tempest" || d.id === "empty_sky") {
        const enemyCount = monstersOf(G, opp(p)).length;
        const enemySpells = P(G, opp(p)).stz.filter(Boolean).length;
        const n = d.id === "empty_sky" ? Math.max(enemyCount, enemySpells) : enemyCount;
        return n >= wipeNeed(tier) ? 12 : 0;
      }
      if (d.id === "both_boards" || d.id === "scream_home") {
        const mine = monstersOf(G, p).length;
        const theirs = monstersOf(G, opp(p)).length;
        if (theirs < wipeNeed(tier)) return 0;
        if (d.id === "scream_home" && mine > theirs) return 0;
        return 11;
      }
      if (d.id === "research_burn") {
        const rest = P(G, p).hand.filter((c) => c !== act.card).length;
        if (rest >= 3) return 0;
        if (rest >= 2 && tier !== "hard") return 0;
        return rest <= 1 ? 7.2 : 4.2;
      }
      if (d.id === "scroll_greed") return 4.2;
      if (d.id === "moonwell") return P(G, p).lp <= 10 ? 6 : 0;
      if (d.id === "tactic_choice") return 6.6;
      return 5;
    }
    case "set": {
      if (!d) return 1;
      if (isHandTrap(d)) return tier === "easy" ? 1.2 : 0;
      if (d.id === "helix_shot") return 5.8 + (tier === "hard" ? 0.5 : 0);
      if (d.id === "twin_cut") return enemySetCount(G, p) ? 6.2 : 0.4;
      if (d.id === "equal_cut") {
        return monstersOf(G, p).length < monstersOf(G, opp(p)).length ? 6.4 : 0.4;
      }
      if (d.spell?.speed === 3) return 5.5 + (depth >= 3 ? 2.2 : depth <= 1 ? -1.5 : 0);
      if (d.spell?.subtype === "quick") return 4.5 + (depth >= 3 ? 0.8 : 0);
      return 1;
    }
    case "activateSet": {
      if (!d) return 3;
      if (d.id === "helix_shot") return 7.5;
      if (d.id === "twin_cut") return enemySetCount(G, p) ? 8 : 1;
      if (d.id === "equal_cut") {
        return monstersOf(G, p).length < monstersOf(G, opp(p)).length ? 8.2 : 1;
      }
      return d.spell?.subtype === "continuous" ? 5 : 3;
    }
    case "ignition": return 6;
    case "contactFusion": {
      const fus = act.fusion?.def;
      const mats = act.materials || [];
      if (!fus || mats.length < 2) return 0;
      const myN = monstersOf(G, p).length;
      const theirN = monstersOf(G, opp(p)).length;
      const after = myN - mats.length + 1;
      const fusAtk = fus.atk || 0;
      const maxMat = Math.max(0, ...mats.map((m) => m.def?.atk || 0));
      const maxCost = Math.max(0, ...mats.map((m) => m.def?.cost || 0));
      const rush = fus.keywords?.includes("rush");
      if (maxCost <= 1) return 1.2;
      if (!rush && after < theirN) return 1.5;
      if (fusAtk <= maxMat && !rush) return 1.8;
      let s = 5.2 + (rush ? 1.4 : 0) + Math.max(0, fusAtk - maxMat) * 0.12;
      if (depth <= 1) s *= 0.35;
      if (depth >= 3) s += 1.8;
      return s;
    }
    case "ambushSet": return 5;
    case "end": return 0;
    default: return 0;
  }
}

export function scoreChainAct(G, p, act, chain, { tier = "normal", counterGreed } = {}) {
  const d = act.card.def;
  const last = chain?.[chain.length - 1];
  const greed = counterGreed ?? (tier === "easy" ? 2 : tier === "hard" ? 9 : 6);
  if (act.type === "set" && d.spell?.speed === 3) {
    if (!last || last.controller === p) return 0;
    const lastCost = last.card?.def?.cost ?? 0;
    if ((d.spell.counterWhat || []).includes("summon")) {
      return lastCost >= 4 ? 10 : 0;
    }
    return greed + Math.min(3, lastCost);
  }
  if (isHandTrap(d) || act.type === "handQuick") {
    if (!last || last.controller === p) return 0;
    const id = d.id;
    const kind = last.kind;
    const lastType = last.card?.def?.type;
    if (id === "hush_petal") {
      if (kind && kind !== "spell" && lastType !== "spell") return 0;
      return 10;
    }
    if (id === "ash_whisper") {
      if (kind && kind !== "monsterEffect" && kind !== "evolveEffect" && lastType !== "monster") return 0;
      return 10;
    }
    if (id === "ghost_crack") return last.card ? 9 : 0;
    if (id === "veil_needle" || id === "empty_veto") {
      return monstersOf(G, opp(p)).length ? 8.5 : 0;
    }
    if (id === "veil_negate") return 10;
    return 8;
  }
  if (d.spell?.subtype === "quick") {
    const id = d.id;
    if (id === "tidal_snare") return 9;
    if (id === "helix_shot") return 7.4;
    if (id === "twin_cut") return enemySetCount(G, p) ? 8 : 0;
    if (id === "equal_cut") {
      return monstersOf(G, p).length < monstersOf(G, opp(p)).length ? 8.5 : 0;
    }
    if (id === "shatter_sigil" || id === "riptide") {
      return enemySetCount(G, p) ? 6 : 0;
    }
    if (id === "ember_spark" || id === "root_snare") {
      return monstersOf(G, opp(p)).length ? 4 : 0;
    }
    if (id === "call_fallen") {
      return P(G, p).gy.some((c) => c.def.type === "monster" && c.def.cost >= 4) ? 7 : 0;
    }
    if (id === "mind_surge") return 3;
    return 2;
  }
  if (act.type === "quick") return 3;
  if (act.type === "handQuick") return 8;
  return 0;
}

/** Index into `legal`, or null to pass. Same heuristic as autopilot.askChain. */
export function pickChain(G, p, legal, chain, opts = {}) {
  if (!legal?.length) return null;
  const tier = opts.tier || "normal";
  const minScore = tier === "easy" ? 8 : 0;
  let best = null;
  let bestScore = minScore;
  legal.forEach((act, i) => {
    const s = scoreChainAct(G, p, act, chain, opts);
    if (s > bestScore) {
      bestScore = s;
      best = i;
    }
  });
  return best;
}

/** Player-facing line for the vs-CPU chain chip. Heuristic — not a search. */
export function describeCpuChainIntent(G, legal, pick) {
  const base = { heuristic: true };
  if (pick == null) {
    return { ...base, kind: "chain-pass", line: "CPU will pass this chain", lethal: false };
  }
  const act = legal?.[pick];
  const name = act?.card?.def?.name || "a card";
  const src = act?.type === "set" ? "Set"
    : (act?.type === "hand" || act?.type === "handQuick") ? "Hand"
      : "Field";
  return {
    ...base,
    kind: "chain",
    line: `CPU will chain ${name} (${src})`,
    lethal: false,
    attackerUid: act?.card?.uid ?? null,
    targetUid: null
  };
}

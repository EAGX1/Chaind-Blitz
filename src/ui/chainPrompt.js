/** Decide whether the human should see a RESPOND? prompt. */

function isHandTrapDef(d) {
  return !!(d?.handTrap || d?.spell?.handTrap);
}

export function shouldPromptChain(mode, p, legal, chain, extra) {
  if (!legal?.length) return false;
  if (mode === "auto" || mode === "off") return false;
  if (mode === "confirm") return true;
  // Attack declaration is the YGO battle window: anyone with a legal
  // response (Mirror Force-style Sets, Honest-like Quicks) must be asked.
  if (extra?.battleWindow === "declare") return true;
  // smart: skip empty / low-threat windows on YOUR turn (those plays are
  // Main Phase CL1). Always ask on damage calc, opponent chain links,
  // counters, hand traps, and Set/Quick answers on the opponent's turn —
  // those have no Main Phase to fall back to.
  if (extra?.damageCalc || extra?.damageStep === "dsDuring") return true;
  const last = chain?.[chain.length - 1];
  if (last && last.controller !== p) return true;
  const theirTurn = extra?.turnPlayer === 0 || extra?.turnPlayer === 1
    ? extra.turnPlayer !== p
    : false;
  return legal.some((act) => {
    const d = act.card?.def;
    const speed = act.speed ?? d?.spell?.speed ?? 0;
    if (speed >= 3) return true;
    if (isHandTrapDef(d) || act.type === "handQuick") return true;
    if (theirTurn && (act.type === "set" || act.type === "quick")) return true;
    return false;
  });
}

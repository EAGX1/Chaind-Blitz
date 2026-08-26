/** Decide whether the human should see a RESPOND? prompt. */

export function shouldPromptChain(mode, p, legal, chain, extra) {
  if (!legal?.length) return false;
  if (mode === "auto" || mode === "off") return false;
  if (mode === "confirm") return true;
  // smart: skip empty / low-threat windows; always ask on damage calc,
  // opponent chain links, counters, and hand traps.
  if (extra?.damageCalc || extra?.damageStep === "dsDuring") return true;
  const last = chain?.[chain.length - 1];
  if (last && last.controller !== p) return true;
  return legal.some((act) => {
    const d = act.card?.def;
    const speed = act.speed ?? d?.spell?.speed ?? 0;
    if (speed >= 3) return true;
    if (d?.spell?.handTrap || act.type === "handQuick") return true;
    return false;
  });
}

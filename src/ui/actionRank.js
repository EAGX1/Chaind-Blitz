/** Field click: Evolve first so glow matches the click. Set is not in this list — it lives on the prompt bar. */
export function rankFieldActions(acts) {
  const order = ["evolve", "summon", "activate", "activateSet", "ignition", "contactFusion", "ambushSet"];
  return (acts || [])
    .filter((a) => a.type !== "set" && a.type !== "end")
    .slice()
    .sort((a, b) => {
      const ia = order.indexOf(a.type);
      const ib = order.indexOf(b.type);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
}

const BAR_TYPES = new Set(["activate", "activateSet", "set", "contactFusion"]);

/** Prompt-bar verbs: Activate and Set for the same spell, plus fusions. */
export function promptBarActs(actions) {
  const out = [];
  const seen = new Set();
  for (const act of actions || []) {
    if (!BAR_TYPES.has(act.type)) continue;
    const key = act.card ? `${act.type}:${act.card.uid}` : `fusion:${act.fusion?.uid || act.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(act);
  }
  return out;
}

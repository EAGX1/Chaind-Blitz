/** Field actions on one card, Evolve first so glow matches the click (Master Duel chooser). Set stays a separate prompt button. */
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

/** Practice coach: a labelled heuristic, not a search. Shown on every vs-CPU Main Phase. */

const PREFER = ["contactFusion", "summon", "activateSet", "activate", "evolve", "ignition", "ambushSet"];

export function practiceCoachLine(actions) {
  const list = actions || [];
  for (const t of PREFER) {
    const a = list.find((x) => x.type === t);
    if (a?.label) return a.label;
  }
  const other = list.find((a) => a.type !== "end" && a.type !== "undo");
  return other?.label || "End the phase when you are done.";
}

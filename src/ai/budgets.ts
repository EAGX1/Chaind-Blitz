/** Think-time plus pick policy. Live duels use board heuristics, not tree search. */

export type AiTier = "easy" | "normal" | "hard";

export type AiBudget = {
  ms: number;
  depth: number;
  label: string;
  feel: string;
};

export const AI_BUDGETS: Record<AiTier, AiBudget> = {
  easy: {
    ms: 120,
    depth: 1,
    label: "Easy",
    feel: "Summons and swings. Skips wipes, tributes, counters, and even trades",
  },
  normal: {
    ms: 300,
    depth: 2,
    label: "Normal",
    feel: "Board heuristic: lethal face, Ward, profitable trades",
  },
  hard: {
    ms: 800,
    depth: 3,
    label: "Hard",
    feel: "Punishes empty boards and unused Evolve. Holds traps, fuses when ahead — still a heuristic",
  },
};

export function budgetFor(tier: string | undefined | null): AiBudget {
  if (tier && tier in AI_BUDGETS) return AI_BUDGETS[tier as AiTier];
  return AI_BUDGETS.normal;
}

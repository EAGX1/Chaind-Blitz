// Ranked tiers + tier-gated card pools.
// Bronze learns on 60 cards; every tier-up adds new cards to the pool.

import { BRONZE_CARDS } from "../data/cards/bronze.js";
import { WAVE_C_CARDS } from "../data/cards/waveC.js";
import { WAVE_D_CARDS } from "../data/cards/waveD.js";
import { WAVE_E_CARDS } from "../data/cards/waveE.js";
import { WAVE_F_CARDS } from "../data/cards/waveF.js";
import { WAVE_G_CARDS } from "../data/cards/waveG.js";
import { SILVER_CARDS } from "../data/cards/silver.js";
import { GOLD_CARDS } from "../data/cards/gold.js";
import { PLATINUM_CARDS } from "../data/cards/platinum.js";
import { EXTRA_CARDS } from "../data/cards/extra.js";

export const TIERS = [
  { name: "Bronze", color: "#cd7f32", lpToPromo: 100 },
  { name: "Silver", color: "#c0c0c0", lpToPromo: 100 },
  { name: "Gold", color: "#ffd700", lpToPromo: 100 },
  { name: "Platinum", color: "#39d0c8", lpToPromo: 100 },
  { name: "Diamond", color: "#6ee7ff", lpToPromo: 100 },
  { name: "Master", color: "#ff6ec7", lpToPromo: Infinity }
];

const SETS_BY_TIER = [
  BRONZE_CARDS,
  [...WAVE_C_CARDS, ...SILVER_CARDS],
  [...WAVE_D_CARDS, ...GOLD_CARDS],
  [...WAVE_E_CARDS, ...EXTRA_CARDS, ...PLATINUM_CARDS],
  WAVE_F_CARDS,
  WAVE_G_CARDS,
];

export function poolForTier(tier) {
  const seen = new Map();
  for (let t = 0; t <= Math.min(tier, SETS_BY_TIER.length - 1); t++) {
    for (const c of SETS_BY_TIER[t]) seen.set(c.id, c);
  }
  return [...seen.values()];
}

export const tierName = (t) => TIERS[Math.min(t, TIERS.length - 1)].name;

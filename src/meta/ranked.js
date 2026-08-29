// Ranked ladder (LoL model): tiers with LP, a Bo3 promo series between tiers,
// and pool expansion on tier-up. Iron-safe floors: you can't drop a tier.

import { TIERS, poolForTier } from "./pools.js";
import { currentSeasonId } from "./duelPass.js";

export const WIN_LP = 20;
export const LOSS_LP = 15;

/**
 * Monthly season roll: soft-reset the ladder (drop two tiers, Master lands on
 * Gold), clear LP and any promo series. Idempotent within a season.
 */
export function ensureSeason(profile, now = new Date()) {
  const r = profile.rank;
  if (!r) return false;
  const season = currentSeasonId(now);
  if (r.seasonId === season) return false;
  const hadSeason = !!r.seasonId;
  r.seasonId = season;
  if (hadSeason) {
    r.tier = Math.max(0, r.tier - 2);
    r.lp = 0;
    r.promo = null;
  }
  return hadSeason;
}

// result: { tierUp, lpDelta, promoStarted, promoWon, promoLost, newPoolSize }
export function applyRankedResult(profile, won) {
  const r = profile.rank;
  const out = { tierUp: false, lpDelta: 0, promoStarted: false, promoWon: false, promoLost: false };

  if (r.promo) {
    r.promo[won ? "wins" : "losses"]++;
    if (r.promo.wins >= 2) {
      r.tier = Math.min(TIERS.length - 1, r.tier + 1);
      r.lp = 0;
      r.promo = null;
      out.tierUp = true;
      out.promoWon = true;
      out.newPoolSize = poolForTier(r.tier).length;
      profile.stats.bestTier = Math.max(profile.stats.bestTier ?? 0, r.tier);
    } else if (r.promo.losses >= 2) {
      r.lp = 60;
      r.promo = null;
      out.promoLost = true;
    }
    return out;
  }

  if (won) {
    profile.stats.rankedWins++;
    r.lp += WIN_LP;
    out.lpDelta = WIN_LP;
    const need = TIERS[r.tier].lpToPromo;
    if (r.lp >= need && r.tier < TIERS.length - 1) {
      r.promo = { wins: 0, losses: 0 };
      out.promoStarted = true;
    }
  } else {
    r.lp = Math.max(0, r.lp - LOSS_LP); // tier floor: LP never drops you a tier
    out.lpDelta = -LOSS_LP;
  }
  return out;
}

export function rankLabel(profile) {
  const r = profile.rank;
  const t = TIERS[r.tier];
  if (r.tier === TIERS.length - 1) return t.name;
  if (r.promo) return `${t.name} · PROMO ${r.promo.wins}-${r.promo.losses}`;
  return `${t.name} · ${r.lp} LP`;
}

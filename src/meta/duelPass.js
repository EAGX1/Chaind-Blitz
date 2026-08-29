// Local Duel Pass — monthly season XP track, no server. Free track, 30 tiers.

/** Dated season id: rolls over on the first of each month. */
export function currentSeasonId(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export const SEASON_ID = currentSeasonId();
export const XP_PER_WIN = 80;
export const XP_PER_TIER = 200;

// Free-track rewards. Cosmetic ids must exist in cosmetics.CATALOG.
// 30 tiers ≈ 75 wins at 80 XP — a month of regular play.
const FIXED = {
  3: { cosmetic: "emote_chain" },
  8: { cosmetic: "back_ember" },
  15: { cosmetic: "mat_coliseum" },
  22: { cosmetic: "theme_gold" },
  10: { gems: 60 },
  20: { gems: 80 },
  30: { gems: 120 }
};
export const TRACK = Array.from({ length: 30 }, (_, i) => {
  const tier = i + 1;
  const fixed = FIXED[tier] || {};
  const base = tier % 5 === 0 ? { gems: 20 }
    : tier % 3 === 0 ? { dust: { [tier % 2 ? "R" : "SR"]: 5 } }
    : tier % 2 === 0 ? { coins: 60 + tier * 4 }
    : { coins: 40 + tier * 4 };
  return { tier, ...base, ...fixed };
});

export function ensureDuelPass(profile) {
  const prev = profile.duelPass || {};
  const season = currentSeasonId();
  const seasonChanged = prev.seasonId && prev.seasonId !== season;
  profile.duelPass = {
    seasonId: season,
    xp: seasonChanged ? 0 : (prev.xp || 0),
    claimed: seasonChanged ? [] : (Array.isArray(prev.claimed) ? prev.claimed.slice() : [])
  };
  return profile.duelPass;
}

export function tierForXp(xp) {
  return Math.min(TRACK.length, Math.floor((xp || 0) / XP_PER_TIER));
}

export function unlockedTiers(profile) {
  ensureDuelPass(profile);
  return tierForXp(profile.duelPass.xp);
}

function grantReward(profile, reward) {
  if (!reward) return;
  if (reward.coins) profile.coins = (profile.coins || 0) + reward.coins;
  if (reward.gems) profile.gems = (profile.gems || 0) + reward.gems;
  if (reward.dust) {
    profile.dust = profile.dust || { N: 0, R: 0, SR: 0, UR: 0 };
    for (const [r, n] of Object.entries(reward.dust)) {
      profile.dust[r] = (profile.dust[r] || 0) + n;
    }
  }
  if (reward.cosmetic) {
    if (!Array.isArray(profile.cosmeticsOwned)) profile.cosmeticsOwned = [];
    if (!profile.cosmeticsOwned.includes(reward.cosmetic)) {
      profile.cosmeticsOwned.push(reward.cosmetic);
    }
  }
}

export function addXp(profile, n) {
  ensureDuelPass(profile);
  const add = Math.max(0, n | 0);
  profile.duelPass.xp += add;
  return {
    xp: profile.duelPass.xp,
    tier: unlockedTiers(profile),
    pending: TRACK.filter((t) => t.tier <= unlockedTiers(profile) && !profile.duelPass.claimed.includes(t.tier))
  };
}

export function addWinXp(profile) {
  return addXp(profile, XP_PER_WIN);
}

export function claimTier(profile) {
  ensureDuelPass(profile);
  const unlocked = unlockedTiers(profile);
  const next = TRACK.find((t) => t.tier <= unlocked && !profile.duelPass.claimed.includes(t.tier));
  if (!next) return { ok: false, reason: "Nothing to claim" };
  profile.duelPass.claimed.push(next.tier);
  grantReward(profile, next);
  return { ok: true, tier: next.tier, reward: next };
}

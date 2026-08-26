// Local Duel Pass — season XP track, no server. Thin free track for s1.

export const SEASON_ID = "s1";
export const XP_PER_WIN = 80;
export const XP_PER_TIER = 200;

// Free-track rewards. Cosmetic ids must exist in cosmetics.CATALOG.
export const TRACK = [
  { tier: 1, coins: 50 },
  { tier: 2, dust: { N: 10 } },
  { tier: 3, cosmetic: "emote_chain" },
  { tier: 4, coins: 80, gems: 20 },
  { tier: 5, cosmetic: "back_ember" },
  { tier: 6, dust: { R: 10 } },
  { tier: 7, coins: 120 },
  { tier: 8, cosmetic: "mat_coliseum" },
  { tier: 9, dust: { SR: 5 }, gems: 40 },
  { tier: 10, coins: 250, cosmetic: "theme_gold" }
];

export function ensureDuelPass(profile) {
  const prev = profile.duelPass || {};
  const seasonChanged = prev.seasonId && prev.seasonId !== SEASON_ID;
  profile.duelPass = {
    seasonId: SEASON_ID,
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

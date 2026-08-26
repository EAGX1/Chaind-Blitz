// Post-duel rewards by mode and result.

export function duelRewards(profile, { won, mode = "pve" }) {
  const out = { gems: 0, coins: 0, pack: false, lines: [] };
  if (won) {
    out.coins = mode === "ranked" ? 120 : 80;
    out.gems = mode === "ranked" ? 40 : 25;
    profile.stats.wins++;
  } else {
    out.coins = 25;
    profile.stats.losses++;
  }
  // every 5th win grants a free pack
  if (won && profile.stats.wins % 5 === 0) {
    out.pack = true;
    out.lines.push("Milestone: free pack!");
  }
  profile.gems += out.gems;
  profile.coins += out.coins;
  return out;
}

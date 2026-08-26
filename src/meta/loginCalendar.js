// Local login / reward calendar. One claim per local YYYY-MM-DD. No server time.

export const CALENDAR = [
  { day: 1, coins: 50 },
  { day: 2, gems: 20 },
  { day: 3, dust: { N: 10 } },
  { day: 4, coins: 80 },
  { day: 5, gems: 40 },
  { day: 6, dust: { R: 8 } },
  { day: 7, coins: 150, gems: 50 },
  { day: 8, coins: 60 },
  { day: 9, dust: { N: 15 } },
  { day: 10, gems: 30 },
  { day: 11, coins: 90 },
  { day: 12, dust: { SR: 5 } },
  { day: 13, gems: 45 },
  { day: 14, coins: 200, gems: 80, dust: { R: 10 } }
];

export function localDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(iso, delta) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return localDate(dt);
}

export function ensureLogin(profile) {
  const prev = profile.login || {};
  profile.login = {
    lastClaim: prev.lastClaim ?? null,
    streak: prev.streak || 0
  };
  return profile.login;
}

export function canClaim(profile, now = new Date()) {
  ensureLogin(profile);
  return profile.login.lastClaim !== localDate(now);
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
}

export function claimToday(profile, now = new Date()) {
  ensureLogin(profile);
  const today = localDate(now);
  if (profile.login.lastClaim === today) {
    return { ok: false, reason: "Already claimed today" };
  }
  const yesterday = addDays(today, -1);
  if (profile.login.lastClaim === yesterday) profile.login.streak += 1;
  else profile.login.streak = 1;
  profile.login.lastClaim = today;
  const idx = (profile.login.streak - 1) % CALENDAR.length;
  const reward = CALENDAR[idx];
  grantReward(profile, reward);
  return { ok: true, streak: profile.login.streak, day: reward.day, reward };
}

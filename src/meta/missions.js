// Rotating dailies (3) + permanent achievements. Progress via named events.

import { localDate } from "./loginCalendar.js";

export const DAILY_POOL = [
  { id: "d_win2", event: "win", goal: 2, label: "Win 2 duels", reward: { coins: 60 } },
  { id: "d_win1", event: "win", goal: 1, label: "Win a duel", reward: { coins: 30, gems: 10 } },
  { id: "d_evolve", event: "evolve", goal: 1, label: "Evolve a monster", reward: { dust: { N: 8 } } },
  { id: "d_fusion", event: "fusion", goal: 1, label: "Contact Fusion once", reward: { coins: 50 } },
  { id: "d_pack", event: "pack", goal: 1, label: "Open a pack", reward: { gems: 15 } },
  { id: "d_craft", event: "craft", goal: 1, label: "Craft a card", reward: { coins: 40 } },
  { id: "d_ranked", event: "ranked_win", goal: 1, label: "Win a ranked duel", reward: { coins: 80 } },
  { id: "d_chain", event: "chain", goal: 3, label: "Resolve 3 chains", reward: { dust: { R: 5 } } }
];

export const ACHIEVEMENTS = [
  { id: "a_first_win", event: "win", goal: 1, label: "First blood", reward: { coins: 50, gems: 20 } },
  { id: "a_wins_10", event: "win", goal: 10, label: "Ten victories", reward: { coins: 200 } },
  { id: "a_wins_50", event: "win", goal: 50, label: "Fifty victories", reward: { gems: 100, cosmetic: "avatar_crown" } },
  { id: "a_evolve_10", event: "evolve", goal: 10, label: "Evolutionist", reward: { dust: { R: 15 } } },
  { id: "a_fusion_5", event: "fusion", goal: 5, label: "Fusion adept", reward: { dust: { SR: 8 } } },
  { id: "a_packs_10", event: "pack", goal: 10, label: "Pack rat", reward: { gems: 50 } },
  { id: "a_ranked_5", event: "ranked_win", goal: 5, label: "Coliseum regular", reward: { coins: 250 } },
  { id: "a_login_7", event: "login", goal: 7, label: "Week streak", reward: { coins: 150, gems: 40 } }
];

const ALL = [...DAILY_POOL, ...ACHIEVEMENTS];
const BY_ID = Object.fromEntries(ALL.map((m) => [m.id, m]));

function hashDay(iso) {
  let h = 2166136261;
  for (let i = 0; i < iso.length; i++) {
    h ^= iso.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function ensureMissions(profile) {
  const prev = profile.missions || {};
  profile.missions = {
    dailies: Array.isArray(prev.dailies) ? prev.dailies : [],
    progress: { ...(prev.progress || {}) },
    rolledOn: prev.rolledOn || null,
    claimed: Array.isArray(prev.claimed) ? prev.claimed : []
  };
  return profile.missions;
}

function pickDailies(iso) {
  const rng = hashDay(iso);
  const pool = DAILY_POOL.slice();
  const out = [];
  let seed = rng;
  while (out.length < 3 && pool.length) {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    const i = seed % pool.length;
    out.push(pool.splice(i, 1)[0]);
  }
  return out.map((d) => ({ id: d.id, event: d.event, goal: d.goal, label: d.label, reward: d.reward }));
}

export function rollDailies(profile, now = new Date()) {
  ensureMissions(profile);
  const today = localDate(now);
  if (profile.missions.rolledOn === today && profile.missions.dailies.length === 3) {
    return profile.missions.dailies;
  }
  profile.missions.rolledOn = today;
  profile.missions.dailies = pickDailies(today);
  // New day: daily progress and yesterday's daily claim keys reset.
  for (const d of DAILY_POOL) delete profile.missions.progress[d.id];
  profile.missions.claimed = profile.missions.claimed.filter((k) => !String(k).includes(":d_"));
  return profile.missions.dailies;
}

function eventType(event) {
  if (!event) return "";
  if (typeof event === "string") return event;
  return event.type || event.event || "";
}

function eventN(event) {
  if (event && typeof event === "object" && event.n != null) return event.n | 0;
  return 1;
}

export function progress(profile, event) {
  ensureMissions(profile);
  rollDailies(profile);
  const type = eventType(event);
  const n = Math.max(0, eventN(event));
  if (!type || n <= 0) return profile.missions.progress;
  const bump = (id) => {
    profile.missions.progress[id] = (profile.missions.progress[id] || 0) + n;
  };
  for (const d of profile.missions.dailies) {
    if (d.event === type) bump(d.id);
  }
  for (const a of ACHIEVEMENTS) {
    if (a.event === type) bump(a.id);
  }
  return profile.missions.progress;
}

function grantReward(profile, reward) {
  if (!reward) return;
  if (reward.coins) profile.coins = (profile.coins || 0) + reward.coins;
  if (reward.gems) profile.gems = (profile.gems || 0) + reward.gems;
  if (reward.dust) {
    profile.dust = profile.dust || { N: 0, R: 0, SR: 0, UR: 0 };
    for (const [r, amt] of Object.entries(reward.dust)) {
      profile.dust[r] = (profile.dust[r] || 0) + amt;
    }
  }
  if (reward.cosmetic) {
    if (!Array.isArray(profile.cosmeticsOwned)) profile.cosmeticsOwned = [];
    if (!profile.cosmeticsOwned.includes(reward.cosmetic)) {
      profile.cosmeticsOwned.push(reward.cosmetic);
    }
  }
}

function defFor(profile, id) {
  const daily = profile.missions.dailies.find((d) => d.id === id);
  if (daily) return daily;
  return BY_ID[id] || null;
}

export function claim(profile, id) {
  ensureMissions(profile);
  rollDailies(profile);
  const def = defFor(profile, id);
  if (!def) return { ok: false, reason: "Unknown mission" };
  if (profile.missions.claimed.includes(id) && !id.startsWith("d_")) {
    return { ok: false, reason: "Already claimed" };
  }
  // dailies can be re-rolled next day; claimed list is per-roll via rolledOn+id
  const claimKey = id.startsWith("d_") ? `${profile.missions.rolledOn}:${id}` : id;
  if (profile.missions.claimed.includes(claimKey)) {
    return { ok: false, reason: "Already claimed" };
  }
  const have = profile.missions.progress[id] || 0;
  if (have < def.goal) return { ok: false, reason: "Not complete" };
  profile.missions.claimed.push(claimKey);
  grantReward(profile, def.reward);
  return { ok: true, reward: def.reward };
}

export function applyDuelMissions(profile, result) {
  const st = result?.stats || {};
  if (st.evolutions) progress(profile, { type: "evolve", n: st.evolutions });
  if (st.fusions) progress(profile, { type: "fusion", n: st.fusions });
  if (st.chainsResolved) progress(profile, { type: "chain", n: st.chainsResolved });
}

export function missionStatus(profile) {
  ensureMissions(profile);
  rollDailies(profile);
  const row = (def, daily) => {
    const claimKey = daily ? `${profile.missions.rolledOn}:${def.id}` : def.id;
    const have = profile.missions.progress[def.id] || 0;
    return {
      id: def.id,
      label: def.label,
      goal: def.goal,
      have: Math.min(have, def.goal),
      done: have >= def.goal,
      claimed: profile.missions.claimed.includes(claimKey),
      reward: def.reward
    };
  };
  return {
    dailies: profile.missions.dailies.map((d) => row(d, true)),
    achievements: ACHIEVEMENTS.map((a) => row(a, false))
  };
}

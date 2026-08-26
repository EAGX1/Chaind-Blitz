// Teaching Labs: stacked boards, a single success beat, then hub + a small reward.
import { ensureSoloGates } from "./soloGates.js";

export const LABS = [
  {
    id: "labs_fanfare",
    key: "fanfare_lane",
    label: "Fanfare vs Lane",
    hint: "Normal Summon Heal Bloom into Lane 1. Fanfare still heals — the lane draw is after.",
    reward: { coins: 40 }
  },
  {
    id: "labs_ward",
    key: "ward",
    label: "Ward must-attack",
    hint: "End Main, then attack Ward Sentinel. Ember Fox is illegal.",
    reward: { coins: 40 }
  },
  {
    id: "labs_contact",
    key: "contact",
    label: "Contact Fusion",
    hint: "Click Contact Fusion Pyre Wyrm. The two Ignis are already on the field.",
    reward: { coins: 50 }
  },
  {
    id: "labs_counter",
    key: "counter",
    label: "Counter SS3 lockout",
    hint: "Opponent activates a Speed 1 spell. Chain Null Seal (SS3). A Speed 2 Quick cannot answer the counter.",
    reward: { coins: 50 }
  },
  {
    id: "labs_ambush",
    key: "ambush",
    label: "Ambush flip",
    hint: "End Main, then attack the face-down monster. It flips and its Fanfare fires.",
    reward: { coins: 50 }
  },
  {
    id: "labs_tribute",
    key: "tribute",
    label: "Tribute Summon",
    hint: "Tribute Ember Fox, then Normal Summon Gem Golem (Level 5 — one tribute).",
    reward: { coins: 50 }
  },
  {
    id: "labs_damage_step",
    key: "damage_step",
    label: "Damage Step chain",
    hint: "Attack, then chain Surge Imp during damage calculation. Click the card face — not a second Confirm.",
    reward: { coins: 50 }
  }
];

const BY_ID = Object.fromEntries(LABS.map((l) => [l.id, l]));

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

export function ensureLabs(profile) {
  ensureSoloGates(profile);
  profile.soloGates.labs = { ...(profile.soloGates.labs || {}) };
  return profile.soloGates.labs;
}

export function isLabCleared(profile, labId) {
  ensureLabs(profile);
  return !!profile.soloGates.labs[labId];
}

export function labsClearedCount(profile) {
  ensureLabs(profile);
  return LABS.filter((l) => profile.soloGates.labs[l.id]).length;
}

export function allLabsCleared(profile) {
  return labsClearedCount(profile) === LABS.length;
}

export function isFirstFarer(profile) {
  ensureSoloGates(profile);
  return !!profile.soloGates.firstFarer;
}

export function clearLab(profile, labId) {
  ensureLabs(profile);
  const def = BY_ID[labId];
  if (!def) return { ok: false, reason: "Unknown lab" };
  if (profile.soloGates.labs[labId]) return { ok: false, reason: "Already cleared", already: true };
  profile.soloGates.labs[labId] = true;
  grantReward(profile, def.reward);
  let firstFarer = false;
  if (allLabsCleared(profile) && !profile.soloGates.firstFarer) {
    profile.soloGates.firstFarer = true;
    grantReward(profile, { coins: 120, gems: 20 });
    firstFarer = true;
  }
  return { ok: true, lab: def, reward: def.reward, firstFarer };
}

export function labByKey(key) {
  return LABS.find((l) => l.key === key) || null;
}

function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Rotate a Lab board by local date. Eternal / MD Solo steal. */
export function puzzleOfTheDay(now = new Date()) {
  const iso = dateKey(now);
  let h = 0;
  for (let i = 0; i < iso.length; i++) h = (h * 31 + iso.charCodeAt(i)) >>> 0;
  return LABS[h % LABS.length];
}

export function claimPuzzleToday(profile, now = new Date()) {
  ensureLabs(profile);
  const today = dateKey(now);
  if (profile.soloGates.puzzleClaimedOn === today) {
    return { ok: false, already: true, reason: "Already claimed today" };
  }
  profile.soloGates.puzzleClaimedOn = today;
  grantReward(profile, { coins: 25 });
  return { ok: true, reward: { coins: 25 }, lab: puzzleOfTheDay(now) };
}

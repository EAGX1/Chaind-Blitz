// Hour-1 Solo Gates: sequential plaza quests. Persist on profile.soloGates.

export const GATES = [
  {
    id: "gate1",
    label: "Win your first duel",
    hint: "Queue a Quick Duel from the plaza PLAY kiosk (or Classic hub) and take the win. First turn: no attacks.",
    reward: { coins: 80, gems: 25 }
  },
  {
    id: "gate2",
    label: "Evolve a monster",
    hint: "Spend EP during your Main Phase to Evolve.",
    reward: { coins: 100, dust: { N: 10 } }
  },
  {
    id: "gate3",
    label: "Perform Contact Fusion",
    hint: "Send the listed materials and Fusion Summon from the Extra Deck.",
    reward: { coins: 120, gems: 40, dust: { R: 5 } }
  },
  {
    id: "gate4",
    label: "Visit the Coliseum",
    hint: "Open Ranked from the Coliseum — a tease of the ladder.",
    reward: { coins: 150, gems: 50, cosmetic: "emote_wow" }
  },
  {
    id: "gate5",
    label: "Win a ranked duel",
    hint: "Queue Ranked from the Coliseum and take the win. The ladder is vs CPU until peer duels ship.",
    reward: { coins: 180, gems: 60 }
  },
  {
    id: "gate6",
    label: "Reach Silver",
    hint: "Climb the ranked ladder to Silver — that unlocks Wave C and Silver cards in your pack pool.",
    reward: { gems: 100, dust: { N: 20, R: 8 } }
  }
];

const GATE_IDS = GATES.map((g) => g.id);

export function ensureSoloGates(profile) {
  const prev = profile.soloGates || {};
  profile.soloGates = {
    ...prev,
    cleared: { ...(prev.cleared || {}) },
    tutorialSeen: !!prev.tutorialSeen,
    labs: { ...(prev.labs || {}) },
    firstFarer: !!prev.firstFarer
  };
  return profile.soloGates;
}

export function isUnlocked(profile, gateId) {
  ensureSoloGates(profile);
  const idx = GATE_IDS.indexOf(gateId);
  if (idx < 0) return false;
  if (idx === 0) return true;
  return !!profile.soloGates.cleared[GATE_IDS[idx - 1]];
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

export function clearGate(profile, gateId) {
  ensureSoloGates(profile);
  const gate = GATES.find((g) => g.id === gateId);
  if (!gate) return { ok: false, reason: "Unknown gate" };
  if (!isUnlocked(profile, gateId)) return { ok: false, reason: "Gate locked" };
  if (profile.soloGates.cleared[gateId]) return { ok: false, reason: "Already cleared" };
  profile.soloGates.cleared[gateId] = true;
  grantReward(profile, gate.reward);
  return { ok: true, gate, reward: gate.reward };
}

export function checklist(profile) {
  ensureSoloGates(profile);
  return GATES.map((g) => ({
    id: g.id,
    done: !!profile.soloGates.cleared[g.id],
    label: g.label,
    unlocked: isUnlocked(profile, g.id),
    hint: g.hint
  }));
}

export function nextGate(profile) {
  return checklist(profile).find((g) => !g.done) || null;
}

export function markTutorialSeen(profile) {
  ensureSoloGates(profile);
  profile.soloGates.tutorialSeen = true;
  profile.seenDuelHint = true;
}

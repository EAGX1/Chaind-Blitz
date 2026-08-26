// New-game campaign: pick one starter, earn the rest. Dev cheats stay local.

import { ALL_CARDS } from "../data/cards/index.js";
import { STARTERS } from "../data/starters.js";
import { TIERS } from "./pools.js";

export const STARTER_CHOICE_IDS = ["ignis", "abyss", "terra"];

export const DEV_WALLET = {
  gems: 999999,
  coins: 999999,
  dust: 9999
};

export const STARTING_GEMS = 600;

export function starterChoices() {
  return STARTER_CHOICE_IDS.map((id) => STARTERS[id]).filter(Boolean);
}

export function needsStarterPick(profile) {
  return !profile?.starterId;
}

/** Grant copies listed on a starter without wiping extra pulls. Returns true if collection grew. */
export function grantStarterCards(profile, starter) {
  if (!profile || !starter) return false;
  profile.collection = profile.collection || {};
  const need = {};
  for (const id of starter.deck || []) need[id] = (need[id] || 0) + 1;
  for (const id of starter.extra || []) need[id] = Math.max(need[id] || 0, 1);
  let changed = false;
  for (const [id, n] of Object.entries(need)) {
    const have = profile.collection[id] || 0;
    if (have < n) {
      profile.collection[id] = n;
      changed = true;
    }
  }
  return changed;
}

export function applyStarter(profile, starterId) {
  const starter = STARTERS[starterId];
  if (!profile || !starter) return false;
  grantStarterCards(profile, starter);
  profile.decks = profile.decks || {};
  profile.decks[starter.name] = {
    main: [...(starter.deck || [])],
    extra: [...(starter.extra || [])]
  };
  profile.starterId = starter.id;
  profile.activeDeck = starter.name;
  return true;
}

export function grantSandboxCollection(profile) {
  if (!profile) return;
  profile.collection = profile.collection || {};
  for (const c of ALL_CARDS) {
    profile.collection[c.id] = Math.max(profile.collection[c.id] || 0, 3);
  }
}

export function applyDevWallet(profile) {
  if (!profile) return profile;
  profile.gems = Math.max(profile.gems || 0, DEV_WALLET.gems);
  profile.coins = Math.max(profile.coins || 0, DEV_WALLET.coins);
  profile.dust = { N: 0, R: 0, SR: 0, UR: 0, ...(profile.dust || {}) };
  for (const r of ["N", "R", "SR", "UR"]) {
    profile.dust[r] = Math.max(profile.dust[r] || 0, DEV_WALLET.dust);
  }
  return profile;
}

export function setMaxRank(profile) {
  if (!profile) return;
  profile.rank = { tier: TIERS.length - 1, lp: 0, promo: null };
}

export function canAffordGems(profile, n) {
  if (profile?.devCheats) return true;
  return (profile?.gems || 0) >= n;
}

export function spendGems(profile, n) {
  if (!profile) return false;
  if (profile.devCheats) return true;
  if ((profile.gems || 0) < n) return false;
  profile.gems -= n;
  return true;
}

export function collectionCopyCount(profile) {
  return Object.values(profile?.collection || {}).reduce((sum, n) => sum + (Number(n) || 0), 0);
}

/** Cards the player actually owns (at least one copy). */
export function ownedCardDefs(profile, catalog) {
  const list = catalog || [];
  if (!profile) return [];
  return list.filter((c) => (profile.collection?.[c.id] || 0) > 0);
}

export function ownedCopies(profile, id) {
  return Math.max(0, profile?.collection?.[id] || 0);
}

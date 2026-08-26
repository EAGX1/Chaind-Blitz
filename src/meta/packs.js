// Pack opening: 10 cards per pack from your tier-gated pool.
// Slots: 8× N/R, 1× R+, 1× SR+ (UR pity lands on the last card).

import { progress as missionProgress } from "./missions.js";

export const PACK_COST_GEMS = 100;
export const PACK_SIZE = 10;

const RARITY_ORDER = ["N", "R", "SR", "UR"];

function rollCard(rng, byRarity, table) {
  const roll = rng.next();
  let rarity = table[table.length - 1][0];
  let acc = 0;
  for (const [r, p] of table) {
    acc += p;
    if (roll < acc) { rarity = r; break; }
  }
  // fall back to nearest available rarity in the pool
  for (let i = RARITY_ORDER.indexOf(rarity); i >= 0; i--) {
    const pool = byRarity[RARITY_ORDER[i]];
    if (pool?.length) return rng.pick(pool);
  }
  for (const r of RARITY_ORDER) {
    if (byRarity[r]?.length) return rng.pick(byRarity[r]);
  }
  return null;
}

export function openPack(rng, pool, profile = null) {
  const byRarity = {};
  for (const c of pool) {
    (byRarity[c.rarity] ||= []).push(c);
  }
  const cards = [];
  let hasUr = false;
  for (let i = 0; i < 8; i++) cards.push(rollCard(rng, byRarity, [["N", 0.75], ["R", 1]]));
  cards.push(rollCard(rng, byRarity, [["R", 0.70], ["SR", 0.95], ["UR", 1]]));
  const forceUr = profile && profile.packPity >= 9 && byRarity.UR?.length;
  if (forceUr) {
    cards.push(rng.pick(byRarity.UR));
    hasUr = true;
  } else {
    const c = rollCard(rng, byRarity, [["SR", 0.82], ["UR", 1]]);
    cards.push(c);
    hasUr = c?.rarity === "UR";
  }
  // A UR in any slot resets pity.
  if (!hasUr) hasUr = cards.some((c) => c?.rarity === "UR");
  if (profile) {
    profile.packPity = hasUr ? 0 : (profile.packPity || 0) + 1;
    missionProgress(profile, "pack");
  }
  return cards.filter(Boolean);
}

export function grantCards(profile, cards) {
  for (const c of cards) {
    profile.collection[c.id] = Math.min(99, (profile.collection[c.id] || 0) + 1);
  }
}

// Crafting (Master Duel model): dismantling a card yields 10 CP of its rarity;
// crafting any card costs 30 CP of its rarity — three dusted cards make one new card.

import { progress as missionProgress } from "./missions.js";

export const DISMANTLE_VALUE = 10;
export const CRAFT_COST = 30;

export function canCraft(profile, def) {
  return (profile.dust[def.rarity] || 0) >= CRAFT_COST;
}

export function craft(profile, def) {
  if (!canCraft(profile, def)) return false;
  profile.dust[def.rarity] -= CRAFT_COST;
  profile.collection[def.id] = Math.min(99, (profile.collection[def.id] || 0) + 1);
  missionProgress(profile, "craft");
  return true;
}

export function canDismantle(profile, def, keepPlayset = false) {
  const owned = profile.collection[def.id] || 0;
  if (owned <= 0) return false;
  if (keepPlayset && owned <= 3) return false;
  return true;
}

export function dismantle(profile, def, keepPlayset = false) {
  if (!canDismantle(profile, def, keepPlayset)) return false;
  profile.collection[def.id] -= 1;
  if (profile.collection[def.id] <= 0) delete profile.collection[def.id];
  profile.dust[def.rarity] = (profile.dust[def.rarity] || 0) + DISMANTLE_VALUE;
  return true;
}

export const dustLine = (profile) =>
  `${profile.dust.N}/${profile.dust.R}/${profile.dust.SR}/${profile.dust.UR}`;

/* ---- Coins sink: buy dust with coins (repeatable) ---- */
export const DUST_SHOP = { N: 150, R: 300, SR: 500, UR: 800 };
export const DUST_SHOP_AMOUNT = 10;

export function canBuyDust(profile, rarity) {
  const price = DUST_SHOP[rarity];
  return Number.isFinite(price) && (profile.coins || 0) >= price;
}

export function buyDustWithCoins(profile, rarity) {
  if (!canBuyDust(profile, rarity)) return false;
  profile.coins -= DUST_SHOP[rarity];
  profile.dust[rarity] = (profile.dust[rarity] || 0) + DUST_SHOP_AMOUNT;
  return true;
}

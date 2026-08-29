// Token definitions: summoned by card effects, never in packs or pools.
// TOKEN_DB merges into CARD_DB (so makeCard can build them) but TOKEN_CARDS
// stay out of ALL_CARDS — tokens are not collectable.

export const token_stonewall = {
  id: "token_stonewall", name: "Stonewall Token", type: "monster",
  tribe: "Terra", cost: 1, atk: 0, def: 4, rarity: "N",
  text: "Ward. A wall grown, not born.",
  keywords: ["ward"], archetypes: ["token_walls"], token: true
};

/** Cheap SUMMON-circuit fuel for the neutral combo core. */
export const token_recruit = {
  id: "token_recruit", name: "Recruit Token", type: "monster",
  tribe: "Neutral", cost: 1, atk: 1, def: 1, rarity: "N",
  text: "A body called to feed the chain.",
  archetypes: ["combo_core"], token: true
};

export const TOKEN_CARDS = [token_stonewall, token_recruit];
export const TOKEN_DB = Object.fromEntries(TOKEN_CARDS.map((c) => [c.id, c]));

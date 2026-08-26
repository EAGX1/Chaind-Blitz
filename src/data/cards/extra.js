// Archetype Extra Deck fusions. Recipes use cards those decks actually play.
import { opp, monstersOf, pushEvents } from "../../engine/state.js";
import { dealDamageToPlayer, mill, bounceToHand } from "../../engine/ops.js";
import { must, evSelfSummon, rDraw, rHeal } from "./helpers.js";

const M = (id, name, tribe, atk, def, rarity, text, extra = {}) =>
  ({ id, name, type: "monster", tribe, cost: 0, atk, def, rarity, text, summon: "fusion", ...extra });

const tribe = (t) => (c) => c.def?.tribe === t;
const hasKw = (k) => (c) => !!c.def?.keywords?.includes(k);
const any2 = (filter) => [
  { materials: [{ kind: "generic", filter }, { kind: "generic", filter }], allowSubstitute: true }
];

/** Best Ignis boss — any 2 Ignis. */
export const fusion_pyre_wyrm = M("fusion_pyre_wyrm", "Pyre Wyrm", "Ignis", 6, 4, "UR",
  "Contact: 2 Ignis. Rush. Fanfare: deal 2 to the enemy leader.",
  {
    keywords: ["rush"],
    archetypes: ["burn", "spell_tempo", "otk_face", "pyro_control", "evolve_burn"],
    fusion: {
      contact: true,
      recipes: [
        { materials: [{ kind: "id", id: "ember_fox" }, { kind: "id", id: "cinder_knight" }], allowSubstitute: true },
        { materials: [{ kind: "id", id: "ash_prophet" }, { kind: "id", id: "cinder_knight" }], allowSubstitute: true },
        { materials: [{ kind: "id", id: "ember_fox" }, { kind: "id", id: "ash_prophet" }], allowSubstitute: true },
        ...any2(tribe("Ignis"))
      ]
    },
    triggers: [must("wyrm_burn", "Deal 2", evSelfSummon,
      async (G, card) => dealDamageToPlayer(G, opp(card.controller), 2, card))]
  });

/** Best GY boss — Scav + Jestling, or 2 Abyss. */
export const fusion_grave_tyrant = M("fusion_grave_tyrant", "Grave Tyrant", "Abyss", 6, 5, "UR",
  "Contact: Scavenger Wisp + Jestling, or 2 Abyss. Drain. Fanfare: draw 1.",
  {
    keywords: ["drain"],
    archetypes: ["gy", "jest_engine", "discard_payoff", "gy_fusion_combo"],
    fusion: {
      contact: true,
      recipes: [
        { materials: [{ kind: "id", id: "scav_wisp" }, { kind: "id", id: "jestling" }], allowSubstitute: true },
        ...any2(tribe("Abyss"))
      ]
    },
    triggers: [must("tyrant_draw", "Draw 1", evSelfSummon, rDraw(1))]
  });

/** Best control boss — 2 Abyss. */
export const fusion_veil_lock = M("fusion_veil_lock", "Veil Lock", "Abyss", 5, 6, "SR",
  "Contact: 2 Abyss. Ward. Fanfare: heal 2.",
  {
    keywords: ["ward"],
    archetypes: ["handtrap_midrange", "comeback_toolbox", "control_counters", "abyss_tempo"],
    fusion: { contact: true, recipes: any2(tribe("Abyss")) },
    triggers: [must("veil_heal", "Heal 2", evSelfSummon, rHeal(2))]
  });

/** Best Terra boss — 2 Terra. */
export const fusion_grove_titan = M("fusion_grove_titan", "Grove Titan", "Terra", 6, 8, "UR",
  "Contact: 2 Terra. Ward. Fanfare: heal 3.",
  {
    keywords: ["ward"],
    archetypes: ["stall_to_fusion", "evolve_burn", "heal_stall", "ward_walls", "big_evolve"],
    fusion: { contact: true, recipes: any2(tribe("Terra")) },
    triggers: [must("titan_heal", "Heal 3", evSelfSummon, rHeal(3))]
  });

/** Modest Terra extra for lists that already win. */
export const fusion_grove_knight = M("fusion_grove_knight", "Grove Knight", "Terra", 4, 5, "R",
  "Contact: Moss Sprite + Dawn Pixie, or Grove Elder + any Terra. Ward. Fanfare: heal 1.",
  {
    keywords: ["ward"],
    archetypes: ["terra_beat", "ramp_into_boss", "heal_ramp", "token_walls"],
    fusion: {
      contact: true,
      recipes: [
        { materials: [{ kind: "id", id: "moss_sprite" }, { kind: "id", id: "dawn_pixie" }], allowSubstitute: true },
        { materials: [{ kind: "id", id: "grove_elder" }, { kind: "generic", filter: tribe("Terra") }], allowSubstitute: true }
      ]
    },
    triggers: [must("knight_heal", "Heal 1", evSelfSummon, rHeal(1))]
  });

/** Tempo/lane boss — Falcon + Doomblade, or 2 Rush. */
export const fusion_tempo_ace = M("fusion_tempo_ace", "Tempo Ace", "Neutral", 5, 4, "SR",
  "Contact: Swift Falcon + Doomblade Novice, or 2 Rush. Rush. Fanfare: deal 1 to the enemy leader.",
  {
    keywords: ["rush"],
    archetypes: ["spell_tempo", "lane_surfer", "going_second", "otk_face"],
    fusion: {
      contact: true,
      recipes: [
        { materials: [{ kind: "id", id: "swift_falcon" }, { kind: "id", id: "doomblade_novice" }], allowSubstitute: true },
        ...any2(hasKw("rush"))
      ]
    },
    triggers: [must("ace_ping", "Deal 1", evSelfSummon,
      async (G, card) => dealDamageToPlayer(G, opp(card.controller), 1, card))]
  });

/** Mill payoff — Spore + any Abyss. */
export const fusion_mill_maw = M("fusion_mill_maw", "Mill Maw", "Abyss", 4, 5, "SR",
  "Contact: Mill Spore + an Abyss monster. Fanfare: mill the opponent 2.",
  {
    archetypes: ["mill"],
    fusion: {
      contact: true,
      recipes: [
        { materials: [{ kind: "id", id: "mill_spore" }, { kind: "generic", filter: tribe("Abyss") }], allowSubstitute: true }
      ]
    },
    triggers: [must("maw_mill", "Mill 2", evSelfSummon,
      async (G, card) => mill(G, opp(card.controller), 2))]
  });

/** Ignis ladder mid — 2 Ignis. Rush ping. */
export const fusion_ash_seraph = M("fusion_ash_seraph", "Ash Seraph", "Ignis", 5, 3, "SR",
  "Contact: 2 Ignis. Rush. Fanfare: deal 1 to the enemy leader.",
  {
    keywords: ["rush"],
    archetypes: ["burn", "aggro_swarm", "evolve_burn", "otk_face"],
    fusion: { contact: true, recipes: any2(tribe("Ignis")) },
    triggers: [must("seraph_ping", "Deal 1", evSelfSummon,
      async (G, card) => dealDamageToPlayer(G, opp(card.controller), 1, card))]
  });

/** Abyss tempo — 2 Abyss. Bounce the biggest face-up foe. */
export const fusion_tide_hydra = M("fusion_tide_hydra", "Tide Hydra", "Abyss", 5, 5, "SR",
  "Contact: 2 Abyss. Fanfare: bounce the enemy's highest-ATK face-up monster.",
  {
    archetypes: ["tempo_bounce", "abyss_tempo", "control_counters"],
    fusion: { contact: true, recipes: any2(tribe("Abyss")) },
    triggers: [must("hydra_bounce", "Bounce an enemy monster", evSelfSummon, async (G, card) => {
      const foes = monstersOf(G, opp(card.controller)).filter((m) => m.faceup);
      if (!foes.length) return;
      const t = foes.reduce((a, b) => ((a.def.atk || 0) >= (b.def.atk || 0) ? a : b));
      const ev = bounceToHand(G, t);
      pushEvents(G, [ev]);
    })]
  });

/** Terra ladder mid — 2 Terra. Ward value. */
export const fusion_root_colossus = M("fusion_root_colossus", "Root Colossus", "Terra", 5, 7, "SR",
  "Contact: 2 Terra. Ward. Fanfare: draw 1.",
  {
    keywords: ["ward"],
    archetypes: ["ward_walls", "heal_ramp", "big_evolve", "stall_to_fusion"],
    fusion: { contact: true, recipes: any2(tribe("Terra")) },
    triggers: [must("root_draw", "Draw 1", evSelfSummon, rDraw(1))]
  });

export const fusion_staple_knight = M("fusion_staple_knight", "Staple Knight", "Neutral", 5, 4, "SR",
  "Contact: 2 monsters. Rush. Fanfare: draw 1.",
  {
    keywords: ["rush"],
    archetypes: ["staple", "wide_rush", "draw"],
    fusion: { contact: true, recipes: any2((c) => c.def?.type === "monster") },
    triggers: [must("staple_draw", "Draw 1", evSelfSummon, rDraw(1))]
  });

export const fusion_staple_aegis = M("fusion_staple_aegis", "Staple Aegis", "Neutral", 3, 6, "SR",
  "Contact: 2 monsters. Ward. Fanfare: heal 2.",
  {
    keywords: ["ward"],
    archetypes: ["staple", "ward_walls", "heal_ramp"],
    fusion: { contact: true, recipes: any2((c) => c.def?.type === "monster") },
    triggers: [must("staple_heal", "Heal 2", evSelfSummon, rHeal(2))]
  });

export const EXTRA_CARDS = [
  fusion_pyre_wyrm, fusion_grave_tyrant, fusion_veil_lock, fusion_grove_titan,
  fusion_grove_knight, fusion_tempo_ace, fusion_mill_maw,
  fusion_ash_seraph, fusion_tide_hydra, fusion_root_colossus,
  fusion_staple_knight, fusion_staple_aegis
];

export const EXTRA_DB = Object.fromEntries(EXTRA_CARDS.map((c) => [c.id, c]));

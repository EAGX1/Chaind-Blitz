// Archetype Extra Deck fusions. Recipes use cards those decks actually play.
import { P, opp, monstersOf, pushEvents } from "../../engine/state.js";
import {
  dealDamageToPlayer, mill, bounceToHand, damageMonster, sweepDestroyed,
  buff, specialSummon, healPlayer, drawCards
} from "../../engine/ops.js";
import { must, evSelfSummon, rDraw, rHeal, resolveChosenFromPool } from "./helpers.js";

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

/** Mill boss — the deckout plan's closer. */
export const fusion_deep_hollow = M("fusion_deep_hollow", "Deep Hollow", "Abyss", 7, 6, "UR",
  "Contact: 2 Abyss. Fanfare: mill the opponent 4. When the opponent mills a card, deal 1 to the enemy leader.",
  {
    archetypes: ["mill", "gy"],
    fusion: {
      contact: true,
      recipes: [
        { materials: [{ kind: "id", id: "mill_spore" }, { kind: "id", id: "mill_angler" }], allowSubstitute: true },
        ...any2(tribe("Abyss"))
      ]
    },
    triggers: [
      must("hollow_mill", "Mill 4", evSelfSummon,
        async (G, card) => mill(G, opp(card.controller), 4)),
      must("hollow_burn", "Deal 1 on enemy mill",
        (G, card, ev) => ev.type === "sentToGY" && ev.kind === "mill"
          && ev.card?.controller !== card.controller,
        async (G, card) => dealDamageToPlayer(G, opp(card.controller), 1, card))
    ]
  });

/** Ambush boss — flips your trapdoors up and armed. */
export const fusion_trapdoor_fiend = M("fusion_trapdoor_fiend", "Trapdoor Fiend", "Abyss", 5, 4, "SR",
  "Contact: 2 Ambush monsters. Fanfare: flip your face-down monsters face-up; they gain +1/+0.",
  {
    archetypes: ["ambush_trapdoor", "tempo_bounce"],
    fusion: { contact: true, recipes: any2(hasKw("ambush")) },
    triggers: [must("fiend_flip", "Flip your monsters up (+1/+0)", evSelfSummon, async (G, card) => {
      const mine = P(G, card.controller).mz.filter((m) => m && !m.faceup);
      const evs = [];
      for (const m of mine) {
        m.faceup = true;
        buff(G, m, 1, 0, { permanent: true });
        evs.push({ type: "ambushFlip", card: m, player: m.controller });
      }
      if (evs.length) pushEvents(G, evs);
    })]
  });

/** Jest / GY boss — revives the small engine pieces. */
export const fusion_grave_jester = M("fusion_grave_jester", "Grave Jester", "Abyss", 5, 5, "SR",
  "Contact: Jestling + any monster. Fanfare: Special Summon 1 monster with cost 2 or less from your GY.",
  {
    archetypes: ["jest_engine", "gy", "gy_fusion_combo"],
    fusion: {
      contact: true,
      recipes: [
        { materials: [{ kind: "id", id: "jestling" }, { kind: "generic", filter: (c) => c.def?.type === "monster" }], allowSubstitute: true }
      ]
    },
    triggers: [must("jester_revive", "Revive a small monster", evSelfSummon, async (G, card) => {
      const pl = P(G, card.controller);
      const pool = pl.gy.filter((c) => c.def.type === "monster" && (c.def.cost || 0) <= 2);
      if (!pool.length) return;
      let pick = pool[0];
      if (pool.length > 1 && G.io?.choose) {
        const idxs = await G.io.choose(card.controller, {
          title: "Revive 1 monster from your GY",
          options: pool.map((c) => c.def.name),
          min: 1, max: 1, kind: "target", uids: pool.map((c) => c.uid)
        });
        pick = resolveChosenFromPool(pool, idxs, 1)[0] || pick;
      }
      specialSummon(G, pick, card.controller, card);
    })]
  });

/** Terra closer — turns the wall count into the win. */
export const fusion_worldroot = M("fusion_worldroot", "Worldroot", "Terra", 7, 8, "UR",
  "Contact: 2 Terra. Ward. Fanfare: heal 4, then deal 1 to all enemy monsters for each Ward monster you control.",
  {
    keywords: ["ward"],
    archetypes: ["ward_walls", "heal_ramp", "heal_stall", "terra_beat"],
    fusion: { contact: true, recipes: any2(tribe("Terra")) },
    triggers: [must("worldroot_sweep", "Heal 4, Ward sweep", evSelfSummon, async (G, card) => {
      healPlayer(G, card.controller, 4);
      const wards = monstersOf(G, card.controller)
        .filter((m) => m.faceup && (m.def?.keywords?.includes("ward") || m.wardGranted)).length;
      if (!wards) return;
      for (const m of monstersOf(G, opp(card.controller))) damageMonster(G, m, wards, card);
      sweepDestroyed(G);
    })]
  });

/** Ignis mid — board control instead of another face ping. */
export const fusion_cinder_archon = M("fusion_cinder_archon", "Cinder Archon", "Ignis", 5, 5, "SR",
  "Contact: 2 Ignis. Fanfare: deal 1 to all enemy monsters; if any are destroyed, draw 1.",
  {
    archetypes: ["burn", "pyro_control", "ignis_mid"],
    fusion: { contact: true, recipes: any2(tribe("Ignis")) },
    triggers: [must("archon_sweep", "Sweep 1, maybe draw", evSelfSummon, async (G, card) => {
      for (const m of monstersOf(G, opp(card.controller))) damageMonster(G, m, 1, card);
      const dead = sweepDestroyed(G, "effect");
      if (dead.length) drawCards(G, card.controller, 1);
    })]
  });

/** Ward boss for wall decks of any tribe. */
export const fusion_warden_titan = M("fusion_warden_titan", "Warden Titan", "Neutral", 4, 8, "SR",
  "Contact: 2 Ward monsters. Ward. Fanfare: your other face-up monsters gain Ward.",
  {
    keywords: ["ward"],
    archetypes: ["ward_walls", "token_walls", "heal_stall"],
    fusion: { contact: true, recipes: any2(hasKw("ward")) },
    triggers: [must("warden_grant", "Your monsters gain Ward", evSelfSummon, async (G, card) => {
      for (const m of monstersOf(G, card.controller)) {
        if (m !== card && m.faceup) m.wardGranted = true;
      }
    })]
  });

/** Rush boss — the whole board gets going. */
export const fusion_rush_general = M("fusion_rush_general", "Rush General", "Neutral", 4, 3, "R",
  "Contact: 2 Rush monsters. Rush. Fanfare: your face-up monsters gain Rush.",
  {
    keywords: ["rush"],
    archetypes: ["wide_rush", "aggro_swarm", "going_second"],
    fusion: { contact: true, recipes: any2(hasKw("rush")) },
    triggers: [must("general_rush", "Your monsters gain Rush", evSelfSummon, async (G, card) => {
      for (const m of monstersOf(G, card.controller)) {
        if (m.faceup) m.rushGranted = true;
      }
    })]
  });

/** Neutral value boss — recycles a Quick spell. */
export const fusion_storm_caller = M("fusion_storm_caller", "Storm Caller", "Neutral", 4, 4, "R",
  "Contact: 2 Neutral monsters. Fanfare: add 1 Quick spell from your GY to your hand.",
  {
    archetypes: ["spell_tempo", "value_midrange", "staple"],
    fusion: { contact: true, recipes: any2(tribe("Neutral")) },
    triggers: [must("caller_recycle", "Recover a Quick spell", evSelfSummon, async (G, card) => {
      const pl = P(G, card.controller);
      const pool = pl.gy.filter((c) => c.def.type === "spell" && c.def.spell?.subtype === "quick");
      if (!pool.length) return;
      let pick = pool[0];
      if (pool.length > 1 && G.io?.choose) {
        const idxs = await G.io.choose(card.controller, {
          title: "Add 1 Quick spell from your GY",
          options: pool.map((c) => c.def.name),
          min: 1, max: 1, kind: "target", uids: pool.map((c) => c.uid)
        });
        pick = resolveChosenFromPool(pool, idxs, 1)[0] || pick;
      }
      const i = pl.gy.indexOf(pick);
      if (i >= 0) pl.gy.splice(i, 1);
      pick.loc = "hand";
      pl.hand.push(pick);
    })]
  });

export const EXTRA_CARDS = [
  fusion_pyre_wyrm, fusion_grave_tyrant, fusion_veil_lock, fusion_grove_titan,
  fusion_grove_knight, fusion_tempo_ace, fusion_mill_maw,
  fusion_ash_seraph, fusion_tide_hydra, fusion_root_colossus,
  fusion_staple_knight, fusion_staple_aegis,
  fusion_deep_hollow, fusion_trapdoor_fiend, fusion_grave_jester, fusion_worldroot,
  fusion_cinder_archon, fusion_warden_titan, fusion_rush_general, fusion_storm_caller
];

export const EXTRA_DB = Object.fromEntries(EXTRA_CARDS.map((c) => [c.id, c]));

// Wave C content: keywords, hand traps, fusion monsters, substitutes, GY-fusion spell.
import { P, opp, monstersOf, pushEvents } from "../../engine/state.js";
import {
  drawCards, dealDamageToPlayer, healPlayer, damageMonster, sweepDestroyed,
  destroyByEffect, sendToGY, mill, specialSummon, discardCard
} from "../../engine/ops.js";
import { negateLastLinkOfKind } from "../../engine/chain.js";
import { gyFusionSummon, legalGyFusions } from "../../engine/fusion.js";
import {
  must,
  evSelfSummon,
  rDraw, rDamageLeader, rHeal,
  tEnemyMonster, tOwnMonster
} from "./helpers.js";

const M = (id, name, tribe, cost, atk, def, rarity, text, extra = {}) =>
  ({ id, name, type: "monster", tribe, cost, atk, def, rarity, text, ...extra });
const S = (id, name, subtype, speed, cost, rarity, text, extra = {}) =>
  ({ id, name, type: "spell", cost, rarity, text, spell: { subtype, speed, ...extra } });

/* ---- Keywords ---- */
export const ward_sentinel = M("ward_sentinel", "Ward Sentinel", "Terra", 3, 1, 5, "R",
  "Ward. A living wall.",
  { keywords: ["ward"], archetypes: ["ward_walls", "heal_ramp"] });

export const drain_leech = M("drain_leech", "Drain Leech", "Abyss", 2, 2, 2, "R",
  "Drain. Damage this deals also heals you.",
  { keywords: ["drain"], archetypes: ["gy", "control_counters"] });

export const ambush_stalker = M("ambush_stalker", "Ambush Stalker", "Abyss", 3, 3, 2, "SR",
  "Ambush. You may set this face-down in a monster zone (uses Normal Summon).",
  { keywords: ["ambush"], archetypes: ["control_counters", "hybrid_abyss_tempo"] });

export const rush_swarmling = M("rush_swarmling", "Rush Swarmling", "Ignis", 1, 1, 1, "N",
  "Rush. Swarm the board.",
  { keywords: ["rush"], archetypes: ["aggro_swarm", "burn"] });

export const heal_bloom = M("heal_bloom", "Heal Bloom", "Terra", 2, 1, 3, "N",
  "Fanfare: heal 2.",
  {
    archetypes: ["heal_ramp", "ward_walls"],
    triggers: [must("bloom_heal", "Heal 2", evSelfSummon,
      async (G, card) => healPlayer(G, card.controller, 2))]
  });

export const mill_spore = M("mill_spore", "Mill Spore", "Abyss", 2, 1, 2, "N",
  "Fanfare: mill the top 2 of your opponent's deck.",
  {
    archetypes: ["mill", "gy"],
    triggers: [must("mill_fan", "Mill 2", evSelfSummon,
      async (G, card) => mill(G, opp(card.controller), 2))]
  });

export const evolve_colossus = M("evolve_colossus", "Evolve Colossus", "Terra", 5, 4, 5, "UR",
  "Tribute 1. Evolve: deal 3 to the enemy leader.",
  {
    level: 6,
    archetypes: ["big_evolve", "heal_ramp"],
    evolveEffect: { text: "Deal 3 to the enemy leader", resolve: rDamageLeader(3) }
  });

export const burn_spark_imp = M("burn_spark_imp", "Burn Spark Imp", "Ignis", 1, 1, 1, "N",
  "Rush. Fanfare: deal 1 to the enemy leader.",
  {
    keywords: ["rush"],
    archetypes: ["burn", "aggro_swarm"],
    triggers: [must("spark_burn", "Deal 1", evSelfSummon,
      async (G, card) => dealDamageToPlayer(G, opp(card.controller), 1, card))]
  });

export const fusion_polymer = M("fusion_polymer", "Polymer Wisp", "Neutral", 2, 1, 1, "R",
  "Fusion Substitute — can replace any one named Contact material.",
  { fusionSubstitute: true, archetypes: ["contact_combo", "fusion_ladder"] });

/* ---- Hand traps (1–2 Bronze+) ---- */
export const ash_whisper = S("ash_whisper", "Ash Whisper", "quick", 2, 1, "SR",
  "Hand trap: discard this from hand on opponent's turn; negate a monster effect or Evolve effect on the chain.",
  {
    handTrap: true,
    counterWhat: [],
    resolve: async (G) => { negateLastLinkOfKind(G, ["monsterEffect", "evolveEffect"]); },
    archetypes: ["control_counters", "hybrid_abyss_tempo"]
  });
// Mark on card root too for legalFastEffects check
ash_whisper.handTrap = true;

export const veil_negate = S("veil_negate", "Veil Negate", "counter", 3, 2, "UR",
  "Hand trap Counter: from hand on opponent's turn; negate a summon.",
  {
    handTrap: true,
    counterWhat: ["summon"],
    resolve: async (G) => {
      if (G.summonNegCtx) G.summonNegCtx.negated = true;
    },
    archetypes: ["control_counters"]
  });
veil_negate.handTrap = true;

/* ---- GY Fusion spell ---- */
export const gy_fusion_rite = S("gy_fusion_rite", "Grave Fusion Rite", "normal", 1, 2, "SR",
  "Fusion Summon 1 Fusion Monster from your Extra using monsters from your field, hand, and/or GY as material.",
  {
    archetypes: ["fusion_ladder", "gy", "contact_combo"],
    condition: (G, card) => legalGyFusions(G, card.controller).length > 0,
    resolve: async (G, card) => {
      const p = card.controller;
      const opts = legalGyFusions(G, p);
      if (!opts.length) return;
      let pick = opts[0];
      if (opts.length > 1 && G.io?.choose) {
        const idxs = await G.io.choose(p, {
          kind: "gyFusion",
          title: "Choose a Fusion to summon",
          options: opts.map((o) => o.fusion.def.name),
          atk: opts.map((o) => o.fusion.def.atk || 0),
          min: 1,
          max: 1
        });
        const i = Array.isArray(idxs) ? idxs[0] : 0;
        pick = opts[i] || opts[0];
      }
      await gyFusionSummon(G, p, pick.fusion, pick.materials);
    }
  });

/* ---- Fusion monsters (Extra Deck) ---- */
export const fusion_ember_drake = M("fusion_ember_drake", "Ember Drake", "Ignis", 0, 5, 4, "SR",
  "Contact Fusion: Ember Fox + Cinder Knight (or substitute). Rush.",
  {
    summon: "fusion",
    keywords: ["rush"],
    archetypes: ["contact_combo", "aggro_swarm", "fusion_ladder"],
    fusion: {
      contact: true,
      recipes: [
        { materials: [{ kind: "id", id: "ember_fox" }, { kind: "id", id: "cinder_knight" }], allowSubstitute: true },
        { materials: [{ kind: "id", id: "ember_fox" }, { kind: "id", id: "fusion_polymer" }] },
      ]
    }
  });

export const fusion_abyss_leviathan = M("fusion_abyss_leviathan", "Abyss Leviathan", "Abyss", 0, 6, 6, "UR",
  "Contact Fusion: Tide Caller + Frost Mage. Ward.",
  {
    summon: "fusion",
    keywords: ["ward"],
    archetypes: ["fusion_ladder", "control_counters", "hybrid_terra_abyss"],
    fusion: {
      contact: true,
      recipes: [
        { materials: [{ kind: "id", id: "tide_caller" }, { kind: "id", id: "frost_mage" }], allowSubstitute: true }
      ]
    }
  });

export const fusion_terra_crown = M("fusion_terra_crown", "Crown of the Grove", "Terra", 0, 7, 7, "UR",
  "Ward. Contact: Ember Drake + a Terra, or any Fusion + Grove Elder.",
  {
    summon: "fusion",
    keywords: ["ward"],
    archetypes: ["fusion_ladder", "big_evolve", "heal_ramp"],
    fusion: {
      contact: true,
      recipes: [
        {
          materials: [
            { kind: "id", id: "fusion_ember_drake" },
            { kind: "generic", filter: (c) => c.def?.tribe === "Terra" }
          ],
          allowSubstitute: true
        },
        {
          materials: [
            { kind: "fusion" },
            { kind: "id", id: "grove_elder" }
          ],
          allowSubstitute: true
        }
      ]
    }
  });

export const fusion_choice_blade = M("fusion_choice_blade", "Choice Blade", "Neutral", 0, 4, 3, "R",
  "Rush. Contact: Swift Falcon + Doomblade Novice (same recipe as Choice Shield).",
  {
    summon: "fusion",
    keywords: ["rush"],
    archetypes: ["contact_combo", "fusion_ladder"],
    fusion: {
      contact: true,
      recipes: [
        { materials: [{ kind: "id", id: "swift_falcon" }, { kind: "id", id: "doomblade_novice" }], allowSubstitute: true }
      ]
    }
  });

export const fusion_choice_shield = M("fusion_choice_shield", "Choice Shield", "Neutral", 0, 2, 6, "R",
  "Ward. Contact: Swift Falcon + Doomblade Novice (same recipe as Choice Blade).",
  {
    summon: "fusion",
    keywords: ["ward"],
    archetypes: ["contact_combo", "ward_walls", "fusion_ladder"],
    fusion: {
      contact: true,
      recipes: [
        { materials: [{ kind: "id", id: "swift_falcon" }, { kind: "id", id: "doomblade_novice" }], allowSubstitute: true }
      ]
    }
  });

export const spark_raider = M("spark_raider", "Spark Raider", "Ignis", 2, 3, 1, "R",
  "Rush. Fanfare: deal 1 to the enemy leader.",
  {
    keywords: ["rush"],
    archetypes: ["otk_face", "burn", "ignis_mid", "pyro_control"],
    triggers: [must("raider_burn", "Deal 1", evSelfSummon,
      async (G, card) => dealDamageToPlayer(G, opp(card.controller), 1, card))]
  });

export const edict_squire = M("edict_squire", "Edict Squire", "Neutral", 2, 2, 2, "R",
  "Fanfare: draw 1.",
  {
    archetypes: ["counter_war", "chain_lock", "handtrap_midrange"],
    triggers: [must("squire_draw", "Draw 1", evSelfSummon, rDraw(1))]
  });

export const trapdoor_lurker = M("trapdoor_lurker", "Trapdoor Lurker", "Abyss", 2, 3, 2, "SR",
  "Rush. Fanfare: deal 2 to the enemy leader.",
  {
    keywords: ["rush"],
    archetypes: ["ambush_trapdoor", "abyss_tempo"],
    triggers: [must("lurk_burn", "Deal 2", evSelfSummon,
      async (G, card) => dealDamageToPlayer(G, opp(card.controller), 2, card))]
  });

export const bastion_oak = M("bastion_oak", "Bastion Oak", "Terra", 3, 2, 5, "R",
  "Ward. Fanfare: heal 2. Level 4 — no tribute.",
  {
    level: 4,
    keywords: ["ward"],
    archetypes: ["ward_walls", "heal_stall", "big_evolve"],
    triggers: [must("oak_heal", "Heal 2", evSelfSummon, rHeal(2))]
  });

export const pyre_colossus = M("pyre_colossus", "Pyre Colossus", "Ignis", 4, 3, 4, "SR",
  "Evolve: deal 2 to the enemy leader.",
  {
    archetypes: ["evolve_burn", "big_evolve"],
    evolveEffect: { text: "Deal 2 to the enemy leader", resolve: rDamageLeader(2) }
  });

export const tide_cutter = M("tide_cutter", "Tide Cutter", "Abyss", 2, 2, 3, "R",
  "Drain. Fanfare: deal 1 to the enemy leader.",
  {
    keywords: ["drain"],
    archetypes: ["abyss_tempo", "tempo_bounce"],
    triggers: [must("cut_drain", "Deal 1", evSelfSummon,
      async (G, card) => dealDamageToPlayer(G, opp(card.controller), 1, card))]
  });

export const tri_envoy = M("tri_envoy", "Tri Envoy", "Neutral", 3, 3, 3, "R",
  "Rush. Fanfare: draw 1. Level 4 — no tribute.",
  {
    level: 4,
    keywords: ["rush"],
    archetypes: ["tri_splash"],
    triggers: [must("envoy_draw", "Draw 1", evSelfSummon, rDraw(1))]
  });

export const lane_breaker = M("lane_breaker", "Lane Breaker", "Neutral", 2, 3, 2, "R",
  "Rush. A clean beater for decks that stall out.",
  {
    keywords: ["rush"],
    archetypes: ["tempo_bounce", "pyro_control", "ambush_trapdoor"]
  });

export const WAVE_C_CARDS = [
  ward_sentinel, drain_leech, ambush_stalker, rush_swarmling, heal_bloom, mill_spore,
  evolve_colossus, burn_spark_imp, fusion_polymer,
  ash_whisper, veil_negate, gy_fusion_rite,
  fusion_ember_drake, fusion_abyss_leviathan, fusion_terra_crown,
  fusion_choice_blade, fusion_choice_shield,
  spark_raider, edict_squire, trapdoor_lurker, bastion_oak, pyre_colossus, tide_cutter, tri_envoy, lane_breaker
];

export const WAVE_C_DB = Object.fromEntries(WAVE_C_CARDS.map((c) => [c.id, c]));

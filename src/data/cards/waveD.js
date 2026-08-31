// Wave D: a second field Quick Effect and a small constructed bump. Silver+.
import { P, opp } from "../../engine/state.js";
import { drawCards, mill } from "../../engine/ops.js";
import {
  must, evSelfSummon, rDraw, rHeal, rDamageLeader, rDamageMonster, rBuffTarget,
  tEnemyMonster, tOwnMonster
} from "./helpers.js";

const M = (id, name, tribe, cost, atk, def, rarity, text, extra = {}) =>
  ({ id, name, type: "monster", tribe, cost, atk, def, rarity, text, ...extra });
const S = (id, name, subtype, speed, cost, rarity, text, extra = {}) =>
  ({ id, name, type: "spell", cost, rarity, text, spell: { subtype, speed, ...extra } });

/** Second field Quick Effect — Frost Mage is the first. */
export const spark_channeler = M("spark_channeler", "Spark Channeler", "Ignis", 3, 2, 3, "R",
  "Quick Effect (once per turn): deal 1 to an enemy monster.",
  {
    archetypes: ["burn", "spell_tempo"],
    quick: { text: "Deal 1 to an enemy monster", targets: [tEnemyMonster()], resolve: rDamageMonster(1) }
  });

export const ember_lancer = M("ember_lancer", "Ember Lancer", "Ignis", 2, 2, 1, "N",
  "Rush.",
  { keywords: ["rush"], archetypes: ["aggro_swarm", "wide_rush"] });

export const frost_sentry = M("frost_sentry", "Frost Sentry", "Abyss", 3, 1, 4, "R",
  "Ward. A cold door.",
  { keywords: ["ward"], archetypes: ["ward_walls", "control_counters"] });

export const tide_skimmer = M("tide_skimmer", "Tide Skimmer", "Abyss", 2, 2, 2, "N",
  "Fanfare: mill the top card of the opponent's deck.",
  {
    archetypes: ["mill", "gy"],
    triggers: [must("skim_mill", "Mill 1", evSelfSummon,
      async (G, card) => mill(G, opp(card.controller), 1))]
  });

export const moss_bulwark = M("moss_bulwark", "Moss Bulwark", "Terra", 4, 2, 5, "N",
  "Ward. Tribute 1 (Level 6).",
  { keywords: ["ward"], archetypes: ["ward_walls", "heal_ramp"] });

export const grove_chanter = M("grove_chanter", "Grove Chanter", "Terra", 2, 1, 3, "N",
  "Fanfare: heal 1.",
  {
    archetypes: ["heal_ramp", "ward_walls"],
    triggers: [must("chant_heal", "Heal 1", evSelfSummon, rHeal(1))]
  });

export const wind_cutter = M("wind_cutter", "Wind Cutter", "Neutral", 2, 2, 1, "R",
  "Rush. Fanfare: if you have 3 or fewer cards in hand, draw 1.",
  {
    keywords: ["rush"],
    archetypes: ["tempo_bounce", "wide_rush"],
    triggers: [must("cut_draw", "Draw 1", evSelfSummon, async (G, card) => {
      if (P(G, card.controller).hand.length <= 3) drawCards(G, card.controller, 1);
    })]
  });

export const ash_courier = M("ash_courier", "Ash Courier", "Neutral", 1, 1, 1, "N",
  "Fanfare: if you control no other monsters, draw 1.",
  {
    archetypes: ["draw", "aggro_swarm"],
    triggers: [must("courier_draw", "Draw 1", evSelfSummon, async (G, card) => {
      const others = P(G, card.controller).mz.filter((m) => m && m !== card);
      if (!others.length) await rDraw(1)(G, card);
    })]
  });

export const chain_spark = S("chain_spark", "Chain Spark", "quick", 2, 1, "N",
  "Quick: a monster you control gets +1/+0 until end of turn.",
  { targets: [tOwnMonster()], resolve: rBuffTarget(1, 0, false, 0) });

export const still_ward = S("still_ward", "Still Ward", "continuous", 1, 2, "N",
  "Continuous: your monsters get +0/+1.",
  {
    continuousAura: true,
    resolve: async () => {},
    ongoing: (G, source, target, v, stat) =>
      (target.controller === source.controller && target.loc === "mz" && stat === "def") ? v + 1 : v
  });

export const pyre_pact = S("pyre_pact", "Pyre Pact", "normal", 1, 1, "N",
  "Normal: deal 1 to the enemy leader.",
  { resolve: rDamageLeader(1) });

export const WAVE_D_CARDS = [
  spark_channeler, ember_lancer, frost_sentry, tide_skimmer,
  moss_bulwark, grove_chanter, wind_cutter, ash_courier,
  chain_spark, still_ward, pyre_pact
];

export const WAVE_D_DB = Object.fromEntries(WAVE_D_CARDS.map((c) => [c.id, c]));

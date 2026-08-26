// Silver tier pool — unlocks with ranked tier / live-ops. Expands toward ~40 archetypes.
import { P, opp, monstersOf, pushEvents } from "../../engine/state.js";
import {
  drawCards, dealDamageToPlayer, healPlayer, damageMonster, sweepDestroyed,
  bounceToHand, buff, mill
} from "../../engine/ops.js";
import {
  must, evSelfSummon, evAmbushFlip, rDraw, rHeal, rDamageLeader, rDamageMonster,
  tEnemyMonster
} from "./helpers.js";

const mon = (id, name, tribe, cost, atk, def, rarity, text, extra = {}) =>
  ({ id, name, type: "monster", tribe, cost, atk, def, rarity, text, tier: "silver", ...extra });
const spl = (id, name, subtype, speed, cost, rarity, text, extra = {}) =>
  ({ id, name, type: "spell", cost, rarity, text, tier: "silver", spell: { subtype, speed, ...extra } });

export const SILVER_CARDS = [
  mon("silver_ember_scout", "Ember Scout", "Ignis", 2, 2, 1, "R", "Rush. Fanfare: deal 1 to the enemy leader.", {
    keywords: ["rush"], archetypes: ["wide_rush", "spell_tempo"],
    triggers: [must("scout_burn", "Deal 1", evSelfSummon,
      async (G, card) => dealDamageToPlayer(G, opp(card.controller), 1, card))]
  }),
  mon("silver_token_mason", "Token Mason", "Terra", 3, 1, 3, "R", "Ward. Fanfare: heal 2.", {
    keywords: ["ward"], archetypes: ["token_walls", "ward_walls"],
    triggers: [must("mason_heal", "Heal 2", evSelfSummon, rHeal(2))]
  }),
  mon("silver_discard_wraith", "Discard Wraith", "Abyss", 2, 2, 2, "SR", "Drain. Fanfare: draw 1 if you have 4 or more cards in GY.", {
    keywords: ["drain"], archetypes: ["discard_payoff", "gy"],
    triggers: [must("wraith_draw", "Draw 1", evSelfSummon, async (G, card) => {
      if (P(G, card.controller).gy.length >= 4) drawCards(G, card.controller, 1);
    })]
  }),
  mon("silver_lane_surfer", "Lane Surfer", "Neutral", 2, 2, 2, "R", "Rush. Fanfare: this card gets +1 ATK this turn.", {
    keywords: ["rush"], archetypes: ["lane_surfer"],
    triggers: [must("surf_buff", "+1 ATK this turn", evSelfSummon,
      async (G, card) => { if (card.loc === "mz") buff(G, card, 1, 0, { permanent: false }); })]
  }),
  mon("silver_otk_blade", "OTK Blade", "Ignis", 4, 5, 2, "UR", "Rush. Fanfare: deal 1 to the enemy leader.", {
    keywords: ["rush"], archetypes: ["otk_face", "burn"],
    triggers: [must("blade_burn", "Deal 1", evSelfSummon,
      async (G, card) => dealDamageToPlayer(G, opp(card.controller), 1, card))]
  }),
  mon("silver_stall_shell", "Stall Shell", "Terra", 4, 1, 6, "SR", "Ward. Fanfare: heal 3.", {
    keywords: ["ward"], archetypes: ["heal_stall", "drain_walls"],
    triggers: [must("shell_heal", "Heal 3", evSelfSummon, rHeal(3))]
  }),
  mon("silver_chain_lock", "Chain Lock Adept", "Abyss", 2, 2, 3, "R", "Fanfare: draw 1.", {
    archetypes: ["chain_lock", "control_counters"],
    triggers: [must("lock_draw", "Draw 1", evSelfSummon, rDraw(1))]
  }),
  mon("silver_choice_agent", "Choice Agent", "Neutral", 2, 2, 2, "R", "Fusion Substitute — can replace any one named Contact material.", {
    fusionSubstitute: true, archetypes: ["choice_recipe", "substitute_toolbox"]
  }),
  spl("silver_tempo_bolt", "Tempo Bolt", "quick", 2, 1, "R", "Quick: deal 1 damage to an enemy monster.", {
    targets: [tEnemyMonster()],
    resolve: rDamageMonster(1),
    archetypes: ["spell_tempo", "hybrid_abyss_tempo"]
  }),
  spl("silver_comeback_draw", "Comeback Scroll", "normal", 1, 1, "SR", "Draw 1. If your LP is 10 or less, draw 2 instead.", {
    resolve: async (G, card) => {
      drawCards(G, card.controller, P(G, card.controller).lp <= 10 ? 2 : 1);
    },
    archetypes: ["comeback_toolbox"]
  }),
  spl("silver_going_second", "Second-Strike Banner", "continuous", 1, 2, "R", "Continuous: your Rush monsters get +1 ATK.", {
    resolve: async () => {},
    ongoing: (G, source, target, v, stat) =>
      (stat === "atk" && target.controller === source.controller
        && (target.def.keywords?.includes("rush") || target.rushGranted)) ? v + 1 : v,
    archetypes: ["going_second", "wide_rush"]
  }),
  mon("silver_evolve_burn", "Evolve Burner", "Ignis", 2, 2, 2, "SR", "Evolve: deal 2 to the enemy leader.", {
    archetypes: ["evolve_burn", "big_evolve"],
    evolveEffect: { text: "Deal 2 to the enemy leader", resolve: rDamageLeader(2) }
  }),
  mon("silver_bounce_tide", "Bounce Tide", "Abyss", 2, 2, 3, "R", "Fanfare: bounce an enemy monster.", {
    archetypes: ["tempo_bounce"],
    triggers: [must("tide_bounce", "Bounce an enemy monster", evSelfSummon, async (G, card) => {
      const foes = monstersOf(G, opp(card.controller)).filter((m) => m.faceup);
      if (!foes.length) return;
      const t = foes.reduce((a, b) => (a.def.atk >= b.def.atk ? a : b));
      const ev = bounceToHand(G, t);
      pushEvents(G, [ev]);
    })]
  }),
  mon("silver_ramp_seed", "Ramp Seed", "Terra", 1, 1, 1, "N", "Fanfare: heal 1.", {
    archetypes: ["ramp_into_boss", "heal_ramp"],
    triggers: [must("seed_heal", "Heal 1", evSelfSummon, rHeal(1))]
  }),
  mon("silver_fusion_stall", "Stall-to-Fusion", "Neutral", 2, 1, 4, "R", "Ward. Fusion substitute.", {
    keywords: ["ward"], fusionSubstitute: true, archetypes: ["stall_to_fusion"]
  }),
  mon("silver_handtrap_mid", "Veil Adept", "Abyss", 2, 2, 2, "SR", "Fanfare: draw 1.", {
    archetypes: ["handtrap_midrange"],
    triggers: [must("veil_draw", "Draw 1", evSelfSummon, rDraw(1))]
  }),
  mon("silver_lifegain_mid", "Grove Mid", "Terra", 3, 2, 4, "R", "Fanfare: heal 2.", {
    archetypes: ["lifegain_midrange", "value_midrange"],
    triggers: [must("grove_heal", "Heal 2", evSelfSummon, rHeal(2))]
  }),
  mon("silver_tri_splash", "Tri-Splash Agent", "Neutral", 2, 2, 2, "UR", "Rush. Fanfare: deal 1 to the enemy leader.", {
    keywords: ["rush"], archetypes: ["tri_splash"],
    triggers: [must("tri_ping", "Deal 1", evSelfSummon,
      async (G, card) => dealDamageToPlayer(G, opp(card.controller), 1, card))]
  }),
  mon("silver_ambush_door", "Ambush Door", "Abyss", 2, 2, 3, "SR", "Ambush. When this card is summoned or flipped face-up: deal 2 to an enemy monster.", {
    keywords: ["ambush"], archetypes: ["ambush_trapdoor"],
    triggers: [must("door_shot", "Deal 2 to a monster",
      (G, card, ev) => evSelfSummon(G, card, ev) || evAmbushFlip(G, card, ev), async (G, card) => {
      const foes = monstersOf(G, opp(card.controller)).filter((m) => m.faceup);
      if (!foes.length) return;
      const t = foes.reduce((a, b) => (a.def.atk >= b.def.atk ? a : b));
      damageMonster(G, t, 2, card);
      sweepDestroyed(G);
    })]
  }),
  mon("silver_gy_fusion", "Gy Fusion Adept", "Abyss", 2, 2, 2, "R", "Fanfare: mill the top 2 of your deck.", {
    archetypes: ["gy_fusion_combo"],
    triggers: [must("gyadept_mill", "Mill 2", evSelfSummon, async (G, card) => {
      mill(G, card.controller, 2);
    })]
  })
];

export const SILVER_DB = Object.fromEntries(SILVER_CARDS.map((c) => [c.id, c]));

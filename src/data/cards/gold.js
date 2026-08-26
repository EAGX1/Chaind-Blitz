// Gold tier pool — unlocks at Gold ranked tier.
import { P, opp, monstersOf, laneForZone, hasKeyword, pushEvents } from "../../engine/state.js";
import { drawCards, mill, buff, dealDamageToPlayer, damageMonster, sweepDestroyed, bounceToHand } from "../../engine/ops.js";
import { rDamageMonster, tEnemyMonster, must, evSelfSummon, rDraw, rHeal } from "./helpers.js";

const mon = (id, name, tribe, cost, atk, def, rarity, text, extra = {}) =>
  ({ id, name, type: "monster", tribe, cost, atk, def, rarity, text, tier: "gold", ...extra });
const spl = (id, name, subtype, speed, cost, rarity, text, extra = {}) =>
  ({ id, name, type: "spell", cost, rarity, text, tier: "gold", spell: { subtype, speed, ...extra } });

export const GOLD_CARDS = [
  mon("gold_ember_vanguard", "Ember Vanguard", "Ignis", 3, 3, 2, "R",
    "Rush. Fanfare: deal 1 to the enemy leader.", {
      keywords: ["rush"],
      triggers: [must("ember_vg_burn", "Deal 1 to the enemy leader", evSelfSummon, async (G, card) => {
        dealDamageToPlayer(G, opp(card.controller), 1, card);
      })]
    }),
  mon("gold_tide_oracle", "Tide Oracle", "Abyss", 3, 2, 3, "R",
    "Fanfare: draw 1.", {
      triggers: [must("tide_oracle_draw", "Draw 1", evSelfSummon, rDraw(1))]
    }),
  mon("gold_grove_warden", "Grove Warden", "Terra", 4, 2, 5, "SR",
    "Ward. Fanfare: heal 2.", {
      keywords: ["ward"],
      triggers: [must("grove_heal", "Heal 2", evSelfSummon, rHeal(2))]
    }),
  mon("gold_lane_ace", "Lane Ace", "Neutral", 3, 3, 3, "R",
    "Rush. Fanfare: if summoned in a revealed Field Lane, this card gets +1/+1.", {
      keywords: ["rush"],
      triggers: [must("lane_ace_buff", "+1/+1 if the lane is revealed", evSelfSummon, async (G, card) => {
        const lane = G.lanes?.[laneForZone(card.zone)];
        if (lane?.revealed && card.loc === "mz") buff(G, card, 1, 1, { permanent: true });
      })]
    }),
  mon("gold_fusion_envoy", "Fusion Envoy", "Neutral", 2, 2, 2, "SR",
    "Fusion substitute. Fanfare: mill 1.", {
      fusionSubstitute: true,
      triggers: [must("envoy_mill", "Mill 1", evSelfSummon, async (G, card) => {
        mill(G, card.controller, 1);
      })]
    }),
  mon("gold_burn_herald", "Burn Herald", "Ignis", 2, 2, 1, "R",
    "Fanfare: deal 1 to the enemy leader.", {
      triggers: [must("burn_herald_ping", "Deal 1 to the enemy leader", evSelfSummon, async (G, card) => {
        dealDamageToPlayer(G, opp(card.controller), 1, card);
      })]
    }),
  mon("gold_abyss_lock", "Abyss Lock", "Abyss", 4, 2, 4, "SR",
    "Fanfare: bounce an enemy Set spell, or deal 1 to an enemy monster if none are Set.", {
      triggers: [must("abyss_lock_ctrl", "Bounce a Set spell or ping a monster", evSelfSummon, async (G, card) => {
        const sets = P(G, opp(card.controller)).stz.filter((c) => c && !c.faceup);
        if (sets.length) {
          const ev = bounceToHand(G, sets[0]);
          pushEvents(G, [ev]);
          return;
        }
        const foes = monstersOf(G, opp(card.controller)).filter((m) => m.faceup);
        if (foes[0]) { damageMonster(G, foes[0], 1, card); sweepDestroyed(G); }
      })]
    }),
  spl("gold_tempo_brand", "Tempo Brand", "quick", 2, 1, "R", "Quick: deal 1 to an enemy monster.", {
    targets: [tEnemyMonster()],
    resolve: rDamageMonster(1)
  }),
  spl("gold_second_wind", "Second Wind", "normal", 1, 1, "SR", "Draw 1; if LP ≤ 12, draw 2 instead.", {
    resolve: async (G, card) => {
      drawCards(G, card.controller, P(G, card.controller).lp <= 12 ? 2 : 1);
    }
  }),
  spl("gold_ward_banner", "Ward Banner", "continuous", 1, 2, "R", "Continuous: your Ward monsters gain +1 DEF.", {
    resolve: async () => {},
    ongoing: (G, source, target, v, stat) =>
      (stat === "def" && target.controller === source.controller
        && (target.def.keywords?.includes("ward") || target.wardGranted || hasKeyword(target, "ward"))) ? v + 1 : v
  }),
];

export const GOLD_DB = Object.fromEntries(GOLD_CARDS.map((c) => [c.id, c]));

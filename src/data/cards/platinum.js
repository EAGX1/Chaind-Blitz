// Platinum tier pool — unlocks at Platinum ranked tier.
import { monstersOf, opp, hasKeyword, pushEvents } from "../../engine/state.js";
import { drawCards, healPlayer, dealDamageToPlayer, damageMonster, sweepDestroyed, bounceToHand, buff } from "../../engine/ops.js";
import { rDamageMonster, rNegate, tEnemyMonster, must, evSelfSummon, evAmbushFlip, rDraw } from "./helpers.js";

const mon = (id, name, tribe, cost, atk, def, rarity, text, extra = {}) =>
  ({ id, name, type: "monster", tribe, cost, atk, def, rarity, text, tier: "platinum", ...extra });
const spl = (id, name, subtype, speed, cost, rarity, text, extra = {}) =>
  ({ id, name, type: "spell", cost, rarity, text, tier: "platinum", spell: { subtype, speed, ...extra } });

export const PLATINUM_CARDS = [
  mon("plat_inferno_ace", "Inferno Ace", "Ignis", 4, 4, 3, "SR",
    "Rush. Fanfare: deal 2 to the enemy monster with the highest ATK.", {
      keywords: ["rush"],
      triggers: [must("inferno_snipe", "Deal 2 to the strongest enemy monster", evSelfSummon, async (G, card) => {
        const foes = monstersOf(G, opp(card.controller)).filter((m) => m.faceup);
        if (!foes.length) return;
        foes.sort((a, b) => (b.def.atk + (b.atkMod || 0)) - (a.def.atk + (a.atkMod || 0)));
        damageMonster(G, foes[0], 2, card);
        sweepDestroyed(G);
      })]
    }),
  mon("plat_deep_siren", "Deep Siren", "Abyss", 3, 2, 4, "R",
    "Fanfare: return an enemy monster to its owner's hand.", {
      triggers: [must("siren_bounce", "Bounce an enemy monster", evSelfSummon, async (G, card) => {
        const foes = monstersOf(G, opp(card.controller)).filter((m) => m.faceup);
        if (!foes[0]) return;
        const ev = bounceToHand(G, foes[0]);
        pushEvents(G, [ev]);
      })]
    }),
  mon("plat_world_root", "World Root", "Terra", 5, 3, 6, "UR",
    "Ward. Fanfare: heal 3; draw 1.", {
      keywords: ["ward"],
      triggers: [must("root_ramp", "Heal 3 and draw 1", evSelfSummon, async (G, card) => {
        healPlayer(G, card.controller, 3);
        drawCards(G, card.controller, 1);
      })]
    }),
  mon("plat_choice_mirror", "Choice Mirror", "Neutral", 2, 2, 2, "SR",
    "Fusion substitute. Fanfare: draw 1.", {
      fusionSubstitute: true,
      triggers: [must("mirror_draw", "Draw 1", evSelfSummon, rDraw(1))]
    }),
  mon("plat_ambush_reaper", "Ambush Reaper", "Abyss", 3, 3, 2, "SR",
    "Ambush. When this card is flipped face-up: deal 2 to the enemy leader.", {
      keywords: ["ambush"],
      triggers: [must("reaper_flip", "Deal 2 when flipped", evAmbushFlip, async (G, card) => {
        dealDamageToPlayer(G, opp(card.controller), 2, card);
      })]
    }),
  mon("plat_rush_herald", "Rush Herald", "Neutral", 2, 2, 1, "R",
    "Rush. Fanfare: your Rush monsters get +1 ATK this turn.", {
      keywords: ["rush"],
      triggers: [must("herald_wide", "+1 ATK to your Rush monsters this turn", evSelfSummon, async (G, card) => {
        for (const m of monstersOf(G, card.controller)) {
          if (m.faceup && hasKeyword(m, "rush")) buff(G, m, 1, 0, { permanent: false });
        }
      })]
    }),
  mon("plat_drain_saint", "Drain Saint", "Abyss", 3, 2, 3, "R",
    "Drain. Fanfare: deal 1 to the enemy leader.", {
      keywords: ["drain"],
      triggers: [must("saint_drain", "Deal 1", evSelfSummon, async (G, card) => {
        dealDamageToPlayer(G, opp(card.controller), 1, card);
      })]
    }),
  spl("plat_null_wave", "Null Wave", "counter", 3, 2, "UR", "Counter: negate a spell or monster effect.", {
    counterWhat: ["spell", "monsterEffect"],
    resolve: rNegate("spell", "monsterEffect")
  }),
  spl("plat_overdrive", "Overdrive Lance", "quick", 2, 2, "SR", "Quick: deal 2 to an enemy monster.", {
    targets: [tEnemyMonster()],
    resolve: rDamageMonster(2)
  }),
  spl("plat_lifewell", "Lifewell", "normal", 1, 1, "R", "Heal 4 LP; draw 1 if you control a Ward monster.", {
    resolve: async (G, card) => {
      healPlayer(G, card.controller, 4);
      const warded = monstersOf(G, card.controller).some(
        (m) => m.faceup && (m.def.keywords?.includes("ward") || m.wardGranted)
      );
      if (warded) drawCards(G, card.controller, 1);
    }
  }),
];

export const PLATINUM_DB = Object.fromEntries(PLATINUM_CARDS.map((c) => [c.id, c]));

// Wave E: original staples that do the jobs of the last 30 years of meta cards.
// Jobs only — not Blue-Eyes, Ash Blossom, Lightning Bolt, or Pot of Greed by name.
import { P, opp, monstersOf, pushEvents, getATK } from "../../engine/state.js";
import {
  dealDamageToPlayer, destroyByEffect, sendToGY, banishCard
} from "../../engine/ops.js";
import { negateLastLinkOfKind } from "../../engine/chain.js";
import {
  ifTrig, must,
  evSelfSummon, evOwnSpell,
  rDraw, rDamageLeader, rDestroyTarget, rBounceTarget, rBuffSelf,
  tEnemyMonster,
  costDiscardChosen
} from "./helpers.js";

const M = (id, name, tribe, cost, atk, def, rarity, text, extra = {}) =>
  ({ id, name, type: "monster", tribe, cost, atk, def, rarity, text, ...extra });
const S = (id, name, subtype, speed, cost, rarity, text, extra = {}) =>
  ({ id, name, type: "spell", cost, rarity, text, spell: { subtype, speed, ...extra } });

/** Blue-Eyes job: huge vanilla that costs two tributes. */
export const ivory_colossus = M("ivory_colossus", "Ivory Colossus", "Neutral", 5, 8, 8, "UR",
  "Tribute 2 (Level 8). Evolve: this gets +2/+0.",
  {
    level: 8, archetypes: ["big_evolve", "aggro_swarm"],
    evolveEffect: { text: "This gets +2/+0", resolve: rBuffSelf(2, 0, true) }
  });

/** Dark Magician job: a body that grows when you cast. */
export const ink_magister = M("ink_magister", "Ink Magister", "Neutral", 3, 3, 3, "R",
  "If you activate a spell: this gets +1/+0 until end of turn.",
  {
    archetypes: ["spell_tempo", "control_counters"],
    triggers: [ifTrig("ink_grow", "+1/+0 this turn", evOwnSpell, rBuffSelf(1, 0, false))]
  });

/** Ragavan / looter job: rush, draw off leader damage. */
export const trail_fox = M("trail_fox", "Trail Fox", "Ignis", 2, 2, 1, "R",
  "Rush. If this deals damage to a leader: draw 1.",
  {
    keywords: ["rush"],
    archetypes: ["aggro_swarm", "wide_rush"],
    triggers: [ifTrig("fox_loot", "Draw 1",
      (G, card, ev) => ev.type === "damage" && ev.source === card && ev.player !== card.controller,
      rDraw(1))]
  });

/** Knife Juggler job: ping the leader when you Normal Summon another. */
export const spark_juggler = M("spark_juggler", "Spark Juggler", "Ignis", 2, 2, 2, "R",
  "If you Normal Summon another monster: deal 1 to the enemy leader.",
  {
    archetypes: ["burn", "aggro_swarm"],
    triggers: [ifTrig("juggle_ping", "Deal 1",
      (G, card, ev) => ev.type === "normalSummon" && ev.card !== card && ev.card?.controller === card.controller,
      rDamageLeader(1))]
  });

/** Mirror Force / Dimensional Prison job: eat the attacker. */
export const bastion_reflector = M("bastion_reflector", "Bastion Reflector", "Terra", 3, 1, 5, "SR",
  "Ward. When an enemy monster declares an attack: destroy that monster.",
  {
    keywords: ["ward"],
    archetypes: ["ward_walls", "control_counters"],
    triggers: [must("reflect_strike", "Destroy the attacker",
      (G, card, ev) => ev.type === "attackDeclared" && ev.player !== card.controller && ev.card,
      async (G, card, link) => {
        const atk = link?.ev?.card;
        if (atk && atk.loc === "mz") destroyByEffect(G, atk, card);
      })]
  });

/** Nibiru-lite: punish a wide board, not a five-summon tax. */
export const overreach_warden = M("overreach_warden", "Overreach Warden", "Neutral", 3, 3, 3, "SR",
  "Fanfare: if the opponent controls 2 or more monsters, destroy 1.",
  {
    archetypes: ["control_counters", "tempo_bounce"],
    triggers: [ifTrig("overreach", "Destroy 1 enemy monster",
      (G, card, ev) => evSelfSummon(G, card, ev)
        && monstersOf(G, opp(card.controller)).filter((m) => m.faceup).length >= 2,
      rDestroyTarget(0),
      { targets: [tEnemyMonster()] })]
  });

/** Maxx "C" job, on the field, once per turn — not a hand-trap floodgate. */
export const tithe_owl = M("tithe_owl", "Tithe Owl", "Neutral", 2, 1, 3, "SR",
  "Once per turn, if the opponent summons a monster: draw 1.",
  {
    archetypes: ["draw", "control_counters"],
    triggers: [ifTrig("tithe_draw", "Draw 1",
      (G, card, ev) => (ev.type === "normalSummon" || ev.type === "specialSummon")
        && ev.card?.controller !== card.controller,
      rDraw(1),
      { oncePerTurn: true })]
  });

/** Ragnaros / Dr. Boom job: a tribute body that burns the leader. */
export const cinder_tyrant = M("cinder_tyrant", "Cinder Tyrant", "Ignis", 4, 5, 4, "SR",
  "Tribute 1 (Level 6). Fanfare: deal 2 to the enemy leader.",
  {
    archetypes: ["burn", "big_evolve"],
    triggers: [must("tyrant_burn", "Deal 2", evSelfSummon, rDamageLeader(2))]
  });

/** Gust of Wind / Unsummon job. */
export const recall_gust = S("recall_gust", "Recall Gust", "quick", 2, 1, "N",
  "Quick: bounce 1 enemy monster.",
  { targets: [tEnemyMonster()], resolve: rBounceTarget(0), archetypes: ["tempo_bounce"] });

/** Fatal Push / Doom Blade job: kill a small body. */
export const low_blow = S("low_blow", "Low Blow", "quick", 2, 1, "N",
  "Quick: destroy 1 enemy monster with 3 ATK or less.",
  {
    targets: [tEnemyMonster((G, c) => getATK(G, c) <= 3)],
    resolve: rDestroyTarget(0),
    archetypes: ["control_counters"]
  });

/** Swords to Plowshares job: exile, not destroy. */
export const quiet_exile = S("quiet_exile", "Quiet Exile", "normal", 1, 3, "SR",
  "Normal: banish 1 enemy monster.",
  {
    targets: [tEnemyMonster()],
    resolve: async (G, card, link) => {
      const t = link.targets?.[0]?.[0];
      if (t) {
        const ev = banishCard(G, t);
        pushEvents(G, [ev]);
      }
    },
    archetypes: ["control_counters"]
  });

/** Night's Whisper / Faithless Looting job. */
export const tome_cycle = S("tome_cycle", "Tome Cycle", "normal", 1, 1, "N",
  "Normal: discard 1 card as a cost; draw 2.",
  {
    condition: (G, card) => P(G, card.controller).hand.some((c) => c !== card),
    cost: { pay: costDiscardChosen() },
    resolve: rDraw(2),
    archetypes: ["draw"]
  });

/** Harpie's Feather Duster job: clear Set spells, not the whole backrow of faces. */
export const gale_sweep = S("gale_sweep", "Gale Sweep", "normal", 1, 3, "R",
  "Normal: destroy all enemy Set spells.",
  {
    resolve: async (G, card) => {
      const evs = [];
      for (const c of P(G, opp(card.controller)).stz) {
        if (c && !c.faceup) evs.push(sendToGY(G, c, { kind: "destroyed" }));
      }
      if (evs.length) pushEvents(G, evs);
    },
    archetypes: ["control_counters"]
  });

/** Called by the Grave job: take a body out of a GY. Does not negate. */
export const grave_silence = S("grave_silence", "Grave Silence", "quick", 2, 1, "R",
  "Quick: banish 1 monster from either GY.",
  {
    targets: [{ what: "gyMonster", who: "either" }],
    resolve: async (G, card, link) => {
      const t = link.targets?.[0]?.[0];
      if (t && t.loc === "gy") {
        const ev = banishCard(G, t);
        pushEvents(G, [ev]);
      }
    },
    archetypes: ["gy", "control_counters"]
  });

/** Solemn Judgment job: pay life, stop a spell. */
export const blood_veto = S("blood_veto", "Blood Veto", "counter", 3, 2, "SR",
  "Counter: take 3 damage; negate a spell.",
  {
    counterWhat: ["spell"],
    cost: {
      pay: async (G, card) => { dealDamageToPlayer(G, card.controller, 3, card); }
    },
    resolve: async (G) => { negateLastLinkOfKind(G, ["spell"]); },
    archetypes: ["control_counters"]
  });

/** Force of Will job: pitch from hand on their turn. */
export const void_pitch = S("void_pitch", "Void Pitch", "counter", 3, 1, "UR",
  "Hand trap Counter: discard 1 other card; negate a spell. From hand on the opponent's turn.",
  {
    handTrap: true,
    counterWhat: ["spell"],
    condition: (G, card) => P(G, card.controller).hand.some((c) => c !== card),
    cost: { pay: costDiscardChosen() },
    resolve: async (G) => { negateLastLinkOfKind(G, ["spell"]); },
    archetypes: ["control_counters"]
  });
void_pitch.handTrap = true;

export const WAVE_E_CARDS = [
  ivory_colossus, ink_magister, trail_fox, spark_juggler,
  bastion_reflector, overreach_warden, tithe_owl, cinder_tyrant,
  recall_gust, low_blow, quiet_exile, tome_cycle,
  gale_sweep, grave_silence, blood_veto, void_pitch
];

export const WAVE_E_DB = Object.fromEntries(WAVE_E_CARDS.map((c) => [c.id, c]));

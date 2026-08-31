// ============================================================
// CHAIND BLITZ — BRONZE POOL (60 cards)
// Tribes: Ignis (aggro), Abyss (control), Terra (midrange), Neutral staples.
// The pool is engineered to demonstrate every rule of the engine:
// missing-the-timing (jestling / grinning_echo), never-missing "if" triggers
// (scav_wisp), mandatory triggers (mawling), SEGOC piles (tide_priestess +
// dawn_pixie), counter wars (null_seal / sealbreak), summon negation
// (final_edict), post-2012 priority (doomblade_novice), damage-step quicks
// (surge_imp), set-quick chains (tidal_snare), SS3 lockout (shatter_sigil
// cannot answer a counter).
// ============================================================

import { P, opp, pushEvents, monstersOf, monsterLevel } from "../../engine/state.js";
import {
  drawCards, dealDamageToPlayer, healPlayer, damageMonster, sweepDestroyed,
  destroyByEffect, sendToGY, banishCard, bounceToHand, buff, specialSummon,
  discardCard, mill
} from "../../engine/ops.js";
import { negateLastLinkOfKind } from "../../engine/chain.js";
import {
  when, ifTrig, must,
  evSelfSummon, evSentFromField, evSentAnywhere, evDiscarded, evOwnSpell,
  evStandby, evFriendlyBattleDestroy, evEnemyBattleDestroy,
  rDraw, rDamageLeader, rHeal, rDamageMonster, rDestroyTarget, rBounceTarget,
  rBuffTarget, rBuffSelf, rNegate,
  tEnemyMonster, tOwnMonster, tAnyMonster, tAnySpell, tSetSpell, tOwnGyMonster,
  costDiscardChosen, costTributeSelf, enemyMonsters, discardChosenN
} from "./helpers.js";

const M = (id, name, tribe, cost, atk, def, rarity, text, extra = {}) =>
  ({ id, name, type: "monster", tribe, cost, atk, def, rarity, text, ...extra });
const S = (id, name, subtype, speed, cost, rarity, text, extra = {}) =>
  ({ id, name, type: "spell", cost, rarity, text, spell: { subtype, speed, ...extra } });

const searchDeckToHand = async (G, p, filter, label = "add") => {
  const pl = P(G, p);
  const idx = pl.deck.findIndex((c) => filter(c));
  if (idx < 0) return null;
  const [c] = pl.deck.splice(idx, 1);
  c.loc = "hand";
  pl.hand.push(c);
  return c;
};

/* ============================ NEUTRAL MONSTERS ============================ */

const jestling = M("jestling", "Jestling, Grinning Imp", "Neutral", 1, 1, 1, "R",
  `When this card is sent from the field to your GY: you can Special Summon 1 "Jestling, Grinning Imp" from your deck.`,
  {
    triggers: [when("jestling_revive", "Special Summon 1 Jestling from your deck", evSentFromField,
      async (G, card) => {
        const pl = P(G, card.controller);
        const idx = pl.deck.findIndex((c) => c.id === "jestling");
        if (idx < 0) return;
        const [c] = pl.deck.splice(idx, 1);
        specialSummon(G, c, card.controller, card);
      }, { from: "gy" })]
  });

const scav_wisp = M("scav_wisp", "Scavenger Wisp", "Neutral", 2, 1, 1, "N",
  "If this card is sent from the field to the GY: add 1 Level 4 or lower monster from your deck to your hand.",
  {
    triggers: [ifTrig("scav_search", "Add a Level 4 or lower monster from deck to hand", evSentFromField,
      async (G, card) => { await searchDeckToHand(G, card.controller, (c) => c.def.type === "monster" && monsterLevel(c.def) <= 4); },
      { from: "gy" })]
  });

const mawling = M("mawling", "Mawling of the Deep", "Neutral", 2, 2, 1, "N",
  "When this card is sent to the GY (from anywhere): both players take 1 damage. (Mandatory)",
  {
    triggers: [must("maw_ping", "Both players take 1 damage", evSentAnywhere,
      async (G, card) => {
        dealDamageToPlayer(G, 0, 1, card);
        dealDamageToPlayer(G, 1, 1, card);
      }, { from: "gy" })]
  });

const doomblade_novice = M("doomblade_novice", "Doomblade Novice", "Neutral", 1, 2, 1, "R",
  "Ignition: Tribute this card — destroy 1 enemy Level 5 or lower monster.",
  {
    ignition: {
      text: "Tribute this card; destroy an enemy Level 5 or lower monster",
      cost: { pay: costTributeSelf() },
      targets: [tEnemyMonster((G, c) => monsterLevel(c.def) <= 5)],
      resolve: rDestroyTarget(0)
    }
  });

const surge_imp = M("surge_imp", "Surge Imp", "Neutral", 1, 1, 1, "SR",
  "During damage calculation, discard this card from your hand: your battling monster gets +3/+0 until end of turn.",
  {
    handQuick: {
      damageCalc: true,
      text: "Your monster gets +3/+0 this turn",
      targets: [tOwnMonster()],
      resolve: rBuffTarget(3, 0, false, 0)
    }
  });

const shield_sprite = M("shield_sprite", "Aegis Sprite", "Neutral", 2, 1, 3, "N",
  "Evolve: this gets +0/+2.",
  { evolveEffect: { text: "This gets +0/+2", resolve: rBuffSelf(0, 2, true) } });
const gem_golem = M("gem_golem", "Gem Golem", "Neutral", 3, 2, 4, "N",
  "Evolve: this gets +1/+1.",
  { evolveEffect: { text: "This gets +1/+1", resolve: rBuffSelf(1, 1, true) } });
const swift_falcon = M("swift_falcon", "Swift Falcon", "Neutral", 2, 2, 1, "N", "Rush.", { keywords: ["rush"] });
const nimbus_knight = M("nimbus_knight", "Nimbus Knight", "Neutral", 4, 3, 3, "R", "Rush.", { keywords: ["rush"] });

const oracle_eel = M("oracle_eel", "Oracle Eel", "Neutral", 3, 1, 2, "N",
  "If this card is summoned: draw 1 card.",
  { triggers: [ifTrig("eel_draw", "Draw 1 card", evSelfSummon, rDraw(1))] });

const chrono_mite = M("chrono_mite", "Chrono Mite", "Neutral", 1, 1, 1, "N",
  "Evolve: draw 1 card.",
  { evolveEffect: { text: "Draw 1 card", resolve: rDraw(1) } });

const grinning_echo = M("grinning_echo", "Grinning Echo", "Neutral", 2, 2, 1, "SR",
  `When this card is discarded: you can add 1 "Grinning Echo" from your deck to your hand.`,
  {
    triggers: [when("echo_recruit", "Add a Grinning Echo from deck to hand", evDiscarded,
      async (G, card) => { await searchDeckToHand(G, card.controller, (c) => c.id === "grinning_echo"); },
      { from: "gy" })]
  });

/* ============================ IGNIS ============================ */

const ember_fox = M("ember_fox", "Ember Fox", "Ignis", 1, 1, 1, "N",
  "Evolve: deal 1 damage to all enemy monsters.",
  {
    evolveEffect: {
      text: "Deal 1 to all enemy monsters",
      resolve: async (G, card) => {
        for (const m of enemyMonsters(G, card.controller)) damageMonster(G, m, 1, card);
        sweepDestroyed(G);
      }
    }
  });

const cinder_knight = M("cinder_knight", "Cinder Knight", "Ignis", 3, 3, 2, "N",
  "Evolve: deal 2 damage to an enemy monster.",
  { evolveEffect: { text: "Deal 2 to an enemy monster", targets: [tEnemyMonster()], resolve: rDamageMonster(2) } });

const flame_djinn = M("flame_djinn", "Flame Djinn", "Ignis", 4, 4, 3, "R",
  "Ignition (once per turn): deal 1 damage to the enemy leader.",
  { ignition: { text: "Deal 1 to the enemy leader", resolve: rDamageLeader(1) } });

const pyro_hydra = M("pyro_hydra", "Pyro Hydra", "Ignis", 5, 5, 4, "SR",
  "If an enemy monster is destroyed by battle: deal 1 damage to the enemy leader.",
  { triggers: [ifTrig("hydra_burn", "Deal 1 to the enemy leader", evEnemyBattleDestroy, rDamageLeader(1))] });

const inferno_titan = M("inferno_titan", "Inferno Titan", "Ignis", 7, 7, 6, "UR",
  "Evolve: deal 3 damage to all enemy monsters.",
  {
    evolveEffect: {
      text: "Deal 3 to all enemy monsters",
      resolve: async (G, card) => {
        for (const m of enemyMonsters(G, card.controller)) damageMonster(G, m, 3, card);
        sweepDestroyed(G);
      }
    }
  });

const ash_prophet = M("ash_prophet", "Ash Prophet", "Ignis", 2, 1, 2, "R",
  "If you activate a spell: this gains +1/+0 permanently.",
  { triggers: [ifTrig("prophet_grow", "This gains +1/+0", evOwnSpell, rBuffSelf(1, 0))] });

const lava_giant = M("lava_giant", "Lava Giant", "Ignis", 5, 5, 5, "N",
  "Evolve: deal 2 to the enemy leader.",
  { evolveEffect: { text: "Deal 2 to the enemy leader", resolve: rDamageLeader(2) } });

const ember_spark = S("ember_spark", "Ember Spark", "quick", 2, 1, "N",
  "Quick: deal 2 damage to a monster.",
  { targets: [tAnyMonster()], resolve: rDamageMonster(2) });

const flame_banner = S("flame_banner", "Flame Banner", "continuous", 1, 2, "N",
  "Continuous: your Ignis monsters get +1/+0.",
  {
    continuousAura: true,
    resolve: async () => {},
    ongoing: (G, source, target, v, stat) =>
      (target.def.tribe === "Ignis" && target.controller === source.controller && stat === "atk") ? v + 1 : v
  });

const burning_lance = S("burning_lance", "Burning Lance", "normal", 1, 2, "N",
  "Normal: deal 2 damage to an enemy monster; if it is destroyed, deal 1 to the enemy leader.",
  {
    targets: [tEnemyMonster()],
    resolve: async (G, card, link) => {
      const t = link.targets?.[0]?.[0];
      if (!t || t.loc !== "mz") return;
      damageMonster(G, t, 2, card);
      const dead = sweepDestroyed(G, "effect").some((ev) => ev.card === t);
      if (dead) dealDamageToPlayer(G, opp(card.controller), 1, card);
    }
  });

const backdraft = S("backdraft", "Backdraft", "counter", 3, 2, "SR",
  "Counter: negate the activation of a spell; deal 1 damage to that spell's controller.",
  {
    counterWhat: ["spell"],
    resolve: async (G, card) => {
      const l = negateLastLinkOfKind(G, "spell");
      if (l) dealDamageToPlayer(G, l.controller, 1, card);
    }
  });

const fever_pitch = S("fever_pitch", "Fever Pitch", "quick", 2, 2, "N",
  "Quick: your monster gets +2/+0 until end of turn.",
  { targets: [tOwnMonster()], resolve: rBuffTarget(2, 0, false, 0) });

/* ============================ ABYSS ============================ */

const tide_caller = M("tide_caller", "Tide Caller", "Abyss", 2, 1, 2, "N",
  "Evolve: return an enemy monster to its owner's hand.",
  { evolveEffect: { text: "Bounce an enemy monster", targets: [tEnemyMonster()], resolve: rBounceTarget(0) } });

const frost_mage = M("frost_mage", "Frost Mage", "Abyss", 3, 2, 3, "R",
  "Quick Effect (once per turn): a monster gets -2/-0 until end of turn.",
  { quick: { text: "A monster gets -2/-0 this turn", targets: [tAnyMonster()], resolve: rBuffTarget(-2, 0, false, 0) } });

const abyss_warden = M("abyss_warden", "Abyss Warden", "Abyss", 4, 3, 5, "R",
  "Continuous: your other monsters get +0/+2.",
  {
    continuous: {
      modifyStat: (G, source, target, v, stat) =>
        (target !== source && target.controller === source.controller && target.loc === "mz" && stat === "def") ? v + 2 : v
    }
  });

const deep_serpent = M("deep_serpent", "Deep Serpent", "Abyss", 5, 5, 4, "SR",
  "Evolve: an enemy monster cannot attack next turn.",
  {
    evolveEffect: {
      text: "Freeze an enemy monster for a turn",
      targets: [tEnemyMonster()],
      resolve: async (G, card, link) => {
        const t = link.targets?.[0]?.[0];
        if (t && t.loc === "mz") t.cannotAttackTurn = G.turnCount + 1;
      }
    }
  });

const kraken = M("kraken", "Kraken of the Deep", "Abyss", 6, 6, 5, "UR",
  "If this card is summoned: your opponent discards 1 random card.",
  {
    triggers: [ifTrig("kraken_strip", "Opponent discards 1 random card", evSelfSummon,
      async (G, card) => {
        const pl = P(G, opp(card.controller));
        if (!pl.hand.length) return;
        const c = pl.hand[G.rng.int(pl.hand.length)];
        const ev = discardCard(G, c, { isCost: false });
        pushEvents(G, [ev]);
      })]
  });

const tide_priestess = M("tide_priestess", "Tide Priestess", "Abyss", 2, 1, 2, "N",
  "At the start of your Standby Phase: heal 2 LP. (Mandatory)",
  { triggers: [must("priestess_heal", "Heal 2 LP", evStandby, rHeal(2))] });

const depths_lurker = M("depths_lurker", "Depths Lurker", "Abyss", 3, 3, 2, "N",
  "Evolve: mill the top 2 of the opponent's deck.",
  {
    evolveEffect: {
      text: "Mill 2 from the opponent",
      resolve: async (G, card) => mill(G, opp(card.controller), 2)
    }
  });

const tidal_snare = S("tidal_snare", "Tidal Snare", "quick", 2, 2, "R",
  "Quick: destroy 1 enemy monster that was summoned this turn.",
  {
    targets: [tEnemyMonster((G, c) => c.summonedTurn === G.turnCount)],
    resolve: rDestroyTarget(0)
  });

const moonwell = S("moonwell", "Moonwell", "normal", 1, 1, "N", "Normal: heal 5 LP.",
  { resolve: rHeal(5) });

const deep_freeze = S("deep_freeze", "Deep Freeze", "continuous", 1, 3, "R",
  "Continuous: enemy monsters get -1/-0.",
  {
    resolve: async () => {},
    ongoing: (G, source, target, v, stat) =>
      (target.controller !== source.controller && stat === "atk") ? v - 1 : v
  });

const silencing_depths = S("silencing_depths", "Silencing Depths", "counter", 3, 2, "R",
  "Counter: negate the activation of a Quick-Play spell.",
  {
    counterWhat: ["spell"],
    counterFilter: (G, link) => link.card.def.spell?.subtype === "quick",
    resolve: rNegate("spell")
  });

const riptide = S("riptide", "Riptide", "quick", 2, 2, "N",
  "Quick: return 1 Set card on the field to its owner's hand.",
  {
    targets: [tSetSpell()],
    resolve: async (G, card, link) => {
      const t = link.targets?.[0]?.[0];
      if (t && t.loc === "stz") {
        const ev = bounceToHand(G, t);
        pushEvents(G, [ev]);
      }
    }
  });

/* ============================ TERRA ============================ */

const moss_sprite = M("moss_sprite", "Moss Sprite", "Terra", 1, 1, 2, "N",
  "Evolve: add 1 Level 4 monster from your deck to your hand.",
  {
    evolveEffect: {
      text: "Add a Level 4 monster from deck to hand",
      resolve: async (G, card) => { await searchDeckToHand(G, card.controller, (c) => c.def.type === "monster" && monsterLevel(c.def) === 4); }
    }
  });

const dawn_pixie = M("dawn_pixie", "Dawn Pixie", "Terra", 1, 1, 1, "N",
  "At the start of your Standby Phase: this gains +1/+0 permanently. (Mandatory)",
  { triggers: [must("pixie_grow", "+1/+0 permanently", evStandby, rBuffSelf(1, 0))] });

const thorn_archer = M("thorn_archer", "Thorn Archer", "Terra", 2, 2, 2, "N",
  "Evolve: destroy 1 Set card.",
  { evolveEffect: { text: "Destroy a Set card", targets: [tSetSpell()], resolve: rDestroyTarget(0) } });

const stoneback = M("stoneback", "Stoneback Tortoise", "Terra", 3, 1, 6, "N",
  "Ward. An ancient shell that the enemy must break first.",
  { keywords: ["ward"] });

const grove_elder = M("grove_elder", "Grove Elder", "Terra", 4, 3, 4, "SR",
  "Continuous: your Terra monsters get +1/+1.",
  {
    continuous: {
      modifyStat: (G, source, target, v, stat) =>
        (target.def.tribe === "Terra" && target.controller === source.controller && target.loc === "mz") ? v + 1 : v
    }
  });

const wolf_alpha = M("wolf_alpha", "Alpha Wolf", "Terra", 4, 4, 3, "R",
  "If another friendly monster is destroyed by battle: this gains +2/+0 permanently.",
  { triggers: [ifTrig("wolf_rage", "+2/+0 permanently", evFriendlyBattleDestroy, rBuffSelf(2, 0))] });

const world_turtle = M("world_turtle", "World Turtle", "Terra", 6, 5, 7, "UR",
  "Evolve: heal 4 LP.",
  { evolveEffect: { text: "Heal 4 LP", resolve: rHeal(4) } });

const seed_sage = M("seed_sage", "Seed Sage", "Terra", 2, 1, 1, "R",
  "If this card is sent from the field to the GY: add 1 spell from your GY to your hand.",
  {
    triggers: [ifTrig("sage_recover", "Recover a spell from your GY", evSentFromField,
      async (G, card) => {
        const pl = P(G, card.controller);
        const idx = pl.gy.findIndex((c) => c.def.type === "spell" && c !== card);
        if (idx < 0) return;
        const [c] = pl.gy.splice(idx, 1);
        c.loc = "hand";
        pl.hand.push(c);
      }, { from: "gy" })]
  });

const overgrowth = S("overgrowth", "Overgrowth", "normal", 1, 1, "N",
  "Normal: your monster gets +1/+2 permanently.",
  { targets: [tOwnMonster()], resolve: rBuffTarget(1, 2, true, 0) });

const root_snare = S("root_snare", "Root Snare", "quick", 2, 1, "N",
  "Quick: an enemy monster gets -2/-0 until end of turn.",
  { targets: [tEnemyMonster()], resolve: rBuffTarget(-2, 0, false, 0) });

const verdant_rebuke = S("verdant_rebuke", "Verdant Rebuke", "counter", 3, 2, "R",
  "Counter: negate the activation of a spell; heal 2 LP.",
  {
    counterWhat: ["spell"],
    resolve: async (G, card) => {
      negateLastLinkOfKind(G, "spell");
      healPlayer(G, card.controller, 2);
    }
  });

const wild_call = S("wild_call", "Wild Call", "normal", 1, 2, "N",
  "Normal: add 1 Terra monster from your deck to your hand.",
  { resolve: async (G, card) => { await searchDeckToHand(G, card.controller, (c) => c.def.type === "monster" && c.def.tribe === "Terra"); } });

const stone_skin = S("stone_skin", "Stone Skin", "continuous", 1, 2, "N",
  "Continuous: your Terra monsters get +0/+2.",
  {
    resolve: async () => {},
    ongoing: (G, source, target, v, stat) =>
      (target.def.tribe === "Terra" && target.controller === source.controller && stat === "def") ? v + 2 : v
  });

/* ============================ NEUTRAL SPELLS (rules showcase) ============================ */

const starfall = S("starfall", "Starfall Judgment", "normal", 1, 6, "SR",
  "Normal: destroy all enemy monsters.",
  {
    resolve: async (G, card) => {
      const evs = enemyMonsters(G, card.controller).map((m) => sendToGY(G, m, { kind: "destroyed" }));
      if (evs.length) pushEvents(G, evs);
    }
  });

const lightning_tempest = S("lightning_tempest", "Lightning Tempest", "normal", 1, 4, "R",
  "Normal: discard 1 card as a cost; destroy all enemy monsters.",
  {
    condition: (G, card) => P(G, card.controller).hand.some((c) => c !== card),
    cost: { pay: costDiscardChosen() },
    resolve: async (G, card) => {
      const evs = enemyMonsters(G, card.controller).map((m) => sendToGY(G, m, { kind: "destroyed" }));
      if (evs.length) pushEvents(G, evs);
    }
  });

const scroll_greed = S("scroll_greed", "Scroll of Greed", "normal", 1, 1, "N",
  "Normal: draw 2 cards.", { resolve: rDraw(2) });

const shatter_sigil = S("shatter_sigil", "Shatter Sigil", "quick", 2, 1, "N",
  "Quick: destroy 1 card in any Spell Zone.",
  {
    targets: [{ what: "anySpell", who: "either" }],
    resolve: rDestroyTarget(0)
  });

const call_fallen = S("call_fallen", "Call of the Fallen", "quick", 2, 2, "R",
  "Quick: Special Summon 1 monster from your GY.",
  {
    targets: [tOwnGyMonster()],
    resolve: async (G, card, link) => {
      const t = link.targets?.[0]?.[0];
      if (t && t.loc === "gy") specialSummon(G, t, card.controller, card);
    }
  });

const null_seal = S("null_seal", "Nullification Seal", "counter", 3, 2, "SR",
  "Counter: negate the activation of a spell.",
  { counterWhat: ["spell"], resolve: rNegate("spell") });

const sealbreak = S("sealbreak", "Sealbreak Edict", "counter", 3, 1, "R",
  "Counter: negate the activation of a Counter spell.",
  {
    counterWhat: ["spell"],
    counterFilter: (G, link) => link.card.def.spell?.subtype === "counter",
    resolve: rNegate("spell")
  });

const final_edict = S("final_edict", "Final Edict", "counter", 3, 3, "UR",
  "Counter: negate the Normal Summon of a monster.",
  {
    counterWhat: ["summon"],
    resolve: async (G) => { if (G.summonNegCtx) G.summonNegCtx.negated = true; }
  });

const judgment_chain = S("judgment_chain", "Judgment Chain", "counter", 3, 2, "R",
  "Counter: negate the activation of a monster effect.",
  { counterWhat: ["monsterEffect"], resolve: rNegate("monsterEffect") });

const mind_surge = S("mind_surge", "Mind Surge", "quick", 2, 1, "N",
  "Quick: draw 1 card, then discard 1 card.",
  {
    resolve: async (G, card) => {
      drawCards(G, card.controller, 1);
      await discardChosenN(1)(G, card);
    }
  });

const void_pilgrim = M("void_pilgrim", "Void Pilgrim", "Neutral", 2, 2, 2, "R",
  "Evolve: banish 1 monster from your opponent's GY.",
  {
    evolveEffect: {
      text: "Banish a card from the enemy GY",
      targets: [{ what: "gyMonster", who: "enemy", optional: true }],
      resolve: async (G, card, link) => {
        const t = link.targets?.[0]?.[0];
        if (t && t.loc === "gy") banishCard(G, t);
      }
    }
  });

/* ============================ export ============================ */

export const BRONZE_CARDS = [
  // neutral monsters (12)
  jestling, scav_wisp, mawling, doomblade_novice, surge_imp, shield_sprite,
  gem_golem, swift_falcon, nimbus_knight, oracle_eel, chrono_mite, grinning_echo,
  void_pilgrim,
  // ignis (7 monsters, 5 spells)
  ember_fox, cinder_knight, flame_djinn, pyro_hydra, inferno_titan, ash_prophet,
  lava_giant, ember_spark, flame_banner, burning_lance, backdraft, fever_pitch,
  // abyss (7 monsters, 5 spells)
  tide_caller, frost_mage, abyss_warden, deep_serpent, kraken, tide_priestess,
  depths_lurker, tidal_snare, moonwell, deep_freeze, silencing_depths, riptide,
  // terra (8 monsters, 5 spells)
  moss_sprite, dawn_pixie, thorn_archer, stoneback, grove_elder, wolf_alpha,
  world_turtle, seed_sage, overgrowth, root_snare, verdant_rebuke, wild_call,
  stone_skin,
  // neutral spells (10)
  starfall, lightning_tempest, scroll_greed, shatter_sigil, call_fallen,
  null_seal, sealbreak, final_edict, judgment_chain, mind_surge
];

/* Bronze predates the archetype tag system; tag by job so filters, loaner
   tooling, and the deck editor see the real pool. */
const BRONZE_ARCHETYPES = {
  jestling: ["jest_engine", "gy"],
  scav_wisp: ["gy", "draw"],
  mawling: ["gy", "burn"],
  doomblade_novice: ["control_counters", "contact_combo"],
  surge_imp: ["going_second", "otk_face"],
  shield_sprite: ["ward_walls", "big_evolve"],
  gem_golem: ["big_evolve", "ward_walls"],
  swift_falcon: ["wide_rush", "going_second"],
  nimbus_knight: ["wide_rush", "going_second"],
  oracle_eel: ["draw", "value_midrange"],
  chrono_mite: ["draw", "big_evolve"],
  grinning_echo: ["jest_engine", "gy"],
  void_pilgrim: ["gy", "control_counters"],
  ember_fox: ["burn", "aggro_swarm", "contact_combo"],
  cinder_knight: ["burn", "contact_combo", "pyro_control"],
  flame_djinn: ["burn", "spell_tempo"],
  pyro_hydra: ["burn", "pyro_control"],
  inferno_titan: ["burn", "big_evolve", "pyro_control"],
  ash_prophet: ["spell_tempo", "burn"],
  lava_giant: ["burn", "big_evolve"],
  ember_spark: ["burn", "spell_tempo"],
  flame_banner: ["burn", "aggro_swarm"],
  burning_lance: ["burn", "pyro_control"],
  backdraft: ["control_counters", "burn"],
  fever_pitch: ["otk_face", "burn"],
  tide_caller: ["tempo_bounce", "abyss_tempo"],
  frost_mage: ["control_counters", "abyss_tempo"],
  abyss_warden: ["ward_walls", "control_counters"],
  deep_serpent: ["control_counters", "abyss_tempo"],
  kraken: ["control_counters", "discard_payoff"],
  tide_priestess: ["heal_stall", "lifegain_midrange"],
  depths_lurker: ["mill", "gy"],
  tidal_snare: ["control_counters", "tempo_bounce"],
  moonwell: ["heal_stall", "lifegain_midrange"],
  deep_freeze: ["control_counters", "chain_lock"],
  silencing_depths: ["control_counters", "counter_war"],
  riptide: ["tempo_bounce", "control_counters"],
  moss_sprite: ["heal_ramp", "draw"],
  dawn_pixie: ["heal_ramp", "terra_beat"],
  thorn_archer: ["terra_beat", "tempo_bounce"],
  stoneback: ["ward_walls", "heal_stall"],
  grove_elder: ["terra_beat", "heal_ramp"],
  wolf_alpha: ["terra_beat", "wide_rush"],
  world_turtle: ["heal_stall", "big_evolve", "ward_walls"],
  seed_sage: ["gy", "heal_ramp"],
  overgrowth: ["heal_ramp", "big_evolve"],
  root_snare: ["control_counters", "ward_walls"],
  verdant_rebuke: ["control_counters", "heal_stall"],
  wild_call: ["draw", "terra_beat"],
  stone_skin: ["ward_walls", "heal_stall"],
  starfall: ["control_counters"],
  lightning_tempest: ["control_counters", "discard_payoff"],
  scroll_greed: ["draw"],
  shatter_sigil: ["tempo_bounce", "control_counters"],
  call_fallen: ["gy", "gy_fusion_combo"],
  null_seal: ["control_counters", "counter_war"],
  sealbreak: ["counter_war", "control_counters"],
  final_edict: ["control_counters", "chain_lock"],
  judgment_chain: ["control_counters", "counter_war"],
  mind_surge: ["draw", "discard_payoff"]
};
for (const c of BRONZE_CARDS) {
  const tags = BRONZE_ARCHETYPES[c.id];
  if (tags && !c.archetypes) c.archetypes = tags;
}

export const BRONZE_DB = Object.fromEntries(BRONZE_CARDS.map((c) => [c.id, c]));

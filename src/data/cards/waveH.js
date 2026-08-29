// Wave H — the neutral combo core.
//
// Every card here is Neutral and Level 4 or lower, so any deck can play it with
// no tribute and no tribe support. The set is built on six shared circuits:
//
//   SPELL   you activate a spell        (spellActivated)
//   SUMMON  a monster reaches the field (normalSummon / specialSummon)
//   DRAW    you draw outside the DP     (draw)
//   DISCARD a card leaves your hand     (sentToGY · discard)
//   DEATH   a monster reaches the GY    (sentToGY · battleDestroy / destroyed)
//   BANISH  a card is banished          (banished)
//
// Each card FEEDS one circuit and PAYS OFF on another, so any two of them link,
// and because the circuits are driven by ordinary engine events they also link
// backwards into the whole existing pool.

import { P, opp, monstersOf, pushEvents, makeCard } from "../../engine/state.js";
import {
  drawCards, dealDamageToPlayer, healPlayer, buff, specialSummon,
  banishCard, sendToGY, discardCard
} from "../../engine/ops.js";
import { TOKEN_DB } from "./tokens.js";
import {
  must, when,
  evSelfSummon, evOwnSpell,
  rDraw, rHeal, rDamageLeader,
  tOwnMonster,
  discardChosenN, resolveChosenFromPool
} from "./helpers.js";

const M = (id, name, cost, atk, def, rarity, text, extra = {}) =>
  ({
    id, name, type: "monster", tribe: "Neutral", cost, atk, def, rarity, text,
    level: 4, ...extra,
    archetypes: ["combo_core", ...(extra.archetypes || [])]
  });
const S = (id, name, subtype, speed, cost, rarity, text, extra = {}) =>
  ({
    id, name, type: "spell", cost, rarity, text,
    archetypes: ["combo_core", ...(extra.archetypes || [])],
    spell: { subtype, speed, ...extra }
  });

/* ---------- shared matchers ---------- */
const evDrawn = (G, card, ev) =>
  ev.type === "draw" && ev.player === card.controller && !ev.phaseDraw;
const evAnyDiscard = (G, card, ev) =>
  ev.type === "sentToGY" && ev.player === card.controller
  && (ev.kind === "discard" || ev.kind === "costDiscard");
const evAnyMonsterDied = (G, card, ev) =>
  ev.type === "sentToGY" && ev.card !== card && ev.card?.def?.type === "monster"
  && (ev.from === "mz" || ev.kind === "battleDestroy" || ev.kind === "destroyed");
const evFriendlyDied = (G, card, ev) =>
  evAnyMonsterDied(G, card, ev) && ev.card?.controller === card.controller;
const evAnyBanish = (G, card, ev) => ev.type === "banished";
const evOtherSummon = (G, card, ev) =>
  (ev.type === "normalSummon" || ev.type === "specialSummon")
  && ev.card !== card && ev.card?.controller === card.controller;

const summonToken = (id) => (G, card) => {
  const t = makeCard(id, TOKEN_DB[id], card.controller);
  specialSummon(G, t, card.controller, card);
};

/* ================= SPELL circuit payoffs ================= */

export const relay_sprite = M("relay_sprite", "Relay Sprite", 1, 1, 1, "N",
  "Fanfare: draw 1. When you activate a spell: this gains +1/+0 this turn.",
  {
    triggers: [
      must("relay_draw", "Draw 1", evSelfSummon, rDraw(1)),
      must("relay_grow", "+1/+0 this turn", evOwnSpell,
        async (G, card) => { if (card.loc === "mz") buff(G, card, 1, 0, { permanent: false }); })
    ]
  });

export const sigil_courier = M("sigil_courier", "Sigil Courier", 2, 2, 1, "N",
  "When you activate a spell: deal 1 to the enemy leader. (Once per turn)",
  {
    triggers: [must("sigil_ping", "Deal 1", evOwnSpell, rDamageLeader(1), { oncePerTurn: true })]
  });

export const chain_acolyte = M("chain_acolyte", "Chain Acolyte", 2, 1, 3, "N",
  "When you activate a spell: heal 1 LP. (Once per turn)",
  {
    triggers: [must("acolyte_heal", "Heal 1", evOwnSpell, rHeal(1), { oncePerTurn: true })]
  });

/* ================= SUMMON circuit ================= */

export const echo_adept = M("echo_adept", "Echo Adept", 2, 1, 2, "R",
  "When another friendly monster is summoned: draw 1. (Once per turn)",
  {
    triggers: [must("echo_draw", "Draw 1", evOtherSummon, rDraw(1), { oncePerTurn: true })]
  });

export const muster_drum = M("muster_drum", "Muster Drum", 3, 2, 3, "R",
  "Fanfare: summon a 1/1 Recruit Token. When another friendly monster is summoned: it gains +1/+0 permanently.",
  {
    triggers: [
      must("drum_token", "Summon a Recruit Token", evSelfSummon, summonToken("token_recruit")),
      must("drum_buff", "That monster gains +1/+0", evOtherSummon, async (G, card, link) => {
        const t = link?.ev?.card;
        if (t && t.loc === "mz") buff(G, t, 1, 0, { permanent: true });
      })
    ]
  });

/* ================= DRAW circuit ================= */

export const ledger_imp = M("ledger_imp", "Ledger Imp", 2, 2, 2, "N",
  "When you draw a card outside your Draw Phase: deal 1 to the enemy leader. (Once per turn)",
  {
    triggers: [must("imp_ping", "Deal 1", evDrawn, rDamageLeader(1), { oncePerTurn: true })]
  });

export const overdraft_sage = M("overdraft_sage", "Overdraft Sage", 3, 2, 2, "R",
  "Fanfare: draw 1, then discard 1. When you draw outside your Draw Phase: this gains +1/+0 permanently.",
  {
    triggers: [
      must("sage_dig", "Draw 1, discard 1", evSelfSummon, async (G, card) => {
        drawCards(G, card.controller, 1);
        await discardChosenN(1)(G, card);
      }),
      must("sage_grow", "+1/+0 permanently", evDrawn,
        async (G, card) => { if (card.loc === "mz") buff(G, card, 1, 0, { permanent: true }); },
        { oncePerTurn: true })
    ]
  });

/* ================= DISCARD circuit ================= */

export const salvage_wisp = M("salvage_wisp", "Salvage Wisp", 1, 1, 2, "N",
  "When a card is discarded from your hand: draw 1. (Once per turn)",
  {
    triggers: [must("wisp_refill", "Draw 1", evAnyDiscard, rDraw(1), { oncePerTurn: true })]
  });

export const pitch_adept = M("pitch_adept", "Pitch Adept", 2, 2, 2, "R",
  "Ignition (once per turn): discard 1 — this gains +2/+0 permanently.",
  {
    ignition: {
      text: "Discard 1; this gains +2/+0",
      cost: { pay: async (G, card) => { await discardChosenN(1)(G, card); } },
      resolve: async (G, card) => { if (card.loc === "mz") buff(G, card, 2, 0, { permanent: true }); }
    }
  });

/* ================= DEATH circuit ================= */

export const grave_ledger = M("grave_ledger", "Grave Ledger", 3, 2, 3, "R",
  "When any monster is sent to the GY: this gains +1/+0 permanently.",
  {
    triggers: [must("ledger_grow", "+1/+0 permanently", evAnyMonsterDied,
      async (G, card) => { if (card.loc === "mz") buff(G, card, 1, 0, { permanent: true }); })]
  });

export const carrion_bell = M("carrion_bell", "Carrion Bell", 2, 2, 1, "N",
  "When a friendly monster is sent to the GY: deal 1 to the enemy leader. (Once per turn)",
  {
    triggers: [must("bell_ping", "Deal 1", evFriendlyDied, rDamageLeader(1), { oncePerTurn: true })]
  });

/* ================= BANISH circuit ================= */

export const exile_warden = M("exile_warden", "Exile Warden", 3, 3, 2, "R",
  "When a card is banished: deal 1 to the enemy leader. (Once per turn)",
  {
    triggers: [must("warden_ping", "Deal 1", evAnyBanish, rDamageLeader(1), { oncePerTurn: true })]
  });

export const rift_keeper = M("rift_keeper", "Rift Keeper", 2, 1, 3, "R",
  "Fanfare: banish the top card of your deck. When a card is banished: heal 1 LP. (Once per turn)",
  {
    triggers: [
      must("rift_seed", "Banish the top card of your deck", evSelfSummon, async (G, card) => {
        const pl = P(G, card.controller);
        if (!pl.deck.length) return;
        const ev = banishCard(G, pl.deck.shift(), { from: "deck" });
        pushEvents(G, [ev]);
      }),
      must("rift_heal", "Heal 1", evAnyBanish, rHeal(1), { oncePerTurn: true })
    ]
  });

/* ================= the capstone ================= */

export const loop_warden = M("loop_warden", "Loop Warden", 3, 3, 3, "SR",
  "Fanfare: draw 1. Once per turn, when you activate a spell, draw a card, or a monster is sent to the GY: this gains +1/+0 permanently.",
  {
    triggers: [
      must("loop_draw", "Draw 1", evSelfSummon, rDraw(1)),
      must("loop_grow", "+1/+0 permanently",
        (G, card, ev) => evOwnSpell(G, card, ev) || evDrawn(G, card, ev) || evAnyMonsterDied(G, card, ev),
        async (G, card) => { if (card.loc === "mz") buff(G, card, 1, 0, { permanent: true }); },
        { oncePerTurn: true })
    ]
  });

/* ================= enabler spells ================= */

export const spark_offering = S("spark_offering", "Spark Offering", "normal", 1, 1, "N",
  "Normal: discard 1, then draw 2.",
  {
    condition: (G, card) => P(G, card.controller).hand.some((c) => c !== card),
    resolve: async (G, card) => {
      await discardChosenN(1)(G, card);
      drawCards(G, card.controller, 2);
    }
  });

export const exile_pact = S("exile_pact", "Exile Pact", "quick", 2, 1, "R",
  "Quick: banish 1 card from your GY; draw 1.",
  {
    condition: (G, card) => P(G, card.controller).gy.some((c) => c !== card),
    resolve: async (G, card) => {
      const pl = P(G, card.controller);
      const pool = pl.gy.filter((c) => c !== card);
      if (pool.length) {
        const idxs = await G.io.choose(card.controller, {
          title: "Banish 1 card from your GY",
          options: pool.map((c) => c.def.name),
          min: 1, max: 1, kind: "target", uids: pool.map((c) => c.uid)
        });
        const pick = resolveChosenFromPool(pool, idxs, 1)[0];
        if (pick) pushEvents(G, [banishCard(G, pick)]);
      }
      drawCards(G, card.controller, 1);
    }
  });

export const rally_horn = S("rally_horn", "Rally Horn", "normal", 1, 1, "N",
  "Normal: summon two 1/1 Recruit Tokens.",
  {
    resolve: async (G, card) => {
      for (let i = 0; i < 2; i++) {
        const t = makeCard("token_recruit", TOKEN_DB.token_recruit, card.controller);
        specialSummon(G, t, card.controller, card);
      }
    }
  });

export const culling_rite = S("culling_rite", "Culling Rite", "normal", 1, 2, "R",
  "Normal: send 1 monster you control to the GY; draw 2.",
  {
    condition: (G, card) => monstersOf(G, card.controller).length > 0,
    targets: [tOwnMonster()],
    resolve: async (G, card, link) => {
      const t = link.targets?.[0]?.[0];
      if (t && t.loc === "mz") pushEvents(G, [sendToGY(G, t, { kind: "effect" })]);
      drawCards(G, card.controller, 2);
    }
  });

export const hand_relay = S("hand_relay", "Hand Relay", "quick", 2, 1, "R",
  "Quick: discard 1; draw 1. If the drawn card is a spell, deal 1 to the enemy leader.",
  {
    condition: (G, card) => P(G, card.controller).hand.some((c) => c !== card),
    resolve: async (G, card) => {
      await discardChosenN(1)(G, card);
      const before = P(G, card.controller).hand.length;
      drawCards(G, card.controller, 1);
      const pl = P(G, card.controller);
      if (pl.hand.length > before) {
        const drawn = pl.hand[pl.hand.length - 1];
        if (drawn?.def?.type === "spell") dealDamageToPlayer(G, opp(card.controller), 1, card);
      }
    }
  });

export const grave_tithe = S("grave_tithe", "Grave Tithe", "normal", 1, 2, "SR",
  "Normal: deal 1 to the enemy leader for each monster in your GY (max 5), then banish 3 cards from your GY.",
  {
    condition: (G, card) => P(G, card.controller).gy.some((c) => c.def.type === "monster"),
    resolve: async (G, card) => {
      const pl = P(G, card.controller);
      const n = Math.min(5, pl.gy.filter((c) => c.def.type === "monster").length);
      if (n > 0) dealDamageToPlayer(G, opp(card.controller), n, card);
      const evs = [];
      for (const c of pl.gy.slice(0, 3)) evs.push(banishCard(G, c));
      if (evs.length) pushEvents(G, evs);
    }
  });

export const double_sigil = S("double_sigil", "Double Sigil", "normal", 1, 1, "R",
  "Normal: add 1 spell that costs 1 from your GY to your hand.",
  {
    condition: (G, card) =>
      P(G, card.controller).gy.some((c) => c.def.type === "spell" && (c.def.cost || 0) <= 1),
    resolve: async (G, card) => {
      const pl = P(G, card.controller);
      const pool = pl.gy.filter((c) => c.def.type === "spell" && (c.def.cost || 0) <= 1);
      if (!pool.length) return;
      const idxs = await G.io.choose(card.controller, {
        title: "Return 1 cost-1 spell from your GY",
        options: pool.map((c) => c.def.name),
        min: 1, max: 1, kind: "target", uids: pool.map((c) => c.uid)
      });
      const pick = resolveChosenFromPool(pool, idxs, 1)[0] || pool[0];
      const i = pl.gy.indexOf(pick);
      if (i >= 0) pl.gy.splice(i, 1);
      pick.loc = "hand";
      pl.hand.push(pick);
    }
  });

/* ================= continuous payoffs ================= */

export const relay_chain = S("relay_chain", "Relay Chain", "continuous", 1, 2, "R",
  "Continuous: the first spell you activate each turn draws you 1.",
  { resolve: async () => {} });
relay_chain.triggers = [must("relay_chain_draw", "Draw 1", evOwnSpell, rDraw(1), { oncePerTurn: true })];

export const void_ledger = S("void_ledger", "Void Ledger", "continuous", 1, 2, "R",
  "Continuous: when a card is banished, draw 1. (Once per turn)",
  { resolve: async () => {} });
void_ledger.triggers = [must("void_ledger_draw", "Draw 1", evAnyBanish, rDraw(1), { oncePerTurn: true })];

export const summon_toll = S("summon_toll", "Summon Toll", "continuous", 1, 2, "SR",
  "Continuous: when a monster you control is summoned, deal 1 to the enemy leader. (Once per turn)",
  { resolve: async () => {} });
summon_toll.triggers = [must("summon_toll_ping", "Deal 1",
  (G, card, ev) => (ev.type === "normalSummon" || ev.type === "specialSummon")
    && ev.card?.controller === card.controller,
  rDamageLeader(1), { oncePerTurn: true })];

export const WAVE_H_CARDS = [
  relay_sprite, sigil_courier, chain_acolyte,
  echo_adept, muster_drum,
  ledger_imp, overdraft_sage,
  salvage_wisp, pitch_adept,
  grave_ledger, carrion_bell,
  exile_warden, rift_keeper,
  loop_warden,
  spark_offering, exile_pact, rally_horn, culling_rite, hand_relay,
  grave_tithe, double_sigil,
  relay_chain, void_ledger, summon_toll
];

export const WAVE_H_DB = Object.fromEntries(WAVE_H_CARDS.map((c) => [c.id, c]));

// Wave F: original staple jobs, then tribe-identity monsters with printed Evolve
// effects. No name-fill templates — every card has one job.
import { P, opp, monstersOf, pushEvents, monsterLevel } from "../../engine/state.js";
import {
  dealDamageToPlayer, destroyByEffect, sendToGY, bounceToHand,
  takeControl, setMonsterFaceDown, mill, drawCards, damageMonster,
  buff, healPlayer, sweepDestroyed, discardCard
} from "../../engine/ops.js";
import { negateLastLinkOfKind } from "../../engine/chain.js";
import {
  when, must,
  evSelfSummon, evOwnSpell, evEnemyBattleDestroy,
  rDraw, rHeal, rDamageLeader, rDestroyTarget, rBounceTarget, rBuffSelf, rDamageMonster,
  tEnemyMonster, tOwnMonster,
  searchDeckToHand, discardChosenN, resolveChosenFromPool, enemyMonsters
} from "./helpers.js";

const M = (id, name, tribe, cost, atk, def, rarity, text, extra = {}) =>
  ({ id, name, type: "monster", tribe, cost, atk, def, rarity, text, ...extra });
const S = (id, name, subtype, speed, cost, rarity, text, extra = {}) =>
  ({ id, name, type: "spell", cost, rarity, text, spell: { subtype, speed, ...extra } });

/** Ash job: stop a spell from hand, no pitch. */
export const hush_petal = S("hush_petal", "Hush Petal", "quick", 2, 1, "UR",
  "Hand trap: negate a spell on the chain.",
  {
    handTrap: true,
    counterWhat: ["spell"],
    resolve: async (G) => { negateLastLinkOfKind(G, ["spell"]); },
    archetypes: ["control_counters"]
  });
hush_petal.handTrap = true;

/** Infinite Impermanence job: empty board, shut a monster. */
export const empty_veto = S("empty_veto", "Empty Veto", "quick", 2, 1, "UR",
  "Hand trap: if you control no monsters, negate 1 face-up enemy monster until end of turn.",
  {
    handTrap: true,
    condition: (G, card) => monstersOf(G, card.controller).length === 0,
    targets: [tEnemyMonster()],
    resolve: async (G, card, link) => {
      const t = link.targets?.[0]?.[0];
      if (t && t.loc === "mz") {
        t.negated = true;
        t.negateUntilTurn = G.turnCount;
      }
    },
    archetypes: ["control_counters"]
  });
empty_veto.handTrap = true;

/** Lightning Bolt job: 3 to a monster or the leader. */
export const arc_triple = S("arc_triple", "Arc Triple", "quick", 2, 1, "SR",
  "Quick: deal 3 to an enemy monster or the enemy leader.",
  {
    resolve: async (G, card) => {
      const foes = monstersOf(G, opp(card.controller)).filter((m) => m.faceup);
      const opts = ["Enemy leader", ...foes.map((m) => m.def.name)];
      const idxs = await G.io.choose(card.controller, {
        title: "Deal 3",
        options: opts, min: 1, max: 1, kind: "target",
        uids: [0, ...foes.map((m) => m.uid)]
      });
      const i = idxs?.[0] ?? 0;
      if (i <= 0) dealDamageToPlayer(G, opp(card.controller), 3, card);
      else if (foes[i - 1]) { damageMonster(G, foes[i - 1], 3, card); }
    },
    archetypes: ["burn", "control_counters"]
  });

/** Cyclonic Rift overload job: bounce their board. */
export const cyclone_break = S("cyclone_break", "Cyclone Break", "normal", 1, 3, "SR",
  "Normal: bounce all enemy monsters.",
  {
    resolve: async (G, card) => {
      const evs = monstersOf(G, opp(card.controller)).map((m) => bounceToHand(G, m));
      if (evs.length) pushEvents(G, evs);
    },
    archetypes: ["tempo_bounce"]
  });

/** Change of Heart job: steal until EP, then bounce to owner. */
export const heart_claim = S("heart_claim", "Heart Claim", "normal", 1, 2, "SR",
  "Normal: take control of 1 enemy monster until end of turn, then it returns to its owner's hand.",
  {
    targets: [tEnemyMonster()],
    resolve: async (G, card, link) => {
      const t = link.targets?.[0]?.[0];
      if (t) takeControl(G, t, card.controller);
    },
    archetypes: ["tempo_bounce", "control_counters"]
  });

/** Graceful Charity job. */
export const grace_split = S("grace_split", "Grace Split", "normal", 1, 1, "R",
  "Normal: draw 3, then discard 2.",
  {
    resolve: async (G, card) => {
      drawCards(G, card.controller, 3);
      await discardChosenN(2)(G, card);
    },
    archetypes: ["draw"]
  });

/** Reinforcement of the Army job. */
export const rank_four_call = S("rank_four_call", "Rank-Four Call", "normal", 1, 1, "R",
  "Normal: add 1 Level 4 monster from your deck to your hand.",
  {
    condition: (G, card) => P(G, card.controller).deck.some((c) => c.def.type === "monster" && monsterLevel(c.def) === 4),
    resolve: async (G, card) => {
      await searchDeckToHand(G, card.controller,
        (c) => c.def.type === "monster" && monsterLevel(c.def) === 4,
        "Add 1 Level 4 monster");
    },
    archetypes: ["draw"]
  });

/** Foolish Burial job. */
export const soil_offering = S("soil_offering", "Soil Offering", "normal", 1, 1, "R",
  "Normal: send 1 monster from your deck to the GY.",
  {
    condition: (G, card) => P(G, card.controller).deck.some((c) => c.def.type === "monster"),
    resolve: async (G, card) => {
      const pool = P(G, card.controller).deck.filter((c) => c.def.type === "monster");
      const idxs = await G.io.choose(card.controller, {
        title: "Send 1 monster from deck to GY",
        options: pool.map((c) => c.def.name), min: 1, max: 1, kind: "search",
        uids: pool.map((c) => c.uid)
      });
      const t = resolveChosenFromPool(pool, idxs, 1)[0];
      if (t) pushEvents(G, [sendToGY(G, t, { from: "deck", kind: "effect" })]);
    },
    archetypes: ["gy"]
  });

/** Book of Moon job. */
export const moon_fold = S("moon_fold", "Moon Fold", "quick", 2, 1, "R",
  "Quick: flip 1 enemy monster face-down.",
  {
    targets: [tEnemyMonster()],
    resolve: async (G, card, link) => {
      const t = link.targets?.[0]?.[0];
      if (t) setMonsterFaceDown(G, t);
    },
    archetypes: ["tempo_bounce", "control_counters"]
  });

/** Torrential Tribute job on a body — optional when, can miss timing. */
export const flood_verdict = M("flood_verdict", "Flood Verdict", "Abyss", 3, 1, 4, "SR",
  "Ward. When the opponent summons a monster: destroy all monsters. Evolve: bounce an enemy monster.",
  {
    keywords: ["ward"],
    archetypes: ["control_counters", "ward_walls"],
    evolveEffect: { text: "Bounce an enemy monster", targets: [tEnemyMonster()], resolve: rBounceTarget(0) },
    triggers: [when("flood_wipe", "Destroy all monsters",
      (G, card, ev) => (ev.type === "normalSummon" || ev.type === "specialSummon")
        && ev.card?.controller !== card.controller,
      async (G, card) => {
        const all = [...monstersOf(G, 0), ...monstersOf(G, 1)];
        for (const m of all) if (m.loc === "mz") destroyByEffect(G, m, card);
      })]
  });

/** Leeroy job. */
export const charge_fool = M("charge_fool", "Charge Fool", "Ignis", 2, 5, 1, "SR",
  "Rush. Fanfare: discard 2 cards (if able). Evolve: deal 1 to the enemy leader.",
  {
    keywords: ["rush"],
    archetypes: ["otk_face", "aggro_swarm"],
    evolveEffect: { text: "Deal 1 to the enemy leader", resolve: rDamageLeader(1) },
    triggers: [must("fool_pitch", "Discard 2", evSelfSummon, discardChosenN(2))]
  });

/** Boss's Orders job. */
export const point_the_blade = S("point_the_blade", "Point the Blade", "quick", 2, 1, "R",
  "Quick: this Battle Phase, attacks must target 1 chosen enemy monster.",
  {
    targets: [tEnemyMonster()],
    resolve: async (G, card, link) => {
      const t = link.targets?.[0]?.[0];
      if (t) {
        G.mustAttackUid = t.uid;
        G.mustAttackTurn = G.turnCount;
      }
    },
    archetypes: ["control_counters"]
  });

const HEROES = [
  hush_petal, empty_veto, arc_triple, cyclone_break, heart_claim, grace_split,
  rank_four_call, soil_offering, moon_fold, flood_verdict, charge_fool, point_the_blade
];

const ignisEvoAll = (n) => ({
  text: `Deal ${n} to all enemy monsters`,
  resolve: async (G, card) => {
    for (const m of enemyMonsters(G, card.controller)) damageMonster(G, m, n, card);
    sweepDestroyed(G);
  }
});

const AUTHORED = [
  /* ---- Ignis: evolve is burn ---- */
  M("kiln_whelp", "Kiln Whelp", "Ignis", 1, 1, 1, "N",
    "Evolve: deal 1 to the enemy leader.",
    { archetypes: ["evolve_burn", "aggro_swarm"], evolveEffect: { text: "Deal 1 to the enemy leader", resolve: rDamageLeader(1) } }),
  M("spark_twin", "Spark Twin", "Ignis", 2, 2, 1, "N",
    "Rush. Evolve: deal 1 to all enemy monsters.",
    { keywords: ["rush"], archetypes: ["wide_rush", "evolve_burn"], evolveEffect: ignisEvoAll(1) }),
  M("cinder_whip", "Cinder Whip", "Ignis", 2, 2, 2, "R",
    "Evolve: deal 2 to an enemy monster.",
    { archetypes: ["evolve_burn"], evolveEffect: { text: "Deal 2 to an enemy monster", targets: [tEnemyMonster()], resolve: rDamageMonster(2) } }),
  M("blaze_runner", "Blaze Runner", "Ignis", 2, 3, 1, "N",
    "Rush. Evolve: this gets +2/+0 this turn.",
    { keywords: ["rush"], archetypes: ["wide_rush", "otk_face"],
      evolveEffect: { text: "This gets +2/+0 this turn", resolve: async (G, card) => { if (card.loc === "mz") buff(G, card, 2, 0, { permanent: false }); } } }),
  M("slag_wolf", "Slag Wolf", "Ignis", 2, 2, 2, "R",
    "Fanfare: deal 1 to the enemy leader. Evolve: deal 2 to the enemy leader.",
    { archetypes: ["burn", "evolve_burn"],
      evolveEffect: { text: "Deal 2 to the enemy leader", resolve: rDamageLeader(2) },
      triggers: [must("slag_ping", "Deal 1", evSelfSummon, rDamageLeader(1))] }),
  M("pyre_scout", "Pyre Scout", "Ignis", 2, 1, 2, "R",
    "Evolve: draw 1, then deal 1 to the enemy leader.",
    { archetypes: ["draw", "evolve_burn"],
      evolveEffect: { text: "Draw 1 then ping 1", resolve: async (G, card) => { drawCards(G, card.controller, 1); dealDamageToPlayer(G, opp(card.controller), 1, card); } } }),
  M("heat_needle", "Heat Needle", "Ignis", 2, 1, 2, "N",
    "Fanfare: deal 1 to an enemy monster. Evolve: deal 2 to an enemy monster.",
    { archetypes: ["burn"],
      evolveEffect: { text: "Deal 2 to an enemy monster", targets: [tEnemyMonster()], resolve: rDamageMonster(2) },
      triggers: [must("needle_snipe", "Deal 1 to an enemy monster", evSelfSummon, async (G, card) => {
        const foes = enemyMonsters(G, card.controller);
        if (foes[0]) { damageMonster(G, foes[0], 1, card); sweepDestroyed(G); }
      })] }),
  M("forge_whelp", "Forge Whelp", "Ignis", 2, 1, 3, "N",
    "Evolve: your other Ignis get +1/+0 this turn.",
    { archetypes: ["aggro_swarm"],
      evolveEffect: { text: "Other Ignis +1 ATK this turn", resolve: async (G, card) => {
        for (const m of monstersOf(G, card.controller)) {
          if (m !== card && m.def.tribe === "Ignis") buff(G, m, 1, 0, { permanent: false });
        }
      } } }),
  M("sun_brand", "Sun Brand", "Ignis", 3, 3, 2, "SR",
    "Ignition (once per turn): deal 1 to the enemy leader. Evolve: deal 2 to all enemy monsters.",
    { archetypes: ["burn", "evolve_burn"],
      ignition: { text: "Deal 1 to the enemy leader", resolve: rDamageLeader(1) },
      evolveEffect: ignisEvoAll(2) }),
  M("ember_twin", "Ember Twin", "Ignis", 2, 1, 2, "R",
    "If you activate a spell: deal 1 to the enemy leader. Evolve: deal 1 to all enemy monsters.",
    { archetypes: ["spell_tempo", "evolve_burn"],
      evolveEffect: ignisEvoAll(1),
      triggers: [must("twin_spellburn", "Deal 1 to the enemy leader", evOwnSpell, rDamageLeader(1))] }),
  M("coal_knight", "Coal Knight", "Ignis", 2, 1, 3, "N",
    "Ward. Evolve: deal 1 to the enemy leader.",
    { keywords: ["ward"], archetypes: ["ward_walls", "evolve_burn"],
      evolveEffect: { text: "Deal 1 to the enemy leader", resolve: rDamageLeader(1) } }),
  M("flare_raider", "Flare Raider", "Ignis", 2, 2, 1, "N",
    "Rush. Fanfare: this gets +1 ATK this turn.",
    { keywords: ["rush"], archetypes: ["wide_rush"],
      triggers: [must("flare_buff", "+1 ATK this turn", evSelfSummon,
        async (G, card) => { if (card.loc === "mz") buff(G, card, 1, 0, { permanent: false }); })] }),
  M("soot_courier", "Soot Courier", "Ignis", 2, 2, 1, "N",
    "Fanfare: mill the top card of your deck. Evolve: deal 1 to the enemy leader.",
    { archetypes: ["mill", "evolve_burn"],
      evolveEffect: { text: "Deal 1 to the enemy leader", resolve: rDamageLeader(1) },
      triggers: [must("courier_mill", "Mill 1", evSelfSummon, async (G, card) => mill(G, card.controller, 1))] }),
  M("kiln_guard", "Kiln Guard", "Ignis", 3, 2, 4, "R",
    "Ward. Evolve: deal 2 to an enemy monster.",
    { keywords: ["ward"], archetypes: ["ward_walls", "evolve_burn"],
      evolveEffect: { text: "Deal 2 to an enemy monster", targets: [tEnemyMonster()], resolve: rDamageMonster(2) } }),
  S("spark_banner", "Spark Banner", "continuous", 1, 2, "R",
    "Continuous: your evolved monsters get +1 ATK.",
    { continuousAura: true, resolve: async () => {},
      ongoing: (G, source, target, v, stat) =>
        (stat === "atk" && target.controller === source.controller && target.evolved) ? v + 1 : v,
      archetypes: ["evolve_burn", "wide_rush"] }),
  S("heat_split", "Heat Split", "normal", 1, 1, "N",
    "Normal: deal 1 to an enemy monster and 1 to the enemy leader.",
    { targets: [tEnemyMonster()], archetypes: ["burn"],
      resolve: async (G, card, link) => {
        const t = link.targets?.[0]?.[0];
        if (t && t.loc === "mz") damageMonster(G, t, 1, card);
        dealDamageToPlayer(G, opp(card.controller), 1, card);
        sweepDestroyed(G);
      } }),
  S("afterburn", "Afterburn", "quick", 2, 1, "R",
    "Quick: an evolved monster you control gets +3/+0 until end of turn.",
    { targets: [tOwnMonster((G, c) => c.evolved)], archetypes: ["otk_face", "evolve_burn"],
      resolve: async (G, card, link) => {
        const t = link.targets?.[0]?.[0];
        if (t && t.loc === "mz") buff(G, t, 3, 0, { permanent: false });
      } }),
  S("cinder_gift", "Cinder Gift", "normal", 1, 1, "N",
    "Normal: if you control an Ignis monster, draw 1.",
    { archetypes: ["draw", "aggro_swarm"],
      resolve: async (G, card) => {
        if (monstersOf(G, card.controller).some((m) => m.def.tribe === "Ignis")) drawCards(G, card.controller, 1);
      } }),
  S("wildfire_march", "Wildfire March", "normal", 1, 2, "R",
    "Normal: your Ignis monsters gain Rush this turn.",
    { archetypes: ["wide_rush"],
      resolve: async (G, card) => {
        for (const m of monstersOf(G, card.controller)) {
          if (m.def.tribe === "Ignis") m.rushGranted = true;
        }
      } }),

  /* ---- Abyss: evolve is bounce / mill / freeze ---- */
  M("brine_wisp", "Brine Wisp", "Abyss", 1, 1, 2, "N",
    "Evolve: bounce an enemy monster.",
    { archetypes: ["tempo_bounce"], evolveEffect: { text: "Bounce an enemy monster", targets: [tEnemyMonster()], resolve: rBounceTarget(0) } }),
  M("rift_eel", "Rift Eel", "Abyss", 2, 1, 3, "N",
    "Drain. Evolve: mill the top 2 of the opponent's deck.",
    { keywords: ["drain"], archetypes: ["gy", "mill"],
      evolveEffect: { text: "Mill 2 from the opponent", resolve: async (G, card) => mill(G, opp(card.controller), 2) } }),
  M("tide_lock", "Tide Lock", "Abyss", 2, 2, 2, "R",
    "Evolve: an enemy monster cannot attack next turn.",
    { archetypes: ["control_counters"],
      evolveEffect: {
        text: "Freeze an enemy monster for a turn",
        targets: [tEnemyMonster()],
        resolve: async (G, card, link) => {
          const t = link.targets?.[0]?.[0];
          if (t && t.loc === "mz") t.cannotAttackTurn = G.turnCount + 1;
        }
      } }),
  M("gulf_watcher", "Gulf Watcher", "Abyss", 2, 1, 3, "N",
    "Ward. Evolve: draw 1.",
    { keywords: ["ward"], archetypes: ["ward_walls", "draw"],
      evolveEffect: { text: "Draw 1 card", resolve: rDraw(1) } }),
  M("ink_leech", "Ink Leech", "Abyss", 2, 2, 2, "R",
    "Drain. Fanfare: mill the top card of the opponent's deck. Evolve: bounce an enemy monster.",
    { keywords: ["drain"], archetypes: ["mill", "tempo_bounce"],
      evolveEffect: { text: "Bounce an enemy monster", targets: [tEnemyMonster()], resolve: rBounceTarget(0) },
      triggers: [must("leech_mill", "Mill 1", evSelfSummon, async (G, card) => mill(G, opp(card.controller), 1))] }),
  M("veil_crab", "Veil Crab", "Abyss", 2, 1, 4, "N",
    "Ward. Evolve: flip 1 enemy monster face-down.",
    { keywords: ["ward"], archetypes: ["ward_walls", "control_counters"],
      evolveEffect: {
        text: "Flip an enemy monster face-down",
        targets: [tEnemyMonster()],
        resolve: async (G, card, link) => {
          const t = link.targets?.[0]?.[0];
          if (t) setMonsterFaceDown(G, t);
        }
      } }),
  M("deep_jester", "Deep Jester", "Abyss", 2, 2, 1, "R",
    "Fanfare: discard 1, then draw 1. Evolve: the opponent discards 1 random card.",
    { archetypes: ["discard_payoff", "gy"],
      evolveEffect: {
        text: "Opponent discards 1 random",
        resolve: async (G, card) => {
          const pl = P(G, opp(card.controller));
          if (!pl.hand.length) return;
          const c = pl.hand[G.rng.int(pl.hand.length)];
          pushEvents(G, [discardCard(G, c, { isCost: false })]);
        }
      },
      triggers: [must("jester_cycle", "Discard 1 then draw 1", evSelfSummon, async (G, card) => {
        await discardChosenN(1)(G, card);
        drawCards(G, card.controller, 1);
      })] }),
  M("abyss_twin", "Abyss Twin", "Abyss", 2, 2, 2, "R",
    "If an enemy monster is destroyed by battle: mill the top card of the opponent's deck.",
    { archetypes: ["mill", "gy"],
      triggers: [must("twin_mill", "Mill 1", evEnemyBattleDestroy, async (G, card) => mill(G, opp(card.controller), 1))] }),
  M("cold_harbor", "Cold Harbor", "Abyss", 3, 2, 4, "SR",
    "Ward. Evolve: bounce all enemy monsters with 2 ATK or less.",
    { keywords: ["ward"], archetypes: ["tempo_bounce", "ward_walls"],
      evolveEffect: {
        text: "Bounce small enemy monsters",
        resolve: async (G, card) => {
          const evs = monstersOf(G, opp(card.controller))
            .filter((m) => m.faceup && (m.def.atk + (m.atkMod || 0)) <= 2)
            .map((m) => bounceToHand(G, m));
          if (evs.length) pushEvents(G, evs);
        }
      } }),
  M("murk_herald", "Murk Herald", "Abyss", 2, 1, 2, "N",
    "Fanfare: draw 1. Evolve: mill the top 2 of the opponent's deck.",
    { archetypes: ["draw", "mill"],
      evolveEffect: { text: "Mill 2 from the opponent", resolve: async (G, card) => mill(G, opp(card.controller), 2) },
      triggers: [must("herald_draw", "Draw 1", evSelfSummon, rDraw(1))] }),
  S("blackwater", "Blackwater", "quick", 2, 1, "R",
    "Quick: bounce 1 enemy monster that was summoned this turn.",
    { archetypes: ["tempo_bounce"],
      targets: [tEnemyMonster((G, c) => c.summonedTurn === G.turnCount)],
      resolve: rBounceTarget(0) }),
  S("grave_current", "Grave Current", "normal", 1, 1, "N",
    "Normal: mill the top 2 of the opponent's deck.",
    { archetypes: ["mill"], resolve: async (G, card) => mill(G, opp(card.controller), 2) }),
  S("still_harbor", "Still Harbor", "continuous", 1, 2, "R",
    "Continuous: enemy monsters get -0/-1.",
    { continuousAura: true, resolve: async () => {},
      ongoing: (G, source, target, v, stat) =>
        (stat === "def" && target.controller !== source.controller && target.loc === "mz") ? v - 1 : v,
      archetypes: ["control_counters"] }),
  S("drowned_gift", "Drowned Gift", "normal", 1, 1, "N",
    "Normal: if you control an Abyss monster, draw 1.",
    { archetypes: ["draw"],
      resolve: async (G, card) => {
        if (monstersOf(G, card.controller).some((m) => m.def.tribe === "Abyss")) drawCards(G, card.controller, 1);
      } }),
  S("ice_verdict", "Ice Verdict", "counter", 3, 2, "SR",
    "Counter: negate a monster effect; that monster cannot attack this turn.",
    { counterWhat: ["monsterEffect"], archetypes: ["control_counters"],
      resolve: async (G) => {
        const l = negateLastLinkOfKind(G, ["monsterEffect"]);
        if (l?.card && l.card.loc === "mz") l.card.cannotAttackTurn = G.turnCount;
      } }),

  /* ---- Terra: evolve is heal / ward / ramp ---- */
  M("sprout_kin", "Sprout Kin", "Terra", 1, 1, 2, "N",
    "Evolve: heal 2 LP.",
    { archetypes: ["heal_ramp"], evolveEffect: { text: "Heal 2 LP", resolve: rHeal(2) } }),
  M("bark_twin", "Bark Twin", "Terra", 2, 1, 3, "N",
    "Ward. Evolve: this gets +0/+2.",
    { keywords: ["ward"], archetypes: ["ward_walls"],
      evolveEffect: { text: "This gets +0/+2", resolve: rBuffSelf(0, 2, true) } }),
  M("grove_courier", "Grove Courier", "Terra", 2, 1, 2, "R",
    "Evolve: add 1 Terra monster from your deck to your hand.",
    { archetypes: ["heal_ramp", "draw"],
      evolveEffect: {
        text: "Add a Terra monster from deck to hand",
        resolve: async (G, card) => {
          await searchDeckToHand(G, card.controller, (c) => c.def.tribe === "Terra", "Add 1 Terra monster");
        }
      } }),
  M("moss_warden", "Moss Warden", "Terra", 2, 1, 4, "N",
    "Ward. Fanfare: heal 1. Evolve: heal 3 LP.",
    { keywords: ["ward"], archetypes: ["ward_walls", "heal_ramp"],
      evolveEffect: { text: "Heal 3 LP", resolve: rHeal(3) },
      triggers: [must("moss_heal", "Heal 1", evSelfSummon, rHeal(1))] }),
  M("root_twin", "Root Twin", "Terra", 2, 2, 2, "R",
    "Fanfare: heal 2. Evolve: your other Terra get +0/+1.",
    { archetypes: ["heal_ramp"],
      evolveEffect: {
        text: "Other Terra +0/+1",
        resolve: async (G, card) => {
          for (const m of monstersOf(G, card.controller)) {
            if (m !== card && m.def.tribe === "Terra") buff(G, m, 0, 1, { permanent: true });
          }
        }
      },
      triggers: [must("root_heal", "Heal 2", evSelfSummon, rHeal(2))] }),
  M("seed_herald", "Seed Herald", "Terra", 2, 1, 2, "N",
    "Fanfare: draw 1. Evolve: heal 2 LP.",
    { archetypes: ["draw", "heal_ramp"],
      evolveEffect: { text: "Heal 2 LP", resolve: rHeal(2) },
      triggers: [must("seed_draw", "Draw 1", evSelfSummon, rDraw(1))] }),
  M("thorn_twin", "Thorn Twin", "Terra", 2, 2, 2, "R",
    "If this card is summoned: this gains Ward. Evolve: deal 2 to an enemy monster.",
    { archetypes: ["ward_walls"],
      evolveEffect: { text: "Deal 2 to an enemy monster", targets: [tEnemyMonster()], resolve: rDamageMonster(2) },
      triggers: [must("thorn_ward", "Gain Ward", evSelfSummon, async (G, card) => { card.wardGranted = true; })] }),
  M("grove_colossus", "Grove Colossus", "Terra", 4, 3, 6, "SR",
    "Ward. Tribute 1 (Level 6). Evolve: heal 4 LP and this gets +0/+2.",
    { keywords: ["ward"], archetypes: ["big_evolve", "heal_ramp"],
      evolveEffect: { text: "Heal 4 and +0/+2", resolve: async (G, card) => {
        healPlayer(G, card.controller, 4);
        if (card.loc === "mz") buff(G, card, 0, 2, { permanent: true });
      } } }),
  M("dawn_keeper", "Dawn Keeper", "Terra", 3, 2, 4, "R",
    "Ward. Evolve: your Terra monsters get +1/+1 this turn.",
    { keywords: ["ward"], archetypes: ["ward_walls", "heal_ramp"],
      evolveEffect: {
        text: "Terra +1/+1 this turn",
        resolve: async (G, card) => {
          for (const m of monstersOf(G, card.controller)) {
            if (m.def.tribe === "Terra") buff(G, m, 1, 1, { permanent: false });
          }
        }
      } }),
  M("petal_guard", "Petal Guard", "Terra", 2, 0, 4, "N",
    "Ward. A living hedge.",
    { keywords: ["ward"], archetypes: ["ward_walls"] }),
  S("grove_hymn", "Grove Hymn", "normal", 1, 1, "N",
    "Normal: heal 3. If you control a Ward monster, heal 5 instead.",
    { archetypes: ["heal_ramp"],
      resolve: async (G, card) => {
        const warded = monstersOf(G, card.controller).some((m) => m.def.keywords?.includes("ward") || m.wardGranted);
        healPlayer(G, card.controller, warded ? 5 : 3);
      } }),
  S("root_banner", "Root Banner", "continuous", 1, 2, "R",
    "Continuous: your Terra monsters get +0/+1.",
    { continuousAura: true, resolve: async () => {},
      ongoing: (G, source, target, v, stat) =>
        (stat === "def" && target.controller === source.controller && target.def.tribe === "Terra") ? v + 1 : v,
      archetypes: ["ward_walls"] }),
  S("wild_call_echo", "Wild Call Echo", "normal", 1, 1, "R",
    "Normal: add 1 Level 4 Terra monster from your deck to your hand.",
    { archetypes: ["draw", "heal_ramp"],
      condition: (G, card) => P(G, card.controller).deck.some((c) => c.def.tribe === "Terra" && monsterLevel(c.def) === 4),
      resolve: async (G, card) => {
        await searchDeckToHand(G, card.controller,
          (c) => c.def.tribe === "Terra" && monsterLevel(c.def) === 4,
          "Add 1 Level 4 Terra");
      } }),
  S("verdant_pulse", "Verdant Pulse", "quick", 2, 1, "N",
    "Quick: heal 2 LP; a Terra monster you control gets +0/+2 until end of turn.",
    { targets: [tOwnMonster((G, c) => c.def.tribe === "Terra")], archetypes: ["heal_ramp"],
      resolve: async (G, card, link) => {
        healPlayer(G, card.controller, 2);
        const t = link.targets?.[0]?.[0];
        if (t && t.loc === "mz") buff(G, t, 0, 2, { permanent: false });
      } }),
  S("stone_oath", "Stone Oath", "counter", 3, 2, "R",
    "Counter: negate a spell; heal 2 LP.",
    { counterWhat: ["spell"], archetypes: ["heal_ramp", "control_counters"],
      resolve: async (G, card) => {
        negateLastLinkOfKind(G, ["spell"]);
        healPlayer(G, card.controller, 2);
      } }),

  /* ---- Neutral: evolve is draw / toolbox ---- */
  M("quill_mite", "Quill Mite", "Neutral", 1, 1, 1, "N",
    "Evolve: draw 1 card.",
    { archetypes: ["draw"], evolveEffect: { text: "Draw 1 card", resolve: rDraw(1) } }),
  M("lane_wren", "Lane Wren", "Neutral", 2, 2, 1, "N",
    "Rush. Evolve: this gets +1/+1.",
    { keywords: ["rush"], archetypes: ["lane_surfer", "wide_rush"],
      evolveEffect: { text: "This gets +1/+1", resolve: rBuffSelf(1, 1, true) } }),
  M("choice_finch", "Choice Finch", "Neutral", 2, 1, 2, "R",
    "Fusion Substitute. Evolve: draw 1 card.",
    { fusionSubstitute: true, archetypes: ["choice_recipe", "draw"],
      evolveEffect: { text: "Draw 1 card", resolve: rDraw(1) } }),
  M("mirror_hare", "Mirror Hare", "Neutral", 2, 2, 2, "R",
    "Fanfare: draw 1. Evolve: bounce this card.",
    { archetypes: ["draw", "tempo_bounce"],
      evolveEffect: {
        text: "Bounce this card",
        resolve: async (G, card) => {
          if (card.loc === "mz") pushEvents(G, [bounceToHand(G, card)]);
        }
      },
      triggers: [must("hare_draw", "Draw 1", evSelfSummon, rDraw(1))] }),
  M("bastion_ox", "Bastion Ox", "Neutral", 3, 2, 5, "R",
    "Ward. Evolve: this gets +0/+3.",
    { keywords: ["ward"], archetypes: ["ward_walls"],
      evolveEffect: { text: "This gets +0/+3", resolve: rBuffSelf(0, 3, true) } }),
  M("scribe_owl", "Scribe Owl", "Neutral", 2, 1, 2, "N",
    "If you activate a spell: draw 1. (Once per turn.)",
    { archetypes: ["draw", "spell_tempo"],
      triggers: [must("owl_draw", "Draw 1", (G, card, ev) => evOwnSpell(G, card, ev) && !card._owlDrew,
        async (G, card) => { card._owlDrew = true; drawCards(G, card.controller, 1); })] }),
  M("contact_ibis", "Contact Ibis", "Neutral", 2, 2, 2, "SR",
    "Fusion Substitute. Fanfare: mill the top card of your deck.",
    { fusionSubstitute: true, archetypes: ["choice_recipe", "gy"],
      triggers: [must("ibis_mill", "Mill 1", evSelfSummon, async (G, card) => mill(G, card.controller, 1))] }),
  M("iron_stag", "Iron Stag", "Neutral", 4, 4, 4, "R",
    "Tribute 1 (Level 6). Evolve: this gets +2/+2.",
    { archetypes: ["big_evolve"],
      evolveEffect: { text: "This gets +2/+2", resolve: rBuffSelf(2, 2, true) } }),
  S("second_page", "Second Page", "normal", 1, 1, "N",
    "Normal: draw 2, then discard 1.",
    { archetypes: ["draw"],
      resolve: async (G, card) => {
        drawCards(G, card.controller, 2);
        await discardChosenN(1)(G, card);
      } }),
  S("recall_note", "Recall Note", "quick", 2, 1, "R",
    "Quick: bounce 1 monster you control.",
    { archetypes: ["tempo_bounce"], targets: [tOwnMonster()], resolve: rBounceTarget(0) }),
  S("quiet_cut", "Quiet Cut", "quick", 2, 1, "R",
    "Quick: destroy 1 enemy monster with 2 ATK or less.",
    { archetypes: ["control_counters"],
      targets: [tEnemyMonster((G, c) => (c.def.atk + (c.atkMod || 0)) <= 2)],
      resolve: rDestroyTarget(0) }),
  S("open_ledger", "Open Ledger", "normal", 1, 1, "N",
    "Normal: draw 1. If you have no monsters, draw 2 instead.",
    { archetypes: ["draw", "comeback_toolbox"],
      resolve: async (G, card) => {
        drawCards(G, card.controller, monstersOf(G, card.controller).length ? 1 : 2);
      } }),
  S("lane_pact", "Lane Pact", "continuous", 1, 2, "N",
    "Continuous: your monsters get +0/+1.",
    { continuousAura: true, resolve: async () => {},
      ongoing: (G, source, target, v, stat) =>
        (stat === "def" && target.controller === source.controller && target.loc === "mz") ? v + 1 : v,
      archetypes: ["ward_walls"] }),
  S("last_word", "Last Word", "counter", 3, 2, "SR",
    "Counter: negate a spell or monster effect.",
    { counterWhat: ["spell", "monsterEffect"], archetypes: ["control_counters"],
      resolve: async (G) => { negateLastLinkOfKind(G, ["spell", "monsterEffect"]); } }),
  S("dust_offering", "Dust Offering", "normal", 1, 1, "N",
    "Normal: send 1 card from your hand to the GY, then draw 2.",
    { archetypes: ["draw", "gy"],
      resolve: async (G, card) => {
        await discardChosenN(1)(G, card);
        drawCards(G, card.controller, 2);
      } }),
];

export const WAVE_F_CARDS = [...HEROES, ...AUTHORED];
export const WAVE_F_DB = Object.fromEntries(WAVE_F_CARDS.map((c) => [c.id, c]));

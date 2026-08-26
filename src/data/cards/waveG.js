// Wave G: generic staples from 10 years of YGO / MTG / HS / Pokémon /
// Shadowverse / Lorcana / LoR. Original names, jobs that go in any deck.
import { P, opp, monstersOf, pushEvents, getATK } from "../../engine/state.js";
import {
  dealDamageToPlayer, destroyByEffect, sendToGY, bounceToHand,
  takeControl, mill, drawCards, damageMonster, buff, healPlayer,
  sweepDestroyed, discardCard, banishCard, specialSummon
} from "../../engine/ops.js";
import { negateLastLinkOfKind } from "../../engine/chain.js";
import {
  must, ifTrig,
  evSelfSummon, evSentFromField,
  rDraw, rDamageLeader, rDestroyTarget, rBounceTarget, rDamageMonster,
  tEnemyMonster, tOwnMonster, tOwnGyMonster,
  searchDeckToHand, discardChosenN, resolveChosenFromPool, enemyMonsters
} from "./helpers.js";

const M = (id, name, tribe, cost, atk, def, rarity, text, extra = {}) =>
  ({ id, name, type: "monster", tribe, cost, atk, def, rarity, text, ...extra,
    archetypes: ["staple", ...(extra.archetypes || [])] });
const S = (id, name, subtype, speed, cost, rarity, text, extra = {}) =>
  ({ id, name, type: "spell", cost, rarity, text,
    archetypes: ["staple", ...(extra.archetypes || [])],
    spell: { subtype, speed, ...extra } });

const lastChainCard = (G) => G.chain?.[G.chain.length - 1]?.card || null;

function pingLeaderOrMonster(G, card, amount) {
  return async () => {
    const foes = enemyMonsters(G, card.controller);
    const opts = ["Enemy leader", ...foes.map((m) => m.def.name)];
    const idxs = await G.io.choose(card.controller, {
      title: `Deal ${amount}`,
      options: opts, min: 1, max: 1, kind: "target",
      uids: [0, ...foes.map((m) => m.uid)]
    });
    const i = idxs?.[0] ?? 0;
    if (i <= 0) dealDamageToPlayer(G, opp(card.controller), amount, card);
    else if (foes[i - 1]) { damageMonster(G, foes[i - 1], amount, card); sweepDestroyed(G); }
  };
}

function recastHands(G, except, drawN) {
  for (const p of [0, 1]) {
    const pl = P(G, p);
    const moving = pl.hand.filter((c) => c !== except);
    for (const c of moving) {
      const i = pl.hand.indexOf(c);
      if (i >= 0) pl.hand.splice(i, 1);
      c.loc = "deck";
      pl.deck.push(c);
    }
    G.rng.shuffle(pl.deck);
    drawCards(G, p, drawN);
  }
}

/* ---------- Hand traps / chain ---------- */
export const veil_needle = S("veil_needle", "Veil Needle", "quick", 2, 1, "SR",
  "Hand trap: negate 1 face-up enemy monster until end of turn.",
  {
    handTrap: true, counterWhat: [],
    targets: [tEnemyMonster()],
    resolve: async (G, card, link) => {
      const t = link.targets?.[0]?.[0];
      if (t && t.loc === "mz") { t.negated = true; t.negateUntilTurn = G.turnCount; }
    }
  });
veil_needle.handTrap = true;

export const ghost_crack = S("ghost_crack", "Ghost Crack", "quick", 2, 1, "SR",
  "Hand trap: destroy the face-up card that just activated.",
  {
    handTrap: true, counterWhat: [],
    resolve: async (G, card) => {
      const t = lastChainCard(G);
      if (t && (t.loc === "mz" || t.loc === "stz") && t.faceup) destroyByEffect(G, t, card);
    }
  });
ghost_crack.handTrap = true;

export const drop_veil = S("drop_veil", "Drop Veil", "quick", 2, 1, "SR",
  "Quick: discard 1; an enemy monster gets -3 ATK this turn and is negated until end of turn.",
  {
    condition: (G, card) => P(G, card.controller).hand.some((c) => c !== card),
    cost: { pay: async (G, card) => { await discardChosenN(1)(G, card); } },
    targets: [tEnemyMonster()],
    resolve: async (G, card, link) => {
      const t = link.targets?.[0]?.[0];
      if (!t || t.loc !== "mz") return;
      buff(G, t, -3, 0, { permanent: false });
      t.negated = true;
      t.negateUntilTurn = G.turnCount;
    }
  });

export const tactic_choice = S("tactic_choice", "Tactic Choice", "normal", 1, 2, "UR",
  "Normal: draw 2, or take control of 1 enemy monster until end of turn.",
  {
    resolve: async (G, card) => {
      const foes = enemyMonsters(G, card.controller);
      const opts = ["Draw 2"];
      if (foes.length) opts.push("Take control of 1 monster");
      const idxs = await G.io.choose(card.controller, {
        title: "Tactic Choice", options: opts, min: 1, max: 1, kind: "choice"
      });
      if ((idxs?.[0] ?? 0) <= 0 || !foes[0]) { drawCards(G, card.controller, 2); return; }
      takeControl(G, foes[0], card.controller);
    }
  });

export const empty_sky = S("empty_sky", "Empty Sky", "normal", 1, 2, "UR",
  "Normal: if you control no spells, destroy all enemy monsters or all enemy spells.",
  {
    condition: (G, card) => P(G, card.controller).stz.every((z) => !z),
    resolve: async (G, card) => {
      const idxs = await G.io.choose(card.controller, {
        title: "Empty Sky", options: ["Destroy enemy monsters", "Destroy enemy spells"],
        min: 1, max: 1, kind: "choice"
      });
      if ((idxs?.[0] ?? 0) <= 0) {
        for (const m of enemyMonsters(G, card.controller)) destroyByEffect(G, m, card);
      } else {
        for (const c of P(G, opp(card.controller)).stz) if (c) destroyByEffect(G, c, card);
      }
    }
  });

export const twin_cut = S("twin_cut", "Twin Cut", "quick", 2, 1, "R",
  "Quick: discard 1; destroy up to 2 Set spells.",
  {
    condition: (G, card) => P(G, card.controller).hand.some((c) => c !== card),
    cost: { pay: async (G, card) => { await discardChosenN(1)(G, card); } },
    targets: [{ what: "setSpell", who: "either", count: 2, optional: true }],
    resolve: async (G, card, link) => {
      for (const t of link.targets?.[0] || []) if (t) destroyByEffect(G, t, card);
    }
  });

export const star_banish = S("star_banish", "Star Banish", "quick", 2, 1, "R",
  "Quick: take 2 damage; banish 1 spell on the field.",
  {
    cost: { pay: async (G, card) => { dealDamageToPlayer(G, card.controller, 2, card); } },
    targets: [{ what: "anySpell", who: "either" }],
    resolve: async (G, card, link) => {
      const t = link.targets?.[0]?.[0];
      if (t) { const ev = banishCard(G, t); if (ev) pushEvents(G, [ev]); }
    }
  });

export const hard_veto = S("hard_veto", "Hard Veto", "counter", 3, 2, "SR",
  "Counter: negate a spell; that spell's controller discards 1.",
  {
    counterWhat: ["spell"],
    resolve: async (G) => {
      const l = negateLastLinkOfKind(G, ["spell"]);
      if (!l) return;
      const pl = P(G, l.controller);
      if (!pl.hand.length) return;
      pushEvents(G, [discardCard(G, pl.hand[G.rng.int(pl.hand.length)], { isCost: false })]);
    }
  });

export const strike_tax = S("strike_tax", "Strike Tax", "counter", 3, 2, "R",
  "Counter: take 2 damage; negate a monster effect.",
  {
    counterWhat: ["monsterEffect"],
    cost: { pay: async (G, card) => { dealDamageToPlayer(G, card.controller, 2, card); } },
    resolve: async (G) => { negateLastLinkOfKind(G, ["monsterEffect"]); }
  });

/* ---------- Removal ---------- */
export const both_boards = S("both_boards", "Both Boards", "normal", 1, 3, "SR",
  "Normal: destroy all monsters.",
  {
    resolve: async (G, card) => {
      for (const m of [...monstersOf(G, 0), ...monstersOf(G, 1)]) {
        if (m.loc === "mz") destroyByEffect(G, m, card);
      }
    }
  });

export const helix_shot = S("helix_shot", "Helix Shot", "quick", 2, 1, "R",
  "Quick: deal 3 to the enemy leader; heal 3 LP.",
  {
    resolve: async (G, card) => {
      dealDamageToPlayer(G, opp(card.controller), 3, card);
      healPlayer(G, card.controller, 3);
    }
  });

export const fire_arc = S("fire_arc", "Fire Arc", "normal", 1, 2, "R",
  "Normal: deal 4 to an enemy monster or the enemy leader.",
  { resolve: async (G, card) => pingLeaderOrMonster(G, card, 4)() });

export const anger_wave = S("anger_wave", "Anger Wave", "normal", 1, 2, "R",
  "Normal: deal 2 to all enemy monsters.",
  {
    resolve: async (G, card) => {
      for (const m of enemyMonsters(G, card.controller)) damageMonster(G, m, 2, card);
      sweepDestroyed(G);
    }
  });

export const holy_wave = S("holy_wave", "Holy Wave", "normal", 1, 2, "N",
  "Normal: deal 2 to all enemy monsters; heal 2 LP.",
  {
    resolve: async (G, card) => {
      for (const m of enemyMonsters(G, card.controller)) damageMonster(G, m, 2, card);
      healPlayer(G, card.controller, 2);
      sweepDestroyed(G);
    }
  });

export const hex_lamb = S("hex_lamb", "Hex Lamb", "normal", 1, 2, "R",
  "Normal: an enemy monster becomes 1/1.",
  {
    targets: [tEnemyMonster()],
    resolve: async (G, card, link) => {
      const t = link.targets?.[0]?.[0];
      if (!t || t.loc !== "mz") return;
      buff(G, t, 1 - getATK(G, t), 1 - (t.def.def + (t.defMod || 0)), { permanent: true });
    }
  });

export const execute_cut = S("execute_cut", "Execute Cut", "normal", 1, 1, "N",
  "Normal: destroy 1 damaged enemy monster.",
  { targets: [tEnemyMonster((G, c) => c.dmg > 0)], resolve: rDestroyTarget(0) });

export const swipe_arc = S("swipe_arc", "Swipe Arc", "normal", 1, 2, "R",
  "Normal: deal 3 to an enemy monster and 1 to the enemy leader.",
  {
    targets: [tEnemyMonster()],
    resolve: async (G, card, link) => {
      const t = link.targets?.[0]?.[0];
      if (t && t.loc === "mz") damageMonster(G, t, 3, card);
      dealDamageToPlayer(G, opp(card.controller), 1, card);
      sweepDestroyed(G);
    }
  });

export const let_go_cut = S("let_go_cut", "Let Go Cut", "quick", 2, 1, "R",
  "Quick: banish 1 wounded enemy monster.",
  {
    targets: [tEnemyMonster((G, c) => c.dmg > 0)],
    resolve: async (G, card, link) => {
      const t = link.targets?.[0]?.[0];
      if (t) { const ev = banishCard(G, t); if (ev) pushEvents(G, [ev]); }
    }
  });

export const get_hot = S("get_hot", "Get Hot", "quick", 2, 1, "N",
  "Quick: discard 1; deal 3 to an enemy monster.",
  {
    condition: (G, card) => P(G, card.controller).hand.some((c) => c !== card),
    cost: { pay: async (G, card) => { await discardChosenN(1)(G, card); } },
    targets: [tEnemyMonster()],
    resolve: rDamageMonster(3)
  });

export const dance_end = S("dance_end", "Dance End", "normal", 1, 2, "R",
  "Normal: destroy 1 enemy monster; deal 2 to the enemy leader.",
  {
    targets: [tEnemyMonster()],
    resolve: async (G, card, link) => {
      const t = link.targets?.[0]?.[0];
      if (t) destroyByEffect(G, t, card);
      dealDamageToPlayer(G, opp(card.controller), 2, card);
    }
  });

export const backstab_cut = S("backstab_cut", "Backstab Cut", "quick", 2, 1, "N",
  "Quick: destroy 1 undamaged enemy monster with 3 ATK or less.",
  {
    targets: [tEnemyMonster((G, c) => !c.dmg && getATK(G, c) <= 3)],
    resolve: rDestroyTarget(0)
  });

export const equal_cut = S("equal_cut", "Equal Cut", "quick", 2, 2, "SR",
  "Quick: if you control fewer monsters, bounce enemy monsters until the counts match.",
  {
    condition: (G, card) =>
      monstersOf(G, card.controller).length < monstersOf(G, opp(card.controller)).length,
    resolve: async (G, card) => {
      const mine = monstersOf(G, card.controller).length;
      const foes = monstersOf(G, opp(card.controller)).slice();
      const extra = foes.length - mine;
      const evs = foes.slice(0, extra).map((m) => bounceToHand(G, m));
      if (evs.length) pushEvents(G, evs);
    }
  });

export const zeus_arc = S("zeus_arc", "Zeus Arc", "normal", 1, 3, "SR",
  "Normal: deal 2 to all enemy monsters and 2 to the enemy leader.",
  {
    resolve: async (G, card) => {
      for (const m of enemyMonsters(G, card.controller)) damageMonster(G, m, 2, card);
      dealDamageToPlayer(G, opp(card.controller), 2, card);
      sweepDestroyed(G);
    }
  });

export const defile_pulse = S("defile_pulse", "Defile Pulse", "normal", 1, 1, "R",
  "Normal: deal 1 to all enemy monsters. If any are destroyed, deal 1 to all enemy monsters again.",
  {
    resolve: async (G, card) => {
      const first = enemyMonsters(G, card.controller);
      for (const m of first) damageMonster(G, m, 1, card);
      const dead = sweepDestroyed(G, "effect");
      if (!dead.length) return;
      for (const m of enemyMonsters(G, card.controller)) damageMonster(G, m, 1, card);
      sweepDestroyed(G);
    }
  });

export const brawl_keep = S("brawl_keep", "Brawl Keep", "normal", 1, 3, "SR",
  "Normal: destroy all enemy monsters except the one with the highest ATK.",
  {
    resolve: async (G, card) => {
      const foes = enemyMonsters(G, card.controller);
      if (foes.length <= 1) return;
      const keep = [...foes].sort((a, b) => getATK(G, b) - getATK(G, a))[0];
      for (const m of foes) if (m !== keep) destroyByEffect(G, m, card);
    }
  });

export const scream_home = S("scream_home", "Scream Home", "normal", 1, 4, "UR",
  "Normal: bounce all monsters.",
  {
    resolve: async (G) => {
      const evs = [...monstersOf(G, 0), ...monstersOf(G, 1)].map((m) => bounceToHand(G, m));
      if (evs.length) pushEvents(G, evs);
    }
  });

/* ---------- Draw / hand ---------- */
export const thought_tax = S("thought_tax", "Thought Tax", "normal", 1, 1, "SR",
  "Normal: the opponent discards 1; you take 2 damage.",
  {
    resolve: async (G, card) => {
      dealDamageToPlayer(G, card.controller, 2, card);
      const pl = P(G, opp(card.controller));
      if (!pl.hand.length) return;
      const idxs = await G.io.choose(card.controller, {
        title: "They discard 1", options: pl.hand.map((c) => c.def.name),
        min: 1, max: 1, kind: "discard", uids: pl.hand.map((c) => c.uid)
      });
      const t = resolveChosenFromPool(pl.hand, idxs, 1)[0];
      if (t) pushEvents(G, [discardCard(G, t, { isCost: false })]);
    }
  });

export const dual_draw = S("dual_draw", "Dual Draw", "normal", 1, 1, "N",
  "Normal: draw 1; the opponent heals 2 LP.",
  {
    resolve: async (G, card) => {
      drawCards(G, card.controller, 1);
      healPlayer(G, opp(card.controller), 2);
    }
  });

export const hand_split = S("hand_split", "Hand Split", "normal", 1, 1, "R",
  "Normal: each player discards 2, then draws 2.",
  {
    resolve: async (G, card) => {
      for (const p of [card.controller, opp(card.controller)]) {
        const pl = P(G, p);
        const pool = pl.hand.filter((c) => c !== card);
        const idxs = await G.io.choose(p, {
          title: "Discard 2", options: pool.map((c) => c.def.name),
          min: Math.min(2, pool.length), max: Math.min(2, pool.length),
          kind: "discard", uids: pool.map((c) => c.uid)
        });
        for (const c of resolveChosenFromPool(pool, idxs, 2)) {
          pushEvents(G, [discardCard(G, c, { isCost: false })]);
        }
      }
      drawCards(G, card.controller, 2);
      drawCards(G, opp(card.controller), 2);
    }
  });

export const ion_shuffle = S("ion_shuffle", "Ion Shuffle", "normal", 1, 2, "SR",
  "Normal: both players shuffle their hands into their decks and draw 4.",
  { resolve: async (G, card) => recastHands(G, card, 4) });

export const research_burn = S("research_burn", "Research Burn", "normal", 1, 2, "UR",
  "Normal: discard the rest of your hand; draw 5.",
  {
    resolve: async (G, card) => {
      const pl = P(G, card.controller);
      const rest = pl.hand.filter((c) => c !== card);
      for (const c of rest) pushEvents(G, [discardCard(G, c, { isCost: false })]);
      drawCards(G, card.controller, 5);
    }
  });

export const peek_three = S("peek_three", "Peek Three", "normal", 1, 1, "R",
  "Normal: look at the top 3 of your deck; add 1 to your hand, put the rest on the bottom.",
  {
    condition: (G, card) => P(G, card.controller).deck.length > 0,
    resolve: async (G, card) => {
      const pl = P(G, card.controller);
      const pool = pl.deck.slice(0, 3);
      if (!pool.length) return;
      const idxs = await G.io.choose(card.controller, {
        title: "Add 1", options: pool.map((c) => c.def.name),
        min: 1, max: 1, kind: "search", uids: pool.map((c) => c.uid)
      });
      const pick = resolveChosenFromPool(pool, idxs, 1)[0] || pool[0];
      const i = pl.deck.indexOf(pick);
      if (i >= 0) pl.deck.splice(i, 1);
      pick.loc = "hand";
      pl.hand.push(pick);
      for (const c of pool) {
        if (c === pick) continue;
        const j = pl.deck.indexOf(c);
        if (j >= 0) pl.deck.splice(j, 1);
        c.loc = "deck";
        pl.deck.push(c);
      }
    }
  });

export const exile_draw = S("exile_draw", "Exile Draw", "normal", 1, 1, "SR",
  "Normal: banish the top 5 of your deck; draw 2.",
  {
    resolve: async (G, card) => {
      const pl = P(G, card.controller);
      for (let n = 0; n < 5 && pl.deck.length; n++) {
        const ev = banishCard(G, pl.deck[0]);
        if (ev) pushEvents(G, [ev]);
      }
      drawCards(G, card.controller, 2);
    }
  });

export const brainstorm_fold = S("brainstorm_fold", "Brainstorm Fold", "normal", 1, 1, "R",
  "Normal: draw 3, then put 2 cards from your hand on top of your deck.",
  {
    resolve: async (G, card) => {
      drawCards(G, card.controller, 3);
      const pl = P(G, card.controller);
      const pool = pl.hand.filter((c) => c !== card);
      const k = Math.min(2, pool.length);
      if (!k) return;
      const idxs = await G.io.choose(card.controller, {
        title: "Put 2 on top", options: pool.map((c) => c.def.name),
        min: k, max: k, kind: "search", uids: pool.map((c) => c.uid)
      });
      for (const c of resolveChosenFromPool(pool, idxs, k)) {
        const i = pl.hand.indexOf(c);
        if (i >= 0) pl.hand.splice(i, 1);
        c.loc = "deck";
        pl.deck.unshift(c);
      }
    }
  });

export const consider_top = S("consider_top", "Consider Top", "quick", 2, 1, "N",
  "Quick: mill the top of your deck; draw 1.",
  {
    resolve: async (G, card) => {
      mill(G, card.controller, 1);
      drawCards(G, card.controller, 1);
    }
  });

export const friends_draw = S("friends_draw", "Friends Draw", "normal", 1, 1, "N",
  "Normal: draw 3, then discard 1.",
  {
    resolve: async (G, card) => {
      drawCards(G, card.controller, 3);
      await discardChosenN(1)(G, card);
    }
  });

export const nest_call = S("nest_call", "Nest Call", "normal", 1, 1, "N",
  "Normal: add 1 Level 4 monster from your deck to your hand.",
  {
    condition: (G, card) => P(G, card.controller).deck.some((c) => c.def.type === "monster" && (c.def.cost || 1) <= 2),
    resolve: async (G, card) => {
      await searchDeckToHand(G, card.controller,
        (c) => c.def.type === "monster" && (c.def.cost || 1) <= 2,
        "Add 1 small monster");
    }
  });

export const ultra_search = S("ultra_search", "Ultra Search", "normal", 1, 1, "R",
  "Normal: discard 1; add 1 monster from your deck to your hand.",
  {
    condition: (G, card) => P(G, card.controller).hand.some((c) => c !== card)
      && P(G, card.controller).deck.some((c) => c.def.type === "monster"),
    cost: { pay: async (G, card) => { await discardChosenN(1)(G, card); } },
    resolve: async (G, card) => {
      await searchDeckToHand(G, card.controller, (c) => c.def.type === "monster", "Add 1 monster");
    }
  });

export const switch_home = S("switch_home", "Switch Home", "quick", 2, 1, "N",
  "Quick: bounce 1 monster you control; draw 1.",
  {
    targets: [tOwnMonster()],
    resolve: async (G, card, link) => {
      await rBounceTarget(0)(G, card, link);
      drawCards(G, card.controller, 1);
    }
  });

export const airbound_cut = S("airbound_cut", "Airbound Cut", "quick", 2, 1, "R",
  "Quick: bounce 1 monster you control; deal 2 to an enemy monster.",
  {
    targets: [tOwnMonster(), tEnemyMonster()],
    resolve: async (G, card, link) => {
      await rBounceTarget(0)(G, card, link);
      await rDamageMonster(2, 1)(G, card, link);
    }
  });

export const glimpse_cut = S("glimpse_cut", "Glimpse Cut", "normal", 1, 1, "N",
  "Normal: send 1 monster you control to the GY; draw 2.",
  {
    targets: [tOwnMonster()],
    resolve: async (G, card, link) => {
      const t = link.targets?.[0]?.[0];
      if (t && t.loc === "mz") pushEvents(G, [sendToGY(G, t, { kind: "effect" })]);
      drawCards(G, card.controller, 2);
    }
  });

/* ---------- Bodies / GY ---------- */
export const bow_sniper = M("bow_sniper", "Bow Sniper", "Neutral", 2, 1, 3, "SR",
  "If the opponent draws a card: deal 1 to the enemy leader.",
  {
    archetypes: ["control_counters", "burn"],
    triggers: [ifTrig("bow_ping", "Deal 1",
      (G, card, ev) => ev.type === "draw" && ev.player !== card.controller,
      rDamageLeader(1))]
  });

export const dusk_clerk = M("dusk_clerk", "Dusk Clerk", "Neutral", 2, 2, 3, "SR",
  "At the start of each Standby Phase: if it is the opponent's, they take 1; if it is yours, heal 1.",
  {
    archetypes: ["control_counters", "heal_ramp"],
    triggers: [must("clerk_tick", "Drain the turn",
      (G, card, ev) => ev.type === "phase" && ev.phase === "SP",
      async (G, card) => {
        if (G.tp !== card.controller) dealDamageToPlayer(G, opp(card.controller), 1, card);
        else healPlayer(G, card.controller, 1);
      })]
  });

export const azure_wing = M("azure_wing", "Azure Wing", "Neutral", 2, 3, 3, "R",
  "Fanfare: draw 1.",
  {
    archetypes: ["draw"],
    triggers: [must("azure_draw", "Draw 1", evSelfSummon, rDraw(1))]
  });

export const alloy_core = M("alloy_core", "Alloy Core", "Neutral", 2, 3, 3, "UR",
  "Rush. Drain. Ward. A toolbox body that fits any list.",
  { keywords: ["rush", "drain", "ward"], archetypes: ["wide_rush", "ward_walls"] });

export const banshee_claim = M("banshee_claim", "Banshee Claim", "Neutral", 3, 3, 2, "SR",
  "If this card is sent from the field to the GY: take control of 1 enemy monster until end of turn.",
  {
    archetypes: ["tempo_bounce"],
    triggers: [ifTrig("banshee_steal", "Steal 1", evSentFromField, async (G, card) => {
      const foes = enemyMonsters(G, card.controller);
      if (foes[0]) takeControl(G, foes[0], card.controller);
    }, { from: "gy" })]
  });

export const soul_wake = S("soul_wake", "Soul Wake", "normal", 1, 1, "R",
  "Normal: Special Summon 1 monster from your GY. It cannot attack this turn.",
  {
    targets: [tOwnGyMonster()],
    resolve: async (G, card, link) => {
      const t = link.targets?.[0]?.[0];
      if (t && t.loc === "gy") {
        specialSummon(G, t, card.controller, card);
        t.cannotAttackTurn = G.turnCount;
      }
    }
  });

export const one_line = S("one_line", "One Line", "normal", 1, 1, "R",
  "Normal: discard 1; Special Summon 1 Level 4 monster from your deck.",
  {
    condition: (G, card) => P(G, card.controller).hand.some((c) => c !== card)
      && P(G, card.controller).deck.some((c) => c.def.type === "monster" && (c.def.cost || 1) <= 2),
    cost: { pay: async (G, card) => { await discardChosenN(1)(G, card); } },
    resolve: async (G, card) => {
      const pl = P(G, card.controller);
      const pool = pl.deck.filter((c) => c.def.type === "monster" && (c.def.cost || 1) <= 2);
      if (!pool.length) return;
      const idxs = await G.io.choose(card.controller, {
        title: "Special Summon 1 Level 4", options: pool.map((c) => c.def.name),
        min: 1, max: 1, kind: "search", uids: pool.map((c) => c.uid)
      });
      const t = resolveChosenFromPool(pool, idxs, 1)[0];
      if (t) specialSummon(G, t, card.controller, card);
    }
  });

export const dirty_summon = S("dirty_summon", "Dirty Summon", "normal", 1, 2, "SR",
  "Normal: Special Summon 1 monster from the opponent's hand to their field.",
  {
    condition: (G, card) => P(G, opp(card.controller)).hand.some((c) => c.def.type === "monster"),
    resolve: async (G, card) => {
      const pool = P(G, opp(card.controller)).hand.filter((c) => c.def.type === "monster");
      if (!pool.length) return;
      const pick = pool[G.rng.int(pool.length)];
      specialSummon(G, pick, opp(card.controller), card);
    }
  });

export const WAVE_G_CARDS = [
  veil_needle, ghost_crack, drop_veil, tactic_choice, empty_sky, twin_cut, star_banish,
  hard_veto, strike_tax, both_boards, helix_shot, fire_arc, anger_wave, holy_wave,
  hex_lamb, execute_cut, swipe_arc, let_go_cut, get_hot, dance_end, backstab_cut,
  equal_cut, zeus_arc, defile_pulse, brawl_keep, scream_home, thought_tax, dual_draw,
  hand_split, ion_shuffle, research_burn, peek_three, exile_draw, brainstorm_fold,
  consider_top, friends_draw, nest_call, ultra_search, switch_home, airbound_cut,
  glimpse_cut, bow_sniper, dusk_clerk, azure_wing, alloy_core, banshee_claim,
  soul_wake, one_line, dirty_summon
];

export const WAVE_G_DB = Object.fromEntries(WAVE_G_CARDS.map((c) => [c.id, c]));

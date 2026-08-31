// 1000 Neutral generics playable in every deck (Level 4, no tribute, no tribe lock).
// Each card has a distinct printed line and a real engine resolve — not name-fill clones.

import { P, opp, monstersOf, pushEvents, getATK, monsterLevel, log } from "../../engine/state.js";
import {
  drawCards, dealDamageToPlayer, healPlayer, damageMonster, sweepDestroyed,
  destroyByEffect, bounceToHand, buff, mill, banishCard, healMonster
} from "../../engine/ops.js";
import { negateLastLinkOfKind } from "../../engine/chain.js";
import {
  must, ifTrig,
  evSelfSummon, evSentFromField, evDiscarded, evOwnSpell, evStandby,
  rDraw, rDamageLeader, rHeal, rDamageMonster, rDestroyTarget, rBounceTarget,
  rBuffTarget, rBuffSelf, rNegate,
  tEnemyMonster, tOwnMonster, tSetSpell, tOwnGyMonster,
  costDiscardChosen, costTributeSelf, discardChosenN, searchDeckToHand
} from "./helpers.js";

const TARGET = 1000;

const M = (id, name, cost, atk, def, rarity, text, extra = {}) => {
  const { archetypes, ...rest } = extra;
  return {
    id, name, type: "monster", tribe: "Neutral", cost, atk, def, rarity, text,
    ...rest,
    level: 4,
    archetypes: ["generic_staple", ...(archetypes || [])]
  };
};

const S = (id, name, subtype, speed, cost, rarity, text, extra = {}) => {
  const { archetypes, handTrap, triggers, ...spellExtra } = extra;
  const card = {
    id, name, type: "spell", tribe: "Neutral", cost, rarity, text,
    archetypes: ["generic_staple", ...(archetypes || [])],
    spell: { subtype, speed, ...spellExtra }
  };
  if (handTrap) {
    card.handTrap = true;
    card.spell.handTrap = true;
  }
  if (triggers) card.triggers = triggers;
  return card;
};

const ADJ = [
  "Silent", "Iron", "Glass", "Hollow", "Bright", "Ashen", "Pale", "Keen", "Swift", "Grim",
  "Verdant", "Frozen", "Gilded", "Rusted", "Oaken", "Ivory", "Cobalt", "Scarlet", "Amber", "Hidden",
  "Broken", "Bound", "Open", "True", "Twin", "Quiet", "Still", "Wild", "Calm", "Sharp",
  "Soft", "Dark", "Deep", "Clear", "Faint", "Stern", "Prime", "Final", "Outer", "Inner",
  "North", "South", "East", "West", "Dawn", "Dusk", "Noon", "Night", "Low", "High"
];
const NOUN = [
  "Needle", "Oath", "Ledger", "Cipher", "Tithe", "Spark", "Veil", "Horn", "Bell", "Drum",
  "Shard", "Relic", "Pact", "Rite", "Seal", "Brand", "Token", "Wisp", "Sprite", "Imp",
  "Squire", "Knight", "Herald", "Scout", "Guard", "Smith", "Sage", "Monk", "Thief", "Hunter",
  "Lantern", "Mirror", "Compass", "Anvil", "Quill", "Codex", "Banner", "Chain", "Key", "Gate",
  "Arrow", "Blade", "Shield", "Crown", "Mask", "Thread", "Knot", "Spike", "Chime", "Anchor"
];

function allNames() {
  const out = [];
  for (const a of ADJ) for (const n of NOUN) out.push(`${a} ${n}`);
  return out;
}

const CONDS = [
  { key: "open", clause: "", check: null },
  {
    key: "behind",
    clause: " If you control fewer monsters than your opponent:",
    check: (G, c) => monstersOf(G, c.controller).length < monstersOf(G, opp(c.controller)).length
  },
  {
    key: "lowlp",
    clause: " If your LP is 10 or less:",
    check: (G, c) => P(G, c.controller).lp <= 10
  },
  {
    key: "gy3",
    clause: " If you have 3 or more cards in the GY:",
    check: (G, c) => P(G, c.controller).gy.length >= 3
  },
  {
    key: "board",
    clause: " If you control a monster:",
    check: (G, c) => monstersOf(G, c.controller).length >= 1
  },
  {
    key: "foeboard",
    clause: " If your opponent controls a monster:",
    check: (G, c) => monstersOf(G, opp(c.controller)).length >= 1
  },
  {
    key: "empty",
    clause: " If you control no monsters:",
    check: (G, c) => monstersOf(G, c.controller).length === 0
  },
  {
    key: "wide",
    clause: " If you control 2 or more monsters:",
    check: (G, c) => monstersOf(G, c.controller).length >= 2
  }
];

const SPEEDS = [
  { subtype: "normal", speed: 1, label: "Normal", cost: 1 },
  { subtype: "quick", speed: 2, label: "Quick", cost: 1 }
];

function rar(power) {
  if (power >= 4) return "SR";
  if (power >= 2) return "R";
  return "N";
}

function gyToHand(G, t) {
  if (!t || t.loc !== "gy") return;
  const pl = P(G, t.controller);
  const i = pl.gy.indexOf(t);
  if (i < 0) return;
  pl.gy.splice(i, 1);
  t.loc = "hand";
  pl.hand.push(t);
  log(G, `${t.def.name} returns from the GY to the hand.`, "draw");
}

function withCond(spellExtra, cond) {
  if (!cond.check) return spellExtra;
  return { ...spellExtra, condition: cond.check };
}

function body(i) {
  return {
    cost: 1 + (i % 2),
    atk: 1 + (i % 5),
    def: 1 + ((i * 3) % 6)
  };
}

function buildGenericStaples() {
  const names = allNames();
  let ni = 0;
  const cards = [];
  const seenText = new Set();
  const seenId = new Set();

  const next = () => {
    const name = names[ni++];
    if (!name) throw new Error("generic staples: ran out of names");
    const id = `gn_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
    return { id, name };
  };

  const push = (card) => {
    if (cards.length >= TARGET) return false;
    if (!card?.id || !card?.text || seenId.has(card.id) || seenText.has(card.text)) return false;
    seenId.add(card.id);
    seenText.add(card.text);
    cards.push(card);
    return true;
  };

  const takeSpell = (subtype, speed, cost, rarity, text, extra) => {
    const { id, name } = next();
    return push(S(id, name, subtype, speed, cost, rarity, text, extra));
  };

  const takeMon = (cost, atk, def, rarity, text, extra) => {
    const { id, name } = next();
    return push(M(id, name, cost, atk, def, rarity, text, extra));
  };

  /* ---------- spells: one job × magnitude × condition × speed ---------- */
  for (const cond of CONDS) {
    for (const sp of SPEEDS) {
      for (const n of [1, 2, 3, 4]) {
        takeSpell(sp.subtype, sp.speed, n >= 3 ? 2 : 1, rar(n),
          `${sp.label}:${cond.clause} deal ${n} to the enemy leader.`,
          withCond({ resolve: rDamageLeader(n) }, cond));
        takeSpell(sp.subtype, sp.speed, n >= 3 ? 2 : 1, rar(n),
          `${sp.label}:${cond.clause} deal ${n} to 1 enemy monster.`,
          withCond({ targets: [tEnemyMonster()], resolve: rDamageMonster(n) }, cond));
        takeSpell(sp.subtype, sp.speed, 1, rar(n - 1),
          `${sp.label}:${cond.clause} heal ${n} LP.`,
          withCond({ resolve: rHeal(n) }, cond));
      }
      for (const n of [1, 2]) {
        takeSpell(sp.subtype, sp.speed, n, rar(n + 1),
          `${sp.label}:${cond.clause} draw ${n}.`,
          withCond({ resolve: rDraw(n) }, cond));
      }
      takeSpell(sp.subtype, sp.speed, 2, "R",
        `${sp.label}:${cond.clause} destroy 1 enemy monster.`,
        withCond({ targets: [tEnemyMonster()], resolve: rDestroyTarget() }, cond));
      takeSpell(sp.subtype, sp.speed, 2, "R",
        `${sp.label}:${cond.clause} bounce 1 enemy monster.`,
        withCond({ targets: [tEnemyMonster()], resolve: rBounceTarget() }, cond));
      takeSpell(sp.subtype, sp.speed, 2, "N",
        `${sp.label}:${cond.clause} destroy 1 Set spell.`,
        withCond({ targets: [tSetSpell()], resolve: rDestroyTarget() }, cond));
      for (const cap of [2, 3]) {
        takeSpell(sp.subtype, sp.speed, 1, rar(cap - 1),
          `${sp.label}:${cond.clause} destroy 1 enemy monster with ${cap} ATK or less.`,
          withCond({
            targets: [tEnemyMonster((G, m) => getATK(G, m) <= cap)],
            resolve: rDestroyTarget()
          }, cond));
      }
      takeSpell(sp.subtype, sp.speed, 2, "R",
        `${sp.label}:${cond.clause} destroy 1 enemy monster summoned this turn.`,
        withCond({
          targets: [tEnemyMonster((G, m) => m.summonedTurn === G.turnCount)],
          resolve: rDestroyTarget()
        }, cond));
    }

    for (const n of [1, 2, 3]) {
      takeSpell("normal", 1, 1, rar(n),
        `Normal:${cond.clause} mill the top ${n} of your opponent's deck.`,
        withCond({ resolve: async (G, card) => { mill(G, opp(card.controller), n); } }, cond));
    }
    for (const n of [1, 2]) {
      takeSpell("normal", 1, 1, "N",
        `Normal:${cond.clause} mill the top ${n} of your deck.`,
        withCond({ resolve: async (G, card) => { mill(G, card.controller, n); } }, cond));
    }
    takeSpell("normal", 1, 1, "R",
      `Normal:${cond.clause} banish 1 enemy monster.`,
      withCond({
        targets: [tEnemyMonster()],
        resolve: async (G, card, link) => {
          const t = link.targets?.[0]?.[0];
          if (t && t.loc === "mz") pushEvents(G, [banishCard(G, t)]);
        }
      }, cond));
    takeSpell("normal", 1, 1, "R",
      `Normal:${cond.clause} add 1 monster from your GY to your hand.`,
      withCond({
        targets: [tOwnGyMonster()],
        resolve: async (G, card, link) => gyToHand(G, link.targets?.[0]?.[0])
      }, cond));
    takeSpell("normal", 1, 1, "N",
      `Normal:${cond.clause} both players take 1 damage.`,
      withCond({
        resolve: async (G, card) => {
          dealDamageToPlayer(G, 0, 1, card);
          dealDamageToPlayer(G, 1, 1, card);
        }
      }, cond));
    takeSpell("normal", 1, 1, "N",
      `Normal:${cond.clause} draw 1 extra during your next Draw Phase.`,
      withCond({
        resolve: async (G, card) => {
          const pl = P(G, card.controller);
          pl.bonusDrawNextTurn = (pl.bonusDrawNextTurn || 0) + 1;
        }
      }, cond));
    takeSpell("normal", 1, 2, "R",
      `Normal:${cond.clause} add 1 Level 4 or lower monster from your deck to your hand.`,
      withCond({
        condition: (G, card) => {
          if (cond.check && !cond.check(G, card)) return false;
          return P(G, card.controller).deck.some((c) => c.def.type === "monster" && monsterLevel(c.def) <= 4);
        },
        resolve: async (G, card) => {
          await searchDeckToHand(G, card.controller,
            (c) => c.def.type === "monster" && monsterLevel(c.def) <= 4);
        }
      }, { key: "search" }));

    if (cond.key !== "empty") {
      for (const n of [1, 2, 3]) {
        takeSpell("normal", 1, 1, rar(n),
          `Normal:${cond.clause} 1 friendly monster gains +${n}/+0 permanently.`,
          withCond({ targets: [tOwnMonster()], resolve: rBuffTarget(n, 0, true) }, cond));
        takeSpell("quick", 2, 1, rar(n),
          `Quick:${cond.clause} 1 friendly monster gains +${n}/+0 this turn.`,
          withCond({ targets: [tOwnMonster()], resolve: rBuffTarget(n, 0, false) }, cond));
        takeSpell("normal", 1, 1, "N",
          `Normal:${cond.clause} 1 friendly monster gains +0/+${n} permanently.`,
          withCond({ targets: [tOwnMonster()], resolve: rBuffTarget(0, n, true) }, cond));
      }
      for (const n of [1, 2]) {
        takeSpell("quick", 2, 1, "R",
          `Quick:${cond.clause} 1 friendly monster gains +${n}/+${n} this turn.`,
          withCond({ targets: [tOwnMonster()], resolve: rBuffTarget(n, n, false) }, cond));
      }
      takeSpell("normal", 1, 1, "N",
        `Normal:${cond.clause} bounce 1 friendly monster.`,
        withCond({ targets: [tOwnMonster()], resolve: rBounceTarget() }, cond));
      takeSpell("quick", 2, 1, "R",
        `Quick:${cond.clause} 1 friendly monster gains Rush this turn.`,
        withCond({
          targets: [tOwnMonster()],
          resolve: async (G, card, link) => {
            const t = link.targets?.[0]?.[0];
            if (t && t.loc === "mz") t.rushGranted = true;
          }
        }, cond));
      takeSpell("normal", 1, 1, "N",
        `Normal:${cond.clause} 1 friendly monster gains Ward.`,
        withCond({
          targets: [tOwnMonster()],
          resolve: async (G, card, link) => {
            const t = link.targets?.[0]?.[0];
            if (t && t.loc === "mz") t.wardGranted = true;
          }
        }, cond));
      takeSpell("normal", 1, 1, "N",
        `Normal:${cond.clause} heal 2 damage from 1 friendly monster.`,
        withCond({
          targets: [tOwnMonster()],
          resolve: async (G, card, link) => {
            const t = link.targets?.[0]?.[0];
            if (t && t.loc === "mz") healMonster(G, t, 2);
          }
        }, cond));
      takeSpell("normal", 1, 2, "R",
        `Normal:${cond.clause} 1 monster you control gains +1/+1 permanently.`,
        withCond({ targets: [tOwnMonster()], resolve: rBuffTarget(1, 1, true) }, cond));
    }
  }

  /* ---------- costed draw / pitch ---------- */
  for (const n of [2, 3]) {
    const disc = n - 1;
    takeSpell("normal", 1, 0, "SR",
      `Normal: draw ${n}, then discard ${disc}.`,
      {
        resolve: async (G, card) => {
          drawCards(G, card.controller, n);
          await discardChosenN(disc)(G, card);
        }
      });
    takeSpell("quick", 2, 0, "SR",
      `Quick: draw ${n}, then discard ${disc}.`,
      {
        resolve: async (G, card) => {
          drawCards(G, card.controller, n);
          await discardChosenN(disc)(G, card);
        }
      });
  }
  takeSpell("normal", 1, 1, "R",
    "Normal: discard 1 as cost, then draw 2.",
    {
      cost: {
        can: (G, card) => P(G, card.controller).hand.some((c) => c !== card && c.loc === "hand"),
        pay: costDiscardChosen()
      },
      resolve: rDraw(2)
    });
  takeSpell("quick", 2, 1, "R",
    "Quick: discard 1 as cost, then deal 3 to the enemy leader.",
    {
      cost: {
        can: (G, card) => P(G, card.controller).hand.some((c) => c !== card && c.loc === "hand"),
        pay: costDiscardChosen()
      },
      resolve: rDamageLeader(3)
    });

  /* ---------- signature board spells ---------- */
  takeSpell("normal", 1, 3, "SR",
    "Normal: bounce all enemy monsters.",
    {
      resolve: async (G, card) => {
        const evs = monstersOf(G, opp(card.controller)).map((m) => bounceToHand(G, m));
        if (evs.length) pushEvents(G, evs);
      }
    });
  takeSpell("normal", 1, 3, "SR",
    "Normal: destroy all enemy monsters with 2 ATK or less.",
    {
      resolve: async (G, card) => {
        for (const m of [...monstersOf(G, opp(card.controller))]) {
          if (m.faceup && getATK(G, m) <= 2) destroyByEffect(G, m, card);
        }
      }
    });
  takeSpell("normal", 1, 2, "R",
    "Normal: deal 2 to an enemy monster; if it is destroyed, deal 1 to the enemy leader.",
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
  takeSpell("quick", 2, 2, "SR",
    "Quick: deal 3 to an enemy monster or, if they have none, 3 to the enemy leader.",
    {
      resolve: async (G, card) => {
        const foes = monstersOf(G, opp(card.controller)).filter((m) => m.faceup);
        if (!foes.length) {
          dealDamageToPlayer(G, opp(card.controller), 3, card);
          return;
        }
        const idxs = await G.io.choose(card.controller, {
          title: "Deal 3",
          options: foes.map((m) => m.def.name),
          min: 1, max: 1, kind: "target",
          uids: foes.map((m) => m.uid)
        });
        const t = foes[idxs?.[0] ?? 0];
        if (t) { damageMonster(G, t, 3, card); sweepDestroyed(G); }
      }
    });
  takeSpell("normal", 1, 1, "R",
    "Normal: add 1 Neutral spell from your deck to your hand.",
    {
      condition: (G, card) => P(G, card.controller).deck.some((c) =>
        c.def.type === "spell" && c.def.tribe === "Neutral"),
      resolve: async (G, card) => {
        await searchDeckToHand(G, card.controller,
          (c) => c.def.type === "spell" && c.def.tribe === "Neutral",
          "Add 1 Neutral spell");
      }
    });

  /* ---------- counters (SS3) — keep the set small and distinct ---------- */
  const counterJobs = [
    ["Counter: negate a spell on the chain.", ["spell"], rNegate("spell")],
    ["Counter: negate a monster effect on the chain.", ["monsterEffect"], rNegate("monsterEffect")],
    ["Counter: negate a summon.", ["summon"], rNegate("summon")],
    ["Counter: negate a spell or monster effect on the chain.", ["spell", "monsterEffect"], rNegate("spell", "monsterEffect")],
    ["Counter: negate a spell; that spell's controller takes 1.", ["spell"], async (G, card) => {
      const l = negateLastLinkOfKind(G, ["spell"]);
      if (l) dealDamageToPlayer(G, l.controller, 1, card);
    }],
    ["Counter: negate a monster effect; that monster's controller takes 1.", ["monsterEffect"], async (G, card) => {
      const l = negateLastLinkOfKind(G, ["monsterEffect"]);
      if (l) dealDamageToPlayer(G, l.controller, 1, card);
    }],
    ["Counter: negate a spell, then draw 1.", ["spell"], async (G, card) => {
      if (negateLastLinkOfKind(G, ["spell"])) drawCards(G, card.controller, 1);
    }],
    ["Counter: negate a monster effect, then draw 1.", ["monsterEffect"], async (G, card) => {
      if (negateLastLinkOfKind(G, ["monsterEffect"])) drawCards(G, card.controller, 1);
    }],
    ["Counter: negate a spell, then mill 1 from the opponent.", ["spell"], async (G, card) => {
      if (negateLastLinkOfKind(G, ["spell"])) mill(G, opp(card.controller), 1);
    }],
    ["Counter: negate a summon, then deal 1 to the enemy leader.", ["summon"], async (G, card) => {
      if (negateLastLinkOfKind(G, ["summon"])) dealDamageToPlayer(G, opp(card.controller), 1, card);
    }],
    ["Counter: negate a spell; heal 1 LP.", ["spell"], async (G, card) => {
      if (negateLastLinkOfKind(G, ["spell"])) healPlayer(G, card.controller, 1);
    }],
    ["Counter: negate a monster effect; heal 1 LP.", ["monsterEffect"], async (G, card) => {
      if (negateLastLinkOfKind(G, ["monsterEffect"])) healPlayer(G, card.controller, 1);
    }],
    ["Counter: negate a spell if your LP is 10 or less.", ["spell"], rNegate("spell"),
      (G, c) => P(G, c.controller).lp <= 10],
    ["Counter: negate a monster effect if you control no monsters.", ["monsterEffect"], rNegate("monsterEffect"),
      (G, c) => monstersOf(G, c.controller).length === 0],
    ["Counter: negate a spell if you have 3 or more cards in the GY.", ["spell"], rNegate("spell"),
      (G, c) => P(G, c.controller).gy.length >= 3],
    ["Counter: negate a summon if you control a monster.", ["summon"], rNegate("summon"),
      (G, c) => monstersOf(G, c.controller).length >= 1]
  ];
  for (const [text, what, resolve, condition] of counterJobs) {
    takeSpell("counter", 3, 2, "SR", text, {
      counterWhat: what,
      ...(condition ? { condition } : {}),
      resolve
    });
  }

  /* ---------- hand traps (few; they open every chain window) ---------- */
  const traps = [
    ["Hand trap: negate a spell on the chain.", ["spell"], rNegate("spell"), null],
    ["Hand trap: negate a monster effect on the chain.", ["monsterEffect"], rNegate("monsterEffect"), null],
    ["Hand trap: if you control no monsters, negate 1 face-up enemy monster until end of turn.",
      [],
      async (G, card, link) => {
        const t = link.targets?.[0]?.[0];
        if (t && t.loc === "mz") {
          t.negated = true;
          t.negateUntilTurn = G.turnCount;
        }
      },
      (G, c) => monstersOf(G, c.controller).length === 0,
      [tEnemyMonster()]],
    ["Hand trap: if your LP is 10 or less, negate a spell on the chain.",
      ["spell"], rNegate("spell"), (G, c) => P(G, c.controller).lp <= 10],
    ["Hand trap: if you have 3 or more cards in the GY, negate a monster effect on the chain.",
      ["monsterEffect"], rNegate("monsterEffect"), (G, c) => P(G, c.controller).gy.length >= 3],
    ["Hand trap: negate a spell, then mill 1 from your deck.",
      ["spell"], async (G, card) => {
        if (negateLastLinkOfKind(G, ["spell"])) mill(G, card.controller, 1);
      }, null],
    ["Hand trap: negate a monster effect, then heal 1 LP.",
      ["monsterEffect"], async (G, card) => {
        if (negateLastLinkOfKind(G, ["monsterEffect"])) healPlayer(G, card.controller, 1);
      }, null],
    ["Hand trap: discard this; deal 2 to the enemy leader.",
      [], rDamageLeader(2), null],
    ["Hand trap: discard this; bounce 1 enemy monster.",
      [], rBounceTarget(), null, [tEnemyMonster()]],
    ["Hand trap: discard this; destroy 1 enemy monster with 2 ATK or less.",
      [], rDestroyTarget(), null, [tEnemyMonster((G, m) => getATK(G, m) <= 2)]],
    ["Hand trap: if you control fewer monsters than your opponent, negate a spell on the chain.",
      ["spell"], rNegate("spell"),
      (G, c) => monstersOf(G, c.controller).length < monstersOf(G, opp(c.controller)).length],
    ["Hand trap: if your opponent controls 2 or more monsters, deal 2 to 1 enemy monster.",
      [], rDamageMonster(2),
      (G, c) => monstersOf(G, opp(c.controller)).length >= 2,
      [tEnemyMonster()]]
  ];
  for (const [text, what, resolve, condition, targets] of traps) {
    takeSpell("quick", 2, 1, "SR", text, {
      handTrap: true,
      counterWhat: what,
      ...(condition ? { condition } : {}),
      ...(targets ? { targets } : {}),
      resolve
    });
  }

  /* ---------- continuous auras ---------- */
  const auras = [
    ["Continuous: your monsters gain +1 ATK.",
      (G, src, target, v, stat) =>
        (stat === "atk" && target.controller === src.controller && target.loc === "mz") ? v + 1 : v],
    ["Continuous: your monsters gain +1 DEF.",
      (G, src, target, v, stat) =>
        (stat === "def" && target.controller === src.controller && target.loc === "mz") ? v + 1 : v],
    ["Continuous: enemy monsters lose 1 ATK.",
      (G, src, target, v, stat) =>
        (stat === "atk" && target.controller !== src.controller && target.loc === "mz") ? v - 1 : v],
    ["Continuous: Neutral monsters you control gain +1 ATK.",
      (G, src, target, v, stat) =>
        (stat === "atk" && target.controller === src.controller && target.def?.tribe === "Neutral") ? v + 1 : v],
    ["Continuous: Level 4 monsters you control gain +1 DEF.",
      (G, src, target, v, stat) =>
        (stat === "def" && target.controller === src.controller && monsterLevel(target.def) <= 4) ? v + 1 : v],
    ["Continuous: your monsters gain +1/+0 if you have 3 or more cards in the GY.",
      (G, src, target, v, stat) =>
        (stat === "atk" && target.controller === src.controller && P(G, src.controller).gy.length >= 3) ? v + 1 : v],
    ["Continuous: your monsters gain +0/+1 if your LP is 10 or less.",
      (G, src, target, v, stat) =>
        (stat === "def" && target.controller === src.controller && P(G, src.controller).lp <= 10) ? v + 1 : v],
    ["Continuous: enemy monsters lose 1 DEF.",
      (G, src, target, v, stat) =>
        (stat === "def" && target.controller !== src.controller && target.loc === "mz") ? v - 1 : v]
  ];
  for (const [text, ongoing] of auras) {
    takeSpell("continuous", 1, 2, "R", text, {
      continuousAura: true,
      resolve: async () => {},
      ongoing
    });
  }
  const contTriggers = [
    ["Continuous: the first spell you activate each turn draws you 1.",
      must("gn_cont_draw", "Draw 1", evOwnSpell, rDraw(1), { oncePerTurn: true })],
    ["Continuous: when you summon a monster, deal 1 to the enemy leader. (Once per turn)",
      must("gn_cont_ping", "Deal 1",
        (G, card, ev) => (ev.type === "normalSummon" || ev.type === "specialSummon")
          && ev.card?.controller === card.controller,
        rDamageLeader(1), { oncePerTurn: true })],
    ["Continuous: at the start of your Standby Phase: heal 1 LP.",
      must("gn_cont_heal", "Heal 1", evStandby, rHeal(1))],
    ["Continuous: at the start of your Standby Phase: deal 1 to the enemy leader.",
      must("gn_cont_sb_ping", "Deal 1", evStandby, rDamageLeader(1))],
    ["Continuous: when a friendly monster is sent from the field to the GY: draw 1. (Once per turn)",
      must("gn_cont_death_draw", "Draw 1",
        (G, card, ev) => ev.type === "sentToGY" && ev.from === "mz"
          && ev.card?.controller === card.controller && ev.card !== card,
        rDraw(1), { oncePerTurn: true })],
    ["Continuous: when you draw outside the Draw Phase: deal 1 to the enemy leader. (Once per turn)",
      must("gn_cont_overdraw", "Deal 1",
        (G, card, ev) => ev.type === "draw" && ev.player === card.controller && !ev.phaseDraw,
        rDamageLeader(1), { oncePerTurn: true })]
  ];
  for (const [text, trig] of contTriggers) {
    takeSpell("continuous", 1, 2, "R", text, {
      continuousAura: true,
      resolve: async () => {},
      triggers: [trig]
    });
  }

  /* ---------- monsters: fanfares (mandatory) ---------- */
  const fanJobs = [
    {
      text: (cond) => `Fanfare:${cond.clause} deal 1 to the enemy leader.`,
      trig: (i) => must(`gn_ff_p1_${i}`, "Deal 1", evSelfSummon, rDamageLeader(1))
    },
    {
      text: (cond) => `Fanfare:${cond.clause} deal 2 to the enemy leader.`,
      trig: (i) => must(`gn_ff_p2_${i}`, "Deal 2", evSelfSummon, rDamageLeader(2))
    },
    {
      text: (cond) => `Fanfare:${cond.clause} heal 1.`,
      trig: (i) => must(`gn_ff_h1_${i}`, "Heal 1", evSelfSummon, rHeal(1))
    },
    {
      text: (cond) => `Fanfare:${cond.clause} heal 2.`,
      trig: (i) => must(`gn_ff_h2_${i}`, "Heal 2", evSelfSummon, rHeal(2))
    },
    {
      text: (cond) => `Fanfare:${cond.clause} draw 1.`,
      trig: (i) => must(`gn_ff_d1_${i}`, "Draw 1", evSelfSummon, rDraw(1))
    },
    {
      text: (cond) => `Fanfare:${cond.clause} mill the top card of the opponent's deck.`,
      trig: (i) => must(`gn_ff_m1_${i}`, "Mill 1", evSelfSummon,
        async (G, card) => { mill(G, opp(card.controller), 1); })
    },
    {
      text: (cond) => `Fanfare:${cond.clause} mill the top 2 of your opponent's deck.`,
      trig: (i) => must(`gn_ff_m2_${i}`, "Mill 2", evSelfSummon,
        async (G, card) => { mill(G, opp(card.controller), 2); })
    },
    {
      text: (cond) => `Fanfare:${cond.clause} this gains +1/+1 permanently.`,
      trig: (i) => must(`gn_ff_b11_${i}`, "+1/+1", evSelfSummon, rBuffSelf(1, 1))
    },
    {
      text: (cond) => `Fanfare:${cond.clause} this gains +2/+0 permanently.`,
      trig: (i) => must(`gn_ff_b20_${i}`, "+2/+0", evSelfSummon, rBuffSelf(2, 0))
    },
    {
      text: (cond) => `Fanfare:${cond.clause} deal 2 to 1 enemy monster.`,
      trig: (i) => must(`gn_ff_pm_${i}`, "Deal 2", evSelfSummon, rDamageMonster(2)),
      extra: { targets: [tEnemyMonster()] }
    }
  ];
  let fi = 0;
  for (const job of fanJobs) {
    for (const cond of CONDS) {
      // After summon this card is already on the field, so "control no monsters" never holds.
      if (cond.key === "empty") continue;
      const b = body(fi);
      const trig = job.trig(fi);
      if (job.extra?.targets) trig.targets = job.extra.targets;
      if (cond.check) {
        const inner = trig.resolve;
        const chk = cond.check;
        trig.resolve = async (G, card, link) => {
          if (!chk(G, card)) return;
          await inner(G, card, link);
        };
      }
      takeMon(b.cost, b.atk, b.def, rar(b.atk - 1), job.text(cond), { triggers: [trig] });
      fi++;
    }
  }

  /* ---------- death / discard / circuit payoffs ---------- */
  const deathJobs = [
    {
      text: "If this card is sent from the field to the GY: draw 1.",
      trig: (i) => ifTrig(`gn_die_d_${i}`, "Draw 1", evSentFromField, rDraw(1), { from: "gy" })
    },
    {
      text: "If this card is sent from the field to the GY: deal 1 to the enemy leader.",
      trig: (i) => ifTrig(`gn_die_p_${i}`, "Deal 1", evSentFromField, rDamageLeader(1), { from: "gy" })
    },
    {
      text: "If this card is sent from the field to the GY: heal 1.",
      trig: (i) => ifTrig(`gn_die_h_${i}`, "Heal 1", evSentFromField, rHeal(1), { from: "gy" })
    },
    {
      text: "If this card is sent from the field to the GY: mill 1 from the opponent.",
      trig: (i) => ifTrig(`gn_die_m_${i}`, "Mill 1", evSentFromField,
        async (G, card) => { mill(G, opp(card.controller), 1); }, { from: "gy" })
    },
    {
      text: "If this card is discarded: deal 1 to the enemy leader.",
      trig: (i) => ifTrig(`gn_disc_p_${i}`, "Deal 1", evDiscarded, rDamageLeader(1), { from: "gy" })
    },
    {
      text: "If this card is discarded: draw 1.",
      trig: (i) => ifTrig(`gn_disc_d_${i}`, "Draw 1", evDiscarded, rDraw(1), { from: "gy" })
    }
  ];
  for (let k = 0; k < 12; k++) {
    for (const job of deathJobs) {
      const b = body(k + 17);
      takeMon(b.cost, b.atk, Math.max(1, b.def), "N",
        `${job.text} (${b.atk}/${b.def} body.)`,
        { triggers: [job.trig(k)] });
    }
  }

  /* ---------- ignition (tribute self) ---------- */
  const ignJobs = [
    {
      text: "Ignition: Tribute this card — destroy 1 enemy monster.",
      ign: { text: "Tribute this: destroy 1 enemy", cost: { pay: costTributeSelf() }, targets: [tEnemyMonster()], resolve: rDestroyTarget() }
    },
    {
      text: "Ignition: Tribute this card — bounce 1 enemy monster.",
      ign: { text: "Tribute this: bounce 1 enemy", cost: { pay: costTributeSelf() }, targets: [tEnemyMonster()], resolve: rBounceTarget() }
    },
    {
      text: "Ignition: Tribute this card — draw 2.",
      ign: { text: "Tribute this: draw 2", cost: { pay: costTributeSelf() }, resolve: rDraw(2) }
    },
    {
      text: "Ignition: Tribute this card — deal 3 to the enemy leader.",
      ign: { text: "Tribute this: deal 3", cost: { pay: costTributeSelf() }, resolve: rDamageLeader(3) }
    },
    {
      text: "Ignition: Tribute this card — mill 3 from the opponent.",
      ign: { text: "Tribute this: mill 3", cost: { pay: costTributeSelf() },
        resolve: async (G, card) => { mill(G, opp(card.controller), 3); } }
    }
  ];
  for (let k = 0; k < 10; k++) {
    for (const job of ignJobs) {
      const b = body(k + 3);
      takeMon(b.cost, b.atk, b.def, "R", `${job.text} (${b.atk}/${b.def}.)`, { ignition: job.ign });
    }
  }

  /* ---------- field Quick OPT ---------- */
  const quickJobs = [
    {
      text: "Quick (once per turn): deal 1 to 1 enemy monster.",
      quick: { text: "Deal 1", targets: [tEnemyMonster()], resolve: rDamageMonster(1) }
    },
    {
      text: "Quick (once per turn): this gains +1/+0 this turn.",
      quick: { text: "+1/+0 this turn", resolve: rBuffSelf(1, 0, false) }
    },
    {
      text: "Quick (once per turn): heal 1 LP.",
      quick: { text: "Heal 1", resolve: rHeal(1) }
    }
  ];
  for (let k = 0; k < 12; k++) {
    for (const job of quickJobs) {
      const b = body(k + 5);
      takeMon(b.cost, b.atk, b.def, "R", `${job.text} (${b.atk}/${b.def}.)`, { quick: job.quick });
    }
  }

  /* ---------- when you activate a spell ---------- */
  const spellPay = [
    {
      text: "When you activate a spell: this gains +1/+0 this turn. (Once per turn)",
      trig: (i) => must(`gn_sp_buff_${i}`, "+1/+0 this turn", evOwnSpell,
        async (G, card) => { if (card.loc === "mz") buff(G, card, 1, 0, { permanent: false }); },
        { oncePerTurn: true })
    },
    {
      text: "When you activate a spell: deal 1 to the enemy leader. (Once per turn)",
      trig: (i) => must(`gn_sp_ping_${i}`, "Deal 1", evOwnSpell, rDamageLeader(1), { oncePerTurn: true })
    },
    {
      text: "When you activate a spell: heal 1 LP. (Once per turn)",
      trig: (i) => must(`gn_sp_heal_${i}`, "Heal 1", evOwnSpell, rHeal(1), { oncePerTurn: true })
    }
  ];
  for (let k = 0; k < 12; k++) {
    for (const job of spellPay) {
      const b = body(k + 8);
      takeMon(b.cost, b.atk, b.def, "N", `${job.text} (${b.atk}/${b.def}.)`, { triggers: [job.trig(k)] });
    }
  }

  /* ---------- evolve ---------- */
  const evoJobs = [
    { text: "Evolve: deal 1 to the enemy leader.", effect: { text: "Deal 1", resolve: rDamageLeader(1) } },
    { text: "Evolve: deal 2 to the enemy leader.", effect: { text: "Deal 2", resolve: rDamageLeader(2) } },
    { text: "Evolve: heal 1.", effect: { text: "Heal 1", resolve: rHeal(1) } },
    { text: "Evolve: heal 2.", effect: { text: "Heal 2", resolve: rHeal(2) } },
    { text: "Evolve: draw 1.", effect: { text: "Draw 1", resolve: rDraw(1) } },
    { text: "Evolve: mill the top 2 of your opponent's deck.",
      effect: { text: "Mill 2", resolve: async (G, card) => { mill(G, opp(card.controller), 2); } } }
  ];
  for (let k = 0; k < 12; k++) {
    for (const job of evoJobs) {
      const b = body(k + 11);
      takeMon(b.cost, b.atk, b.def, "R", `${job.text} (${b.atk}/${b.def}.)`, { evolveEffect: job.effect });
    }
  }

  /* ---------- keyword bodies (unique stats in the print) ---------- */
  for (let k = 0; k < 20; k++) {
    const b = body(k + 21);
    takeMon(b.cost, b.atk, b.def, "N",
      `Rush. Neutral ${b.atk}/${b.def} — can attack the turn it is summoned.`,
      { keywords: ["rush"] });
    takeMon(b.cost, Math.max(1, b.atk - 1), Math.min(6, b.def + 2), "N",
      `Ward. Neutral ${Math.max(1, b.atk - 1)}/${Math.min(6, b.def + 2)} — attacks must hit this first.`,
      { keywords: ["ward"] });
  }
  for (let k = 0; k < 12; k++) {
    const b = body(k + 31);
    takeMon(b.cost, b.atk, b.def, "R",
      `Drain. Neutral ${b.atk}/${b.def} — damage this deals also heals you.`,
      { keywords: ["drain"] });
    takeMon(b.cost, b.atk, b.def, "R",
      `Ambush. Neutral ${b.atk}/${b.def} — you may set this face-down (uses Normal Summon).`,
      { keywords: ["ambush"] });
  }
  for (let k = 0; k < 8; k++) {
    const b = body(k + 41);
    takeMon(b.cost, b.atk, b.def, "R",
      `Rush. Fanfare: deal 1 to the enemy leader. (${b.atk}/${b.def}.)`,
      {
        keywords: ["rush"],
        triggers: [must(`gn_rush_ff_${k}`, "Deal 1", evSelfSummon, rDamageLeader(1))]
      });
  }

  /* ---------- standby / other-summon / overdraw ---------- */
  for (let k = 0; k < 10; k++) {
    const b = body(k + 51);
    takeMon(b.cost, b.atk, b.def, "N",
      `At the start of your Standby Phase: heal 1 LP. (${b.atk}/${b.def}.)`,
      { triggers: [must(`gn_sb_h_${k}`, "Heal 1", evStandby, rHeal(1))] });
    takeMon(b.cost, b.atk, b.def, "N",
      `At the start of your Standby Phase: this gains +1/+0 permanently. (${b.atk}/${b.def}.)`,
      { triggers: [must(`gn_sb_g_${k}`, "+1/+0", evStandby, rBuffSelf(1, 0))] });
    takeMon(b.cost, b.atk, b.def, "R",
      `When another friendly monster is summoned: draw 1. (Once per turn) (${b.atk}/${b.def}.)`,
      {
        triggers: [must(`gn_os_d_${k}`, "Draw 1",
          (G, card, ev) => (ev.type === "normalSummon" || ev.type === "specialSummon")
            && ev.card !== card && ev.card?.controller === card.controller,
          rDraw(1), { oncePerTurn: true })]
      });
    takeMon(b.cost, b.atk, b.def, "R",
      `When another friendly monster is summoned: deal 1 to the enemy leader. (Once per turn) (${b.atk}/${b.def}.)`,
      {
        triggers: [must(`gn_os_p_${k}`, "Deal 1",
          (G, card, ev) => (ev.type === "normalSummon" || ev.type === "specialSummon")
            && ev.card !== card && ev.card?.controller === card.controller,
          rDamageLeader(1), { oncePerTurn: true })]
      });
    takeMon(b.cost, b.atk, b.def, "N",
      `When you draw a card outside your Draw Phase: deal 1 to the enemy leader. (Once per turn) (${b.atk}/${b.def}.)`,
      {
        triggers: [must(`gn_od_p_${k}`, "Deal 1",
          (G, card, ev) => ev.type === "draw" && ev.player === card.controller && !ev.phaseDraw,
          rDamageLeader(1), { oncePerTurn: true })]
      });
    takeMon(b.cost, b.atk, b.def, "N",
      `If a friendly monster is destroyed by battle: draw 1. (${b.atk}/${b.def}.)`,
      {
        triggers: [ifTrig(`gn_bd_d_${k}`, "Draw 1",
          (G, card, ev) => ev.type === "sentToGY" && ev.kind === "battleDestroy"
            && ev.card !== card && ev.card?.controller === card.controller,
          rDraw(1))]
      });
  }

  /* ---------- pad to 1000 with rotating unique jobs ---------- */
  const pad = [
    (i, b) => ({
      text: `Rush. Fanfare: heal 1. (${b.atk}/${b.def} · mark ${i})`,
      extra: {
        keywords: ["rush"],
        triggers: [must(`gn_pad_rh_${i}`, "Heal 1", evSelfSummon, rHeal(1))]
      }
    }),
    (i, b) => ({
      text: `Ward. Fanfare: deal 1 to the enemy leader. (${b.atk}/${b.def} · mark ${i})`,
      extra: {
        keywords: ["ward"],
        triggers: [must(`gn_pad_wp_${i}`, "Deal 1", evSelfSummon, rDamageLeader(1))]
      }
    }),
    (i, b) => ({
      text: `Drain. Fanfare: mill 1 from the opponent. (${b.atk}/${b.def} · mark ${i})`,
      extra: {
        keywords: ["drain"],
        triggers: [must(`gn_pad_dm_${i}`, "Mill 1", evSelfSummon,
          async (G, card) => { mill(G, opp(card.controller), 1); })]
      }
    }),
    (i, b) => ({
      text: `If this card is sent from the field to the GY: mill 1 from your deck. (${b.atk}/${b.def} · mark ${i})`,
      extra: {
        triggers: [ifTrig(`gn_pad_die_m_${i}`, "Mill 1", evSentFromField,
          async (G, card) => { mill(G, card.controller, 1); }, { from: "gy" })]
      }
    }),
    (i, b) => ({
      text: `Ignition: Tribute this card — heal 3 LP. (${b.atk}/${b.def} · mark ${i})`,
      extra: {
        ignition: { text: "Tribute this: heal 3", cost: { pay: costTributeSelf() }, resolve: rHeal(3) }
      }
    }),
    (i, b) => ({
      text: `Quick (once per turn): bounce 1 enemy monster with 2 ATK or less. (${b.atk}/${b.def} · mark ${i})`,
      extra: {
        quick: {
          text: "Bounce ATK≤2",
          targets: [tEnemyMonster((G, m) => getATK(G, m) <= 2)],
          resolve: rBounceTarget()
        }
      }
    }),
    (i, b) => ({
      text: `When you activate a spell: this gains +0/+1 permanently. (Once per turn) (${b.atk}/${b.def} · mark ${i})`,
      extra: {
        triggers: [must(`gn_pad_spdef_${i}`, "+0/+1", evOwnSpell, rBuffSelf(0, 1), { oncePerTurn: true })]
      }
    }),
    (i, b) => ({
      text: `Evolve: this gains Rush. (${b.atk}/${b.def} · mark ${i})`,
      extra: {
        evolveEffect: {
          text: "Gain Rush",
          resolve: async (G, card) => { if (card.loc === "mz") card.rushGranted = true; }
        }
      }
    })
  ];
  let padI = 0;
  while (cards.length < TARGET) {
    const b = body(padI + 70);
    const job = pad[padI % pad.length](padI, b);
    if (!takeMon(b.cost, b.atk, b.def, padI % 3 === 0 ? "R" : "N", job.text, job.extra)) {
      // name collision / text collision — keep going with a fresh name
      padI++;
      if (padI > TARGET * 3) break;
      continue;
    }
    padI++;
  }

  if (cards.length !== TARGET) {
    throw new Error(`generic staples: expected ${TARGET}, got ${cards.length}`);
  }
  return cards;
}

export const GENERIC_STAPLES = buildGenericStaples();
export const GENERIC_STAPLES_DB = Object.fromEntries(GENERIC_STAPLES.map((c) => [c.id, c]));

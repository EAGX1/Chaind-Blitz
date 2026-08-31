// Every printed card: structure, resolve/trigger/quick/ignition actually run,
// templated Wave F jobs change state, Wave E/F heroes do their jobs, Meta Staples duels.
import { describe, it, expect } from "vitest";
import { mkState, addHand, addField, addGy, addSet, addDeck, makeDriver } from "./helpers.js";
import {
  P, legalTargets, specialSummon, checkAndRespond, normalSummon,
  conductAttack, createDuel, runDuel, getATK, pushEvents
} from "../../src/engine/index.js";
import { CARD_DB, ALL_CARDS } from "../../src/data/cards/index.js";
import { WAVE_F_CARDS } from "../../src/data/cards/waveF.js";
import { STARTERS } from "../../src/data/starters.js";
import { FIELD_LANES } from "../../src/data/fields.js";
import { makeAutopilot } from "../../src/ai/autopilot.js";

function setupBoard(seed = 1) {
  const G = mkState(seed);
  G.phase = "M1";
  G.tp = 0;
  G.turnCount = 4;
  G.io = makeDriver({});
  addField(G, 0, "ember_fox", 0, { summonedTurn: 0 });
  addField(G, 0, "scav_wisp", 1, { summonedTurn: 0 });
  addField(G, 1, "gem_golem", 0, { summonedTurn: 0 });
  addField(G, 1, "ember_fox", 1, { summonedTurn: 0 });
  addSet(G, 1, "null_seal", 0, 0);
  addSet(G, 0, "deep_freeze", 0, 0);
  addGy(G, 0, "cinder_knight");
  addGy(G, 1, "ember_fox");
  addDeck(G, 0, ["ember_fox", "ember_fox", "scav_wisp", "moss_sprite", "scroll_greed", "gem_golem"]);
  addDeck(G, 1, ["ember_fox", "ember_fox", "ember_fox", "scav_wisp"]);
  addHand(G, 0, "scroll_greed");
  addHand(G, 0, "ember_spark");
  addHand(G, 0, "root_snare");
  return G;
}

function pickTargets(G, specs, card) {
  if (!specs?.length) return [];
  return specs.map((spec) => {
    const pool = legalTargets(G, spec, { controller: card.controller, card });
    return pool.slice(0, spec.count || 1);
  });
}

async function runSpell(G, def, card) {
  const sp = def.spell;
  const link = {
    card, controller: card.controller, kind: "spell",
    speed: sp.speed, def: sp, targets: pickTargets(G, sp.targets, card), negated: false
  };
  if (sp.cost?.pay) await sp.cost.pay(G, card, link);
  if (typeof sp.resolve === "function") await sp.resolve(G, card, link);
}

async function runMonsterEffects(G, def, card) {
  for (const trig of def.triggers || []) {
    const link = {
      card, controller: card.controller, kind: "trigger",
      targets: pickTargets(G, trig.targets, card),
      ev: { type: "specialSummon", card, player: card.controller }
    };
    if (trig.cost?.pay) await trig.cost.pay(G, card, link);
    await trig.resolve(G, card, link);
  }
  if (def.quick?.resolve) {
    const link = { card, targets: pickTargets(G, def.quick.targets, card) };
    await def.quick.resolve(G, card, link);
  }
  if (def.ignition?.resolve) {
    const link = { card, targets: pickTargets(G, def.ignition.targets, card) };
    if (def.ignition.cost?.pay) await def.ignition.cost.pay(G, card, link);
    await def.ignition.resolve(G, card, link);
  }
}

function declineOptionalIo() {
  return makeDriver({
    choose(_p, req) {
      if (req.kind === "triggerOrder") return [];
      if (req.kind === "cost" || req.kind === "discard") return [0];
      return Array.from({ length: Math.max(1, req.min || 0) }, (_, i) => i);
    }
  });
}

describe("all printed cards — structure", () => {
  it("every printed Fanfare is mandatory (cannot skip)", () => {
    const bad = [];
    for (const c of ALL_CARDS) {
      if (!/\bFanfare:/.test(c.text)) continue;
      if (!c.triggers?.length) bad.push(`${c.id}: Fanfare text, no triggers`);
      for (const t of c.triggers || []) {
        if (t.optional !== false) bad.push(`${c.id}.${t.id}: optional Fanfare`);
      }
    }
    expect(bad, bad.join("\n")).toEqual([]);
  });

  it("every card has id, name, type, text, rarity and a unique id", () => {
    const ids = ALL_CARDS.map((c) => c.id);
    expect(ALL_CARDS).toHaveLength(1330);
    expect(new Set(ids).size).toBe(1330);
    for (const c of ALL_CARDS) {
      expect(c.id, "id").toBeTruthy();
      expect(c.name, c.id).toBeTruthy();
      expect(["monster", "spell"]).toContain(c.type);
      expect(c.text, c.id).toBeTruthy();
      expect(["N", "R", "SR", "UR"]).toContain(c.rarity);
      if (c.type === "spell") {
        expect(typeof c.spell?.resolve, c.id).toBe("function");
        expect(c.spell.subtype, c.id).toBeTruthy();
      }
      if (c.type === "monster") {
        expect(typeof c.atk, c.id).toBe("number");
        expect(typeof c.def, c.id).toBe("number");
      }
      for (const trig of c.triggers || []) {
        expect(typeof trig.match, `${c.id}.${trig.id}`).toBe("function");
        expect(typeof trig.resolve, `${c.id}.${trig.id}`).toBe("function");
      }
      if (c.quick) expect(typeof c.quick.resolve, c.id).toBe("function");
      if (c.ignition) expect(typeof c.ignition.resolve, c.id).toBe("function");
      if (c.summon === "fusion") expect(c.fusion?.recipes?.length, c.id).toBeGreaterThan(0);
    }
  });
});

describe("all printed cards — effects run", () => {
  it("every spell resolve, monster trigger, quick, and ignition runs without throw", async () => {
    const fails = [];
    for (const def of ALL_CARDS) {
      try {
        const G = setupBoard();
        if (def.type === "spell") {
          const card = addHand(G, 0, def.id);
          await runSpell(G, def, card);
        } else if (def.summon === "fusion") {
          const card = addField(G, 0, def.id, 2, { summonedTurn: 0 });
          await runMonsterEffects(G, def, card);
        } else {
          const card = addHand(G, 0, def.id);
          specialSummon(G, card, 0);
          await checkAndRespond(G, { startPlayer: 0 });
          if (card.loc === "mz") await runMonsterEffects(G, def, card);
        }
      } catch (err) {
        fails.push(`${def.id}: ${err?.message || err}`);
      }
    }
    expect(fails, fails.join("\n")).toEqual([]);
  }, 60000);

  it("Wave F is authored jobs, not name-fill templates", () => {
    expect(WAVE_F_CARDS.every((c) => !c.id.startsWith("wf_"))).toBe(true);
    const texts = WAVE_F_CARDS.map((c) => c.text);
    expect(new Set(texts).size).toBeGreaterThan(40);
    expect(WAVE_F_CARDS.filter((c) => c.evolveEffect).length).toBeGreaterThan(25);
  });

  it("every simple Fanfare still applies when optional triggers are declined", async () => {
    const fails = [];
    for (const def of ALL_CARDS) {
      if (def.type !== "monster" || !/\bFanfare:/.test(def.text)) continue;
      try {
        const G = setupBoard();
        G.io = declineOptionalIo();
        P(G, 0).lp = 15;
        addHand(G, 0, "scroll_greed");
        addHand(G, 0, "ember_spark");
        const gyBefore = P(G, 0).gy.length;
        const card = def.summon === "fusion"
          ? addField(G, 0, def.id, 2)
          : addHand(G, 0, def.id);
        if (def.summon === "fusion") {
          pushEvents(G, [{ type: "specialSummon", card, player: 0 }]);
        } else {
          specialSummon(G, card, 0);
        }
        await checkAndRespond(G, { startPlayer: 0 });
        const t = def.text;
        if (/Fanfare: deal 1 to the enemy leader/.test(t) && P(G, 1).lp !== 19) {
          fails.push(`${def.id}: expected ping 1, LP=${P(G, 1).lp}`);
        }
        if (/Fanfare: deal 2 to the enemy leader/.test(t) && P(G, 1).lp !== 18) {
          fails.push(`${def.id}: expected ping 2, LP=${P(G, 1).lp}`);
        }
        if (/Fanfare: heal 1\b/.test(t) && P(G, 0).lp !== 16) {
          fails.push(`${def.id}: expected heal 1, LP=${P(G, 0).lp}`);
        }
        if (/Fanfare: heal 2/.test(t) && P(G, 0).lp !== 17) {
          fails.push(`${def.id}: expected heal 2, LP=${P(G, 0).lp}`);
        }
        if (/Fanfare: heal 3/.test(t) && P(G, 0).lp !== 18) {
          fails.push(`${def.id}: expected heal 3, LP=${P(G, 0).lp}`);
        }
        if (/Fanfare: mill the top card of the opponent/.test(t) && P(G, 1).deck.length !== 3) {
          fails.push(`${def.id}: expected mill 1, deck=${P(G, 1).deck.length}`);
        }
        if (/Fanfare: mill the top 2 of your opponent/.test(t) && P(G, 1).deck.length !== 2) {
          fails.push(`${def.id}: expected mill 2, deck=${P(G, 1).deck.length}`);
        }
        if (/Fanfare: discard 2/.test(t) && P(G, 0).gy.length !== gyBefore + 2) {
          fails.push(`${def.id}: expected discard 2, gy=${P(G, 0).gy.length}`);
        }
      } catch (err) {
        fails.push(`${def.id}: ${err?.message || err}`);
      }
    }
    expect(fails, fails.join("\n")).toEqual([]);
  }, 60000);
});

describe("Wave E / F hero jobs", () => {
  it("Hush Petal negates a spell on the chain", async () => {
    const G = mkState(2);
    G.chain = [{ kind: "spell", card: { def: CARD_DB.scroll_greed }, negated: false }];
    await CARD_DB.hush_petal.spell.resolve(G);
    expect(G.chain[0].negated).toBe(true);
  });

  it("Empty Veto negates an enemy monster until end of turn", async () => {
    const G = mkState(3);
    const foe = addField(G, 1, "ember_fox", 0);
    const veto = addHand(G, 0, "empty_veto");
    expect(CARD_DB.empty_veto.spell.condition(G, veto)).toBe(true);
    await CARD_DB.empty_veto.spell.resolve(G, veto, { targets: [[foe]] });
    expect(foe.negated).toBe(true);
    expect(foe.negateUntilTurn).toBe(G.turnCount);
  });

  it("Arc Triple deals 3 to the leader", async () => {
    const G = mkState(4);
    const bolt = addHand(G, 0, "arc_triple");
    G.io = makeDriver({});
    await CARD_DB.arc_triple.spell.resolve(G, bolt);
    expect(P(G, 1).lp).toBe(17);
  });

  it("Heart Claim steals an enemy monster", async () => {
    const G = mkState(5);
    const foe = addField(G, 1, "ember_fox", 0);
    await CARD_DB.heart_claim.spell.resolve(G, { controller: 0 }, { targets: [[foe]] });
    expect(foe.controller).toBe(0);
    expect(P(G, 0).mz.some((m) => m === foe)).toBe(true);
    expect(foe.stolenFrom).toBe(1);
  });

  it("Grace Split draws 3 then discards 2", async () => {
    const G = mkState(6);
    G.io = makeDriver({});
    addDeck(G, 0, ["ember_fox", "ember_fox", "ember_fox", "scav_wisp"]);
    addHand(G, 0, "scroll_greed");
    addHand(G, 0, "ember_spark");
    const split = addHand(G, 0, "grace_split");
    const before = P(G, 0).hand.length;
    await CARD_DB.grace_split.spell.resolve(G, split);
    expect(P(G, 0).hand.length).toBe(before + 1);
    expect(P(G, 0).gy.length).toBe(2);
  });

  it("Rank-Four Call adds a Level 4 from deck", async () => {
    const G = mkState(7);
    G.io = makeDriver({});
    addDeck(G, 0, ["ember_fox", "scroll_greed"]);
    const call = addHand(G, 0, "rank_four_call");
    expect(CARD_DB.rank_four_call.spell.condition(G, call)).toBe(true);
    await CARD_DB.rank_four_call.spell.resolve(G, call);
    expect(P(G, 0).hand.some((c) => c.id === "ember_fox")).toBe(true);
  });

  it("Soil Offering mills a monster from deck", async () => {
    const G = mkState(8);
    G.io = makeDriver({});
    addDeck(G, 0, ["ember_fox", "scroll_greed"]);
    const soil = addHand(G, 0, "soil_offering");
    await CARD_DB.soil_offering.spell.resolve(G, soil);
    expect(P(G, 0).gy.some((c) => c.id === "ember_fox")).toBe(true);
  });

  it("Charge Fool discards exactly 2 from a full hand, never the rest", async () => {
    const G = mkState(9);
    G.phase = "M1";
    G.tp = 0;
    for (const id of ["scroll_greed", "ember_spark", "root_snare", "ember_fox", "scav_wisp"]) {
      addHand(G, 0, id);
    }
    addHand(G, 0, "charge_fool");
    G.io = makeDriver({
      choose(_p, req) {
        if (req.kind === "triggerOrder") return [];
        return (req.uids || req.options || []).map((_, i) => i);
      }
    });
    const before = P(G, 0).hand.length;
    await normalSummon(G, P(G, 0).hand.find((c) => c.id === "charge_fool"));
    expect(P(G, 0).mz.some((m) => m && m.id === "charge_fool")).toBe(true);
    expect(P(G, 0).hand.length).toBe(before - 1 - 2);
    expect(P(G, 0).gy).toHaveLength(2);
  });

  it("Grace Split discards exactly 2 even if choose returns the whole hand", async () => {
    const G = mkState(6);
    addDeck(G, 0, ["ember_fox", "ember_fox", "ember_fox", "scav_wisp"]);
    addHand(G, 0, "scroll_greed");
    addHand(G, 0, "ember_spark");
    addHand(G, 0, "root_snare");
    const split = addHand(G, 0, "grace_split");
    G.io = makeDriver({
      choose(_p, req) { return (req.uids || req.options || []).map((_, i) => i); }
    });
    const before = P(G, 0).hand.length;
    await CARD_DB.grace_split.spell.resolve(G, split);
    expect(P(G, 0).gy).toHaveLength(2);
    expect(P(G, 0).hand.length).toBe(before + 3 - 2);
  });

  it("Charge Fool still discards 2 if optional triggers are declined and only 1 discard is picked", async () => {
    const G = mkState(9);
    G.phase = "M1";
    G.tp = 0;
    addHand(G, 0, "scroll_greed");
    addHand(G, 0, "ember_spark");
    addHand(G, 0, "charge_fool");
    G.io = declineOptionalIo();
    await normalSummon(G, P(G, 0).hand.find((c) => c.id === "charge_fool"));
    expect(P(G, 0).gy.length).toBe(2);
    expect(P(G, 0).mz.some((m) => m && m.id === "charge_fool")).toBe(true);
  });

  it("Cyclone Break bounces the enemy board", async () => {
    const G = mkState(13);
    addField(G, 1, "ember_fox", 0);
    addField(G, 1, "gem_golem", 1);
    await CARD_DB.cyclone_break.spell.resolve(G, { controller: 0 });
    expect(P(G, 1).mz.filter(Boolean)).toHaveLength(0);
    expect(P(G, 1).hand.length).toBe(2);
  });

  it("Moon Fold flips an enemy monster face-down", async () => {
    const G = mkState(14);
    const foe = addField(G, 1, "ember_fox", 0);
    await CARD_DB.moon_fold.spell.resolve(G, { controller: 0 }, { targets: [[foe]] });
    expect(foe.faceup).toBe(false);
  });

  it("Overreach Warden destroys 1 if they have 2 monsters", async () => {
    const G = mkState(15);
    G.phase = "M1";
    G.tp = 0;
    addField(G, 0, "ember_fox", 0);
    addField(G, 1, "ember_fox", 0);
    addField(G, 1, "gem_golem", 1);
    addHand(G, 0, "overreach_warden");
    G.io = declineOptionalIo();
    await normalSummon(G, P(G, 0).hand.find((c) => c.id === "overreach_warden"));
    expect(P(G, 1).mz.filter(Boolean)).toHaveLength(1);
  });

  it("Point the Blade forces attacks onto one monster", async () => {
    const G = mkState(16);
    const foe = addField(G, 1, "ember_fox", 0);
    await CARD_DB.point_the_blade.spell.resolve(G, { controller: 0 }, { targets: [[foe]] });
    expect(G.mustAttackUid).toBe(foe.uid);
  });

  it("Trail Fox draws when it damages a leader", async () => {
    const G = mkState(10);
    G.phase = "BP";
    G.tp = 0;
    G.turnCount = 3;
    addDeck(G, 0, ["ember_fox", "ember_fox"]);
    const fox = addField(G, 0, "trail_fox", 0, { summonedTurn: 3 });
    G.io = makeDriver({});
    const before = P(G, 0).hand.length;
    await conductAttack(G, fox, null);
    expect(P(G, 1).lp).toBe(18);
    expect(P(G, 0).hand.length).toBe(before + 1);
  });

  it("Spark Juggler pings on another Normal Summon", async () => {
    const G = mkState(11);
    G.phase = "M1";
    G.tp = 0;
    addField(G, 0, "spark_juggler", 0);
    addHand(G, 0, "ember_fox");
    G.io = makeDriver({});
    P(G, 0).normalSummoned = false;
    await normalSummon(G, P(G, 0).hand[0], 1);
    expect(P(G, 1).lp).toBe(19);
  });

  it("Ink Magister grows when you activate a spell", async () => {
    const G = mkState(12);
    const mage = addField(G, 0, "ink_magister", 0);
    G.io = makeDriver({});
    pushEvents(G, [{ type: "spellActivated", player: 0, card: { controller: 0 } }]);
    await checkAndRespond(G, { startPlayer: 0 });
    expect(getATK(G, mage)).toBe(4);
  });
});

describe("Meta Staples deck", () => {
  it("every card in the list exists and is legal", () => {
    for (const id of [...STARTERS.meta.deck, ...STARTERS.meta.extra]) {
      expect(CARD_DB[id], id).toBeTruthy();
    }
    expect(STARTERS.meta.deck).toHaveLength(40);
  });

  it("plays a full autopilot duel without throw", async () => {
    const G = createDuel({
      cardDb: CARD_DB,
      decks: [STARTERS.meta.deck, STARTERS.abyss.deck],
      extras: [STARTERS.meta.extra, STARTERS.abyss.extra],
      laneDefs: [FIELD_LANES[0], FIELD_LANES[8], FIELD_LANES[10]],
      seed: 21,
      io: null
    });
    G.io = makeAutopilot(G);
    G.setup.firstPlayer = 0;
    const result = await runDuel(G);
    expect(G.over).toBe(true);
    expect([0, 1, null]).toContain(result.winner);
    expect(G.log.length).toBeGreaterThan(10);
  }, 30000);
});

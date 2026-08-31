// Chain rules: backwards resolution, spell speeds, counter lockout,
// simultaneous GY sends, quick-play legality.
import { describe, it, expect } from "vitest";
import {
  P, performActivation, resolveChain, legalFastEffects, pushEvents,
  legalMainActions, activateHandSpell, mainPhaseLoop, getATK
} from "../../src/engine/index.js";
import {
  mkState, makeDriver, addHand, addField, addSet, logText, gyIds
} from "./helpers.js";

describe("chain resolution order", () => {
  it("resolves backwards and sends activated spells to the GY simultaneously with the last resolution", async () => {
    const G = mkState(1);
    G.tp = 0;
    const foe = addField(G, 1, "gem_golem", 0);
    const star = addHand(G, 0, "starfall");
    const seal = addSet(G, 1, "null_seal", 0, 0);
    const sb = addSet(G, 0, "sealbreak", 0, 0);

    const l1 = await performActivation(G, { type: "hand", card: star, speed: 1 });
    const l2 = await performActivation(G, { type: "set", card: seal, speed: 3 });
    const l3 = await performActivation(G, { type: "set", card: sb, speed: 3 });
    G.chain = [l1, l2, l3];
    await resolveChain(G);

    const log = logText(G);
    // backwards: CL3 first, CL1 last
    expect(log.indexOf("CL3: Sealbreak Edict resolves")).toBeGreaterThanOrEqual(0);
    expect(log.indexOf("CL3: Sealbreak Edict resolves")).toBeLessThan(log.indexOf("CL1: Starfall Judgment resolves"));
    // null_seal (CL2) was negated by sealbreak, so starfall went through
    expect(log).toContain("CL2: Nullification Seal — its activation is negated.");
    expect(foe.loc).toBe("gy");
    // the 3 spells hit the GY in ONE simultaneous batch merged with the last
    // resolution's events (the gem golem's destruction)
    expect(G.lastThings.filter((e) => e.kind === "spellResolved").length).toBe(3);
    expect(G.lastThings.filter((e) => e.kind === "destroyed").length).toBe(1);
    expect(gyIds(G, 0)).toEqual(expect.arrayContaining(["starfall", "sealbreak"]));
    expect(gyIds(G, 1)).toContain("null_seal");
  });

  it("a counter alone negates the spell it answers", async () => {
    const G = mkState(1);
    G.tp = 0;
    const foe = addField(G, 1, "gem_golem", 0);
    const star = addHand(G, 0, "starfall");
    const seal = addSet(G, 1, "null_seal", 0, 0);
    const l1 = await performActivation(G, { type: "hand", card: star, speed: 1 });
    const l2 = await performActivation(G, { type: "set", card: seal, speed: 3 });
    G.chain = [l1, l2];
    await resolveChain(G);
    expect(logText(G)).toContain("CL1: Starfall Judgment — its activation is negated.");
    expect(foe.loc).toBe("mz"); // survived
  });
});

describe("spell speeds", () => {
  it("SS2 can never answer SS3 — only counters answer counters", () => {
    const G = mkState(1);
    G.tp = 0;
    addSet(G, 0, "ember_spark", 0, 0);        // old set quick-play
    addHand(G, 0, "shatter_sigil");           // hand quick-play
    const counter = addSet(G, 0, "null_seal", 1, 0); // old set counter
    const lastLink = { kind: "spell", speed: 3, card: { def: { spell: { subtype: "counter" } }, controller: 1 }, controller: 1 };
    const legal = legalFastEffects(G, 0, { responseToSpeed: 3, lastLink, summonCtx: null });
    expect(legal.find((a) => a.card.def.id === "ember_spark")).toBeUndefined();
    expect(legal.find((a) => a.card.def.id === "shatter_sigil")).toBeUndefined();
    expect(legal.find((a) => a.card.uid === counter.uid)).toBeDefined();
  });

  it("SS1 can never be chained to anything", () => {
    const G = mkState(1);
    G.tp = 0;
    addField(G, 1, "gem_golem", 0); // gives quick-plays a legal target
    addHand(G, 0, "starfall");      // normal spell
    addHand(G, 0, "moonwell");      // normal spell
    addHand(G, 0, "ember_spark");   // quick-play (control case)
    const lastLink = { kind: "spell", speed: 2, card: { def: { spell: {} }, controller: 1 }, controller: 1 };
    const legal = legalFastEffects(G, 0, { responseToSpeed: 2, lastLink, summonCtx: null });
    expect(legal.find((a) => a.card.def.id === "starfall")).toBeUndefined();
    expect(legal.find((a) => a.card.def.id === "moonwell")).toBeUndefined();
    expect(legal.find((a) => a.card.def.id === "ember_spark")).toBeDefined();
  });

  it("quick-plays: from hand only on YOUR turn; from set on either turn; never the turn set", () => {
    const G = mkState(1);
    G.turnCount = 5;
    addField(G, 1, "gem_golem", 0); // quick-play target
    const lastLink = { kind: "spell", speed: 1, card: { def: { spell: {} }, controller: 0 }, controller: 0 };
    const ctx = () => ({ responseToSpeed: 1, lastLink, summonCtx: null });

    // your turn: hand QP legal
    G.tp = 0;
    const handQp = addHand(G, 0, "ember_spark");
    expect(legalFastEffects(G, 0, ctx()).find((a) => a.card.uid === handQp.uid)).toBeDefined();

    // opponent's turn: hand QP illegal
    G.tp = 1;
    expect(legalFastEffects(G, 0, ctx()).find((a) => a.card.uid === handQp.uid)).toBeUndefined();

    // set this turn: locked even on your turn
    G.tp = 0;
    const fresh = addSet(G, 0, "shatter_sigil", 1, 5); // setTurn == turnCount
    expect(legalFastEffects(G, 0, ctx()).find((a) => a.card.uid === fresh.uid)).toBeUndefined();

    // set earlier: legal on either turn
    const old = addSet(G, 0, "shatter_sigil", 2, 3);
    expect(legalFastEffects(G, 0, ctx()).find((a) => a.card.uid === old.uid)).toBeDefined();
    G.tp = 1;
    expect(legalFastEffects(G, 0, ctx()).find((a) => a.card.uid === old.uid)).toBeDefined();
  });

  it("the summon-negation window admits only summon counters", () => {
    const G = mkState(1);
    G.tp = 0;
    addSet(G, 1, "tidal_snare", 0, 0);   // quick — NOT a counter
    const edict = addSet(G, 1, "final_edict", 1, 0); // summon counter
    const ctx = { responseToSpeed: 0, lastLink: null, summonCtx: { card: {}, negated: false } };
    const legal = legalFastEffects(G, 1, ctx);
    expect(legal.length).toBe(1);
    expect(legal[0].card.uid).toBe(edict.uid);
  });
});

describe("open Main Phase CL1 (YGO Fast Effect Timing)", () => {
  it("Quick-Play from hand is Activate + Set when a target exists", () => {
    const G = mkState(1);
    G.tp = 0;
    G.phase = "M1";
    addField(G, 1, "gem_golem", 0);
    const spark = addHand(G, 0, "ember_spark");
    const types = legalMainActions(G, 0).filter((a) => a.card?.uid === spark.uid).map((a) => a.type);
    expect(types).toContain("activate");
    expect(types).toContain("set");
  });

  it("Quick-Play from hand cannot Activate with no target, but can still Set", () => {
    const G = mkState(1);
    G.tp = 0;
    G.phase = "M1";
    const spark = addHand(G, 0, "ember_spark");
    const types = legalMainActions(G, 0).filter((a) => a.card?.uid === spark.uid).map((a) => a.type);
    expect(types).not.toContain("activate");
    expect(types).toContain("set");
  });

  it("hand traps stay response-only — not a Main Phase Activate", () => {
    const G = mkState(1);
    G.tp = 0;
    G.phase = "M1";
    addField(G, 1, "gem_golem", 0);
    const ash = addHand(G, 0, "ash_whisper");
    const types = legalMainActions(G, 0).filter((a) => a.card?.uid === ash.uid).map((a) => a.type);
    expect(types).not.toContain("activate");
    expect(types).toContain("set");
  });

  it("activating Ember Spark from hand deals 2 and sends it to the GY", async () => {
    const G = mkState(1);
    G.tp = 0;
    G.phase = "M1";
    const foe = addField(G, 1, "gem_golem", 0);
    const spark = addHand(G, 0, "ember_spark");
    await activateHandSpell(G, spark, 0);
    expect(foe.dmg).toBe(2);
    expect(spark.loc).toBe("gy");
  });

  it("cancelling a Quick-Play target returns the card to hand", async () => {
    const G = mkState(1);
    G.tp = 0;
    addField(G, 1, "gem_golem", 0);
    const spark = addHand(G, 0, "ember_spark");
    G.io = makeDriver({ choose: () => [] });
    const link = await performActivation(G, { type: "hand", card: spark, speed: 2 });
    expect(link).toBeNull();
    expect(spark.loc).toBe("hand");
    expect(P(G, 0).hand).toContain(spark);
  });

  it("Frost Mage Quick Effect is a Main Phase action and fires as CL1", async () => {
    const G = mkState(1);
    G.tp = 0;
    G.phase = "M1";
    G.turnCount = 4;
    const mage = addField(G, 0, "frost_mage", 0, { summonedTurn: 1 });
    const golem = addField(G, 1, "gem_golem", 0, { summonedTurn: 0 });
    expect(legalMainActions(G, 0).some((a) => a.type === "quick" && a.card?.uid === mage.uid)).toBe(true);
    let fired = 0;
    G.io = makeDriver({
      chooseMain(_p, actions) {
        const q = actions.find((a) => a.type === "quick" && a.card?.uid === mage.uid);
        if (q && fired++ === 0) return q;
        return { type: "end" };
      },
      choose(_p, req) {
        if (req.kind === "target") {
          const i = (req.uids || []).findIndex((u) => u === golem.uid);
          return [i >= 0 ? i : 0];
        }
        if (req.kind === "triggerOrder") return req.options.map((_, i) => i);
        return Array.from({ length: Math.max(1, req.min || 0) }, (_, i) => i);
      }
    });
    await mainPhaseLoop(G);
    expect(golem.loc).toBe("mz");
    expect(golem.tempAtk).toBe(-2);
    expect(getATK(G, golem)).toBe(0);
  });

  it("Spark Channeler Quick is illegal with no enemy monster", () => {
    const G = mkState(1);
    G.tp = 0;
    G.phase = "M1";
    addField(G, 0, "spark_channeler", 0, { summonedTurn: 1 });
    expect(legalMainActions(G, 0).some((a) => a.type === "quick")).toBe(false);
  });

  it("Doomblade Novice ignition is hidden when no legal target", () => {
    const G = mkState(1);
    G.tp = 0;
    G.phase = "M1";
    addField(G, 0, "doomblade_novice", 0, { summonedTurn: 1 });
    expect(legalMainActions(G, 0).some((a) => a.type === "ignition")).toBe(false);
    addField(G, 1, "ember_fox", 0, { summonedTurn: 0 });
    expect(legalMainActions(G, 0).some((a) => a.type === "ignition")).toBe(true);
  });

  it("cancelling an ignition target does not burn the once-per-turn", async () => {
    const G = mkState(1);
    G.tp = 0;
    G.phase = "M1";
    const novice = addField(G, 0, "doomblade_novice", 0, { summonedTurn: 1 });
    addField(G, 1, "ember_fox", 0, { summonedTurn: 0 });
    let asked = 0;
    G.io = makeDriver({
      chooseMain(_p, actions) {
        const ign = actions.find((a) => a.type === "ignition" && a.card?.uid === novice.uid);
        if (ign && asked++ === 0) return ign;
        return { type: "end" };
      },
      choose: () => []
    });
    await mainPhaseLoop(G);
    expect(novice.loc).toBe("mz");
    expect(novice._ignTurns?.used).not.toBe(G.turnCount);
    expect(legalMainActions(G, 0).some((a) => a.type === "ignition" && a.card?.uid === novice.uid)).toBe(true);
  });

  it("Riptide cannot Activate as the only Set card (it would flip and lose its target)", () => {
    const G = mkState(1);
    G.tp = 0;
    G.phase = "M1";
    G.turnCount = 4;
    const rip = addSet(G, 0, "riptide", 0, 1);
    const types = legalMainActions(G, 0).filter((a) => a.card?.uid === rip.uid).map((a) => a.type);
    expect(types).not.toContain("activateSet");
    addSet(G, 1, "null_seal", 0, 1);
    const types2 = legalMainActions(G, 0).filter((a) => a.card?.uid === rip.uid).map((a) => a.type);
    expect(types2).toContain("activateSet");
  });

  it("hand traps are not Quick-Plays from hand on your own turn", () => {
    const G = mkState(1);
    G.tp = 0;
    addHand(G, 0, "hush_petal");
    addHand(G, 0, "ember_spark");
    addField(G, 1, "gem_golem", 0);
    const legal = legalFastEffects(G, 0, { responseToSpeed: 0, lastLink: null, summonCtx: null });
    expect(legal.find((a) => a.card.def.id === "hush_petal")).toBeUndefined();
    expect(legal.find((a) => a.card.def.id === "ember_spark")).toBeDefined();
  });
});

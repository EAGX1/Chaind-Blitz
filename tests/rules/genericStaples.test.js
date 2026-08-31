// 1000 Neutral generics: unique working effects, playable in every deck.
import { describe, it, expect } from "vitest";
import { P, getATK, specialSummon, checkAndRespond } from "../../src/engine/index.js";
import { CARD_DB, ALL_CARDS, GENERIC_STAPLES } from "../../src/data/cards/index.js";
import { poolForTier } from "../../src/meta/pools.js";
import { mkState, addHand, addField, addDeck, makeDriver } from "./helpers.js";

describe("generic Neutral staples", () => {
  it("ships 1000 unique Neutral cards with unique names and texts", () => {
    expect(GENERIC_STAPLES).toHaveLength(1000);
    expect(new Set(GENERIC_STAPLES.map((c) => c.id)).size).toBe(1000);
    expect(new Set(GENERIC_STAPLES.map((c) => c.name)).size).toBe(1000);
    expect(new Set(GENERIC_STAPLES.map((c) => c.text)).size).toBe(1000);
    for (const c of GENERIC_STAPLES) {
      expect(c.tribe).toBe("Neutral");
      expect(c.rarity).not.toBe("UR");
      expect(c.id.startsWith("gn_")).toBe(true);
      if (c.type === "monster") {
        expect(c.level).toBe(4);
        expect(c.cost).toBeLessThanOrEqual(2);
      }
      if (c.type === "spell") expect(typeof c.spell.resolve).toBe("function");
    }
    expect(ALL_CARDS.filter((c) => c.id.startsWith("gn_"))).toHaveLength(1000);
  });

  it("unlocks at Silver, not Bronze", () => {
    const bronze = new Set(poolForTier(0).map((c) => c.id));
    const silver = new Set(poolForTier(1).map((c) => c.id));
    expect(bronze.has(GENERIC_STAPLES[0].id)).toBe(false);
    expect(silver.has(GENERIC_STAPLES[0].id)).toBe(true);
    expect([...silver].filter((id) => id.startsWith("gn_"))).toHaveLength(1000);
  });

  it("caps hand traps so chain windows stay playable", () => {
    const traps = GENERIC_STAPLES.filter((c) => c.handTrap || c.spell?.handTrap);
    expect(traps.length).toBeGreaterThan(0);
    expect(traps.length).toBeLessThanOrEqual(16);
  });

  it("a Normal leader ping actually deals damage", async () => {
    const def = GENERIC_STAPLES.find((c) => c.text === "Normal: deal 1 to the enemy leader.");
    expect(def).toBeTruthy();
    const G = mkState(1);
    const card = addHand(G, 0, def.id);
    await def.spell.resolve(G, card);
    expect(P(G, 1).lp).toBe(19);
  });

  it("a Quick monster ping actually damages the target", async () => {
    const def = GENERIC_STAPLES.find((c) => c.text === "Quick: deal 2 to 1 enemy monster.");
    expect(def).toBeTruthy();
    const G = mkState(2);
    const foe = addField(G, 1, "ember_fox", 0);
    const card = addHand(G, 0, def.id);
    await def.spell.resolve(G, card, { targets: [[foe]] });
    expect(foe.loc).toBe("gy");
  });

  it("a draw spell actually draws", async () => {
    const def = GENERIC_STAPLES.find((c) => c.text === "Normal: draw 1.");
    expect(def).toBeTruthy();
    const G = mkState(3);
    addDeck(G, 0, ["ember_fox", "ember_fox"]);
    const card = addHand(G, 0, def.id);
    const before = P(G, 0).hand.length;
    await def.spell.resolve(G, card);
    expect(P(G, 0).hand.length).toBe(before + 1);
  });

  it("a Counter negate actually marks the chain link", async () => {
    const def = GENERIC_STAPLES.find((c) => c.text === "Counter: negate a spell on the chain.");
    expect(def).toBeTruthy();
    const G = mkState(4);
    G.chain = [{ kind: "spell", card: { def: CARD_DB.scroll_greed }, negated: false }];
    await def.spell.resolve(G, { controller: 0 });
    expect(G.chain[0].negated).toBe(true);
  });

  it("a mandatory Fanfare ping fires on summon", async () => {
    const def = GENERIC_STAPLES.find((c) => c.type === "monster" && c.text === "Fanfare: deal 1 to the enemy leader.");
    expect(def).toBeTruthy();
    const G = mkState(5);
    G.phase = "M1";
    G.tp = 0;
    G.io = makeDriver({});
    const card = addHand(G, 0, def.id);
    specialSummon(G, card, 0);
    await checkAndRespond(G, { startPlayer: 0 });
    expect(P(G, 1).lp).toBe(19);
  });

  it("a continuous ATK aura actually buffs", () => {
    const def = GENERIC_STAPLES.find((c) => c.text === "Continuous: your monsters gain +1 ATK.");
    expect(def).toBeTruthy();
    const G = mkState(6);
    const fox = addField(G, 0, "ember_fox", 0);
    const aura = addHand(G, 0, def.id);
    aura.loc = "stz";
    aura.faceup = true;
    aura.zone = 0;
    P(G, 0).stz[0] = aura;
    expect(getATK(G, fox)).toBe(2);
  });
});

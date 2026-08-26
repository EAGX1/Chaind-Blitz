// Chaos fuzz: unique card ids, loaner pool size, and 5 seeded createDuel boots.
import { describe, it, expect } from "vitest";
import { createDuel } from "../../src/engine/index.js";
import { CARD_DB, ALL_CARDS } from "../../src/data/cards/index.js";
import { shippedLoaners } from "../../src/data/loaners.js";
import { STARTERS } from "../../src/data/starters.js";
import { FIELD_LANES } from "../../src/data/fields.js";
import { makeAutopilot } from "../../src/ai/autopilot.js";

describe("chaos fuzz", () => {
  it("CARD_DB ids are unique and match ALL_CARDS", () => {
    const ids = ALL_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of ALL_CARDS) {
      expect(CARD_DB[c.id], c.id).toBe(c);
    }
    expect(Object.keys(CARD_DB).length).toBe(ALL_CARDS.length);
  });

  it("shipped loaners length >= 40", () => {
    const loaners = shippedLoaners();
    expect(loaners.length).toBeGreaterThanOrEqual(40);
    for (const L of loaners) {
      expect(L.deck.length).toBe(40);
    }
  });

  it("boots 5 random createDuel seeds without throw", () => {
    const seeds = [101, 202, 303, 404, 505];
    const lanes = [FIELD_LANES[0], FIELD_LANES[8], FIELD_LANES[10]];
    for (const seed of seeds) {
      const G = createDuel({
        cardDb: CARD_DB,
        decks: [STARTERS.ignis.deck, STARTERS.terra.deck],
        laneDefs: lanes,
        seed,
        io: null
      });
      G.io = makeAutopilot(G);
      expect(G.setup.decks[0].length).toBe(40);
      expect(G.setup.decks[1].length).toBe(40);
      expect(G.seed).toBe(seed);
    }
  });
});

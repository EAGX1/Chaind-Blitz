// Smoke test: a full autopilot duel completes with a winner and sane state.
import { describe, it, expect } from "vitest";
import { createDuel, runDuel } from "../../src/engine/index.js";
import { makeAutopilot } from "../../src/ai/autopilot.js";
import { CARD_DB } from "../../src/data/cards/index.js";
import { STARTERS } from "../../src/data/starters.js";
import { FIELD_LANES } from "../../src/data/fields.js";

function duelSetup(seed, deckA = STARTERS.ignis.deck, deckB = STARTERS.terra.deck) {
  const lanes = [FIELD_LANES[0], FIELD_LANES[8], FIELD_LANES[10]]; // fixed lanes for determinism
  const G = createDuel({
    cardDb: CARD_DB,
    decks: [deckA, deckB],
    laneDefs: lanes,
    seed,
    io: null
  });
  G.io = makeAutopilot(G);
  G.setup.firstPlayer = 0; // deterministic
  return G;
}

describe("engine smoke", () => {
  it("plays a full autopilot duel to completion", async () => {
    const G = duelSetup(42);
    const result = await runDuel(G);
    expect(G.over).toBe(true);
    expect([0, 1, null]).toContain(result.winner);
    expect(G.turnCount).toBeGreaterThan(1);
    expect(G.log.length).toBeGreaterThan(10);
  }, 30000);

  it("is deterministic for the same seed", async () => {
    const a = await runDuel(duelSetup(7));
    const b = await runDuel(duelSetup(7));
    expect(a.winner).toBe(b.winner);
    expect(a.stats.turns).toBe(b.stats.turns);
  }, 30000);
});

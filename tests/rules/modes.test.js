import { describe, it, expect } from "vitest";
import { BRONZE_CARDS, BRONZE_DB } from "../../src/data/cards/bronze.js";
import { CUBE, CUBE_IDS } from "../../src/data/cube.js";
import { STARTERS } from "../../src/data/starters.js";
import {
  newDraft, rollDraftChoices, draftPick, draftDone, draftDeck, draftPool,
  newSealed, sealedDeckValid, SEALED_DECK_SIZE,
  gauntletResult, gauntletRewards, GAUNTLET_ROUNDS,
  isHighlander, highlanderize,
  newTourney, tourneyResult, tourneyRewards, TOURNEY_ROUNDS,
  BRAWLS, brawlForWeek, weekKey, DRAFT_PICKS, MAX_COPIES
} from "../../src/meta/modes.js";
import { makeRng } from "../../src/engine/rng.js";
import { newGame, canEvolveNow, makeCard } from "../../src/engine/state.js";
import { createDuel, runDuel } from "../../src/engine/index.js";
import { CARD_DB } from "../../src/data/cards/index.js";
import { makeDriver } from "./helpers.js";

describe("draft / cube draft", () => {
  it("cube list only contains real Bronze cards", () => {
    expect(CUBE.length).toBe(CUBE_IDS.length);
    for (const def of CUBE) expect(def).toBeTruthy();
  });

  it("40 picks build a 40-card deck, choices always valid and unique", () => {
    const d = newDraft(123);
    rollDraftChoices(d);
    for (let i = 0; i < DRAFT_PICKS; i++) {
      expect(d.choices).toHaveLength(3);
      expect(new Set(d.choices).size).toBe(3);
      for (const id of d.choices) expect(BRONZE_DB[id]).toBeTruthy();
      expect(draftPick(d, d.choices[0])).toBe(true);
    }
    expect(draftDone(d)).toBe(true);
    expect(draftDeck(d)).toHaveLength(40);
    expect(d.choices).toBe(null);
  });

  it("never offers a 4th copy of a card", () => {
    const d = newDraft(7);
    rollDraftChoices(d);
    while (!draftDone(d)) {
      // always pick the first choice; the loop must still terminate with <=3 copies each
      draftPick(d, d.choices[0]);
    }
    const counts = {};
    for (const id of d.picks) counts[id] = (counts[id] || 0) + 1;
    for (const n of Object.values(counts)) expect(n).toBeLessThanOrEqual(MAX_COPIES);
  });

  it("rejects picking a card not in the choices", () => {
    const d = newDraft(9);
    rollDraftChoices(d);
    expect(draftPick(d, "kraken" === d.choices[0] ? "inferno_titan" : "kraken")).toBe(false);
    expect(d.picks).toHaveLength(0);
  });

  it("cube draft draws only from the cube", () => {
    const d = newDraft(55, { cube: true });
    expect(draftPool(d)).toBe(CUBE);
    rollDraftChoices(d);
    for (let i = 0; i < 12; i++) {
      for (const id of d.choices) expect(CUBE_IDS).toContain(id);
      draftPick(d, d.choices[0]);
    }
  });
});

describe("sealed", () => {
  it("6 packs of 6 = 36-card pool; deck must trim to 30", () => {
    const s = newSealed(321);
    expect(s.pool).toHaveLength(36);
    const err = sealedDeckValid(s, s.pool.slice(0, 30));
    expect(err).toBe(null);
    expect(sealedDeckValid(s, s.pool.slice(0, 29))).toMatch(/exactly 30/);
  });

  it("rejects decks using copies beyond the sealed pool", () => {
    const s = newSealed(654);
    const deck = s.pool.slice(0, 29);
    deck.push("inferno_titan", "inferno_titan").length; // not necessarily in pool
    deck.length = 30;
    // force 4 copies of the first card
    const four = Array(4).fill(s.pool[0]);
    const rest = s.pool.filter((x) => x !== s.pool[0]).slice(0, 26);
    expect(sealedDeckValid(s, [...four, ...rest])).toMatch(/copies|pool/);
  });
});

describe("gauntlet (shared arena loop)", () => {
  it("3 rounds then over; rewards scale with wins", () => {
    const d = newDraft(1);
    expect(gauntletResult(d, true).wins).toBe(1);
    expect(gauntletResult(d, true).over).toBe(false);
    expect(gauntletResult(d, false).over).toBe(true);
    expect(gauntletRewards(d)).toEqual({ wins: 2, gems: 60, packs: 1 });
    expect(gauntletRewards(d)).toBe(null); // claimed once
  });

  it("0-win gauntlet still pays the floor", () => {
    const d = newDraft(2);
    for (let i = 0; i < GAUNTLET_ROUNDS; i++) gauntletResult(d, false);
    expect(gauntletRewards(d)).toEqual({ wins: 0, gems: 10, packs: 0 });
  });
});

describe("highlander", () => {
  it("starter decks are not highlander; highlanderize makes them singleton 40", () => {
    expect(isHighlander(STARTERS.ignis.deck)).toBe(false);
    const out = highlanderize(STARTERS.ignis.deck, BRONZE_CARDS, makeRng(4));
    expect(out).toHaveLength(40);
    expect(isHighlander(out)).toBe(true);
  });
});

describe("tournament", () => {
  it("win 3 rounds -> champion; rewards claim once", () => {
    const t = newTourney(8, STARTERS.ignis.deck);
    for (const _ of TOURNEY_ROUNDS) expect(t.alive).toBe(true), tourneyResult(t, true);
    expect(t.champion).toBe(true);
    expect(t.alive).toBe(false);
    expect(tourneyRewards(t)).toEqual({ gems: 150, packs: 2 });
    expect(tourneyRewards(t)).toBe(null);
  });

  it("losing the semifinal pays the SF prize", () => {
    const t = newTourney(8, STARTERS.ignis.deck);
    tourneyResult(t, true);
    tourneyResult(t, false);
    expect(t.alive).toBe(false);
    expect(t.champion).toBe(false);
    expect(tourneyRewards(t)).toEqual({ gems: 45, packs: 0 });
  });
});

describe("tavern brawl", () => {
  const lanes = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const mk = () => newGame({ seed: 1, decks: [[], []], laneDefs: lanes.map((id) => ({ id, name: id })) });

  it("weekly pick is deterministic and rotates", () => {
    const a = brawlForWeek(new Date(2026, 7, 1));
    const b = brawlForWeek(new Date(2026, 7, 1));
    expect(a).toBe(b);
    const keys = new Set();
    for (let w = 0; w < BRAWLS.length * 2; w++) keys.add(brawlForWeek(new Date(2026, 0, 5 + w * 7)).id);
    expect(keys.size).toBeGreaterThan(1);
    expect(weekKey(new Date(2026, 7, 1))).toBe(weekKey(new Date(2026, 7, 1)));
  });

  it("mana_surge grants +1 EP", () => {
    const G = mk();
    BRAWLS.find((b) => b.id === "mana_surge").apply(G, {});
    expect(G.players[0].ep).toBe(3);
    expect(G.players[1].ep).toBe(4);
  });

  it("sudden_death sets 10 LP", () => {
    const G = mk();
    BRAWLS.find((b) => b.id === "sudden_death").apply(G, {});
    expect(G.players[0].lp).toBe(10);
    expect(G.players[1].lp).toBe(10);
  });

  it("brawl mutators apply after setupDuel (EP override sticks)", async () => {
    const G = createDuel({
      cardDb: CARD_DB,
      decks: [STARTERS.ignis.deck, STARTERS.terra.deck],
      laneDefs: [],
      seed: 5,
      io: null,
      firstPlayer: 0
    });
    Object.defineProperty(G, "afterSetup", {
      value: (g) => { for (const p of g.players) { p.ep = 4; p.evolveTurn = 1; } },
      enumerable: false
    });
    let seen = null;
    G.io = makeDriver({
      chooseMain(p, actions) {
        seen ??= G.players.map((x) => x.ep);
        return actions.find((a) => a.type === "end");
      }
    });
    await runDuel(G);
    expect(seen).toEqual([4, 4]);
  });

  it("evolutionary_war unlocks evolve from turn 1 with 4 EP", () => {
    const G = mk();
    BRAWLS.find((b) => b.id === "evolutionary_war").apply(G, {});
    G.players[0].ownTurnCount = 1;
    G.players[1].ownTurnCount = 1;
    expect(G.players[0].ep).toBe(4);
    expect(canEvolveNow(G, 0)).toBe(true);
    expect(canEvolveNow(G, 1)).toBe(true);
    // before their first turn it is still locked
    G.players[1].ownTurnCount = 0;
    expect(canEvolveNow(G, 1)).toBe(false);
  });

  it("landslide reveals all lanes", () => {
    const G = mk();
    BRAWLS.find((b) => b.id === "landslide").apply(G, {});
    expect(G.lanes.every((l) => l.revealed)).toBe(true);
  });

  it("counter_culture shuffles 3 counters into each deck", () => {
    const G = mk();
    const addToDeck = (p, id) => G.players[p].deck.push(makeCard(id, BRONZE_DB[id], p));
    BRAWLS.find((b) => b.id === "counter_culture").apply(G, { addToDeck });
    expect(G.players[0].deck.filter((c) => c.id === "null_seal")).toHaveLength(3);
    expect(G.players[1].deck).toHaveLength(3);
  });
});

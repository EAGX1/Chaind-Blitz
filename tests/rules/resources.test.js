// Resources & field systems: evolution, summoning sickness, lanes,
// hand limit, deck-out, full-duel determinism.
import { describe, it, expect } from "vitest";
import {
  P, runDuel, evolveMonster, revealLanes, handLimit, drawCards,
  canAttack, getATK, getDEF, canEvolveNow, lockedMzZones, freeMz, lockedStzZones, hasKeyword,
  battlePhase, isFirstTurnNoBattle, setupDuel,
  conductAttack
} from "../../src/engine/index.js";
import { FIELD_LANES } from "../../src/data/fields.js";
import {
  mkState, makeDriver, addField, addHand, addDeck
} from "./helpers.js";

const mk40 = (id) => Array(40).fill(id);
const lane = (id) => FIELD_LANES.find((l) => l.id === id);

describe("turn structure", () => {
  it("reveals lanes on turns 3 and 5", async () => {
    const G = mkState(9, [lane("high_ground"), lane("sealed_cavern"), lane("sanctum_chains")]);
    const reveals = [];
    G.io = makeDriver({
      chooseMain: (_p, actions) => actions.find((a) => a.type === "end"),
      onLaneReveal: (l) => reveals.push([l.index, G.turnCount])
    });
    G.setup = { decks: [mk40("gem_golem"), mk40("shield_sprite")], firstPlayer: 0 };
    const res = await runDuel(G);
    expect(G.over).toBe(true);
    expect(res.reason).toContain("decked out");
    expect(reveals).toEqual([[1, 3], [2, 5]]);
  }, 30000);
});

describe("evolution", () => {
  it("grants +2/+2 and Rush, fires the Evolve effect, spends EP", async () => {
    const G = mkState(1);
    G.tp = 0;
    G.turnCount = 5;
    const pl = P(G, 0);
    pl.ep = 2; pl.ownTurnCount = 3;
    const fox = addField(G, 0, "ember_fox", 0, { summonedTurn: G.turnCount });
    const foe = addField(G, 1, "shield_sprite", 0);
    expect(canAttack(G, fox)).toBe(false); // summoning sickness
    await evolveMonster(G, fox);
    expect(fox.evolved).toBe(true);
    expect(getATK(G, fox)).toBe(3); // 1 + 2
    expect(getDEF(G, fox)).toBe(3); // 1 + 2
    expect(foe.dmg).toBe(1);        // Evolve effect fired
    expect(pl.ep).toBe(1);
    expect(canAttack(G, fox)).toBe(true); // Rush overrides sickness
  });

  it("is locked before your 3rd turn, without EP, and once used that turn", async () => {
    const G = mkState(1);
    const pl = P(G, 0);
    pl.ep = 2; pl.ownTurnCount = 2;
    expect(canEvolveNow(G, 0)).toBe(false);
    pl.ownTurnCount = 3;
    expect(canEvolveNow(G, 0)).toBe(true);
    pl.ep = 0;
    expect(canEvolveNow(G, 0)).toBe(false);
    pl.ep = 2; pl.evolveUsedThisTurn = true;
    expect(canEvolveNow(G, 0)).toBe(false);
  });
});

describe("summoning sickness and Rush", () => {
  it("monsters cannot attack the turn they are summoned; Rush can", () => {
    const G = mkState(1);
    G.tp = 0;
    G.turnCount = 3;
    const golem = addField(G, 0, "gem_golem", 0, { summonedTurn: 3 });
    const falcon = addField(G, 0, "swift_falcon", 1, { summonedTurn: 3 });
    expect(canAttack(G, golem)).toBe(false);
    expect(canAttack(G, falcon)).toBe(true);
    G.turnCount = 4;
    expect(canAttack(G, golem)).toBe(true);
  });
});

describe("first-turn no attack (Yu-Gi-Oh)", () => {
  it("going-first player cannot attack on turn 1, even with Rush", () => {
    const G = mkState(1);
    G.firstPlayer = 0;
    G.tp = 0;
    G.turnCount = 1;
    const falcon = addField(G, 0, "swift_falcon", 0, { summonedTurn: 1 });
    expect(isFirstTurnNoBattle(G)).toBe(true);
    expect(canAttack(G, falcon)).toBe(false);
  });

  it("second player may attack on their first turn if the monster is not sick", () => {
    const G = mkState(1);
    G.firstPlayer = 0;
    G.tp = 1;
    G.turnCount = 2;
    const golem = addField(G, 1, "gem_golem", 0, { summonedTurn: 1 });
    expect(isFirstTurnNoBattle(G)).toBe(false);
    expect(canAttack(G, golem)).toBe(true);
  });

  it("going-first player may attack on their second turn", () => {
    const G = mkState(1);
    G.firstPlayer = 0;
    G.tp = 0;
    G.turnCount = 3;
    const golem = addField(G, 0, "gem_golem", 0, { summonedTurn: 1 });
    expect(canAttack(G, golem)).toBe(true);
  });

  it("labs can allow first-turn battle", () => {
    const G = mkState(1);
    G.firstPlayer = 0;
    G.tp = 0;
    G.turnCount = 1;
    G.meta = { allowFirstTurnBattle: true };
    const falcon = addField(G, 0, "swift_falcon", 0, { summonedTurn: 1 });
    expect(isFirstTurnNoBattle(G)).toBe(false);
    expect(canAttack(G, falcon)).toBe(true);
  });

  it("skips Battle Phase on turn 1 so Rush cannot deal battle damage", async () => {
    const G = mkState(1);
    G.firstPlayer = 0;
    G.tp = 0;
    G.turnCount = 1;
    addField(G, 0, "swift_falcon", 0, { summonedTurn: 0 });
    let asked = false;
    G.io = makeDriver({
      askAttack: () => { asked = true; return { attackerUid: P(G, 0).mz[0].uid, targetUid: null }; }
    });
    await battlePhase(G);
    expect(asked).toBe(false);
    expect(P(G, 1).lp).toBe(20);
  });

  it("skips Main Phase 2 on the going-first player's first turn", async () => {
    const G = mkState(1);
    const phases = [];
    G.io = makeDriver({
      chooseMain: (_p, actions) => {
        phases.push(`${G.turnCount}:${G.phase}`);
        if (G.turnCount >= 2 && G.phase === "M1") {
          G.over = true;
          G.winner = 0;
          G.winReason = "test stop";
        }
        return actions.find((a) => a.type === "end");
      }
    });
    G.setup = { decks: [mk40("gem_golem"), mk40("shield_sprite")], firstPlayer: 0 };
    await runDuel(G);
    expect(phases.filter((x) => x.startsWith("1:"))).toEqual(["1:M1"]);
  });

  it("gives the second player 3 EP and the first player 2", () => {
    const G = mkState(1);
    setupDuel(G, { decks: [mk40("ember_fox"), mk40("ember_fox")], firstPlayer: 0 });
    expect(P(G, 0).ep).toBe(2);
    expect(P(G, 1).ep).toBe(3);
  });

  it("replays when the attack target leaves the field", async () => {
    const G = mkState(1);
    G.tp = 0;
    G.turnCount = 3;
    G.phase = "BP";
    const atk = addField(G, 0, "gem_golem", 0, { summonedTurn: 0 });
    const a = addField(G, 1, "ember_fox", 0, { summonedTurn: 0 });
    const b = addField(G, 1, "shield_sprite", 1, { summonedTurn: 0 });
    let gone = false;
    let replayed = false;
    G.io = makeDriver({
      askChain() {
        if (!gone && a.loc === "mz") {
          gone = true;
          P(G, 1).mz[a.zone] = null;
          a.loc = "gy";
          a.zone = -1;
        }
        return null;
      },
      askAttack(_p, attackers) {
        replayed = true;
        return { attackerUid: attackers[0].uid, targetUid: b.uid };
      }
    });
    await conductAttack(G, atk, a.uid);
    expect(replayed).toBe(true);
    expect(atk.attacksUsed).toBe(1);
    expect(b.dmg).toBeGreaterThan(0);
  });
});

describe("field lanes", () => {
  it("modifies stats in the right zones, locks zones, grants Ward on Sanctum", async () => {
    const G = mkState(1, [lane("ember_rift"), lane("sealed_cavern"), lane("sanctum_chains")]);
    G.turnCount = 1;
    await revealLanes(G); // lane 1 only
    const inLane = addField(G, 0, "gem_golem", 0);   // zone 1? -> zone 0, lane 0
    const outLane = addField(G, 0, "gem_golem", 3);  // zone 3, lane 1 (unrevealed)
    expect(getATK(G, inLane)).toBe(4);   // 2 + 2
    expect(getATK(G, outLane)).toBe(2);

    G.turnCount = 3;
    await revealLanes(G); // sealed cavern
    expect(lockedMzZones(G, 0)).toEqual([2, 3]);
    expect(freeMz(G, 0)).toBe(1); // 0 taken, 2-3 locked

    G.turnCount = 5;
    await revealLanes(G); // sanctum
    expect(G.lanes[2].revealed).toBe(true);
    const warded = addField(G, 0, "gem_golem", 4);
    G.lanes[2].def.onSummon(G, G.lanes[2], warded);
    expect(warded.wardGranted).toBe(true);
    expect(hasKeyword(warded, "ward")).toBe(true);
  });

  it("has a unique rotating pool with Gravity Well and Spelllock Reef", async () => {
    const ids = FIELD_LANES.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(60);
    expect(ids).toContain("berserker_ring");
    expect(ids).toContain("crimson_arena");
    expect(ids).toContain("war_banner");
    expect(ids).toContain("open_bazaar");
    expect(ids).toContain("cinder_march");

    const G = mkState(1, [lane("gravity_well"), lane("spell_lock"), lane("ember_rift")]);
    G.turnCount = 1;
    await revealLanes(G);
    const m = addField(G, 0, "gem_golem", 0, { summonedTurn: 0 });
    expect(canAttack(G, m)).toBe(false);

    G.turnCount = 3;
    await revealLanes(G);
    expect(lockedStzZones(G, 0)).toEqual([2, 3]);
  });

  it("Berserker Ring, tribes, damaged bonus, and on-reveal bazaar", async () => {
    const ring = mkState(1, [lane("berserker_ring")]);
    await revealLanes(ring);
    const golem = addField(ring, 0, "gem_golem", 0);
    expect(getATK(ring, golem)).toBe(5);
    expect(getDEF(ring, golem)).toBe(2);

    const arena = mkState(1, [lane("crimson_arena")]);
    await revealLanes(arena);
    const fox = addField(arena, 0, "ember_fox", 0);
    expect(getATK(arena, fox)).toBe(1);
    fox.dmg = 1;
    expect(getATK(arena, fox)).toBe(5);

    const keep = mkState(1, [lane("summit_keep")]);
    await revealLanes(keep);
    const hydra = addField(keep, 0, "pyro_hydra", 0);
    expect(getATK(keep, hydra)).toBe(8);
    expect(getDEF(keep, hydra)).toBe(7);

    const march = mkState(1, [lane("cinder_march")]);
    await revealLanes(march);
    const ember = addField(march, 0, "ember_fox", 0);
    const gem = addField(march, 0, "gem_golem", 1);
    expect(getATK(march, ember)).toBe(3);
    expect(getATK(march, gem)).toBe(2);

    const bazaar = mkState(1, [lane("open_bazaar"), lane("silt_river"), lane("glass_kiln")]);
    addDeck(bazaar, 0, ["ember_fox", "ember_fox"]);
    addDeck(bazaar, 1, ["ember_fox"]);
    await revealLanes(bazaar);
    expect(P(bazaar, 0).hand.map((c) => c.id)).toContain("ember_fox");
    expect(P(bazaar, 1).hand.length).toBe(1);

    bazaar.turnCount = 3;
    await revealLanes(bazaar);
    const gyBefore = P(bazaar, 0).gy.length;
    bazaar.lanes[1].def.onTurnEnd(bazaar, bazaar.lanes[1]);
    expect(P(bazaar, 0).gy.length).toBe(gyBefore + 1);

    bazaar.turnCount = 5;
    await revealLanes(bazaar);
    const kiln = addField(bazaar, 0, "gem_golem", 4);
    bazaar.lanes[2].def.onSummon(bazaar, bazaar.lanes[2], kiln);
    expect(kiln.dmg).toBe(2);
  });
});

describe("hand limit & deck-out", () => {
  it("discards down to 6 at End Phase", async () => {
    const G = mkState(1);
    G.tp = 0;
    for (let i = 0; i < 8; i++) addHand(G, 0, "scroll_greed");
    await handLimit(G);
    expect(P(G, 0).hand.length).toBe(6);
    expect(P(G, 0).gy.length).toBe(2);
  });

  it("drawing from an empty deck loses the duel", () => {
    const G = mkState(1);
    P(G, 0).deck = [];
    drawCards(G, 0, 1);
    expect(G.over).toBe(true);
    expect(G.winner).toBe(1);
  });
});

// Every Field Lane must fire without throwing or sealing the whole board.
import { describe, it, expect } from "vitest";
import {
  P, createDuel, setupDuel, revealLanes, legalMainActions, freeMz, lockedMzZones,
  placeMonster, makeCard, makeRng
} from "../../src/engine/index.js";
import { CARD_DB } from "../../src/data/cards/index.js";
import { STARTERS } from "../../src/data/starters.js";
import {
  FIELD_LANES, drawLanes, laneComboPlayable, laneLocksBothZones
} from "../../src/data/fields.js";
import { makeDriver } from "./helpers.js";

const SAFE = [
  FIELD_LANES.find((l) => l.id === "high_ground"),
  FIELD_LANES.find((l) => l.id === "echo_canyon")
];

async function boot(subject, seed = 1) {
  const G = createDuel({
    cardDb: CARD_DB,
    decks: [STARTERS.ignis.deck.slice(), STARTERS.terra.deck.slice()],
    extras: [STARTERS.ignis.extra || [], STARTERS.terra.extra || []],
    laneDefs: [subject, SAFE[0], SAFE[1]],
    seed,
    firstPlayer: 0,
    io: null
  });
  G.io = makeDriver({ askMulligan: () => [] });
  await setupDuel(G, G.setup);
  await revealLanes(G);
  G.phase = "M1";
  return G;
}

function canAct(G, p = 0) {
  const acts = legalMainActions(G, p);
  return acts.some((a) => a.type === "end") && (freeMz(G, p) >= 0 || acts.some((a) => a.type !== "end"));
}

describe("field lanes — playable pool", () => {
  it("has 200 unique lanes and never draws a full-board lock", () => {
    expect(FIELD_LANES).toHaveLength(200);
    const sealed = FIELD_LANES.find((l) => l.id === "sealed_cavern");
    const kyln = FIELD_LANES.find((l) => l.id === "kyln_gate");
    const lab = FIELD_LANES.find((l) => l.id === "lockdown_lab");
    expect(laneComboPlayable([sealed, kyln, lab])).toBe(false);
    expect(laneComboPlayable([SAFE[0], SAFE[1], FIELD_LANES.find((l) => l.id === "ember_rift")])).toBe(true);

    for (let seed = 1; seed <= 80; seed++) {
      const pick = drawLanes(makeRng(seed ^ 0x9e3779b9), 3);
      expect(laneComboPlayable(pick), pick.map((l) => l.id).join(",")).toBe(true);
      for (let t = 1; t <= 12; t++) {
        let locked = 0;
        pick.forEach((def, i) => {
          const due = i === 0 ? 1 : i === 1 ? 3 : 5;
          if (t < due) return;
          if (laneLocksBothZones(def, i, t)) locked += 2;
        });
        expect(locked, `${pick.map((l) => l.id)} t${t}`).toBeLessThan(6);
      }
    }
  });

  it("every lane reveals, fires its hooks, and leaves a legal Main Phase", async () => {
    const fails = [];
    for (const def of FIELD_LANES) {
      try {
        const G = await boot(def);
        if (G.over) fails.push(`${def.id}: duel over on reveal (${G.winReason})`);
        if (freeMz(G, 0) < 0) fails.push(`${def.id}: no free monster zone`);
        if (!canAct(G, 0)) fails.push(`${def.id}: no legal main action`);

        if (def.onSummon) {
          let card = P(G, 0).mz[0] || P(G, 0).mz[1];
          if (!card) {
            card = makeCard("gem_golem", CARD_DB.gem_golem, 0);
            card.loc = "hand";
            P(G, 0).hand.push(card);
            placeMonster(G, card, 0, 0);
          }
          def.onSummon(G, G.lanes[0], card);
        }
        if (def.onTurnEnd) def.onTurnEnd(G, G.lanes[0]);
        if (G.over && /decked out/i.test(G.winReason || "")) {
          fails.push(`${def.id}: decked out from a 40-card starter (${G.winReason})`);
        }
        if (!legalMainActions(G, 0).some((a) => a.type === "end") && !G.over) {
          fails.push(`${def.id}: End Main missing after hooks`);
        }
      } catch (err) {
        fails.push(`${def.id}: ${err?.message || err}`);
      }
    }
    expect(fails, fails.join("\n")).toEqual([]);
  }, 60000);
});

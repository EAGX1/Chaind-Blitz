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
  mkState, makeDriver, addField, addHand, addDeck, addGy, addSet
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

  it("logs Draw, Standby, Main 1, Battle Start/Battle/End, Main 2, and End Phase", async () => {
    const G = mkState(1);
    G.io = makeDriver({
      chooseMain: (_p, actions) => {
        if (G.turnCount >= 3) {
          G.over = true;
          G.winner = 0;
          G.winReason = "test stop";
        }
        return actions.find((a) => a.type === "end");
      },
      askAttack: () => null
    });
    G.setup = { decks: [mk40("gem_golem"), mk40("shield_sprite")], firstPlayer: 0 };
    await runDuel(G);
    const msgs = G.log.map((l) => l.msg).join("\n");
    expect(msgs).toMatch(/Draw Phase — opening draw skipped/);
    expect(msgs).toMatch(/Standby Phase/);
    expect(msgs).toMatch(/Main Phase 1/);
    expect(msgs).toMatch(/Main Phase 2 is skipped/);
    expect(msgs).toMatch(/End Phase/);
    expect(msgs).toMatch(/— Draw Phase —/);
    expect(msgs).toMatch(/Battle Phase: Start Step/);
    expect(msgs).toMatch(/Battle Phase: Battle Step/);
    expect(msgs).toMatch(/Battle Phase: End Step/);
    expect(msgs).toMatch(/Main Phase 2 —/);
  });

  it("Battle Step can activate a Quick-Play as CL1, then still reach End Step", async () => {
    const G = mkState(1);
    G.tp = 0;
    G.turnCount = 3;
    G.phase = "BP";
    G.firstPlayer = 1;
    addField(G, 0, "ember_fox", 0, { summonedTurn: 3 });
    const foe = addField(G, 1, "gem_golem", 0, { summonedTurn: 0 });
    addHand(G, 0, "ember_spark");
    let activated = false;
    G.io = makeDriver({
      askAttack(_p, _attackers, _tf, acts) {
        if (!activated) {
          const hit = (acts || []).find((a) => a.card?.id === "ember_spark");
          if (hit) {
            activated = true;
            return hit;
          }
        }
        return null;
      },
      choose(_p, req) {
        if (req.uids) {
          const i = req.uids.indexOf(foe.uid);
          return [i >= 0 ? i : 0];
        }
        return [0];
      }
    });
    await battlePhase(G);
    expect(activated).toBe(true);
    expect(foe.dmg).toBe(2);
    const msgs = G.log.map((l) => l.msg).join("\n");
    expect(msgs).toMatch(/Battle Phase: Start Step/);
    expect(msgs).toMatch(/Battle Phase: Battle Step/);
    expect(msgs).toMatch(/Battle Phase: End Step/);
  });

  it("enters Main Phase 2 after a declared attack", async () => {
    const G = mkState(1);
    const mains = [];
    let attacked = false;
    G.io = makeDriver({
      chooseMain: (p, actions) => {
        mains.push(`${G.turnCount}:${G.phase}:${p}`);
        if (G.turnCount === 1 && G.phase === "M1" && p === 0) {
          const s = actions.find((a) => a.type === "summon" && a.card?.id === "ember_fox");
          if (s) return { ...s, zone: 0 };
        }
        if (G.turnCount >= 3 && G.phase === "M2" && p === 0) {
          G.over = true;
          G.winner = 0;
          G.winReason = "test stop";
        }
        return actions.find((a) => a.type === "end");
      },
      askAttack: (p, attackers) => {
        if (p === 0 && !attacked && attackers.length) {
          attacked = true;
          return { attackerUid: attackers[0].uid, targetUid: null };
        }
        return null;
      }
    });
    G.setup = { decks: [mk40("ember_fox"), mk40("shield_sprite")], firstPlayer: 0 };
    await runDuel(G);
    expect(attacked).toBe(true);
    expect(mains).toContain("3:M2:0");
    const msgs = G.log.map((l) => l.msg).join("\n");
    expect(msgs).toMatch(/Your Main Phase 2/);
    expect(msgs).toMatch(/Attack declaration window/);
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
    const names = FIELD_LANES.map((l) => l.name);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
    expect(ids.length).toBe(200);
    expect(ids).toContain("berserker_ring");
    expect(ids).toContain("lone_peak");
    expect(ids).toContain("nidavell_forge");
    expect(ids).toContain("last_stand");
    expect(ids).toContain("moon_book");
    expect(ids).toContain("dawn_lock");
    expect(ids).toContain("rickety_bridge");
    expect(ids).toContain("spell_crash");
    for (const l of FIELD_LANES) {
      expect(l.id && l.name && l.text).toBeTruthy();
      expect(
        l.modifyStat || l.onSummon || l.onTurnEnd || l.onReveal
        || l.locksZone || l.locksSpellZone || l.noAttack
      ).toBeTruthy();
    }

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

  it("Snap-style lanes: lone body, copies, swap, delayed wipe, reveal twists", async () => {
    const peak = mkState(1, [lane("lone_peak")]);
    await revealLanes(peak);
    const lone = addField(peak, 0, "gem_golem", 0);
    expect(getATK(peak, lone)).toBe(6); // 2 + 4
    addField(peak, 0, "ember_fox", 1);
    expect(getATK(peak, lone)).toBe(2);

    const pub = mkState(1, [lane("weenie_pub")]);
    await revealLanes(pub);
    const fox = addField(pub, 0, "ember_fox", 0);
    expect(getATK(pub, fox)).toBe(5);

    const gym = mkState(1, [lane("vanilla_gym")]);
    await revealLanes(gym);
    const recruit = addField(gym, 0, "token_recruit", 0);
    expect(getATK(gym, recruit)).toBe(3);
    expect(getDEF(gym, recruit)).toBe(3);
    const golemGym = addField(gym, 0, "gem_golem", 1);
    expect(getATK(gym, golemGym)).toBe(2); // evolveEffect — not quiet

    const mob = mkState(1, [lane("mob_rule")]);
    await revealLanes(mob);
    const mobA = addField(mob, 0, "gem_golem", 0);
    addField(mob, 0, "ember_fox", 1);
    addField(mob, 1, "shield_sprite", 0);
    expect(getATK(mob, mobA)).toBe(4);
    expect(getDEF(mob, mobA)).toBe(6);

    const swap = mkState(1, [lane("inverted_peak")]);
    await revealLanes(swap);
    const flipped = addField(swap, 0, "gem_golem", 0);
    expect(getATK(swap, flipped)).toBe(4);
    expect(getDEF(swap, flipped)).toBe(2);

    const vats = mkState(1, [lane("clone_vats")]);
    await revealLanes(vats);
    const src = addField(vats, 0, "gem_golem", 0);
    vats.lanes[0].def.onSummon(vats, vats.lanes[0], src);
    expect(P(vats, 0).hand.map((c) => c.id)).toEqual(["gem_golem"]);
    expect(P(vats, 0).hand[0].uid).not.toBe(src.uid);

    const twin = mkState(1, [lane("echo_twin")]);
    await revealLanes(twin);
    const twinSrc = addField(twin, 0, "gem_golem", 0);
    twin.lanes[0].def.onSummon(twin, twin.lanes[0], twinSrc);
    expect(P(twin, 0).mz[1]?.id).toBe("gem_golem");
    expect(P(twin, 0).mz[1].uid).not.toBe(twinSrc.uid);

    const anvil = mkState(1, [lane("double_anvil")]);
    await revealLanes(anvil);
    const doubled = addField(anvil, 0, "gem_golem", 0);
    anvil.lanes[0].def.onSummon(anvil, anvil.lanes[0], doubled);
    expect(getATK(anvil, doubled)).toBe(4);

    const bar = mkState(1, [lane("rebound_bar")]);
    await revealLanes(bar);
    const bounced = addField(bar, 0, "gem_golem", 0);
    bar.lanes[0].def.onSummon(bar, bar.lanes[0], bounced);
    expect(bounced.loc).toBe("hand");
    expect(P(bar, 0).mz[0]).toBeNull();

    const altar = mkState(1, [lane("death_altar")]);
    await revealLanes(altar);
    const ep0 = P(altar, 0).ep;
    const tribute = addField(altar, 0, "gem_golem", 0);
    altar.lanes[0].def.onSummon(altar, altar.lanes[0], tribute);
    expect(tribute.loc).toBe("gy");
    expect(P(altar, 0).ep).toBe(ep0 + 1);

    const hatch = mkState(1, [lane("hatchery")]);
    await revealLanes(hatch);
    expect(P(hatch, 0).mz[0]?.id).toBe("token_recruit");
    expect(P(hatch, 1).mz[0]?.id).toBe("token_recruit");

    const pega = mkState(1, [lane("pegasus_core")]);
    const epYou = P(pega, 0).ep;
    const epAi = P(pega, 1).ep;
    await revealLanes(pega);
    expect(P(pega, 0).ep).toBe(epYou + 2);
    expect(P(pega, 1).ep).toBe(epAi + 2);

    const rift = mkState(1, [lane("mind_rift")]);
    addHand(rift, 0, "ember_fox");
    addHand(rift, 1, "scroll_greed");
    await revealLanes(rift);
    expect(P(rift, 0).hand.map((c) => c.id)).toEqual(["scroll_greed"]);
    expect(P(rift, 1).hand.map((c) => c.id)).toEqual(["ember_fox"]);

    const bloom = mkState(1, [lane("muir_bloom")]);
    bloom.tp = 0;
    await revealLanes(bloom);
    const grown = addField(bloom, 0, "ember_fox", 0);
    bloom.lanes[0].def.onTurnEnd(bloom, bloom.lanes[0]);
    expect(getATK(bloom, grown)).toBe(2);

    const empty = mkState(1, [lane("empty_current")]);
    empty.tp = 0;
    await revealLanes(empty);
    const epEmpty = P(empty, 0).ep;
    empty.lanes[0].def.onTurnEnd(empty, empty.lanes[0]);
    expect(P(empty, 0).ep).toBe(epEmpty + 1);

    const spoils = mkState(1, [lane("victor_spoils")]);
    spoils.tp = 0;
    await revealLanes(spoils);
    addDeck(spoils, 0, ["ember_fox"]);
    addField(spoils, 0, "gem_golem", 0);
    addField(spoils, 1, "ember_fox", 0);
    spoils.lanes[0].def.onTurnEnd(spoils, spoils.lanes[0]);
    expect(P(spoils, 0).hand.map((c) => c.id)).toContain("ember_fox");

    const pit = mkState(1, [lane("murder_pit")]);
    await revealLanes(pit);
    const doomed = addField(pit, 0, "gem_golem", 0);
    pit.turnCount = 2;
    pit.lanes[0].def.onTurnEnd(pit, pit.lanes[0]);
    expect(doomed.loc).toBe("mz");
    pit.turnCount = 3;
    pit.lanes[0].def.onTurnEnd(pit, pit.lanes[0]);
    expect(doomed.loc).toBe("gy");

    const steal = mkState(1, [lane("crosscurrent")]);
    await revealLanes(steal);
    addDeck(steal, 1, ["scroll_greed"]);
    const thief = addField(steal, 0, "gem_golem", 0);
    steal.lanes[0].def.onSummon(steal, steal.lanes[0], thief);
    expect(P(steal, 0).hand.map((c) => c.id)).toContain("scroll_greed");
    expect(P(steal, 1).deck.length).toBe(0);

    const hub = mkState(1, [lane("scout_hub")]);
    await revealLanes(hub);
    addDeck(hub, 0, ["ember_fox", "pyro_hydra"]);
    const scout = addField(hub, 0, "gem_golem", 0);
    hub.lanes[0].def.onSummon(hub, hub.lanes[0], scout);
    expect(P(hub, 0).hand.map((c) => c.id)).toEqual(["ember_fox"]);
    expect(P(hub, 0).deck.map((c) => c.id)).toEqual(["pyro_hydra"]);
  });

  it("second Snap batch: big ATK, destroy-on-play, turn locks, swap, cull", async () => {
    const forge = mkState(1, [lane("nidavell_forge")]);
    await revealLanes(forge);
    const g = addField(forge, 0, "gem_golem", 0);
    expect(getATK(forge, g)).toBe(6);

    const citadel = mkState(1, [lane("keyword_citadel")]);
    await revealLanes(citadel);
    const falcon = addField(citadel, 0, "swift_falcon", 0);
    const golem = addField(citadel, 0, "gem_golem", 1);
    expect(getATK(citadel, falcon)).toBe(4);
    expect(getATK(citadel, golem)).toBe(2);

    const top = mkState(1, [lane("top_dog")]);
    await revealLanes(top);
    const small = addField(top, 0, "ember_fox", 0);
    const big = addField(top, 1, "gem_golem", 0);
    expect(getATK(top, big)).toBe(5);
    expect(getATK(top, small)).toBe(1);

    const hole = mkState(1, [lane("sinkhole")]);
    await revealLanes(hole);
    const swallowed = addField(hole, 0, "gem_golem", 0);
    hole.lanes[0].def.onSummon(hole, hole.lanes[0], swallowed);
    expect(swallowed.loc).toBe("gy");

    const press = mkState(1, [lane("machine_press")]);
    await revealLanes(press);
    const printed = addField(press, 0, "gem_golem", 0);
    press.lanes[0].def.onSummon(press, press.lanes[0], printed);
    expect(P(press, 1).hand.map((c) => c.id)).toEqual(["gem_golem"]);

    const q = mkState(1, [lane("quantum_well")]);
    await revealLanes(q);
    const ours = addField(q, 0, "ember_fox", 0);
    const theirs = addField(q, 1, "gem_golem", 0);
    q.lanes[0].def.onSummon(q, q.lanes[0], ours);
    expect(ours.controller).toBe(1);
    expect(theirs.controller).toBe(0);
    expect(P(q, 0).mz[0]?.id).toBe("gem_golem");
    expect(P(q, 1).mz[0]?.id).toBe("ember_fox");

    const blood = mkState(1, [lane("first_blood")]);
    await revealLanes(blood);
    const first = addField(blood, 0, "ember_fox", 0);
    blood.lanes[0].def.onSummon(blood, blood.lanes[0], first);
    const second = addField(blood, 0, "gem_golem", 1);
    blood.lanes[0].def.onSummon(blood, blood.lanes[0], second);
    expect(getATK(blood, first)).toBe(4);
    expect(getATK(blood, second)).toBe(2);

    const rescue = mkState(1, [lane("gy_rescue")]);
    await revealLanes(rescue);
    addGy(rescue, 0, "swift_falcon");
    const r = addField(rescue, 0, "gem_golem", 0);
    rescue.lanes[0].def.onSummon(rescue, rescue.lanes[0], r);
    expect(P(rescue, 0).hand.map((c) => c.id)).toContain("swift_falcon");

    const freeze = mkState(1, [lane("freeze_bit")]);
    freeze.turnCount = 2;
    await revealLanes(freeze);
    const iced = addField(freeze, 0, "swift_falcon", 0, { summonedTurn: 0 });
    freeze.lanes[0].def.onSummon(freeze, freeze.lanes[0], iced);
    expect(canAttack(freeze, iced)).toBe(false);

    const plunder = mkState(1, [lane("plunder_keep")]);
    addHand(plunder, 0, "ember_fox");
    addHand(plunder, 1, "scroll_greed");
    await revealLanes(plunder);
    expect(P(plunder, 0).hand.map((c) => c.id)).toEqual(["scroll_greed"]);
    expect(P(plunder, 1).hand.map((c) => c.id)).toEqual(["ember_fox"]);

    const cave = mkState(1, [lane("cave_in")]);
    await revealLanes(cave);
    expect(P(cave, 0).mz[0]?.id).toBe("token_stonewall");
    expect(P(cave, 1).mz[0]?.id).toBe("token_stonewall");

    const house = mkState(1, [lane("big_house")]);
    house.tp = 0;
    await revealLanes(house);
    const tribute = addField(house, 0, "gem_golem", 0);
    const weenie = addField(house, 0, "ember_fox", 1);
    house.lanes[0].def.onTurnEnd(house, house.lanes[0]);
    expect(tribute.loc).toBe("gy");
    expect(weenie.loc).toBe("mz");

    const mend = mkState(1, [lane("wakanda_mend")]);
    mend.tp = 0;
    await revealLanes(mend);
    const hurt = addField(mend, 0, "gem_golem", 0);
    hurt.dmg = 2;
    mend.lanes[0].def.onTurnEnd(mend, mend.lanes[0]);
    expect(hurt.dmg).toBe(0);

    const kyln = mkState(1, [lane("kyln_gate")]);
    await revealLanes(kyln);
    expect(lockedMzZones(kyln, 0)).toEqual([]);
    kyln.turnCount = 5;
    expect(lockedMzZones(kyln, 0)).toEqual([0, 1]);

    const lab = mkState(1, [lane("lockdown_lab")]);
    await revealLanes(lab);
    expect(lockedMzZones(lab, 0)).toEqual([]);
    lab.turnCount = 3;
    expect(lockedMzZones(lab, 0)).toEqual([0, 1]);
    lab.turnCount = 6;
    expect(lockedMzZones(lab, 0)).toEqual([]);

    const milano = mkState(1, [lane("milano_gate")]);
    await revealLanes(milano);
    expect(lockedMzZones(milano, 0)).toEqual([0, 1]);
    milano.turnCount = 5;
    expect(lockedMzZones(milano, 0)).toEqual([]);

    const even = mkState(1, [lane("odd_lock")]);
    even.turnCount = 1;
    await revealLanes(even);
    expect(lockedMzZones(even, 0)).toEqual([]);
    even.turnCount = 2;
    expect(lockedMzZones(even, 0)).toEqual([0, 1]);
  });

  it("third Snap batch: last stand, moon book, rickety, dawn lock, spell crash", async () => {
    const stand = mkState(1, [lane("last_stand")]);
    await revealLanes(stand);
    const fox = addField(stand, 0, "ember_fox", 0);
    expect(getATK(stand, fox)).toBe(1);
    P(stand, 0).lp = 8;
    expect(getATK(stand, fox)).toBe(4);

    const paper = mkState(1, [lane("paper_thin")]);
    await revealLanes(paper);
    const thin = addField(paper, 0, "ember_fox", 0);
    expect(getATK(paper, thin)).toBe(5);

    const moon = mkState(1, [lane("moon_book")]);
    await revealLanes(moon);
    const flipped = addField(moon, 0, "gem_golem", 0);
    moon.lanes[0].def.onSummon(moon, moon.lanes[0], flipped);
    expect(flipped.faceup).toBe(false);

    const swap = mkState(1, [lane("print_swap")]);
    await revealLanes(swap);
    const swapped = addField(swap, 0, "gem_golem", 0);
    swap.lanes[0].def.onSummon(swap, swap.lanes[0], swapped);
    expect(getATK(swap, swapped)).toBe(4);
    expect(getDEF(swap, swapped)).toBe(2);

    const clone = mkState(1, [lane("gy_clone")]);
    await revealLanes(clone);
    const src = addField(clone, 0, "gem_golem", 0);
    clone.lanes[0].def.onSummon(clone, clone.lanes[0], src);
    expect(P(clone, 0).gy.map((c) => c.id)).toEqual(["gem_golem"]);
    expect(src.loc).toBe("mz");

    const shell = mkState(1, [lane("double_shell")]);
    await revealLanes(shell);
    const tank = addField(shell, 0, "gem_golem", 0);
    shell.lanes[0].def.onSummon(shell, shell.lanes[0], tank);
    expect(getDEF(shell, tank)).toBe(8);

    const rickety = mkState(1, [lane("rickety_bridge")]);
    rickety.tp = 0;
    await revealLanes(rickety);
    const left = addField(rickety, 0, "gem_golem", 0);
    const right = addField(rickety, 0, "ember_fox", 1);
    rickety.lanes[0].def.onTurnEnd(rickety, rickety.lanes[0]);
    expect(left.loc).toBe("gy");
    expect(right.loc).toBe("mz");

    const maw = mkState(1, [lane("titan_maw")]);
    maw.tp = 0;
    await revealLanes(maw);
    const weak = addField(maw, 0, "ember_fox", 0);
    const strong = addField(maw, 0, "gem_golem", 1);
    maw.lanes[0].def.onTurnEnd(maw, maw.lanes[0]);
    expect(weak.loc).toBe("gy");
    expect(strong.loc).toBe("mz");

    const crash = mkState(1, [lane("spell_crash")]);
    addSet(crash, 0, "ember_spark", 0);
    addSet(crash, 1, "scroll_greed", 1);
    await revealLanes(crash);
    expect(P(crash, 0).stz[0]).toBeNull();
    expect(P(crash, 1).stz[1]).toBeNull();

    const dawn = mkState(1, [lane("dawn_lock")]);
    dawn.turnCount = 1;
    await revealLanes(dawn);
    expect(lockedMzZones(dawn, 0)).toEqual([0, 1]);
    dawn.turnCount = 2;
    expect(lockedMzZones(dawn, 0)).toEqual([]);

    const split = mkState(1, [lane("split_lock")]);
    await revealLanes(split);
    expect(lockedMzZones(split, 0)).toEqual([1]);

    const late = mkState(1, [lane("late_spell")]);
    await revealLanes(late);
    expect(lockedStzZones(late, 0)).toEqual([]);
    late.turnCount = 4;
    expect(lockedStzZones(late, 0)).toEqual([0, 1]);
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

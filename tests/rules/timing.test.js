// Timing rules: missing the timing, "if" vs "when", mandatory triggers,
// SEGOC, post-2012 priority, summon negation, damage-step windows.
import { describe, it, expect } from "vitest";
import {
  P, performActivation, resolveChain, checkAndRespond, normalSummon,
  conductAttack, sendToGY, pushEvents, monstersOf
} from "../../src/engine/index.js";
import {
  mkState, makeDriver, addHand, addField, addSet, addDeck, logText, handIds
} from "./helpers.js";

describe("missing the timing", () => {
  it("optional 'when' trigger misses when its event is not the last thing (killed at CL2)", async () => {
    const G = mkState(1);
    G.tp = 0;
    const jes = addField(G, 0, "jestling", 0);
    addDeck(G, 0, ["jestling", "gem_golem", "scroll_greed"]);
    const greed = addHand(G, 0, "scroll_greed");
    const spark = addHand(G, 1, "ember_spark");

    const l1 = await performActivation(G, { type: "hand", card: greed, speed: 1 });
    const l2 = await performActivation(G, { type: "hand", card: spark, speed: 2 });
    G.chain = [l1, l2]; // CL2 (spark) kills Jestling, then CL1 (greed) draws
    await resolveChain(G);
    expect(jes.loc).toBe("gy");

    await checkAndRespond(G, { startPlayer: 0 });
    expect(logText(G)).toContain("misses the timing");
    // no replacement summoned — the deck copy stayed put (or was drawn by greed)
    expect(monstersOf(G, 0).length).toBe(0);
  });

  it("optional 'when' trigger misses when discarded as a COST", async () => {
    const G = mkState(1);
    G.tp = 0;
    addField(G, 1, "gem_golem", 0);
    const temp = addHand(G, 0, "lightning_tempest");
    addHand(G, 0, "grinning_echo");
    addDeck(G, 0, ["grinning_echo"]);
    const link = await performActivation(G, { type: "hand", card: temp, speed: 1 });
    G.chain = [link];
    await resolveChain(G);
    await checkAndRespond(G, { startPlayer: 0 });
    expect(logText(G)).toContain("Grinning Echo misses the timing");
    expect(handIds(G, 0)).not.toContain("grinning_echo");
  });

  it("optional 'when' trigger DOES fire when discarded by an effect as the last thing", async () => {
    const G = mkState(1);
    G.tp = 0;
    const surge = addHand(G, 0, "mind_surge");
    const echo = addHand(G, 0, "grinning_echo");
    addDeck(G, 0, ["grinning_echo", "gem_golem"]);
    G.io = makeDriver({
      choose: (p, req) => {
        if (req.kind === "discard") {
          const i = req.uids.findIndex((u) => u === echo.uid);
          return [Math.max(0, i)];
        }
        return req.options.map((_, i) => i);
      }
    });
    const link = await performActivation(G, { type: "hand", card: surge, speed: 2 });
    G.chain = [link];
    await resolveChain(G);
    await checkAndRespond(G, { startPlayer: 0 });
    expect(logText(G)).not.toContain("misses the timing");
    // searched the second copy from the deck
    expect(handIds(G, 0).filter((id) => id === "grinning_echo").length).toBe(1);
  });

  it("mandatory triggers NEVER miss, even as a cost", async () => {
    const G = mkState(1);
    G.tp = 0;
    addField(G, 1, "gem_golem", 0);
    const temp = addHand(G, 0, "lightning_tempest");
    addHand(G, 0, "grinning_echo");
    const maw = addHand(G, 0, "mawling");
    G.io = makeDriver({
      choose: (p, req) => {
        if (req.kind === "cost") {
          const i = req.uids.findIndex((u) => u === maw.uid);
          return [Math.max(0, i)];
        }
        return req.options.map((_, i) => i);
      }
    });
    const link = await performActivation(G, { type: "hand", card: temp, speed: 1 });
    G.chain = [link];
    await resolveChain(G);
    await checkAndRespond(G, { startPlayer: 0 });
    expect(logText(G)).not.toContain("Mawling of the Deep misses");
    expect(P(G, 0).lp).toBe(19);
    expect(P(G, 1).lp).toBe(19);
  });
});

describe("'if' triggers never miss", () => {
  it("Scavenger Wisp searches even when destroyed at CL2", async () => {
    const G = mkState(1);
    G.tp = 0;
    const wisp = addField(G, 0, "scav_wisp", 0);
    addDeck(G, 0, ["chrono_mite", "gem_golem", "scroll_greed"]);
    const greed = addHand(G, 0, "scroll_greed");
    const spark = addHand(G, 1, "ember_spark");
    const l1 = await performActivation(G, { type: "hand", card: greed, speed: 1 });
    const l2 = await performActivation(G, { type: "hand", card: spark, speed: 2 });
    G.chain = [l1, l2];
    await resolveChain(G);
    expect(wisp.loc).toBe("gy");
    await checkAndRespond(G, { startPlayer: 0 });
    expect(logText(G)).not.toContain("misses the timing");
    expect(handIds(G, 0)).toContain("chrono_mite"); // cost <= 2 search
  });
});

describe("SEGOC", () => {
  it("TP mandatory goes on chain before NTP mandatory; resolution is backwards", async () => {
    const G = mkState(1);
    G.tp = 0;
    const maw0 = addField(G, 0, "mawling", 0);
    const maw1 = addField(G, 1, "mawling", 0);
    const evA = sendToGY(G, maw0, { kind: "destroyed" });
    const evB = sendToGY(G, maw1, { kind: "destroyed" });
    pushEvents(G, [evA, evB]);
    await checkAndRespond(G, { startPlayer: 0 });
    const log = logText(G);
    // both fired (mandatory, simultaneous), CL2 resolves before CL1
    expect(log.indexOf("CL2: Mawling of the Deep resolves")).toBeLessThan(log.indexOf("CL1: Mawling of the Deep resolves"));
    expect(P(G, 0).lp).toBe(18);
    expect(P(G, 1).lp).toBe(18);
  });

  it("same-controller simultaneous mandatories ask their controller for chain order", async () => {
    const G = mkState(1);
    G.tp = 0;
    P(G, 0).lp = 15;
    addField(G, 0, "tide_priestess", 0);
    const pixie = addField(G, 0, "dawn_pixie", 1);
    const driver = makeDriver({});
    G.io = driver;
    pushEvents(G, [{ type: "phase", phase: "SP", player: 0 }]);
    await checkAndRespond(G, { startPlayer: 0 });
    // the controller was asked to order their mandatory bucket
    expect(driver.rec.choices.some((c) => c.kind === "triggerOrder")).toBe(true);
    expect(P(G, 0).lp).toBe(17);       // priestess healed 2 (balanced)
    expect(pixie.atkMod).toBe(1);      // pixie grew
  });
});

describe("priority (post-2012)", () => {
  it("no ignition-effect priority: summon into a set quick-play dies before its effect can start", async () => {
    const G = mkState(1);
    G.tp = 0;
    G.turnCount = 1;
    addSet(G, 1, "tidal_snare", 0, 0);
    const novice = addHand(G, 0, "doomblade_novice");
    G.io = makeDriver({
      askChain: (p, legal) => {
        if (p === 0 && legal.length) {
          throw new Error("turn player was offered a response to their own summon — ignition priority should not exist");
        }
        const i = legal.findIndex((a) => a.card.def.id === "tidal_snare");
        return i >= 0 ? i : null;
      }
    });
    await normalSummon(G, novice);
    expect(novice.loc).toBe("gy");
    expect(logText(G)).toContain("Tidal Snare");
  });
});

describe("summon negation", () => {
  it("Final Edict negates the summon; the monster never hits the field and triggers nothing", async () => {
    const G = mkState(1);
    G.tp = 0;
    addSet(G, 1, "final_edict", 0, 0);
    const kraken = addHand(G, 0, "kraken");
    const t1 = addField(G, 0, "ember_fox", 0);
    const t2 = addField(G, 0, "ember_fox", 1);
    const p1HandBefore = P(G, 1).hand.length;
    G.io = makeDriver({
      askChain: (p, legal) => {
        const i = legal.findIndex((a) => a.card.def.id === "final_edict");
        return i >= 0 ? i : null;
      }
    });
    await normalSummon(G, kraken, null, [t1.uid, t2.uid]);
    expect(kraken.loc).toBe("gy");
    expect(monstersOf(G, 0).length).toBe(0);
    expect(P(G, 1).hand.length).toBe(p1HandBefore); // kraken's summon trigger never fired
    expect(logText(G)).toContain("summon is negated");
  });
});

describe("damage step", () => {
  it("surge effect during damage calculation flips the battle outcome", async () => {
    const G = mkState(1);
    G.tp = 0;
    G.turnCount = 5;
    const golem = addField(G, 0, "gem_golem", 0);       // 2/4
    const sprite = addField(G, 1, "shield_sprite", 0);  // 1/3
    const surge = addHand(G, 0, "surge_imp");
    G.io = makeDriver({
      askChain: (p, legal, chain, extra) => {
        if (extra?.damageCalc && p === 0) {
          const i = legal.findIndex((a) => a.type === "handQuick");
          return i >= 0 ? i : null;
        }
        return null;
      }
    });
    await conductAttack(G, golem, sprite.uid);
    expect(sprite.loc).toBe("gy");   // 2+3 = 5 damage kills the 3-DEF sprite
    expect(golem.dmg).toBe(1);       // sprite still dealt 1 back
    expect(surge.loc).toBe("gy");    // discarded as cost
  });

  it("without the surge the defender survives", async () => {
    const G = mkState(1);
    G.tp = 0;
    G.turnCount = 5;
    const golem = addField(G, 0, "gem_golem", 0);
    const sprite = addField(G, 1, "shield_sprite", 0);
    await conductAttack(G, golem, sprite.uid);
    expect(sprite.loc).toBe("mz");
    expect(sprite.dmg).toBe(2);
    expect(golem.dmg).toBe(1);
  });
});

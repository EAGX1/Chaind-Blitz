import { describe, it, expect } from "vitest";
import { BRONZE_CARDS } from "../../src/data/cards/bronze.js";
import {
  newRun, genMap, allNodes, openNodes, canEnter, enterNode, clearCurrent,
  resolveBattle, foeLpBonus, openCardReward, pickReward, rollCardChoices,
  openRelicReward, pickRelic, hasRelic, duelMods, RELICS,
  openRest, applyRest, restHealAmount,
  openShop, buyShopCard, buyShopRelic, buyShopRemove, leaveShop,
  openEvent, applyEvent, EVENTS, runMetaRewards, RUN_LP
} from "../../src/meta/rogue.js";
import { makeRng } from "../../src/engine/rng.js";

describe("roguelike run core", () => {
  it("newRun: 20-card deck, 20 HP, 6-column map with boss last", () => {
    const run = newRun(42);
    expect(run.deck).toHaveLength(20);
    expect(run.hp).toBe(RUN_LP);
    expect(run.map).toHaveLength(6);
    expect(run.map[5][0].type).toBe("boss");
    expect(openNodes(run).length).toBe(run.map[0].length);
  });

  it("map is fully connected: every node reachable from column 0", () => {
    for (const seed of [1, 7, 99, 12345]) {
      const run = newRun(seed);
      const nodes = allNodes(run);
      const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
      const seen = new Set();
      const queue = run.map[0].map((n) => n.id);
      while (queue.length) {
        const id = queue.shift();
        if (seen.has(id)) continue;
        seen.add(id);
        queue.push(...byId[id].next);
      }
      expect(seen.size).toBe(nodes.length);
    }
  });

  it("genMap deterministic for same seed", () => {
    const a = genMap(makeRng(5)).flat().map((n) => `${n.id}:${n.type}:${n.next.join(",")}`);
    const b = genMap(makeRng(5)).flat().map((n) => `${n.id}:${n.type}:${n.next.join(",")}`);
    expect(a).toEqual(b);
  });

  it("can only enter open nodes; entry locks others behind progression", () => {
    const run = newRun(3);
    const boss = run.map[5][0];
    expect(canEnter(run, boss.id)).toBe(false);
    const first = run.map[0][0];
    expect(canEnter(run, first.id)).toBe(true);
    enterNode(run, first.id);
    expect(run.current).toBe(first.id);
    // entering blocks entering anything else
    expect(canEnter(run, run.map[0][1].id)).toBe(false);
    clearCurrent(run);
    expect(run.current).toBe(null);
    expect(first.state).toBe("cleared");
    // at least one col-1 node opened
    expect(run.map[1].some((n) => n.state === "open")).toBe(true);
  });

  it("battle win carries HP forward, pays gold, increments floor", () => {
    const run = newRun(11);
    enterNode(run, run.map[0][0].id);
    const goldBefore = run.gold;
    const r = resolveBattle(run, { won: true, lpLeft: 13 });
    expect(r.reward).toBe("card");
    expect(run.hp).toBe(13);
    expect(run.floor).toBe(1);
    expect(run.gold).toBeGreaterThan(goldBefore);
    expect(run.over).toBe(false);
  });

  it("battle loss ends the run", () => {
    const run = newRun(11);
    enterNode(run, run.map[0][0].id);
    resolveBattle(run, { won: false, lpLeft: 0 });
    expect(run.over).toBe(true);
    expect(run.won).toBe(false);
  });

  it("elite pays more gold than battle; boss win completes the run", () => {
    const run = newRun(11);
    run.gold = 0;
    enterNode(run, run.map[0][0].id);
    resolveBattle(run, { won: true, lpLeft: 20 });
    const battleGold = run.gold;
    expect(battleGold).toBe(18);
    clearCurrent(run); // UI claims the card reward, which clears the node
    // force an elite node current
    const elite = allNodes(run).find((n) => n.type === "elite");
    elite.state = "open";
    enterNode(run, elite.id);
    const goldBefore = run.gold;
    resolveBattle(run, { won: true, lpLeft: 20 });
    expect(run.gold - goldBefore).toBe(30);
    expect(foeLpBonus(elite)).toBe(6);
    // boss
    clearCurrent(run);
    const boss = run.map[5][0];
    boss.state = "open";
    enterNode(run, boss.id);
    expect(foeLpBonus(boss)).toBe(10);
    resolveBattle(run, { won: true, lpLeft: 8 });
    expect(run.over).toBe(true);
    expect(run.won).toBe(true);
  });

  it("card rewards: 3 unique choices from pool; hunter's eye makes 4", () => {
    const run = newRun(77);
    const choices = rollChoices(run);
    expect(choices).toHaveLength(3);
    expect(new Set(choices).size).toBe(3);
    for (const id of choices) expect(BRONZE_CARDS.some((d) => d.id === id)).toBe(true);
    run.relics.push("hunter_eye");
    expect(rollChoices(run)).toHaveLength(4);
    function rollChoices(r) { return rollCardChoices(r, BRONZE_CARDS); }
  });

  it("pickReward adds card to deck and clears the node", () => {
    const run = newRun(5);
    enterNode(run, run.map[0][0].id);
    resolveBattle(run, { won: true, lpLeft: 18 });
    openCardReward(run, BRONZE_CARDS);
    const before = run.deck.length;
    const pick = run.pendingReward.choices[0];
    expect(pickReward(run, pick)).toBe(true);
    expect(run.deck).toHaveLength(before + 1);
    expect(run.deck.at(-1)).toBe(pick);
    expect(run.pendingReward).toBe(null);
    expect(run.current).toBe(null);
  });

  it("relic pickup applies onPickup; duelMods accumulate", () => {
    const run = newRun(9);
    run.relics.push("vital_core");
    RELICS.vital_core.onPickup(run);
    expect(run.maxHp).toBe(RUN_LP + 6);
    run.relics.push("swift_boots", "iron_aegis");
    const mods = duelMods(run);
    expect(mods.extraDraw).toBe(1);
    expect(mods.lpBonus).toBe(4);
  });

  it("elite relic reward: pickRelic grants and clears node", () => {
    const run = newRun(21);
    enterNode(run, run.map[0][0].id);
    openRelicReward(run);
    expect(run.pendingRelic.choices.length).toBeGreaterThan(0);
    const id = run.pendingRelic.choices[0];
    expect(pickRelic(run, id)).toBe(true);
    expect(hasRelic(run, id)).toBe(true);
    expect(run.current).toBe(null);
  });

  it("rest heals 30% of max HP; remove purges a card; purge stone allows both", () => {
    const run = newRun(31);
    run.hp = 10;
    expect(restHealAmount(run)).toBe(6);
    openRest(run);
    expect(applyRest(run, { heal: true })).toBe(true);
    expect(run.hp).toBe(16);
    expect(run.pendingRest).toBe(false);
    // remove path
    openRest(run);
    const n = run.deck.length;
    expect(applyRest(run, { removeIdx: 0 })).toBe(true);
    expect(run.deck).toHaveLength(n - 1);
    // purge stone: both in one visit
    run.relics.push("purge_stone");
    run.hp = 10;
    openRest(run);
    const m = run.deck.length;
    expect(applyRest(run, { heal: true, removeIdx: 0 })).toBe(true);
    expect(run.hp).toBe(16);
    expect(run.deck).toHaveLength(m - 1);
    expect(run.pendingRest).toBe(false);
  });

  it("shop: stock, buy card/relic/remove, prices respect lucky coin", () => {
    const run = newRun(51);
    run.gold = 500;
    openShop(run, BRONZE_CARDS);
    const s = run.pendingShop;
    expect(s.cards).toHaveLength(3);
    expect(s.relic).toBeTruthy();
    const deckN = run.deck.length;
    expect(buyShopCard(run, 0)).toBe(true);
    expect(run.deck).toHaveLength(deckN + 1);
    expect(buyShopCard(run, 0)).toBe(false); // sold out
    expect(buyShopRelic(run)).toBe(true);
    expect(run.relics).toHaveLength(1);
    expect(buyShopRemove(run, 0)).toBe(true);
    expect(run.deck).toHaveLength(deckN); // +1 card, -1 removed
    expect(leaveShop(run)).toBe(true);
    expect(run.pendingShop).toBe(null);
  });

  it("lucky coin discounts shop prices by 25%", () => {
    const run = newRun(52);
    run.relics.push("lucky_coin");
    openShop(run, BRONZE_CARDS);
    expect(run.pendingShop.removePrice).toBe(Math.round(25 * 0.75));
  });

  it("events: every option resolves and clears the node", () => {
    for (const evId of Object.keys(EVENTS)) {
      for (let i = 0; i < EVENTS[evId].options.length; i++) {
        const run = newRun(61);
        run.gold = 50;
        enterNode(run, run.map[0][0].id);
        run.pendingEvent = evId;
        expect(applyEvent(run, i, BRONZE_CARDS)).toBe(true);
        expect(run.pendingEvent).toBe(null);
        expect(run.current).toBe(null);
      }
    }
  });

  it("run meta rewards: win pays 300 gems + 2 packs, claim once", () => {
    const run = newRun(71);
    run.won = true; run.over = true;
    const rw = runMetaRewards(run);
    expect(rw).toEqual({ gems: 300, packs: 2 });
    expect(runMetaRewards(run)).toBe(null);
    // losing run pays per floor
    const run2 = newRun(72);
    run2.floor = 5; run2.over = true;
    expect(runMetaRewards(run2)).toEqual({ gems: 50, packs: 1 });
    const run3 = newRun(73);
    run3.floor = 2; run3.over = true;
    expect(runMetaRewards(run3)).toEqual({ gems: 20, packs: 0 });
  });

  it("run state survives JSON round-trip (localStorage shape)", () => {
    const run = newRun(81);
    enterNode(run, run.map[0][0].id);
    resolveBattle(run, { won: true, lpLeft: 15 });
    openCardReward(run, BRONZE_CARDS);
    const clone = JSON.parse(JSON.stringify(run));
    expect(clone.pendingReward.choices).toEqual(run.pendingReward.choices);
    expect(clone.hp).toBe(15);
    expect(clone.map).toEqual(run.map);
  });
});

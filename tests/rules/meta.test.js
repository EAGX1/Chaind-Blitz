// Meta systems: packs, pity, crafting, pool gating, ranked LP/promos, saves.
import { describe, it, expect, beforeEach } from "vitest";
import { makeRng } from "../../src/engine/rng.js";
import { freshProfile, saveProfile, loadProfile, resetProfile } from "../../src/meta/profile.js";
import { needsStarterPick, DEV_WALLET, ownedCardDefs } from "../../src/meta/campaign.js";
import { openPack, grantCards } from "../../src/meta/packs.js";
import { craft, dismantle, canCraft, CRAFT_COST, DISMANTLE_VALUE } from "../../src/meta/crafting.js";
import { applyDuelMissions, rollDailies, claim, missionStatus } from "../../src/meta/missions.js";
import { clearLab, isLabCleared, allLabsCleared, isFirstFarer, LABS, puzzleOfTheDay, claimPuzzleToday } from "../../src/meta/labs.js";
import { describeReplayAction } from "../../src/meta/replay.js";
import { localDate } from "../../src/meta/loginCalendar.js";
import { applyRankedResult, rankLabel, WIN_LP } from "../../src/meta/ranked.js";
import { poolForTier } from "../../src/meta/pools.js";
import { BRONZE_DB } from "../../src/data/cards/bronze.js";
import {
  ALL_CARDS, BRONZE_CARDS, WAVE_C_CARDS, WAVE_D_CARDS, WAVE_E_CARDS,
  WAVE_F_CARDS, WAVE_G_CARDS, SILVER_CARDS, GOLD_CARDS, PLATINUM_CARDS, EXTRA_CARDS
} from "../../src/data/cards/index.js";
import { GATES, clearGate, isUnlocked, checklist } from "../../src/meta/soloGates.js";
import { asSavedDeck, copyLimit, setCopyLimit, validateDeck, banlistFromPreset, ADVANCED_COPIES } from "../../src/meta/banlist.js";
import { shippedLoaners } from "../../src/data/loaners.js";
import { STARTERS } from "../../src/data/starters.js";

// localStorage shim for node
beforeEach(() => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };
});

describe("packs", () => {
  it("opens 10 cards from the pool, all valid ids", () => {
    const rng = makeRng(3);
    const pool = poolForTier(0);
    const p = freshProfile();
    const cards = openPack(rng, pool, p);
    expect(cards.length).toBe(10);
    for (const c of cards) expect(BRONZE_DB[c.id]).toBeTruthy();
  });

  it("last slot is R+ and pity forces a UR within 10 packs", () => {
    const pool = poolForTier(0);
    const p = freshProfile();
    p.packPity = 9;
    const cards = openPack(makeRng(11), pool, p);
    expect(cards.some((c) => c.rarity === "UR")).toBe(true);
    expect(p.packPity).toBe(0);
  });

  it("grantCards respects the collection", () => {
    const p = freshProfile();
    const before = p.collection["starfall"] || 0;
    grantCards(p, [BRONZE_DB["starfall"], BRONZE_DB["starfall"]]);
    expect(p.collection["starfall"]).toBe(before + 2);
  });
});

describe("crafting", () => {
  it("three dusted cards of a rarity craft one card of that rarity", () => {
    const p = freshProfile();
    p.collection["shield_sprite"] = 4; // N — one spare
    p.collection["gem_golem"] = 4;
    p.collection["stoneback"] = 4;
    for (const id of ["shield_sprite", "gem_golem", "stoneback"]) {
      expect(dismantle(p, BRONZE_DB[id], true)).toBe(true); // keep playset
    }
    expect(p.dust.N).toBe(3 * DISMANTLE_VALUE);
    expect(p.dust.N).toBe(CRAFT_COST);
    expect(canCraft(p, BRONZE_DB["chrono_mite"])).toBe(true); // N craft from N dust
    const before = p.collection["chrono_mite"] || 0;
    expect(craft(p, BRONZE_DB["chrono_mite"])).toBe(true);
    expect(p.collection["chrono_mite"]).toBe(before + 1);
    expect(p.dust.N).toBe(0);
  });

  it("keeps the playset when asked", () => {
    const p = freshProfile();
    p.collection["shield_sprite"] = 3;
    expect(dismantle(p, BRONZE_DB["shield_sprite"], true)).toBe(false);
  });
});

describe("pool gating", () => {
  const uniqueIds = (...sets) => {
    const seen = new Set();
    for (const s of sets) for (const c of s) seen.add(c.id);
    return seen.size;
  };
  it("bronze pool is exactly 60 cards", () => {
    expect(poolForTier(0).length).toBe(60);
  });
  it("ranked pools ramp until Diamond equals the full unique catalog; Master is prestige", () => {
    const expected = [
      uniqueIds(BRONZE_CARDS),
      uniqueIds(BRONZE_CARDS, WAVE_C_CARDS, SILVER_CARDS, WAVE_G_CARDS),
      uniqueIds(BRONZE_CARDS, WAVE_C_CARDS, SILVER_CARDS, WAVE_G_CARDS, WAVE_D_CARDS, GOLD_CARDS),
      uniqueIds(BRONZE_CARDS, WAVE_C_CARDS, SILVER_CARDS, WAVE_G_CARDS, WAVE_D_CARDS, GOLD_CARDS, WAVE_E_CARDS, EXTRA_CARDS, PLATINUM_CARDS),
      uniqueIds(BRONZE_CARDS, WAVE_C_CARDS, SILVER_CARDS, WAVE_G_CARDS, WAVE_D_CARDS, GOLD_CARDS, WAVE_E_CARDS, EXTRA_CARDS, PLATINUM_CARDS, WAVE_F_CARDS),
      uniqueIds(BRONZE_CARDS, WAVE_C_CARDS, SILVER_CARDS, WAVE_G_CARDS, WAVE_D_CARDS, GOLD_CARDS, WAVE_E_CARDS, EXTRA_CARDS, PLATINUM_CARDS, WAVE_F_CARDS),
    ];
    const uniqueAll = uniqueIds(ALL_CARDS);
    const sizes = [0, 1, 2, 3, 4, 5].map((t) => poolForTier(t).length);
    expect(sizes[0]).toBe(60);
    expect(sizes).toEqual(expected);
    for (let t = 1; t <= 4; t++) {
      expect(sizes[t]).toBeGreaterThan(sizes[t - 1]);
    }
    expect(sizes[4]).toBe(uniqueAll);
    expect(sizes[5]).toBe(uniqueAll);
  });

  it("starter staples are in the Silver pool so new players can craft them", () => {
    const silver = new Set(poolForTier(1).map((c) => c.id));
    for (const id of ["veil_needle", "helix_shot", "ash_whisper", "twin_cut", "equal_cut"]) {
      expect(silver.has(id), id).toBe(true);
    }
  });

  it("mill package, token support, and the new fusions are in the pools", () => {
    const silver = new Set(poolForTier(1).map((c) => c.id));
    for (const id of ["mill_lantern", "mill_angler", "deep_current", "hollow_tax", "sudden_maw", "trapdoor_queen", "token_sprouter"]) {
      expect(silver.has(id), id).toBe(true);
    }
    const plat = new Set(poolForTier(3).map((c) => c.id));
    for (const id of ["fusion_deep_hollow", "fusion_trapdoor_fiend", "fusion_grave_jester", "fusion_worldroot",
      "fusion_cinder_archon", "fusion_warden_titan", "fusion_rush_general", "fusion_storm_caller"]) {
      expect(plat.has(id), id).toBe(true);
    }
  });
});

describe("solo gates", () => {
  it("ships six sequential hour-1 gates", () => {
    expect(GATES).toHaveLength(6);
    expect(GATES.map((g) => g.id)).toEqual(["gate1", "gate2", "gate3", "gate4", "gate5", "gate6"]);
    const p = freshProfile();
    expect(checklist(p)).toHaveLength(6);
    expect(isUnlocked(p, "gate1")).toBe(true);
    expect(isUnlocked(p, "gate5")).toBe(false);
    expect(clearGate(p, "gate1").ok).toBe(true);
    expect(clearGate(p, "gate2").ok).toBe(true);
    expect(clearGate(p, "gate3").ok).toBe(true);
    expect(clearGate(p, "gate4").ok).toBe(true);
    expect(isUnlocked(p, "gate5")).toBe(true);
    expect(isUnlocked(p, "gate6")).toBe(false);
    expect(clearGate(p, "gate5").ok).toBe(true);
    expect(isUnlocked(p, "gate6")).toBe(true);
  });
});

describe("ranked", () => {
  it("accumulates LP and starts a promo at 100", () => {
    const p = freshProfile();
    for (let i = 0; i < 5; i++) applyRankedResult(p, true);
    expect(p.rank.promo).toBeTruthy();
    expect(rankLabel(p)).toContain("PROMO");
  });

  it("promo Bo3: 2 wins tiers you up and expands the pool", () => {
    const p = freshProfile();
    p.rank.lp = 100;
    p.rank.promo = { wins: 1, losses: 0 };
    const out = applyRankedResult(p, true);
    expect(out.tierUp).toBe(true);
    expect(p.rank.tier).toBe(1);
    expect(p.rank.lp).toBe(0);
    expect(rankLabel(p)).toContain("Silver");
  });

  it("promo failure drops back to 60 LP", () => {
    const p = freshProfile();
    p.rank.promo = { wins: 0, losses: 1 };
    const out = applyRankedResult(p, false);
    expect(out.promoLost).toBe(true);
    expect(p.rank.lp).toBe(60);
    expect(p.rank.tier).toBe(0);
  });

  it("LP never goes below 0 (tier floor)", () => {
    const p = freshProfile();
    applyRankedResult(p, false);
    expect(p.rank.lp).toBe(0);
  });

  it(`win grants ${WIN_LP} LP`, () => {
    const p = freshProfile();
    const out = applyRankedResult(p, true);
    expect(out.lpDelta).toBe(WIN_LP);
    expect(p.rank.lp).toBe(WIN_LP);
  });
});

describe("saves", () => {
  it("profile round-trips through localStorage", () => {
    const p = freshProfile();
    p.gems = 1234;
    p.collection["starfall"] = 3;
    saveProfile(p);
    const loaded = loadProfile();
    expect(loaded.gems).toBe(1234);
    expect(loaded.collection["starfall"]).toBe(3);
  });
});

describe("campaign start + dev account", () => {
  it("a new profile has no full collection and needs a starter pick", () => {
    const p = freshProfile();
    expect(p.starterId).toBeNull();
    expect(Object.keys(p.collection)).toHaveLength(0);
    expect(p.gems).toBe(600);
    expect(needsStarterPick(p)).toBe(true);
  });

  it("choosing Ignis grants that list only and saves the deck", () => {
    const p = freshProfile({ starter: "ignis" });
    expect(p.starterId).toBe("ignis");
    expect(p.collection.ember_fox).toBe(3);
    expect(p.decks["Ignis Rush"].main).toHaveLength(40);
    expect(p.collection.tide_caller || 0).toBe(0);
    expect(p.collection.moss_sprite || 0).toBe(0);
  });

  it("sandbox still grants playsets for tests", () => {
    const p = freshProfile({ sandbox: true });
    expect(p.starterId).toBe("sandbox");
    expect(p.collection.starfall).toBe(3);
  });

  it("migrate does not refill every card to 3", () => {
    const p = freshProfile({ starter: "terra" });
    saveProfile(p);
    const loaded = loadProfile();
    expect(loaded.collection.ember_fox || 0).toBe(0);
    expect(loaded.collection.moss_sprite).toBe(3);
    expect(loaded.starterId).toBe("terra");
  });

  it("old full-collection saves skip the starter picker", () => {
    const collection = {};
    for (let i = 0; i < 200; i++) collection[`pad_${i}`] = 1;
    saveProfile({ version: 1, collection, gems: 50 });
    const loaded = loadProfile();
    expect(loaded.starterId).toBe("legacy");
    expect(needsStarterPick(loaded)).toBe(false);
  });

  it("dev cheats refill the wallet on save", () => {
    const p = freshProfile({ starter: "ignis" });
    p.devCheats = true;
    p.gems = 12;
    saveProfile(p);
    expect(p.gems).toBe(DEV_WALLET.gems);
    expect(p.coins).toBe(DEV_WALLET.coins);
  });

  it("resetProfile returns to an empty new-game save", () => {
    const p = resetProfile();
    expect(p.starterId).toBeNull();
    expect(Object.keys(p.collection)).toHaveLength(0);
    expect(p.gems).toBe(600);
  });

  it("resetProfile wipes a live profile object so a later save cannot restore the old binder", () => {
    const live = freshProfile({ sandbox: true });
    expect(Object.keys(live.collection).length).toBeGreaterThan(100);
    resetProfile({ into: live });
    expect(live.starterId).toBeNull();
    expect(Object.keys(live.collection)).toHaveLength(0);
    expect(loadProfile().collection.starfall || 0).toBe(0);
  });

  it("ownedCardDefs only returns cards with copies", () => {
    const p = freshProfile({ starter: "ignis" });
    const catalog = [
      { id: "ember_fox", name: "Ember Fox" },
      { id: "tide_caller", name: "Tide Caller" }
    ];
    const owned = ownedCardDefs(p, catalog).map((c) => c.id);
    expect(owned).toEqual(["ember_fox"]);
  });
});

describe("banlist + saved decks", () => {
  it("asSavedDeck reads legacy arrays and { main, extra }", () => {
    expect(asSavedDeck(["a", "b"])).toEqual({ main: ["a", "b"], extra: [] });
    expect(asSavedDeck({ main: ["a"], extra: ["fusion_ember_drake"] })).toEqual({
      main: ["a"], extra: ["fusion_ember_drake"]
    });
  });

  it("copy caps are 0 forbidden, 1/2 limited, 3 normal", () => {
    const custom = setCopyLimit(banlistFromPreset("unlimited"), "ember_fox", 1);
    expect(copyLimit("ember_fox", "Advanced", custom)).toBe(1);
    expect(copyLimit("ember_fox", "Unlimited", custom)).toBe(3);
    const banned = setCopyLimit(custom, "ember_fox", 0);
    expect(copyLimit("ember_fox", "Advanced", banned)).toBe(0);
    const playset = setCopyLimit(banned, "ember_fox", 3);
    expect(copyLimit("ember_fox", "Advanced", playset)).toBe(3);
  });

  it("validateDeck applies the active copy cap across main + extra", () => {
    const loaner = shippedLoaners()[0];
    expect(validateDeck({ main: loaner.deck, extra: loaner.extra }, "Advanced", banlistFromPreset("advanced")).ok).toBe(true);
    const limited = { preset: "custom", copies: { [loaner.deck[0]]: 1 } };
    const doubled = { main: [...loaner.deck], extra: loaner.extra };
    const id = loaner.deck[0];
    if (doubled.main.filter((x) => x === id).length >= 2) {
      expect(validateDeck(doubled, "Advanced", limited).ok).toBe(false);
    }
    expect(validateDeck(doubled, "Unlimited", limited).ok).toBe(true);
  });

  it("Advanced limits Wave G bombs and their unlimited peers to 1; Unlimited does not", () => {
    const advanced = banlistFromPreset("advanced");
    for (const id of ["both_boards", "scream_home", "research_burn", "empty_sky", "tactic_choice", "starfall",
      "cyclone_break", "flood_verdict", "charge_fool", "ion_shuffle", "heart_claim", "alloy_core"]) {
      expect(ADVANCED_COPIES[id]).toBe(1);
      expect(copyLimit(id, "Advanced", advanced)).toBe(1);
      expect(copyLimit(id, "Unlimited", advanced)).toBe(3);
    }
    const three = { main: ["both_boards", "both_boards", "both_boards"], extra: [] };
    expect(validateDeck(three, "Advanced", advanced).errors.some((e) => e.includes("both_boards"))).toBe(true);
    expect(validateDeck(three, "Unlimited", advanced).errors.some((e) => e.includes("both_boards"))).toBe(false);
  });

  it("migrate refreshes shipped Advanced copies without touching Unlimited", () => {
    saveProfile({
      version: 1,
      starterId: "legacy",
      collection: { ember_fox: 3 },
      banlist: { preset: "advanced", copies: { starfall: 1 } }
    });
    expect(loadProfile().banlist.copies.research_burn).toBe(1);
    expect(loadProfile().banlist.copies.empty_sky).toBe(1);
    saveProfile({
      version: 1,
      starterId: "legacy",
      collection: { ember_fox: 3 },
      banlist: { preset: "unlimited", copies: {} }
    });
    expect(loadProfile().banlist.preset).toBe("unlimited");
    expect(loadProfile().banlist.copies.research_burn).toBeUndefined();
  });
});

describe("economy tuning + seasons", () => {
  it("duel rewards are a trickle; the 10th win pays a pack", async () => {
    const { duelRewards } = await import("../../src/meta/rewards.js");
    const p = freshProfile();
    expect(duelRewards(p, { won: true, mode: "ranked" }).gems).toBe(18);
    expect(duelRewards(p, { won: true, mode: "pve" }).gems).toBe(10);
    p.stats.wins = 9;
    expect(duelRewards(p, { won: true, mode: "pve" }).pack).toBe(true);
  });

  it("loaners cannot queue ranked; starters and customs can", async () => {
    const { tryQueueDeck } = await import("../../src/ui/deckDoor.js");
    const loaners = shippedLoaners();
    const ctx = { starters: STARTERS, loaners, decks: {}, profile: freshProfile() };
    expect(tryQueueDeck(`loaner:${loaners[0].id}`, { ...ctx, ranked: true }).ok).toBe(false);
    expect(tryQueueDeck("starter:ignis", { ...ctx, ranked: true }).ok).toBe(true);
    expect(tryQueueDeck(`loaner:${loaners[0].id}`, ctx).ok).toBe(true);
  });

  it("season roll resets the pass and soft-resets the ladder, idempotently", async () => {
    const { ensureDuelPass, TRACK, currentSeasonId } = await import("../../src/meta/duelPass.js");
    const { ensureSeason } = await import("../../src/meta/ranked.js");
    expect(TRACK.length).toBe(30);
    const p = freshProfile();
    p.rank.tier = 5;
    p.rank.lp = 40;
    p.rank.seasonId = "2000-01";
    p.duelPass = { seasonId: "2000-01", xp: 500, claimed: [1, 2] };
    expect(ensureSeason(p)).toBe(true);
    expect(p.rank.tier).toBe(3);
    expect(p.rank.lp).toBe(0);
    expect(p.rank.promo).toBeNull();
    ensureDuelPass(p);
    expect(p.duelPass.xp).toBe(0);
    expect(p.duelPass.claimed).toEqual([]);
    expect(p.duelPass.seasonId).toBe(currentSeasonId());
    expect(ensureSeason(p)).toBe(false);
  });

  it("fresh profiles stamp the current season without a reset", async () => {
    const { currentSeasonId } = await import("../../src/meta/duelPass.js");
    const p = freshProfile();
    expect(p.rank.seasonId).toBe(currentSeasonId());
  });

  it("dust shop converts coins to dust and respects the price", async () => {
    const { buyDustWithCoins, DUST_SHOP, DUST_SHOP_AMOUNT } = await import("../../src/meta/crafting.js");
    const p = freshProfile();
    p.coins = 1000;
    expect(buyDustWithCoins(p, "SR")).toBe(true);
    expect(p.dust.SR).toBe(DUST_SHOP_AMOUNT);
    expect(p.coins).toBe(1000 - DUST_SHOP.SR);
    p.coins = 0;
    expect(buyDustWithCoins(p, "N")).toBe(false);
  });
});

describe("effect icons", () => {  it("tags draw / heal / burn / negate from printed text", async () => {
    const { effectsOf } = await import("../../src/data/effectTags.js");
    const { CARD_DB } = await import("../../src/data/cards/index.js");
    const ids = (def) => effectsOf(def).map((t) => t.id);
    expect(ids(CARD_DB.heal_bloom)).toContain("heal");
    expect(ids(CARD_DB.ember_spark)).toContain("burn");
    expect(ids(CARD_DB.null_seal)).toContain("negate");
    expect(ids(CARD_DB.scroll_greed)).toContain("draw");
    expect(ids(CARD_DB.fusion_ember_drake)).toContain("fusion");
  });
});

describe("missions fire on real events", () => {
  it("applyDuelMissions increments evolve / fusion / chain achievements", () => {
    const p = freshProfile();
    rollDailies(p);
    applyDuelMissions(p, { stats: { evolutions: 2, fusions: 1, chainsResolved: 3 } });
    expect(p.missions.progress.a_evolve_10).toBe(2);
    expect(p.missions.progress.a_fusion_5).toBe(1);
  });

  it("opening a pack and crafting bump those events", () => {
    const p = freshProfile();
    p.missions.dailies = [
      { id: "d_pack", event: "pack", goal: 1, label: "pack" },
      { id: "d_craft", event: "craft", goal: 1, label: "craft" },
      { id: "d_win1", event: "win", goal: 1, label: "win" }
    ];
    p.missions.rolledOn = localDate();
    p.missions.progress = {};
    openPack(makeRng(3), poolForTier(0), p);
    expect(p.missions.progress.d_pack).toBe(1);
    expect(p.missions.progress.a_packs_10).toBe(1);
    p.dust.N = CRAFT_COST;
    expect(craft(p, BRONZE_DB.chrono_mite)).toBe(true);
    expect(p.missions.progress.d_craft).toBe(1);
  });

  it("achievements can be claimed once when the goal is met", () => {
    const p = freshProfile();
    rollDailies(p);
    p.missions.progress.a_first_win = 1;
    const coins = p.coins || 0;
    const r = claim(p, "a_first_win");
    expect(r.ok).toBe(true);
    expect(p.coins).toBeGreaterThan(coins);
    expect(claim(p, "a_first_win").ok).toBe(false);
    const row = missionStatus(p).achievements.find((a) => a.id === "a_first_win");
    expect(row.claimed).toBe(true);
    expect(row.done).toBe(true);
  });
});

describe("labs rewards", () => {
  it("clearLab pays once", () => {
    const p = freshProfile();
    const coins = p.coins || 0;
    const r = clearLab(p, "labs_fanfare");
    expect(r.ok).toBe(true);
    expect(p.coins).toBe(coins + 40);
    expect(isLabCleared(p, "labs_fanfare")).toBe(true);
    expect(clearLab(p, "labs_fanfare").already).toBe(true);
  });

  it("First Farer pays once when every Lab is cleared", () => {
    const p = freshProfile();
    const coins = p.coins || 0;
    const gems = p.gems || 0;
    for (let i = 0; i < LABS.length - 1; i++) {
      const r = clearLab(p, LABS[i].id);
      expect(r.ok).toBe(true);
      expect(r.firstFarer).toBe(false);
    }
    expect(allLabsCleared(p)).toBe(false);
    const last = clearLab(p, LABS[LABS.length - 1].id);
    expect(last.ok).toBe(true);
    expect(last.firstFarer).toBe(true);
    expect(allLabsCleared(p)).toBe(true);
    expect(isFirstFarer(p)).toBe(true);
    const labCoins = LABS.reduce((n, l) => n + (l.reward?.coins || 0), 0);
    expect(p.coins).toBe(coins + labCoins + 120);
    expect(p.gems).toBe(gems + 20);
  });

  it("puzzle of the day is stable for a date and pays once", () => {
    const day = new Date(2026, 7, 13);
    const a = puzzleOfTheDay(day);
    const b = puzzleOfTheDay(day);
    expect(a.id).toBe(b.id);
    expect(LABS.some((l) => l.id === a.id)).toBe(true);
    const p = freshProfile();
    const coins = p.coins || 0;
    const r = claimPuzzleToday(p, day);
    expect(r.ok).toBe(true);
    expect(p.coins).toBe(coins + 25);
    expect(claimPuzzleToday(p, day).already).toBe(true);
  });
});

describe("readable duel log tiles", () => {
  it("describes a Normal Summon in player English", () => {
    const line = describeReplayAction({
      action: { type: "chooseMain", player: 0, pick: { type: "summon", name: "Ember Fox" } }
    });
    expect(line).toBe("You Normal Summon Ember Fox");
  });
});

import { describe, it, expect } from "vitest";
import { mkState, addHand, addField, addGy, addSet, addDeck, makeDriver } from "./helpers.js";
import {
  legalMainActions, normalSummon, specialSummon, placeMonster, P,
  serializeGame, deserializeGame, dealDamageToPlayer, applyComebackChoice,
  wardBlockers, hasKeyword, legalContactFusions, contactFusionSummon, makeCard,
  legalGyFusions, monsterLevel, tributesNeeded
} from "../../src/engine/index.js";
import { WAVE_E_CARDS } from "../../src/data/cards/waveE.js";
import { WAVE_F_CARDS } from "../../src/data/cards/waveF.js";
import { WAVE_G_CARDS } from "../../src/data/cards/waveG.js";
import { ALL_CARDS, CARD_DB } from "../../src/data/cards/index.js";
import { STARTERS, STARTER_STAPLES, STARTER_COMBO } from "../../src/data/starters.js";
import { shippedLoaners, loanerById } from "../../src/data/loaners.js";
import { validateDeck } from "../../src/meta/banlist.js";
import { AI_BUDGETS } from "../../src/ai/budgets.ts";

describe("Tribute Summon", () => {
  it("lets Level 4 monsters Normal Summon with no extra cost", () => {
    const G = mkState(2);
    G.phase = "M1";
    G.tp = 0;
    addHand(G, 0, "ember_fox");
    addHand(G, 0, "burning_lance");
    const acts = legalMainActions(G, 0);
    expect(acts.some((a) => a.type === "summon" && a.card.id === "ember_fox")).toBe(true);
    expect(acts.some((a) => a.type === "set" && a.card.id === "burning_lance")).toBe(true);
    expect(acts.some((a) => a.type === "activate" && a.card.id === "burning_lance")).toBe(false);
  });

  it("blocks Level 5+ without tributes, then Tribute Summons with 1 monster", async () => {
    const G = mkState(1);
    G.phase = "M1";
    G.tp = 0;
    addHand(G, 0, "gem_golem");
    expect(legalMainActions(G, 0).filter((a) => a.type === "summon")).toHaveLength(0);
    const fox = addField(G, 0, "ember_fox", 0);
    const acts = legalMainActions(G, 0).filter((a) => a.type === "summon");
    expect(acts).toHaveLength(1);
    await normalSummon(G, P(G, 0).hand[0], 1, [fox.uid]);
    expect(P(G, 0).mz.some((m) => m && m.id === "gem_golem")).toBe(true);
    expect(P(G, 0).gy.some((c) => c.id === "ember_fox")).toBe(true);
    expect(P(G, 0).normalSummoned).toBe(true);
  });
});

describe("YGO Normal Summon lock", () => {
  it("allows only one Normal Summon per turn", async () => {
    const G = mkState(42);
    G.cardDb = CARD_DB;
    addHand(G, 0, "ember_fox");
    addHand(G, 0, "scav_wisp");
    G.phase = "M1";
    G.tp = 0;
    const before = legalMainActions(G, 0).filter((a) => a.type === "summon");
    expect(before.length).toBeGreaterThanOrEqual(2);
    await normalSummon(G, P(G, 0).hand[0]);
    expect(P(G, 0).normalSummoned).toBe(true);
    const after = legalMainActions(G, 0).filter((a) => a.type === "summon");
    expect(after.length).toBe(0);
  });

  it("Special Summons do not consume Normal Summon", () => {
    const G = mkState(7);
    G.cardDb = CARD_DB;
    addHand(G, 0, "ember_fox");
    const token = makeCard("rush_swarmling", CARD_DB.rush_swarmling, 0);
    P(G, 0).deck.push(token);
    specialSummon(G, token, 0);
    expect(P(G, 0).normalSummoned).toBe(false);
    const acts = legalMainActions(G, 0).filter((a) => a.type === "summon");
    expect(acts.length).toBeGreaterThanOrEqual(1);
  });
});

describe("snapshots", () => {
  it("round-trips core fields", () => {
    const G = mkState(1);
    G.cardDb = CARD_DB;
    addField(G, 0, "ember_fox", 0);
    P(G, 0).lp = 12;
    P(G, 0).comebackUsed = true;
    const snap = serializeGame(G);
    const H = deserializeGame(snap, CARD_DB);
    expect(H.players[0].lp).toBe(12);
    expect(H.players[0].mz[0].id).toBe("ember_fox");
    expect(H.players[0].comebackUsed).toBe(true);
  });
});

describe("keywords + comeback", () => {
  it("Ward forces attacks onto Ward monsters", () => {
    const G = mkState(3);
    G.cardDb = CARD_DB;
    addField(G, 1, "ward_sentinel", 0);
    addField(G, 1, "ember_fox", 1);
    const wards = wardBlockers(G, 1);
    expect(wards.length).toBe(1);
    expect(hasKeyword(wards[0], "ward")).toBe(true);
  });

  it("Comeback triggers at LP≤10 once", () => {
    const G = mkState(4);
    G.io = makeDriver({});
    P(G, 0).lp = 11;
    dealDamageToPlayer(G, 0, 2);
    expect(P(G, 0).comebackUsed).toBe(true);
    expect(P(G, 0).comebackPending).toBe("choose");
    applyComebackChoice(G, 0, "draw");
    expect(P(G, 0).bonusDrawNextTurn).toBe(1);
    dealDamageToPlayer(G, 0, 1);
    expect(P(G, 0).bonusDrawNextTurn).toBe(1); // no re-trigger
  });
});

describe("Contact Fusion", () => {
  it("Contact SS does not set normalSummoned and respects OPT", async () => {
    const G = mkState(9);
    G.cardDb = CARD_DB;
    G.io = makeDriver({});
    G.tp = 0;
    addField(G, 0, "ember_fox", 0);
    addField(G, 0, "cinder_knight", 1);
    const fusion = makeCard("fusion_ember_drake", CARD_DB.fusion_ember_drake, 0);
    fusion.loc = "extra";
    P(G, 0).extra.push(fusion);
    const legal = legalContactFusions(G, 0);
    expect(legal.length).toBe(1);
    await contactFusionSummon(G, 0, legal[0].fusion, legal[0].materials);
    expect(P(G, 0).normalSummoned).toBe(false);
    expect(P(G, 0).mz.some((m) => m && m.id === "fusion_ember_drake")).toBe(true);
    expect(legalContactFusions(G, 0).every((o) => o.fusion.id !== "fusion_ember_drake")).toBe(true);
  });

  it("Contact Fusion: two Ignis make Pyre Wyrm", async () => {
    const G = mkState(11);
    G.cardDb = CARD_DB;
    G.io = makeDriver({});
    G.tp = 0;
    addField(G, 0, "ember_fox", 0);
    addField(G, 0, "ash_prophet", 1);
    const fusion = makeCard("fusion_pyre_wyrm", CARD_DB.fusion_pyre_wyrm, 0);
    fusion.loc = "extra";
    P(G, 0).extra.push(fusion);
    const legal = legalContactFusions(G, 0);
    expect(legal.some((o) => o.fusion.id === "fusion_pyre_wyrm")).toBe(true);
    await contactFusionSummon(G, 0, legal.find((o) => o.fusion.id === "fusion_pyre_wyrm").fusion, legal.find((o) => o.fusion.id === "fusion_pyre_wyrm").materials);
    expect(P(G, 0).mz.some((m) => m && m.id === "fusion_pyre_wyrm")).toBe(true);
  });

  it("GY Fusion lets io.choose pick among legal recipes", async () => {
    const G = mkState(13);
    G.cardDb = CARD_DB;
    let chosen = null;
    G.io = makeDriver({
      choose(_p, req) {
        if (req.kind === "gyFusion") { chosen = req; return [1]; }
        return [0];
      }
    });
    addGy(G, 0, "ember_fox");
    addGy(G, 0, "cinder_knight");
    addGy(G, 0, "ash_prophet");
    for (const id of ["fusion_ember_drake", "fusion_pyre_wyrm"]) {
      const fusion = makeCard(id, CARD_DB[id], 0);
      fusion.loc = "extra";
      P(G, 0).extra.push(fusion);
    }
    const opts = legalGyFusions(G, 0);
    expect(opts.length).toBeGreaterThanOrEqual(2);
    await CARD_DB.gy_fusion_rite.spell.resolve(G, { controller: 0 });
    expect(chosen?.kind).toBe("gyFusion");
    expect(chosen.options.length).toBe(opts.length);
    expect(P(G, 0).mz.some((m) => m && m.id === opts[1].fusion.id)).toBe(true);
  });
});

describe("must-ship decks", () => {
  it("ships at least 40 complete 40+Extra loaners", () => {
    const list = shippedLoaners();
    expect(list.length).toBeGreaterThanOrEqual(40);
    for (const d of list) {
      expect(d.deck.length).toBe(40);
      expect(validateDeck({ main: d.deck, extra: d.extra }).ok, d.id).toBe(true);
      expect(d.extra.length, d.id).toBeGreaterThanOrEqual(1);
      expect(d.extra.length, d.id).toBeLessThanOrEqual(15);
      for (const id of [...d.deck, ...d.extra]) {
        expect(CARD_DB[id], id).toBeTruthy();
      }
    }
  });

  it("Meta Staples starter and loaner are a legal 40 + Extra", () => {
    expect(STARTERS.meta.deck).toHaveLength(40);
    expect(validateDeck({ main: STARTERS.meta.deck, extra: STARTERS.meta.extra }).ok).toBe(true);
    expect(STARTERS.meta.deck.filter((id) => id === "hush_petal")).toHaveLength(3);
    expect(STARTERS.meta.deck).toContain("ivory_colossus");
    expect(STARTERS.meta.deck).toContain("arc_triple");
    expect(STARTERS.meta.extra).toContain("fusion_pyre_wyrm");
    const L = loanerById("meta_staples");
    expect(L).toBeTruthy();
    expect(L.deck).toEqual(STARTERS.meta.deck);
    expect(L.extra).toEqual(STARTERS.meta.extra);
  });

  it("Ignis / Abyss / Terra ship staples plus Neutral combo glue and stay legal 40", () => {
    expect(STARTER_STAPLES).toHaveLength(8);
    expect(STARTER_COMBO).toHaveLength(4);
    for (const id of ["ignis", "abyss", "terra"]) {
      const s = STARTERS[id];
      expect(s.deck, id).toHaveLength(40);
      const v = validateDeck({ main: s.deck, extra: s.extra });
      expect(v.ok, `${id}: ${v.errors.join("; ")}`).toBe(true);
      expect(s.deck.filter((x) => x === "veil_needle")).toHaveLength(2);
      expect(s.deck.filter((x) => x === "helix_shot")).toHaveLength(2);
      expect(s.deck.filter((x) => x === "ash_whisper")).toHaveLength(2);
      expect(s.deck).toContain("twin_cut");
      expect(s.deck).toContain("equal_cut");
      for (const glue of STARTER_COMBO) expect(s.deck, id).toContain(glue);
    }
  });

  it("Circuit Relay loaner is a legal Neutral combo list", () => {
    const L = loanerById("circuit_relay");
    expect(L).toBeTruthy();
    expect(L.deck).toHaveLength(40);
    expect(validateDeck({ main: L.deck, extra: L.extra }).ok).toBe(true);
    expect(L.deck).toContain("sigil_courier");
    expect(L.deck).toContain("salvage_wisp");
    expect(L.extra).toContain("fusion_staple_knight");
  });

  it("every spell in CARD_DB has a resolve function", () => {
    for (const c of Object.values(CARD_DB)) {
      if (c.type !== "spell") continue;
      expect(typeof c.spell?.resolve, c.id).toBe("function");
    }
  });

  it("has two field Quick Effects: Frost Mage and Spark Channeler", () => {
    const qe = Object.values(CARD_DB).filter((c) => c.type === "monster" && c.quick);
    expect(qe.some((c) => c.id === "frost_mage")).toBe(true);
    expect(qe.some((c) => c.id === "spark_channeler")).toBe(true);
    expect(qe.length).toBeGreaterThanOrEqual(2);
    expect(CARD_DB.spark_channeler.quick.targets).toBeTruthy();
  });
});

describe("Wave E meta staples", () => {
  it("ships 16 original jobs without copyrighted staple names", () => {
    expect(WAVE_E_CARDS).toHaveLength(16);
    const ids = WAVE_E_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(16);
    const blob = WAVE_E_CARDS.map((c) => `${c.name} ${c.text}`).join("\n");
    expect(blob).not.toMatch(/Blue-Eyes|Dark Magician|Pot of Greed|Ash Blossom|Lightning Bolt|Monster Reborn|Raigeki|Mirror Force|Maxx|Nibiru|Swords to Plowshares|Force of Will|Harpie/i);
    expect(CARD_DB.ivory_colossus).toBeTruthy();
    expect(CARD_DB.void_pitch.handTrap).toBe(true);
    expect(typeof CARD_DB.recall_gust.spell.resolve).toBe("function");
  });

  it("Ivory Colossus is LV8 / 2 tributes and Cinder Tyrant is LV6 / 1", () => {
    expect(monsterLevel(CARD_DB.ivory_colossus)).toBe(8);
    expect(tributesNeeded(CARD_DB.ivory_colossus)).toBe(2);
    expect(CARD_DB.ivory_colossus.text).toMatch(/Tribute 2/);
    expect(monsterLevel(CARD_DB.cinder_tyrant)).toBe(6);
    expect(tributesNeeded(CARD_DB.cinder_tyrant)).toBe(1);
  });

  it("Cinder Tyrant Fanfare deals 2 to the enemy leader", async () => {
    const G = mkState(3);
    G.phase = "M1";
    G.tp = 0;
    const fox = addField(G, 0, "ember_fox", 0);
    addHand(G, 0, "cinder_tyrant");
    G.io = makeDriver({});
    await normalSummon(G, P(G, 0).hand[0], 1, [fox.uid]);
    expect(P(G, 1).lp).toBe(18);
  });

  it("Recall Gust bounces an enemy monster", async () => {
    const G = mkState(4);
    const foe = addField(G, 1, "ember_fox", 0);
    const gust = addHand(G, 0, "recall_gust");
    await CARD_DB.recall_gust.spell.resolve(G, gust, { targets: [[foe]] });
    expect(P(G, 1).hand.some((c) => c.id === "ember_fox")).toBe(true);
    expect(P(G, 1).mz[0]).toBeFalsy();
  });

  it("Gale Sweep destroys enemy Set spells only", async () => {
    const G = mkState(6);
    addSet(G, 1, "null_seal", 0);
    const face = addSet(G, 1, "deep_freeze", 1);
    face.faceup = true;
    await CARD_DB.gale_sweep.spell.resolve(G, { controller: 0 });
    expect(P(G, 1).gy.some((c) => c.id === "null_seal")).toBe(true);
    expect(P(G, 1).stz[1]?.id).toBe("deep_freeze");
  });

  it("Tithe Owl draws once per turn on an opponent summon", async () => {
    const G = mkState(8);
    G.phase = "M1";
    G.tp = 1;
    addField(G, 0, "tithe_owl", 0);
    addDeck(G, 0, ["ember_fox", "ember_fox", "ember_fox"]);
    addHand(G, 1, "ember_fox");
    addHand(G, 1, "scav_wisp");
    G.io = makeDriver({});
    const before = P(G, 0).hand.length;
    await normalSummon(G, P(G, 1).hand[0]);
    expect(P(G, 0).hand.length).toBe(before + 1);
    P(G, 1).normalSummoned = false;
    await normalSummon(G, P(G, 1).hand[0], 1);
    expect(P(G, 0).hand.length).toBe(before + 1);
  });
});

describe("Wave F authored set", () => {
  it("ships original staples without a 500-card name-fill cap", () => {
    expect(WAVE_F_CARDS.length).toBe(76);
    expect(ALL_CARDS).toHaveLength(1330);
    const ids = WAVE_F_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(76);
    const blob = WAVE_F_CARDS.map((c) => `${c.name} ${c.text}`).join("\n");
    expect(blob).not.toMatch(/Ash Blossom|Lightning Bolt|Change of Heart|Graceful Charity|Reinforcement of the Army|Foolish Burial|Book of Moon|Torrential|Leeroy|Boss's Orders|Cyclonic Rift|Infinite Impermanence/i);
    expect(CARD_DB.hush_petal.handTrap).toBe(true);
    expect(CARD_DB.empty_veto.handTrap).toBe(true);
    expect(typeof CARD_DB.arc_triple.spell.resolve).toBe("function");
  });

  it("Arc Triple deals 3 to the enemy leader", async () => {
    const G = mkState(9);
    const bolt = addHand(G, 0, "arc_triple");
    G.io = makeDriver({});
    await CARD_DB.arc_triple.spell.resolve(G, bolt);
    expect(P(G, 1).lp).toBe(17);
  });

  it("Cyclone Break bounces all enemy monsters", async () => {
    const G = mkState(10);
    addField(G, 1, "ember_fox", 0);
    addField(G, 1, "scav_wisp", 1);
    await CARD_DB.cyclone_break.spell.resolve(G, { controller: 0 });
    expect(P(G, 1).mz.every((z) => !z)).toBe(true);
    expect(P(G, 1).hand.filter((c) => c.id === "ember_fox" || c.id === "scav_wisp")).toHaveLength(2);
  });

  it("Empty Veto shuts a monster when your field is empty", async () => {
    const G = mkState(11);
    const foe = addField(G, 1, "ember_fox", 0);
    const veto = addHand(G, 0, "empty_veto");
    expect(CARD_DB.empty_veto.spell.condition(G, veto)).toBe(true);
    await CARD_DB.empty_veto.spell.resolve(G, veto, { targets: [[foe]] });
    expect(foe.negated).toBe(true);
  });

  it("Moon Fold flips an enemy face-down", async () => {
    const G = mkState(12);
    const foe = addField(G, 1, "ember_fox", 0);
    await CARD_DB.moon_fold.spell.resolve(G, { controller: 0 }, { targets: [[foe]] });
    expect(foe.faceup).toBe(false);
    expect(foe.faceDownMz).toBe(true);
  });

  it("Point the Blade marks the attack target", async () => {
    const G = mkState(13);
    const foe = addField(G, 1, "ember_fox", 0);
    await CARD_DB.point_the_blade.spell.resolve(G, { controller: 0 }, { targets: [[foe]] });
    expect(G.mustAttackUid).toBe(foe.uid);
    expect(G.mustAttackTurn).toBe(G.turnCount);
  });

  it("Flood Verdict wipes the board when the opponent summons", async () => {
    const G = mkState(14);
    G.phase = "M1";
    G.tp = 1;
    addField(G, 0, "flood_verdict", 0);
    addHand(G, 1, "ember_fox");
    G.io = makeDriver({});
    await normalSummon(G, P(G, 1).hand[0]);
    expect(P(G, 0).mz.every((z) => !z)).toBe(true);
    expect(P(G, 1).mz.every((z) => !z)).toBe(true);
  });
});

describe("Gold / Platinum unique effects", () => {
  it("Burn Herald deals 1 to the enemy leader on summon", async () => {
    const G = mkState(5);
    G.phase = "M1";
    G.tp = 0;
    addHand(G, 0, "gold_burn_herald");
    G.io = makeDriver({});
    await normalSummon(G, P(G, 0).hand[0]);
    expect(P(G, 1).lp).toBe(19);
  });

  it("Tide Oracle is not vanilla flavor-text", () => {
    expect(CARD_DB.gold_tide_oracle.triggers?.length).toBeGreaterThan(0);
    expect(CARD_DB.plat_deep_siren.triggers?.length).toBeGreaterThan(0);
    expect(CARD_DB.plat_ambush_reaper.triggers?.length).toBeGreaterThan(0);
  });
});

describe("Wave G generic staples", () => {
  it("ships original jobs, not trademarked staple names", () => {
    expect(WAVE_G_CARDS).toHaveLength(50);
    const blob = WAVE_G_CARDS.map((c) => `${c.name} ${c.text}`).join("\n");
    expect(blob).not.toMatch(/Ash Blossom|Maxx C|Nibiru|Pot of Greed|Raigeki|Dark Hole|Monster Reborn|Thoughtseize|Lightning Bolt|Fireball|Professor's Research|Boss's Orders|Be Prepared/i);
    expect(CARD_DB.veil_needle.handTrap).toBe(true);
    expect(CARD_DB.alloy_core.keywords).toEqual(expect.arrayContaining(["rush", "drain", "ward"]));
  });

  it("Helix Shot pings the leader and heals you", async () => {
    const G = mkState(21);
    P(G, 0).lp = 15;
    await CARD_DB.helix_shot.spell.resolve(G, { controller: 0 });
    expect(P(G, 1).lp).toBe(17);
    expect(P(G, 0).lp).toBe(18);
  });

  it("Both Boards wipes every monster", async () => {
    const G = mkState(22);
    addField(G, 0, "ember_fox", 0);
    addField(G, 1, "gem_golem", 0);
    await CARD_DB.both_boards.spell.resolve(G, { controller: 0 });
    expect(P(G, 0).mz.every((z) => !z)).toBe(true);
    expect(P(G, 1).mz.every((z) => !z)).toBe(true);
  });

  it("any two monsters can Contact Fusion Staple Knight", () => {
    const G = mkState(23);
    addField(G, 0, "ember_fox", 0);
    addField(G, 0, "scav_wisp", 1);
    const extra = makeCard("fusion_staple_knight", CARD_DB.fusion_staple_knight, 0);
    extra.loc = "extra";
    P(G, 0).extra.push(extra);
    expect(legalContactFusions(G, 0).some((o) => o.fusion.id === "fusion_staple_knight")).toBe(true);
  });
});

describe("Mill / Ambush / Token packages + new fusions", () => {
  it("Mill Lantern fanfare mills 1 and its Evolve mills 2", async () => {
    const G = mkState(31);
    G.phase = "M1";
    G.tp = 0;
    G.turnCount = 5;
    const pl = P(G, 0);
    pl.ep = 2;
    pl.ownTurnCount = 3;
    addDeck(G, 1, Array(10).fill("ember_fox"));
    addHand(G, 0, "mill_lantern");
    G.io = makeDriver({});
    await normalSummon(G, P(G, 0).hand[0], 0);
    expect(P(G, 1).gy.length).toBe(1);
    const lantern = P(G, 0).mz[0];
    const { evolveMonster } = await import("../../src/engine/index.js");
    await evolveMonster(G, lantern);
    expect(P(G, 1).gy.length).toBe(3);
  });

  it("Hollow Tax burns the enemy leader when they are milled", async () => {
    const G = mkState(32);
    const tax = makeCard("hollow_tax", CARD_DB.hollow_tax, 0);
    tax.loc = "stz";
    tax.zone = 0;
    tax.faceup = true;
    P(G, 0).stz[0] = tax;
    addDeck(G, 1, Array(6).fill("ember_fox"));
    const { mill } = await import("../../src/engine/ops.js");
    const { collectTriggers, segocOrder } = await import("../../src/engine/triggers.js");
    mill(G, 1, 2);
    const found = collectTriggers(G);
    expect(found.some((f) => f.card.id === "hollow_tax")).toBe(true);
    const ordered = await segocOrder(G, found);
    for (const f of ordered) await f.trig.resolve(G, f.card, { targets: [] });
    expect(P(G, 1).lp).toBe(19);
  });

  it("Token Sprouter and Token Mason summon a 0/4 Ward Stonewall Token", async () => {
    const G = mkState(33);
    G.phase = "M1";
    G.tp = 0;
    addHand(G, 0, "token_sprouter");
    G.io = makeDriver({});
    await normalSummon(G, P(G, 0).hand[0], 0);
    const token = P(G, 0).mz.find((c) => c && c.id === "token_stonewall");
    expect(token).toBeTruthy();
    expect(token.def.atk).toBe(0);
    expect(token.def.def).toBe(4);
    expect(token.def.keywords).toContain("ward");
    const G2 = mkState(34);
    G2.phase = "M1";
    G2.tp = 0;
    const fodder = addField(G2, 0, "ember_fox", 0);
    addHand(G2, 0, "silver_token_mason");
    G2.io = makeDriver({});
    await normalSummon(G2, P(G2, 0).hand[0], 1, [fodder.uid]);
    expect(P(G2, 0).mz.some((c) => c && c.id === "token_stonewall")).toBe(true);
  });

  it("tokens are summonable but not collectable", () => {
    expect(CARD_DB.token_stonewall).toBeTruthy();
    expect(ALL_CARDS.some((c) => c.id === "token_stonewall")).toBe(false);
  });

  it("Ash Drifter fires from the banished pile", async () => {
    const G = mkState(41);
    G.tp = 0;
    const drifter = addField(G, 0, "ash_drifter", 0);
    addDeck(G, 0, ["ember_fox", "scroll_greed"]);
    G.io = makeDriver({});
    const { banishCard } = await import("../../src/engine/ops.js");
    const { collectTriggers, segocOrder } = await import("../../src/engine/triggers.js");
    const ev = banishCard(G, drifter);
    const { pushEvents } = await import("../../src/engine/state.js");
    pushEvents(G, [ev]);
    const found = collectTriggers(G);
    expect(found.some((f) => f.card.id === "ash_drifter")).toBe(true);
    const before = P(G, 0).hand.length;
    const ordered = await segocOrder(G, found);
    for (const f of ordered) await f.trig.resolve(G, f.card, { targets: [] });
    expect(P(G, 0).hand.length).toBe(before + 1);
  });

  it("Deep Hollow is contactable from 2 Abyss and mills 4 on summon", async () => {
    const G = mkState(35);
    G.phase = "M1";
    G.tp = 0;
    addField(G, 0, "tide_caller", 0);
    addField(G, 0, "frost_mage", 1);
    addDeck(G, 1, Array(10).fill("ember_fox"));
    const extra = makeCard("fusion_deep_hollow", CARD_DB.fusion_deep_hollow, 0);
    extra.loc = "extra";
    P(G, 0).extra.push(extra);
    G.io = makeDriver({});
    const opts = legalContactFusions(G, 0);
    expect(opts.some((o) => o.fusion.id === "fusion_deep_hollow")).toBe(true);
    await contactFusionSummon(G, 0, extra, [P(G, 0).mz[0], P(G, 0).mz[1]], 0);
    expect(P(G, 1).gy.length).toBe(4);
  });

  it("Trapdoor Fiend flips your face-down monsters up with +1/+0", async () => {
    const G = mkState(36);
    G.phase = "M1";
    G.tp = 0;
    const door = addField(G, 0, "silver_ambush_door", 0);
    door.faceup = false;
    door.faceDownMz = true;
    const stalker = addField(G, 0, "ambush_stalker", 1);
    stalker.faceup = false;
    stalker.faceDownMz = true;
    const extra = makeCard("fusion_trapdoor_fiend", CARD_DB.fusion_trapdoor_fiend, 0);
    extra.loc = "extra";
    P(G, 0).extra.push(extra);
    G.io = makeDriver({});
    await contactFusionSummon(G, 0, extra, [door, stalker], 2);
    // materials went to the GY for the fusion; flip two fresh face-downs instead
    const d2 = addField(G, 0, "silver_ambush_door", 3);
    d2.faceup = false;
    d2.faceDownMz = true;
    const trig = CARD_DB.fusion_trapdoor_fiend.triggers[0];
    await trig.resolve(G, P(G, 0).mz[2]);
    expect(d2.faceup).toBe(true);
    expect(d2.atkMod).toBe(1);
  });

  it("Grave Jester revives a small monster from the GY", async () => {
    const G = mkState(37);
    addGy(G, 0, "ember_fox");
    addGy(G, 0, "inferno_titan");
    const card = { controller: 0, def: CARD_DB.fusion_grave_jester, loc: "mz" };
    G.io = makeDriver({});
    const trig = CARD_DB.fusion_grave_jester.triggers[0];
    await trig.resolve(G, card);
    expect(P(G, 0).mz.some((c) => c && c.id === "ember_fox")).toBe(true);
    expect(P(G, 0).mz.some((c) => c && c.id === "inferno_titan")).toBe(false);
  });

  it("Worldroot heals and sweeps by Ward count", async () => {
    const G = mkState(38);
    P(G, 0).lp = 10;
    addField(G, 0, "ward_sentinel", 0);
    addField(G, 0, "stoneback", 1);
    addField(G, 1, "ember_fox", 0);
    addField(G, 1, "lava_giant", 1);
    const card = { controller: 0, def: CARD_DB.fusion_worldroot, loc: "mz" };
    const trig = CARD_DB.fusion_worldroot.triggers[0];
    await trig.resolve(G, card);
    expect(P(G, 0).lp).toBe(14);
    // 1 ward (sentinel) -> 1 damage to each enemy: fox dies, giant survives
    expect(P(G, 1).mz[0]).toBeFalsy();
    expect(P(G, 1).mz[1]?.id).toBe("lava_giant");
  });

  it("Warden Titan grants Ward and Rush General grants Rush", async () => {
    const G = mkState(39);
    const fox = addField(G, 0, "ember_fox", 0);
    await CARD_DB.fusion_warden_titan.triggers[0].resolve(G, { controller: 0, loc: "mz" });
    expect(fox.wardGranted).toBe(true);
    const fox2 = addField(G, 0, "gem_golem", 1);
    await CARD_DB.fusion_rush_general.triggers[0].resolve(G, { controller: 0, loc: "mz" });
    expect(fox2.rushGranted).toBe(true);
  });

  it("Cinder Archon sweeps 1 and draws on a kill; Storm Caller recycles a Quick spell", async () => {
    const G = mkState(40);
    addField(G, 1, "ember_fox", 0);
    addField(G, 1, "lava_giant", 1);
    addDeck(G, 0, ["scroll_greed"]);
    await CARD_DB.fusion_cinder_archon.triggers[0].resolve(G, { controller: 0, loc: "mz" });
    expect(P(G, 1).mz[0]).toBeFalsy();
    expect(P(G, 0).hand.some((c) => c.id === "scroll_greed")).toBe(true);
    addGy(G, 0, "ember_spark");
    await CARD_DB.fusion_storm_caller.triggers[0].resolve(G, { controller: 0, loc: "mz" });
    expect(P(G, 0).hand.some((c) => c.id === "ember_spark")).toBe(true);
  });
});

describe("AI budgets", () => {
  it("documents Easy/Normal/Hard", () => {
    expect(AI_BUDGETS.easy.ms).toBeLessThan(AI_BUDGETS.normal.ms);
    expect(AI_BUDGETS.normal.ms).toBeLessThan(AI_BUDGETS.hard.ms);
    expect(AI_BUDGETS.hard.ms).toBeLessThanOrEqual(1500);
  });
});

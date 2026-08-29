// Wave H — the neutral combo core, and the circuit web it plugs into.
import { describe, it, expect } from "vitest";
import { mkState, addHand, addField, addGy, addDeck, makeDriver } from "./helpers.js";
import { P, normalSummon, monsterLevel, tributesNeeded } from "../../src/engine/index.js";
import { ALL_CARDS, CARD_DB } from "../../src/data/cards/index.js";
import { WAVE_H_CARDS } from "../../src/data/cards/waveH.js";
import { TOKEN_CARDS } from "../../src/data/cards/tokens.js";
import {
  CIRCUIT_IDS, comboTagsFor, comboPartnersFor, deckCircuits, deckComboLine, suggestedGlueForDeck
} from "../../src/data/comboTags.js";
import { STARTERS, STARTER_COMBO } from "../../src/data/starters.js";
import { validateDeck } from "../../src/meta/banlist.js";

describe("Wave H set shape", () => {
  it("ships 24 neutral, tribute-free cards", () => {
    expect(WAVE_H_CARDS).toHaveLength(24);
    for (const c of WAVE_H_CARDS) {
      expect(c.archetypes, c.id).toContain("combo_core");
      if (c.type === "monster") {
        expect(c.tribe, c.id).toBe("Neutral");
        expect(monsterLevel(c), c.id).toBeLessThanOrEqual(4);
        expect(tributesNeeded(c), c.id).toBe(0);
      } else {
        expect(typeof c.spell.resolve, c.id).toBe("function");
      }
      expect(c.text, c.id).toBeTruthy();
      expect(["N", "R", "SR", "UR"]).toContain(c.rarity);
    }
  });

  it("uses original names, not trademarked staples", () => {
    const blob = WAVE_H_CARDS.map((c) => `${c.name} ${c.text}`).join("\n");
    expect(blob).not.toMatch(/Pot of Greed|Ash Blossom|Maxx C|Lightning Bolt|Monster Reborn|Painful Choice|Careful Study/i);
  });

  it("keeps ids unique across the whole pool", () => {
    const ids = ALL_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("adds a Recruit Token that is summonable but not collectable", () => {
    expect(CARD_DB.token_recruit).toBeTruthy();
    expect(CARD_DB.token_recruit.atk).toBe(1);
    expect(ALL_CARDS.some((c) => c.id === "token_recruit")).toBe(false);
    expect(TOKEN_CARDS.every((c) => c.token)).toBe(true);
  });
});

describe("combo circuits cover the whole pool", () => {
  it("every card has at least one partner", () => {
    const orphans = ALL_CARDS.filter((c) => comboPartnersFor(c, { limit: 1 }).length === 0);
    expect(orphans.map((c) => c.id)).toEqual([]);
  });

  it("no circuit is dead — each has feeds and payoffs", () => {
    const rows = deckCircuits(ALL_CARDS.map((c) => c.id));
    for (const r of rows) {
      expect(r.enablers, `${r.circuit} feeds`).toBeGreaterThan(0);
      expect(r.payoffs, `${r.circuit} payoffs`).toBeGreaterThan(0);
    }
    expect(rows).toHaveLength(CIRCUIT_IDS.length);
  });

  it("spells feed Spellchain and monsters feed Muster", () => {
    expect(comboTagsFor("scroll_greed").enables).toContain("SPELL");
    expect(comboTagsFor("ember_fox").enables).toContain("SUMMON");
    expect(comboTagsFor("sigil_courier").pays).toContain("SPELL");
    expect(comboTagsFor("echo_adept").pays).toContain("SUMMON");
    expect(comboTagsFor("exile_warden").pays).toContain("BANISH");
  });

  it("partner reasons name the circuit in both directions", () => {
    const partners = comboPartnersFor(CARD_DB.sigil_courier, { limit: 8 });
    expect(partners.length).toBeGreaterThan(0);
    for (const p of partners) {
      expect(CIRCUIT_IDS).toContain(p.circuit);
      expect(p.why).toMatch(/feeds .* pays off/);
      expect(p.id).not.toBe("sigil_courier");
    }
  });

  it("deck circuit read-out flags live and dead verbs", () => {
    const line = deckComboLine(STARTERS.ignis.deck);
    expect(line).toMatch(/Live:|No live combo/);
    const comboDeck = [
      ...Array(3).fill("sigil_courier"), ...Array(3).fill("chain_acolyte"),
      ...Array(3).fill("scroll_greed"), ...Array(3).fill("ember_spark")
    ];
    const spell = deckCircuits(comboDeck).find((c) => c.circuit === "SPELL");
    expect(spell.payoffs).toBe(6);
    expect(spell.live).toBe(true);
  });

  it("starters splash Neutral glue so hour-1 has a 2–3 card loop", () => {
    for (const id of ["ignis", "abyss", "terra", "meta"]) {
      const deck = STARTERS[id].deck;
      expect(deck).toHaveLength(40);
      for (const glue of STARTER_COMBO) {
        expect(deck, id).toContain(glue);
      }
      const live = deckCircuits(deck).filter((c) => c.live);
      expect(live.length, id).toBeGreaterThanOrEqual(1);
    }
  });

  it("suggests a payoff when a list only feeds a circuit", () => {
    const glue = suggestedGlueForDeck(Array(40).fill("ember_fox"));
    expect(glue.length).toBeGreaterThan(0);
    expect(glue.some((g) => g.circuit === "SUMMON" || g.circuit === "DEATH")).toBe(true);
    expect(glue.some((g) => g.def.archetypes?.includes("combo_core"))).toBe(true);
  });
});

describe("Wave H cards actually fire", () => {
  it("Sigil Courier pings once when you activate a spell", async () => {
    const G = mkState(50);
    G.tp = 0;
    const courier = addField(G, 0, "sigil_courier", 0);
    const trig = CARD_DB.sigil_courier.triggers[0];
    expect(trig.match(G, courier, { type: "spellActivated", player: 0 })).toBe(true);
    expect(trig.match(G, courier, { type: "spellActivated", player: 1 })).toBe(false);
    await trig.resolve(G, courier);
    expect(P(G, 1).lp).toBe(19);
  });

  it("Ledger Imp only pays off outside the Draw Phase", () => {
    const G = mkState(51);
    const imp = addField(G, 0, "ledger_imp", 0);
    const trig = CARD_DB.ledger_imp.triggers[0];
    expect(trig.match(G, imp, { type: "draw", player: 0, phaseDraw: false })).toBe(true);
    expect(trig.match(G, imp, { type: "draw", player: 0, phaseDraw: true })).toBe(false);
    expect(trig.match(G, imp, { type: "draw", player: 1, phaseDraw: false })).toBe(false);
  });

  it("Echo Adept draws on another summon, not its own", () => {
    const G = mkState(52);
    const adept = addField(G, 0, "echo_adept", 0);
    const other = addField(G, 0, "ember_fox", 1);
    const trig = CARD_DB.echo_adept.triggers[0];
    expect(trig.match(G, adept, { type: "normalSummon", card: other })).toBe(true);
    expect(trig.match(G, adept, { type: "normalSummon", card: adept })).toBe(false);
    expect(trig.oncePerTurn).toBe(true);
  });

  it("Muster Drum summons a Recruit Token on its Fanfare", async () => {
    const G = mkState(53);
    G.phase = "M1";
    G.tp = 0;
    addHand(G, 0, "muster_drum");
    G.io = makeDriver({});
    await normalSummon(G, P(G, 0).hand[0], 0);
    expect(P(G, 0).mz.some((c) => c && c.id === "token_recruit")).toBe(true);
  });

  it("Rally Horn puts two Recruit Tokens on the board", async () => {
    const G = mkState(54);
    await CARD_DB.rally_horn.spell.resolve(G, { controller: 0 });
    expect(P(G, 0).mz.filter((c) => c && c.id === "token_recruit")).toHaveLength(2);
  });

  it("Rift Keeper banishes the top of your deck and heals on any banish", async () => {
    const G = mkState(55);
    P(G, 0).lp = 15;
    addDeck(G, 0, ["ember_fox", "scav_wisp"]);
    const keeper = addField(G, 0, "rift_keeper", 0);
    await CARD_DB.rift_keeper.triggers[0].resolve(G, keeper);
    expect(P(G, 0).ban).toHaveLength(1);
    const heal = CARD_DB.rift_keeper.triggers[1];
    expect(heal.match(G, keeper, { type: "banished" })).toBe(true);
    await heal.resolve(G, keeper);
    expect(P(G, 0).lp).toBe(16);
  });

  it("Grave Tithe burns for GY monsters, capped at 5", async () => {
    const G = mkState(56);
    for (let i = 0; i < 7; i++) addGy(G, 0, "ember_fox");
    await CARD_DB.grave_tithe.spell.resolve(G, { controller: 0 });
    expect(P(G, 1).lp).toBe(15);
    expect(P(G, 0).ban).toHaveLength(3);
  });

  it("Culling Rite trades a body for two cards", async () => {
    const G = mkState(57);
    const fodder = addField(G, 0, "ember_fox", 0);
    addDeck(G, 0, ["scav_wisp", "gem_golem", "moss_sprite"]);
    await CARD_DB.culling_rite.spell.resolve(G, { controller: 0 }, { targets: [[fodder]] });
    expect(P(G, 0).mz[0]).toBeFalsy();
    expect(P(G, 0).hand).toHaveLength(2);
  });

  it("Loop Warden grows off spells, draws, and deaths alike", () => {
    const G = mkState(58);
    const warden = addField(G, 0, "loop_warden", 0);
    const fox = addField(G, 0, "ember_fox", 1);
    const grow = CARD_DB.loop_warden.triggers[1];
    expect(grow.match(G, warden, { type: "spellActivated", player: 0 })).toBe(true);
    expect(grow.match(G, warden, { type: "draw", player: 0, phaseDraw: false })).toBe(true);
    expect(grow.match(G, warden, { type: "sentToGY", card: fox, from: "mz", player: 0 })).toBe(true);
    expect(grow.oncePerTurn).toBe(true);
  });
});

describe("combo core stays deck-legal", () => {
  it("a 40-card all-combo list passes the door", () => {
    const main = [
      ...Array(3).fill("relay_sprite"), ...Array(3).fill("sigil_courier"),
      ...Array(3).fill("chain_acolyte"), ...Array(3).fill("echo_adept"),
      ...Array(3).fill("ledger_imp"), ...Array(3).fill("salvage_wisp"),
      ...Array(3).fill("grave_ledger"), ...Array(3).fill("carrion_bell"),
      ...Array(3).fill("exile_warden"), ...Array(3).fill("rift_keeper"),
      ...Array(2).fill("loop_warden"),
      ...Array(3).fill("spark_offering"), ...Array(3).fill("exile_pact"),
      ...Array(2).fill("rally_horn")
    ];
    expect(main).toHaveLength(40);
    const v = validateDeck({ main, extra: [] });
    expect(v.ok, v.errors.join("; ")).toBe(true);
    const circuits = deckCircuits(main).filter((c) => c.live);
    expect(circuits.length).toBeGreaterThanOrEqual(3);
  });
});

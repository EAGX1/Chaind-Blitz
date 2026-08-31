import { describe, it, expect, beforeEach } from "vitest";
import {
  P, evolveMonster, normalSummon, tributesNeeded, monsterLevel,
  conductAttack, contactFusionSummon, makeCard, cardByUid, setupDuel,
  legalMainActions, attackTargets, legalContactFusions, isFirstTurnNoBattle,
  runDuel, cannotPlayReason, lingeringEffects, labsGoalMet, checkLabsGoal,
  cardStatusBadges, mainPhaseLoop, serializeGame, applySnapshot, previewCombat,
  remainingHealth, LOCKED_SET_REASON, isLockedSetThisTurn
} from "../../src/engine/index.js";
import { STARTERS } from "../../src/data/starters.js";
import { LOANER_DECKS, shippedLoaners } from "../../src/data/loaners.js";
import { EXTRA_CARDS } from "../../src/data/cards/extra.js";
import { CARD_DB, ALL_CARDS } from "../../src/data/cards/index.js";
import { FIELD_LANES } from "../../src/data/fields.js";
import { makeAutopilot } from "../../src/ai/autopilot.js";
import { AI_BUDGETS } from "../../src/ai/budgets.ts";
import { shouldPromptChain } from "../../src/ui/chainPrompt.js";
import { locLabel } from "../../src/ui/locPip.js";
import { phaseSentence } from "../../src/ui/phaseSentence.js";
import { helpLines } from "../../src/ui/helpOverlay.js";
import { handUnplayableReason, inspectorPlayBits, playHintReason, applyPlayHint, battleUnplayableReason } from "../../src/ui/playHints.js";
import { pickAttack, describeCpuIntent, describeCpuChainIntent, pickChain, scoreMainAct } from "../../src/ai/cpuIntent.js";
import { relatedCardsFor, recipeLines } from "../../src/ui/relatedCards.js";
import { lastPlayTiles, shortenPlayMsg, logEntrySelector, logRowMatchesFilter, normalizeLogFilter, logRowMatchesQuery, logRowIsVisible, loadSessionLogFilter, saveSessionLogFilter } from "../../src/ui/playHistory.js";
import { tryQueueDeck, parseDeckToken, pickRankedToken } from "../../src/ui/deckDoor.js";
import { isLogSearchHotkey } from "../../src/ui/idleKeys.js";
import { deckStarCurve } from "../../src/ui/deckCurve.js";
import { serializeDeckList, parseDeckList, drawOpeningHand, openingSeatNote } from "../../src/ui/deckList.js";
import { announce, lastAnnounce, resetAnnounce } from "../../src/ui/liveAnnounce.js";
import { replaySkipIndex } from "../../src/ui/replayScrubber.js";
import { startRecording, pushAction, boardAt, hasBoardRewind, wrapIoReplay, replayLogTiles, actionIndexForLogLine, captureLog } from "../../src/meta/replay.js";
import { revealedHands } from "../../src/ui/handReveal.js";
import { unusedPlayCount, shouldConfirmEndMain, shouldConfirmEndBattle, unusedEndBody } from "../../src/ui/unusedEnd.js";
import { formatDuelLog } from "../../src/ui/duelLogText.js";
import { parseDuelSeat, swapDuelSides, copiesToAdd, removeAllCopies } from "../../src/ui/duelSeat.js";
import { parseZoneToken, dragExceeded, actForZoneDrop, actForBoardDrop, attackFromDrop, reorderHandList } from "../../src/ui/dragPlay.js";
import { harvestSeen, handFaceUp, isPublicFace } from "../../src/ui/seenSet.js";
import { cardMatchesQuery, gyNewestFirst, gyOrderCaption } from "../../src/ui/gyBrowser.js";
import { bedNames, stingerNames, busLevel } from "../../src/meta/music.js";
import { markTutorialSeen, ensureSoloGates } from "../../src/meta/soloGates.js";
import { hasCuratedPortrait } from "../../src/ui/cardArt.js";
import { teachStep, isTeachDuel, teachRecommended } from "../../src/ui/teachDuel.js";
import { LESSON_YOU, LESSON_FOE, lessonLossLine, shouldStartLesson } from "../../src/data/lessonDuel.js";
import { freshProfile } from "../../src/meta/profile.js";
import { saveCustomMatUrl, loadCustomMatUrl } from "../../src/meta/cosmetics.js";
import { opaqueBounds, punchCornerBackground, punchChromaGreen, isChromaGreen, saveCustomAvatar, loadCustomAvatar, STARTER_AVATAR_SRC } from "../../src/meta/avatarCutout.js";
import { fxDelay, fxSkip, normalizeFxSpeed, fxSpeedLabel, fxCssPace } from "../../src/ui/fxPace.js";
import { chainLinkUids } from "../../src/ui/attackArrows.js";
import { escPauseAction } from "../../src/ui/humanIo.js";
import { normalizeSettings } from "../../src/ui/settingsStore.js";
import { resolutionFitTransform } from "../../src/ui/resolution.js";
import { chainWindowTitle, chainActSource, lastChainCardName, escapeChainHtml, chainLifoCaption } from "../../src/ui/chainPicker.js";
import { mkState, addField, addHand, addDeck, addGy, addSet, makeDriver, logText } from "./helpers.js";

beforeEach(() => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };
});

describe("PP is gone for good", () => {
  it("player state has no pp / maxPp", () => {
    const G = mkState(1);
    for (const p of [0, 1]) {
      const pl = P(G, p);
      expect("pp" in pl).toBe(false);
      expect("maxPp" in pl).toBe(false);
      expect(pl.pp).toBeUndefined();
    }
  });
});

describe("Evolve Colossus", () => {
  it("deals 3 to the enemy leader on evolve", async () => {
    const G = mkState(1);
    G.tp = 0;
    G.turnCount = 5;
    const pl = P(G, 0);
    pl.ep = 2;
    pl.ownTurnCount = 3;
    expect(CARD_DB.evolve_colossus.evolveEffect).toBeTruthy();
    addField(G, 0, "evolve_colossus", 0, { summonedTurn: 1 });
    const colossus = P(G, 0).mz[0];
    await evolveMonster(G, colossus);
    expect(P(G, 1).lp).toBe(17);
  });
});

describe("chain Smart vs Confirm", () => {
  const legalQuick = [{ type: "quick", speed: 2, card: { def: { spell: { speed: 2 } } } }];
  const legalCounter = [{ type: "set", speed: 3, card: { def: { spell: { speed: 3 } } } }];

  it("Confirm always asks when something is legal", () => {
    expect(shouldPromptChain("confirm", 0, legalQuick, [], {})).toBe(true);
  });

  it("Smart skips a low-threat open window", () => {
    expect(shouldPromptChain("smart", 0, legalQuick, [], {})).toBe(false);
  });

  it("Smart asks on opponent chain links and counters", () => {
    expect(shouldPromptChain("smart", 0, legalQuick, [{ controller: 1 }], {})).toBe(true);
    expect(shouldPromptChain("smart", 0, legalCounter, [], {})).toBe(true);
    expect(shouldPromptChain("smart", 0, legalQuick, [], { damageCalc: true })).toBe(true);
  });

  it("Smart asks for Set traps and monster Quicks on the opponent's turn", () => {
    const legalSetQuick = [{ type: "set", speed: 2, card: { def: { spell: { speed: 2, subtype: "quick" } } } }];
    const legalHandTrap = [{ type: "hand", speed: 2, card: { def: { handTrap: true, spell: { speed: 2 } } } }];
    expect(shouldPromptChain("smart", 0, legalSetQuick, [], { turnPlayer: 1 })).toBe(true);
    expect(shouldPromptChain("smart", 0, legalSetQuick, [], { turnPlayer: 0 })).toBe(false);
    expect(shouldPromptChain("smart", 0, legalQuick, [], { turnPlayer: 1 })).toBe(true);
    expect(shouldPromptChain("smart", 0, legalQuick, [], { turnPlayer: 0 })).toBe(false);
    expect(shouldPromptChain("smart", 0, legalHandTrap, [], { turnPlayer: 1 })).toBe(true);
  });

  it("Smart asks every legal response in the attack declaration window", () => {
    const legalSetQuick = [{ type: "set", speed: 2, card: { def: { spell: { speed: 2, subtype: "quick" } } } }];
    expect(shouldPromptChain("smart", 0, legalSetQuick, [], { battleWindow: "declare", turnPlayer: 0 })).toBe(true);
    expect(shouldPromptChain("auto", 0, legalSetQuick, [], { battleWindow: "declare" })).toBe(false);
  });

  it("Auto and Off never ask", () => {
    expect(shouldPromptChain("auto", 0, legalCounter, [{ controller: 1 }], {})).toBe(false);
    expect(shouldPromptChain("off", 0, legalCounter, [{ controller: 1 }], {})).toBe(false);
  });
});

describe("AI difficulty changes picks", () => {
  it("Easy skips a tribute summon Hard takes", async () => {
    const G = mkState(2);
    const golem = addHand(G, 0, "gem_golem");
    const acts = [
      { type: "summon", card: golem, tributes: 1 },
      { type: "end" }
    ];
    const easy = makeAutopilot(G, { getTier: () => "easy" });
    const hard = makeAutopilot(G, { getTier: () => "hard" });
    expect((await easy.chooseMain(0, acts)).type).toBe("end");
    expect((await hard.chooseMain(0, acts)).type).toBe("summon");
  });

  it("Hard penalizes ending on an empty board", () => {
    const G = mkState(2);
    P(G, 0).normalSummoned = false;
    expect(scoreMainAct(G, 0, { type: "end" }, { tier: "hard", depth: 3 })).toBeLessThan(0);
    expect(scoreMainAct(G, 0, { type: "end" }, { tier: "easy", depth: 1 })).toBe(0);
  });

  it("Easy skips a 2-wide Starfall that Hard fires", async () => {
    const G = mkState(2);
    addField(G, 1, "ember_fox", 0);
    addField(G, 1, "ember_fox", 1);
    const star = { type: "activate", card: { id: "starfall", def: CARD_DB.starfall } };
    const end = { type: "end" };
    const acts = [star, end];
    const easy = makeAutopilot(G, { getTier: () => "easy" });
    const hard = makeAutopilot(G, { getTier: () => "hard" });
    expect((await easy.chooseMain(0, acts)).type).toBe("end");
    expect((await hard.chooseMain(0, acts)).type).toBe("activate");
  });

  it("does not advertise search", () => {
    expect(AI_BUDGETS.easy.feel.toLowerCase()).not.toMatch(/search|mcts/);
    expect(AI_BUDGETS.hard.feel.toLowerCase()).not.toMatch(/search|mcts/);
  });

  it("Hard holds Veil Needle instead of setting it", async () => {
    const G = mkState(2);
    const needle = addHand(G, 0, "veil_needle");
    const acts = [
      { type: "set", card: needle },
      { type: "end" }
    ];
    const easy = makeAutopilot(G, { getTier: () => "easy" });
    const hard = makeAutopilot(G, { getTier: () => "hard" });
    expect((await easy.chooseMain(0, acts)).type).toBe("set");
    expect((await hard.chooseMain(0, acts)).type).toBe("end");
  });

  it("Hard skips Research Burn with a full grip and fires it empty", async () => {
    const G = mkState(2);
    const burn = addHand(G, 0, "research_burn");
    addHand(G, 0, "ember_fox");
    addHand(G, 0, "ember_fox");
    addHand(G, 0, "scroll_greed");
    const dump = [
      { type: "activate", card: burn },
      { type: "end" }
    ];
    const hard = makeAutopilot(G, { getTier: () => "hard" });
    expect((await hard.chooseMain(0, dump)).type).toBe("end");
    P(G, 0).hand = [burn];
    expect((await hard.chooseMain(0, dump)).type).toBe("activate");
  });

  it("Hard prefers Helix Shot over a generic ping set", async () => {
    const G = mkState(2);
    const helix = addHand(G, 0, "helix_shot");
    const spark = addHand(G, 0, "ember_spark");
    const acts = [
      { type: "set", card: spark },
      { type: "set", card: helix },
      { type: "end" }
    ];
    const hard = makeAutopilot(G, { getTier: () => "hard" });
    expect((await hard.chooseMain(0, acts)).card.def.id).toBe("helix_shot");
  });

  it("chains Ash Whisper at a monster effect and holds it on its own link", () => {
    const G = mkState(1);
    const ash = { type: "hand", card: { def: CARD_DB.ash_whisper } };
    const foe = [{ kind: "monsterEffect", card: { def: CARD_DB.ember_fox }, controller: 0 }];
    const own = [{ kind: "monsterEffect", card: { def: CARD_DB.ember_fox }, controller: 1 }];
    expect(pickChain(G, 1, [ash], foe, { tier: "hard" })).toBe(0);
    expect(pickChain(G, 1, [ash], own, { tier: "hard" })).toBe(null);
  });

  it("scores Empty Sky like a wipe", () => {
    const G = mkState(2);
    addField(G, 1, "ember_fox", 0);
    addField(G, 1, "ember_fox", 1);
    const sky = { type: "activate", card: { id: "empty_sky", def: CARD_DB.empty_sky } };
    expect(scoreMainAct(G, 0, sky, { tier: "hard", depth: 3 })).toBe(12);
    expect(scoreMainAct(G, 0, sky, { tier: "easy", depth: 1 })).toBe(0);
  });

  it("refuses suicidal attacks but takes even trades upward", () => {
    const G = mkState(1);
    const fox = addField(G, 0, "ember_fox", 0, { summonedTurn: 0 });
    const giant = addField(G, 1, "lava_giant", 0, { summonedTurn: 0 });
    const suicide = pickAttack(G, [fox], () => ({ foes: [giant], canDirect: false }));
    expect(suicide).toBe(null);
    const mine = addField(G, 0, "lava_giant", 1, { summonedTurn: 0 });
    const trade = pickAttack(G, [mine], () => ({ foes: [giant], canDirect: false }));
    expect(trade).toEqual({ attackerUid: mine.uid, targetUid: giant.uid });
    const easySkip = pickAttack(G, [mine], () => ({ foes: [giant], canDirect: false }), { evenTrades: false });
    expect(easySkip).toBe(null);
  });

  it("mulligan keeps a hand trap and bounces bricks and clutter", async () => {
    const G = mkState(1);
    const trap = addHand(G, 0, "veil_needle");
    addHand(G, 0, "inferno_titan");
    const brick2 = addHand(G, 0, "inferno_titan");
    addHand(G, 0, "ember_fox");
    addHand(G, 0, "ember_fox");
    const fox3 = addHand(G, 0, "ember_fox");
    const ai = makeAutopilot(G);
    const bounce = await ai.askMulligan(0, P(G, 0).hand);
    expect(bounce).not.toContain(trap.uid);
    expect(bounce).toContain(brick2.uid);
    expect(bounce).toContain(fox3.uid);
    expect(bounce.length).toBeLessThanOrEqual(3);
  });

  it("comeback picks free Evolve with a board, draw without one", async () => {
    const G = mkState(1);
    addField(G, 0, "ember_fox", 0, { summonedTurn: 0 });
    expect(await makeAutopilot(G).askComeback(0)).toBe("evolve");
    const G2 = mkState(1);
    addField(G2, 1, "lava_giant", 0, { summonedTurn: 0 });
    expect(await makeAutopilot(G2).askComeback(0)).toBe("draw");
  });
});

describe("tutorial flag", () => {
  it("markTutorialSeen sticks on the profile", () => {
    const p = freshProfile();
    ensureSoloGates(p);
    expect(p.soloGates.tutorialSeen).toBe(false);
    markTutorialSeen(p);
    expect(p.soloGates.tutorialSeen).toBe(true);
    expect(p.seenDuelHint).toBe(true);
  });
});

describe("AAA identity gaps", () => {
  it("prints Evolve effects on a real slice of the pool", () => {
    expect(ALL_CARDS.filter((c) => c.evolveEffect).length).toBeGreaterThanOrEqual(40);
  });

  it("gives the four missing URs a curated portrait", () => {
    for (const id of ["hush_petal", "empty_veto", "ivory_colossus", "void_pitch"]) {
      expect(hasCuratedPortrait(id), id).toBe(true);
    }
  });

  it("gives every UR a curated portrait", () => {
    const urs = ALL_CARDS.filter((c) => c.rarity === "UR");
    expect(urs.length).toBeGreaterThan(0);
    for (const c of urs) {
      expect(hasCuratedPortrait(c.id), c.id).toBe(true);
    }
  });

  it("gives staple SRs a curated portrait", () => {
    for (const id of ["null_seal", "ash_whisper", "starfall", "surge_imp", "veil_needle", "fusion_ember_drake", "ward_sentinel"]) {
      expect(hasCuratedPortrait(id), id).toBe(true);
    }
  });

  it("first-duel coach tells you to summon, then end, without a rulebook modal", () => {
    const G = mkState(2);
    G.phase = "M1";
    G.tp = 0;
    G.firstPlayer = 0;
    G.turnCount = 1;
    P(G, 0).normalSummoned = false;
    globalThis.__CB_TEACH = true;
    expect(isTeachDuel(G)).toBe(true);
    expect(teachStep(G).id).toBe("summon");
    const fox = addHand(G, 0, "ember_fox");
    const acts = legalMainActions(G, 0);
    const rec = teachRecommended(G, acts);
    expect(rec?.type).toBe("summon");
    expect(rec?.card?.uid).toBe(fox.uid);
    P(G, 0).normalSummoned = true;
    expect(teachStep(G).id).toBe("endFirst");
    globalThis.__CB_TEACH = false;
  });

  it("after a summon, teaches Set when a spell is in hand", () => {
    const G = mkState(2);
    G.phase = "M1";
    G.tp = 0;
    G.firstPlayer = 0;
    G.turnCount = 1;
    P(G, 0).normalSummoned = true;
    addField(G, 0, "ember_fox", 0, { summonedTurn: 1 });
    addHand(G, 0, "null_seal");
    globalThis.__CB_TEACH = true;
    expect(teachStep(G).id).toBe("set");
    const acts = legalMainActions(G, 0);
    expect(teachRecommended(G, acts)?.type).toBe("set");
    globalThis.__CB_TEACH = false;
  });

  it("lesson decks are 40 and the loss line is one sentence", () => {
    expect(LESSON_YOU).toHaveLength(40);
    expect(LESSON_FOE).toHaveLength(40);
    const p = freshProfile();
    expect(shouldStartLesson(p)).toBe(true);
    expect(lessonLossLine({ reason: "Your LP hit 0." })).toMatch(/empty/i);
    expect(lessonLossLine({ reason: "Your LP hit 0." }).includes(".")).toBe(true);
  });
});

describe("custom mat storage", () => {
  it("round-trips a local data URL", () => {
    expect(loadCustomMatUrl()).toBe("");
    expect(saveCustomMatUrl("data:image/jpeg;base64,xx").ok).toBe(true);
    expect(loadCustomMatUrl()).toBe("data:image/jpeg;base64,xx");
  });
});

describe("PNG character cutout", () => {
  it("opaqueBounds finds the non-transparent box", () => {
    const w = 4;
    const h = 4;
    const data = new Uint8ClampedArray(w * h * 4);
    const i = (2 * w + 1) * 4;
    data[i] = 255;
    data[i + 1] = 0;
    data[i + 2] = 0;
    data[i + 3] = 255;
    expect(opaqueBounds(data, w, h)).toEqual({ minX: 1, minY: 2, maxX: 1, maxY: 2, hits: 1 });
  });

  it("punches a flat photo background from corner color", () => {
    const w = 8;
    const h = 8;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let p = 0; p < w * h; p++) {
      const i = p * 4;
      data[i] = 200;
      data[i + 1] = 200;
      data[i + 2] = 200;
      data[i + 3] = 255;
    }
    const mid = (4 * w + 4) * 4;
    data[mid] = 20;
    data[mid + 1] = 40;
    data[mid + 2] = 180;
    expect(punchCornerBackground(data, w, h)).toBe(true);
    expect(data[3]).toBe(0);
    expect(data[mid + 3]).toBe(255);
  });

  it("round-trips a custom avatar in localStorage", () => {
    expect(loadCustomAvatar()).toBe(null);
    expect(saveCustomAvatar({ url: "data:image/png;base64,xx", aspect: 0.5 }).ok).toBe(true);
    expect(loadCustomAvatar()).toEqual({ url: "data:image/png;base64,xx", aspect: 0.5 });
  });

  it("ships a hover-disc starter PNG and punches chroma green", () => {
    expect(STARTER_AVATAR_SRC).toBe("/avatars/starter-duelist.png");
    expect(isChromaGreen(0, 255, 0)).toBe(true);
    expect(isChromaGreen(240, 230, 200)).toBe(false);
    const data = new Uint8ClampedArray([0, 255, 0, 255, 20, 40, 180, 255]);
    expect(punchChromaGreen(data)).toBe(1);
    expect(data[3]).toBe(0);
    expect(data[7]).toBe(255);
  });
});

describe("extra ladder", () => {
  it("ships 10 Extra fusions and Grove Knight has a fanfare", () => {
    expect(EXTRA_CARDS.length).toBe(20);
    expect(CARD_DB.fusion_staple_knight.fusion?.contact).toBe(true);
    expect(CARD_DB.fusion_staple_aegis.keywords).toContain("ward");
    expect(CARD_DB.fusion_grove_knight.triggers?.length).toBeGreaterThan(0);
    expect(CARD_DB.fusion_ash_seraph).toBeTruthy();
    expect(CARD_DB.fusion_tide_hydra).toBeTruthy();
    expect(CARD_DB.fusion_root_colossus).toBeTruthy();
  });
});

describe("AI depth is consumed", () => {
  it("Hard depth is 3 and Easy is 1", () => {
    expect(AI_BUDGETS.easy.depth).toBe(1);
    expect(AI_BUDGETS.hard.depth).toBe(3);
  });
});

describe("level-aligned copy", () => {
  it("scav / doomblade / moss print Level, not cost", () => {
    for (const id of ["scav_wisp", "doomblade_novice", "moss_sprite"]) {
      expect(CARD_DB[id].text.toLowerCase()).not.toMatch(/\bcost\b/);
      expect(CARD_DB[id].text).toMatch(/Level/);
    }
  });
});

describe("Grove Titan extras", () => {
  it("Terra starter and Terra loaners include Grove Titan", () => {
    expect(STARTERS.terra.extra).toContain("fusion_grove_titan");
    expect(LOANER_DECKS.heal_stall.extra).toContain("fusion_grove_titan");
    expect(LOANER_DECKS.terra_beat.extra).toContain("fusion_grove_titan");
    expect(LOANER_DECKS.ramp_into_boss.extra).toContain("fusion_grove_titan");
    expect(LOANER_DECKS.big_evolve.extra).toContain("fusion_grove_titan");
  });
});

describe("printed costs match the engine", () => {
  it("Evolve Colossus is LV6 / 1 tribute", () => {
    const d = CARD_DB.evolve_colossus;
    expect(monsterLevel(d)).toBe(6);
    expect(tributesNeeded(d)).toBe(1);
    expect(d.text).toMatch(/Tribute 1/);
  });

  it("Lightning Tempest cannot activate with no other card in hand", () => {
    const G = mkState();
    const tempest = addHand(G, 0, "lightning_tempest");
    expect(CARD_DB.lightning_tempest.spell.condition(G, tempest)).toBe(false);
    addHand(G, 0, "ember_fox");
    expect(CARD_DB.lightning_tempest.spell.condition(G, tempest)).toBe(true);
  });

  it("Drain Saint does not print a separate heal", () => {
    expect(CARD_DB.plat_drain_saint.text.toLowerCase()).not.toMatch(/heal/);
    expect(CARD_DB.plat_drain_saint.text).toMatch(/Drain/);
  });

  it("Pyre Wyrm accepts any 2 Ignis", () => {
    const recipes = CARD_DB.fusion_pyre_wyrm.fusion.recipes;
    expect(recipes.length).toBeGreaterThanOrEqual(4);
    const generic = recipes[recipes.length - 1];
    expect(generic.materials.every((m) => m.kind === "generic")).toBe(true);
  });

  it("Grave Fusion Rite is illegal with no Extra fusion", () => {
    const G = mkState();
    const rite = addHand(G, 0, "gy_fusion_rite");
    expect(CARD_DB.gy_fusion_rite.spell.condition(G, rite)).toBe(false);
  });
});

describe("Fanfare vs lane onSummon", () => {
  it("Heal Bloom Fanfare still heals when Mirror Pool draws", async () => {
    const pool = FIELD_LANES.find((l) => l.id === "mirror_pool");
    const G = mkState(1, [pool]);
    G.hooks = {
      onSummon(card) {
        for (const r of G.lanes) {
          if (!r.revealed || !r.def.onSummon) continue;
          if (card.zone === r.index * 2 || card.zone === r.index * 2 + 1) {
            r.def.onSummon(G, r, card);
          }
        }
      }
    };
    addDeck(G, 0, ["ember_fox"]);
    P(G, 0).lp = 18;
    const bloom = addHand(G, 0, "heal_bloom");
    await normalSummon(G, bloom, 0);
    expect(P(G, 0).lp).toBe(20);
    expect(P(G, 0).hand.map((c) => c.id)).toContain("ember_fox");
    expect(logText(G)).not.toMatch(/misses the timing/);
  });
});

describe("Ambush Door flip", () => {
  it("Fanfare deals 2 when flipped by an attack", async () => {
    const G = mkState();
    G.turnCount = 5;
    G.tp = 0;
    G.firstPlayer = 1;
    const attacker = addField(G, 0, "stoneback", 0, { summonedTurn: 1 });
    const door = addField(G, 1, "silver_ambush_door", 0, { summonedTurn: 1 });
    door.faceup = false;
    door.faceDownMz = true;
    await conductAttack(G, attacker, door.uid);
    expect(logText(G)).not.toMatch(/misses the timing/);
    expect(attacker.dmg).toBeGreaterThanOrEqual(2);
  });
});

describe("Evolve is a chain", () => {
  it("Ash Whisper can negate Evolve Colossus", async () => {
    const G = mkState();
    G.tp = 0;
    G.turnCount = 5;
    const pl = P(G, 0);
    pl.ep = 2;
    pl.ownTurnCount = 3;
    addField(G, 0, "evolve_colossus", 0, { summonedTurn: 1 });
    addHand(G, 1, "ash_whisper");
    G.io = makeDriver({
      askChain(p, legal) {
        if (p === 1) {
          const i = legal.findIndex((a) => a.card?.id === "ash_whisper");
          if (i >= 0) return i;
        }
        return null;
      }
    });
    await evolveMonster(G, P(G, 0).mz[0]);
    expect(P(G, 1).lp).toBe(20);
  });
});

describe("Fusion does not send materials if no zone", () => {
  it("aborts before GY when the board is full of non-materials", async () => {
    const G = mkState();
    for (let z = 0; z < 6; z++) addField(G, 0, "moss_sprite", z);
    const fusion = makeCard("fusion_pyre_wyrm", CARD_DB.fusion_pyre_wyrm, 0);
    fusion.loc = "extra";
    P(G, 0).extra.push(fusion);
    const m1 = addHand(G, 0, "ember_fox");
    const m2 = addHand(G, 0, "ember_fox");
    const ok = await contactFusionSummon(G, 0, fusion, [m1, m2]);
    expect(ok).toBe(false);
    expect(P(G, 0).extra).toContain(fusion);
    expect(P(G, 0).hand).toContain(m1);
    expect(P(G, 0).hand).toContain(m2);
    expect(P(G, 0).mz.filter(Boolean).length).toBe(6);
  });
});

describe("GY cards are addressable", () => {
  it("cardByUid finds a GY monster", () => {
    const G = mkState();
    const fox = addGy(G, 0, "ember_fox");
    expect(cardByUid(G, fox.uid)).toBe(fox);
  });
});

describe("keyword text", () => {
  it("linkifies Rush and Fanfare", async () => {
    const { linkifyCardText, KEYWORD_TIPS } = await import("../../src/data/effectTags.js");
    const html = linkifyCardText("Rush. Fanfare: deal 1.");
    expect(html).toMatch(/data-kw="rush"/);
    expect(html).toMatch(/data-kw="fanfare"/);
    expect(KEYWORD_TIPS.ward).toMatch(/Ward/);
    expect(KEYWORD_TIPS.fanfare.toLowerCase()).not.toMatch(/misses.{0,80}lane draw/);
    expect(KEYWORD_TIPS.fanfare).toMatch(/does not make it miss/);
  });
});

describe("Labs noShuffle", () => {
  it("keeps Heal Bloom on top when noShuffle is set", () => {
    const pool = FIELD_LANES.find((l) => l.id === "mirror_pool");
    const G = mkState(1, [pool]);
    G.meta = { noShuffle: true, labs: "fanfare_lane" };
    G.cardDb = CARD_DB;
    setupDuel(G, {
      decks: [["heal_bloom", "moss_sprite", "ember_fox", "ember_fox", "ember_fox", "scroll_greed"], STARTERS.abyss.deck.slice(0, 6)],
      extras: [[], []],
      firstPlayer: 0
    });
    expect(P(G, 0).hand[0].id).toBe("heal_bloom");
  });
});

describe("Evolve vs ignition chooser order", () => {
  it("ranks evolve ahead of ignition", async () => {
    const { rankFieldActions } = await import("../../src/ui/actionRank.js");
    const ranked = rankFieldActions([
      { type: "ignition", label: "ign" },
      { type: "evolve", label: "evo" },
      { type: "set", label: "set" }
    ]);
    expect(ranked.map((a) => a.type)).toEqual(["evolve", "ignition"]);
  });

  it("prompt bar lists Activate and Set for a normal spell, not Set alone", async () => {
    const { promptBarActs } = await import("../../src/ui/actionRank.js");
    const card = { uid: 7, def: { name: "Scroll of Greed" } };
    const bar = promptBarActs([
      { type: "activate", card, label: "Activate Scroll of Greed" },
      { type: "set", card, label: "Set Scroll of Greed" },
      { type: "end", label: "End M1" }
    ]);
    expect(bar.map((a) => a.type)).toEqual(["activate", "set"]);
    expect(bar.map((a) => a.label)).toEqual(["Activate Scroll of Greed", "Set Scroll of Greed"]);
  });

  it("Flame Djinn lists both evolve and ignition", () => {
    const G = mkState();
    G.tp = 0;
    G.phase = "M1";
    P(G, 0).ownTurnCount = 3;
    P(G, 0).ep = 2;
    addField(G, 0, "flame_djinn", 0, { summonedTurn: 1 });
    const types = legalMainActions(G, 0)
      .filter((a) => a.card?.id === "flame_djinn")
      .map((a) => a.type);
    expect(types).toContain("ignition");
    expect(types).toContain("evolve");
  });
});

describe("Ward attack reasons", () => {
  it("blocks non-Ward foes with a reason instead of omitting them from the board list", () => {
    const G = mkState();
    G.turnCount = 3;
    G.tp = 0;
    G.firstPlayer = 1;
    const atk = addField(G, 0, "swift_falcon", 0, { summonedTurn: 1 });
    const ward = addField(G, 1, "ward_sentinel", 0, { summonedTurn: 1 });
    const fox = addField(G, 1, "ember_fox", 1, { summonedTurn: 1 });
    const { foes, canDirect, blocked } = attackTargets(G, atk);
    expect(canDirect).toBe(false);
    expect(foes.map((m) => m.uid)).toEqual([ward.uid]);
    expect(blocked.some((b) => b.card.uid === fox.uid)).toBe(true);
    expect(blocked[0].reason).toMatch(/Ward/);
  });
});

describe("Labs stacked boards", () => {
  it("Ward lab places Falcon vs Sentinel + Fox", () => {
    const G = mkState(1);
    G.cardDb = CARD_DB;
    G.meta = {
      noShuffle: true,
      labs: "ward",
      allowFirstTurnBattle: true,
      labsBoard: [
        { p: 0, id: "swift_falcon", zone: 0, summonedTurn: 0 },
        { p: 1, id: "ward_sentinel", zone: 0, summonedTurn: 0 },
        { p: 1, id: "ember_fox", zone: 1, summonedTurn: 0 }
      ]
    };
    setupDuel(G, {
      decks: [STARTERS.terra.deck.slice(0, 6), STARTERS.abyss.deck.slice(0, 6)],
      extras: [[], []],
      firstPlayer: 0
    });
    expect(P(G, 0).mz[0].id).toBe("swift_falcon");
    expect(P(G, 1).mz[0].id).toBe("ward_sentinel");
    expect(P(G, 1).mz[1].id).toBe("ember_fox");
    expect(isFirstTurnNoBattle(G)).toBe(false);
  });

  it("Contact lab makes Pyre Wyrm legal from the stacked Ignis", () => {
    const G = mkState(1);
    G.cardDb = CARD_DB;
    G.meta = {
      noShuffle: true,
      labs: "contact",
      labsBoard: [
        { p: 0, id: "ember_fox", zone: 0, summonedTurn: 0 },
        { p: 0, id: "cinder_knight", zone: 1, summonedTurn: 0 }
      ]
    };
    setupDuel(G, {
      decks: [STARTERS.ignis.deck.slice(0, 6), STARTERS.abyss.deck.slice(0, 6)],
      extras: [["fusion_pyre_wyrm"], []],
      firstPlayer: 0
    });
    expect(P(G, 0).mz[0].id).toBe("ember_fox");
    expect(P(G, 0).mz[1].id).toBe("cinder_knight");
    expect(legalContactFusions(G, 0).some((o) => o.fusion.id === "fusion_pyre_wyrm")).toBe(true);
    expect(legalMainActions(G, 0).some((a) => a.type === "contactFusion")).toBe(true);
  });

  it("Contact Fusion stays legal on a full board when materials are on field", () => {
    const G = mkState(1);
    G.cardDb = CARD_DB;
    G.phase = "M1";
    G.tp = 0;
    for (let z = 0; z < 6; z++) addField(G, 0, z < 3 ? "moss_sprite" : "ward_sentinel", z, { summonedTurn: 0 });
    const fusion = makeCard("fusion_grove_titan", CARD_DB.fusion_grove_titan, 0);
    fusion.loc = "extra";
    P(G, 0).extra.push(fusion);
    expect(legalContactFusions(G, 0).some((o) => o.fusion.id === "fusion_grove_titan")).toBe(true);
    expect(legalMainActions(G, 0).some((a) => a.type === "contactFusion")).toBe(true);
  });
});

describe("five-window Damage Step", () => {
  it("opens Start, Before, During, After, End and Surge still only during calc", async () => {
    const G = mkState(1);
    G.tp = 0;
    G.turnCount = 5;
    const golem = addField(G, 0, "gem_golem", 0);
    const sprite = addField(G, 1, "shield_sprite", 0);
    addHand(G, 0, "surge_imp");
    const steps = [];
    G.io = makeDriver({
      askChain(p, legal, chain, extra) {
        if (extra?.damageStep) steps.push(extra.damageStep);
        if (extra?.damageCalc && p === 0) {
          const i = legal.findIndex((a) => a.type === "handQuick");
          return i >= 0 ? i : null;
        }
        return null;
      }
    });
    await conductAttack(G, golem, sprite.uid);
    expect(new Set(steps)).toEqual(new Set(["dsStart", "dsBefore", "dsDuring", "dsAfter", "dsEnd"]));
    expect(sprite.loc).toBe("gy");
    expect(logText(G)).toMatch(/Start of the Damage Step/);
    expect(logText(G)).toMatch(/During damage calculation/);
    expect(logText(G)).toMatch(/End of the Damage Step/);
  });

  it("does not offer Shatter Sigil (SS2) in Damage Step windows", async () => {
    const G = mkState(1);
    G.tp = 0;
    G.turnCount = 5;
    const falcon = addField(G, 0, "swift_falcon", 0, { summonedTurn: 1 });
    addField(G, 1, "ember_fox", 0, { summonedTurn: 1 });
    addSet(G, 0, "shatter_sigil", 0, 1);
    const seen = [];
    G.io = makeDriver({
      askChain(p, legal, chain, extra) {
        if (extra?.damageStep && p === 0) {
          seen.push(legal.some((a) => a.card?.id === "shatter_sigil"));
        }
        return null;
      }
    });
    await conductAttack(G, falcon, P(G, 1).mz[0].uid);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.some(Boolean)).toBe(false);
  });
});

describe("cannotPlayReason and lingering effects", () => {
  it("names tribute need and Normal Summon lock", () => {
    const G = mkState();
    const titan = addHand(G, 0, "inferno_titan");
    expect(cannotPlayReason(G, 0, titan)).toMatch(/tribute/i);
    P(G, 0).normalSummoned = true;
    const fox = addHand(G, 0, "ember_fox");
    expect(cannotPlayReason(G, 0, fox)).toMatch(/already used/i);
  });

  it("Main-hand hover reason is null when the card is legal", () => {
    const G = mkState();
    G.phase = "M1";
    G.tp = 0;
    const fox = addHand(G, 0, "ember_fox");
    expect(handUnplayableReason(G, fox)).toBe(null);
  });

  it("dims tribute-locked hand via the same cannotPlayReason string", () => {
    const G = mkState();
    G.phase = "M1";
    G.tp = 0;
    const titan = addHand(G, 0, "inferno_titan");
    expect(handUnplayableReason(G, titan)).toMatch(/tribute/i);
    expect(inspectorPlayBits(G, titan).some((b) => /tribute/i.test(b))).toBe(true);
  });

  it("does not title a hidden foe hand back", () => {
    const G = mkState();
    G.phase = "M1";
    G.tp = 1;
    const titan = addHand(G, 1, "inferno_titan");
    expect(playHintReason(G, titan)).toMatch(/tribute/i);
    const classes = new Set(["cb-card", "card-back"]);
    const el = {
      classList: {
        contains: (c) => classes.has(c),
        remove(c) { classes.delete(c); },
        toggle(c, on) { if (on) classes.add(c); else classes.delete(c); }
      }
    };
    expect(applyPlayHint(el, G, titan)).toBe(null);
    expect(classes.has("unplayable")).toBe(false);
  });

  it("locked Sets explain they arm next turn", () => {
    const G = mkState();
    G.phase = "M1";
    G.tp = 0;
    G.turnCount = 2;
    const seal = addSet(G, 0, "null_seal", 0, 2);
    expect(isLockedSetThisTurn(G, seal)).toBe(true);
    expect(playHintReason(G, seal)).toBe(LOCKED_SET_REASON);
    expect(LOCKED_SET_REASON).toMatch(/arms next turn/i);
    expect(inspectorPlayBits(G, seal)).toContain(LOCKED_SET_REASON);
    expect(inspectorPlayBits(G, seal).join(" ")).not.toMatch(/SET THIS TURN \(LOCKED\)/);
    const classes = new Set(["cb-card", "card-back"]);
    const el = {
      classList: {
        contains: (c) => classes.has(c),
        remove(c) { classes.delete(c); },
        toggle(c, on) { if (on) classes.add(c); else classes.delete(c); }
      },
      title: ""
    };
    expect(applyPlayHint(el, G, seal)).toBe(LOCKED_SET_REASON);
    expect(el.title).toBe(LOCKED_SET_REASON);
    expect(classes.has("unplayable")).toBe(true);
  });

  it("Battle hover names summoning sickness before a click", () => {
    const G = mkState();
    G.phase = "BP";
    G.tp = 0;
    G.turnCount = 3;
    G.firstPlayer = 1;
    const fox = addField(G, 0, "ember_fox", 0, { summonedTurn: 3 });
    expect(battleUnplayableReason(G, fox)).toMatch(/summoning sickness/i);
    expect(playHintReason(G, fox)).toMatch(/summoning sickness/i);
  });

  it("lists a revealed lane and a face-up continuous", () => {
    const G = mkState(1, [FIELD_LANES.find((l) => l.id === "ember_rift")]);
    G.lanes[0].revealed = true;
    const banner = addSet(G, 0, "flame_banner", 0, 0);
    banner.faceup = true;
    const rows = lingeringEffects(G);
    expect(rows.some((r) => r.kind === "lane" && r.name.includes("Ember Rift"))).toBe(true);
    expect(rows.some((r) => String(r.name).includes("Flame Banner"))).toBe(true);
  });
});

describe("Labs complete on the teaching beat", () => {
  it("Fanfare lab completes after Heal Bloom hits Lane 1", async () => {
    const G = mkState(1);
    G.meta = { labs: "fanfare_lane" };
    const bloom = addHand(G, 0, "heal_bloom");
    await normalSummon(G, bloom, 0);
    expect(labsGoalMet(G)).toBe(true);
    expect(checkLabsGoal(G)).toBe(true);
    expect(G.winner).toBe(0);
    expect(G.winReason).toBe("Lab complete.");
  });

  it("Counter lab completes when Null Seal negates the seeded Speed 1 spell", async () => {
    const G = mkState(1);
    G.cardDb = CARD_DB;
    G.meta = {
      labs: "counter",
      noShuffle: true,
      labsBoard: [{ p: 0, id: "null_seal", loc: "stz", zone: 0, setTurn: 0 }]
    };
    G.setup = {
      decks: [STARTERS.terra.deck.slice(0, 6), STARTERS.ignis.deck.slice(0, 6)],
      extras: [[], []],
      firstPlayer: 0
    };
    G.io = makeDriver({
      askChain(p, legal) {
        if (p === 0) {
          const i = legal.findIndex((a) => a.card?.id === "null_seal");
          if (i >= 0) return i;
        }
        return null;
      }
    });
    const result = await runDuel(G);
    expect(result.winner).toBe(0);
    expect(result.reason).toBe("Lab complete.");
    expect(G.stats.negates).toBeGreaterThan(0);
  });

  it("Ambush lab completes when the face-down monster flips", async () => {
    const G = mkState(1);
    G.meta = { labs: "ambush", allowFirstTurnBattle: true };
    G.turnCount = 1;
    G.tp = 0;
    G.firstPlayer = 0;
    const falcon = addField(G, 0, "swift_falcon", 0, { summonedTurn: 0 });
    const door = addField(G, 1, "silver_ambush_door", 0, { summonedTurn: 0 });
    door.faceup = false;
    door.faceDownMz = true;
    G.io = makeDriver({});
    await conductAttack(G, falcon, door.uid);
    expect(labsGoalMet(G)).toBe(true);
    expect(checkLabsGoal(G)).toBe(true);
    expect(G.winner).toBe(0);
  });

  it("Tribute lab completes after Gem Golem eats Ember Fox", async () => {
    const G = mkState(1);
    G.meta = { labs: "tribute" };
    G.phase = "M1";
    G.tp = 0;
    const fox = addField(G, 0, "ember_fox", 0, { summonedTurn: 0 });
    addHand(G, 0, "gem_golem");
    await normalSummon(G, P(G, 0).hand[0], 1, [fox.uid]);
    expect(labsGoalMet(G)).toBe(true);
    expect(checkLabsGoal(G)).toBe(true);
    expect(G.winner).toBe(0);
  });

  it("Damage Step lab completes when Surge Imp discards during damage calc", async () => {
    const G = mkState(1);
    G.meta = { labs: "damage_step", allowFirstTurnBattle: true };
    G.turnCount = 1;
    G.tp = 0;
    G.firstPlayer = 0;
    const falcon = addField(G, 0, "swift_falcon", 0, { summonedTurn: 0 });
    const foe = addField(G, 1, "ember_fox", 0, { summonedTurn: 0 });
    addHand(G, 0, "surge_imp");
    G.io = makeDriver({
      askChain(p, legal, _chain, extra) {
        if (p === 0 && extra?.damageCalc) {
          const i = legal.findIndex((a) => a.card?.id === "surge_imp");
          if (i >= 0) return i;
        }
        return null;
      }
    });
    await conductAttack(G, falcon, foe.uid);
    expect(labsGoalMet(G)).toBe(true);
    expect(G.winner).toBe(0);
    expect(G.winReason).toBe("Lab complete.");
  });
});

describe("on-card status badges", () => {
  it("marks negated, set-locked, and summoning sickness", () => {
    const G = mkState(1);
    G.turnCount = 2;
    G.tp = 0;
    const fox = addField(G, 0, "ember_fox", 0, { summonedTurn: 2 });
    expect(cardStatusBadges(G, fox).some((b) => b.id === "sickness")).toBe(true);
    fox.negated = true;
    expect(cardStatusBadges(G, fox).some((b) => b.id === "negated")).toBe(true);
    const trap = addSet(G, 0, "null_seal", 0, 2);
    expect(cardStatusBadges(G, trap).some((b) => b.id === "locked")).toBe(true);
  });

  it("marks Ward and Rush so combat rules are visible at a glance", () => {
    const G = mkState(1);
    G.turnCount = 5;
    G.tp = 0;
    const ward = addField(G, 0, "ward_sentinel", 0, { summonedTurn: 1 });
    const ids = cardStatusBadges(G, ward).map((b) => b.id);
    expect(ids).toContain("ward");
    const falcon = addField(G, 0, "swift_falcon", 1, { summonedTurn: 5 });
    expect(cardStatusBadges(G, falcon).map((b) => b.id)).toContain("rush");
    ward.negated = true;
    expect(cardStatusBadges(G, ward).map((b) => b.id)).not.toContain("ward");
  });

  it("marks attack-ready and a Set that can fire", () => {
    const G = mkState(1);
    G.turnCount = 4;
    G.tp = 0;
    G.phase = "BP";
    const fox = addField(G, 0, "ember_fox", 0, { summonedTurn: 1 });
    expect(cardStatusBadges(G, fox).some((b) => b.id === "atk")).toBe(true);
    G.phase = "M1";
    const trap = addSet(G, 0, "null_seal", 0, 2);
    expect(cardStatusBadges(G, trap).some((b) => b.id === "setready")).toBe(true);
  });
});

describe("baked audio assets", () => {
  it("ships real WAV files for the core SFX and music beds", async () => {
    const { readFile } = await import("node:fs/promises");
    const { fileURLToPath } = await import("node:url");
    const { dirname, join } = await import("node:path");
    const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
    for (const f of ["sfx/summon", "sfx/attack", "sfx/damage", "sfx/chain", "sfx/negate",
      "sfx/evolve", "sfx/fusion", "sfx/win", "sfx/lose", "music/hub", "music/duel", "music/city"]) {
      const buf = await readFile(join(root, "public", "audio", `${f}.wav`));
      expect(buf.subarray(0, 4).toString(), f).toBe("RIFF");
    }
  });

  it("playSample no-ops without a browser AudioContext", async () => {
    const { playSample, preloadAudio } = await import("../../src/meta/music.js");
    expect(playSample("sfx/summon")).toBe(false);
    expect(() => preloadAudio()).not.toThrow();
  });
});

describe("Main Phase Undo", () => {
  it("restores the board after a Normal Summon", async () => {
    const G = mkState(1);
    G.cardDb = CARD_DB;
    G.phase = "M1";
    G.tp = 0;
    addHand(G, 0, "ember_fox");
    let n = 0;
    G.io = makeDriver({
      chooseMain(p, actions) {
        n++;
        if (n === 1) return actions.find((a) => a.type === "summon") || { type: "end" };
        if (n === 2) return { type: "undo" };
        return { type: "end" };
      }
    });
    await mainPhaseLoop(G);
    expect(P(G, 0).hand.some((c) => c.id === "ember_fox")).toBe(true);
    expect(P(G, 0).mz.filter(Boolean).length).toBe(0);
    expect(P(G, 0).normalSummoned).toBe(false);
  });

  it("applySnapshot keeps io and truncates the log", () => {
    const G = mkState(1);
    G.cardDb = CARD_DB;
    addHand(G, 0, "ember_fox");
    const io = G.io;
    G.log.push({ msg: "before", cls: "", t: 1, phase: "M1" });
    const snap = serializeGame(G);
    G.log.push({ msg: "after", cls: "", t: 1, phase: "M1" });
    P(G, 0).lp = 7;
    applySnapshot(G, snap);
    expect(G.io).toBe(io);
    expect(P(G, 0).lp).toBe(20);
    expect(G.log.length).toBe(1);
    expect(G.log[0].msg).toBe("before");
  });
});

describe("combat preview", () => {
  it("names the trade and lethal direct", () => {
    const G = mkState(1);
    G.tp = 0;
    const fox = addField(G, 0, "ember_fox", 0, { summonedTurn: 0 });
    const stalker = addField(G, 1, "ambush_stalker", 0, { summonedTurn: 0 });
    const trade = previewCombat(G, fox, stalker);
    expect(trade.kind).toBe("battle");
    expect(trade.line).toMatch(/vs/);
    P(G, 1).lp = 1;
    const face = previewCombat(G, fox, null);
    expect(face.lethal).toBe(true);
    expect(face.line).toMatch(/LETHAL/i);
  });
});

describe("zone pips", () => {
  it("labels hand / field / GY", () => {
    expect(locLabel({ loc: "hand" })).toBe("HAND");
    expect(locLabel({ loc: "mz" })).toBe("FIELD");
    expect(locLabel({ loc: "gy" })).toBe("GY");
  });
});

describe("remaining HP and phase sentence", () => {
  it("remainingHealth is DEF minus damage", () => {
    const G = mkState(1);
    const fox = addField(G, 0, "ember_fox", 0, { summonedTurn: 0 });
    const printed = fox.def.def;
    fox.dmg = 1;
    expect(remainingHealth(G, fox)).toBe(printed - 1);
  });

  it("Main 1 is a sentence, Battle names the Damage Step window", () => {
    expect(phaseSentence({ phase: "M1" }).sentence).toMatch(/play a card or end/i);
    expect(phaseSentence({ phase: "BP", battleStep: "dsStart" }).sentence).toMatch(/Damage Step/i);
    expect(phaseSentence({ phase: "BP", battleStep: "declare" }).sentence).toMatch(/attack declaration/i);
    expect(phaseSentence({ phase: "BP" }).hint).toBe("ATK");
  });

  it("F1 help lists pass-until-my-turn", () => {
    expect(helpLines().some((l) => /Pass until your turn/i.test(l))).toBe(true);
  });

  it("F1 help lists idle-board arrows", () => {
    expect(helpLines().some((l) => /idle/i.test(l))).toBe(true);
  });

  it("F1 help lists zone jump, announce repeat, and log skip", () => {
    const lines = helpLines().join("\n");
    expect(lines).toMatch(/H \/ F \/ G/);
    expect(lines).toMatch(/Repeat last announce/i);
    expect(lines).toMatch(/cycle the board/i);
    expect(lines).toMatch(/rewinds the recorded board/i);
    expect(lines).toMatch(/not live match undo/i);
    expect(lines).toMatch(/drag/i);
    expect(lines).toMatch(/Reorder your hand/i);
    expect(lines).toMatch(/forced chain/i);
    expect(lines).toMatch(/card face to chain/i);
    expect(lines).toMatch(/Resolves last/i);
    expect(lines).toMatch(/Greyed hand or field cards/i);
    expect(lines).toMatch(/Locked Sets arm next turn/i);
    expect(lines).toMatch(/illegal attackers/i);
    expect(lines).toMatch(/COPY LOG/);
    expect(lines).toMatch(/not replay JSON/i);
    expect(lines).toMatch(/Filter chips only hide rows/i);
    expect(lines).toMatch(/All \/ Plays \/ Combat \/ Chain/);
    expect(lines).toMatch(/Search filters the list/i);
    expect(lines).toMatch(/focus Search log/i);
    expect(lines).toMatch(/not a mill or deck search/i);
    expect(lines).toMatch(/16px.*Safari does not zoom/i);
    expect(lines).toMatch(/hub inputs/i);
    expect(lines).toMatch(/Prompt docks above your hand/i);
    expect(lines).toMatch(/not over the field/i);
  });
});

describe("CPU intent telegraph", () => {
  it("names a lethal direct as heuristic intent", () => {
    const G = mkState(1);
    G.turnCount = 3;
    G.tp = 1;
    G.firstPlayer = 0;
    P(G, 0).lp = 1;
    const atk = addField(G, 1, "ember_fox", 0, { summonedTurn: 1 });
    const choice = pickAttack(G, [atk], (a) => attackTargets(G, a), { snipeLethal: true });
    expect(choice).toEqual({ attackerUid: atk.uid, targetUid: null });
    const intent = describeCpuIntent(G, choice);
    expect(intent.heuristic).toBe(true);
    expect(intent.lethal).toBe(true);
    expect(intent.line).toMatch(/CPU will Direct/i);
    expect(intent.line).toMatch(/LETHAL/i);
  });

  it("pass intent is labelled end Battle", () => {
    const G = mkState(1);
    const intent = describeCpuIntent(G, null);
    expect(intent.kind).toBe("pass");
    expect(intent.line).toMatch(/end Battle/i);
  });
});

describe("related cards and play history", () => {
  it("Pyre Wyrm lists Ember Fox as a material", () => {
    const rel = relatedCardsFor(CARD_DB.fusion_pyre_wyrm);
    expect(rel.some((r) => r.id === "ember_fox" && r.why === "Material")).toBe(true);
    expect(recipeLines(CARD_DB.fusion_pyre_wyrm).some((l) => /Ember Fox/i.test(l))).toBe(true);
  });

  it("Ember Fox fuses into Pyre Wyrm", () => {
    const rel = relatedCardsFor(CARD_DB.ember_fox);
    expect(rel.some((r) => r.id === "fusion_pyre_wyrm")).toBe(true);
  });

  it("play history keeps the last six action tiles", () => {
    const log = [
      { msg: "Draw", cls: "draw" },
      { msg: "Main 1", cls: "phase" },
      { msg: "Summon Ember Fox", cls: "summon" },
      { msg: "Attack", cls: "attack" }
    ];
    const tiles = lastPlayTiles(log, 6);
    expect(tiles.map((t) => t.cls)).toEqual(["draw", "summon", "attack"]);
    expect(tiles.map((t) => t.i)).toEqual([0, 2, 3]);
    expect(logEntrySelector(2)).toBe("[data-log-i=\"2\"]");
    expect(shortenPlayMsg("x".repeat(50), 10).length).toBe(10);
  });
});

describe("deck star curve", () => {
  it("buckets monsters by ★ and spells separately", () => {
    const { stars, spells } = deckStarCurve(["ember_fox", "ember_fox", "null_seal"], CARD_DB);
    expect(spells).toBe(1);
    expect(stars.reduce((a, n) => a + n, 0)).toBe(2);
    expect(stars[monsterLevel(CARD_DB.ember_fox) - 1]).toBe(2);
  });
});

describe("deck list paste and opening hand", () => {
  it("round-trips ids and qty lines, routes Extra", () => {
    const text = "# Main\n3 ember_fox\nnull_seal\n# Extra\nfusion_pyre_wyrm\n";
    const parsed = parseDeckList(text);
    expect(parsed.main.filter((id) => id === "ember_fox").length).toBe(3);
    expect(parsed.main).toContain("null_seal");
    expect(parsed.extra).toEqual(["fusion_pyre_wyrm"]);
    expect(parsed.unknown).toEqual([]);
    const back = parseDeckList(serializeDeckList(parsed));
    expect(back.main.filter((id) => id === "ember_fox").length).toBe(3);
    expect(back.extra).toEqual(["fusion_pyre_wyrm"]);
  });

  it("DRAW 5 is a seeded shuffle, not a search", () => {
    const deck = STARTERS.ignis.deck;
    const a = drawOpeningHand(deck, { seed: 7, n: 5 });
    const b = drawOpeningHand(deck, { seed: 7, n: 5 });
    expect(a.cards).toEqual(b.cards);
    expect(a.cards.length).toBe(5);
    expect(a.remaining).toBe(deck.length - 5);
  });

  it("DRAW 5 first vs second uses Blitz EP / Battle rules", () => {
    const first = openingSeatNote("first");
    const second = openingSeatNote("second");
    expect(first.ep).toBe(2);
    expect(first.caption).toMatch(/No Battle/i);
    expect(second.ep).toBe(3);
    expect(second.caption).toMatch(/may attack/i);
    expect(openingSeatNote("nope").id).toBe("first");
  });
});

describe("unused-end confirm", () => {
  it("skips the dialog when only End is legal", () => {
    expect(shouldConfirmEndMain([{ type: "end" }])).toBe(false);
    expect(shouldConfirmEndMain([{ type: "end" }, { type: "undo" }])).toBe(false);
    expect(unusedPlayCount([{ type: "end" }, { type: "summon" }, { type: "activate" }])).toBe(2);
    expect(shouldConfirmEndMain([{ type: "end" }, { type: "summon" }])).toBe(true);
  });

  it("confirms End Battle only when an attacker remains", () => {
    expect(shouldConfirmEndBattle([])).toBe(false);
    expect(shouldConfirmEndBattle([{ uid: 1 }])).toBe(true);
    expect(unusedEndBody(1, "BP")).toMatch(/1 legal play/);
    expect(unusedEndBody(2, "M1")).toMatch(/End Main/);
  });
});

describe("side log text", () => {
  it("formats turn and phase, not JSON", () => {
    const text = formatDuelLog([
      { t: 1, phase: "M1", msg: "Summon Ember Fox", cls: "summon" },
      { t: 1, phase: "BP", msg: "Attack", cls: "attack" }
    ]);
    expect(text).toContain("T1 M1  Summon Ember Fox");
    expect(text).toContain("T1 BP  Attack");
    expect(text).not.toMatch(/\{"/);
  });

  it("filter chips hide classes; COPY LOG still uses the full array", () => {
    expect(normalizeLogFilter("combat")).toBe("combat");
    expect(normalizeLogFilter("nope")).toBe("all");
    expect(logRowMatchesFilter("summon", "plays")).toBe(true);
    expect(logRowMatchesFilter("attack", "plays")).toBe(false);
    expect(logRowMatchesFilter("attack", "combat")).toBe(true);
    expect(logRowMatchesFilter("chain", "chain")).toBe(true);
    expect(logRowMatchesFilter("summon", "all")).toBe(true);
    const log = [
      { t: 1, phase: "M1", msg: "Summon Ember Fox", cls: "summon" },
      { t: 1, phase: "BP", msg: "Attack", cls: "attack" }
    ];
    expect(formatDuelLog(log)).toMatch(/Summon Ember Fox/);
    expect(formatDuelLog(log)).toMatch(/Attack/);
  });

  it("search hides lines by text; COPY LOG still dumps the full match", () => {
    expect(logRowMatchesQuery("Summon Ember Fox", "ember")).toBe(true);
    expect(logRowMatchesQuery("Summon Ember Fox", "ATTACK")).toBe(false);
    expect(logRowMatchesQuery("Summon Ember Fox", "  ")).toBe(true);
    expect(logRowIsVisible("summon", "Summon Ember Fox", "plays", "fox")).toBe(true);
    expect(logRowIsVisible("summon", "Summon Ember Fox", "plays", "attack")).toBe(false);
    expect(logRowIsVisible("summon", "Summon Ember Fox", "combat", "fox")).toBe(false);
    const log = [
      { t: 1, phase: "M1", msg: "Summon Ember Fox", cls: "summon" },
      { t: 1, phase: "BP", msg: "Attack", cls: "attack" }
    ];
    expect(formatDuelLog(log)).toMatch(/Summon Ember Fox/);
    expect(formatDuelLog(log)).toMatch(/Attack/);
  });

  it("`/` is the idle log-search hotkey, not a mill", () => {
    expect(isLogSearchHotkey({ key: "/" })).toBe(true);
    expect(isLogSearchHotkey({ key: "/", ctrlKey: true })).toBe(false);
    expect(isLogSearchHotkey({ key: "f" })).toBe(false);
  });

  it("remembers the last log filter for this session", () => {
    expect(saveSessionLogFilter("combat")).toBe("combat");
    expect(loadSessionLogFilter()).toBe("combat");
    expect(saveSessionLogFilter("nope")).toBe("all");
    expect(loadSessionLogFilter()).toBe("all");
  });
});

describe("announce and replay skip", () => {
  it("stores the last line for Ctrl+R", () => {
    resetAnnounce();
    announce("You LP 18 (-2)", { assertive: true });
    expect(lastAnnounce()).toMatch(/You LP 18/);
  });

  it("clamps Left/Right on the duel log", () => {
    expect(replaySkipIndex(0, -1, 10)).toBe(0);
    expect(replaySkipIndex(9, 1, 10)).toBe(9);
    expect(replaySkipIndex(3, 1, 10)).toBe(4);
  });
});

describe("duel seat and editor fill", () => {
  it("maps FIRST / SECOND / RANDOM to createDuel firstPlayer", () => {
    expect(parseDuelSeat("first")).toBe(0);
    expect(parseDuelSeat("second")).toBe(1);
    expect(parseDuelSeat("random")).toBeNull();
    expect(parseDuelSeat(undefined)).toBeNull();
  });

  it("swap rematch exchanges lists and CPU labels, then restores", () => {
    const orig = {
      deckYou: ["ember_fox"],
      deckFoe: ["null_seal"],
      extraYou: ["fusion_pyre_wyrm"],
      extraFoe: [],
      youName: "IGNIS",
      foeName: "Control CPU",
      mode: "pve",
      firstPlayer: 0
    };
    const swapped = swapDuelSides(orig);
    expect(swapped.deckYou).toEqual(["null_seal"]);
    expect(swapped.deckFoe).toEqual(["ember_fox"]);
    expect(swapped.extraYou).toEqual([]);
    expect(swapped.extraFoe).toEqual(["fusion_pyre_wyrm"]);
    expect(swapped.youName).toBe("Control");
    expect(swapped.foeName).toBe("IGNIS CPU");
    expect(swapped.firstPlayer).toBe(0);
    const back = swapDuelSides(swapped);
    expect(back.deckYou).toEqual(orig.deckYou);
    expect(back.youName).toBe("IGNIS");
    expect(back.foeName).toBe("Control CPU");
  });

  it("Shift-click fills to cap; click adds one; Shift-click list removes all", () => {
    expect(copiesToAdd(1, 3, Infinity, { fill: false })).toBe(1);
    expect(copiesToAdd(1, 3, Infinity, { fill: true })).toBe(2);
    expect(copiesToAdd(0, 3, 1, { fill: true })).toBe(1);
    expect(removeAllCopies(["a", "b", "a"], "a")).toEqual(["b"]);
  });
});

describe("drag-to-play", () => {
  it("parses zones, prefers summon, and maps attack drops", () => {
    expect(parseZoneToken("mz-0-3")).toEqual({ kind: "mz", p: 0, z: 3 });
    expect(parseZoneToken("nope")).toBeNull();
    expect(dragExceeded(8, 0)).toBe(true);
    expect(dragExceeded(3, 3)).toBe(false);
    const summon = { type: "summon", card: { def: {} } };
    const set = { type: "set", card: { def: { spell: { subtype: "normal" } } } };
    const bolt = { type: "activate", card: { def: { spell: { subtype: "normal" } } } };
    expect(actForZoneDrop([summon, set], "mz")).toBe(summon);
    expect(actForZoneDrop([set], "stz")).toBe(set);
    expect(actForBoardDrop([bolt, set])).toBe(bolt);
    expect(attackFromDrop({ kind: "direct" })).toEqual({ targetUid: null });
    expect(attackFromDrop({ kind: "foe", uid: 9 })).toEqual({ targetUid: 9 });
  });
});

describe("post-game hands and replay rewind", () => {
  it("lists both seats face-up by name", () => {
    const G = mkState(1);
    addHand(G, 0, "ember_fox");
    addHand(G, 1, "null_seal");
    const h = revealedHands(G, CARD_DB);
    expect(h.you).toEqual(["Ember Fox"]);
    expect(h.foe).toEqual(["Nullification Seal"]);
  });

  it("stores a board on pushAction and walks back when a step has none", () => {
    const G = mkState(1);
    addHand(G, 0, "ember_fox");
    const rec = startRecording(G);
    expect(hasBoardRewind(rec)).toBe(true);
    expect(boardAt(rec, -1).players[0].hand[0].id).toBe("ember_fox");
    pushAction(rec, { type: "chooseMain", pick: { type: "end" } }, G);
    addHand(G, 1, "null_seal");
    pushAction(rec, { type: "chooseMain", pick: { type: "summon" } });
    pushAction(rec, { type: "end", result: { winner: 0 } }, G);
    expect(rec.actions[0].board.players[0].hand).toHaveLength(1);
    expect(rec.actions[1].board).toBeNull();
    expect(boardAt(rec, 1).players[0].hand[0].id).toBe("ember_fox");
    expect(boardAt(rec, 2).players[1].hand[0].id).toBe("null_seal");
  });

  it("Duel Log tiles are the full engine story, not only start and end", () => {
    const G = mkState(1);
    G.log = [
      { t: 1, phase: "DP", msg: "Duel start — you go first.", cls: "system" },
      { t: 1, phase: "M1", msg: "You Normal Summon Ember Fox (1/1).", cls: "summon" },
      { t: 1, phase: "BP", msg: "Ember Fox attacks directly!", cls: "attack" },
      { t: 2, phase: "M1", msg: "AI Normal Summon Tide Caller (1/2).", cls: "summon" },
      { t: 2, phase: "EP", msg: "You win — foe LP hit 0.", cls: "gameover" }
    ];
    const rec = startRecording(G);
    captureLog(rec, G);
    const tiles = replayLogTiles(rec);
    expect(tiles.length).toBe(5);
    expect(tiles[0].label).toMatch(/Duel start/);
    expect(tiles[1].label).toMatch(/Ember Fox/);
    expect(tiles[2].label).toMatch(/attacks directly/);
    expect(tiles[3].label).toMatch(/Tide Caller/);
    expect(tiles[4].label).toMatch(/You win/);
  });

  it("records CPU io picks, not only the human seat", async () => {
    const G = mkState(1);
    const rec = startRecording(G);
    const io = wrapIoReplay({
      async chooseMain(p) { return { type: "summon", card: { def: { name: p === 0 ? "Ember Fox" : "Tide Caller" } } }; },
      async askAttack(p) { return { attackerUid: p, targetUid: null }; }
    }, rec, G);
    await io.chooseMain(0, []);
    await io.chooseMain(1, []);
    await io.askAttack(1, []);
    await Promise.resolve();
    expect(rec.actions.map((a) => a.action.player)).toEqual([0, 1, 1]);
    expect(rec.actions[1].action.pick.name).toMatch(/Tide Caller/);
  });

  it("maps a log line to the first action whose logLen covers it", () => {
    const rec = { actions: [{ logLen: 2 }, { logLen: 5, board: { ok: 1 } }] };
    expect(actionIndexForLogLine(rec, 0)).toBe(0);
    expect(actionIndexForLogLine(rec, 2)).toBe(1);
    expect(actionIndexForLogLine(rec, -1)).toBe(-1);
  });
});

describe("seen-set, GY search, hand reorder, beds", () => {
  it("remembers public face-up cards and not unseen hand cards", () => {
    const G = mkState(1);
    const fox = addHand(G, 1, "ember_fox");
    const seen = harvestSeen(G, new Set());
    expect(handFaceUp(fox, { seen })).toBe(false);
    addField(G, 1, "cinder_knight", 0, { summonedTurn: 1 });
    const field = P(G, 1).mz[0];
    harvestSeen(G, seen);
    expect(isPublicFace(field)).toBe(true);
    expect(seen.has(field.uid)).toBe(true);
    field.loc = "hand";
    P(G, 1).mz[0] = null;
    P(G, 1).hand.push(field);
    expect(handFaceUp(field, { seen })).toBe(true);
  });

  it("filters GY by name and ignores empty query", () => {
    const fox = { def: { name: "Ember Fox", id: "ember_fox", tribe: "Ignis", text: "Rush" } };
    expect(cardMatchesQuery(fox, "")).toBe(true);
    expect(cardMatchesQuery(fox, "ember")).toBe(true);
    expect(cardMatchesQuery(fox, "abyss")).toBe(false);
  });

  it("reorders a hand without mutating the original list", () => {
    const hand = [{ uid: 1 }, { uid: 2 }, { uid: 3 }];
    expect(reorderHandList(hand, 3, 1).map((c) => c.uid)).toEqual([3, 1, 2]);
    expect(hand.map((c) => c.uid)).toEqual([1, 2, 3]);
  });

  it("ships a city bed and chain/pack/win stingers", () => {
    expect(bedNames()).toEqual(expect.arrayContaining(["hub", "duel", "city"]));
    expect(stingerNames()).toEqual(expect.arrayContaining(["win", "lose", "chain", "evolve", "fusion", "pack", "turnYou", "turnFoe", "set", "summon"]));
  });
});

describe("twenty-third polish: FX speed, mute, chain stack, Esc, GY order", () => {
  it("FX skip zeros waits and does not invent a rules skip", () => {
    expect(normalizeFxSpeed("skip")).toBe(0);
    expect(fxSpeedLabel(0)).toBe("Skip");
    expect(fxSkip(0)).toBe(true);
    expect(fxDelay(500, 1)).toBe(500);
    expect(fxDelay(500, 2)).toBe(250);
    expect(fxDelay(500, 0.5)).toBe(1000);
    expect(fxDelay(500, 0)).toBe(0);
    expect(fxCssPace(2)).toBe(0.5);
  });

  it("mute zeros the bus without changing the stored slider", () => {
    expect(busLevel({ music: 0.6, musicMuted: false }, "music")).toBe(0.6);
    expect(busLevel({ music: 0.6, musicMuted: true }, "music")).toBe(0);
    expect(busLevel({ sfx: 0.8, sfxMuted: true }, "sfx")).toBe(0);
    const s = normalizeSettings({ music: 0.6, musicMuted: true, sfx: 0.8, sfxMuted: false, fxSpeed: 2 });
    expect(s.music).toBe(0.6);
    expect(s.musicMuted).toBe(true);
    expect(s.sfxMuted).toBe(false);
    expect(s.fxSpeed).toBe(2);
  });

  it("resolution setting keeps native plus common PC and phone sizes", () => {
    expect(normalizeSettings({}).resolution).toBe("native");
    expect(normalizeSettings({ resolution: "1280x720" }).resolution).toBe("1280x720");
    expect(normalizeSettings({ resolution: "1366x768" }).resolution).toBe("1366x768");
    expect(normalizeSettings({ resolution: "1440x900" }).resolution).toBe("1440x900");
    expect(normalizeSettings({ resolution: "1920x1080" }).resolution).toBe("1920x1080");
    expect(normalizeSettings({ resolution: "3840x2160" }).resolution).toBe("3840x2160");
    expect(normalizeSettings({ resolution: "360x800" }).resolution).toBe("360x800");
    expect(normalizeSettings({ resolution: "375x812" }).resolution).toBe("375x812");
    expect(normalizeSettings({ resolution: "414x896" }).resolution).toBe("414x896");
    expect(normalizeSettings({ resolution: "garbage" }).resolution).toBe("native");
  });

  it("4K and other oversized presets fill the window instead of shrinking UI", () => {
    const uhd = resolutionFitTransform(3840, 2160, 1600, 900);
    expect(uhd.scale).toBe(1);
    expect(uhd.fill).toBe(true);
    expect(uhd.layoutW).toBe(1600);
    expect(uhd.layoutH).toBe(900);
    expect(uhd.cardScale).toBeCloseTo(1.5);
    const qhd = resolutionFitTransform(2560, 1440, 1600, 900);
    expect(qhd.fill).toBe(true);
    expect(qhd.scale).toBe(1);
    const phone = resolutionFitTransform(360, 800, 1600, 900);
    expect(phone.fill).toBe(false);
    expect(phone.scale).toBeGreaterThan(1);
    expect(phone.x).toBeGreaterThan(400);
    expect(phone.y).toBeCloseTo(0);
    const cover = resolutionFitTransform(1600, 900, 1600, 1000);
    expect(cover.fill).toBe(false);
    expect(cover.scale).toBeCloseTo(1000 / 900);
    expect(cover.y).toBeCloseTo(0);
  });

  it("chain hover targets every link, not only the last", () => {
    const chain = [{ card: { uid: 1 } }, { card: { uid: 2 } }, { card: { uid: 3 } }];
    expect(chainLinkUids(chain)).toEqual([1, 2, 3]);
  });

  it("Esc opens pause during a forced chain", () => {
    expect(escPauseAction({ inDuel: true, pauseOpen: false, inField: false })).toBe("open");
    expect(escPauseAction({ inDuel: true, pauseOpen: true, inField: false })).toBe("close");
    expect(escPauseAction({ inDuel: false, pauseOpen: false, inField: false })).toBe(null);
  });

  it("GY display is newest first and labelled", () => {
    const cards = [{ id: "old" }, { id: "new" }];
    expect(gyNewestFirst(cards).map((c) => c.id)).toEqual(["new", "old"]);
    expect(cards.map((c) => c.id)).toEqual(["old", "new"]);
    expect(gyOrderCaption()).toMatch(/Newest at top/i);
  });
});

describe("Master Duel chain picker", () => {
  it("names the last activating card and does not add a second Confirm", () => {
    const copy = chainWindowTitle([{ card: { def: { name: "Effect Veiler" } } }]);
    expect(copy.plain).toMatch(/The effect of 'Effect Veiler' is activated/);
    expect(copy.plain).toMatch(/Chain another card or effect/);
    expect(copy.html).toMatch(/chain-name/);
    expect(copy.html).toMatch(/chain-kw/);
    expect(copy.plain).not.toMatch(/Effect Activation/i);
  });

  it("escapes card names in the HTML sentence", () => {
    const copy = chainWindowTitle([{ card: { def: { name: "<Veiler>" } } }]);
    expect(copy.html).toContain("&lt;Veiler&gt;");
    expect(copy.html).not.toContain("<Veiler>");
    expect(escapeChainHtml("a&b")).toBe("a&amp;b");
  });

  it("open window and zone labels stay honest", () => {
    expect(lastChainCardName([])).toBe("");
    expect(chainWindowTitle([]).plain).toMatch(/Chain another card or effect/);
    expect(chainWindowTitle([], { damageStep: "dsDuring" }).plain).toMatch(/DAMAGE STEP/);
    expect(chainWindowTitle([], { battleWindow: "declare" }).plain).toMatch(/ATTACK DECLARATION/);
    const dsNamed = chainWindowTitle([{ card: { def: { name: "Surge Imp" } } }], { damageStep: "dsDuring" });
    expect(dsNamed.plain).toMatch(/DAMAGE STEP/);
    expect(dsNamed.plain).toMatch(/Surge Imp/);
    expect(chainActSource({ type: "set" })).toBe("Set");
    expect(chainActSource({ type: "handQuick" })).toBe("Hand");
    expect(chainActSource({ type: "quick" })).toBe("Field");
  });

  it("CL strip caption is last-to-first and not live undo", () => {
    expect(chainLifoCaption()).toMatch(/last → first/i);
  });
});

describe("CPU chain telegraph", () => {
  it("names the chained card and labels a pass as heuristic", () => {
    const legal = [{ type: "set", card: { uid: 9, def: { name: "Null Seal" } } }];
    const fire = describeCpuChainIntent({}, legal, 0);
    expect(fire.heuristic).toBe(true);
    expect(fire.line).toMatch(/CPU will chain Null Seal/i);
    expect(fire.line).toMatch(/Set/);
    const pass = describeCpuChainIntent({}, legal, null);
    expect(pass.kind).toBe("chain-pass");
    expect(pass.line).toMatch(/pass this chain/i);
  });

  it("picks a counter on an opponent link and not on its own", () => {
    const G = mkState(1);
    const seal = { type: "set", card: { def: { name: "Null Seal", cost: 2, spell: { speed: 3, counterWhat: ["spell"] } } } };
    const foe = [{ card: { def: { cost: 2 } }, controller: 0 }];
    const own = [{ card: { def: { cost: 2 } }, controller: 1 }];
    expect(pickChain(G, 1, [seal], foe, { tier: "hard" })).toBe(0);
    expect(pickChain(G, 1, [seal], own, { tier: "hard" })).toBe(null);
  });
});

describe("phone Safari client (Karabast)", () => {
  it("uses 16px Search log, hub inputs, and docks the prompt above the hand on narrow screens", async () => {
    const { readFile } = await import("node:fs/promises");
    const { fileURLToPath } = await import("node:url");
    const { dirname, join } = await import("node:path");
    const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
    const css = await readFile(join(root, "css/mobile.css"), "utf8");
    expect(css).toMatch(/@media \(max-width:\s*720px\)/);
    expect(css).toMatch(/\.log-search[\s\S]*?font-size:\s*16px/);
    expect(css).toMatch(/input\.cb-input/);
    expect(css).toMatch(/select\.cb-select/);
    expect(css).toMatch(/#deck-list-text/);
    expect(css).toMatch(/\.deck-list-text/);
    expect(css).toMatch(/\.prompt-bar\s*\{[^}]*position:\s*relative\s*!important/);
    expect(css).toMatch(/\.prompt-bar\s*\{[^}]*top:\s*auto\s*!important/);
    expect(css).toMatch(/\.prompt-bar\s*\{[^}]*order:\s*6/);
    expect(css).toMatch(/#screen-duel \.prompt-bar\s*\{[^}]*position:\s*relative\s*!important/);
    expect(css).toMatch(/\.you-hand\s*\{\s*order:\s*7/);
    expect(css).not.toMatch(/\.prompt-bar\s*\{[^}]*top:\s*28%/);
    expect(css).toMatch(/\.board\s*\{[^}]*flex:\s*1 1 0/);
    expect(css).toMatch(/#side-panel \.inspector\s*\{\s*display:\s*none/);
    expect(css).toMatch(/#screen-duel \.hud-actions \.mini-btn[\s\S]*?min-height:\s*40px/);
    expect(css).toMatch(/@media \(min-width:\s*721px\)/);
    expect(css).toMatch(/@container stage \(max-width:\s*720px\)/);
    expect(css).toMatch(/@container stage \(min-width:\s*721px\)/);
    expect(css).toMatch(/grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    expect(css).toMatch(/--cw:\s*clamp\(/);
  });
});

describe("duel field pads", () => {
  it("keeps monster and spell pads at card aspect, not stretched mats", async () => {
    const { readFile } = await import("node:fs/promises");
    const { fileURLToPath } = await import("node:url");
    const { dirname, join } = await import("node:path");
    const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
    const css = await readFile(join(root, "css/duel.css"), "utf8");
    expect(css).toMatch(/grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\)/);
    expect(css).toMatch(/grid-template-columns:\s*subgrid/);
    expect(css).toMatch(/#screen-duel \.zone::before[\s\S]*?aspect-ratio:\s*5\s*\/\s*7/);
    expect(css).toMatch(/object-fit:\s*contain/);
    expect(css).toMatch(/#screen-duel \.zone \.cb-card \.card-text\s*\{\s*display:\s*none/);
    expect(css).toMatch(/#screen-duel \.zone \.cb-card \.card-name[\s\S]*?font-size:\s*calc\(var\(--cw\) \* 0\.13\)/);
  });
});

describe("deck door (Splinterlanes)", () => {
  it("parses loaner / starter / custom tokens", () => {
    expect(parseDeckToken("starter:ignis")).toEqual({ kind: "starter", key: "ignis" });
    expect(parseDeckToken("loaner:aggro_swarm")).toEqual({ kind: "loaner", key: "aggro_swarm" });
    expect(parseDeckToken("custom:My List")).toEqual({ kind: "custom", key: "My List" });
    expect(parseDeckToken("")).toEqual({ kind: "starter", key: "ignis" });
  });

  it("lets starters and loaners through without a custom legality check", () => {
    const loaners = shippedLoaners();
    const r = tryQueueDeck("starter:ignis", { starters: STARTERS, loaners, decks: {} });
    expect(r.ok).toBe(true);
    expect(r.label).toMatch(/IGNIS/);
    const L = loaners[0];
    const l = tryQueueDeck(`loaner:${L.id}`, { starters: STARTERS, loaners, decks: {} });
    expect(l.ok).toBe(true);
    expect(l.deck.length).toBeGreaterThan(0);
  });

  it("refuses a short custom list and names the validateDeck error", () => {
    const r = tryQueueDeck("custom:short", {
      starters: STARTERS,
      loaners: [],
      decks: { short: ["ember_fox"] }
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/exactly 40/);
  });

  it("accepts a legal custom list and defaults Ranked to Ignis", () => {
    const r = tryQueueDeck("custom:rush", {
      starters: STARTERS,
      loaners: [],
      decks: { rush: { main: STARTERS.ignis.deck, extra: STARTERS.ignis.extra } }
    });
    expect(r.ok).toBe(true);
    expect(r.deck).toHaveLength(40);
    expect(pickRankedToken({ starters: STARTERS, loaners: [], customNames: ["rush"] })).toBe("starter:ignis");
  });
});

describe("hub polish helpers", () => {
  it("maps pack rarities to slam hit classes", async () => {
    const { slamRarityClass, packRecapLine, packFocusWait, packHoldAfterFlip } = await import("../../src/ui/packSlam.js");
    expect(slamRarityClass("UR")).toBe("hit-ur");
    expect(slamRarityClass("SR")).toBe("hit-sr");
    expect(slamRarityClass("R")).toBe("hit-r");
    expect(slamRarityClass("N")).toBe("hit-n");
    expect(packFocusWait("UR")).toBeGreaterThan(packFocusWait("N"));
    expect(packHoldAfterFlip("UR")).toBeGreaterThan(packHoldAfterFlip("N"));
    expect(packRecapLine([])).toBe("");
    expect(packRecapLine([{ rarity: "N" }, { rarity: "N" }, { rarity: "R" }, { rarity: "SR" }, { rarity: "UR" }]))
      .toBe("UR HIT · 1× UR · 1× SR · 1× R · 2× N");
    expect(packRecapLine([{ rarity: "N" }, { rarity: "SR" }])).toBe("SR · 1× SR · 1× N");
  });

  it("formats wallet gem/coin/dust deltas", async () => {
    const { walletDeltaLine } = await import("../../src/ui/hubToast.js");
    expect(walletDeltaLine(null, { gems: 1 })).toBe("");
    expect(walletDeltaLine(
      { gems: 200, coins: 10, dust: { N: 0, R: 0, SR: 0, UR: 0 } },
      { gems: 100, coins: 10, dust: { N: 10, R: 0, SR: 0, UR: 0 } }
    )).toBe("-100 gems · +10 N dust");
    expect(walletDeltaLine(
      { gems: 50, coins: 0, dust: { N: 0, R: 0, SR: 0, UR: 0 } },
      { gems: 50, coins: 25, dust: { N: 0, R: 0, SR: 0, UR: 0 } }
    )).toBe("+25 coins");
  });

  it("plaza day is brighter than night", async () => {
    const { sampleWorld, setClockMode, plazaClock } = await import("../../src/app/city/plazaTime.ts");
    setClockMode("day");
    const day = sampleWorld(plazaClock.phase);
    setClockMode("night");
    const night = sampleWorld(plazaClock.phase);
    expect(day.sunInt).toBeGreaterThan(night.sunInt);
    expect(night.lamp).toBeGreaterThan(day.lamp);
    setClockMode("day");
  });

  it("plaza textures stay procedural (no GLTF)", async () => {
    const { getPlazaTextures } = await import("../../src/app/city/plazaTextures.ts");
    expect(getPlazaTextures()).toBe(null);
  });

  it("street shops sit on sidewalks and face the road", async () => {
    const { BUILDINGS, KIOSKS, streetYaw, STREET_WALK } = await import("../../src/app/city/buildings.ts");
    for (const b of BUILDINGS) {
      expect(Math.abs(b.position[0])).toBeGreaterThan(8);
      expect(Math.abs(streetYaw(b.position[0], b.position[2]))).toBeCloseTo(Math.PI / 2, 5);
    }
    expect(KIOSKS.every((k) => Math.abs(k.position[0]) > 4)).toBe(true);
    expect(STREET_WALK.x).toBeGreaterThan(8);
    expect(STREET_WALK.z).toBeGreaterThan(20);
  });
});

describe("GitHub Pages shell", () => {
  it("keeps icon, manifest, and service worker on relative URLs so a project site can load", async () => {
    const { readFile } = await import("node:fs/promises");
    const { fileURLToPath } = await import("node:url");
    const { dirname, join } = await import("node:path");
    const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
    const html = await readFile(join(root, "index.html"), "utf8");
    expect(html).toMatch(/href="\.\/manifest\.webmanifest"/);
    expect(html).toMatch(/href="\.\/favicon\.svg"/);
    expect(html).toMatch(/href="\.\/apple-touch-icon\.png"/);
    expect(html).not.toMatch(/href="\/manifest\.webmanifest"/);
    const main = await readFile(join(root, "src/app/main.tsx"), "utf8");
    expect(main).toMatch(/import\.meta\.env\.BASE_URL/);
    expect(main).not.toMatch(/register\("\/sw\.js"\)/);
    const sw = await readFile(join(root, "public/sw.js"), "utf8");
    expect(sw).toMatch(/registration\.scope/);
    const man = JSON.parse(await readFile(join(root, "public/manifest.webmanifest"), "utf8"));
    expect(man.start_url).toBe("./");
    expect(man.scope).toBe("./");
    expect(man.icons.some((ic) => ic.src === "./apple-touch-icon.png")).toBe(true);
  });
});

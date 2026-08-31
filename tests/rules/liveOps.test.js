import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { formatRoomCode, randomRoomCode, serializePick, applyPick, wrapIoPeer, queueModePvp, BACKEND_OFFLINE_REASON } from "../../src/meta/peerNet.js";
import { cardName, cardText } from "../../src/meta/cardLocale.js";
import { CARD_DB } from "../../src/data/cards/index.js";
import { createAccountStore } from "../../backend/accounts.js";
import { backendCandidates, DEFAULT_URL, isStaticHost } from "../../src/meta/backendClient.js";
import { LOCALES, t, setLocale, EN, ES, JA } from "../../src/meta/i18n.js";
import { shippedLoaners, loanerById } from "../../src/data/loaners.js";
import { validateDeck } from "../../src/meta/banlist.js";
import { STARTERS } from "../../src/data/starters.js";
import { makePushSession } from "../../src/meta/duelWire.js";
import { p2pPeerId } from "../../src/meta/p2pDuel.js";
import { exportSaveJson, importSaveJson } from "../../src/meta/backups.js";

describe("peerNet packing", () => {
  it("formats room codes and stays offline without a socket", () => {
    expect(formatRoomCode("ab-12zz")).toBe("AB12ZZ");
    expect(BACKEND_OFFLINE_REASON).toMatch(/offline/i);
    expect(backendCandidates()).toContain(DEFAULT_URL);
    expect(randomRoomCode()).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(isStaticHost("https://eagx1.github.io/Chaind-Blitz")).toBe(true);
    expect(isStaticHost("http://localhost:8787")).toBe(false);
    expect(p2pPeerId("AB12ZZ")).toBe("cbzab12zz");
  });

  it("makePushSession delivers start and pick", async () => {
    const sent = [];
    const s = makePushSession();
    s.setSender((p) => { sent.push(p); return true; });
    s.ingest({ type: "start", seed: 9, host: { deck: [] }, guest: { deck: [] } });
    const start = await s.waitStart(50);
    expect(start.seed).toBe(9);
    const pulled = s.pullAction("chooseMain", 1);
    s.ingest({ type: "pick", packed: { type: "end" } });
    expect(await pulled).toEqual({ type: "end" });
    expect(s.send({ type: "pick" })).toBe(true);
    expect(sent[0].type).toBe("pick");
  });

  it("round-trips chooseMain and askAttack picks", () => {
    const actions = [
      { type: "summon", card: { uid: 7 } },
      { type: "end" }
    ];
    const packed = serializePick("chooseMain", actions[0], [0, actions]);
    expect(applyPick("chooseMain", packed, [0, actions]).card.uid).toBe(7);
    const atk = serializePick("askAttack", { attackerUid: 3, targetUid: null }, [0]);
    expect(applyPick("askAttack", atk, [0])).toEqual({ attackerUid: 3, targetUid: null });
  });

  it("wrapIoPeer sends local picks and applies remote ones", async () => {
    const sent = [];
    const io = {
      async chooseMain(p, actions) {
        return actions.find((a) => a.type === "end");
      }
    };
    wrapIoPeer(io, {
      localSeat: 0,
      send: (p) => sent.push(p),
      pullAction: async () => ({ type: "end" })
    });
    const end = await io.chooseMain(0, [{ type: "end" }]);
    expect(end.type).toBe("end");
    expect(sent[0].packed.type).toBe("end");
    const remote = await io.chooseMain(1, [{ type: "summon" }, { type: "end" }]);
    expect(remote.type).toBe("end");
  });
});

describe("locales", () => {
  it("ships English, Spanish, and Japanese chrome strings", () => {
    expect(LOCALES.map((l) => l.id)).toEqual(["en", "es", "ja"]);
    for (const key of Object.keys(EN)) {
      expect(ES[key], key).toBeTruthy();
      expect(JA[key], key).toBeTruthy();
    }
    setLocale("es");
    expect(t("hub.play")).toBe("Jugar");
    setLocale("ja");
    expect(t("hub.deck")).toBe("デッキ");
    setLocale("en");
    expect(t("hub.play")).toBe("Play");
    expect(t("install.add")).toBe("Add");
  });
});

describe("device save transfer", () => {
  it("round-trips profile JSON through import", () => {
    const store = new Map();
    globalThis.localStorage = {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k)
    };
    expect(importSaveJson("{not json")).toBe(null);
    expect(importSaveJson(JSON.stringify({ name: "Test", gems: 3 })).gems).toBe(3);
    expect(JSON.parse(exportSaveJson()).name).toBe("Test");
  });
});

describe("expand loaners", () => {
  it("ships Token Flood, Spell Engine, Continuous Engine, Lane Hate, Midrange Evolve", () => {
    for (const id of ["token_flood", "spell_engine", "continuous_engine", "lane_hate", "midrange_evolve"]) {
      const d = loanerById(id);
      expect(d, id).toBeTruthy();
      expect(d.deck).toHaveLength(40);
      expect(validateDeck({ main: d.deck, extra: d.extra }).ok, id).toBe(true);
    }
    expect(shippedLoaners().length).toBeGreaterThanOrEqual(45);
  });
});

describe("card locale overlay", () => {
  it("translates names and GY phrasing in ES and JA", () => {
    const def = CARD_DB.jestling;
    expect(def).toBeTruthy();
    setLocale("en");
    expect(cardName(def)).toBe(def.name);
    expect(cardText(def)).toContain("GY");
    setLocale("es");
    expect(cardName(def)).toMatch(/Diablillo/);
    expect(cardText(def)).toMatch(/Cementerio/);
    setLocale("ja");
    expect(cardName(def)).toMatch(/インプ/);
    expect(cardText(def)).toMatch(/墓地/);
    setLocale("en");
    expect(cardName(def)).toBe(def.name);
  });
});

describe("accounts store", () => {
  it("registers, logs in, and rejects a taken name", () => {
    const file = join(mkdtempSync(join(tmpdir(), "cb-acct-")), "accounts.json");
    const store = createAccountStore(file);
    const reg = store.register("Ada", "secret1");
    expect(reg.ok).toBe(true);
    expect(store.userFromToken(reg.token).name).toBe("Ada");
    expect(store.login("ada", "secret1").ok).toBe(true);
    expect(store.login("ada", "nope").ok).toBe(false);
    expect(store.register("Ada", "secret1").error).toMatch(/taken/i);
  });
});

describe("pvp mode queue helper", () => {
  it("exports queueModePvp for ranked, draft, and sealed", () => {
    expect(typeof queueModePvp).toBe("function");
    expect(formatRoomCode("draft1")).toBe("DRAFT1");
  });
});

describe("starters stay 40", () => {
  it("Ignis and Abyss remain legal after the tempo bump", () => {
    expect(STARTERS.ignis.deck).toHaveLength(40);
    expect(STARTERS.abyss.deck).toHaveLength(40);
    expect(validateDeck({ main: STARTERS.ignis.deck, extra: STARTERS.ignis.extra }).ok).toBe(true);
    expect(validateDeck({ main: STARTERS.abyss.deck, extra: STARTERS.abyss.extra }).ok).toBe(true);
    expect(STARTERS.ignis.deck.filter((id) => id === "fever_pitch")).toHaveLength(3);
  });
});

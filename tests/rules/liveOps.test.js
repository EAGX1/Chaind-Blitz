import { describe, it, expect } from "vitest";
import { formatRoomCode, serializePick, applyPick, wrapIoPeer, BACKEND_OFFLINE_REASON } from "../../src/meta/peerNet.js";
import { backendCandidates, DEFAULT_URL } from "../../src/meta/backendClient.js";
import { LOCALES, t, setLocale, EN, ES, JA } from "../../src/meta/i18n.js";
import { shippedLoaners, loanerById } from "../../src/data/loaners.js";
import { validateDeck } from "../../src/meta/banlist.js";
import { STARTERS } from "../../src/data/starters.js";

describe("peerNet packing", () => {
  it("formats room codes and stays offline without a socket", () => {
    expect(formatRoomCode("ab-12zz")).toBe("AB12ZZ");
    expect(BACKEND_OFFLINE_REASON).toMatch(/offline/i);
    expect(backendCandidates()).toContain(DEFAULT_URL);
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

describe("starters stay 40", () => {
  it("Ignis and Abyss remain legal after the tempo bump", () => {
    expect(STARTERS.ignis.deck).toHaveLength(40);
    expect(STARTERS.abyss.deck).toHaveLength(40);
    expect(validateDeck({ main: STARTERS.ignis.deck, extra: STARTERS.ignis.extra }).ok).toBe(true);
    expect(validateDeck({ main: STARTERS.abyss.deck, extra: STARTERS.abyss.extra }).ok).toBe(true);
    expect(STARTERS.ignis.deck.filter((id) => id === "fever_pitch")).toHaveLength(3);
  });
});

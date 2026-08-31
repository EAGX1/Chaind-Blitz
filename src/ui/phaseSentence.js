/** Phase orb copy: short code on the orb, a sentence in the HUD. */

const STEP = {
  dsStart: "Damage Step start",
  dsBefore: "before damage calc",
  dsDuring: "during damage calc",
  dsAfter: "after damage calc",
  dsEnd: "Damage Step end",
  damage: "damage calculation",
  start: "Start Step",
  battle: "Battle Step",
  declare: "attack declaration",
  end: "End Step"
};

const PHASE = {
  DP: { code: "DP", hint: "DRAW", sentence: "Draw Phase — drawing" },
  SP: { code: "SP", hint: "WAIT", sentence: "Standby Phase" },
  M1: { code: "M1", hint: "PLAY", sentence: "Main 1 — play a card or end" },
  BP: { code: "BP", hint: "ATK", sentence: "Battle — attack or end" },
  M2: { code: "M2", hint: "PLAY", sentence: "Main Phase 2 — leftover plays, then end the turn" },
  EP: { code: "EP", hint: "END", sentence: "End Phase" }
};

export function phaseSentence(G) {
  const base = PHASE[G?.phase] || { code: G?.phase || "—", hint: "END", sentence: String(G?.phase || "") };
  const step = STEP[G?.battleStep];
  if (G?.phase === "BP" && step) {
    return {
      code: "BP",
      hint: "ATK",
      sentence: `Battle — ${step}`
    };
  }
  return { ...base };
}

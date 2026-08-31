/** First-duel loaner: Normal Summon, one Set, one chain, one Evolve. 40-card legal lists. */

const FILL = [
  "ember_fox", "cinder_knight", "rush_swarmling", "swift_falcon",
  "ember_spark", "null_seal", "burning_lance", "flame_banner",
  "scroll_greed", "moonwell", "root_snare", "tidal_snare", "heal_bloom", "jestling"
];

function stacked40(opener) {
  const ids = [...opener];
  const count = (id) => ids.filter((x) => x === id).length;
  let i = 0;
  while (ids.length < 40) {
    const id = FILL[i % FILL.length];
    if (count(id) < 3) ids.push(id);
    i++;
    if (i > 400) throw new Error("lessonDuel: cannot fill 40");
  }
  return ids;
}

export const LESSON_YOU = stacked40([
  "ember_fox", "ember_spark", "null_seal", "cinder_knight", "swift_falcon"
]);
export const LESSON_FOE = stacked40([
  "ember_spark", "ember_fox", "cinder_knight", "rush_swarmling", "scroll_greed"
]);

export function shouldStartLesson(profile, { fast = false } = {}) {
  if (fast) return false;
  if (typeof globalThis !== "undefined" && globalThis.__CB_FAST) return false;
  return !profile?.soloGates?.tutorialSeen;
}

export function lessonLossLine(result) {
  const reason = String(result?.reason || "");
  if (/conced/i.test(reason)) return "Concede ends the lesson — rematch and finish the four clicks.";
  if (/decked/i.test(reason)) return "The deck ran out — this fight is about the board, not milling.";
  if (/LP hit 0/i.test(reason)) return "They punched your LP while the board was empty — summon before you end.";
  if (reason) return reason;
  return "The CPU won that line — rematch and follow the glowing card.";
}

export function lessonDuelOpts() {
  return {
    deckYou: LESSON_YOU,
    deckFoe: LESSON_FOE,
    extraYou: [],
    extraFoe: [],
    youName: "LESSON",
    foeName: "SPARRING CPU",
    mode: "pve",
    firstPlayer: 0,
    seed: 41,
    meta: { teachLesson: true, noShuffle: true, aiTier: "easy" },
    onCreated(G) {
      if (G.players?.[0]) G.players[0].evolveTurn = 2;
    }
  };
}

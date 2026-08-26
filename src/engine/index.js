// Public engine API. createDuel builds a fully wired, DOM-free duel; runDuel
// plays it to completion. All player decisions flow through the io object.

import { newGame } from "./state.js";
import { runDuel } from "./game.js";

export * from "./state.js";
export * from "./ops.js";
export * from "./chain.js";
export * from "./triggers.js";
export * from "./game.js";
export * from "./fusion.js";
export * from "./snapshot.js";
export { makeRng } from "./rng.js";

export function createDuel({ cardDb, decks, extras = [[], []], laneDefs, seed = 1, io, meta = {}, firstPlayer = null }) {
  const G = newGame({ seed, laneDefs, meta });
  G.cardDb = cardDb;
  G.io = io;
  G.setup = {
    decks, extras,
    firstPlayer: firstPlayer === 0 || firstPlayer === 1 ? firstPlayer : (G.rng.chance(0.5) ? 0 : 1)
  };
  return G;
}

export async function playDuel(opts) {
  const G = createDuel(opts);
  const result = await runDuel(G);
  return { G, result };
}

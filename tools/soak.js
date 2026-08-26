// Balance soak: run N autopilot duels per starter pairing (both directions),
// report win rates, average duel length, and any engine errors.
import { createDuel, runDuel } from "../src/engine/index.js";
import { makeAutopilot } from "../src/ai/autopilot.js";
import { CARD_DB } from "../src/data/cards/index.js";
import { STARTERS } from "../src/data/starters.js";
import { drawLanes } from "../src/data/fields.js";
import { makeRng } from "../src/engine/rng.js";

const N = Number(process.argv[2] || 24);

async function playOne(seed, deckA, deckB) {
  const laneRng = makeRng(seed ^ 0x9e3779b9);
  const G = createDuel({
    cardDb: CARD_DB,
    decks: [deckA, deckB],
    laneDefs: drawLanes(laneRng, 3),
    seed,
    io: null
  });
  G.io = makeAutopilot(G);
  const r = await runDuel(G);
  return { winner: r.winner, turns: G.turnCount, reason: r.reason, firstPlayer: G.firstPlayer };
}

const ids = Object.keys(STARTERS);
const stats = {};
let errors = 0;
let fpWins = 0, fpGames = 0;

for (const a of ids) {
  for (const b of ids) {
    if (a === b) continue;
    const key = `${a} vs ${b}`;
    stats[key] = { winsA: 0, winsB: 0, draws: 0, turns: 0, games: 0 };
    for (let i = 0; i < N; i++) {
      const seed = 1000 + i * 97;
      try {
        // alternate who goes first by seating
        const [d0, d1] = i % 2 === 0 ? [STARTERS[a].deck, STARTERS[b].deck] : [STARTERS[b].deck, STARTERS[a].deck];
        const r = await playOne(seed, d0, d1);
        stats[key].games++;
        fpGames++;
        if (r.winner === r.firstPlayer) fpWins++;
        stats[key].turns += r.turns;
        const aWon = i % 2 === 0 ? r.winner === 0 : r.winner === 1;
        const bWon = i % 2 === 0 ? r.winner === 1 : r.winner === 0;
        if (aWon) stats[key].winsA++;
        else if (bWon) stats[key].winsB++;
        else stats[key].draws++;
      } catch (e) {
        errors++;
        console.error(`ERROR ${key} seed ${seed}: ${e.message}`);
      }
    }
  }
}

console.log(`\n=== BALANCE SOAK — ${N} duels per pairing (first-player alternated) ===`);
for (const [k, s] of Object.entries(stats)) {
  const wr = ((s.winsA / s.games) * 100).toFixed(0);
  console.log(`${k.padEnd(18)} ${s.winsA}W-${s.winsB}L-${s.draws}D  (${wr}% for ${k.split(" vs ")[0]})  avg turns ${(s.turns / s.games).toFixed(1)}`);
}
console.log(`\nFirst-player win rate: ${((fpWins / fpGames) * 100).toFixed(1)}% over ${fpGames} duels`);
console.log(`Errors: ${errors}`);

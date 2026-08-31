// Round-robin AI vs AI soak for every shipped loaner + starter.
import { createDuel, runDuel } from "../src/engine/index.js";
import { makeAutopilot } from "../src/ai/autopilot.js";
import { CARD_DB } from "../src/data/cards/index.js";
import { shippedLoaners } from "../src/data/loaners.js";
import { STARTERS } from "../src/data/starters.js";
import { drawLanes } from "../src/data/fields.js";
import { makeRng } from "../src/engine/rng.js";

const pool = [
  ...shippedLoaners().map((d) => ({ id: d.id, name: d.name, deck: d.deck, extra: d.extra || [] })),
  ...Object.values(STARTERS).map((d) => ({ id: d.id, name: d.name, deck: d.deck, extra: d.extra || [] }))
];

async function playOne(seed, a, b, firstPlayer) {
  const laneRng = makeRng(seed ^ 0x9e3779b9);
  const G = createDuel({
    cardDb: CARD_DB,
    decks: [a.deck, b.deck],
    extras: [a.extra, b.extra],
    laneDefs: drawLanes(laneRng, 3),
    seed,
    io: null
  });
  G.io = makeAutopilot(G);
  G.setup.firstPlayer = firstPlayer;
  const r = await runDuel(G);
  return { winner: r.winner, turns: G.turnCount, reason: r.reason };
}

const rec = Object.fromEntries(pool.map((d) => [d.id, { name: d.name, w: 0, l: 0, d: 0, games: 0, turns: 0 }]));
let errors = 0;
let n = 0;
const total = pool.length * (pool.length - 1);
const t0 = Date.now();

for (let i = 0; i < pool.length; i++) {
  for (let j = 0; j < pool.length; j++) {
    if (i === j) continue;
    const a = pool[i], b = pool[j];
    const seed = 2000 + i * 97 + j * 13;
    try {
      const r = await playOne(seed, a, b, 0);
      rec[a.id].games++; rec[b.id].games++;
      rec[a.id].turns += r.turns; rec[b.id].turns += r.turns;
      if (r.winner === 0) { rec[a.id].w++; rec[b.id].l++; }
      else if (r.winner === 1) { rec[b.id].w++; rec[a.id].l++; }
      else { rec[a.id].d++; rec[b.id].d++; }
    } catch (e) {
      errors++;
      process.stderr.write(`ERROR ${a.id} vs ${b.id}: ${e.message}\n`);
    }
    n++;
    if (n % 50 === 0) {
      process.stderr.write(`… ${n}/${total} ${(Date.now() - t0) / 1000 | 0}s\n`);
    }
  }
}

const ranked = Object.entries(rec)
  .map(([id, s]) => ({ id, ...s, wr: s.games ? s.w / s.games : 0 }))
  .sort((a, b) => a.wr - b.wr);

console.log(`\n=== LOANER ROUND-ROBIN — ${total} duels, P0 always first ===`);
for (const s of ranked) {
  const wr = (s.wr * 100).toFixed(1);
  console.log(`${s.name.padEnd(24)} ${String(s.w).padStart(3)}W-${String(s.l).padStart(3)}L-${s.d}D  ${wr}%  avgT ${(s.turns / Math.max(1, s.games)).toFixed(1)}`);
}
console.log(`\nErrors: ${errors}`);
const low = ranked.filter((s) => s.wr < 0.40);
const high = ranked.filter((s) => s.wr > 0.60);
console.log("BELOW 40%:", low.map((s) => `${s.id}:${(s.wr * 100).toFixed(0)}%`).join(", ") || "(none)");
console.log("ABOVE 60%:", high.map((s) => `${s.id}:${(s.wr * 100).toFixed(0)}%`).join(", ") || "(none)");
console.log(`Elapsed: ${((Date.now() - t0) / 1000).toFixed(1)}s`);

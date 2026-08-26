// Roguelike run mode (Slay-the-Spire loop) — pure logic, fully serializable.
// Run state lives on profile.rogue and persists via localStorage.

import { ROGUE_STARTER } from "../data/starters.js";
import { makeRng } from "../engine/rng.js";

export const RUN_LP = 20;           // duels inside a run use this as base LP
export const ELITE_FOE_LP = 6;      // bonus LP granted to elite/boss foes
export const BOSS_FOE_LP = 10;
export const REMOVE_PRICE = 25;

/* ------------------------------------------------------------------ *
 *  Deterministic, serializable RNG: every random roll inside a run    *
 *  derives from (run.seed ^ run.rngCalls++), so a saved run replays   *
 *  identically after reload.                                          *
 * ------------------------------------------------------------------ */
export function runRng(run) {
  return makeRng((run.seed ^ (0x9e3779b9 + run.rngCalls++ * 0x85ebca6b)) >>> 0);
}

/* ------------------------------ RELICS ---------------------------- */
export const RELICS = {
  ember_charm:  { id: "ember_charm",  name: "Ember Charm",  icon: "🔥", desc: "After each win, heal 3 HP.", price: 40 },
  greedy_idol:  { id: "greedy_idol",  name: "Greedy Idol",  icon: "🗿", desc: "+15 gold from every battle win.", price: 50 },
  vital_core:   { id: "vital_core",   name: "Vital Core",   icon: "❤",  desc: "+6 Max HP (heal 6 on pickup).", price: 55,
                  onPickup(run) { run.maxHp += 6; run.hp = Math.min(run.maxHp, run.hp + 6); } },
  swift_boots:  { id: "swift_boots",  name: "Swift Boots",  icon: "👢", desc: "Draw an extra card at the start of each duel.", price: 45,
                  duelMods() { return { extraDraw: 1 }; } },
  iron_aegis:   { id: "iron_aegis",   name: "Iron Aegis",   icon: "🛡", desc: "Start each duel with +4 LP.", price: 55,
                  duelMods() { return { lpBonus: 4 }; } },
  lucky_coin:   { id: "lucky_coin",   name: "Lucky Coin",   icon: "🪙", desc: "Shop prices are 25% lower.", price: 35 },
  hunter_eye:   { id: "hunter_eye",   name: "Hunter's Eye", icon: "👁", desc: "Battle rewards offer 4 cards instead of 3.", price: 45 },
  purge_stone:  { id: "purge_stone",  name: "Purge Stone",  icon: "💠", desc: "Rest sites let you heal AND remove a card.", price: 40 }
};

export function hasRelic(run, id) { return run.relics.includes(id); }

// Combined duel-start modifiers from all owned relics.
export function duelMods(run) {
  const mods = { extraDraw: 0, lpBonus: 0 };
  for (const id of run.relics) {
    const m = RELICS[id]?.duelMods?.();
    if (m) { mods.extraDraw += m.extraDraw || 0; mods.lpBonus += m.lpBonus || 0; }
  }
  return mods;
}

/* --------------------------- MAP GENERATION ------------------------ */
// 6 columns: battle | mixed | elite/rest | mixed | rest/elite | boss
const COL_SPECS = [
  { count: 2, types: ["battle"] },
  { count: 3, types: ["battle", "battle", "event"] },
  { count: 3, types: ["elite", "rest", "battle"] },
  { count: 3, types: ["battle", "shop", "event"] },
  { count: 2, types: ["rest", "elite"] },
  { count: 1, types: ["boss"] }
];

export function genMap(rng) {
  const cols = COL_SPECS.map((spec, c) => {
    // shuffle the spec's type list, then tile/truncate to count, boss always boss
    const bag = rng.shuffle(spec.types.slice());
    return Array.from({ length: spec.count }, (_, i) => ({
      id: `c${c}n${i}`,
      col: c,
      type: c === COL_SPECS.length - 1 ? "boss" : bag[i % bag.length],
      next: [],
      state: c === 0 ? "open" : "locked"
    }));
  });
  // edges: every node links to 1-2 nodes in the next column; guarantee coverage
  for (let c = 0; c < cols.length - 1; c++) {
    const cur = cols[c], nxt = cols[c + 1];
    const covered = new Set();
    for (const n of cur) {
      const links = nxt.length === 1 ? [0] : [rng.int(nxt.length)];
      if (rng.chance(0.45) && nxt.length > 1) {
        let alt = rng.int(nxt.length);
        if (alt !== links[0]) links.push(alt);
      }
      for (const i of links) {
        const id = nxt[i].id;
        if (!n.next.includes(id)) n.next.push(id);
        covered.add(id);
      }
    }
    // ensure every next node is reachable
    for (const nn of nxt) {
      if (!covered.has(nn.id)) {
        const src = rng.pick(cur);
        src.next.push(nn.id);
      }
    }
  }
  return cols;
}

export function allNodes(run) { return run.map.flat(); }
export function nodeById(run, id) { return allNodes(run).find((n) => n.id === id) || null; }
export function openNodes(run) { return allNodes(run).filter((n) => n.state === "open"); }

/* ------------------------------ RUN STATE -------------------------- */
export function newRun(seed = 1) {
  const rng = makeRng(seed >>> 0);
  return {
    seed: seed >>> 0,
    rngCalls: 0,
    deck: ROGUE_STARTER.slice(),
    hp: RUN_LP,
    maxHp: RUN_LP,
    gold: 30,
    relics: [],
    map: genMap(rng),
    floor: 0,               // battles cleared
    current: null,          // node id being resolved
    pendingReward: null,    // { choices:[ids], source }
    pendingRelic: null,     // { choices:[relicIds] } after elites
    pendingEvent: null,     // event id awaiting an option choice
    pendingShop: null,      // { cards:[{id,price}], relic:{id,price}, removePrice }
    pendingRest: false,
    over: false,
    won: false,
    claimed: false,
    log: ["The run begins. 20 cards, 20 HP, 30 gold."]
  };
}

export function say(run, msg) {
  run.log.push(msg);
  if (run.log.length > 60) run.log.shift();
}

export function canEnter(run, id) {
  const n = nodeById(run, id);
  return !!n && n.state === "open" && !run.over && !run.current
    && !run.pendingReward && !run.pendingRelic && !run.pendingEvent && !run.pendingShop && !run.pendingRest;
}

export function enterNode(run, id) {
  if (!canEnter(run, id)) return null;
  const n = nodeById(run, id);
  n.state = "active";
  run.current = id;
  return n;
}

// after a non-battle node resolves (or battle reward claimed)
export function clearCurrent(run) {
  const n = nodeById(run, run.current);
  if (n) {
    n.state = "cleared";
    for (const id of n.next) {
      const nn = nodeById(run, id);
      if (nn && nn.state === "locked") nn.state = "open";
    }
  }
  run.current = null;
}

/* ------------------------------ BATTLES ---------------------------- */
export function foeLpBonus(node) {
  return node?.type === "elite" ? ELITE_FOE_LP : node?.type === "boss" ? BOSS_FOE_LP : 0;
}

// result: { won, lpLeft }  lpLeft = player's LP when the duel ended
export function resolveBattle(run, { won, lpLeft }) {
  const node = nodeById(run, run.current);
  if (won) {
    run.hp = Math.max(1, Math.min(run.maxHp, lpLeft));
    run.floor++;
    const base = node?.type === "boss" ? 40 : node?.type === "elite" ? 30 : 18;
    let gold = base + (hasRelic(run, "greedy_idol") ? 15 : 0);
    run.gold += gold;
    say(run, `${node?.type === "boss" ? "Boss" : node?.type === "elite" ? "Elite" : "Battle"} won! +${gold} gold. HP now ${run.hp}/${run.maxHp}.`);
    if (hasRelic(run, "ember_charm")) {
      run.hp = Math.min(run.maxHp, run.hp + 3);
      say(run, "Ember Charm glows: +3 HP.");
    }
    if (node?.type === "boss") {
      run.over = true;
      run.won = true;
      say(run, "The boss falls. RUN COMPLETE!");
      clearCurrent(run);
      return { done: true, reward: null };
    }
    return { done: false, reward: "card", elite: node?.type === "elite" };
  }
  run.hp = 0;
  run.over = true;
  say(run, `Defeated on floor ${run.floor + 1}. The run is over.`);
  return { done: true, reward: null };
}

/* --------------------------- CARD REWARDS -------------------------- */
const RARITY_W = [["N", 0.55], ["R", 0.30], ["SR", 0.12], ["UR", 0.03]];

export function rollCardChoices(run, poolDefs) {
  const rng = runRng(run);
  const n = hasRelic(run, "hunter_eye") ? 4 : 3;
  const out = [];
  let guard = 200;
  while (out.length < n && guard-- > 0) {
    const roll = rng.next();
    let acc = 0, rarity = "N";
    for (const [r, w] of RARITY_W) { acc += w; if (roll < acc) { rarity = r; break; } }
    const bucket = poolDefs.filter((d) => d.rarity === rarity);
    const pick = rng.pick(bucket.length ? bucket : poolDefs);
    if (pick && !out.includes(pick.id)) out.push(pick.id);
  }
  return out;
}

export function openCardReward(run, poolDefs, source = "battle") {
  run.pendingReward = { choices: rollCardChoices(run, poolDefs), source };
}

export function pickReward(run, cardId) {
  if (!run.pendingReward) return false;
  if (cardId != null) {
    if (!run.pendingReward.choices.includes(cardId)) return false;
    run.deck.push(cardId);
    say(run, `Added ${cardId} to the run deck (${run.deck.length} cards).`);
  } else {
    say(run, "Skipped the card reward.");
  }
  run.pendingReward = null;
  if (run.pendingRelic == null && run.current) clearCurrent(run);
  return true;
}

/* ------------------------------ ELITES ----------------------------- */
export function rollRelicChoices(run, k = 3) {
  const rng = runRng(run);
  const unowned = Object.keys(RELICS).filter((id) => !hasRelic(run, id));
  rng.shuffle(unowned);
  return unowned.slice(0, Math.min(k, unowned.length));
}

export function openRelicReward(run) {
  const choices = rollRelicChoices(run);
  if (!choices.length) { if (run.current) clearCurrent(run); return; }
  run.pendingRelic = { choices };
}

export function pickRelic(run, relicId) {
  if (!run.pendingRelic || !run.pendingRelic.choices.includes(relicId)) return false;
  run.relics.push(relicId);
  RELICS[relicId].onPickup?.(run);
  say(run, `Relic gained: ${RELICS[relicId].name} — ${RELICS[relicId].desc}`);
  run.pendingRelic = null;
  if (run.current) clearCurrent(run);
  return true;
}

/* ------------------------------- REST ------------------------------ */
export function openRest(run) { run.pendingRest = true; }

export function restHealAmount(run) { return Math.ceil(run.maxHp * 0.3); }

export function applyRest(run, { heal = false, removeIdx = null }) {
  if (!run.pendingRest) return false;
  const both = hasRelic(run, "purge_stone");
  let acted = false;
  if (heal) {
    const amt = restHealAmount(run);
    run.hp = Math.min(run.maxHp, run.hp + amt);
    say(run, `Rested: +${amt} HP (now ${run.hp}/${run.maxHp}).`);
    acted = true;
  }
  if (removeIdx != null && run.deck[removeIdx] != null) {
    if (heal && !both) return acted; // heal consumed the visit
    const [rm] = run.deck.splice(removeIdx, 1);
    say(run, `Purged ${rm} from the run deck.`);
    acted = true;
  }
  if (acted) {
    run.pendingRest = false;
    if (run.current) clearCurrent(run);
  }
  return acted;
}

/* ------------------------------- SHOP ------------------------------ */
const CARD_PRICE = { N: 12, R: 20, SR: 34, UR: 55 };

export function price(run, base) {
  return hasRelic(run, "lucky_coin") ? Math.max(1, Math.round(base * 0.75)) : base;
}

export function openShop(run, poolDefs) {
  const rng = runRng(run);
  const cards = [];
  let guard = 100;
  while (cards.length < 3 && guard-- > 0) {
    const d = rng.pick(poolDefs);
    if (!cards.some((c) => c.id === d.id)) cards.push({ id: d.id, price: price(run, CARD_PRICE[d.rarity]) });
  }
  const relicPool = Object.keys(RELICS).filter((id) => !hasRelic(run, id));
  const relicId = relicPool.length ? rng.pick(relicPool) : null;
  run.pendingShop = {
    cards,
    relic: relicId ? { id: relicId, price: price(run, RELICS[relicId].price) } : null,
    removePrice: price(run, REMOVE_PRICE)
  };
}

export function buyShopCard(run, idx) {
  const s = run.pendingShop;
  const item = s?.cards[idx];
  if (!item || item.sold || run.gold < item.price) return false;
  run.gold -= item.price;
  item.sold = true;
  run.deck.push(item.id);
  say(run, `Bought ${item.id} for ${item.price}g.`);
  return true;
}

export function buyShopRelic(run) {
  const s = run.pendingShop;
  if (!s?.relic || s.relic.sold || run.gold < s.relic.price) return false;
  run.gold -= s.relic.price;
  s.relic.sold = true;
  run.relics.push(s.relic.id);
  RELICS[s.relic.id].onPickup?.(run);
  say(run, `Bought relic ${RELICS[s.relic.id].name}.`);
  return true;
}

export function buyShopRemove(run, deckIdx) {
  const s = run.pendingShop;
  if (!s || s.removeSold || run.gold < s.removePrice || run.deck[deckIdx] == null) return false;
  run.gold -= s.removePrice;
  s.removeSold = true;
  const [rm] = run.deck.splice(deckIdx, 1);
  say(run, `Removed ${rm} for ${s.removePrice}g.`);
  return true;
}

export function leaveShop(run) {
  if (!run.pendingShop) return false;
  run.pendingShop = null;
  say(run, "Left the shop.");
  if (run.current) clearCurrent(run);
  return true;
}

/* ------------------------------ EVENTS ----------------------------- */
export const EVENTS = {
  spring: {
    id: "spring", title: "Moonlit Spring", icon: "⛲",
    text: "A spring hums with stored blitz energy. The water glows faintly.",
    options: [
      { label: "Drink deep — heal 6 HP", apply(run) { run.hp = Math.min(run.maxHp, run.hp + 6); say(run, "Spring water: +6 HP."); } },
      { label: "Bottle it — gain 20 gold", apply(run) { run.gold += 20; say(run, "Sold the spring water: +20 gold."); } }
    ]
  },
  gambler: {
    id: "gambler", title: "The Chain Gambler", icon: "🎲",
    text: "A hooded duelist offers a sealed card from his sleeve. 'Fifteen gold. No refunds.'",
    options: [
      { label: "Pay 15g for a random card", needsGold: 15,
        apply(run, rng, poolDefs) {
          run.gold -= 15;
          const d = rng.pick(poolDefs);
          run.deck.push(d.id);
          say(run, `The gambler grins: you got ${d.id}.`);
        } },
      { label: "Walk away", apply(run) { say(run, "You keep your coins."); } }
    ]
  },
  shrine: {
    id: "shrine", title: "Bleeding Shrine", icon: "🩸",
    text: "A shrine drinking from an old duel scar. It demands a tithe of vitality.",
    options: [
      { label: "Offer 4 HP for a relic",
        apply(run, rng) {
          run.hp = Math.max(1, run.hp - 4);
          const picks = rollRelicChoices(run, 1);
          if (picks.length) {
            run.relics.push(picks[0]);
            RELICS[picks[0]].onPickup?.(run);
            say(run, `The shrine accepts. Relic: ${RELICS[picks[0]].name}.`);
          } else say(run, "The shrine has nothing left to give.");
        } },
      { label: "Leave it be", apply(run) { say(run, "You back away slowly."); } }
    ]
  }
};

export function openEvent(run) {
  const rng = runRng(run);
  const id = rng.pick(Object.keys(EVENTS));
  run.pendingEvent = id;
  return EVENTS[id];
}

export function applyEvent(run, optionIdx, poolDefs) {
  const ev = EVENTS[run.pendingEvent];
  const opt = ev?.options[optionIdx];
  if (!opt) return false;
  if (opt.needsGold && run.gold < opt.needsGold) return false;
  opt.apply(run, runRng(run), poolDefs);
  run.pendingEvent = null;
  if (run.current) clearCurrent(run);
  return true;
}

/* --------------------------- RUN COMPLETION ------------------------ */
// Gems/packs granted to the meta profile when a run ends (win or lose).
export function runMetaRewards(run) {
  if (run.claimed) return null;
  run.claimed = true;
  const gems = run.won ? 300 : 10 * run.floor;
  const packs = run.won ? 2 : run.floor >= 5 ? 1 : 0;
  return { gems, packs };
}

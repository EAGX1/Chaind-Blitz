// Field Lane pool — the Marvel Snap layer. Each duel draws 3 distinct lanes.
// Lane 1 (zones 0-1) reveals at duel start, lane 2 (zones 2-3) on turn 3,
// lane 3 (zones 4-5, and those spell columns) on turn 5.
//
// Hooks: modifyStat(G,lane,card,v,stat), locksZone(G,lane,p,z),
// locksSpellZone, noAttack, onSummon(G,lane,card), onTurnEnd(G,lane),
// onReveal(G,lane)

import { log, monstersOf, opp, P, monsterLevel, hasKeyword, makeCard, getATK, pushEvents } from "../engine/state.js";
import {
  buff, damageMonster, sweepDestroyed, healPlayer, drawCards, dealDamageToPlayer,
  banishCard, mill, destroyByEffect, bounceToHand, placeMonster, moveTo, discardCard,
  setMonsterFaceDown
} from "../engine/ops.js";
import { TOKEN_DB } from "./cards/tokens.js";

const stat = (atkFn) => (G, lane, card, v, s) => atkFn(G, lane, card, v, s);

function laneZones(lane) {
  const a = lane.index * 2;
  return [a, a + 1];
}
function inLane(lane, card) {
  const [a, b] = laneZones(lane);
  return card.zone === a || card.zone === b;
}
function monstersInLane(G, p, lane) {
  return monstersOf(G, p).filter((m) => inLane(lane, m));
}
function freeZoneInLane(G, p, lane) {
  const pl = P(G, p);
  for (const z of laneZones(lane)) if (!pl.mz[z]) return z;
  return -1;
}
function preLaneStat(G, card, which) {
  let v = (which === "atk" ? card.def.atk : card.def.def) || 0;
  v += (which === "atk" ? card.atkMod : card.defMod) + (card.evolved ? 2 : 0);
  if (card.tempTurn === G.turnCount) v += which === "atk" ? card.tempAtk : card.tempDef;
  return v;
}
function isQuietMonster(def) {
  if (!def || def.type !== "monster") return false;
  if (def.triggers?.length || def.ignition || def.quick || def.continuous) return false;
  if (def.evolveEffect) return false;
  return true;
}
function laneSrc(lane) {
  return { def: { name: lane.def.name } };
}
function spawnTokenHere(G, p, lane, id) {
  const z = freeZoneInLane(G, p, lane);
  if (z < 0) return null;
  const t = makeCard(id, TOKEN_DB[id], p);
  placeMonster(G, t, p, z);
  pushEvents(G, [{ type: "specialSummon", card: t, player: p, source: null }]);
  return t;
}
function shuffleHandToDeck(G, p) {
  const pl = P(G, p);
  for (const c of pl.hand) { c.loc = "deck"; pl.deck.push(c); }
  pl.hand = [];
  G.rng.shuffle(pl.deck);
}
function gyToDeck(G, p) {
  const pl = P(G, p);
  while (pl.gy.length) {
    const c = pl.gy.pop();
    c.loc = "deck";
    pl.deck.push(c);
  }
  G.rng.shuffle(pl.deck);
}
function addRandomFromDeck(G, p, pred) {
  const pl = P(G, p);
  const hits = pl.deck.filter(pred);
  if (!hits.length) return null;
  const pick = G.rng.pick(hits);
  const i = pl.deck.indexOf(pick);
  if (i >= 0) pl.deck.splice(i, 1);
  pick.loc = "hand";
  pl.hand.push(pick);
  return pick;
}
function lockLaneZones(lane, z) {
  const [a, b] = laneZones(lane);
  return z === a || z === b;
}
function hasAnyKeyword(c) {
  return hasKeyword(c, "rush") || hasKeyword(c, "ward") || !!(c.def?.keywords?.length);
}
function lowerLpPlayer(G) {
  const a = P(G, 0).lp, b = P(G, 1).lp;
  if (a === b) return null;
  return a < b ? 0 : 1;
}
function destroySpellsInLane(G, lane) {
  const [a, b] = laneZones(lane);
  for (const p of [0, 1]) {
    for (const z of [a, b]) {
      const c = P(G, p).stz[z];
      if (c) destroyByEffect(G, c, laneSrc(lane));
    }
  }
}

export const FIELD_LANES = [
  {
    id: "ember_rift", name: "Ember Rift", text: "Monsters in this lane get +2/+0.",
    modifyStat: stat((G, lane, c, v, s) => s === "atk" ? v + 2 : v)
  },
  {
    id: "frozen_wastes", name: "Frozen Wastes", text: "Monsters in this lane get -1/-0.",
    modifyStat: stat((G, lane, c, v, s) => s === "atk" ? v - 1 : v)
  },
  {
    id: "razor_cliffs", name: "Razor Cliffs", text: "Monsters in this lane get +1/-1.",
    modifyStat: stat((G, lane, c, v, s) => s === "atk" ? v + 1 : s === "def" ? v - 1 : v)
  },
  {
    id: "high_ground", name: "High Ground", text: "Monsters in this lane get +1/+1.",
    modifyStat: stat((G, lane, c, v, s) => v + 1)
  },
  {
    id: "whispering_hollow", name: "Whispering Hollow", text: "Monsters in this lane get -1/-1.",
    modifyStat: stat((G, lane, c, v, s) => v - 1)
  },
  {
    id: "ancient_grove", name: "Ancient Grove", text: "Monsters summoned in this lane get +0/+2 permanently.",
    onSummon: (G, lane, card) => { buff(G, card, 0, 2, { permanent: true }); }
  },
  {
    id: "war_drum", name: "War Drum Plateau", text: "Monsters summoned in this lane get +1/+0 permanently.",
    onSummon: (G, lane, card) => { buff(G, card, 1, 0, { permanent: true }); }
  },
  {
    id: "mana_geyser", name: "Life Spring", text: "When you summon a monster in this lane, heal 1 LP.",
    onSummon: (G, lane, card) => { healPlayer(G, card.controller, 1); }
  },
  {
    id: "mirror_pool", name: "Mirror Pool", text: "When you summon a monster in this lane, draw 1 card.",
    onSummon: (G, lane, card) => { drawCards(G, card.controller, 1); }
  },
  {
    id: "cursed_ground", name: "Cursed Ground", text: "At the end of your turn, your monsters in this lane take 1 damage.",
    onTurnEnd: (G, lane) => {
      for (const m of monstersOf(G, G.tp)) {
        if (m.zone === lane.index * 2 || m.zone === lane.index * 2 + 1) damageMonster(G, m, 1, null);
      }
      sweepDestroyed(G);
    }
  },
  {
    id: "sealed_cavern", name: "Sealed Cavern", text: "The monster zones of this lane are sealed — nothing can be summoned there.",
    locksZone: (G, lane, p, z) => z === lane.index * 2 || z === lane.index * 2 + 1
  },
  {
    id: "sanctum_chains", name: "Sanctum of Chains", text: "Monsters summoned here gain Ward.",
    onSummon: (G, lane, card) => {
      card.wardGranted = true;
      log(G, `${card.def.name} gains Ward from Sanctum of Chains.`, "lane");
    }
  },
  {
    id: "thunder_mesa", name: "Thunder Mesa", text: "Monsters in this lane get +2/-1.",
    modifyStat: stat((G, lane, c, v, s) => s === "atk" ? v + 2 : s === "def" ? v - 1 : v)
  },
  {
    id: "stillwater", name: "Stillwater Basin", text: "Monsters in this lane get +0/+2.",
    modifyStat: stat((G, lane, c, v, s) => s === "def" ? v + 2 : v)
  },
  {
    id: "crossroads", name: "Crossroads", text: "When you summon here, both players draw 1.",
    onSummon: (G, lane, card) => { drawCards(G, 0, 1); drawCards(G, 1, 1); }
  },
  {
    id: "ashfall", name: "Ashfall Caldera", text: "At turn end, deal 1 to enemy monsters in this lane.",
    onTurnEnd: (G, lane) => {
      const o = 1 - G.tp;
      for (const m of monstersOf(G, o)) {
        if (m.zone === lane.index * 2 || m.zone === lane.index * 2 + 1) damageMonster(G, m, 1, null);
      }
      sweepDestroyed(G);
    }
  },
  {
    id: "glass_spire", name: "Glass Spire", text: "Monsters in this lane get +3 ATK.",
    modifyStat: stat((G, lane, c, v, s) => s === "atk" ? v + 3 : v)
  },
  {
    id: "rootbound", name: "Rootbound Path", text: "Monsters summoned here heal you for 2.",
    onSummon: (G, lane, card) => { healPlayer(G, card.controller, 2); }
  },
  {
    id: "nightmarket", name: "Nightmarket", text: "Summon here: if you have 3 or fewer cards in hand, draw 1.",
    onSummon: (G, lane, card) => {
      if (P(G, card.controller).hand.length <= 3) drawCards(G, card.controller, 1);
    }
  },
  {
    id: "iron_gate", name: "Iron Gate", text: "One zone in this lane is sealed (even index).",
    locksZone: (G, lane, p, z) => z === lane.index * 2
  },
  {
    id: "echo_canyon", name: "Echo Canyon", text: "Monsters here get +1/+1.",
    modifyStat: stat((G, lane, c, v, s) => v + 1)
  },
  {
    id: "sunken_forum", name: "Sunken Forum", text: "Summon here: deal 1 to the enemy leader.",
    onSummon: (G, lane, card) => { dealDamageToPlayer(G, opp(card.controller), 1, card); }
  },
  {
    id: "blade_orchard", name: "Blade Orchard", text: "Monsters here get +2/+1.",
    modifyStat: stat((G, lane, c, v, s) => s === "atk" ? v + 2 : s === "def" ? v + 1 : v)
  },
  {
    id: "quiet_library", name: "Quiet Library", text: "Summon here: draw 1.",
    onSummon: (G, lane, card) => { drawCards(G, card.controller, 1); }
  },
  {
    id: "blood_tide", name: "Blood Tide", text: "Monsters here get +0/+3.",
    modifyStat: stat((G, lane, c, v, s) => s === "def" ? v + 3 : v)
  },
  {
    id: "skybridge", name: "Skybridge", text: "Monsters summoned here gain Rush.",
    onSummon: (G, lane, card) => {
      card.rushGranted = true;
      log(G, `${card.def.name} gains Rush from Skybridge.`, "lane");
    }
  },
  {
    id: "ruin_clock", name: "Ruin Clock", text: "Turn end: your monsters here take 1.",
    onTurnEnd: (G, lane) => {
      for (const m of monstersOf(G, G.tp)) {
        if (m.zone === lane.index * 2 || m.zone === lane.index * 2 + 1) damageMonster(G, m, 1, null);
      }
      sweepDestroyed(G);
    }
  },
  {
    id: "aurora_steppe", name: "Aurora Steppe", text: "Monsters here get +1/+0.",
    modifyStat: stat((G, lane, c, v, s) => s === "atk" ? v + 1 : v)
  },
  {
    id: "haste_dunes", name: "Haste Dunes", text: "Monsters summoned here gain Rush — they can attack this turn.",
    onSummon: (G, lane, card) => {
      card.rushGranted = true;
      log(G, `${card.def.name} bursts out of the Haste Dunes with Rush!`, "lane");
    }
  },
  {
    id: "solar_flare", name: "Solar Flare", text: "During your turn, monsters in this lane get +2 ATK.",
    modifyStat: stat((G, lane, c, v, s) => (s === "atk" && G.tp === c.controller) ? v + 2 : v)
  },
  {
    id: "moon_veil", name: "Moon Veil", text: "During the opponent's turn, monsters in this lane get +2 DEF.",
    modifyStat: stat((G, lane, c, v, s) => (s === "def" && G.tp !== c.controller) ? v + 2 : v)
  },
  {
    id: "colosseum", name: "The Colosseum", text: "Each player may control only 1 monster in this lane.",
    locksZone: (G, lane, p, z) => {
      const a = lane.index * 2, b = a + 1;
      if (z !== a && z !== b) return false;
      const pl = P(G, p);
      const filled = (pl.mz[a] ? 1 : 0) + (pl.mz[b] ? 1 : 0);
      return filled >= 1 && !pl.mz[z];
    }
  },
  {
    id: "gravity_well", name: "Gravity Well", text: "Monsters in this lane cannot declare attacks.",
    noAttack: true
  },
  {
    id: "vampire_fen", name: "Vampire Fen", text: "Summon here: deal 1 to the enemy leader and heal 1.",
    onSummon: (G, lane, card) => {
      dealDamageToPlayer(G, opp(card.controller), 1, card);
      healPlayer(G, card.controller, 1);
    }
  },
  {
    id: "storm_spire", name: "Storm Spire", text: "At the end of your turn, if you have a monster here, deal 1 to the enemy leader.",
    onTurnEnd: (G, lane) => {
      const here = monstersOf(G, G.tp).some((m) => m.zone === lane.index * 2 || m.zone === lane.index * 2 + 1);
      if (here) dealDamageToPlayer(G, opp(G.tp), 1, null);
    }
  },
  {
    id: "wild_surge", name: "Wild Surge", text: "Monsters summoned here get +2/+2 until end of turn.",
    onSummon: (G, lane, card) => { buff(G, card, 2, 2, { permanent: false }); }
  },
  {
    id: "banish_gate", name: "Banish Gate", text: "Summon here: banish the top card of your deck.",
    onSummon: (G, lane, card) => {
      const top = P(G, card.controller).deck[0];
      if (top) {
        const ev = banishCard(G, top, { from: "deck", kind: "lane" });
        if (ev) log(G, `Banish Gate swallows ${top.def.name}.`, "lane");
      }
    }
  },
  {
    id: "spell_lock", name: "Spelllock Reef", text: "Spell zones in this lane are sealed.",
    locksSpellZone: (G, lane, p, z) => z === lane.index * 2 || z === lane.index * 2 + 1
  },
  {
    id: "twin_sun", name: "Twin Suns", text: "If you control 2 monsters in this lane, they both get +2/+2.",
    modifyStat: stat((G, lane, c, v, s) => {
      const a = lane.index * 2, b = a + 1;
      const pl = P(G, c.controller);
      if (pl.mz[a] && pl.mz[b]) return v + 2;
      return v;
    })
  },
  {
    id: "fog_bank", name: "Fog Bank", text: "Monsters in this lane get -2 ATK (the fog blunts every blade).",
    modifyStat: stat((G, lane, c, v, s) => s === "atk" ? v - 2 : v)
  },
  {
    id: "phoenix_nest", name: "Phoenix Nest", text: "At turn end, your damaged monsters here heal 1.",
    onTurnEnd: (G, lane) => {
      for (const m of monstersOf(G, G.tp)) {
        if ((m.zone === lane.index * 2 || m.zone === lane.index * 2 + 1) && m.dmg > 0) {
          m.dmg = Math.max(0, m.dmg - 1);
          log(G, `${m.def.name} is mended by Phoenix Nest.`, "lane");
        }
      }
    }
  },
  {
    id: "lottery_well", name: "Lottery Well", text: "Summon here: 50% chance to draw 2, otherwise take 1 damage.",
    onSummon: (G, lane, card) => {
      if (G.rng.chance(0.5)) {
        drawCards(G, card.controller, 2);
        log(G, "Lottery Well pays out — draw 2!", "lane");
      } else {
        dealDamageToPlayer(G, card.controller, 1, card);
        log(G, "Lottery Well comes up empty — 1 damage.", "lane");
      }
    }
  },
  {
    id: "berserker_ring", name: "Berserker Ring", text: "Monsters here get +3 ATK and -2 DEF.",
    modifyStat: stat((G, lane, c, v, s) => s === "atk" ? v + 3 : s === "def" ? v - 2 : v)
  },
  {
    id: "silent_scriptorium", name: "Silent Scriptorium", text: "Summon here: draw 1, then discard is skipped — just draw.",
    onSummon: (G, lane, card) => { drawCards(G, card.controller, 1); }
  },
  {
    id: "hex_garden", name: "Hex Garden", text: "At turn end, enemy monsters in this lane take 2 damage.",
    onTurnEnd: (G, lane) => {
      for (const m of monstersOf(G, opp(G.tp))) {
        if (m.zone === lane.index * 2 || m.zone === lane.index * 2 + 1) damageMonster(G, m, 2, null);
      }
      sweepDestroyed(G);
    }
  },
  {
    id: "aegis_wall", name: "Aegis Wall", text: "Monsters summoned here gain Ward.",
    onSummon: (G, lane, card) => {
      card.wardGranted = true;
      log(G, `${card.def.name} is warded by Aegis Wall.`, "lane");
    }
  },
  {
    id: "war_banner", name: "War Banner", text: "On your turn, monsters here get +2 ATK. On the opponent's turn, they get -1 ATK.",
    modifyStat: stat((G, lane, c, v, s) => {
      if (s !== "atk") return v;
      return G.tp === c.controller ? v + 2 : v - 1;
    })
  },
  {
    id: "crimson_arena", name: "Crimson Arena", text: "Damaged monsters here get +4 ATK.",
    modifyStat: stat((G, lane, c, v, s) => (s === "atk" && c.dmg > 0) ? v + 4 : v)
  },
  {
    id: "summit_keep", name: "Summit Keep", text: "Level 7 or higher monsters here get +3/+3.",
    modifyStat: stat((G, lane, c, v, s) => monsterLevel(c.def) >= 7 ? v + 3 : v)
  },
  {
    id: "evolution_roost", name: "Evolution Roost", text: "Evolved monsters here get +2/+2.",
    modifyStat: stat((G, lane, c, v, s) => c.evolved ? v + 2 : v)
  },
  {
    id: "contact_crucible", name: "Contact Crucible", text: "Fusion monsters here get +2/+2.",
    modifyStat: stat((G, lane, c, v, s) => c.def?.summon === "fusion" ? v + 2 : v)
  },
  {
    id: "cinder_march", name: "Cinder March", text: "Ignis monsters here get +2 ATK.",
    modifyStat: stat((G, lane, c, v, s) => (s === "atk" && c.def?.tribe === "Ignis") ? v + 2 : v)
  },
  {
    id: "abyss_moat", name: "Abyss Moat", text: "Abyss monsters here get +0/+2.",
    modifyStat: stat((G, lane, c, v, s) => (s === "def" && c.def?.tribe === "Abyss") ? v + 2 : v)
  },
  {
    id: "terra_root", name: "Terra Root", text: "Terra monsters here get +1/+1.",
    modifyStat: stat((G, lane, c, v, s) => c.def?.tribe === "Terra" ? v + 1 : v)
  },
  {
    id: "open_bazaar", name: "Open Bazaar", text: "When this lane reveals, both players draw 1.",
    onReveal: (G) => {
      drawCards(G, 0, 1);
      drawCards(G, 1, 1);
      log(G, "Open Bazaar: both players draw 1.", "lane");
    }
  },
  {
    id: "dawn_altar", name: "Dawn Altar", text: "When this lane reveals, both players heal 2.",
    onReveal: (G) => {
      healPlayer(G, 0, 2);
      healPlayer(G, 1, 2);
      log(G, "Dawn Altar: both players heal 2.", "lane");
    }
  },
  {
    id: "fault_line", name: "Fault Line", text: "When this lane reveals, both leaders take 1.",
    onReveal: (G) => {
      dealDamageToPlayer(G, 0, 1, null);
      dealDamageToPlayer(G, 1, 1, null);
      log(G, "Fault Line cracks — both leaders take 1.", "lane");
    }
  },
  {
    id: "banner_rise", name: "Banner Rise", text: "When this lane reveals, monsters already here get +1/+1 permanently.",
    onReveal: (G, lane) => {
      const a = lane.index * 2, b = a + 1;
      for (const m of [...monstersOf(G, 0), ...monstersOf(G, 1)]) {
        if (m.zone === a || m.zone === b) buff(G, m, 1, 1, { permanent: true });
      }
      log(G, "Banner Rise steels the monsters already here.", "lane");
    }
  },
  {
    id: "glass_kiln", name: "Glass Kiln", text: "Summon here: this monster takes 2 damage.",
    onSummon: (G, lane, card) => {
      damageMonster(G, card, 2, null);
      sweepDestroyed(G);
      log(G, `Glass Kiln scorches ${card.def.name}.`, "lane");
    }
  },
  {
    id: "silt_river", name: "Silt River", text: "At the end of your turn, mill 1 from your deck.",
    onTurnEnd: (G) => {
      const n = mill(G, G.tp, 1).length;
      if (n) log(G, "Silt River mills 1.", "lane");
    }
  },
  {
    id: "campfire_ridge", name: "Campfire Ridge", text: "At the end of your turn, if you have a monster here, heal 1.",
    onTurnEnd: (G, lane) => {
      const here = monstersOf(G, G.tp).some((m) => m.zone === lane.index * 2 || m.zone === lane.index * 2 + 1);
      if (here) healPlayer(G, G.tp, 1);
    }
  },
  {
    id: "empty_watch", name: "Empty Watch", text: "At the end of your turn, if you have no monster here, take 1.",
    onTurnEnd: (G, lane) => {
      const here = monstersOf(G, G.tp).some((m) => m.zone === lane.index * 2 || m.zone === lane.index * 2 + 1);
      if (!here) dealDamageToPlayer(G, G.tp, 1, null);
    }
  },
  {
    id: "buried_vault", name: "Buried Vault", text: "Face-down monsters here get +3 DEF.",
    modifyStat: stat((G, lane, c, v, s) => (s === "def" && !c.faceup) ? v + 3 : v)
  },
  {
    id: "wind_tunnel", name: "Wind Tunnel", text: "Rush monsters here get +2 ATK.",
    modifyStat: stat((G, lane, c, v, s) => (s === "atk" && hasKeyword(c, "rush")) ? v + 2 : v)
  },
  {
    id: "lone_peak", name: "Lone Peak", text: "If you control only 1 monster here, it gets +4 ATK.",
    modifyStat: stat((G, lane, c, v, s) => {
      if (s !== "atk") return v;
      return monstersInLane(G, c.controller, lane).length === 1 ? v + 4 : v;
    })
  },
  {
    id: "weenie_pub", name: "Weenie Pub", text: "Monsters with 1 ATK here get +4 ATK.",
    modifyStat: stat((G, lane, c, v, s) => {
      if (s !== "atk") return v;
      return preLaneStat(G, c, "atk") === 1 ? v + 4 : v;
    })
  },
  {
    id: "vanilla_gym", name: "Vanilla Gym", text: "Monsters here with no trigger, Quick, or Ignition get +2/+2.",
    modifyStat: stat((G, lane, c, v, s) => isQuietMonster(c.def) ? v + 2 : v)
  },
  {
    id: "mob_rule", name: "Mob Rule", text: "If you have more monsters here than the opponent, they get +2/+2.",
    modifyStat: stat((G, lane, c, v, s) => {
      const mine = monstersInLane(G, c.controller, lane).length;
      const theirs = monstersInLane(G, opp(c.controller), lane).length;
      return mine > theirs ? v + 2 : v;
    })
  },
  {
    id: "inverted_peak", name: "Inverted Peak", text: "Monsters here swap ATK and DEF.",
    modifyStat: (G, lane, c, v, s) => preLaneStat(G, c, s === "atk" ? "def" : "atk")
  },
  {
    id: "clone_vats", name: "Clone Vats", text: "Summon here: add a copy of this monster to your hand.",
    onSummon: (G, lane, card) => {
      if (card.def?.token || card.def?.summon === "fusion") return;
      const copy = makeCard(card.id, card.def, card.controller);
      copy.loc = "hand";
      P(G, card.controller).hand.push(copy);
      log(G, `Clone Vats copies ${card.def.name} into your hand.`, "lane");
    }
  },
  {
    id: "echo_twin", name: "Twin Echo", text: "Summon here: if your other zone here is empty, summon a copy there.",
    onSummon: (G, lane, card) => {
      if (card.def?.token) return;
      const [a, b] = laneZones(lane);
      const other = card.zone === a ? b : a;
      const pl = P(G, card.controller);
      if (pl.mz[other]) return;
      const copy = makeCard(card.id, card.def, card.controller);
      placeMonster(G, copy, card.controller, other);
      pushEvents(G, [{ type: "specialSummon", card: copy, player: card.controller, source: null }]);
      log(G, `Twin Echo mirrors ${card.def.name}.`, "lane");
      if (copy.loc === "mz") G.hooks?.onSummon?.(copy);
    }
  },
  {
    id: "double_anvil", name: "Double Anvil", text: "Summon here: this monster gains ATK equal to its printed ATK.",
    onSummon: (G, lane, card) => {
      const printed = card.def?.atk || 0;
      if (printed) buff(G, card, printed, 0, { permanent: true });
    }
  },
  {
    id: "rebound_bar", name: "Rebound Bar", text: "Summon here: return this monster to your hand.",
    onSummon: (G, lane, card) => {
      if (card.def?.token) return;
      bounceToHand(G, card);
      log(G, `Rebound Bar kicks ${card.def.name} back to hand.`, "lane");
    }
  },
  {
    id: "death_altar", name: "Death Altar", text: "Summon here: destroy this monster; you gain 1 EP.",
    onSummon: (G, lane, card) => {
      const p = card.controller;
      destroyByEffect(G, card, laneSrc(lane));
      P(G, p).ep += 1;
      log(G, `Death Altar claims a tribute — ${p === 0 ? "you gain" : "AI gains"} 1 EP.`, "lane");
    }
  },
  {
    id: "danger_crucible", name: "Danger Crucible", text: "Summon here: 25% chance this monster is destroyed.",
    onSummon: (G, lane, card) => {
      if (!G.rng.chance(0.25)) return;
      destroyByEffect(G, card, laneSrc(lane));
      log(G, `Danger Crucible collapses on ${card.def.name}!`, "lane");
    }
  },
  {
    id: "scout_hub", name: "Scout Hub", text: "Summon here: add a random Level 4 monster from your deck to your hand.",
    onSummon: (G, lane, card) => {
      const pl = P(G, card.controller);
      const hits = pl.deck.filter((c) => c.def?.type === "monster" && monsterLevel(c.def) <= 4);
      if (!hits.length) return;
      const pick = G.rng.pick(hits);
      const i = pl.deck.indexOf(pick);
      if (i >= 0) pl.deck.splice(i, 1);
      pick.loc = "hand";
      pl.hand.push(pick);
      log(G, `Scout Hub finds ${pick.def.name}.`, "lane");
    }
  },
  {
    id: "crosscurrent", name: "Crosscurrent", text: "Summon here: take the top card of the opponent's deck.",
    onSummon: (G, lane, card) => {
      const o = opp(card.controller);
      const top = P(G, o).deck[0];
      if (!top) return;
      moveTo(G, top, "hand");
      top.controller = card.controller;
      P(G, card.controller).hand.push(top);
      log(G, `Crosscurrent steals ${top.def.name}.`, "lane");
    }
  },
  {
    id: "hatchery", name: "Savage Hatchery", text: "When this reveals, each player summons a 1/1 Recruit Token here.",
    onReveal: (G, lane) => {
      for (const p of [0, 1]) {
        const z = freeZoneInLane(G, p, lane);
        if (z < 0) continue;
        const t = makeCard("token_recruit", TOKEN_DB.token_recruit, p);
        placeMonster(G, t, p, z);
        pushEvents(G, [{ type: "specialSummon", card: t, player: p, source: null }]);
      }
      log(G, "Savage Hatchery dumps a Recruit Token on each side.", "lane");
    }
  },
  {
    id: "pegasus_core", name: "Pegasus Core", text: "When this reveals, both players gain 2 EP.",
    onReveal: (G) => {
      P(G, 0).ep += 2;
      P(G, 1).ep += 2;
      log(G, "Pegasus Core: both players gain 2 EP.", "lane");
    }
  },
  {
    id: "mind_rift", name: "Mind Rift", text: "When this reveals, both players swap hands.",
    onReveal: (G) => {
      const a = P(G, 0).hand;
      const b = P(G, 1).hand;
      P(G, 0).hand = b;
      P(G, 1).hand = a;
      for (const c of P(G, 0).hand) c.controller = 0;
      for (const c of P(G, 1).hand) c.controller = 1;
      log(G, "Mind Rift swaps both hands.", "lane");
    }
  },
  {
    id: "muir_bloom", name: "Muir Bloom", text: "End of turn: your monsters here get +1 ATK.",
    onTurnEnd: (G, lane) => {
      for (const m of monstersInLane(G, G.tp, lane)) buff(G, m, 1, 0, { permanent: true });
    }
  },
  {
    id: "empty_current", name: "Empty Current", text: "End of turn: if you have no monster here, gain 1 EP.",
    onTurnEnd: (G, lane) => {
      if (monstersInLane(G, G.tp, lane).length) return;
      P(G, G.tp).ep += 1;
      log(G, "Empty Current pays 1 EP for the open lane.", "lane");
    }
  },
  {
    id: "victor_spoils", name: "Victor's Spoils", text: "End of turn: if you have more ATK here than the opponent, draw 1.",
    onTurnEnd: (G, lane) => {
      const power = (p) => monstersInLane(G, p, lane).reduce((n, m) => n + getATK(G, m), 0);
      if (power(G.tp) <= power(opp(G.tp))) return;
      drawCards(G, G.tp, 1);
      log(G, "Victor's Spoils: the lane leader draws 1.", "lane");
    }
  },
  {
    id: "murder_pit", name: "Murder Pit", text: "Two turns after this reveals, destroy all monsters here.",
    onTurnEnd: (G, lane) => {
      const revealedOn = lane.index === 0 ? 1 : lane.index === 1 ? 3 : 5;
      if (G.turnCount !== revealedOn + 2) return;
      const bodies = [...monstersInLane(G, 0, lane), ...monstersInLane(G, 1, lane)];
      for (const m of bodies) destroyByEffect(G, m, laneSrc(lane));
      if (bodies.length) log(G, "Murder Pit swallows everything here.", "lane");
    }
  },
  {
    id: "nidavell_forge", name: "Nidavell Forge", text: "Monsters here get +4 ATK.",
    modifyStat: stat((G, lane, c, v, s) => s === "atk" ? v + 4 : v)
  },
  {
    id: "necro_shade", name: "Necro Shade", text: "Monsters here get -2/-1.",
    modifyStat: stat((G, lane, c, v, s) => s === "atk" ? v - 2 : s === "def" ? v - 1 : v)
  },
  {
    id: "negative_zone", name: "Negative Zone", text: "Monsters here get -2/-2.",
    modifyStat: stat((G, lane, c, v, s) => v - 2)
  },
  {
    id: "keyword_citadel", name: "Keyword Citadel", text: "Monsters here with Rush or Ward get +2/+2.",
    modifyStat: stat((G, lane, c, v, s) => hasAnyKeyword(c) ? v + 2 : v)
  },
  {
    id: "top_dog", name: "Top Dog", text: "The highest-ATK monster(s) here get +3 ATK.",
    modifyStat: (G, lane, c, v, s) => {
      if (s !== "atk") return v;
      const all = [...monstersInLane(G, 0, lane), ...monstersInLane(G, 1, lane)];
      const best = Math.max(0, ...all.map((m) => preLaneStat(G, m, "atk")));
      return preLaneStat(G, c, "atk") === best ? v + 3 : v;
    }
  },
  {
    id: "lake_lv4", name: "Lake of Fours", text: "Level 4 monsters here get +2 ATK.",
    modifyStat: stat((G, lane, c, v, s) => (s === "atk" && monsterLevel(c.def) === 4) ? v + 2 : v)
  },
  {
    id: "deep_halls", name: "Deep Halls", text: "Level 5–6 monsters here get +2/+2.",
    modifyStat: stat((G, lane, c, v, s) => {
      const lv = monsterLevel(c.def);
      return lv >= 5 && lv <= 6 ? v + 2 : v;
    })
  },
  {
    id: "cosmos_high", name: "Crimson Cosmos", text: "Level 7+ monsters here get +4 ATK.",
    modifyStat: stat((G, lane, c, v, s) => (s === "atk" && monsterLevel(c.def) >= 7) ? v + 4 : v)
  },
  {
    id: "nova_hand", name: "Nova Roma", text: "Monsters here get +1 ATK for every 2 cards in your hand.",
    modifyStat: stat((G, lane, c, v, s) => s === "atk" ? v + Math.floor(P(G, c.controller).hand.length / 2) : v)
  },
  {
    id: "gy_choir", name: "GY Choir", text: "Monsters here get +1 ATK for every 3 cards in your GY.",
    modifyStat: stat((G, lane, c, v, s) => s === "atk" ? v + Math.floor(P(G, c.controller).gy.length / 3) : v)
  },
  {
    id: "hurt_shell", name: "Hurt Shell", text: "Damaged monsters here get +0/+3.",
    modifyStat: stat((G, lane, c, v, s) => (s === "def" && c.dmg > 0) ? v + 3 : v)
  },
  {
    id: "token_fair", name: "Token Fair", text: "Tokens here get +2/+2.",
    modifyStat: stat((G, lane, c, v, s) => c.def?.token ? v + 2 : v)
  },
  {
    id: "odd_clock", name: "Odd Clock", text: "Odd turns: +2 ATK here. Even turns: +2 DEF here.",
    modifyStat: stat((G, lane, c, v, s) => {
      const odd = G.turnCount % 2 === 1;
      if (odd && s === "atk") return v + 2;
      if (!odd && s === "def") return v + 2;
      return v;
    })
  },
  {
    id: "underdog", name: "Underdog Row", text: "If you have fewer monsters here than the opponent, they get +3 ATK.",
    modifyStat: stat((G, lane, c, v, s) => {
      if (s !== "atk") return v;
      const mine = monstersInLane(G, c.controller, lane).length;
      const theirs = monstersInLane(G, opp(c.controller), lane).length;
      return mine < theirs ? v + 3 : v;
    })
  },
  {
    id: "face_race", name: "Face Race", text: "If you have less LP than the opponent, monsters here get +2 ATK.",
    modifyStat: stat((G, lane, c, v, s) => {
      if (s !== "atk") return v;
      return P(G, c.controller).lp < P(G, opp(c.controller)).lp ? v + 2 : v;
    })
  },
  {
    id: "sinkhole", name: "Sinkhole", text: "Summon here: destroy this monster.",
    onSummon: (G, lane, card) => {
      destroyByEffect(G, card, laneSrc(lane));
      log(G, `Sinkhole swallows ${card.def.name}.`, "lane");
    }
  },
  {
    id: "machine_press", name: "Machine Press", text: "Summon here: the opponent adds a copy of this monster to their hand.",
    onSummon: (G, lane, card) => {
      if (card.def?.token || card.def?.summon === "fusion") return;
      const o = opp(card.controller);
      const copy = makeCard(card.id, card.def, o);
      copy.loc = "hand";
      P(G, o).hand.push(copy);
      log(G, `Machine Press hands ${card.def.name} to the opponent.`, "lane");
    }
  },
  {
    id: "sokovia_wind", name: "Sokovia Wind", text: "Summon here: discard a random card from your hand.",
    onSummon: (G, lane, card) => {
      const hand = P(G, card.controller).hand;
      if (!hand.length) return;
      const pick = G.rng.pick(hand);
      discardCard(G, pick);
      log(G, `Sokovia Wind discards ${pick.def.name}.`, "lane");
    }
  },
  {
    id: "rockfall", name: "Rockfall", text: "Summon here: mill 2 from your deck.",
    onSummon: (G, lane, card) => {
      const n = mill(G, card.controller, 2).length;
      if (n) log(G, `Rockfall mills ${n}.`, "lane");
    }
  },
  {
    id: "mold_works", name: "Mold Works", text: "Summon here: summon a 1/1 Recruit Token here if a zone is free.",
    onSummon: (G, lane, card) => {
      const t = spawnTokenHere(G, card.controller, lane, "token_recruit");
      if (t) log(G, "Mold Works stamps out a Recruit Token.", "lane");
    }
  },
  {
    id: "the_raft", name: "The Raft", text: "Summon here: add a random Level 7+ monster from your deck to your hand.",
    onSummon: (G, lane, card) => {
      const pick = addRandomFromDeck(G, card.controller, (c) => c.def?.type === "monster" && monsterLevel(c.def) >= 7);
      if (pick) log(G, `The Raft pulls ${pick.def.name}.`, "lane");
    }
  },
  {
    id: "gamma_pit", name: "Gamma Pit", text: "Summon here: this monster takes 1, then gets +3 ATK.",
    onSummon: (G, lane, card) => {
      damageMonster(G, card, 1, null);
      buff(G, card, 3, 0, { permanent: true });
      sweepDestroyed(G);
    }
  },
  {
    id: "hala_sweep", name: "Hala Sweep", text: "Summon here: destroy your other monster in this lane.",
    onSummon: (G, lane, card) => {
      for (const m of monstersInLane(G, card.controller, lane)) {
        if (m === card) continue;
        destroyByEffect(G, m, laneSrc(lane));
        log(G, `Hala Sweep erases ${m.def.name}.`, "lane");
      }
    }
  },
  {
    id: "quantum_well", name: "Quantum Well", text: "Summon here: swap this monster with an enemy monster in this lane.",
    onSummon: (G, lane, card) => {
      const foes = monstersInLane(G, opp(card.controller), lane);
      if (!foes.length) return;
      const foe = foes[0];
      const p = card.controller, o = foe.controller;
      const zMe = card.zone, zThem = foe.zone;
      P(G, p).mz[zMe] = foe;
      P(G, o).mz[zThem] = card;
      card.controller = o;
      foe.controller = p;
      card.zone = zThem;
      foe.zone = zMe;
      log(G, `Quantum Well swaps ${card.def.name} with ${foe.def.name}.`, "lane");
    }
  },
  {
    id: "first_blood", name: "First Blood", text: "The first monster summoned here this duel gets +3/+3.",
    onSummon: (G, lane, card) => {
      if (lane._firstBlood) return;
      lane._firstBlood = true;
      buff(G, card, 3, 3, { permanent: true });
    }
  },
  {
    id: "gy_rescue", name: "GY Rescue", text: "Summon here: add a random monster from your GY to your hand.",
    onSummon: (G, lane, card) => {
      const gy = P(G, card.controller).gy.filter((c) => c.def?.type === "monster");
      if (!gy.length) return;
      const pick = G.rng.pick(gy);
      moveTo(G, pick, "hand");
      pick.controller = card.controller;
      P(G, card.controller).hand.push(pick);
      log(G, `GY Rescue returns ${pick.def.name}.`, "lane");
    }
  },
  {
    id: "ep_well", name: "EP Well", text: "Summon here: gain 1 EP.",
    onSummon: (G, lane, card) => {
      P(G, card.controller).ep += 1;
      log(G, `${card.controller === 0 ? "You gain" : "AI gains"} 1 EP from EP Well.`, "lane");
    }
  },
  {
    id: "freeze_bit", name: "Freeze Bit", text: "Summon here: this monster cannot attack this turn.",
    onSummon: (G, lane, card) => {
      card.cannotAttackTurn = G.turnCount;
      log(G, `${card.def.name} is frozen this turn.`, "lane");
    }
  },
  {
    id: "stone_skin", name: "Stone Skin", text: "Summon here: this monster gains Ward and +0/+2.",
    onSummon: (G, lane, card) => {
      card.wardGranted = true;
      buff(G, card, 0, 2, { permanent: true });
      log(G, `${card.def.name} grows Stone Skin.`, "lane");
    }
  },
  {
    id: "double_tax", name: "Double Tax", text: "Summon here: draw 2, then discard 1 at random.",
    onSummon: (G, lane, card) => {
      drawCards(G, card.controller, 2);
      const hand = P(G, card.controller).hand;
      if (!hand.length) return;
      discardCard(G, G.rng.pick(hand));
    }
  },
  {
    id: "mirror_hand", name: "Mirror Hand", text: "Summon here: the opponent draws 1.",
    onSummon: (G, lane, card) => { drawCards(G, opp(card.controller), 1); }
  },
  {
    id: "banish_spy", name: "Banish Spy", text: "Summon here: banish the top card of the opponent's deck.",
    onSummon: (G, lane, card) => {
      const top = P(G, opp(card.controller)).deck[0];
      if (!top) return;
      banishCard(G, top, { from: "deck", kind: "lane" });
      log(G, `Banish Spy exiles ${top.def.name}.`, "lane");
    }
  },
  {
    id: "tax_draw", name: "Tax Draw", text: "Summon here: if you have more than 10 LP, pay 1 LP and draw 1.",
    onSummon: (G, lane, card) => {
      if (P(G, card.controller).lp <= 10) return;
      dealDamageToPlayer(G, card.controller, 1, card);
      drawCards(G, card.controller, 1);
    }
  },
  {
    id: "cave_in", name: "Cave-In", text: "When this reveals, fill empty zones here with 0/4 Stonewall Tokens.",
    onReveal: (G, lane) => {
      for (const p of [0, 1]) spawnTokenHere(G, p, lane, "token_stonewall");
      log(G, "Cave-In bricks the empty slots with Stonewalls.", "lane");
    }
  },
  {
    id: "attilan_shuffle", name: "Attilan Shuffle", text: "When this reveals, each player shuffles their hand into the deck and draws 3.",
    onReveal: (G) => {
      for (const p of [0, 1]) {
        shuffleHandToDeck(G, p);
        drawCards(G, p, 3);
      }
      log(G, "Attilan Shuffle: both players redraw 3.", "lane");
    }
  },
  {
    id: "plunder_keep", name: "Plunder Keep", text: "When this reveals, each player with a hand swaps one random card.",
    onReveal: (G) => {
      const a = P(G, 0).hand, b = P(G, 1).hand;
      if (!a.length || !b.length) return;
      const ca = G.rng.pick(a), cb = G.rng.pick(b);
      moveTo(G, ca, "hand");
      moveTo(G, cb, "hand");
      ca.controller = 1;
      cb.controller = 0;
      P(G, 1).hand.push(ca);
      P(G, 0).hand.push(cb);
      log(G, `Plunder Keep swaps ${ca.def.name} and ${cb.def.name}.`, "lane");
    }
  },
  {
    id: "tinker_bench", name: "Tinker Bench", text: "When this reveals, both players draw 1 extra next turn.",
    onReveal: (G) => {
      for (const p of [0, 1]) P(G, p).bonusDrawNextTurn = (P(G, p).bonusDrawNextTurn || 0) + 1;
      log(G, "Tinker Bench: both players draw +1 next turn.", "lane");
    }
  },
  {
    id: "lamentis_cut", name: "Lamentis Cut", text: "When this reveals, both players draw 2 and mill 2.",
    onReveal: (G) => {
      for (const p of [0, 1]) {
        drawCards(G, p, 2);
        mill(G, p, 2);
      }
      log(G, "Lamentis Cut: draw 2, mill 2 each.", "lane");
    }
  },
  {
    id: "boot_camp", name: "Boot Camp", text: "When this reveals, each player adds a random Level 4 monster from their deck to their hand.",
    onReveal: (G) => {
      for (const p of [0, 1]) {
        const pick = addRandomFromDeck(G, p, (c) => c.def?.type === "monster" && monsterLevel(c.def) <= 4);
        if (pick) log(G, `Boot Camp finds ${pick.def.name} for ${p === 0 ? "you" : "AI"}.`, "lane");
      }
    }
  },
  {
    id: "nightmare_vault", name: "Nightmare Vault", text: "When this reveals, each player shuffles their GY into their deck.",
    onReveal: (G) => {
      gyToDeck(G, 0);
      gyToDeck(G, 1);
      log(G, "Nightmare Vault dumps both Graveyards back into the decks.", "lane");
    }
  },
  {
    id: "embassy_wave", name: "Embassy Wave", text: "When this reveals, all monsters on the field get +1 ATK.",
    onReveal: (G) => {
      for (const p of [0, 1]) {
        for (const m of monstersOf(G, p)) buff(G, m, 1, 0, { permanent: true });
      }
      log(G, "Embassy Wave: every monster on the field gets +1 ATK.", "lane");
    }
  },
  {
    id: "x_mansion", name: "X Mansion", text: "When this reveals, each player adds a random card from their deck to their hand.",
    onReveal: (G) => {
      for (const p of [0, 1]) {
        const pick = addRandomFromDeck(G, p, () => true);
        if (pick) log(G, `X Mansion tutors ${pick.def.name} for ${p === 0 ? "you" : "AI"}.`, "lane");
      }
    }
  },
  {
    id: "stark_spire", name: "Stark Spire", text: "End of turn 5 or later: your monsters here get +1/+1.",
    onTurnEnd: (G, lane) => {
      if (G.turnCount < 5) return;
      for (const m of monstersInLane(G, G.tp, lane)) buff(G, m, 1, 1, { permanent: true });
    }
  },
  {
    id: "hellfire_cull", name: "Hellfire Cull", text: "End of turn: destroy monsters here with more than 2 ATK.",
    onTurnEnd: (G, lane) => {
      const bodies = [...monstersInLane(G, 0, lane), ...monstersInLane(G, 1, lane)]
        .filter((m) => preLaneStat(G, m, "atk") > 2);
      for (const m of bodies) destroyByEffect(G, m, laneSrc(lane));
    }
  },
  {
    id: "big_house", name: "The Big House", text: "End of turn: destroy Level 5 or higher monsters here.",
    onTurnEnd: (G, lane) => {
      const bodies = [...monstersInLane(G, 0, lane), ...monstersInLane(G, 1, lane)]
        .filter((m) => monsterLevel(m.def) >= 5);
      for (const m of bodies) destroyByEffect(G, m, laneSrc(lane));
    }
  },
  {
    id: "wakanda_mend", name: "Wakanda Mend", text: "End of turn: your monsters here heal all damage.",
    onTurnEnd: (G, lane) => {
      for (const m of monstersInLane(G, G.tp, lane)) {
        if (m.dmg > 0) {
          m.dmg = 0;
          log(G, `${m.def.name} is fully mended by Wakanda.`, "lane");
        }
      }
    }
  },
  {
    id: "kyln_gate", name: "Kyln Gate", text: "After turn 4, nothing can be summoned in this lane.",
    locksZone: (G, lane, p, z) => G.turnCount > 4 && lockLaneZones(lane, z)
  },
  {
    id: "lockdown_lab", name: "Lockdown Lab", text: "On turns 3, 4, and 5, nothing can be summoned in this lane.",
    locksZone: (G, lane, p, z) => G.turnCount >= 3 && G.turnCount <= 5 && lockLaneZones(lane, z)
  },
  {
    id: "milano_gate", name: "Milano Gate", text: "You can only summon here on turn 5.",
    locksZone: (G, lane, p, z) => G.turnCount !== 5 && lockLaneZones(lane, z)
  },
  {
    id: "odd_lock", name: "Even Lock", text: "This lane is sealed on even turns.",
    locksZone: (G, lane, p, z) => G.turnCount % 2 === 0 && lockLaneZones(lane, z)
  },
  {
    id: "tank_line", name: "Tank Line", text: "Monsters with 4 or more DEF get +2 ATK.",
    modifyStat: stat((G, lane, c, v, s) => (s === "atk" && (c.def.def || 0) >= 4) ? v + 2 : v)
  },
  {
    id: "glass_jaw", name: "Glass Jaw", text: "Monsters with 4 or more ATK get -2 DEF.",
    modifyStat: stat((G, lane, c, v, s) => (s === "def" && (c.def.atk || 0) >= 4) ? v - 2 : v)
  },
  {
    id: "last_stand", name: "Last Stand", text: "If you have 8 LP or less, monsters here get +3 ATK.",
    modifyStat: stat((G, lane, c, v, s) => (s === "atk" && P(G, c.controller).lp <= 8) ? v + 3 : v)
  },
  {
    id: "full_life", name: "Full Life", text: "If you have 18 LP or more, monsters here get +2 DEF.",
    modifyStat: stat((G, lane, c, v, s) => (s === "def" && P(G, c.controller).lp >= 18) ? v + 2 : v)
  },
  {
    id: "empty_grip", name: "Empty Grip", text: "If your hand is empty, monsters here get +3 ATK.",
    modifyStat: stat((G, lane, c, v, s) => (s === "atk" && P(G, c.controller).hand.length === 0) ? v + 3 : v)
  },
  {
    id: "stuffed_grip", name: "Stuffed Grip", text: "If you have 5 or more cards in hand, monsters here get +2 DEF.",
    modifyStat: stat((G, lane, c, v, s) => (s === "def" && P(G, c.controller).hand.length >= 5) ? v + 2 : v)
  },
  {
    id: "ban_choir", name: "Ban Choir", text: "Monsters here get +1 ATK for every 2 cards you have banished.",
    modifyStat: stat((G, lane, c, v, s) => s === "atk" ? v + Math.floor(P(G, c.controller).ban.length / 2) : v)
  },
  {
    id: "extra_hum", name: "Extra Hum", text: "If your Extra Deck is not empty, monsters here get +2 ATK.",
    modifyStat: stat((G, lane, c, v, s) => (s === "atk" && P(G, c.controller).extra.length) ? v + 2 : v)
  },
  {
    id: "set_battery", name: "Set Battery", text: "Monsters here get +1 ATK for each face-down spell you control.",
    modifyStat: stat((G, lane, c, v, s) => {
      if (s !== "atk") return v;
      return v + P(G, c.controller).stz.filter((x) => x && !x.faceup).length;
    })
  },
  {
    id: "swarm_hum", name: "Swarm Hum", text: "If you control 4 or more monsters, monsters here get +2 ATK.",
    modifyStat: stat((G, lane, c, v, s) => (s === "atk" && monstersOf(G, c.controller).length >= 4) ? v + 2 : v)
  },
  {
    id: "paper_thin", name: "Paper Thin", text: "Monsters with 1 DEF or less get +4 ATK.",
    modifyStat: stat((G, lane, c, v, s) => (s === "atk" && preLaneStat(G, c, "def") <= 1) ? v + 4 : v)
  },
  {
    id: "mid_band", name: "Mid Band", text: "Level 4–6 monsters here get +1/+1.",
    modifyStat: stat((G, lane, c, v, s) => {
      const lv = monsterLevel(c.def);
      return lv >= 4 && lv <= 6 ? v + 1 : v;
    })
  },
  {
    id: "dual_tribe", name: "Twin Tribe", text: "Ignis or Abyss monsters here get +1/+1.",
    modifyStat: stat((G, lane, c, v, s) => (c.def?.tribe === "Ignis" || c.def?.tribe === "Abyss") ? v + 1 : v)
  },
  {
    id: "night_blade", name: "Night Blade", text: "During the opponent's turn, monsters here get +3 ATK.",
    modifyStat: stat((G, lane, c, v, s) => (s === "atk" && G.tp !== c.controller) ? v + 3 : v)
  },
  {
    id: "even_scale", name: "Even Scale", text: "Even-level monsters here get +2 ATK.",
    modifyStat: stat((G, lane, c, v, s) => (s === "atk" && monsterLevel(c.def) % 2 === 0) ? v + 2 : v)
  },
  {
    id: "odd_scale", name: "Odd Scale", text: "Odd-level monsters here get +2 DEF.",
    modifyStat: stat((G, lane, c, v, s) => (s === "def" && monsterLevel(c.def) % 2 === 1) ? v + 2 : v)
  },
  {
    id: "clean_gy", name: "Clean GY", text: "If your GY is empty, monsters here get +2/+2.",
    modifyStat: stat((G, lane, c, v, s) => P(G, c.controller).gy.length === 0 ? v + 2 : v)
  },
  {
    id: "wounded_pride", name: "Wounded Pride", text: "If this monster is damaged and you have less LP, it gets +2 ATK.",
    modifyStat: stat((G, lane, c, v, s) => {
      if (s !== "atk" || c.dmg <= 0) return v;
      return P(G, c.controller).lp < P(G, opp(c.controller)).lp ? v + 2 : v;
    })
  },
  {
    id: "coin_buff", name: "Coin Buff", text: "Summon here: 50% chance this gets +2/+2, otherwise it takes 1.",
    onSummon: (G, lane, card) => {
      if (G.rng.chance(0.5)) buff(G, card, 2, 2, { permanent: true });
      else {
        damageMonster(G, card, 1, null);
        sweepDestroyed(G);
        log(G, "Coin Buff lands tails.", "lane");
      }
    }
  },
  {
    id: "bounce_neighbor", name: "Bounce Neighbor", text: "Summon here: return your other monster in this lane to your hand.",
    onSummon: (G, lane, card) => {
      for (const m of monstersInLane(G, card.controller, lane)) {
        if (m === card) continue;
        bounceToHand(G, m);
        log(G, `Bounce Neighbor sends ${m.def.name} home.`, "lane");
      }
    }
  },
  {
    id: "spy_mill", name: "Spy Mill", text: "Summon here: mill 2 from the opponent's deck.",
    onSummon: (G, lane, card) => {
      const n = mill(G, opp(card.controller), 2).length;
      if (n) log(G, `Spy Mill dumps ${n} from the opponent.`, "lane");
    }
  },
  {
    id: "heal_pulse", name: "Heal Pulse", text: "Summon here: heal 2 LP.",
    onSummon: (G, lane, card) => { healPlayer(G, card.controller, 2); }
  },
  {
    id: "board_ping", name: "Board Ping", text: "Summon here: deal 1 to all enemy monsters.",
    onSummon: (G, lane, card) => {
      for (const m of monstersOf(G, opp(card.controller))) damageMonster(G, m, 1, card);
      sweepDestroyed(G);
    }
  },
  {
    id: "self_exile", name: "Self Exile", text: "Summon here: banish the top 2 cards of your deck.",
    onSummon: (G, lane, card) => {
      for (let i = 0; i < 2; i++) {
        const top = P(G, card.controller).deck[0];
        if (!top) break;
        banishCard(G, top, { from: "deck", kind: "lane" });
      }
    }
  },
  {
    id: "gy_clone", name: "GY Clone", text: "Summon here: put a copy of this monster into your GY.",
    onSummon: (G, lane, card) => {
      if (card.def?.token) return;
      const copy = makeCard(card.id, card.def, card.controller);
      copy.loc = "gy";
      P(G, card.controller).gy.push(copy);
      log(G, `GY Clone dumps a spare ${card.def.name}.`, "lane");
    }
  },
  {
    id: "snatch_set", name: "Snatch Set", text: "Summon here: return a random face-down enemy spell to their hand.",
    onSummon: (G, lane, card) => {
      const sets = P(G, opp(card.controller)).stz.filter((c) => c && !c.faceup);
      if (!sets.length) return;
      const pick = G.rng.pick(sets);
      bounceToHand(G, pick);
      log(G, "Snatch Set bounces a Set card.", "lane");
    }
  },
  {
    id: "overpay", name: "Overpay", text: "Summon here: if you have EP, spend 1 EP; this gets +2/+2.",
    onSummon: (G, lane, card) => {
      const pl = P(G, card.controller);
      if (pl.ep <= 0) return;
      pl.ep -= 1;
      buff(G, card, 2, 2, { permanent: true });
      log(G, "Overpay spends 1 EP.", "lane");
    }
  },
  {
    id: "moon_book", name: "Moon Book", text: "Summon here: this monster is flipped face-down.",
    onSummon: (G, lane, card) => { setMonsterFaceDown(G, card); }
  },
  {
    id: "catchup_rush", name: "Catch-Up Rush", text: "Summon here: if you have less LP, this gains Rush.",
    onSummon: (G, lane, card) => {
      if (P(G, card.controller).lp >= P(G, opp(card.controller)).lp) return;
      card.rushGranted = true;
      log(G, `${card.def.name} catches up with Rush.`, "lane");
    }
  },
  {
    id: "tribute_draw", name: "Tribute Draw", text: "Summon here: if this is Level 5 or higher, draw 1.",
    onSummon: (G, lane, card) => {
      if (monsterLevel(card.def) >= 5) drawCards(G, card.controller, 1);
    }
  },
  {
    id: "four_shock", name: "Four Shock", text: "Summon here: if this is Level 4, both leaders take 1.",
    onSummon: (G, lane, card) => {
      if (monsterLevel(card.def) !== 4) return;
      dealDamageToPlayer(G, 0, 1, card);
      dealDamageToPlayer(G, 1, 1, card);
    }
  },
  {
    id: "hungry_token", name: "Hungry Token", text: "Summon here: if your hand is empty, summon a 1/1 Recruit Token here.",
    onSummon: (G, lane, card) => {
      if (P(G, card.controller).hand.length) return;
      spawnTokenHere(G, card.controller, lane, "token_recruit");
    }
  },
  {
    id: "deck_cycle", name: "Deck Cycle", text: "Summon here: put the top card of your deck on the bottom.",
    onSummon: (G, lane, card) => {
      const d = P(G, card.controller).deck;
      if (d.length) d.push(d.shift());
    }
  },
  {
    id: "force_discard", name: "Force Discard", text: "Summon here: the opponent discards a random card.",
    onSummon: (G, lane, card) => {
      const hand = P(G, opp(card.controller)).hand;
      if (!hand.length) return;
      discardCard(G, G.rng.pick(hand));
    }
  },
  {
    id: "twin_mill", name: "Twin Mill", text: "Summon here: both players mill 1.",
    onSummon: (G, lane, card) => {
      mill(G, 0, 1);
      mill(G, 1, 1);
    }
  },
  {
    id: "rally_turn", name: "Rally Turn", text: "Summon here: your monsters get +1 ATK this turn.",
    onSummon: (G, lane, card) => {
      for (const m of monstersOf(G, card.controller)) buff(G, m, 1, 0, { permanent: false });
    }
  },
  {
    id: "freeze_lane", name: "Freeze Lane", text: "Summon here: enemy monsters in this lane cannot attack this turn.",
    onSummon: (G, lane, card) => {
      for (const m of monstersInLane(G, opp(card.controller), lane)) {
        m.cannotAttackTurn = G.turnCount;
        log(G, `${m.def.name} is frozen this turn.`, "lane");
      }
    }
  },
  {
    id: "print_swap", name: "Print Swap", text: "Summon here: this monster swaps its printed ATK and DEF.",
    onSummon: (G, lane, card) => {
      const atk = card.def.atk || 0, def = card.def.def || 0;
      buff(G, card, def - atk, atk - def, { permanent: true });
    }
  },
  {
    id: "double_shell", name: "Double Shell", text: "Summon here: this monster gains DEF equal to its printed DEF.",
    onSummon: (G, lane, card) => {
      const def = card.def.def || 0;
      if (def) buff(G, card, 0, def, { permanent: true });
    }
  },
  {
    id: "hand_burn", name: "Hand Burn", text: "Summon here: if you have 4 or more cards in hand, deal 1 to the enemy leader.",
    onSummon: (G, lane, card) => {
      if (P(G, card.controller).hand.length >= 4) dealDamageToPlayer(G, opp(card.controller), 1, card);
    }
  },
  {
    id: "mutual_discard", name: "Mutual Discard", text: "When this reveals, each player discards a random card.",
    onReveal: (G) => {
      for (const p of [0, 1]) {
        const hand = P(G, p).hand;
        if (hand.length) discardCard(G, G.rng.pick(hand));
      }
      log(G, "Mutual Discard: both players drop a card.", "lane");
    }
  },
  {
    id: "mutual_exile", name: "Mutual Exile", text: "When this reveals, both players banish the top card of their deck.",
    onReveal: (G) => {
      for (const p of [0, 1]) {
        const top = P(G, p).deck[0];
        if (top) banishCard(G, top, { from: "deck", kind: "lane" });
      }
    }
  },
  {
    id: "shared_core", name: "Shared Core", text: "When this reveals, both players gain 1 EP.",
    onReveal: (G) => {
      P(G, 0).ep += 1;
      P(G, 1).ep += 1;
      log(G, "Shared Core: both players gain 1 EP.", "lane");
    }
  },
  {
    id: "lp_tax", name: "LP Tax", text: "When this reveals, both leaders take 2.",
    onReveal: (G) => {
      dealDamageToPlayer(G, 0, 2, null);
      dealDamageToPlayer(G, 1, 2, null);
      log(G, "LP Tax hits both leaders for 2.", "lane");
    }
  },
  {
    id: "draw_to_four", name: "Draw to Four", text: "When this reveals, each player draws until they have 4 cards.",
    onReveal: (G) => {
      for (const p of [0, 1]) {
        while (P(G, p).hand.length < 4 && P(G, p).deck.length) drawCards(G, p, 1);
      }
      log(G, "Draw to Four fills both hands.", "lane");
    }
  },
  {
    id: "underdog_ep", name: "Underdog EP", text: "When this reveals, the player with less LP gains 2 EP.",
    onReveal: (G) => {
      const p = lowerLpPlayer(G);
      if (p == null) return;
      P(G, p).ep += 2;
      log(G, `${p === 0 ? "You" : "AI"} gain 2 EP from Underdog EP.`, "lane");
    }
  },
  {
    id: "mill_storm", name: "Mill Storm", text: "When this reveals, both players mill 3.",
    onReveal: (G) => {
      mill(G, 0, 3);
      mill(G, 1, 3);
      log(G, "Mill Storm dumps 3 each.", "lane");
    }
  },
  {
    id: "gy_top", name: "GY Top", text: "When this reveals, each player adds the top card of their GY to their hand.",
    onReveal: (G) => {
      for (const p of [0, 1]) {
        const gy = P(G, p).gy;
        if (!gy.length) continue;
        const c = gy[gy.length - 1];
        moveTo(G, c, "hand");
        c.controller = p;
        P(G, p).hand.push(c);
      }
    }
  },
  {
    id: "spell_crash", name: "Spell Crash", text: "When this reveals, destroy all spells in this lane.",
    onReveal: (G, lane) => {
      destroySpellsInLane(G, lane);
      log(G, "Spell Crash clears the spell columns here.", "lane");
    }
  },
  {
    id: "unban", name: "Unban", text: "When this reveals, each player shuffles their banished cards into their deck.",
    onReveal: (G) => {
      for (const p of [0, 1]) {
        const pl = P(G, p);
        while (pl.ban.length) {
          const c = pl.ban.pop();
          c.loc = "deck";
          pl.deck.push(c);
        }
        G.rng.shuffle(pl.deck);
      }
      log(G, "Unban dumps both banished piles back into the decks.", "lane");
    }
  },
  {
    id: "mercy_heal", name: "Mercy Heal", text: "When this reveals, each player with 10 LP or less heals 3.",
    onReveal: (G) => {
      for (const p of [0, 1]) {
        if (P(G, p).lp <= 10) healPlayer(G, p, 3);
      }
    }
  },
  {
    id: "pity_token", name: "Pity Token", text: "When this reveals, the player with less LP summons a 1/1 Recruit Token here.",
    onReveal: (G, lane) => {
      const p = lowerLpPlayer(G);
      if (p == null) return;
      spawnTokenHere(G, p, lane, "token_recruit");
    }
  },
  {
    id: "odd_draw", name: "Odd Draw", text: "When this reveals, each player with an odd hand size draws 1.",
    onReveal: (G) => {
      for (const p of [0, 1]) {
        if (P(G, p).hand.length % 2 === 1) drawCards(G, p, 1);
      }
    }
  },
  {
    id: "high_clip", name: "High Clip", text: "When this reveals, each player with more than 15 LP takes 1.",
    onReveal: (G) => {
      for (const p of [0, 1]) {
        if (P(G, p).lp > 15) dealDamageToPlayer(G, p, 1, null);
      }
    }
  },
  {
    id: "rickety_bridge", name: "Rickety Bridge", text: "End of turn: if you have 2 monsters here, destroy the left one.",
    onTurnEnd: (G, lane) => {
      const [a, b] = laneZones(lane);
      const pl = P(G, G.tp);
      if (pl.mz[a] && pl.mz[b]) destroyByEffect(G, pl.mz[a], laneSrc(lane));
    }
  },
  {
    id: "titan_maw", name: "Titan Maw", text: "End of turn: destroy your lowest-ATK monster here.",
    onTurnEnd: (G, lane) => {
      const mine = monstersInLane(G, G.tp, lane);
      if (!mine.length) return;
      mine.sort((a, b) => preLaneStat(G, a, "atk") - preLaneStat(G, b, "atk"));
      destroyByEffect(G, mine[0], laneSrc(lane));
    }
  },
  {
    id: "nexus_pulse", name: "Nexus Pulse", text: "End of turn: if you have a monster here, your monsters in other lanes get +1 ATK this turn.",
    onTurnEnd: (G, lane) => {
      if (!monstersInLane(G, G.tp, lane).length) return;
      for (const m of monstersOf(G, G.tp)) {
        if (!inLane(lane, m)) buff(G, m, 1, 0, { permanent: false });
      }
    }
  },
  {
    id: "mill_camp", name: "Mill Camp", text: "End of turn: if you have a monster here, mill 1.",
    onTurnEnd: (G, lane) => {
      if (monstersInLane(G, G.tp, lane).length) mill(G, G.tp, 1);
    }
  },
  {
    id: "twin_ping", name: "Twin Ping", text: "End of turn: if you have 2 monsters here, deal 1 to the enemy leader.",
    onTurnEnd: (G, lane) => {
      if (monstersInLane(G, G.tp, lane).length >= 2) dealDamageToPlayer(G, opp(G.tp), 1, null);
    }
  },
  {
    id: "grow_shell", name: "Grow Shell", text: "End of turn: your monsters here get +0/+1.",
    onTurnEnd: (G, lane) => {
      for (const m of monstersInLane(G, G.tp, lane)) buff(G, m, 0, 1, { permanent: true });
    }
  },
  {
    id: "overflow_discard", name: "Overflow", text: "End of turn: if you have 6 or more cards in hand, discard 1 at random.",
    onTurnEnd: (G) => {
      const hand = P(G, G.tp).hand;
      if (hand.length >= 6) discardCard(G, G.rng.pick(hand));
    }
  },
  {
    id: "ep_steal", name: "EP Steal", text: "End of turn: if you have more ATK here, steal 1 EP from the opponent.",
    onTurnEnd: (G, lane) => {
      const power = (p) => monstersInLane(G, p, lane).reduce((n, m) => n + getATK(G, m), 0);
      const o = opp(G.tp);
      if (power(G.tp) <= power(o) || P(G, o).ep <= 0) return;
      P(G, o).ep -= 1;
      P(G, G.tp).ep += 1;
      log(G, "EP Steal siphons 1 EP.", "lane");
    }
  },
  {
    id: "dawn_lock", name: "Dawn Lock", text: "This lane is sealed on odd turns.",
    locksZone: (G, lane, p, z) => G.turnCount % 2 === 1 && lockLaneZones(lane, z)
  },
  {
    id: "overtime_lock", name: "Overtime Lock", text: "From turn 6 on, nothing can be summoned in this lane.",
    locksZone: (G, lane, p, z) => G.turnCount >= 6 && lockLaneZones(lane, z)
  },
  {
    id: "split_lock", name: "Split Lock", text: "The right zone in this lane is sealed (odd index).",
    locksZone: (G, lane, p, z) => z === lane.index * 2 + 1
  },
  {
    id: "late_spell", name: "Late Spell", text: "After turn 3, spell zones in this lane are sealed.",
    locksSpellZone: (G, lane, p, z) => G.turnCount > 3 && lockLaneZones(lane, z)
  }
];

/** Visual theme keys used by the duel board (glows, zone tints, banners). */
export const LANE_THEMES = {
  ember_rift: "fire", frozen_wastes: "ice", razor_cliffs: "blood", high_ground: "holy",
  whispering_hollow: "dark", ancient_grove: "nature", war_drum: "fire", mana_geyser: "holy",
  mirror_pool: "water", cursed_ground: "dark", sealed_cavern: "void", sanctum_chains: "holy",
  thunder_mesa: "storm", stillwater: "ice", crossroads: "gold", ashfall: "fire",
  glass_spire: "gold", rootbound: "nature", nightmarket: "gold", iron_gate: "void",
  echo_canyon: "nature", sunken_forum: "rush", blade_orchard: "nature", quiet_library: "water",
  blood_tide: "blood", skybridge: "storm", ruin_clock: "void", aurora_steppe: "holy",
  haste_dunes: "storm", solar_flare: "fire", moon_veil: "ice", colosseum: "rush",
  gravity_well: "void", vampire_fen: "blood", storm_spire: "storm", wild_surge: "rush",
  banish_gate: "void", spell_lock: "void", twin_sun: "gold", fog_bank: "dark",
  phoenix_nest: "fire", lottery_well: "gold", berserker_ring: "rush", silent_scriptorium: "dark",
  hex_garden: "nature", aegis_wall: "holy",
  war_banner: "rush", crimson_arena: "blood", summit_keep: "holy", evolution_roost: "fire",
  contact_crucible: "gold", cinder_march: "fire", abyss_moat: "ice", terra_root: "nature",
  open_bazaar: "gold", dawn_altar: "holy", fault_line: "void", banner_rise: "holy",
  glass_kiln: "fire", silt_river: "water", campfire_ridge: "fire", empty_watch: "void",
  buried_vault: "void", wind_tunnel: "storm",
  lone_peak: "holy", weenie_pub: "rush", vanilla_gym: "gold", mob_rule: "blood",
  inverted_peak: "void", clone_vats: "water", echo_twin: "storm", double_anvil: "gold",
  rebound_bar: "rush", death_altar: "blood", danger_crucible: "fire", scout_hub: "gold",
  crosscurrent: "water", hatchery: "nature", pegasus_core: "holy", mind_rift: "dark",
  muir_bloom: "nature", empty_current: "void", victor_spoils: "gold", murder_pit: "void",
  nidavell_forge: "gold", necro_shade: "dark", negative_zone: "void", keyword_citadel: "holy",
  top_dog: "rush", lake_lv4: "water", deep_halls: "void", cosmos_high: "blood",
  nova_hand: "gold", gy_choir: "dark", hurt_shell: "ice", token_fair: "nature",
  odd_clock: "storm", underdog: "rush", face_race: "blood", sinkhole: "void",
  machine_press: "gold", sokovia_wind: "storm", rockfall: "void", mold_works: "nature",
  the_raft: "void", gamma_pit: "fire", hala_sweep: "holy", quantum_well: "storm",
  first_blood: "blood", gy_rescue: "dark", ep_well: "holy", freeze_bit: "ice",
  stone_skin: "void", double_tax: "gold", mirror_hand: "water", banish_spy: "void",
  tax_draw: "gold", cave_in: "void", attilan_shuffle: "storm", plunder_keep: "gold",
  tinker_bench: "gold", lamentis_cut: "void", boot_camp: "rush", nightmare_vault: "dark",
  embassy_wave: "holy", x_mansion: "gold", stark_spire: "gold", hellfire_cull: "fire",
  big_house: "void", wakanda_mend: "holy", kyln_gate: "void", lockdown_lab: "void",
  milano_gate: "rush", odd_lock: "dark",
  tank_line: "holy", glass_jaw: "blood", last_stand: "blood", full_life: "holy",
  empty_grip: "rush", stuffed_grip: "gold", ban_choir: "void", extra_hum: "gold",
  set_battery: "dark", swarm_hum: "rush", paper_thin: "blood", mid_band: "nature",
  dual_tribe: "fire", night_blade: "dark", even_scale: "gold", odd_scale: "storm",
  clean_gy: "holy", wounded_pride: "blood", coin_buff: "gold", bounce_neighbor: "water",
  spy_mill: "dark", heal_pulse: "holy", board_ping: "fire", self_exile: "void",
  gy_clone: "dark", snatch_set: "storm", overpay: "gold", moon_book: "void",
  catchup_rush: "rush", tribute_draw: "gold", four_shock: "storm", hungry_token: "nature",
  deck_cycle: "water", force_discard: "blood", twin_mill: "void", rally_turn: "rush",
  freeze_lane: "ice", print_swap: "void", double_shell: "holy", hand_burn: "fire",
  mutual_discard: "dark", mutual_exile: "void", shared_core: "holy", lp_tax: "blood",
  draw_to_four: "gold", underdog_ep: "rush", mill_storm: "void", gy_top: "dark",
  spell_crash: "fire", unban: "holy", mercy_heal: "holy", pity_token: "nature",
  odd_draw: "gold", high_clip: "blood", rickety_bridge: "void", titan_maw: "blood",
  nexus_pulse: "storm", mill_camp: "void", twin_ping: "fire", grow_shell: "nature",
  overflow_discard: "gold", ep_steal: "void", dawn_lock: "holy", overtime_lock: "void",
  split_lock: "void", late_spell: "dark"
};

export function laneTheme(id) {
  return LANE_THEMES[id] || "gold";
}

function dummyLockG(turn) {
  return {
    turnCount: turn,
    players: [0, 1].map(() => ({
      mz: [null, null, null, null, null, null],
      stz: [null, null, null, null, null, null]
    }))
  };
}

/** True when this lane would seal both of its monster zones on this turn (empty board). */
export function laneLocksBothZones(def, index, turn) {
  if (typeof def?.locksZone !== "function") return false;
  const lane = { def, index, revealed: true };
  const G = dummyLockG(turn);
  const a = index * 2, b = a + 1;
  return !!(def.locksZone(G, lane, 0, a) && def.locksZone(G, lane, 0, b));
}

/** False if some turn 1–12 would seal all 6 monster zones once lanes reveal on 1/3/5. */
export function laneComboPlayable(defs) {
  if (!defs?.length) return true;
  for (let t = 1; t <= 12; t++) {
    let locked = 0;
    defs.forEach((def, i) => {
      const due = i === 0 ? 1 : i === 1 ? 3 : 5;
      if (t < due) return;
      if (laneLocksBothZones(def, i, t)) locked += 2;
    });
    if (locked >= 6) return false;
  }
  return true;
}

const SAFE_DRAW_IDS = ["ember_rift", "high_ground", "echo_canyon"];

export function drawLanes(rng, count = 3) {
  for (let n = 0; n < 120; n++) {
    const pool = [...FIELD_LANES];
    rng.shuffle(pool);
    const pick = pool.slice(0, count);
    if (laneComboPlayable(pick)) return pick;
  }
  return SAFE_DRAW_IDS.map((id) => FIELD_LANES.find((l) => l.id === id));
}
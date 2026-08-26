// Field Lane pool — the Marvel Snap layer. Each duel draws 3 distinct lanes.
// Lane 1 (zones 0-1) reveals at duel start, lane 2 (zones 2-3) on turn 3,
// lane 3 (zones 4-5, and those spell columns) on turn 5.
//
// Hooks: modifyStat(G,lane,card,v,stat), locksZone(G,lane,p,z),
// locksSpellZone, noAttack, onSummon(G,lane,card), onTurnEnd(G,lane),
// onReveal(G,lane)

import { log, monstersOf, opp, P, monsterLevel, hasKeyword } from "../engine/state.js";
import { buff, damageMonster, sweepDestroyed, healPlayer, drawCards, dealDamageToPlayer, banishCard, mill } from "../engine/ops.js";

const stat = (atkFn) => (G, lane, card, v, s) => atkFn(G, lane, card, v, s);

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
  buried_vault: "void", wind_tunnel: "storm"
};

export function laneTheme(id) {
  return LANE_THEMES[id] || "gold";
}

export function drawLanes(rng, count = 3) {
  const pool = [...FIELD_LANES];
  rng.shuffle(pool);
  return pool.slice(0, count);
}
// Must-ship 12 + silver complete loaner decks (40 main + Extra). Unfinished styles stay hidden.
import { META_STAPLE_MAIN, META_STAPLE_EXTRA } from "./starters.js";

const x = (id, n) => Array(n).fill(id);

const FILL_CHAIN = [
  "scroll_greed", "null_seal", "moonwell", "ember_spark",
  "root_snare", "tidal_snare", "stone_skin"
];

function deck40(parts, fill = "scroll_greed") {
  const ids = parts.flat();
  if (ids.length > 40) {
    throw new Error(`deck40 overflow ${ids.length}: extra ${ids.slice(40).join(",")}`);
  }
  const chain = [fill, ...FILL_CHAIN.filter((id) => id !== fill)];
  const count = (id) => ids.filter((c) => c === id).length;
  while (ids.length < 40) {
    const next = chain.find((id) => count(id) < 3);
    if (!next) throw new Error(`deck40: cannot legally fill (${ids.length}/40)`);
    ids.push(next);
  }
  return ids;
}

/** @type {Record<string, { id: string, name: string, pillar: string, ship: 'must'|'silver', desc: string, deck: string[], extra: string[] }>} */
export const LOANER_DECKS = {
  aggro_swarm: {
    id: "aggro_swarm", name: "Aggro Swarm", pillar: "Aggro", ship: "must",
    desc: "Flood the board with Rush bodies and swing face.",
    deck: deck40([
      x("rush_swarmling", 3), x("ember_fox", 3), x("burn_spark_imp", 3),
      x("cinder_knight", 3), x("swift_falcon", 3), x("flame_djinn", 3),
      x("ash_prophet", 2), x("doomblade_novice", 2), ["jestling"],
      x("ember_spark", 3), x("fever_pitch", 2), x("burning_lance", 3),
      x("flame_banner", 2), x("null_seal", 2), ["backdraft", "surge_imp"]
    ]),
    extra: ["fusion_ember_drake", "fusion_choice_blade"]
  },
  burn: {
    id: "burn", name: "Face Burn", pillar: "Aggro", ship: "must",
    desc: "Chip the leader every summon; Fever Pitch closes.",
    deck: deck40([
      x("burn_spark_imp", 3), x("ember_fox", 3), x("ash_prophet", 3),
      x("cinder_knight", 3), x("swift_falcon", 2), x("pyro_hydra", 2),
      x("lava_giant", 2), x("spark_raider", 2), x("doomblade_novice", 2),
      ["inferno_titan", "jestling"],
      x("ember_spark", 3), x("fever_pitch", 2), x("burning_lance", 3),
      x("flame_banner", 2), x("lane_breaker", 2), x("null_seal", 2)
    ]),
    extra: ["fusion_ember_drake"]
  },
  contact_combo: {
    id: "contact_combo", name: "Contact Combo", pillar: "Combo", ship: "must",
    desc: "Assemble materials, Contact into Ember Drake, ladder if open.",
    deck: deck40([
      x("ember_fox", 3), x("cinder_knight", 3), x("fusion_polymer", 1),
      x("swift_falcon", 3), x("doomblade_novice", 3), x("flame_djinn", 2),
      x("scav_wisp", 2), x("ash_prophet", 2), x("nimbus_knight", 2),
      ["jestling"],
      x("gy_fusion_rite", 1), x("ash_whisper", 2), x("ember_spark", 2),
      x("null_seal", 2), x("burning_lance", 2), ["flame_banner", "tidal_snare"]
    ]),
    extra: ["fusion_ember_drake"]
  },
  circuit_relay: {
    id: "circuit_relay", name: "Circuit Relay", pillar: "Combo", ship: "must",
    desc: "Neutral 2–3 card loops. Every pair shares a verb — Spellchain, Pitch, Muster, Harvest.",
    deck: deck40([
      x("sigil_courier", 1), x("chain_acolyte", 1), x("relay_sprite", 1),
      x("echo_adept", 1), x("ledger_imp", 1), x("salvage_wisp", 1),
      x("carrion_bell", 1), x("exile_warden", 1), x("muster_drum", 1),
      x("grave_ledger", 1), x("gem_golem", 3), x("grove_elder", 3),
      x("moss_sprite", 3), x("shield_sprite", 2),
      x("spark_offering", 1), x("exile_pact", 1), x("rally_horn", 1),
      x("hand_relay", 1), x("scroll_greed", 2), x("relay_chain", 1),
      x("null_seal", 2), ["loop_warden", "dawn_pixie", "wild_call"]
    ]),
    extra: ["fusion_staple_knight", "fusion_staple_aegis"]
  },
  control_counters: {
    id: "control_counters", name: "Control / Counters", pillar: "Control", ship: "must",
    desc: "Answer everything with snares, counters, and hand traps.",
    deck: deck40([
      x("tide_caller", 3), x("frost_mage", 3), x("abyss_warden", 2),
      x("ambush_stalker", 2), x("drain_leech", 2), x("tide_priestess", 3),
      x("depths_lurker", 2), x("scav_wisp", 2), x("oracle_eel", 2),
      x("tide_cutter", 2),
      x("tidal_snare", 3), x("ash_whisper", 2), x("veil_negate", 2),
      x("null_seal", 2), x("judgment_chain", 2), x("lane_breaker", 2),
      x("edict_squire", 2)
    ], "moonwell"),
    extra: ["fusion_abyss_leviathan"]
  },
  gy: {
    id: "gy", name: "GY Grind", pillar: "GY", ship: "must",
    desc: "Fill the GY, Call the Fallen, grind value.",
    deck: deck40([
      x("scav_wisp", 2), x("jestling", 1), x("mawling", 3),
      x("drain_leech", 2), x("mill_spore", 2), x("tide_priestess", 3),
      x("depths_lurker", 2), x("oracle_eel", 2), x("grinning_echo", 2),
      x("frost_mage", 2), ["kraken", "void_pilgrim"],
      x("call_fallen", 2), x("tidal_snare", 2), x("moonwell", 2),
      x("riptide", 2), x("null_seal", 2), x("silencing_depths", 2),
      ["tide_cutter"]
    ], "call_fallen"),
    extra: ["fusion_abyss_leviathan"]
  },
  mill: {
    id: "mill", name: "Mill", pillar: "GY", ship: "must",
    desc: "Mill the opponent out; Hollow Tax and Deep Hollow burn them on the way.",
    deck: deck40([
      x("mill_spore", 3), x("mill_lantern", 3), x("mill_angler", 2),
      x("tide_caller", 2), x("frost_mage", 2), x("scav_wisp", 3),
      x("depths_lurker", 2), x("oracle_eel", 2), x("drain_leech", 2), ["kraken"],
      x("deep_current", 2), x("hollow_tax", 2), x("silencing_depths", 2),
      x("moonwell", 2), x("riptide", 2), x("tidal_snare", 2), x("null_seal", 2),
      ["call_fallen"]
    ], "silencing_depths"),
    extra: ["fusion_mill_maw", "fusion_deep_hollow"]
  },
  heal_ramp: {
    id: "heal_ramp", name: "Heal / Ramp", pillar: "Ramp", ship: "must",
    desc: "Heal up, ramp into Colossus and grove bosses.",
    deck: deck40([
      x("heal_bloom", 2), x("moss_sprite", 3), x("dawn_pixie", 3),
      x("seed_sage", 2), x("grove_elder", 2), x("evolve_colossus", 2),
      x("world_turtle", 2), x("ward_sentinel", 2), x("shield_sprite", 2),
      x("overgrowth", 2), x("moonwell", 2), x("stone_skin", 2),
      x("wild_call", 2), x("verdant_rebuke", 2), x("null_seal", 2),
      x("thorn_archer", 2), ["root_snare", "final_edict"]
    ], "overgrowth"),
    extra: ["fusion_terra_crown"]
  },
  ward_walls: {
    id: "ward_walls", name: "Ward Walls", pillar: "Walls", ship: "must",
    desc: "Ward bodies force unfavorable attacks; stall into value.",
    deck: deck40([
      x("ward_sentinel", 3), x("shield_sprite", 3), x("stoneback", 3),
      x("heal_bloom", 2), x("gem_golem", 2), x("world_turtle", 2),
      x("abyss_warden", 2), x("grove_elder", 2), x("moss_sprite", 2),
      ["dawn_pixie"],
      x("stone_skin", 2), x("moonwell", 2), x("overgrowth", 2),
      x("root_snare", 2), x("null_seal", 2), x("lane_breaker", 2),
      x("bastion_oak", 2), ["final_edict", "wild_call"]
    ], "stone_skin"),
    extra: ["fusion_choice_shield", "fusion_abyss_leviathan"]
  },
  big_evolve: {
    id: "big_evolve", name: "Big Evolve", pillar: "Ramp", ship: "must",
    desc: "Survive to turn 3+, Evolve Colossus and wolves for lethal.",
    deck: deck40([
      x("evolve_colossus", 3), x("wolf_alpha", 3), x("thorn_archer", 3),
      x("grove_elder", 2), x("nimbus_knight", 2), x("seed_sage", 2),
      x("shield_sprite", 2), x("void_pilgrim", 2), x("pyre_colossus", 2),
      ["world_turtle"],
      x("overgrowth", 3), x("stone_skin", 2), x("wild_call", 2),
      x("null_seal", 2), x("verdant_rebuke", 2), x("root_snare", 2),
      x("lane_breaker", 2), ["final_edict"]
    ], "overgrowth"),
    extra: ["fusion_terra_crown"]
  },
  fusion_ladder: {
    id: "fusion_ladder", name: "Fusion Ladder", pillar: "Combo", ship: "must",
    desc: "Contact into Drake, then ladder into Crown of the Grove.",
    deck: deck40([
      x("ember_fox", 3), x("cinder_knight", 3), x("fusion_polymer", 1),
      x("moss_sprite", 3), x("grove_elder", 2), x("swift_falcon", 2),
      x("doomblade_novice", 2), x("dawn_pixie", 2), x("scav_wisp", 2),
      ["jestling", "seed_sage"],
      x("gy_fusion_rite", 1), x("ash_whisper", 2), x("wild_call", 2),
      x("null_seal", 2), x("overgrowth", 2), x("root_snare", 2),
      ["ember_spark"]
    ]),
    extra: ["fusion_ember_drake"]
  },
  hybrid_abyss_tempo: {
    id: "hybrid_abyss_tempo", name: "Ignis/Abyss Tempo", pillar: "Midrange", ship: "must",
    desc: "Burn pressure with Ambush and hand-trap interaction.",
    deck: deck40([
      x("ember_fox", 3), x("cinder_knight", 3), x("burn_spark_imp", 2),
      x("ambush_stalker", 2), x("tide_caller", 2), x("frost_mage", 2),
      x("ash_prophet", 2), x("swift_falcon", 2), x("drain_leech", 2),
      ["doomblade_novice"],
      x("ember_spark", 2), x("ash_whisper", 2), x("tidal_snare", 2),
      x("burning_lance", 2), x("null_seal", 2), x("lane_breaker", 2),
      ["veil_negate", "riptide", "flame_banner"]
    ]),
    extra: ["fusion_ember_drake", "fusion_abyss_leviathan"]
  },
  hybrid_terra_abyss: {
    id: "hybrid_terra_abyss", name: "Terra/Abyss Control", pillar: "Control", ship: "must",
    desc: "Ward walls plus abyss answers; Leviathan closes.",
    deck: deck40([
      x("ward_sentinel", 3), x("heal_bloom", 3), x("tide_caller", 2),
      x("frost_mage", 2), x("stoneback", 2), x("abyss_warden", 2),
      x("drain_leech", 2), x("shield_sprite", 2), x("moss_sprite", 2),
      x("tidal_snare", 2), x("moonwell", 2), x("stone_skin", 2),
      x("null_seal", 2), x("ash_whisper", 2), x("verdant_rebuke", 2),
      ["final_edict", "veil_negate", "call_fallen", "root_snare"]
    ], "moonwell"),
    extra: ["fusion_abyss_leviathan", "fusion_choice_shield"]
  },
  meta_staples: {
    id: "meta_staples", name: "Meta Staples", pillar: "Control", ship: "must",
    desc: "Hand traps, bolts, bounces, tributes, and a board wipe — the last 30 years of jobs.",
    deck: META_STAPLE_MAIN,
    extra: META_STAPLE_EXTRA
  },

  /* -------------------- Silver loaners (~28) -------------------- */
  wide_rush: {
    id: "wide_rush", name: "Wide Rush", pillar: "Aggro", ship: "silver",
    desc: "Silver rush engines flood lanes and race face.",
    deck: deck40([
      x("rush_swarmling", 3), x("silver_ember_scout", 3), x("swift_falcon", 3),
      x("ember_fox", 3), x("silver_lane_surfer", 2), x("cinder_knight", 3),
      x("nimbus_knight", 2), x("doomblade_novice", 2), ["jestling"],
      x("silver_going_second", 2), x("ember_spark", 2), x("fever_pitch", 1),
      x("burning_lance", 2), x("ash_whisper", 2), x("null_seal", 2)
    ]),
    extra: ["fusion_ember_drake", "fusion_choice_blade"]
  },
  spell_tempo: {
    id: "spell_tempo", name: "Spell Tempo", pillar: "Aggro", ship: "silver",
    desc: "Quick damage and Ignis bodies keep pressure on every chain.",
    deck: deck40([
      x("silver_ember_scout", 3), x("ash_prophet", 3), x("ember_fox", 3),
      x("cinder_knight", 3), x("burn_spark_imp", 2), x("swift_falcon", 2),
      x("flame_djinn", 2), x("doomblade_novice", 2), ["jestling"],
      x("silver_tempo_bolt", 3), x("ember_spark", 3), x("fever_pitch", 2),
      x("burning_lance", 2), x("shatter_sigil", 2), x("null_seal", 2),
      ["mind_surge", "flame_banner"]
    ]),
    extra: ["fusion_ember_drake"]
  },
  token_walls: {
    id: "token_walls", name: "Token Walls", pillar: "Walls", ship: "silver",
    desc: "Mason and Sprouter raise real token walls; Warden Titan crowns them.",
    deck: deck40([
      x("silver_token_mason", 2), x("token_sprouter", 2), x("ward_sentinel", 3),
      x("shield_sprite", 3), x("stoneback", 3), x("heal_bloom", 2),
      x("gem_golem", 2), x("moss_sprite", 2), x("dawn_pixie", 2), ["grove_elder"],
      x("stone_skin", 3), x("moonwell", 2), x("overgrowth", 2),
      x("root_snare", 2), x("verdant_rebuke", 2), x("null_seal", 2)
    ], "stone_skin"),
    extra: ["fusion_choice_shield", "fusion_warden_titan"]
  },
  discard_payoff: {
    id: "discard_payoff", name: "Discard Payoff", pillar: "GY", ship: "silver",
    desc: "Discard Wraith and GY tools convert discard into board.",
    deck: deck40([
      x("silver_discard_wraith", 1), x("scav_wisp", 2), x("frost_mage", 3),
      x("cinder_knight", 2), x("drain_leech", 2), x("grinning_echo", 1),
      x("tide_priestess", 2), x("oracle_eel", 2), x("ambush_stalker", 2),
      x("lane_breaker", 2), x("tide_caller", 2),
      x("call_fallen", 1), x("moonwell", 2), x("tidal_snare", 2),
      x("null_seal", 2), x("ash_whisper", 2), x("silencing_depths", 2),
      ["mind_surge", "edict_squire"]
    ], "call_fallen"),
    extra: ["fusion_abyss_leviathan"]
  },
  lane_surfer: {
    id: "lane_surfer", name: "Lane Surfer", pillar: "Midrange", ship: "silver",
    desc: "Lane Surfer and rush packages contest every row.",
    deck: deck40([
      x("silver_lane_surfer", 3), x("swift_falcon", 3), x("rush_swarmling", 3),
      x("nimbus_knight", 2), x("ember_fox", 2), x("cinder_knight", 2),
      x("thorn_archer", 2), x("doomblade_novice", 2), x("silver_ember_scout", 2),
      ["surge_imp"],
      x("ember_spark", 2), x("lane_breaker", 2), x("burning_lance", 2),
      x("null_seal", 2), x("fever_pitch", 1), x("silver_tempo_bolt", 2),
      ["flame_banner", "verdant_rebuke"]
    ]),
    extra: ["fusion_choice_blade"]
  },
  otk_face: {
    id: "otk_face", name: "OTK Face", pillar: "Aggro", ship: "silver",
    desc: "OTK Blade and burn closers aim to end in one swing.",
    deck: deck40([
      x("silver_otk_blade", 3), x("burn_spark_imp", 3), x("ember_fox", 3),
      x("cinder_knight", 3), x("ash_prophet", 2), x("pyro_hydra", 2),
      x("flame_djinn", 2), x("lane_breaker", 2), x("swift_falcon", 2),
      x("rush_swarmling", 3), ["inferno_titan"],
      x("fever_pitch", 3), x("ember_spark", 3), x("burning_lance", 3),
      x("flame_banner", 2), x("spark_raider", 2), ["null_seal"]
    ]),
    extra: ["fusion_ember_drake"]
  },
  heal_stall: {
    id: "heal_stall", name: "Heal Stall", pillar: "Walls", ship: "silver",
    desc: "Stall Shell and lifegain force the opponent into bad clocks.",
    deck: deck40([
      x("silver_token_mason", 3), x("token_sprouter", 3), x("ward_sentinel", 3),
      x("shield_sprite", 3), x("heal_bloom", 3), x("silver_stall_shell", 2),
      x("wolf_alpha", 2), ["world_turtle"],
      x("stone_skin", 3), x("overgrowth", 2), x("root_snare", 2),
      x("verdant_rebuke", 2), x("null_seal", 2), x("ash_whisper", 2),
      ["final_edict", "wild_call"]
    ], "stone_skin"),
    extra: ["fusion_choice_shield"]
  },
  drain_walls: {
    id: "drain_walls", name: "Drain Walls", pillar: "Control", ship: "silver",
    desc: "Drain bodies plus walls grind LP while answering threats.",
    deck: deck40([
      x("drain_leech", 3), x("silver_stall_shell", 2), x("abyss_warden", 3),
      x("ward_sentinel", 2), x("tide_caller", 3), x("frost_mage", 3),
      x("shield_sprite", 2), x("heal_bloom", 2), x("tide_cutter", 2),
      ["depths_lurker"],
      x("moonwell", 2), x("tidal_snare", 3),
      x("null_seal", 2), x("riptide", 2), x("ash_whisper", 2),
      ["verdant_rebuke", "veil_negate"]
    ], "moonwell"),
    extra: ["fusion_abyss_leviathan", "fusion_choice_shield"]
  },
  chain_lock: {
    id: "chain_lock", name: "Chain Lock", pillar: "Control", ship: "silver",
    desc: "Chain Lock Adept and counters freeze the opponent's options.",
    deck: deck40([
      x("silver_chain_lock", 3), x("tide_caller", 3), x("frost_mage", 3),
      x("ambush_stalker", 2), x("oracle_eel", 2), x("abyss_warden", 2),
      x("deep_serpent", 2), x("scav_wisp", 2), x("tide_cutter", 2),
      ["chrono_mite"],
      x("tidal_snare", 3), x("null_seal", 2), x("judgment_chain", 2),
      x("veil_negate", 2), x("ash_whisper", 2), x("deep_freeze", 2),
      x("edict_squire", 2), ["final_edict", "sealbreak"]
    ], "moonwell"),
    extra: ["fusion_abyss_leviathan"]
  },
  choice_recipe: {
    id: "choice_recipe", name: "Choice Recipe", pillar: "Combo", ship: "silver",
    desc: "Choice Agent substitutes flex into Blade or Shield lines.",
    deck: deck40([
      x("silver_choice_agent", 1), x("fusion_polymer", 1), x("ember_fox", 3),
      x("cinder_knight", 3), x("scav_wisp", 2), x("moss_sprite", 2),
      x("doomblade_novice", 2), x("swift_falcon", 2), x("dawn_pixie", 2),
      x("frost_mage", 2), x("spark_raider", 2), ["jestling"],
      x("gy_fusion_rite", 1), x("ash_whisper", 2), x("wild_call", 2),
      x("null_seal", 2), x("ember_spark", 2), x("tidal_snare", 2),
      ["overgrowth"]
    ]),
    extra: ["fusion_ember_drake", "fusion_choice_blade"]
  },
  substitute_toolbox: {
    id: "substitute_toolbox", name: "Substitute Toolbox", pillar: "Combo", ship: "silver",
    desc: "Polymer and Choice Agent open every contact recipe.",
    deck: deck40([
      x("fusion_polymer", 1), x("silver_choice_agent", 1), x("ember_fox", 3),
      x("cinder_knight", 2), x("moss_sprite", 2), x("scav_wisp", 2),
      x("frost_mage", 2), x("doomblade_novice", 2), x("grove_elder", 2),
      ["seed_sage"],
      x("gy_fusion_rite", 2), x("ash_whisper", 2), x("null_seal", 2),
      x("wild_call", 2), x("overgrowth", 2), x("tidal_snare", 2),
      ["ember_spark"]
    ]),
    extra: ["fusion_ember_drake"]
  },
  comeback_toolbox: {
    id: "comeback_toolbox", name: "Comeback Toolbox", pillar: "Midrange", ship: "silver",
    desc: "Comeback Scroll and resilient midrange claw back from low LP.",
    deck: deck40([
      x("silver_lifegain_mid", 3), x("heal_bloom", 3), x("scav_wisp", 2),
      x("void_pilgrim", 2), x("ward_sentinel", 2), x("cinder_knight", 2),
      x("tide_caller", 2), x("doomblade_novice", 2), x("shield_sprite", 2),
      ["nimbus_knight"],
      x("silver_comeback_draw", 2), x("moonwell", 2), x("call_fallen", 2),
      x("null_seal", 2), x("lane_breaker", 2), x("root_snare", 2),
      ["verdant_rebuke"]
    ], "moonwell"),
    extra: ["fusion_choice_shield"]
  },
  going_second: {
    id: "going_second", name: "Going Second", pillar: "Aggro", ship: "silver",
    desc: "Second-Strike Banner buffs rush after the opponent commits.",
    deck: deck40([
      x("rush_swarmling", 3), x("silver_ember_scout", 3), x("swift_falcon", 3),
      x("ember_fox", 2), x("cinder_knight", 3), x("spark_raider", 2),
      x("silver_otk_blade", 2), x("doomblade_novice", 2), ["surge_imp"],
      x("silver_going_second", 3), x("fever_pitch", 3), x("ember_spark", 3),
      x("burning_lance", 2), x("null_seal", 2), x("lane_breaker", 2),
      ["flame_banner"]
    ]),
    extra: ["fusion_ember_drake", "fusion_choice_blade"]
  },
  evolve_burn: {
    id: "evolve_burn", name: "Evolve Burn", pillar: "Ramp", ship: "silver",
    desc: "Evolve Burner bridges Colossus lines into face damage.",
    deck: deck40([
      x("silver_evolve_burn", 3), x("evolve_colossus", 2), x("wolf_alpha", 2),
      x("ember_fox", 3), x("cinder_knight", 2), x("burn_spark_imp", 2),
      x("thorn_archer", 2), x("seed_sage", 2), ["nimbus_knight"],
      x("overgrowth", 2), x("ember_spark", 2), x("fever_pitch", 2),
      x("wild_call", 2), x("burning_lance", 2), x("null_seal", 2),
      x("pyre_colossus", 2), x("lane_breaker", 2), ["verdant_rebuke", "flame_banner"]
    ], "overgrowth"),
    extra: ["fusion_terra_crown", "fusion_ember_drake"]
  },
  tempo_bounce: {
    id: "tempo_bounce", name: "Tempo Bounce", pillar: "Midrange", ship: "silver",
    desc: "Bounce Tide and Riptide reset boards while advancing yours.",
    deck: deck40([
      x("silver_bounce_tide", 3), x("tide_caller", 3), x("frost_mage", 3),
      x("ambush_stalker", 2), x("swift_falcon", 2), x("doomblade_novice", 2),
      x("depths_lurker", 2), x("cinder_knight", 2), ["oracle_eel"],
      x("riptide", 3), x("tidal_snare", 2), x("ember_spark", 2),
      x("null_seal", 2), x("ash_whisper", 2), x("tide_cutter", 2),
      x("lane_breaker", 2), ["shatter_sigil"]
    ]),
    extra: ["fusion_abyss_leviathan"]
  },
  ramp_into_boss: {
    id: "ramp_into_boss", name: "Ramp into Boss", pillar: "Ramp", ship: "silver",
    desc: "Ramp Seed accelerates into turtles, titans, and crowns.",
    deck: deck40([
      x("silver_ramp_seed", 3), x("seed_sage", 3), x("moss_sprite", 3),
      x("grove_elder", 2), x("evolve_colossus", 2), x("world_turtle", 2),
      x("wolf_alpha", 2), x("dawn_pixie", 2), x("heal_bloom", 2),
      x("thorn_archer", 2), ["nimbus_knight"],
      x("overgrowth", 3), x("wild_call", 2), x("moonwell", 2),
      x("stone_skin", 2), x("null_seal", 2), x("ash_whisper", 2),
      ["root_snare"]
    ], "overgrowth"),
    extra: []
  },
  stall_to_fusion: {
    id: "stall_to_fusion", name: "Stall to Fusion", pillar: "Combo", ship: "silver",
    desc: "Ward into polymer lines; Crown closes the grind.",
    deck: deck40([
      x("silver_fusion_stall", 2), x("ward_sentinel", 2), x("fusion_polymer", 1),
      x("shield_sprite", 2), x("moss_sprite", 2), x("ember_fox", 2),
      x("cinder_knight", 2), x("silver_choice_agent", 1), x("stoneback", 2),
      x("gem_golem", 2), ["grove_elder"],
      x("gy_fusion_rite", 1), x("stone_skin", 2), x("call_fallen", 2),
      x("overgrowth", 2), x("null_seal", 2), x("moonwell", 2),
      ["wild_call", "verdant_rebuke"]
    ], "stone_skin"),
    extra: []
  },
  handtrap_midrange: {
    id: "handtrap_midrange", name: "Hand-Trap Mid", pillar: "Midrange", ship: "silver",
    desc: "Veil Adept and interaction keep midrange trades honest.",
    deck: deck40([
      x("silver_handtrap_mid", 3), x("cinder_knight", 3), x("tide_caller", 2),
      x("frost_mage", 2), x("ember_fox", 3), x("swift_falcon", 2),
      x("doomblade_novice", 2), x("rush_swarmling", 2), x("spark_raider", 2),
      x("lane_breaker", 2), x("edict_squire", 2), ["ash_prophet"],
      x("ash_whisper", 2), x("veil_negate", 2), x("null_seal", 2),
      x("ember_spark", 2), ["riptide", "judgment_chain"]
    ]),
    extra: ["fusion_ember_drake", "fusion_abyss_leviathan"]
  },
  lifegain_midrange: {
    id: "lifegain_midrange", name: "Lifegain Mid", pillar: "Midrange", ship: "silver",
    desc: "Grove Mid and blooms stabilize into value trades.",
    deck: deck40([
      x("silver_lifegain_mid", 2), x("heal_bloom", 2), x("moss_sprite", 3),
      x("thorn_archer", 2), x("evolve_colossus", 2), x("seed_sage", 2),
      x("grove_elder", 2), x("dawn_pixie", 3), x("wolf_alpha", 2),
      x("world_turtle", 2),
      x("overgrowth", 2), x("wild_call", 2),
      x("root_snare", 2), x("null_seal", 2), x("verdant_rebuke", 2),
      x("ember_spark", 2), ["stone_skin"]
    ], "overgrowth"),
    extra: ["fusion_terra_crown"]
  },
  value_midrange: {
    id: "value_midrange", name: "Value Midrange", pillar: "Midrange", ship: "silver",
    desc: "Fair bodies and staples win long games through card quality.",
    deck: deck40([
      x("silver_lifegain_mid", 2), x("cinder_knight", 3), x("frost_mage", 2),
      x("thorn_archer", 2), x("scav_wisp", 2), x("wolf_alpha", 2),
      x("nimbus_knight", 2), x("doomblade_novice", 2), x("tide_caller", 2),
      x("grove_elder", 2), ["ember_fox"],
      x("lane_breaker", 2), x("ash_whisper", 2), x("null_seal", 2),
      x("ember_spark", 2), x("root_snare", 2), x("tidal_snare", 2),
      ["verdant_rebuke", "moonwell"]
    ]),
    extra: ["fusion_choice_blade", "fusion_choice_shield"]
  },
  tri_splash: {
    id: "tri_splash", name: "Tri-Splash", pillar: "Midrange", ship: "silver",
    desc: "Tri-Splash Agent bridges Ignis, Abyss, and Terra packages.",
    deck: deck40([
      x("silver_tri_splash", 3), x("ember_fox", 2), x("tide_caller", 2),
      x("moss_sprite", 2), x("cinder_knight", 2), x("frost_mage", 2),
      x("heal_bloom", 2), x("ambush_stalker", 2), x("thorn_archer", 2),
      ["doomblade_novice"],
      x("ember_spark", 2), x("tidal_snare", 2), x("moonwell", 2),
      x("null_seal", 2), x("root_snare", 2), x("ash_whisper", 2),
      x("veil_negate", 2), ["verdant_rebuke", "riptide"]
    ]),
      extra: ["fusion_ember_drake"]
  },
  ambush_trapdoor: {
    id: "ambush_trapdoor", name: "Ambush Trapdoor", pillar: "Control", ship: "silver",
    desc: "Ambush Door and the Queen punish overextension; the Fiend flips them all up.",
    deck: deck40([
      x("silver_ambush_door", 3), x("ambush_stalker", 3), x("trapdoor_queen", 2),
      x("sudden_maw", 2), x("tide_caller", 2),
      x("frost_mage", 2), x("abyss_warden", 2), x("depths_lurker", 2),
      x("drain_leech", 2), x("oracle_eel", 2), ["chrono_mite"],
      x("tidal_snare", 3), x("ash_whisper", 2), x("veil_negate", 2),
      x("null_seal", 2), x("trapdoor_lurker", 1), x("riptide", 2),
      x("lane_breaker", 2), x("tide_cutter", 2), ["final_edict"]
    ], "tidal_snare"),
    extra: ["fusion_abyss_leviathan", "fusion_trapdoor_fiend"]
  },
  gy_fusion_combo: {
    id: "gy_fusion_combo", name: "GY Fusion Combo", pillar: "Combo", ship: "silver",
    desc: "Gy Fusion Adept and rites assemble contact from the grave.",
    deck: deck40([
      x("silver_gy_fusion", 2), x("fusion_polymer", 1), x("scav_wisp", 2),
      x("ember_fox", 3), x("mawling", 2),
      x("cinder_knight", 2), x("frost_mage", 3), x("void_pilgrim", 2),
      x("oracle_eel", 2), x("lane_breaker", 2),
      ["doomblade_novice"],
      x("gy_fusion_rite", 2), x("call_fallen", 1), x("null_seal", 2),
      x("tidal_snare", 2), x("ember_spark", 2), x("ash_whisper", 2),
      ["moonwell"]
    ], "call_fallen"),
    extra: ["fusion_ember_drake"]
  },
  ignis_mid: {
    id: "ignis_mid", name: "Ignis Midrange", pillar: "Midrange", ship: "silver",
    desc: "Fair Ignis curve with interaction; Drake as payoff.",
    deck: deck40([
      x("ember_fox", 3), x("ash_prophet", 3), x("cinder_knight", 3),
      x("silver_ember_scout", 2), x("flame_djinn", 2), x("swift_falcon", 3),
      x("rush_swarmling", 2), x("doomblade_novice", 2), ["pyro_hydra"],
      x("ember_spark", 3), x("burning_lance", 2), x("fever_pitch", 2),
      x("null_seal", 2), x("lane_breaker", 2), x("spark_raider", 2),
      ["shatter_sigil"]
    ]),
    extra: ["fusion_ember_drake"]
  },
  abyss_tempo: {
    id: "abyss_tempo", name: "Abyss Tempo", pillar: "Midrange", ship: "silver",
    desc: "Abyss curve with bounce and snare keeps initiative.",
    deck: deck40([
      x("tide_caller", 3), x("frost_mage", 3), x("silver_bounce_tide", 3),
      x("ambush_stalker", 2), x("swift_falcon", 2), x("doomblade_novice", 2),
      x("depths_lurker", 2), x("cinder_knight", 2), ["oracle_eel"],
      x("riptide", 3), x("tidal_snare", 2), x("ember_spark", 2),
      x("null_seal", 2), x("ash_whisper", 2), x("tide_cutter", 2),
      x("lane_breaker", 2), ["shatter_sigil"]
    ]),
    extra: ["fusion_abyss_leviathan"]
  },
  terra_beat: {
    id: "terra_beat", name: "Terra Beat", pillar: "Midrange", ship: "silver",
    desc: "Terra beatdown with archers and wolves; Crown as finisher.",
    deck: deck40([
      x("moss_sprite", 3), x("thorn_archer", 3), x("wolf_alpha", 3),
      x("grove_elder", 2), x("dawn_pixie", 3), x("seed_sage", 2),
      x("nimbus_knight", 2), x("gem_golem", 2), x("shield_sprite", 2),
      ["world_turtle"],
      x("wild_call", 3), x("overgrowth", 2), x("root_snare", 2),
      x("verdant_rebuke", 2), x("null_seal", 2), x("stone_skin", 2),
      ["moonwell", "final_edict"]
    ], "overgrowth"),
    extra: []
  },
  counter_war: {
    id: "counter_war", name: "Counter War", pillar: "Control", ship: "silver",
    desc: "Stack counters and edicts; win the permission war.",
    deck: deck40([
      x("silver_chain_lock", 2), x("tide_caller", 3), x("frost_mage", 3),
      x("oracle_eel", 2), x("scav_wisp", 2), x("abyss_warden", 2),
      x("chrono_mite", 2), x("ambush_stalker", 2), x("tide_cutter", 2),
      ["void_pilgrim"],
      x("null_seal", 3), x("judgment_chain", 2), x("sealbreak", 2),
      x("edict_squire", 2), x("lane_breaker", 2), x("backdraft", 2),
      x("veil_negate", 2), x("final_edict", 2), ["tidal_snare", "ash_whisper"]
    ], "null_seal"),
    extra: ["fusion_abyss_leviathan"]
  },
  pyro_control: {
    id: "pyro_control", name: "Pyro Control", pillar: "Control", ship: "silver",
    desc: "Ignis removal with counters; Hydra and Titan as late game.",
    deck: deck40([
      x("ash_prophet", 3), x("cinder_knight", 3), x("ember_fox", 3),
      x("doomblade_novice", 2), x("flame_djinn", 2), x("pyro_hydra", 2),
      x("rush_swarmling", 3), x("scav_wisp", 2), ["inferno_titan"],
      x("ember_spark", 2), x("burning_lance", 2), x("spark_raider", 2),
      x("null_seal", 2), x("shatter_sigil", 2), x("edict_squire", 2),
      x("lane_breaker", 2), x("fever_pitch", 2), ["flame_banner", "final_edict"]
    ]),
    extra: ["fusion_ember_drake"]
  },
  jest_engine: {
    id: "jest_engine", name: "Jest Engine", pillar: "GY", ship: "silver",
    desc: "Jestling loops and scavengers refill; Call the Fallen for swings.",
    deck: deck40([
      x("scav_wisp", 2), x("frost_mage", 3), x("mawling", 2),
      x("cinder_knight", 2), x("chrono_mite", 2),
      x("void_pilgrim", 2), x("doomblade_novice", 2), x("oracle_eel", 2),
      x("tide_caller", 2), x("grinning_echo", 2), ["tide_priestess"],
      x("call_fallen", 1), x("lane_breaker", 2), x("tidal_snare", 2),
      x("null_seal", 2), x("riptide", 2), x("moonwell", 2),
      x("ash_whisper", 2), ["gy_fusion_rite"]
    ], "call_fallen"),
    extra: ["fusion_choice_blade", "fusion_abyss_leviathan"]
  }
};

/** Extra bosses: losing archetypes get the fat package, winning lists stay thin. */
const abyssBest = ["fusion_grave_tyrant", "fusion_veil_lock", "fusion_abyss_leviathan", "fusion_tide_hydra"];
const abyssMid = ["fusion_abyss_leviathan", "fusion_veil_lock", "fusion_tide_hydra"];
const terraBest = ["fusion_grove_titan", "fusion_terra_crown", "fusion_choice_shield", "fusion_root_colossus"];
const terraMid = ["fusion_grove_knight", "fusion_choice_shield", "fusion_root_colossus"];

const ARCHETYPE_EXTRA = {
  spell_tempo: ["fusion_ember_drake", "fusion_tempo_ace"],
  otk_face: ["fusion_ember_drake", "fusion_tempo_ace"],
  pyro_control: ["fusion_ember_drake", "fusion_cinder_archon"],
  burn: ["fusion_ember_drake", "fusion_ash_seraph"],
  evolve_burn: ["fusion_ember_drake", "fusion_terra_crown"],
  going_second: ["fusion_ember_drake", "fusion_rush_general"],
  aggro_swarm: ["fusion_ember_drake", "fusion_rush_general"],
  ignis_mid: ["fusion_ember_drake", "fusion_cinder_archon"],
  wide_rush: ["fusion_ember_drake"],
  contact_combo: ["fusion_ember_drake"],
  circuit_relay: ["fusion_staple_knight"],
  tri_splash: ["fusion_choice_blade"],
  gy: ["fusion_abyss_leviathan"],
  gy_fusion_combo: ["fusion_ember_drake"],
  discard_payoff: ["fusion_abyss_leviathan"],
  jest_engine: ["fusion_abyss_leviathan"],
  handtrap_midrange: ["fusion_ember_drake"],
  comeback_toolbox: ["fusion_choice_shield"],
  control_counters: abyssBest,
  chain_lock: abyssBest,
  counter_war: abyssMid,
  abyss_tempo: abyssBest,
  tempo_bounce: ["fusion_abyss_leviathan", "fusion_tide_hydra"],
  ambush_trapdoor: ["fusion_abyss_leviathan", "fusion_trapdoor_fiend"],
  drain_walls: ["fusion_abyss_leviathan", "fusion_choice_shield", "fusion_veil_lock"],
  mill: ["fusion_mill_maw", "fusion_deep_hollow"],
  stall_to_fusion: ["fusion_ember_drake", "fusion_choice_shield", "fusion_grove_titan"],
  fusion_ladder: ["fusion_ember_drake"],
  choice_recipe: ["fusion_ember_drake"],
  substitute_toolbox: ["fusion_ember_drake"],
  heal_stall: [...terraBest, "fusion_warden_titan", "fusion_worldroot"],
  ward_walls: [...terraMid, "fusion_warden_titan"],
  big_evolve: [...terraBest, "fusion_worldroot"],
  lifegain_midrange: [...terraMid, "fusion_worldroot"],
  heal_ramp: terraMid,
  token_walls: ["fusion_grove_knight", "fusion_warden_titan"],
  value_midrange: ["fusion_grove_titan", "fusion_worldroot"],
  lane_surfer: ["fusion_tempo_ace", "fusion_rush_general"],
  terra_beat: [...terraBest, "fusion_worldroot"],
  ramp_into_boss: [...terraBest, "fusion_worldroot"],
  hybrid_abyss_tempo: ["fusion_ember_drake", "fusion_abyss_leviathan"],
  hybrid_terra_abyss: ["fusion_abyss_leviathan", "fusion_choice_shield"]
};

for (const d of Object.values(LOANER_DECKS)) {
  if (ARCHETYPE_EXTRA[d.id]) d.extra = ARCHETYPE_EXTRA[d.id];
}

const SHIPPED = new Set(["must", "silver"]);

/** Only ship-complete decks for UI listing. */
export function shippedLoaners() {
  return Object.values(LOANER_DECKS).filter((d) => SHIPPED.has(d.ship));
}

export function loanerById(id) {
  const d = LOANER_DECKS[id];
  return d && SHIPPED.has(d.ship) ? d : null;
}

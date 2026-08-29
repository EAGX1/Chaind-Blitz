// Starter decks (40 cards) and the 20-card roguelike run starter.

/** Wave E/F staple pile — original jobs, 40 main. */
export const META_STAPLE_MAIN = [
  ...Array(3).fill("trail_fox"), ...Array(3).fill("ember_fox"),
  ...Array(2).fill("spark_juggler"), ...Array(2).fill("tithe_owl"),
  "charge_fool", ...Array(2).fill("cinder_tyrant"),
  "ivory_colossus", "flood_verdict", "bastion_reflector",
  "overreach_warden", "ink_magister",
  ...Array(3).fill("hush_petal"), ...Array(2).fill("empty_veto"),
  ...Array(2).fill("void_pitch"), ...Array(2).fill("ash_whisper"),
  ...Array(3).fill("arc_triple"), ...Array(2).fill("recall_gust"),
  "low_blow", "quiet_exile", "moon_fold", "grace_split",
  "gale_sweep", "cyclone_break", "blood_veto", "rank_four_call"
];
export const META_STAPLE_EXTRA = [
  "fusion_pyre_wyrm", "fusion_ember_drake", "fusion_tempo_ace", "fusion_abyss_leviathan"
];

/** 8 staples in every tribe starter — hand traps + Helix / Twin Cut / Equal Cut. */
export const STARTER_STAPLES = [
  ...Array(2).fill("veil_needle"), ...Array(2).fill("helix_shot"),
  ...Array(2).fill("ash_whisper"), "twin_cut", "equal_cut"
];

export const STARTERS = {
  ignis: {
    id: "ignis", name: "Ignis Rush",
    desc: "Burn fast, evolve faster. Ember Spark answers threats; Fever Pitch ends games.",
    deck: [
      ...Array(3).fill("ember_fox"), ...Array(3).fill("cinder_knight"),
      ...Array(3).fill("flame_djinn"), ...Array(2).fill("pyro_hydra"),
      "inferno_titan", ...Array(3).fill("ash_prophet"), ...Array(2).fill("lava_giant"),
      ...Array(3).fill("swift_falcon"), "rush_swarmling",
      "doomblade_novice",
      ...Array(3).fill("ember_spark"), ...Array(2).fill("fever_pitch"),
      "flame_banner", ...Array(3).fill("burning_lance"),
      "spark_raider",
      ...STARTER_STAPLES
    ],
    extra: ["fusion_pyre_wyrm", "fusion_ember_drake", "fusion_tempo_ace"]
  },
  abyss: {
    id: "abyss", name: "Abyss Control",
    desc: "Snares, freezes and counters. Win the long game behind walls of ice.",
    deck: [
      ...Array(3).fill("tide_caller"), ...Array(3).fill("frost_mage"),
      ...Array(2).fill("abyss_warden"), ...Array(2).fill("deep_serpent"),
      ...Array(2).fill("kraken"), ...Array(3).fill("tide_priestess"), ...Array(3).fill("depths_lurker"),
      ...Array(2).fill("scav_wisp"), ...Array(2).fill("oracle_eel"),
      ...Array(3).fill("tidal_snare"), "moonwell",
      ...Array(2).fill("deep_freeze"),
      "riptide", "tide_cutter",
      ...Array(2).fill("null_seal"),
      ...STARTER_STAPLES
    ],
    extra: ["fusion_abyss_leviathan"]
  },
  terra: {
    id: "terra", name: "Terra Midrange",
    desc: "Grow wide, evolve tall. The grove provides, the grove protects.",
    deck: [
      ...Array(3).fill("moss_sprite"), ...Array(3).fill("dawn_pixie"),
      ...Array(2).fill("thorn_archer"), ...Array(2).fill("stoneback"),
      ...Array(2).fill("grove_elder"), "wolf_alpha",
      "world_turtle", ...Array(2).fill("seed_sage"),
      ...Array(3).fill("shield_sprite"), ...Array(2).fill("gem_golem"),
      ...Array(3).fill("root_snare"),
      ...Array(2).fill("stone_skin"), "wild_call",
      ...Array(2).fill("verdant_rebuke"), "scroll_greed",
      ...Array(2).fill("null_seal"),
      ...STARTER_STAPLES
    ],
    extra: ["fusion_grove_titan", "fusion_choice_shield", "fusion_root_colossus"]
  },
  meta: {
    id: "meta", name: "Meta Staples",
    desc: "Last-30-years jobs: hand traps, bolts, bounces, tributes, and a wipe. Silver+ pile.",
    deck: META_STAPLE_MAIN,
    extra: META_STAPLE_EXTRA
  }
};

export const ROGUE_STARTER = [
  ...Array(2).fill("shield_sprite"), ...Array(2).fill("swift_falcon"),
  ...Array(2).fill("gem_golem"), ...Array(2).fill("scav_wisp"),
  ...Array(2).fill("oracle_eel"), "jestling", "doomblade_novice",
  ...Array(2).fill("scroll_greed"), ...Array(2).fill("ember_spark"),
  ...Array(2).fill("root_snare"), "call_fallen", "null_seal"
];

// The curated Cube: a fixed list of high-impact cards for Cube Draft.
// Bombs, chain interaction, and synergy engines from the Bronze set.

import { BRONZE_DB } from "./cards/bronze.js";

export const CUBE_IDS = [
  // bombs
  "inferno_titan", "kraken", "world_turtle", "pyro_hydra", "deep_serpent",
  // chain interaction
  "null_seal", "backdraft", "judgment_chain", "final_edict", "sealbreak",
  "silencing_depths", "verdant_rebuke",
  // spell engines
  "scroll_greed", "fever_pitch", "call_fallen", "mind_surge", "moonwell",
  "overgrowth", "riptide", "shatter_sigil",
  // removal
  "starfall", "lightning_tempest", "burning_lance", "tidal_snare", "ember_spark",
  // monster engines
  "jestling", "surge_imp", "grinning_echo", "oracle_eel", "ash_prophet",
  "seed_sage", "tide_caller", "dawn_pixie", "grove_elder", "wolf_alpha",
  "nimbus_knight", "void_pilgrim"
];

export const CUBE = CUBE_IDS.map((id) => BRONZE_DB[id]);

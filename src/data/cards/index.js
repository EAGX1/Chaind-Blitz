import { BRONZE_CARDS, BRONZE_DB } from "./bronze.js";
import { WAVE_C_CARDS, WAVE_C_DB } from "./waveC.js";
import { WAVE_D_CARDS, WAVE_D_DB } from "./waveD.js";
import { WAVE_E_CARDS, WAVE_E_DB } from "./waveE.js";
import { WAVE_F_CARDS, WAVE_F_DB } from "./waveF.js";
import { WAVE_G_CARDS, WAVE_G_DB } from "./waveG.js";
import { WAVE_H_CARDS, WAVE_H_DB } from "./waveH.js";
import { SILVER_CARDS, SILVER_DB } from "./silver.js";
import { GOLD_CARDS, GOLD_DB } from "./gold.js";
import { PLATINUM_CARDS, PLATINUM_DB } from "./platinum.js";
import { EXTRA_CARDS, EXTRA_DB } from "./extra.js";
import { TOKEN_DB } from "./tokens.js";

export const ALL_CARDS = [
  ...BRONZE_CARDS, ...WAVE_C_CARDS, ...WAVE_D_CARDS, ...WAVE_E_CARDS, ...WAVE_F_CARDS,
  ...WAVE_G_CARDS, ...WAVE_H_CARDS, ...SILVER_CARDS,
  ...GOLD_CARDS, ...PLATINUM_CARDS, ...EXTRA_CARDS
];
export const CARD_DB = {
  ...BRONZE_DB, ...WAVE_C_DB, ...WAVE_D_DB, ...WAVE_E_DB, ...WAVE_F_DB,
  ...WAVE_G_DB, ...WAVE_H_DB, ...SILVER_DB,
  ...GOLD_DB, ...PLATINUM_DB, ...EXTRA_DB, ...TOKEN_DB
};

export {
  BRONZE_CARDS, BRONZE_DB, WAVE_C_CARDS, WAVE_C_DB, WAVE_D_CARDS, WAVE_D_DB,
  WAVE_E_CARDS, WAVE_E_DB, WAVE_F_CARDS, WAVE_F_DB, WAVE_G_CARDS, WAVE_G_DB,
  WAVE_H_CARDS, WAVE_H_DB,
  SILVER_CARDS, SILVER_DB, GOLD_CARDS, GOLD_DB, PLATINUM_CARDS, PLATINUM_DB,
  EXTRA_CARDS, EXTRA_DB
};

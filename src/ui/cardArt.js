// Procedural card faces: N/R generative SVG; SR rich procedural; UR unique portraits.

import { enableCardTilt } from "./tiltFoil.js";
import { monsterLevel } from "../engine/state.js";
import { fxStripHtml, linkifyCardText } from "../data/effectTags.js";
import { comboTagsFor, CIRCUITS, circuitClass } from "../data/comboTags.js";

const PALETTES = {
  Ignis: ["#ffb37c", "#ff7a3c", "#7a1f00", "#2b0d00"],
  Abyss: ["#a8d8ff", "#4aa8ff", "#0a3a6e", "#04142b"],
  Terra: ["#b8f5cf", "#58d68d", "#14532d", "#071f10"],
  Neutral: ["#dcc8ff", "#b08cff", "#3b2370", "#150a2b"]
};
const SPELL_PALETTE = ["#ffe9a8", "#f5c542", "#7a5b00", "#241a02"];

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function curatedPortrait(def) {
  const pal = def.type === "spell" ? SPELL_PALETTE : PALETTES[def.tribe] || PALETTES.Neutral;
  const [hi, mid, low, bg] = pal;
  const frame = `<rect x="4" y="4" width="92" height="92" fill="none" stroke="${hi}" stroke-width="2.2" opacity=".85"/>
    <rect x="8" y="8" width="84" height="84" fill="none" stroke="${mid}" stroke-width="0.8" opacity=".5"/>`;
  const portraits = {
    inferno_titan: `<rect width="100" height="100" fill="${bg}"/><path d="M18 88 L50 12 L82 88 Z" fill="${low}"/><path d="M32 88 L50 28 L68 88 Z" fill="${mid}"/><circle cx="50" cy="42" r="8" fill="${hi}"/>`,
    kraken: `<rect width="100" height="100" fill="${bg}"/><ellipse cx="50" cy="42" rx="28" ry="18" fill="${low}"/><path d="M22 48 Q18 88 32 70 Q40 90 50 62 Q60 90 68 70 Q82 88 78 48" fill="none" stroke="${hi}" stroke-width="4"/><circle cx="40" cy="40" r="4" fill="${hi}"/><circle cx="60" cy="40" r="4" fill="${hi}"/>`,
    world_turtle: `<rect width="100" height="100" fill="${bg}"/><ellipse cx="50" cy="58" rx="34" ry="22" fill="${low}"/><ellipse cx="50" cy="52" rx="22" ry="16" fill="${mid}"/><circle cx="50" cy="30" r="10" fill="${hi}"/><path d="M28 58 L50 40 L72 58" fill="none" stroke="${hi}" stroke-width="3"/>`,
    final_edict: `<rect width="100" height="100" fill="${bg}"/><path d="M50 10 L82 26 V52 C82 74 66 86 50 94 C34 86 18 74 18 52 V26 Z" fill="${low}"/><path d="M50 18 L74 30 V52 C74 70 62 80 50 86 C38 80 26 70 26 52 V30 Z" fill="none" stroke="${hi}" stroke-width="3"/>`,
    evolve_colossus: `<rect width="100" height="100" fill="${bg}"/><rect x="28" y="38" width="44" height="50" fill="${low}"/><rect x="36" y="18" width="28" height="24" fill="${mid}"/><path d="M22 88 L50 48 L78 88" fill="${hi}" opacity=".8"/>`,
    veil_negate: `<rect width="100" height="100" fill="${bg}"/><path d="M50 12 L78 24 V50 C78 68 66 80 50 88 C34 80 22 68 22 50 V24 Z" fill="${low}"/><path d="M32 50 L50 32 L68 50 L50 68 Z" fill="${hi}"/>`,
    fusion_abyss_leviathan: `<rect width="100" height="100" fill="${bg}"/><path d="M8 62 Q40 20 92 48 Q60 40 48 70 Q30 88 8 62" fill="${mid}"/><circle cx="72" cy="44" r="6" fill="${hi}"/>`,
    fusion_terra_crown: `<rect width="100" height="100" fill="${bg}"/><path d="M20 70 L32 28 L50 58 L68 28 L80 70 Z" fill="${low}"/><path d="M28 70 L50 18 L72 70" fill="${hi}" opacity=".85"/>`,
    silver_otk_blade: `<rect width="100" height="100" fill="${bg}"/><path d="M46 12 L54 12 L58 78 L42 78 Z" fill="${mid}"/><path d="M30 78 H70 L50 94 Z" fill="${low}"/><circle cx="50" cy="20" r="8" fill="${hi}"/>`,
    silver_tri_splash: `<rect width="100" height="100" fill="${bg}"/><circle cx="32" cy="48" r="14" fill="${low}"/><circle cx="68" cy="48" r="14" fill="${mid}"/><circle cx="50" cy="32" r="12" fill="${hi}"/>`,
    plat_world_root: `<rect width="100" height="100" fill="${bg}"/><path d="M50 12 V88" stroke="${hi}" stroke-width="5"/><path d="M50 40 Q18 70 22 88" fill="none" stroke="${mid}" stroke-width="4"/><path d="M50 40 Q82 70 78 88" fill="none" stroke="${mid}" stroke-width="4"/><circle cx="50" cy="22" r="10" fill="${low}"/>`,
    plat_null_wave: `<rect width="100" height="100" fill="${bg}"/><path d="M12 70 Q35 30 50 70 T88 70" fill="none" stroke="${hi}" stroke-width="6"/><path d="M18 50 Q40 18 50 50 T82 50" fill="none" stroke="${mid}" stroke-width="4"/>`,
    fusion_pyre_wyrm: `<rect width="100" height="100" fill="${bg}"/><path d="M12 70 Q40 10 88 38 Q70 28 62 70 Q40 92 12 70" fill="${mid}"/><path d="M70 32 L92 18 L80 44" fill="${hi}"/>`,
    fusion_grave_tyrant: `<rect width="100" height="100" fill="${bg}"/><rect x="30" y="28" width="40" height="52" fill="${low}"/><path d="M22 80 H78 L50 96 Z" fill="${mid}"/><circle cx="42" cy="48" r="5" fill="${hi}"/><circle cx="58" cy="48" r="5" fill="${hi}"/>`,
    fusion_grove_titan: `<rect width="100" height="100" fill="${bg}"/><rect x="38" y="40" width="24" height="48" fill="${low}"/><circle cx="50" cy="28" r="16" fill="${mid}"/><path d="M20 36 H80" stroke="${hi}" stroke-width="5"/>`,
    hush_petal: `<rect width="100" height="100" fill="${bg}"/><ellipse cx="50" cy="58" rx="22" ry="28" fill="${low}"/><path d="M50 18 C38 38 28 48 32 70 C40 58 50 52 50 52 C50 52 60 58 68 70 C72 48 62 38 50 18" fill="${hi}"/><circle cx="50" cy="44" r="5" fill="${mid}"/>`,
    empty_veto: `<rect width="100" height="100" fill="${bg}"/><rect x="18" y="22" width="64" height="56" rx="4" fill="${low}"/><path d="M28 30 H72 V70 H28 Z" fill="none" stroke="${hi}" stroke-width="3"/><path d="M34 50 L46 62 L70 34" fill="none" stroke="${mid}" stroke-width="5"/>`,
    ivory_colossus: `<rect width="100" height="100" fill="${bg}"/><rect x="30" y="22" width="40" height="58" fill="${low}"/><rect x="38" y="10" width="24" height="18" fill="${mid}"/><path d="M18 88 H82 L50 52 Z" fill="${hi}" opacity=".85"/>`,
    void_pitch: `<rect width="100" height="100" fill="${bg}"/><circle cx="50" cy="50" r="28" fill="${low}"/><path d="M50 18 V82" stroke="${hi}" stroke-width="6"/><path d="M22 50 H78" stroke="${mid}" stroke-width="4"/><circle cx="50" cy="50" r="8" fill="${bg}"/>`,
    flood_verdict: `<rect width="100" height="100" fill="${bg}"/><path d="M8 78 Q30 20 50 78 T92 78" fill="${low}"/><path d="M12 62 Q35 28 50 62 T88 62" fill="none" stroke="${hi}" stroke-width="4"/><rect x="44" y="18" width="12" height="28" fill="${mid}"/>`,
    charge_fool: `<rect width="100" height="100" fill="${bg}"/><path d="M22 78 L50 12 L78 78 Z" fill="${low}"/><path d="M36 78 L50 36 L64 78" fill="${mid}"/><circle cx="50" cy="28" r="7" fill="${hi}"/>`,
    arc_triple: `<rect width="100" height="100" fill="${bg}"/><path d="M50 8 L58 42 L88 42 L64 62 L74 92 L50 74 L26 92 L36 62 L12 42 L42 42 Z" fill="${mid}"/><circle cx="50" cy="50" r="8" fill="${hi}"/>`,
    cyclone_break: `<rect width="100" height="100" fill="${bg}"/><path d="M50 12 C78 22 86 50 70 70 C90 58 88 28 50 12" fill="${low}"/><path d="M50 88 C22 78 14 50 30 30 C10 42 12 72 50 88" fill="${mid}"/><circle cx="50" cy="50" r="10" fill="${hi}"/>`,
    heart_claim: `<rect width="100" height="100" fill="${bg}"/><path d="M50 86 C20 62 18 38 32 28 C42 20 50 30 50 30 C50 30 58 20 68 28 C82 38 80 62 50 86 Z" fill="${low}"/><path d="M50 78 C28 58 28 40 38 34 C46 28 50 38 50 38 C50 38 54 28 62 34 C72 40 72 58 50 78 Z" fill="${hi}"/>`,
    pyro_hydra: `<rect width="100" height="100" fill="${bg}"/><circle cx="32" cy="42" r="12" fill="${low}"/><circle cx="68" cy="42" r="12" fill="${low}"/><circle cx="50" cy="28" r="11" fill="${mid}"/><path d="M22 78 Q50 48 78 78" fill="${hi}" opacity=".8"/>`,
    deep_serpent: `<rect width="100" height="100" fill="${bg}"/><path d="M12 70 Q28 20 50 48 Q72 76 88 28" fill="none" stroke="${mid}" stroke-width="8"/><circle cx="84" cy="26" r="8" fill="${hi}"/>`,
    silver_discard_wraith: `<rect width="100" height="100" fill="${bg}"/><ellipse cx="50" cy="48" rx="22" ry="30" fill="${low}"/><path d="M28 78 Q50 58 72 78" fill="${mid}"/><circle cx="42" cy="42" r="4" fill="${hi}"/><circle cx="58" cy="42" r="4" fill="${hi}"/>`,
    silver_stall_shell: `<rect width="100" height="100" fill="${bg}"/><ellipse cx="50" cy="58" rx="32" ry="24" fill="${low}"/><ellipse cx="50" cy="52" rx="18" ry="14" fill="${mid}"/><path d="M32 48 L50 22 L68 48" fill="${hi}"/>`,
    gold_grove_warden: `<rect width="100" height="100" fill="${bg}"/><rect x="40" y="40" width="20" height="48" fill="${low}"/><circle cx="50" cy="28" r="18" fill="${mid}"/><path d="M18 40 H82" stroke="${hi}" stroke-width="6"/>`,
    plat_inferno_ace: `<rect width="100" height="100" fill="${bg}"/><path d="M50 10 L62 46 L98 46 L70 68 L82 98 L50 78 L18 98 L30 68 L2 46 L38 46 Z" fill="${low}"/><circle cx="50" cy="52" r="10" fill="${hi}"/>`,
    tactic_choice: `<rect width="100" height="100" fill="${bg}"/><path d="M22 28 H78 V44 H22 Z" fill="${low}"/><path d="M22 56 H78 V72 H22 Z" fill="${mid}"/><circle cx="34" cy="36" r="5" fill="${hi}"/><circle cx="66" cy="64" r="5" fill="${hi}"/>`,
    empty_sky: `<rect width="100" height="100" fill="${bg}"/><circle cx="50" cy="38" r="16" fill="${hi}"/><path d="M8 78 Q50 48 92 78" fill="${low}"/><path d="M18 88 H82" stroke="${mid}" stroke-width="4"/>`,
    scream_home: `<rect width="100" height="100" fill="${bg}"/><path d="M20 70 Q50 10 80 70" fill="${low}"/><path d="M32 70 Q50 28 68 70" fill="${mid}"/><circle cx="50" cy="78" r="10" fill="${hi}"/>`,
    research_burn: `<rect width="100" height="100" fill="${bg}"/><rect x="28" y="18" width="44" height="58" fill="${low}"/><path d="M34 30 H66 M34 42 H66 M34 54 H58" stroke="${hi}" stroke-width="4"/><path d="M22 82 H78 L50 96 Z" fill="${mid}"/>`,
    alloy_core: `<rect width="100" height="100" fill="${bg}"/><circle cx="50" cy="50" r="28" fill="${low}"/><circle cx="50" cy="50" r="16" fill="${mid}"/><circle cx="50" cy="50" r="6" fill="${hi}"/><path d="M50 12 V28 M50 72 V88 M12 50 H28 M72 50 H88" stroke="${hi}" stroke-width="5"/>`,
    fusion_staple_knight: `<rect width="100" height="100" fill="${bg}"/><path d="M32 78 L50 18 L68 78 Z" fill="${low}"/><rect x="42" y="40" width="16" height="40" fill="${mid}"/><circle cx="50" cy="28" r="8" fill="${hi}"/>`,
    fusion_staple_aegis: `<rect width="100" height="100" fill="${bg}"/><path d="M50 12 L82 28 V54 C82 74 66 86 50 94 C34 86 18 74 18 54 V28 Z" fill="${low}"/><path d="M50 22 L72 32 V54 C72 70 62 80 50 86 C38 80 28 70 28 54 V32 Z" fill="${mid}"/>`,
    fusion_veil_lock: `<rect width="100" height="100" fill="${bg}"/><circle cx="50" cy="50" r="30" fill="none" stroke="${low}" stroke-width="8"/><path d="M50 26 V74 M26 50 H74" stroke="${mid}" stroke-width="5"/><circle cx="50" cy="50" r="9" fill="${hi}"/>`,
    fusion_grove_knight: `<rect width="100" height="100" fill="${bg}"/><path d="M50 14 L68 30 V62 L50 86 L32 62 V30 Z" fill="${low}"/><path d="M50 26 V66" stroke="${hi}" stroke-width="5"/><path d="M38 44 H62" stroke="${mid}" stroke-width="4"/>`,
    fusion_tempo_ace: `<rect width="100" height="100" fill="${bg}"/><path d="M20 74 L44 22 L56 22 L38 74 Z" fill="${mid}"/><path d="M52 74 L76 22 L88 22 L70 74 Z" fill="${low}"/><circle cx="30" cy="30" r="7" fill="${hi}"/>`,
    fusion_mill_maw: `<rect width="100" height="100" fill="${bg}"/><ellipse cx="50" cy="56" rx="30" ry="24" fill="${low}"/><path d="M26 50 Q50 78 74 50" fill="${bg}"/><path d="M30 44 L36 56 M44 40 L48 54 M60 40 L56 54 M70 44 L64 56" stroke="${hi}" stroke-width="3"/>`,
    fusion_ash_seraph: `<rect width="100" height="100" fill="${bg}"/><path d="M50 88 C30 60 22 40 34 22 C40 34 46 40 50 40 C54 40 60 34 66 22 C78 40 70 60 50 88 Z" fill="${mid}"/><circle cx="50" cy="52" r="9" fill="${hi}"/>`,
    fusion_tide_hydra: `<rect width="100" height="100" fill="${bg}"/><path d="M20 80 Q26 40 40 58 Q46 24 56 50 Q68 22 74 56 Q86 44 82 80" fill="none" stroke="${mid}" stroke-width="6"/><circle cx="40" cy="52" r="4" fill="${hi}"/><circle cx="72" cy="50" r="4" fill="${hi}"/>`,
    fusion_root_colossus: `<rect width="100" height="100" fill="${bg}"/><rect x="34" y="30" width="32" height="52" fill="${low}"/><path d="M50 82 V50 M50 62 Q30 70 24 88 M50 62 Q70 70 76 88" stroke="${mid}" stroke-width="5" fill="none"/><circle cx="50" cy="22" r="10" fill="${hi}"/>`,
    fusion_choice_blade: `<rect width="100" height="100" fill="${bg}"/><path d="M30 82 L58 18 L66 22 L42 82 Z" fill="${mid}"/><path d="M24 82 H76" stroke="${hi}" stroke-width="5"/><circle cx="60" cy="30" r="6" fill="${low}"/>`,
    fusion_choice_shield: `<rect width="100" height="100" fill="${bg}"/><path d="M50 16 L78 30 V56 C78 74 64 84 50 90 C36 84 22 74 22 56 V30 Z" fill="${low}"/><path d="M50 28 V78" stroke="${hi}" stroke-width="5"/>`,
    fusion_deep_hollow: `<rect width="100" height="100" fill="${bg}"/><circle cx="50" cy="46" r="26" fill="${low}"/><circle cx="50" cy="46" r="14" fill="${bg}"/><path d="M20 84 Q50 64 80 84" stroke="${mid}" stroke-width="5" fill="none"/><circle cx="50" cy="46" r="5" fill="${hi}"/>`,
    fusion_trapdoor_fiend: `<rect width="100" height="100" fill="${bg}"/><rect x="24" y="52" width="52" height="30" fill="${low}"/><path d="M24 52 L50 22 L76 52" fill="${mid}"/><circle cx="42" cy="40" r="5" fill="${hi}"/><circle cx="58" cy="40" r="5" fill="${hi}"/>`,
    fusion_grave_jester: `<rect width="100" height="100" fill="${bg}"/><circle cx="50" cy="40" r="20" fill="${low}"/><path d="M30 34 L22 18 L38 28 M70 34 L78 18 L62 28" fill="${mid}"/><path d="M38 46 Q50 56 62 46" stroke="${hi}" stroke-width="4" fill="none"/>`,
    fusion_worldroot: `<rect width="100" height="100" fill="${bg}"/><circle cx="50" cy="34" r="22" fill="${mid}"/><path d="M50 56 V88 M50 70 Q32 76 26 90 M50 70 Q68 76 74 90" stroke="${low}" stroke-width="6" fill="none"/><circle cx="50" cy="30" r="8" fill="${hi}"/>`,
    fusion_cinder_archon: `<rect width="100" height="100" fill="${bg}"/><path d="M50 12 L66 44 L50 88 L34 44 Z" fill="${low}"/><path d="M50 24 L58 46 L50 72 L42 46 Z" fill="${mid}"/><circle cx="50" cy="44" r="6" fill="${hi}"/>`,
    fusion_warden_titan: `<rect width="100" height="100" fill="${bg}"/><rect x="26" y="30" width="48" height="56" fill="${low}"/><path d="M26 44 H74 M26 58 H74" stroke="${mid}" stroke-width="4"/><path d="M50 10 L62 30 H38 Z" fill="${hi}"/>`,
    fusion_rush_general: `<rect width="100" height="100" fill="${bg}"/><path d="M18 70 L50 26 L82 70 Z" fill="${low}"/><path d="M28 70 L50 40 L72 70" fill="${mid}"/><path d="M12 82 H88" stroke="${hi}" stroke-width="5"/>`,
    fusion_storm_caller: `<rect width="100" height="100" fill="${bg}"/><path d="M56 12 L30 54 H48 L42 88 L72 42 H54 Z" fill="${mid}"/><circle cx="50" cy="50" r="30" fill="none" stroke="${low}" stroke-width="4"/>`,
    // Wave H — the neutral combo core: every glyph is a link in a circuit
    relay_sprite: `<rect width="100" height="100" fill="${bg}"/><circle cx="30" cy="50" r="11" fill="${low}"/><circle cx="70" cy="50" r="11" fill="${low}"/><path d="M41 50 H59" stroke="${hi}" stroke-width="6"/><circle cx="50" cy="26" r="7" fill="${mid}"/>`,
    sigil_courier: `<rect width="100" height="100" fill="${bg}"/><path d="M22 62 L50 20 L78 62 Z" fill="${low}"/><path d="M50 62 V86" stroke="${mid}" stroke-width="6"/><circle cx="50" cy="44" r="7" fill="${hi}"/>`,
    chain_acolyte: `<rect width="100" height="100" fill="${bg}"/><circle cx="50" cy="36" r="16" fill="none" stroke="${low}" stroke-width="7"/><circle cx="50" cy="66" r="16" fill="none" stroke="${mid}" stroke-width="7"/><circle cx="50" cy="51" r="5" fill="${hi}"/>`,
    echo_adept: `<rect width="100" height="100" fill="${bg}"/><circle cx="50" cy="50" r="10" fill="${hi}"/><circle cx="50" cy="50" r="20" fill="none" stroke="${mid}" stroke-width="4" opacity=".8"/><circle cx="50" cy="50" r="31" fill="none" stroke="${low}" stroke-width="3" opacity=".6"/>`,
    muster_drum: `<rect width="100" height="100" fill="${bg}"/><ellipse cx="50" cy="40" rx="26" ry="10" fill="${mid}"/><rect x="24" y="40" width="52" height="30" fill="${low}"/><ellipse cx="50" cy="70" rx="26" ry="10" fill="${mid}"/><path d="M28 34 L72 76 M72 34 L28 76" stroke="${hi}" stroke-width="3"/>`,
    ledger_imp: `<rect width="100" height="100" fill="${bg}"/><rect x="28" y="22" width="44" height="56" fill="${low}"/><path d="M36 36 H64 M36 48 H64 M36 60 H56" stroke="${hi}" stroke-width="4"/><circle cx="70" cy="72" r="9" fill="${mid}"/>`,
    overdraft_sage: `<rect width="100" height="100" fill="${bg}"/><path d="M26 74 L26 26 L50 38 L74 26 L74 74" fill="none" stroke="${low}" stroke-width="7"/><circle cx="50" cy="60" r="9" fill="${hi}"/>`,
    salvage_wisp: `<rect width="100" height="100" fill="${bg}"/><path d="M50 84 C30 62 26 44 38 30 C44 40 50 44 50 44 C50 44 56 40 62 30 C74 44 70 62 50 84 Z" fill="${mid}"/><circle cx="50" cy="56" r="7" fill="${hi}"/>`,
    pitch_adept: `<rect width="100" height="100" fill="${bg}"/><path d="M24 28 L48 52 L24 76" fill="none" stroke="${low}" stroke-width="8"/><path d="M54 28 H80 M54 50 H80 M54 72 H70" stroke="${mid}" stroke-width="6"/>`,
    grave_ledger: `<rect width="100" height="100" fill="${bg}"/><rect x="26" y="30" width="48" height="46" fill="${low}"/><path d="M26 44 H74 M26 58 H74" stroke="${mid}" stroke-width="3"/><path d="M38 30 V16 H62 V30" fill="none" stroke="${hi}" stroke-width="5"/>`,
    carrion_bell: `<rect width="100" height="100" fill="${bg}"/><path d="M32 66 C32 42 40 28 50 28 C60 28 68 42 68 66 Z" fill="${low}"/><path d="M26 66 H74" stroke="${mid}" stroke-width="5"/><circle cx="50" cy="76" r="7" fill="${hi}"/>`,
    exile_warden: `<rect width="100" height="100" fill="${bg}"/><circle cx="50" cy="50" r="28" fill="none" stroke="${low}" stroke-width="7"/><path d="M32 32 L68 68" stroke="${hi}" stroke-width="7"/><circle cx="50" cy="50" r="8" fill="${mid}"/>`,
    rift_keeper: `<rect width="100" height="100" fill="${bg}"/><path d="M50 12 C60 34 60 66 50 88 C40 66 40 34 50 12 Z" fill="${low}"/><path d="M50 24 C56 38 56 62 50 76 C44 62 44 38 50 24 Z" fill="${bg}"/><circle cx="50" cy="50" r="5" fill="${hi}"/>`,
    loop_warden: `<rect width="100" height="100" fill="${bg}"/><circle cx="50" cy="50" r="26" fill="none" stroke="${low}" stroke-width="8"/><path d="M50 24 L60 36 H40 Z" fill="${hi}"/><circle cx="50" cy="50" r="10" fill="${mid}"/>`,
    spark_offering: `<rect width="100" height="100" fill="${bg}"/><path d="M30 22 L30 60 L18 60 L44 88 L44 50 L56 50 Z" fill="${mid}"/><path d="M60 22 H84 V56 H60 Z" fill="${low}"/>`,
    exile_pact: `<rect width="100" height="100" fill="${bg}"/><circle cx="38" cy="50" r="18" fill="none" stroke="${low}" stroke-width="6"/><circle cx="66" cy="50" r="18" fill="none" stroke="${mid}" stroke-width="6"/><path d="M50 34 V66" stroke="${hi}" stroke-width="5"/>`,
    rally_horn: `<rect width="100" height="100" fill="${bg}"/><path d="M18 58 L58 34 V74 Z" fill="${low}"/><path d="M60 40 Q86 54 60 68" fill="none" stroke="${hi}" stroke-width="6"/>`,
    culling_rite: `<rect width="100" height="100" fill="${bg}"/><path d="M50 14 V64" stroke="${mid}" stroke-width="7"/><path d="M30 64 H70 L50 90 Z" fill="${low}"/><circle cx="50" cy="28" r="8" fill="${hi}"/>`,
    hand_relay: `<rect width="100" height="100" fill="${bg}"/><rect x="16" y="34" width="30" height="42" fill="${low}"/><rect x="54" y="24" width="30" height="42" fill="${mid}"/><path d="M46 56 H54" stroke="${hi}" stroke-width="6"/>`,
    grave_tithe: `<rect width="100" height="100" fill="${bg}"/><path d="M24 80 H76 L50 94 Z" fill="${mid}"/><rect x="32" y="26" width="36" height="52" fill="${low}"/><path d="M40 40 H60 M40 54 H60" stroke="${hi}" stroke-width="4"/>`,
    double_sigil: `<rect width="100" height="100" fill="${bg}"/><rect x="18" y="26" width="32" height="48" fill="${low}"/><rect x="50" y="26" width="32" height="48" fill="${mid}"/><circle cx="34" cy="50" r="6" fill="${hi}"/><circle cx="66" cy="50" r="6" fill="${hi}"/>`,
    relay_chain: `<rect width="100" height="100" fill="${bg}"/><circle cx="28" cy="50" r="12" fill="none" stroke="${low}" stroke-width="6"/><circle cx="50" cy="50" r="12" fill="none" stroke="${mid}" stroke-width="6"/><circle cx="72" cy="50" r="12" fill="none" stroke="${hi}" stroke-width="6"/>`,
    void_ledger: `<rect width="100" height="100" fill="${bg}"/><rect x="26" y="24" width="48" height="54" fill="${low}"/><circle cx="50" cy="52" r="15" fill="${bg}"/><circle cx="50" cy="52" r="15" fill="none" stroke="${hi}" stroke-width="4"/>`,
    summon_toll: `<rect width="100" height="100" fill="${bg}"/><path d="M22 74 L38 40 L54 74 Z" fill="${low}"/><path d="M50 74 L66 30 L82 74 Z" fill="${mid}"/><path d="M14 82 H88" stroke="${hi}" stroke-width="5"/>`,
    token_recruit: `<rect width="100" height="100" fill="${bg}"/><circle cx="50" cy="36" r="13" fill="${mid}"/><path d="M30 82 C30 62 70 62 70 82 Z" fill="${low}"/>`,
    null_seal: `<rect width="100" height="100" fill="${bg}"/><path d="M50 12 L78 24 V52 C78 74 64 86 50 94 C36 86 22 74 22 52 V24 Z" fill="${low}"/><path d="M34 50 L46 62 L70 34" fill="none" stroke="${hi}" stroke-width="6"/>`,
    ash_whisper: `<rect width="100" height="100" fill="${bg}"/><path d="M28 78 Q50 18 72 78" fill="${low}"/><path d="M38 70 Q50 32 62 70" fill="${mid}"/><circle cx="50" cy="42" r="7" fill="${hi}"/>`,
    starfall: `<rect width="100" height="100" fill="${bg}"/><path d="M50 8 L58 38 L88 38 L64 56 L74 88 L50 70 L26 88 L36 56 L12 38 L42 38 Z" fill="${mid}"/><circle cx="50" cy="48" r="8" fill="${hi}"/>`,
    surge_imp: `<rect width="100" height="100" fill="${bg}"/><path d="M54 10 L28 52 H46 L38 90 L74 44 H56 Z" fill="${mid}"/><circle cx="58" cy="28" r="7" fill="${hi}"/>`,
    veil_needle: `<rect width="100" height="100" fill="${bg}"/><path d="M46 12 L54 12 L58 72 L42 72 Z" fill="${mid}"/><path d="M28 72 H72 L50 92 Z" fill="${low}"/><circle cx="50" cy="22" r="8" fill="${hi}"/>`,
    fusion_ember_drake: `<rect width="100" height="100" fill="${bg}"/><path d="M10 72 Q38 16 88 40 Q68 32 58 72 Q36 92 10 72" fill="${mid}"/><path d="M72 30 L94 14 L82 44" fill="${hi}"/>`,
    backdraft: `<rect width="100" height="100" fill="${bg}"/><path d="M22 78 L50 16 L78 78 Z" fill="${low}"/><path d="M50 78 V42" stroke="${hi}" stroke-width="6"/><circle cx="50" cy="32" r="8" fill="${mid}"/>`,
    grove_elder: `<rect width="100" height="100" fill="${bg}"/><rect x="40" y="42" width="20" height="46" fill="${low}"/><circle cx="50" cy="30" r="18" fill="${mid}"/><path d="M16 42 H84" stroke="${hi}" stroke-width="6"/>`,
    tidal_snare: `<rect width="100" height="100" fill="${bg}"/><path d="M12 70 Q35 28 50 70 T88 70" fill="none" stroke="${hi}" stroke-width="6"/><path d="M18 52 Q40 20 50 52 T82 52" fill="none" stroke="${mid}" stroke-width="4"/><circle cx="50" cy="78" r="8" fill="${low}"/>`,
    ward_sentinel: `<rect width="100" height="100" fill="${bg}"/><path d="M50 10 L82 26 V54 C82 76 66 88 50 96 C34 88 18 76 18 54 V26 Z" fill="${low}"/><rect x="38" y="36" width="24" height="36" fill="${mid}"/><circle cx="50" cy="48" r="6" fill="${hi}"/>`,
    grinning_echo: `<rect width="100" height="100" fill="${bg}"/><circle cx="50" cy="42" r="22" fill="${low}"/><path d="M34 48 Q50 64 66 48" fill="none" stroke="${hi}" stroke-width="5"/><circle cx="42" cy="38" r="4" fill="${hi}"/><circle cx="58" cy="38" r="4" fill="${hi}"/>`
  };
  const body = portraits[def.id];
  if (!body) return null;
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">${body}${frame}</svg>`;
}

export function hasCuratedPortrait(id) {
  return !!curatedPortrait({ id, type: "monster", tribe: "Neutral" });
}

function artSvg(def) {
  const curated = curatedPortrait(def);
  if (curated) return curated;
  const h = hash(def.id);
  const pal = def.type === "spell" ? SPELL_PALETTE : PALETTES[def.tribe] || PALETTES.Neutral;
  const [hi, mid, low, bg] = pal;
  const variant = h % 4;
  const shapes = [];
  const rnd = (n) => { const x = Math.sin(h + n * 127.1) * 43758.5453; return x - Math.floor(x); };
  if (variant === 0) { // shards
    for (let i = 0; i < 5; i++) {
      const x = 10 + rnd(i) * 80, y = 20 + rnd(i + 9) * 60, s = 8 + rnd(i + 4) * 22;
      shapes.push(`<polygon points="${x},${y} ${x + s},${y + s * 1.4} ${x - s * .6},${y + s * 1.7}" fill="${i % 2 ? mid : low}" opacity="${.5 + rnd(i + 2) * .5}"/>`);
    }
  } else if (variant === 1) { // orbs
    for (let i = 0; i < 4; i++) {
      shapes.push(`<circle cx="${15 + rnd(i) * 70}" cy="${25 + rnd(i + 7) * 55}" r="${6 + rnd(i + 3) * 16}" fill="${i % 2 ? mid : low}" opacity="${.4 + rnd(i + 5) * .5}"/>`);
    }
  } else if (variant === 2) { // waves
    for (let i = 0; i < 4; i++) {
      const y = 20 + i * 18;
      shapes.push(`<path d="M0 ${y} Q 25 ${y - 10 - rnd(i) * 8} 50 ${y} T 100 ${y} V100 H0 Z" fill="${i % 2 ? low : bg}" opacity="${.35 + i * .15}"/>`);
    }
  } else { // rays
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + rnd(i);
      shapes.push(`<line x1="50" y1="50" x2="${50 + Math.cos(a) * 60}" y2="${50 + Math.sin(a) * 60}" stroke="${i % 2 ? mid : low}" stroke-width="${2 + rnd(i + 1) * 4}" opacity="${.35 + rnd(i + 6) * .4}"/>`);
    }
  }
  const glyph = def.type === "spell"
    ? spellGlyph(def.spell.subtype, hi)
    : monsterGlyph(h % 3, hi);
  if (def.rarity === "SR") {
    for (let i = 0; i < 3; i++) {
      shapes.push(`<circle cx="${20 + rnd(i + 20) * 60}" cy="${18 + rnd(i + 21) * 20}" r="${2 + rnd(i + 22) * 3}" fill="${hi}" opacity=".7"/>`);
    }
  }
  const srFrame = def.rarity === "SR"
    ? `<rect x="5" y="5" width="90" height="90" fill="none" stroke="${hi}" stroke-width="1.6" opacity=".7"/>`
    : "";
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
    <defs><radialGradient id="g${def.id}" cx="35%" cy="30%" r="90%">
      <stop offset="0%" stop-color="${low}"/><stop offset="100%" stop-color="${bg}"/>
    </radialGradient></defs>
    <rect width="100" height="100" fill="url(#g${def.id})"/>
    ${shapes.join("")}
    ${glyph}
    ${srFrame}
  </svg>`;
}

function monsterGlyph(v, color) {
  if (v === 0) return `<path d="M50 18 L58 42 L82 50 L58 58 L50 82 L42 58 L18 50 L42 42 Z" fill="${color}" opacity=".9"/>`;
  if (v === 1) return `<path d="M30 75 L50 20 L70 75 L57 75 L50 52 L43 75 Z" fill="${color}" opacity=".9"/>`;
  return `<circle cx="50" cy="48" r="18" fill="none" stroke="${color}" stroke-width="6" opacity=".9"/><circle cx="50" cy="48" r="6" fill="${color}"/>`;
}

function spellGlyph(subtype, color) {
  if (subtype === "quick") return `<path d="M55 12 L32 55 L48 55 L42 88 L70 42 L52 42 Z" fill="${color}" opacity=".95"/>`;
  if (subtype === "counter") return `<path d="M50 12 L78 24 V50 C78 68 66 80 50 88 C34 80 22 68 22 50 V24 Z" fill="${color}" opacity=".95"/>`;
  if (subtype === "continuous") return `<path d="M28 50 C28 38 40 38 50 50 C60 62 72 62 72 50 C72 38 60 38 50 50 C40 62 28 62 28 50 Z" fill="${color}" opacity=".95"/>`;
  return `<rect x="30" y="24" width="40" height="52" rx="4" fill="none" stroke="${color}" stroke-width="5" opacity=".95"/><line x1="38" y1="38" x2="62" y2="38" stroke="${color}" stroke-width="4"/><line x1="38" y1="50" x2="62" y2="50" stroke="${color}" stroke-width="4"/><line x1="38" y1="62" x2="54" y2="62" stroke="${color}" stroke-width="4"/>`;
}

const SUBTYPE_LABEL = { normal: "Normal Spell", continuous: "Continuous Spell", quick: "Quick-Play Spell · SS2", counter: "Counter Trap · SS3" };

// card: an engine card instance or a plain def. stats can be overridden.
export function buildCardEl(card, { faceDown = false, stats = null, count = null, tilt = true } = {}) {
  // instances carry their definition at .def (object); plain defs have a
  // numeric .def (the DEF stat) — disambiguate by type
  const def = (card.def && typeof card.def === "object") ? card.def : card;
  const el = document.createElement("div");
  if (faceDown) {
    el.className = "cb-card card-back";
    el.dataset.uid = card.uid || "";
    return el;
  }
  const isSpell = def.type === "spell";
  const foil = (def.rarity === "SR" || def.rarity === "UR") ? " foil" : "";
  el.className = `cb-card tribe-${def.tribe || "Neutral"} r-${def.rarity || "N"}${foil}${isSpell ? " spell" : ""}${card.evolved ? " evolved-card" : ""}`;
  el.dataset.uid = card.uid || "";
  el.dataset.cardId = def.id;
  const atk = stats?.atk ?? def.atk;
  const printedDef = stats?.printedDef ?? def.def;
  const hp = stats?.hp != null ? stats.hp : (stats?.def ?? def.def);
  const wounded = !isSpell && stats?.hp != null && Number(hp) < Number(printedDef);
  const isTrap = isSpell && def.spell?.subtype === "counter";
  const lv = isSpell ? 0 : monsterLevel(def);
  const rarity = def.rarity || "N";
  const costPip = isSpell
    ? `<div class="card-cost ${isTrap ? "trap-pip" : "spell-pip"}">${isTrap ? "T" : "S"}</div>`
    : `<div class="card-cost lv">★${lv}</div>`;
  const typeLine = isSpell
    ? SUBTYPE_LABEL[def.spell.subtype]
    : `LV${lv} ${def.tribe} Monster`;
  const defTitle = wounded ? `HP ${hp} / ${printedDef}` : "";
  const foilLayer = foil ? `<span class="card-foil" aria-hidden="true"></span>` : "";
  // Cards that pay off on a circuit wear it, so their role reads at a glance.
  const pays = comboTagsFor(def.id).pays;
  const comboPip = pays.length
    ? `<div class="combo-pip ${circuitClass(pays[0])}" data-circuit="${pays[0]}" title="Pays off on ${pays.map((c) => CIRCUITS[c].label).join(", ")}">${CIRCUITS[pays[0]].label}${pays.length > 1 ? ` +${pays.length - 1}` : ""}</div>`
    : "";
  el.innerHTML = `
    <div class="card-head">
      ${costPip}
      <div class="card-name">${def.name}</div>
      <div class="card-rarity r-${rarity}" title="${rarity} rarity">${rarity}</div>
    </div>
    <div class="card-art">${artSvg(def)}${foilLayer}${fxStripHtml(def, 3)}</div>
    <div class="card-type">${typeLine}</div>
    <div class="card-text">${linkifyCardText(def.text || "")}</div>
    ${isSpell ? "" : `<div class="card-stats"><span class="atk">${atk}</span><span class="def${wounded ? " wounded" : ""}" title="${defTitle}">${hp}</span></div>`}
    ${card.evolved ? `<div class="evolve-pip">EVO</div>` : ""}
    ${!isSpell && wounded ? `<div class="dmg-pip" title="Damage taken">-${card.dmg}</div>` : ""}
    ${comboPip}
  `;
  if (count != null) {
    const b = document.createElement("div");
    b.className = "count-badge";
    b.textContent = `x${count}`;
    el.appendChild(b);
  }
  if (foil && tilt) enableCardTilt(el);
  return el;
}

export function cardBackEl() {
  const el = document.createElement("div");
  el.className = "cb-card card-back";
  return el;
}

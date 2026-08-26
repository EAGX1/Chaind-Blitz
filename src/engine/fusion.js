/**
 * Extra Deck Contact / GY Fusion helpers.
 * Fusion SS never consumes Normal Summon. Hard OPT per fusion id per turn.
 */

import { P, log, monstersOf, pushEvents, queueLaneSummon } from "./state.js";
import { sendToGY, placeMonster } from "./ops.js";
import { summonNegationWindow, checkAndRespond } from "./chain.js";

function isFusionMonster(c) {
  return c?.def?.type === "monster" && (c.def.summon === "fusion" || c.def.fusion);
}

function matchesSpec(c, spec, usedSubstitute, allowSub) {
  if (allowSub && !usedSubstitute.v && c.def?.fusionSubstitute) {
    usedSubstitute.v = true;
    return true;
  }
  switch (spec.kind) {
    case "id":
      return c.id === spec.id;
    case "name":
      return c.def?.name === spec.name;
    case "fusion":
      return isFusionMonster(c);
    case "generic":
      return spec.filter ? !!spec.filter(c) : c.def?.type === "monster";
    default:
      return false;
  }
}

/** Find material assignment for a fusion def from candidates (field and/or GY). */
export function matchFusionMaterials(fusionDef, candidates) {
  const recipes = fusionDef.fusion?.recipes || [];
  for (const recipe of recipes) {
    const remaining = [...candidates];
    const picked = [];
    const usedSub = { v: false };
    let ok = true;
    for (const spec of recipe.materials) {
      const idx = remaining.findIndex((c) =>
        matchesSpec(c, spec, usedSub, !!recipe.allowSubstitute)
      );
      if (idx < 0) {
        ok = false;
        break;
      }
      picked.push(remaining.splice(idx, 1)[0]);
    }
    if (ok && picked.length === recipe.materials.length) return picked;
  }
  return null;
}

export function legalContactFusions(G, p) {
  const pl = P(G, p);
  const field = monstersOf(G, p).filter((m) => m.faceup || m.faceDownMz);
  const out = [];
  for (const fusion of pl.extra || []) {
    if (!isFusionMonster(fusion)) continue;
    if ((pl.contactOpt?.[fusion.id] || 0) === G.turnCount) continue;
    if (!fusion.def.fusion?.contact) continue;
    const mats = matchFusionMaterials(fusion.def, field);
    if (mats) out.push({ fusion, materials: mats });
  }
  return out;
}

export function legalGyFusions(G, p) {
  const pl = P(G, p);
  const pool = [
    ...monstersOf(G, p).filter((m) => m.faceup),
    ...pl.hand.filter((c) => c.def?.type === "monster"),
    ...pl.gy.filter((c) => c.def?.type === "monster"),
  ];
  const out = [];
  for (const fusion of pl.extra || []) {
    if (!isFusionMonster(fusion)) continue;
    if ((pl.contactOpt?.[fusion.id] || 0) === G.turnCount) continue;
    const mats = matchFusionMaterials(fusion.def, pool);
    if (mats) out.push({ fusion, materials: mats });
  }
  return out;
}

function lockedMz(G, p) {
  const locked = [];
  for (const lane of G.lanes || []) {
    if (!lane.revealed || !lane.def?.locksZone) continue;
    for (let zi = 0; zi < 6; zi++) if (lane.def.locksZone(G, lane, p, zi)) locked.push(zi);
  }
  return locked;
}

function fusionZoneAfterMaterials(G, p, materials, zone) {
  const pl = P(G, p);
  const freed = new Set(materials.filter((m) => m.loc === "mz").map((m) => m.zone));
  const locked = lockedMz(G, p);
  const isFree = (zi) => !locked.includes(zi) && (!pl.mz[zi] || freed.has(zi));
  if (zone != null && isFree(zone)) return zone;
  for (let zi = 0; zi < 6; zi++) if (isFree(zi)) return zi;
  return -1;
}

/**
 * Contact Fusion: send materials to GY, SS fusion from Extra with negate window.
 * Does NOT set normalSummoned.
 */
export async function contactFusionSummon(G, p, fusion, materials, zone = null) {
  const pl = P(G, p);
  if ((pl.contactOpt?.[fusion.id] || 0) === G.turnCount) {
    log(G, `${fusion.def.name} Contact already used this turn (OPT).`, "warn");
    return false;
  }
  const z = fusionZoneAfterMaterials(G, p, materials, zone);
  if (z < 0) {
    log(G, "No free monster zone — Fusion Summon fails.", "warn");
    return false;
  }
  for (const m of materials) {
    const ev = sendToGY(G, m, { from: m.loc, kind: "fusionMaterial" });
    pushEvents(G, [ev]);
  }
  const ei = pl.extra.indexOf(fusion);
  if (ei >= 0) pl.extra.splice(ei, 1);
  fusion.loc = "summoning";
  fusion.controller = p;
  log(G, `${p === 0 ? "You" : "AI"} Contact Fusion — ${fusion.def.name}!`, "summon");
  const negated = await summonNegationWindow(G, fusion, p);
  pl.contactOpt = pl.contactOpt || {};
  pl.contactOpt[fusion.id] = G.turnCount;
  if (negated) {
    const ev = sendToGY(G, fusion, { from: "summoning", kind: "summonNegated" });
    pushEvents(G, [ev]);
    log(G, `Fusion Summon of ${fusion.def.name} negated.`, "negate");
    await checkAndRespond(G, { startPlayer: G.tp });
    return false;
  }
  placeMonster(G, fusion, p, z);
  G.stats.fusions = (G.stats.fusions || 0) + 1;
  pushEvents(G, [
    { type: "specialSummon", card: fusion, player: p, source: "contactFusion" },
    { type: "fusionSummon", card: fusion, player: p }
  ]);
  log(G, `${p === 0 ? "You" : "AI"} Fusion Summon ${fusion.def.name}!`, "summon");
  queueLaneSummon(G, fusion);
  await checkAndRespond(G, { startPlayer: p });
  return true;
}

export async function gyFusionSummon(G, p, fusion, materials, zone = null) {
  return contactFusionSummon(G, p, fusion, materials, zone);
}

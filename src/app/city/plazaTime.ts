import * as THREE from "three";

export type ClockMode = "auto" | "day" | "night";

/** Shared plaza clock. 3D systems read this each frame; HUD polls. */
export const plazaClock = {
  mode: "day" as ClockMode,
  phase: 0.42,
};

export function setClockMode(mode: ClockMode) {
  plazaClock.mode = mode;
  if (mode === "day") plazaClock.phase = 0.42;
  if (mode === "night") plazaClock.phase = 0.92;
}

export function tickClock(dt: number, reduced = false) {
  if (plazaClock.mode === "day") {
    plazaClock.phase = 0.42;
    return;
  }
  if (plazaClock.mode === "night") {
    plazaClock.phase = 0.92;
    return;
  }
  plazaClock.phase = (plazaClock.phase + dt / (reduced ? 180 : 70)) % 1;
}

function lerpC(a: THREE.Color, b: THREE.Color, t: number, out: THREE.Color) {
  return out.copy(a).lerp(b, t);
}

const C = {
  dayZenith: new THREE.Color("#5eb4e8"),
  dayHorizon: new THREE.Color("#e4f3ff"),
  duskZenith: new THREE.Color("#3a4a88"),
  duskHorizon: new THREE.Color("#f0a060"),
  nightZenith: new THREE.Color("#0a1028"),
  nightHorizon: new THREE.Color("#3a2048"),
  dayFog: new THREE.Color("#c8e0f4"),
  nightFog: new THREE.Color("#1a1428"),
  dayGrass: new THREE.Color("#58b85a"),
  nightGrass: new THREE.Color("#163224"),
  dayStone: new THREE.Color("#ddd4c4"),
  nightStone: new THREE.Color("#3a3a4a"),
  dayAmb: new THREE.Color("#fff4e0"),
  nightAmb: new THREE.Color("#2a3050"),
  sun: new THREE.Color("#fff2d0"),
  moon: new THREE.Color("#c8d8f0"),
};

export type WorldLook = {
  night: number;
  sunX: number;
  sunY: number;
  sunZ: number;
  sunInt: number;
  ambInt: number;
  hemiInt: number;
  lamp: number;
  window: number;
  zenith: THREE.Color;
  horizon: THREE.Color;
  fog: THREE.Color;
  grass: THREE.Color;
  stone: THREE.Color;
  amb: THREE.Color;
};

const _zenith = new THREE.Color();
const _horizon = new THREE.Color();
const _fog = new THREE.Color();
const _grass = new THREE.Color();
const _stone = new THREE.Color();
const _amb = new THREE.Color();
const _duskZ = new THREE.Color();
const _duskH = new THREE.Color();

export function sampleWorld(phase = plazaClock.phase): WorldLook {
  const ang = (phase - 0.25) * Math.PI * 2;
  const elev = Math.sin(ang);
  const night = THREE.MathUtils.clamp(1 - (elev + 0.15) / 1.15, 0, 1);
  const dusk = THREE.MathUtils.clamp(1 - Math.abs(elev) * 2.4, 0, 1) * (elev > -0.2 ? 1 : 0.35);

  lerpC(C.dayZenith, C.nightZenith, night, _duskZ);
  lerpC(_duskZ, C.duskZenith, dusk * 0.65, _zenith);
  lerpC(C.dayHorizon, C.nightHorizon, night, _duskH);
  lerpC(_duskH, C.duskHorizon, dusk * 0.85, _horizon);
  lerpC(C.dayFog, C.nightFog, night, _fog);
  lerpC(C.dayGrass, C.nightGrass, night, _grass);
  lerpC(C.dayStone, C.nightStone, night, _stone);
  lerpC(C.dayAmb, C.nightAmb, night, _amb);

  return {
    night,
    sunX: Math.cos(ang) * 22,
    sunY: Math.max(-4, elev * 26),
    sunZ: 10,
    sunInt: Math.max(0, elev) * 2.45,
    ambInt: 0.18 + (1 - night) * 0.28,
    hemiInt: 0.22 + (1 - night) * 0.34,
    lamp: night * 2.4,
    window: night * 1.25,
    zenith: _zenith,
    horizon: _horizon,
    fog: _fog,
    grass: _grass,
    stone: _stone,
    amb: _amb,
  };
}

export function clockLabel(phase = plazaClock.phase) {
  if (plazaClock.mode === "day") return "Day";
  if (plazaClock.mode === "night") return "Night";
  const n = sampleWorld(phase).night;
  if (n < 0.25) return "Day";
  if (n < 0.65) return "Dusk";
  return "Night";
}

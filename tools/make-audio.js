// Bakes the duel SFX + music beds to real WAV files in public/audio/.
// Synthesized offline (layered partials + shaped noise), so the static site
// ships actual audio assets instead of live oscillator beeps.
// Run: node tools/make-audio.js

import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SR = 22050;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "audio");

/* ---------- tiny synth kit ---------- */
const sine = (f, t) => Math.sin(2 * Math.PI * f * t);
const tri = (f, t) => 2 * Math.abs(2 * ((f * t) % 1) - 1) - 1;
const saw = (f, t) => 2 * ((f * t) % 1) - 1;
const sqr = (f, t) => (sine(f, t) >= 0 ? 1 : -1);
const OSC = { sine, tri, saw, sqr };

function adsr(t, { a = 0.005, d = 0.06, s = 0.25, r = 0.12 }, dur) {
  if (t < a) return t / a;
  if (t < a + d) return 1 - (1 - s) * ((t - a) / d);
  if (t < dur - r) return s;
  return Math.max(0, s * (1 - (t - (dur - r)) / r));
}

/** Render a mono buffer of `dur` seconds from fn(t) -> sample. */
function render(dur, fn) {
  const n = Math.floor(SR * dur);
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) buf[i] = fn(i / SR, i);
  return buf;
}

function mix(...bufs) {
  const n = Math.max(...bufs.map((b) => b.length));
  const out = new Float32Array(n);
  for (const b of bufs) for (let i = 0; i < b.length; i++) out[i] += b[i];
  return out;
}

/** tone partial: osc with glide f0->f1 and ADSR. */
function partial({ f0 = 440, f1 = null, dur = 0.2, type = "sine", gain = 0.5, at = 0, env = {} }) {
  return render(dur + at, (t) => {
    const tt = t - at;
    if (tt < 0) return 0;
    const f = f1 ? f0 * Math.pow(f1 / f0, tt / dur) : f0;
    return OSC[type](f, tt) * adsr(tt, { r: Math.min(0.12, dur * 0.6), ...env }, dur) * gain;
  });
}

/** shaped noise burst: pseudo-random with exponential decay + simple lowpass. */
function noiseBurst({ dur = 0.2, gain = 0.4, at = 0, lp = 0.25, decay = 3 }) {
  let seed = 22222;
  const rnd = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
    return seed / 0x40000000 - 1;
  };
  let lpState = 0;
  return render(dur + at, (t) => {
    const tt = t - at;
    if (tt < 0) return 0;
    lpState += lp * (rnd() - lpState);
    return lpState * Math.exp(-decay * tt) * gain;
  });
}

function normalize(buf, peak = 0.86) {
  let max = 0;
  for (const s of buf) max = Math.max(max, Math.abs(s));
  if (max <= 0) return buf;
  const k = peak / max;
  return buf.map((s) => s * k);
}

function writeWav(name, buf) {
  const data = normalize(buf);
  const n = data.length;
  const bytes = Buffer.alloc(44 + n * 2);
  bytes.write("RIFF", 0); bytes.writeUInt32LE(36 + n * 2, 4); bytes.write("WAVE", 8);
  bytes.write("fmt ", 12); bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22); bytes.writeUInt32LE(SR, 24); bytes.writeUInt32LE(SR * 2, 28);
  bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36); bytes.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    bytes.writeInt16LE(Math.max(-1, Math.min(1, data[i])) * 32767 | 0, 44 + i * 2);
  }
  const file = join(ROOT, `${name}.wav`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, bytes);
  console.log(`audio/${name}.wav  ${(bytes.length / 1024).toFixed(1)} KB`);
}

/* ---------- SFX recipes ---------- */
const SFX = {
  "sfx/click": () => partial({ f0: 700, dur: 0.05, type: "sqr", gain: 0.35 }),
  "sfx/draw": () => mix(
    noiseBurst({ dur: 0.08, gain: 0.25, lp: 0.5, decay: 18 }),
    partial({ f0: 500, f1: 760, dur: 0.09, type: "tri", gain: 0.4 })
  ),
  "sfx/summon": () => mix(
    partial({ f0: 120, f1: 52, dur: 0.28, type: "sine", gain: 0.9 }),
    noiseBurst({ dur: 0.16, gain: 0.4, lp: 0.3, decay: 9 }),
    partial({ f0: 220, f1: 440, dur: 0.22, type: "tri", gain: 0.35, at: 0.05 })
  ),
  "sfx/attack": () => mix(
    noiseBurst({ dur: 0.14, gain: 0.55, lp: 0.65, decay: 10 }),
    partial({ f0: 190, f1: 80, dur: 0.14, type: "sqr", gain: 0.4, at: 0.02 })
  ),
  "sfx/damage": () => mix(
    noiseBurst({ dur: 0.2, gain: 0.6, lp: 0.35, decay: 8 }),
    partial({ f0: 130, f1: 55, dur: 0.24, type: "saw", gain: 0.5 })
  ),
  "sfx/destroy": () => mix(
    noiseBurst({ dur: 0.34, gain: 0.6, lp: 0.28, decay: 6 }),
    partial({ f0: 90, f1: 40, dur: 0.36, type: "sine", gain: 0.7 })
  ),
  "sfx/chain": () => mix(
    partial({ f0: 880, dur: 0.07, type: "sqr", gain: 0.3 }),
    partial({ f0: 1174, dur: 0.09, type: "sqr", gain: 0.3, at: 0.07 })
  ),
  "sfx/resolve": () => partial({ f0: 523, f1: 784, dur: 0.16, type: "tri", gain: 0.5 }),
  "sfx/negate": () => mix(
    partial({ f0: 300, f1: 110, dur: 0.3, type: "saw", gain: 0.5 }),
    noiseBurst({ dur: 0.12, gain: 0.3, lp: 0.4, decay: 12 })
  ),
  "sfx/heal": () => mix(
    partial({ f0: 660, f1: 990, dur: 0.26, type: "sine", gain: 0.45 }),
    partial({ f0: 1320, f1: 1980, dur: 0.22, type: "sine", gain: 0.15, at: 0.04 })
  ),
  "sfx/evolve": () => mix(
    partial({ f0: 392, dur: 0.3, type: "tri", gain: 0.45 }),
    partial({ f0: 523, dur: 0.3, type: "tri", gain: 0.45, at: 0.09 }),
    partial({ f0: 784, dur: 0.4, type: "tri", gain: 0.45, at: 0.18 }),
    noiseBurst({ dur: 0.3, gain: 0.15, lp: 0.7, decay: 5, at: 0.1 })
  ),
  "sfx/fusion": () => mix(
    partial({ f0: 196, f1: 784, dur: 0.42, type: "saw", gain: 0.4 }),
    partial({ f0: 294, f1: 1176, dur: 0.4, type: "tri", gain: 0.25, at: 0.05 }),
    noiseBurst({ dur: 0.4, gain: 0.25, lp: 0.8, decay: 4 }),
    partial({ f0: 98, f1: 65, dur: 0.4, type: "sine", gain: 0.6 })
  ),
  "sfx/lane": () => partial({ f0: 196, f1: 392, dur: 0.5, type: "sine", gain: 0.5, env: { s: 0.5 } }),
  "sfx/pack": () => mix(
    noiseBurst({ dur: 0.12, gain: 0.4, lp: 0.75, decay: 10 }),
    partial({ f0: 196, f1: 392, dur: 0.22, type: "tri", gain: 0.4, at: 0.04 })
  ),
  "sfx/win": () => mix(
    ...[523, 659, 784, 1046].map((f, i) =>
      partial({ f0: f, dur: 0.34, type: "tri", gain: 0.4, at: i * 0.11 }))
  ),
  "sfx/lose": () => mix(
    ...[392, 330, 262, 196].map((f, i) =>
      partial({ f0: f, dur: 0.36, type: "saw", gain: 0.32, at: i * 0.12 }))
  ),
};

/* ---------- music beds: 8s seamless pads (integer cycles per loop) ---------- */
const LOOP_S = 8;
const lock = (f) => Math.round(f * LOOP_S) / LOOP_S; // integer cycles -> seamless loop

function pad(freqs, { gain = 0.16, tremHz = 0, tremDepth = 0, air = 0.05 } = {}) {
  const parts = freqs.map((f, i) =>
    render(LOOP_S, (t) => {
      const trem = tremHz ? 1 - tremDepth * (0.5 + 0.5 * sine(tremHz, t)) : 1;
      const wob = 1 + 0.0016 * sine(0.13 + i * 0.07, t);
      return sine(lock(f) * wob, t) * gain * trem;
    }));
  if (air > 0) {
    let seed = 777;
    const rnd = () => {
      seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
      return seed / 0x40000000 - 1;
    };
    let lpState = 0;
    parts.push(render(LOOP_S, () => {
      lpState += 0.06 * (rnd() - lpState);
      return lpState * air;
    }));
  }
  return mix(...parts);
}

const BEDS = {
  "music/hub": () => pad([110, 164.81, 246.94], { gain: 0.15, air: 0.04 }),
  "music/duel": () => pad([98, 146.83, 220], { gain: 0.14, tremHz: 2, tremDepth: 0.35, air: 0.05 }),
  "music/city": () => pad([130.81, 196, 329.63], { gain: 0.13, air: 0.06 }),
};

console.log("Baking audio to public/audio ...");
for (const [name, fn] of Object.entries(SFX)) writeWav(name, fn());
for (const [name, fn] of Object.entries(BEDS)) writeWav(name, fn());
console.log("Done.");

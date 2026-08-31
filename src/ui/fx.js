// Visual + audio effects: floating numbers, flashes, summon/evolve bursts,
// and baked sample SFX (public/audio) with a procedural WebAudio fallback.

import { laneTheme } from "../data/fields.js";
import { sfxDestination, playSample } from "../meta/music.js";
import { fxDelay, fxSkip } from "./fxPace.js";

const fxLayer = () => document.getElementById("fx-layer");

export function fxNumber(x, y, text, cls = "dmg") {
  if (fxSkip()) return;
  const layer = fxLayer();
  if (!layer) return;
  const el = document.createElement("div");
  el.className = `fx-num ${cls}`;
  el.textContent = text;
  el.style.left = `${x - 15}px`;
  el.style.top = `${y - 15}px`;
  layer.appendChild(el);
  setTimeout(() => el.remove(), fxDelay(1100) || 1);
}

export function fxFlash(x, y, size = 120) {
  if (fxSkip()) return;
  const layer = fxLayer();
  if (!layer) return;
  const el = document.createElement("div");
  el.className = "fx-flash";
  el.style.cssText = `left:${x - size / 2}px; top:${y - size / 2}px; width:${size}px; height:${size}px;`;
  layer.appendChild(el);
  setTimeout(() => el.remove(), fxDelay(600) || 1);
}

export function fxOnElement(el, cls) {
  if (!el || fxSkip()) return;
  const r = el.getBoundingClientRect();
  const layer = fxLayer();
  if (!layer) return;
  const fx = document.createElement("div");
  fx.className = cls;
  const size = Math.max(r.width, r.height) * 1.4;
  fx.style.cssText = `left:${r.left + r.width / 2 - size / 2}px; top:${r.top + r.height / 2 - size / 2}px; width:${size}px; height:${size}px;`;
  layer.appendChild(fx);
  setTimeout(() => fx.remove(), fxDelay(950) || 1);
}

export function fxNumberOnElement(el, text, cls = "dmg") {
  if (!el) return;
  const r = el.getBoundingClientRect();
  fxNumber(r.left + r.width / 2, r.top + r.height / 2, text, cls);
}

// Cinematic center-screen banner for Field Lane reveals.
export function fxLaneBanner(index, def) {
  if (fxSkip()) return;
  const layer = fxLayer();
  if (!layer) return;
  const el = document.createElement("div");
  el.className = "lane-banner";
  el.dataset.theme = laneTheme(def?.id);
  el.innerHTML = `
    <div class="lane-banner-tag">FIELD LANE ${index + 1}</div>
    <div class="lane-banner-name">${def.name}</div>
    <div class="lane-banner-text">${def.text}</div>`;
  layer.appendChild(el);
  setTimeout(() => el.remove(), fxDelay(2400) || 1);
}

/* ================= procedural SFX (routed through settings sfxGain) ================= */
function sfxBus() {
  const dest = sfxDestination();
  if (!dest) return null;
  return { dest, ctx: dest.context };
}

function tone({ freq = 440, freqEnd = null, dur = 0.15, type = "sine", gain = 0.12, when = 0 }) {
  const bus = sfxBus();
  if (!bus) return;
  const { dest, ctx } = bus;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(dest);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.2, gain = 0.1, when = 0, low = 400 }) {
  const bus = sfxBus();
  if (!bus) return;
  const { dest, ctx } = bus;
  const t0 = ctx.currentTime + when;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filt = ctx.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.value = low;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(filt).connect(g).connect(dest);
  src.start(t0);
}

/** Card lunge toward the target + impact flash. Driven by attack log lines. */
export function fxAttackLunge(fromEl, toEl) {
  if (!fromEl || fxSkip()) return;
  const a = fromEl.getBoundingClientRect();
  const b = toEl ? toEl.getBoundingClientRect() : null;
  const dx = b ? (b.left + b.width / 2) - (a.left + a.width / 2) : 0;
  const dy = b ? (b.top + b.height / 2) - (a.top + a.height / 2) : -46;
  const dist = Math.hypot(dx, dy) || 1;
  const k = Math.min(0.6, 110 / dist);
  try {
    fromEl.animate([
      { transform: "translate(0,0)" },
      { transform: `translate(${dx * k}px, ${dy * k}px) scale(1.12)`, offset: 0.35 },
      { transform: "translate(0,0)" }
    ], { duration: Math.max(180, fxDelay(320)), easing: "cubic-bezier(.2,.9,.3,1)" });
    if (toEl) {
      toEl.animate([
        { transform: "translate(0,0)" },
        { transform: `translate(${-dx * 0.05}px, ${-dy * 0.05}px)`, offset: 0.5 },
        { transform: "translate(0,0)" }
      ], { duration: Math.max(160, fxDelay(280)), easing: "ease-out" });
      setTimeout(() => fxFlash(b.left + b.width / 2, b.top + b.height / 2, 150), fxDelay(110) || 1);
    }
  } catch { /* WAAPI unavailable — the log line still lands */ }
}

export const sfx = {
  summon: () => { if (playSample("sfx/summon")) return; noise({ dur: 0.18, low: 900 }); tone({ freq: 220, freqEnd: 440, dur: 0.2, type: "triangle", gain: 0.1 }); },
  chain: () => { if (playSample("sfx/chain")) return; tone({ freq: 880, dur: 0.08, type: "square", gain: 0.05 }); tone({ freq: 1174, dur: 0.1, type: "square", gain: 0.05, when: 0.07 }); },
  resolve: () => { if (playSample("sfx/resolve")) return; tone({ freq: 523, freqEnd: 784, dur: 0.16, type: "triangle", gain: 0.09 }); },
  negate: () => { if (playSample("sfx/negate")) return; tone({ freq: 300, freqEnd: 120, dur: 0.3, type: "sawtooth", gain: 0.1 }); },
  damage: () => { if (playSample("sfx/damage")) return; noise({ dur: 0.16, low: 500, gain: 0.14 }); tone({ freq: 130, freqEnd: 60, dur: 0.2, type: "sawtooth", gain: 0.08 }); },
  heal: () => { if (playSample("sfx/heal")) return; tone({ freq: 660, freqEnd: 990, dur: 0.25, type: "sine", gain: 0.08 }); },
  draw: () => { if (playSample("sfx/draw")) return; tone({ freq: 500, freqEnd: 700, dur: 0.07, type: "triangle", gain: 0.05 }); },
  evolve: () => { if (playSample("sfx/evolve")) return; tone({ freq: 392, dur: 0.4, type: "triangle", gain: 0.1 }); tone({ freq: 523, dur: 0.4, type: "triangle", gain: 0.1, when: 0.1 }); tone({ freq: 784, dur: 0.5, type: "triangle", gain: 0.1, when: 0.2 }); },
  lane: () => { if (playSample("sfx/lane")) return; tone({ freq: 196, freqEnd: 392, dur: 0.5, type: "sine", gain: 0.12 }); },
  destroy: () => { if (playSample("sfx/destroy")) return; noise({ dur: 0.3, low: 700, gain: 0.12 }); },
  attack: () => { if (playSample("sfx/attack")) return; noise({ dur: 0.12, low: 1200, gain: 0.1 }); tone({ freq: 180, freqEnd: 90, dur: 0.12, type: "square", gain: 0.07 }); },
  click: () => { if (playSample("sfx/click")) return; tone({ freq: 700, dur: 0.04, type: "square", gain: 0.03 }); },
  set: () => {
    if (playSample("sfx/set")) return;
    noise({ dur: 0.1, low: 500, gain: 0.07 });
    tone({ freq: 240, freqEnd: 140, dur: 0.16, type: "triangle", gain: 0.08 });
  },
  lp: () => {
    if (playSample("sfx/lp")) return;
    noise({ dur: 0.22, low: 280, gain: 0.18 });
    tone({ freq: 90, freqEnd: 40, dur: 0.28, type: "sawtooth", gain: 0.12 });
  },
  pack: () => {
    if (playSample("sfx/pack")) return;
    noise({ dur: 0.12, low: 1400, gain: 0.08 });
    tone({ freq: 196, freqEnd: 392, dur: 0.22, type: "triangle", gain: 0.08 });
  },
  victory: () => { if (playSample("sfx/win")) return; [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, dur: 0.35, type: "triangle", gain: 0.1, when: i * 0.12 })); },
  defeat: () => { if (playSample("sfx/lose")) return; [392, 330, 262, 196].forEach((f, i) => tone({ freq: f, dur: 0.35, type: "triangle", gain: 0.1, when: i * 0.12 })); }
};

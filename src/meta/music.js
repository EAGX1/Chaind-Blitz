// Music / SFX buses. Volume comes from profile.settings. Stubs use oscillators
// when no audio files are present (static-site, no asset pipeline).

const DEFAULTS = { music: 0.6, sfx: 0.8, musicMuted: false, sfxMuted: false, reducedMotion: false };

let settingsRef = { ...DEFAULTS };
let ctx = null;
let musicGain = null;
let sfxGain = null;
let bedNodes = [];
let bedName = null;

function audioCtx() {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    try { ctx = new AC(); } catch { return null; }
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  if (!musicGain) {
    musicGain = ctx.createGain();
    sfxGain = ctx.createGain();
    musicGain.connect(ctx.destination);
    sfxGain.connect(ctx.destination);
    applyVolumes();
  }
  return ctx;
}

function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function bindSettings(settings) {
  settingsRef = { ...DEFAULTS, ...(settings || {}) };
  applyVolumes();
}

/** Slider value after mute. Mute is a toggle — it does not zero the stored slider. */
export function busLevel(settings, bus) {
  const s = { ...DEFAULTS, ...(settings || {}) };
  if (bus === "music") return s.musicMuted ? 0 : clamp01(s.music);
  return s.sfxMuted ? 0 : clamp01(s.sfx);
}

export function applyVolumes() {
  if (!musicGain || !sfxGain) return;
  musicGain.gain.value = busLevel(settingsRef, "music");
  sfxGain.gain.value = busLevel(settingsRef, "sfx");
}

function stopBedNodes() {
  for (const n of bedNodes) {
    try { n.stop(); } catch { /* already stopped */ }
    try { n.disconnect(); } catch { /* ignore */ }
  }
  bedNodes = [];
  bedName = null;
}

export function stopBed() {
  stopBedNodes();
}

const BEDS = {
  hub: [{ freq: 110, type: "sine" }, { freq: 164.81, type: "sine" }, { freq: 196, type: "triangle" }],
  duel: [{ freq: 98, type: "sine" }, { freq: 146.83, type: "triangle" }, { freq: 220, type: "sine" }],
  city: [{ freq: 130.81, type: "sine" }, { freq: 196, type: "sine" }]
};

/** Per-bed filter / LFO / detune so hub, duel, and city don't share a test-tone. */
const BED_TIMBRE = {
  hub:  { cutoff: 820,  lfoHz: 0.06, lfoDepth: 3.2, filterLfo: 90,  detune: 5, osc2: "triangle", gain: 0.022, pan: 0.18 },
  duel: { cutoff: 460,  lfoHz: 0.11, lfoDepth: 5.5, filterLfo: 140, detune: 8, osc2: "triangle", gain: 0.018, pan: 0.28 },
  city: { cutoff: 1180, lfoHz: 0.08, lfoDepth: 4.0, filterLfo: 180, detune: 7, osc2: "sine",     gain: 0.02,  pan: 0.22 }
};

function pushNode(n) {
  bedNodes.push(n);
}

export function playBed(name = "hub", settings) {
  if (settings) bindSettings(settings);
  if (settingsRef.reducedMotion && busLevel(settingsRef, "music") === 0) return;
  const ac = audioCtx();
  if (!ac || !musicGain) return;
  if (bedName === name && bedNodes.length) {
    applyVolumes();
    return;
  }
  stopBedNodes();
  bedName = name;
  const baked = loadSample(`music/${name}`);
  if (baked.status !== "missing") {
    const startLoop = () => {
      if (baked.status !== "ready" || bedName !== name) return;
      const src = ac.createBufferSource();
      src.buffer = baked.buffer;
      src.loop = true;
      const g = ac.createGain();
      g.gain.value = 1;
      src.connect(g).connect(musicGain);
      src.start();
      pushNode(src);
      pushNode(g);
    };
    if (baked.status === "ready") startLoop();
    else baked.promise?.then(startLoop);
    return;
  }
  const spec = BEDS[name] || BEDS.hub;
  const timbre = BED_TIMBRE[name] || BED_TIMBRE.hub;
  const t0 = ac.currentTime;
  const useLfo = !settingsRef.reducedMotion;
  spec.forEach((s, i) => {
    const osc = ac.createOscillator();
    const osc2 = ac.createOscillator();
    const filter = ac.createBiquadFilter();
    const g = ac.createGain();
    const pan = ac.createStereoPanner();
    osc.type = s.type;
    osc.frequency.setValueAtTime(s.freq, t0);
    osc2.type = timbre.osc2 || s.type;
    osc2.frequency.setValueAtTime(s.freq, t0);
    osc2.detune.setValueAtTime(timbre.detune || 6, t0);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(timbre.cutoff, t0);
    filter.Q.setValueAtTime(0.7, t0);
    pan.pan.setValueAtTime((i % 2 === 0 ? -1 : 1) * (timbre.pan || 0.2), t0);
    const voiceGain = timbre.gain || 0.02;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(voiceGain, t0 + 0.5);
    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(g).connect(pan).connect(musicGain);
    if (useLfo) {
      const lfo = ac.createOscillator();
      const lfoPitch = ac.createGain();
      const lfoCut = ac.createGain();
      lfo.type = "sine";
      lfo.frequency.setValueAtTime(timbre.lfoHz, t0);
      lfoPitch.gain.setValueAtTime(timbre.lfoDepth, t0);
      lfoCut.gain.setValueAtTime(timbre.filterLfo, t0);
      lfo.connect(lfoPitch);
      lfo.connect(lfoCut);
      lfoPitch.connect(osc.frequency);
      lfoPitch.connect(osc2.frequency);
      lfoCut.connect(filter.frequency);
      lfo.start(t0);
      pushNode(lfo);
      pushNode(lfoPitch);
      pushNode(lfoCut);
    }
    osc.start(t0);
    osc2.start(t0);
    pushNode(osc);
    pushNode(osc2);
    pushNode(filter);
    pushNode(g);
    pushNode(pan);
  });
  bedName = name;
}

const STINGERS = {
  win: [523, 659, 784, 1046],
  lose: [392, 330, 262, 196],
  chain: [880, 1174],
  combo: [659, 880, 1174, 1568],
  evolve: [392, 523, 784],
  fusion: [262, 392, 523, 784],
  pack: [440, 554, 659],
  summon: [330, 440, 554],
  damage: [196, 147],
  turnYou: [392, 523, 659],
  turnFoe: [330, 277, 220]
};

export function bedNames() {
  return Object.keys(BEDS);
}

export function stingerNames() {
  return Object.keys(STINGERS);
}

export function playStinger(name = "win", settings) {
  if (settings) bindSettings(settings);
  const ac = audioCtx();
  if (!ac || !sfxGain) return;
  if (playSample(`sfx/${name}`)) return;
  const notes = STINGERS[name] || STINGERS.win;
  const t0 = ac.currentTime;
  notes.forEach((freq, i) => {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, t0 + i * 0.12);
    g.gain.setValueAtTime(0.12, t0 + i * 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.12 + 0.35);
    osc.connect(g).connect(sfxGain);
    osc.start(t0 + i * 0.12);
    osc.stop(t0 + i * 0.12 + 0.4);
  });
}

/** Destination for duel SFX so the settings slider actually applies. */
export function sfxDestination() {
  const ac = audioCtx();
  if (!ac || !sfxGain) return null;
  return sfxGain;
}

/* ---------- baked sample playback (public/audio), oscillator fallback ---------- */
const sampleCache = new Map(); // name -> { status, buffer, promise }

function loadSample(name) {
  let e = sampleCache.get(name);
  if (e) return e;
  e = { status: "loading", buffer: null, promise: null };
  sampleCache.set(name, e);
  const ac = audioCtx();
  if (!ac || typeof fetch !== "function") {
    e.status = "missing";
    return e;
  }
  e.promise = fetch(`audio/${name}.wav`)
    .then((r) => {
      if (!r.ok) throw new Error(`audio ${name}: ${r.status}`);
      return r.arrayBuffer();
    })
    .then((ab) => ac.decodeAudioData(ab))
    .then((buf) => {
      e.buffer = buf;
      e.status = "ready";
    })
    .catch(() => {
      e.status = "missing";
    });
  return e;
}

/** Warm the cache so first duel beats don't wait on decode. */
export function preloadAudio() {
  for (const n of ["sfx/summon", "sfx/attack", "sfx/damage", "sfx/chain", "sfx/destroy",
    "music/hub", "music/duel", "music/city"]) {
    loadSample(n);
  }
}

/**
 * Play a baked sample through the volume bus. Returns false when the file is
 * known-missing so the caller can fall back to procedural audio.
 */
export function playSample(name, { bus = "sfx", loop = false, gain = 1 } = {}) {
  const ac = audioCtx();
  if (!ac) return false;
  const e = loadSample(name);
  if (e.status === "missing") return false;
  const start = () => {
    if (e.status !== "ready" || !e.buffer) return null;
    const src = ac.createBufferSource();
    src.buffer = e.buffer;
    src.loop = loop;
    const g = ac.createGain();
    g.gain.value = gain;
    src.connect(g).connect(bus === "music" ? musicGain : sfxGain);
    src.start();
    return src;
  };
  if (e.status === "ready") return start() ? true : false;
  e.promise?.then(() => { start(); });
  return true;
}

/** True once a baked sample is confirmed on disk (used by beds to switch over). */
export function sampleReady(name) {
  return sampleCache.get(name)?.status === "ready";
}

export function resume() {
  return audioCtx();
}

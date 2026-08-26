// Profile persistence: versioned localStorage save with migration hooks.

const KEY = "chaind-blitz-save-v1";
import { STARTER_IDS, DEFAULT_EQUIPPED } from "./cosmetics.js";
import { rotateBackup } from "./backups.js";
import {
  STARTING_GEMS,
  applyStarter,
  grantSandboxCollection,
  applyDevWallet,
  collectionCopyCount
} from "./campaign.js";
import { ADVANCED_COPIES } from "./banlist.js";

export function freshProfile(opts = {}) {
  const p = {
    version: 1,
    name: "Duelist",
    gems: STARTING_GEMS,
    coins: 0,
    collection: {},          // cardId -> copies owned (max 3 usable in a deck)
    dust: { N: 0, R: 0, SR: 0, UR: 0 },
    rank: { tier: 0, lp: 0, promo: null }, // promo: {wins, losses} Bo3
    stats: { wins: 0, losses: 0, rankedWins: 0, bestFloor: 0 },
    decks: {},           // name -> { main, extra } (legacy: [cardIds])
    banlist: { preset: "advanced", copies: { ...ADVANCED_COPIES } },
    rogue: null,         // active roguelike run
    modes: { draft: null, cube: null, sealed: null, tourney: null }, // mode gauntlet states
    packPity: 0,         // packs since last UR
    lastBrawl: null,
    seenRulebook: false,
    seenDuelHint: false,
    cosmeticsOwned: [...STARTER_IDS],
    equipped: { ...DEFAULT_EQUIPPED },
    soloGates: { cleared: {}, tutorialSeen: false },
    duelPass: { xp: 0, claimed: [] },
    login: { lastClaim: null, streak: 0 },
    missions: { dailies: [], progress: {} },
    settings: {
      uiScale: 1,
      chainMode: "smart",
      board3d: false,
      locale: "en",
      music: 0.6,
      sfx: 0.8,
      musicMuted: false,
      sfxMuted: false,
      fxSpeed: 1,
      reducedMotion: false,
      hidePlaza: false,
      devMode: false
    },
    matchHistory: [],
    starterId: null,
    activeDeck: null,
    devCheats: false
  };
  if (opts.sandbox) {
    grantSandboxCollection(p);
    p.starterId = "sandbox";
  } else if (opts.starter) {
    applyStarter(p, opts.starter);
  }
  return p;
}

function maybeFastStarter(p) {
  if (p.starterId) return p;
  if (typeof window !== "undefined" && window.__CB_FAST) {
    applyStarter(p, "ignis");
  }
  return p;
}

function migrate(p) {
  if (!p || typeof p !== "object") return maybeFastStarter(freshProfile());
  const fresh = freshProfile();
  const out = { ...fresh, ...p };
  out.dust = { ...fresh.dust, ...(p.dust || {}) };
  out.rank = { ...fresh.rank, ...(p.rank || {}) };
  out.stats = { ...fresh.stats, ...(p.stats || {}) };
  out.modes = { ...fresh.modes, ...(p.modes || {}) };
  out.collection = { ...(p.collection || {}) };
  out.equipped = { ...fresh.equipped, ...(p.equipped || {}) };
  out.soloGates = {
    ...fresh.soloGates,
    ...(p.soloGates || {}),
    cleared: { ...fresh.soloGates.cleared, ...(p.soloGates?.cleared || {}) }
  };
  out.duelPass = {
    ...fresh.duelPass,
    ...(p.duelPass || {}),
    claimed: Array.isArray(p.duelPass?.claimed) ? p.duelPass.claimed : []
  };
  out.login = { ...fresh.login, ...(p.login || {}) };
  out.missions = {
    ...fresh.missions,
    ...(p.missions || {}),
    dailies: Array.isArray(p.missions?.dailies) ? p.missions.dailies : [],
    progress: { ...fresh.missions.progress, ...(p.missions?.progress || {}) }
  };
  out.settings = { ...fresh.settings, ...(p.settings || {}) };
  const preset = p.banlist?.preset;
  if (!p.banlist || preset === "advanced") {
    out.banlist = { preset: "advanced", copies: { ...ADVANCED_COPIES } };
  } else {
    out.banlist = { preset: preset || "custom", copies: { ...(p.banlist.copies || {}) } };
  }
  out.matchHistory = Array.isArray(p.matchHistory) ? p.matchHistory : [];
  const owned = Array.isArray(p.cosmeticsOwned) ? p.cosmeticsOwned : [];
  out.cosmeticsOwned = [...new Set([...fresh.cosmeticsOwned, ...owned])];
  if (!out.starterId && collectionCopyCount(out) >= 200) {
    out.starterId = "legacy";
  }
  return maybeFastStarter(out);
}

export function loadProfile() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch (e) {
    console.warn("save corrupted, resetting", e);
  }
  const p = maybeFastStarter(freshProfile());
  saveProfile(p);
  return p;
}

export function saveProfile(p) {
  if (p?.devCheats) applyDevWallet(p);
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
    rotateBackup(p);
  } catch (e) { console.warn("save failed", e); }
}

export function resetProfile(opts = {}) {
  const p = freshProfile();
  if (opts.settings && typeof opts.settings === "object") {
    p.settings = { ...p.settings, ...opts.settings };
  }
  if (opts.devCheats) {
    p.devCheats = true;
    applyDevWallet(p);
  }
  const target = opts.into && typeof opts.into === "object" ? opts.into : null;
  if (target) {
    for (const k of Object.keys(target)) delete target[k];
    Object.assign(target, p);
    saveProfile(target);
    return target;
  }
  saveProfile(p);
  return p;
}

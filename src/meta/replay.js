// Local JSON replay: snapshot at start + ordered action log. Scrubber consumes this.

import { serializeGame } from "../engine/snapshot.js";

export const REPLAY_VERSION = 1;

export function startRecording(G) {
  let snapshot = null;
  try {
    if (G?.players) snapshot = serializeGame(G);
  } catch {
    snapshot = null;
  }
  return {
    version: REPLAY_VERSION,
    startedAt: Date.now(),
    seed: G?.seed ?? 0,
    meta: { ...(G?.meta || {}) },
    snapshot,
    actions: [],
    log: []
  };
}

export function captureBoard(G) {
  try {
    if (G?.players) return serializeGame(G);
  } catch { /* snapshot is optional on a live G */ }
  return null;
}

export function captureLog(rec, G) {
  if (!rec) return rec;
  rec.log = (G?.log || []).map((e) => ({
    msg: e?.msg || "",
    cls: e?.cls || "",
    t: e?.t,
    phase: e?.phase || ""
  }));
  return rec;
}

export function logLineText(e) {
  const t = e?.t != null ? `T${e.t}` : "";
  const ph = e?.phase || "";
  const prefix = [t, ph].filter(Boolean).join(" ");
  const msg = String(e?.msg || "");
  return prefix ? `${prefix}  ${msg}` : msg;
}

/** Tiles for the post-game Duel Log: engine story first, else io actions. */
export function replayLogTiles(data) {
  const log = data?.log || [];
  if (log.length) {
    return log.map((e, i) => ({ i, label: logLineText(e), kind: "log" }));
  }
  const actions = data?.actions || [];
  const actTiles = actions.map((e, i) => ({ i, label: describeReplayAction(e), kind: "action" }));
  if (hasBoardRewind(data)) {
    return [{ i: -1, label: "Duel start", kind: "start" }, ...actTiles];
  }
  return actTiles;
}

/** Action whose board includes this engine-log line (or -1 for the opening snapshot). */
export function actionIndexForLogLine(rec, logI) {
  const actions = rec?.actions || [];
  if (logI == null || logI < 0) return -1;
  for (let i = 0; i < actions.length; i++) {
    const n = actions[i]?.logLen;
    if (typeof n === "number" && n > logI) return i;
  }
  for (let i = actions.length - 1; i >= 0; i--) {
    if (actions[i]?.board) return i;
  }
  return -1;
}

export function attachBoard(entry, G) {
  if (!entry) return entry;
  const board = captureBoard(G);
  if (board) entry.board = board;
  if (G) entry.logLen = (G.log || []).length;
  return entry;
}

/** Record every seat's io pick (human and CPU) plus the engine log. */
export function wrapIoReplay(io, rec, G) {
  if (!io || !rec) return io;
  const methods = ["choose", "askChain", "chooseMain", "askAttack", "askMulligan", "askComeback"];
  for (const m of methods) {
    if (typeof io[m] !== "function") continue;
    const orig = io[m].bind(io);
    io[m] = async (...args) => {
      const out = await orig(...args);
      const entry = pushAction(rec, { type: m, player: args[0], pick: flattenIoPick(m, out, G) });
      queueMicrotask(() => {
        attachBoard(entry, G);
        captureLog(rec, G);
      });
      return out;
    };
  }
  const origLog = typeof io.onLog === "function" ? io.onLog.bind(io) : null;
  io.onLog = (msg, cls) => {
    origLog?.(msg, cls);
    captureLog(rec, G);
  };
  return io;
}

export function pushAction(rec, action, G = null) {
  if (!rec) return rec;
  if (!Array.isArray(rec.actions)) rec.actions = [];
  const entry = {
    i: rec.actions.length,
    at: Date.now(),
    action: action && typeof action === "object" ? { ...action } : { type: String(action) },
    board: G ? captureBoard(G) : null
  };
  if (G) entry.logLen = (G.log || []).length;
  rec.actions.push(entry);
  return entry;
}

/** Board after action `index`, or the opening snapshot when index < 0. */
export function boardAt(rec, index) {
  if (!rec) return null;
  if (index < 0) return rec.snapshot || null;
  const actions = rec.actions || [];
  const last = Math.min(index, actions.length - 1);
  for (let i = last; i >= 0; i--) {
    if (actions[i]?.board) return actions[i].board;
  }
  return rec.snapshot || null;
}

export function hasBoardRewind(rec) {
  if (rec?.snapshot) return true;
  return (rec?.actions || []).some((a) => a?.board);
}

export function exportReplay(rec) {
  return JSON.stringify(rec || { version: REPLAY_VERSION, actions: [] });
}

export function importReplay(json) {
  try {
    const data = typeof json === "string" ? JSON.parse(json) : json;
    if (!data || typeof data !== "object") return null;
    if ((data.version || 1) !== REPLAY_VERSION) return null;
    if (!Array.isArray(data.actions)) data.actions = [];
    if (!Array.isArray(data.log)) data.log = [];
    return data;
  } catch {
    return null;
  }
}

function findCardByUid(G, uid) {
  if (!G || uid == null) return null;
  for (const pl of G.players || []) {
    for (const loc of ["hand", "deck", "extra", "gy", "ban"]) {
      const hit = (pl[loc] || []).find((c) => c && c.uid === uid);
      if (hit) return hit;
    }
    for (const z of [...(pl.mz || []), ...(pl.stz || [])]) if (z?.uid === uid) return z;
  }
  return null;
}

/** Flatten an io pick so the action list stores names, not live card objects. */
export function flattenIoPick(method, pick, G) {
  if (pick == null) return pick;
  if (typeof pick === "number" || typeof pick === "string" || typeof pick === "boolean") return pick;
  if (Array.isArray(pick)) return { count: pick.length };
  if (typeof pick !== "object") return String(pick);
  const out = {};
  if (pick.type) out.type = pick.type;
  if (pick.label) out.label = pick.label;
  if (pick.card?.def?.name) out.name = pick.card.def.name;
  else if (pick.fusion?.def?.name) out.name = pick.fusion.def.name;
  if (pick.zone != null) out.zone = pick.zone;
  if (method === "askAttack") {
    if (pick.attackerUid != null) out.name = findCardByUid(G, pick.attackerUid)?.def?.name || out.name;
    out.target = pick.targetUid == null ? "directly" : (findCardByUid(G, pick.targetUid)?.def?.name || "a monster");
    out.type = out.type || "attack";
  }
  if (pick.type === "end" && G?.phase) out.phase = G.phase;
  return Object.keys(out).length ? out : { type: method };
}

/** Player-facing history tile, e.g. "You Normal Summon Ember Fox". */
export function describeReplayAction(entry) {
  const a = entry?.action;
  if (!a || typeof a !== "object") return String(entry ?? "");
  const who = a.player === 1 ? "AI" : a.player === 0 ? "You" : "Player";
  const pick = a.pick;
  const type = a.type;
  const nameOf = (p) => p?.name || p?.label || "";

  if (type === "end" && a.result) {
    const w = a.result.winner;
    const whoWon = w == null ? "Draw" : w === 0 ? "You win" : "AI wins";
    return `${whoWon}${a.result.reason ? ` — ${a.result.reason}` : ""}`;
  }
  if (type === "chooseMain") {
    if (!pick || pick.type === "end") return `${who} ended ${pick?.phase || "the Main Phase"}`;
    if (pick.type === "undo") return `${who} undid the last play`;
    const n = nameOf(pick);
    const verbs = {
      summon: "Normal Summon",
      ambushSet: "Ambush Set",
      activate: "activate",
      activateSet: "activate",
      set: "Set",
      evolve: "Evolve",
      ignition: "use the effect of",
      contactFusion: "Contact Fusion"
    };
    const verb = verbs[pick.type] || pick.type;
    return n ? `${who} ${verb} ${n}` : `${who} ${verb}`;
  }
  if (type === "askAttack") {
    if (!pick) return `${who} ended Battle`;
    if (pick.target && pick.name) return `${who} attacked ${pick.target} with ${pick.name}`;
    if (pick.name) return `${who} declared an attack with ${pick.name}`;
    return `${who} declared an attack`;
  }
  if (type === "askChain") {
    if (pick == null) return `${who} passed`;
    if (typeof pick === "number") return `${who} chained`;
    return `${who} chained${nameOf(pick) ? ` ${nameOf(pick)}` : ""}`;
  }
  if (type === "askMulligan") {
    const n = pick?.count ?? (Array.isArray(pick) ? pick.length : 0);
    return n ? `${who} mulliganed ${n}` : `${who} kept the opening hand`;
  }
  if (type === "askComeback") return `${who} chose Comeback: ${pick || "draw"}`;
  if (type === "choose") return `${who} chose targets`;
  return `${who} · ${type}`;
}

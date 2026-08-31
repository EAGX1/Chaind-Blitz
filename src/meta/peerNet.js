// Optional local-backend PvP. Airplane mode still plays vs CPU / hotseat.
import { backendCandidates, createRoom } from "./backendClient.js";

export function formatRoomCode(raw) {
  return String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

export const BACKEND_OFFLINE_REASON = "backend offline";

function duelWsCandidates() {
  return backendCandidates().map((u) => u.replace(/^http/i, "ws") + "/duel");
}

function openSocket(url) {
  if (typeof WebSocket === "undefined") return null;
  try {
    return new WebSocket(url);
  } catch {
    return null;
  }
}

function waitOpen(ws, ms = 2000) {
  return new Promise((resolve) => {
    if (!ws) return resolve(false);
    if (ws.readyState === 1) return resolve(true);
    const t = setTimeout(() => resolve(false), ms);
    ws.addEventListener("open", () => { clearTimeout(t); resolve(true); }, { once: true });
    ws.addEventListener("error", () => { clearTimeout(t); resolve(false); }, { once: true });
  });
}

function makeSession(ws) {
  const inbox = [];
  const waiters = [];
  const closeCbs = new Set();
  let startWait = null;
  let startPayload = null;
  let buildWait = null;
  let buildPayload = null;
  let closed = false;

  function flush() {
    while (inbox.length && waiters.length) {
      const w = waiters.shift();
      w(inbox.shift());
    }
  }

  ws.addEventListener("message", (ev) => {
    let msg;
    try { msg = JSON.parse(String(ev.data)); } catch { return; }
    if (msg.type === "start") {
      startPayload = msg;
      startWait?.(msg);
      startWait = null;
      return;
    }
    if (msg.type === "build") {
      buildPayload = msg;
      buildWait?.(msg);
      buildWait = null;
      return;
    }
    if (msg.type === "pick") {
      inbox.push(msg);
      flush();
    }
  });
  ws.addEventListener("close", () => {
    closed = true;
    startWait?.(null);
    buildWait?.(null);
    startWait = null;
    buildWait = null;
    while (waiters.length) waiters.shift()(null);
    for (const cb of closeCbs) {
      try { cb(); } catch { /* ignore */ }
    }
  });

  return {
    ws,
    get closed() { return closed; },
    send(payload) {
      if (closed || ws.readyState !== 1) return false;
      try {
        ws.send(JSON.stringify(payload));
        return true;
      } catch {
        return false;
      }
    },
    pullAction(_method, _player) {
      if (inbox.length) return Promise.resolve(inbox.shift().packed ?? null);
      if (closed) return Promise.resolve(null);
      return new Promise((resolve) => {
        waiters.push((msg) => resolve(msg ? msg.packed ?? null : null));
      });
    },
    onClose(cb) {
      if (typeof cb === "function") closeCbs.add(cb);
    },
    waitStart(ms = 120000) {
      if (startPayload) return Promise.resolve(startPayload);
      if (closed) return Promise.resolve(null);
      return new Promise((resolve) => {
        const t = setTimeout(() => {
          if (startWait) { startWait = null; resolve(null); }
        }, ms);
        startWait = (msg) => { clearTimeout(t); resolve(msg); };
      });
    },
    waitBuild(ms = 120000) {
      if (buildPayload) return Promise.resolve(buildPayload);
      if (closed) return Promise.resolve(null);
      return new Promise((resolve) => {
        const t = setTimeout(() => {
          if (buildWait) { buildWait = null; resolve(null); }
        }, ms);
        buildWait = (msg) => { clearTimeout(t); resolve(msg); };
      });
    },
    close() {
      try { ws.close(); } catch { /* ignore */ }
    }
  };
}

let active = null;

export function disconnectPeer() {
  if (!active) return;
  try { active.close(); } catch { /* ignore */ }
  active = null;
}

export function connectPeer() {
  return active
    ? { ok: true, online: true, code: active.code || "" }
    : { ok: false, reason: BACKEND_OFFLINE_REASON };
}

async function handshake(ws, role, payload) {
  const session = makeSession(ws);
  session.send({ type: role, ...payload });
  const hello = await new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), 4000);
    const onMsg = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data));
        if (msg.type === "hosted" || msg.type === "joined" || msg.type === "queued" || msg.type === "matched" || msg.type === "error") {
          clearTimeout(t);
          ws.removeEventListener("message", onMsg);
          resolve(msg);
        }
      } catch { /* ignore */ }
    };
    ws.addEventListener("message", onMsg);
  });
  if (!hello || hello.type === "error") {
    session.close();
    return {
      ok: false,
      reason: hello?.reason || BACKEND_OFFLINE_REASON,
      code: "",
      seed: null,
      peer: null
    };
  }
  session.code = hello.code || payload.code || "";
  session.seed = hello.seed ?? payload.seed ?? null;
  session.seat = hello.seat ?? (role === "join" ? 1 : 0);
  session.kind = hello.kind || payload.kind || "pvp";
  return {
    ok: true,
    code: session.code,
    seed: session.seed,
    seat: session.seat,
    kind: session.kind,
    waiting: hello.type === "queued",
    peer: session
  };
}

async function attach(role, payload) {
  disconnectPeer();
  let lastFail = BACKEND_OFFLINE_REASON;
  for (const url of duelWsCandidates()) {
    const ws = openSocket(url);
    if (!(await waitOpen(ws))) {
      try { ws?.close(); } catch { /* ignore */ }
      continue;
    }
    const result = await handshake(ws, role, payload);
    if (result.ok) {
      active = result.peer;
      return result;
    }
    lastFail = result.reason || lastFail;
  }
  return { ok: false, reason: lastFail, code: "", seed: null, peer: null };
}

export async function createAndHost(opts = {}) {
  const name = String(opts.name || "Host").slice(0, 24);
  const http = await createRoom(opts.seed, name);
  const seed = http?.seed ?? Math.floor(Math.random() * 2 ** 31);
  const code = formatRoomCode(http?.code || "");
  return attach("host", {
    code,
    seed,
    name,
    kind: opts.kind || "pvp",
    deck: opts.deck || [],
    extra: opts.extra || []
  });
}

export async function joinRoom(code, opts = {}) {
  return attach("join", {
    code: formatRoomCode(code),
    name: String(opts.name || "Guest").slice(0, 24),
    kind: opts.kind || "pvp",
    deck: opts.deck || [],
    extra: opts.extra || []
  });
}

export async function queueModePvp(kind, opts = {}) {
  return attach("queue", {
    kind: kind || "ranked",
    ranked: kind === "ranked",
    name: String(opts.name || "Duelist").slice(0, 24),
    deck: opts.deck || [],
    extra: opts.extra || []
  });
}

export async function queueRankedPvp(opts = {}) {
  return queueModePvp("ranked", opts);
}

export function serializePick(method, pick, args) {
  if (!args) args = [];
  if (pick == null) return null;
  if (method === "chooseMain" || method === "askAttack") {
    if (pick.type === "undo") return { type: "undo" };
    if (pick.type === "end") return { type: "end", zone: pick.zone == null ? null : pick.zone };
    if (method === "askAttack" && (pick.attackerUid != null || pick.targetUid !== undefined)) {
      return { type: "attack", attackerUid: pick.attackerUid, targetUid: pick.targetUid ?? null };
    }
    const actions = args[1] || [];
    let i = actions.indexOf(pick);
    if (i < 0) {
      i = actions.findIndex(function (a) {
        if (!a || a.type !== pick.type) return false;
        if (pick.card && a.card && a.card.uid !== pick.card.uid) return false;
        if (pick.fusion && a.fusion) {
          if (a.fusion.uid !== pick.fusion.uid && !(a.fusion.def && pick.fusion.def && a.fusion.def.id === pick.fusion.def.id)) return false;
        }
        return true;
      });
    }
    return {
      i: i,
      type: pick.type,
      zone: pick.zone == null ? null : pick.zone,
      tributeUids: Array.isArray(pick.tributeUids) ? pick.tributeUids : [],
      cardUid: pick.card && pick.card.uid,
      fusionUid: pick.fusion && pick.fusion.uid
    };
  }
  if (method === "askChain") return typeof pick === "number" ? pick : pick;
  if (method === "choose" || method === "askMulligan") {
    if (Array.isArray(pick)) return pick.map((x) => (x && x.uid != null ? x.uid : x));
    return pick;
  }
  if (method === "askComeback") return pick;
  return pick;
}

export function applyPick(method, packed, args) {
  if (!args) args = [];
  if (packed == null) {
    if (method === "chooseMain") return { type: "end" };
    if (method === "askMulligan" || method === "choose") return [];
    if (method === "askComeback") return "draw";
    if (method === "askAttack") return { type: "end" };
    return null;
  }
  if (method === "chooseMain" || method === "askAttack") {
    if (packed.type === "undo") return { type: "undo" };
    if (packed.type === "end") return { type: "end", zone: packed.zone == null ? null : packed.zone };
    if (packed.type === "attack") return { attackerUid: packed.attackerUid, targetUid: packed.targetUid ?? null };
    const actions = args[1] || [];
    let base = packed.i >= 0 ? actions[packed.i] : null;
    if (!base) {
      base = actions.find(function (a) {
        if (!a || a.type !== packed.type) return false;
        if (packed.cardUid != null && a.card && a.card.uid !== packed.cardUid) return false;
        if (packed.fusionUid != null && a.fusion && a.fusion.uid !== packed.fusionUid) return false;
        return true;
      });
    }
    if (!base) return { type: "end" };
    return Object.assign({}, base, {
      zone: packed.zone == null ? (base.zone == null ? null : base.zone) : packed.zone,
      tributeUids: packed.tributeUids || []
    });
  }
  return packed;
}

export function wrapIoPeer(io, opts = {}) {
  if (!io) return io;
  const localSeat = opts.localSeat === 1 ? 1 : 0;
  const send = typeof opts.send === "function" ? opts.send : () => {};
  const pullAction = typeof opts.pullAction === "function" ? opts.pullAction : async () => null;
  const methods = ["choose", "askChain", "chooseMain", "askAttack", "askMulligan", "askComeback"];
  for (const m of methods) {
    if (typeof io[m] !== "function") continue;
    const orig = io[m].bind(io);
    io[m] = async (player, ...rest) => {
      const args = [player, ...rest];
      if (player === localSeat) {
        const pick = await orig(player, ...rest);
        send({ type: "pick", method: m, player, packed: serializePick(m, pick, args) });
        return pick;
      }
      const packed = await pullAction(m, player);
      return applyPick(m, packed, args);
    };
  }
  return io;
}

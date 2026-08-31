// Phone-to-phone Host/Join when the optional backend is down (PeerJS broker + WebRTC).
import Peer from "peerjs";
import { makePushSession } from "./duelWire.js";

const PREFIX = "cbz";

export function p2pPeerId(code) {
  return PREFIX + String(code || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
}

function needsBuild(kind) {
  return kind === "draft" || kind === "sealed";
}

function parseMsg(raw) {
  if (raw && typeof raw === "object") return raw;
  try { return JSON.parse(String(raw)); } catch { return null; }
}

function waitPeerOpen(peer, ms = 10000) {
  return new Promise((resolve) => {
    if (peer.open) return resolve(true);
    const t = setTimeout(() => resolve(false), ms);
    peer.once("open", () => { clearTimeout(t); resolve(true); });
    peer.once("error", () => { clearTimeout(t); resolve(false); });
  });
}

function waitConnOpen(conn, ms = 10000) {
  return new Promise((resolve) => {
    if (conn.open) return resolve(true);
    const t = setTimeout(() => resolve(false), ms);
    conn.once("open", () => { clearTimeout(t); resolve(true); });
    conn.once("error", () => { clearTimeout(t); resolve(false); });
  });
}

function peerOpts() {
  return {
    debug: 0,
    config: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] }
  };
}

function bindConn(session, conn, peer) {
  conn.on("data", (d) => session.ingest(d));
  conn.on("close", () => session.markClosed());
  conn.on("error", () => session.markClosed());
  session.setSender((payload) => {
    if (!conn.open) return false;
    try {
      conn.send(typeof payload === "string" ? payload : JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  });
  session.setCloser(() => {
    try { conn.close(); } catch { /* ignore */ }
    try { peer.destroy(); } catch { /* ignore */ }
  });
}

function startPayload(room) {
  return {
    type: "start",
    kind: room.kind,
    code: room.code,
    seed: room.seed,
    host: { name: room.hostName, deck: room.hostDeck, extra: room.hostExtra },
    guest: { name: room.guestName, deck: room.guestDeck, extra: room.guestExtra }
  };
}

export async function hostP2p(opts = {}) {
  const code = String(opts.code || "").toUpperCase();
  if (code.length < 4) {
    return { ok: false, reason: "backend offline", code: "", seed: null, peer: null };
  }
  const kind = opts.kind || "pvp";
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  const peer = new Peer(p2pPeerId(code), peerOpts());
  const opened = await waitPeerOpen(peer);
  if (!opened) {
    try { peer.destroy(); } catch { /* ignore */ }
    return { ok: false, reason: "backend offline", code: "", seed: null, peer: null };
  }

  const session = makePushSession();
  session.code = code;
  session.seed = seed;
  session.seat = 0;
  session.kind = kind;
  session.setCloser(() => { try { peer.destroy(); } catch { /* ignore */ } });

  const room = {
    kind,
    code,
    seed,
    hostName: String(opts.name || "Host").slice(0, 24),
    hostDeck: Array.isArray(opts.deck) ? opts.deck : [],
    hostExtra: Array.isArray(opts.extra) ? opts.extra : [],
    guestName: "Guest",
    guestDeck: null,
    guestExtra: [],
    hostReady: !needsBuild(kind),
    guestReady: false
  };

  function emitStart(conn) {
    const payload = startPayload(room);
    try { conn.send(JSON.stringify(payload)); } catch { /* ignore */ }
    session.ingest(payload);
  }

  function maybeStart(conn) {
    if (!room.guestDeck) return;
    if (needsBuild(kind) && (!room.hostReady || !room.guestReady)) return;
    if (!needsBuild(kind) && !room.hostDeck.length) return;
    emitStart(conn);
  }

  peer.on("connection", (conn) => {
    bindConn(session, conn, peer);
    const origSend = session.send.bind(session);
    session.send = (payload) => {
      if (payload && payload.type === "ready") {
        room.hostReady = true;
        room.hostDeck = Array.isArray(payload.deck) ? payload.deck : room.hostDeck;
        room.hostExtra = Array.isArray(payload.extra) ? payload.extra : room.hostExtra;
        maybeStart(conn);
      }
      return origSend(payload);
    };
    conn.on("data", (raw) => {
      const msg = parseMsg(raw);
      if (!msg) return;
      if (msg.type === "join") {
        room.guestName = String(msg.name || "Guest").slice(0, 24);
        if (needsBuild(kind)) {
          const build = { type: "build", kind, seed, code };
          try { conn.send(JSON.stringify({ ...build, seat: 1 })); } catch { /* ignore */ }
          session.ingest({ ...build, seat: 0 });
        } else {
          room.guestDeck = Array.isArray(msg.deck) ? msg.deck : [];
          room.guestExtra = Array.isArray(msg.extra) ? msg.extra : [];
          maybeStart(conn);
        }
        return;
      }
      if (msg.type === "ready") {
        room.guestReady = true;
        room.guestDeck = Array.isArray(msg.deck) ? msg.deck : [];
        room.guestExtra = Array.isArray(msg.extra) ? msg.extra : [];
        maybeStart(conn);
      }
    });
  });

  return { ok: true, code, seed, seat: 0, kind, waiting: true, peer: session };
}

export async function joinP2p(opts = {}) {
  const code = String(opts.code || "").toUpperCase();
  if (code.length < 4) {
    return { ok: false, reason: "backend offline", code: "", seed: null, peer: null };
  }
  const peer = new Peer(undefined, peerOpts());
  const opened = await waitPeerOpen(peer);
  if (!opened) {
    try { peer.destroy(); } catch { /* ignore */ }
    return { ok: false, reason: "backend offline", code: "", seed: null, peer: null };
  }
  const conn = peer.connect(p2pPeerId(code), { reliable: true });
  if (!(await waitConnOpen(conn))) {
    try { peer.destroy(); } catch { /* ignore */ }
    return { ok: false, reason: "backend offline", code: "", seed: null, peer: null };
  }
  const session = makePushSession();
  session.code = code;
  session.seat = 1;
  session.kind = opts.kind || "pvp";
  bindConn(session, conn, peer);
  session.send({
    type: "join",
    code,
    name: String(opts.name || "Guest").slice(0, 24),
    kind: opts.kind || "pvp",
    deck: opts.deck || [],
    extra: opts.extra || []
  });
  return { ok: true, code, seed: null, seat: 1, kind: session.kind, peer: session };
}

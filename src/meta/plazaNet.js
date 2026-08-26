// MMO plaza presence. WebSocket to the optional backend; every call no-ops offline.

export const DEFAULT_PLAZA_URL = "ws://localhost:8787/plaza";

let ws = null;
const peerListeners = new Set();
let peers = [];
let selfId = null;

function ready() {
  return !!(ws && ws.readyState === 1);
}

function emitPeers() {
  for (const cb of peerListeners) {
    try { cb(peers); } catch { /* ignore */ }
  }
}

function send(payload) {
  if (!ready()) return false;
  try {
    ws.send(JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/** @returns {() => void} unsubscribe */
export function onPeers(cb) {
  if (typeof cb === "function") peerListeners.add(cb);
  cb?.(peers);
  return () => peerListeners.delete(cb);
}

export function connectPlaza(url = DEFAULT_PLAZA_URL) {
  return connect(url);
}

export function connect(url = DEFAULT_PLAZA_URL) {
  if (typeof WebSocket === "undefined") return { ok: false, online: false };
  try {
    if (ws) {
      try { ws.close(); } catch { /* ignore */ }
      ws = null;
    }
    const sock = new WebSocket(url);
    ws = sock;
    sock.onopen = () => {
      selfId = `p_${Math.random().toString(36).slice(2, 8)}`;
      send({ type: "hello", id: selfId, name: "Duelist" });
    };
    sock.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "peers" || Array.isArray(msg.peers)) {
          peers = (msg.peers || []).filter((p) => p.id !== selfId);
          emitPeers();
        } else if (msg.type === "chat") {
          window.dispatchEvent(new CustomEvent("cb-plaza-chat", { detail: msg }));
        }
      } catch { /* ignore */ }
    };
    sock.onerror = () => {};
    sock.onclose = () => {
      if (ws === sock) ws = null;
      peers = [];
      emitPeers();
    };
    return { ok: true, online: () => ready() };
  } catch {
    ws = null;
    return { ok: false, online: false };
  }
}

export function sendMove(x, z) {
  return send({ type: "move", x, z, id: selfId });
}

export function sendChat(msg) {
  const text = String(msg || "").slice(0, 240);
  if (!text) return false;
  return send({ type: "chat", msg: text, id: selfId });
}

export function disconnect() {
  if (!ws) return;
  try { ws.close(); } catch { /* ignore */ }
  ws = null;
}

export function isOnline() {
  return ready();
}

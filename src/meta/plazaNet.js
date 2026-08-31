// MMO plaza presence. WebSocket to the optional backend; every call no-ops offline.
import { backendCandidates } from "./backendClient.js";

export const DEFAULT_PLAZA_URL = "ws://localhost:8787/plaza";

let ws = null;
const peerListeners = new Set();
const chatListeners = new Set();
const inviteListeners = new Set();
let peers = [];
let selfId = null;
let displayName = "Duelist";

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

function plazaWsCandidates() {
  return backendCandidates().map((u) => u.replace(/^http/i, "ws") + "/plaza");
}

function plazaUrl() {
  return plazaWsCandidates()[0] || DEFAULT_PLAZA_URL;
}

/** @returns {() => void} unsubscribe */
export function onPeers(cb) {
  if (typeof cb === "function") peerListeners.add(cb);
  cb?.(peers);
  return () => peerListeners.delete(cb);
}

export function onPlazaChat(cb) {
  if (typeof cb === "function") chatListeners.add(cb);
  return () => chatListeners.delete(cb);
}

export function onPlazaInvite(cb) {
  if (typeof cb === "function") inviteListeners.add(cb);
  return () => inviteListeners.delete(cb);
}

export function connectPlaza(url = plazaUrl()) {
  return connect(url);
}

function bindPlazaSocket(sock) {
  sock.onopen = () => {
    selfId = `p_${Math.random().toString(36).slice(2, 8)}`;
    send({ type: "hello", id: selfId, name: displayName });
  };
  sock.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === "peers" || Array.isArray(msg.peers)) {
        peers = (msg.peers || []).filter((p) => p.id !== selfId);
        emitPeers();
      } else if (msg.type === "chat") {
        for (const cb of chatListeners) {
          try { cb(msg); } catch { /* ignore */ }
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("cb-plaza-chat", { detail: msg }));
        }
      } else if (msg.type === "invite") {
        for (const cb of inviteListeners) {
          try { cb(msg); } catch { /* ignore */ }
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("cb-plaza-invite", { detail: msg }));
        }
      }
    } catch { /* ignore */ }
  };
}

export function connect(url = plazaUrl()) {
  if (typeof WebSocket === "undefined") return { ok: false, online: false };
  try {
    if (ws) {
      try { ws.close(); } catch { /* ignore */ }
      ws = null;
    }
    const urls = url && url !== plazaUrl() ? [url] : plazaWsCandidates();
    let i = 0;
    const tryAt = () => {
      if (i >= urls.length) return;
      const target = urls[i++];
      let sock;
      try {
        sock = new WebSocket(target);
      } catch {
        tryAt();
        return;
      }
      ws = sock;
      bindPlazaSocket(sock);
      sock.onerror = () => {};
      sock.onclose = () => {
        if (ws === sock) {
          ws = null;
          peers = [];
          emitPeers();
          tryAt();
        }
      };
    };
    tryAt();
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

export function sendInvite(toId, code) {
  return send({ type: "invite", toId, code: String(code || "").toUpperCase().slice(0, 6) });
}

export function setPlazaName(name) {
  displayName = String(name || "Duelist").slice(0, 24);
  if (ready()) send({ type: "hello", id: selfId, name: displayName });
}

export function selfPlazaId() {
  return selfId;
}

export function disconnect() {
  const sock = ws;
  ws = null;
  if (!sock) return;
  try { sock.close(); } catch { /* ignore */ }
}

export function isOnline() {
  return ready();
}

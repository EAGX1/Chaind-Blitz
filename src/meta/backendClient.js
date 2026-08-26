/** Optional client for Wave O backend — all calls no-op / local fallback if offline. */

const DEFAULT_URL = "http://localhost:8787";

export function backendUrl() {
  return (typeof localStorage !== "undefined" && localStorage.getItem("cb-backend-url")) || DEFAULT_URL;
}

async function tryFetch(path, opts = {}) {
  try {
    const res = await fetch(`${backendUrl()}${path}`, {
      ...opts,
      headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function cloudPush(deviceId, profile) {
  return tryFetch("/v1/save", { method: "POST", body: JSON.stringify({ deviceId, profile }) });
}

export async function cloudPull(deviceId) {
  return tryFetch(`/v1/save/${encodeURIComponent(deviceId)}`);
}

export async function pushLeaderboard(board, name, score) {
  return tryFetch("/v1/leaderboard", {
    method: "POST",
    body: JSON.stringify({ board, name, score }),
  });
}

export async function fetchLeaderboard(board = "ranked") {
  return tryFetch(`/v1/leaderboard?board=${encodeURIComponent(board)}`);
}

export async function createRoom(seed, host) {
  return tryFetch("/v1/rooms", { method: "POST", body: JSON.stringify({ seed, host }) });
}

export async function fetchBanlist() {
  return tryFetch("/v1/banlist");
}

export async function sendTelemetry(payload) {
  if (!payload?.optIn) return null;
  return tryFetch("/v1/telemetry", { method: "POST", body: JSON.stringify(payload) });
}

export function deviceId() {
  const key = "cb-device-id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = `dev_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

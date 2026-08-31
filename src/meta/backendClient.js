/** Optional client for Wave O backend — all calls no-op / local fallback if offline. */

export const DEFAULT_URL = "http://localhost:8787";

/** Same-origin first (Vite proxy), then the optional :8787 process. */
export function backendCandidates() {
  const out = [];
  if (typeof localStorage !== "undefined") {
    const override = localStorage.getItem("cb-backend-url");
    if (override) out.push(String(override).replace(/\/$/, ""));
  }
  if (typeof location !== "undefined" && /^https?:$/.test(location.protocol || "")) {
    out.push(location.origin);
  }
  out.push(DEFAULT_URL);
  return [...new Set(out.filter(Boolean))];
}

export function backendUrl() {
  return backendCandidates()[0];
}

async function tryFetch(path, opts = {}) {
  for (const base of backendCandidates()) {
    try {
      const res = await fetch(`${base}${path}`, {
        ...opts,
        headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
      });
      if (!res.ok) continue;
      return await res.json();
    } catch {
      /* try next candidate */
    }
  }
  return null;
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

export async function fetchRoom(code) {
  return tryFetch(`/v1/rooms/${encodeURIComponent(String(code || "").toUpperCase())}`);
}

export async function pingBackend() {
  return tryFetch("/health");
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

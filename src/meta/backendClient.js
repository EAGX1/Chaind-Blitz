/** Optional client for Wave O backend — all calls no-op / local fallback if offline. */

export const DEFAULT_URL = "http://localhost:8787";

export function isStaticHost(url) {
  try {
    const u = new URL(url);
    return /\.github\.io$/i.test(u.hostname);
  } catch {
    return false;
  }
}

/** Same-origin first (Vite proxy), then the optional :8787 process. Skip GitHub Pages — it is not a backend. */
export function backendCandidates() {
  const out = [];
  if (typeof localStorage !== "undefined") {
    const override = localStorage.getItem("cb-backend-url");
    if (override) out.push(String(override).replace(/\/$/, ""));
  }
  const page = typeof location !== "undefined" && /^https?:$/.test(location.protocol || "")
    ? location.origin
    : "";
  if (page && !isStaticHost(page)) out.push(page);
  const onPages = page && isStaticHost(page);
  if (!onPages) out.push(DEFAULT_URL);
  return [...new Set(out.filter(Boolean))];
}

export function backendUrl() {
  return backendCandidates()[0];
}

const TOKEN_KEY = "cb-auth-token";
const NAME_KEY = "cb-auth-name";

export function authToken() {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function authName() {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(NAME_KEY) || "";
}

export function setAuth(token, name) {
  if (typeof localStorage === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
  if (name) localStorage.setItem(NAME_KEY, name);
  else localStorage.removeItem(NAME_KEY);
}

function headers(extra = {}) {
  const h = { "Content-Type": "application/json", ...extra };
  const tok = authToken();
  if (tok) h.Authorization = `Bearer ${tok}`;
  return h;
}

async function tryFetch(path, opts = {}) {
  for (const base of backendCandidates()) {
    try {
      const res = await fetch(`${base}${path}`, {
        ...opts,
        headers: headers(opts.headers || {}),
      });
      if (!res.ok) continue;
      return await res.json();
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

async function tryFetchStatus(path, opts = {}) {
  for (const base of backendCandidates()) {
    try {
      const res = await fetch(`${base}${path}`, {
        ...opts,
        headers: headers(opts.headers || {}),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) return { ok: true, ...body };
      return { ok: false, error: body.error || res.statusText };
    } catch {
      /* try next */
    }
  }
  return { ok: false, error: "backend offline" };
}

export async function registerAccount(name, password) {
  const out = await tryFetchStatus("/v1/register", {
    method: "POST",
    body: JSON.stringify({ name, password })
  });
  if (out.ok && out.token) setAuth(out.token, out.name);
  return out;
}

export async function loginAccount(name, password) {
  const out = await tryFetchStatus("/v1/login", {
    method: "POST",
    body: JSON.stringify({ name, password })
  });
  if (out.ok && out.token) setAuth(out.token, out.name);
  return out;
}

export async function logoutAccount() {
  await tryFetch("/v1/logout", { method: "POST", body: "{}" });
  setAuth("", "");
}

export async function fetchMe() {
  return tryFetch("/v1/me");
}

export function setBackendUrl(url) {
  if (typeof localStorage === "undefined") return;
  const v = String(url || "").replace(/\/$/, "");
  if (v) localStorage.setItem("cb-backend-url", v);
  else localStorage.removeItem("cb-backend-url");
}

export function savedBackendUrl() {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem("cb-backend-url") || "";
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

/** Last N play-history tiles from the engine log (TES / Hearthstone steal). */

const KEEP = new Set(["summon", "attack", "chain", "evolve", "negate", "set", "destroy", "draw"]);

export const LOG_FILTERS = [
  { id: "all", label: "All" },
  { id: "plays", label: "Plays" },
  { id: "combat", label: "Combat" },
  { id: "chain", label: "Chain" }
];

const PLAYS = new Set(["summon", "set", "evolve", "draw", "discard", "buff"]);
const COMBAT = new Set(["attack", "dmg", "destroy", "heal"]);
const CHAIN = new Set(["chain", "negate", "resolve", "miss"]);

export const LOG_FILTER_SESSION_KEY = "cb-log-filter";

const memFilter = { value: "all" };

export function normalizeLogFilter(id) {
  if (id === "plays" || id === "combat" || id === "chain") return id;
  return "all";
}

function sessionStore() {
  try {
    if (typeof sessionStorage !== "undefined") return sessionStorage;
  } catch { /* ignore */ }
  return null;
}

/** Last chip this browser session. Not a settings screen. Search is not saved. */
export function loadSessionLogFilter() {
  try {
    const s = sessionStore();
    if (s) return normalizeLogFilter(s.getItem(LOG_FILTER_SESSION_KEY));
  } catch { /* ignore */ }
  return normalizeLogFilter(memFilter.value);
}

export function saveSessionLogFilter(id) {
  const v = normalizeLogFilter(id);
  memFilter.value = v;
  try {
    sessionStore()?.setItem(LOG_FILTER_SESSION_KEY, v);
  } catch { /* ignore */ }
  return v;
}

/** Whether a log class is visible under a TES/MD-style filter. COPY LOG ignores this. */
export function logRowMatchesFilter(cls, filter) {
  const id = normalizeLogFilter(filter);
  if (id === "all") return true;
  const c = cls || "";
  if (id === "plays") return PLAYS.has(c);
  if (id === "combat") return COMBAT.has(c);
  if (id === "chain") return CHAIN.has(c);
  return true;
}

/** TES-style name search on the visible line. Empty query matches all. COPY LOG ignores this. */
export function logRowMatchesQuery(text, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  return String(text || "").toLowerCase().includes(q);
}

export function logRowIsVisible(cls, text, filter, query) {
  return logRowMatchesFilter(cls, filter) && logRowMatchesQuery(text, query);
}

export function lastPlayTiles(log, n = 6) {
  const all = (log || []).map((e, i) => ({ e, i }));
  const rows = all.filter(({ e }) => e && KEEP.has(e.cls));
  const src = rows.length ? rows : all.filter(({ e }) => e?.msg);
  return src.slice(-n).map(({ e, i }) => ({
    msg: String(e.msg || ""),
    cls: e.cls || "",
    t: e.t,
    phase: e.phase,
    i
  }));
}

export function logEntrySelector(i) {
  return `[data-log-i="${i}"]`;
}

/** Scroll and highlight a live log row. Not board rewind. */
export function highlightLogIndex(logEl, i) {
  if (!logEl) return false;
  logEl.querySelectorAll(".log-hl").forEach((n) => n.classList.remove("log-hl"));
  const row = logEl.querySelector(logEntrySelector(i));
  if (!row) return false;
  row.classList.add("log-hl");
  row.scrollIntoView({ block: "nearest" });
  return true;
}

export function shortenPlayMsg(msg, max = 42) {
  const s = String(msg || "").replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

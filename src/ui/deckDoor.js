/** Splinterlanes / Cockatrice: stop an illegal custom list at the door. Starters and loaners still launch. */

import { validateDeck, asSavedDeck, getBanlist, activeFormat } from "../meta/banlist.js";

export const RANKED_DECK_SESSION_KEY = "cb-ranked-deck";

const memToken = { value: "" };

function sessionStore() {
  try {
    if (typeof sessionStorage !== "undefined") return sessionStorage;
  } catch { /* ignore */ }
  return null;
}

export function parseDeckToken(value) {
  const s = String(value || "").trim();
  const i = s.indexOf(":");
  if (i < 0) return { kind: "starter", key: s || "ignis" };
  return { kind: s.slice(0, i), key: s.slice(i + 1) };
}

export function pickRankedToken({ loaners = [], starters = {}, customNames = [] } = {}) {
  const saved = loadSessionRankedToken();
  const known = new Set([
    ...loaners.map((s) => `loaner:${s.id}`),
    ...Object.values(starters).map((s) => `starter:${s.id}`),
    ...customNames.map((n) => `custom:${n}`)
  ]);
  if (saved && known.has(saved)) return saved;
  return "starter:ignis";
}

export function loadSessionRankedToken() {
  try {
    const s = sessionStore();
    if (s) return String(s.getItem(RANKED_DECK_SESSION_KEY) || memToken.value || "");
  } catch { /* ignore */ }
  return String(memToken.value || "");
}

export function saveSessionRankedToken(token) {
  const v = String(token || "");
  memToken.value = v;
  try {
    sessionStore()?.setItem(RANKED_DECK_SESSION_KEY, v);
  } catch { /* ignore */ }
  return v;
}

export function deckTokenOptionsHtml({ loaners = [], starters = {}, customNames = [] } = {}) {
  return [
    ...loaners.map((s) => `<option value="loaner:${s.id}">◆ ${s.name}</option>`),
    ...Object.values(starters).map((s) => `<option value="starter:${s.id}">★ ${s.name}</option>`),
    ...customNames.map((n) => `<option value="custom:${n}">${n} (custom)</option>`)
  ].join("");
}

export function customDoorError(main, extra, profile = null) {
  const bl = getBanlist(profile);
  const fmt = activeFormat(bl);
  const v = validateDeck({ main: main || [], extra: extra || [] }, fmt, bl);
  if (v.ok) return null;
  return v.errors[0] || "Deck is not legal.";
}

/**
 * @returns {{ ok: true, deck: string[], extra: string[], label: string, kind: string } | { ok: false, error: string }}
 */
export function tryQueueDeck(token, { starters = {}, loaners = [], decks = {}, profile = null, ranked = false } = {}) {
  const { kind, key } = parseDeckToken(token);
  if (kind === "loaner") {
    if (ranked) {
      return { ok: false, error: "Ranked is for your own collection — pick a starter or a custom list. Loaners cover Quick Duel and Labs." };
    }
    const L = (loaners || []).find((d) => d.id === key);
    if (!L) return { ok: false, error: "Unknown loaner." };
    return { ok: true, kind, deck: L.deck, extra: L.extra || [], label: String(L.name || key).toUpperCase() };
  }
  if (kind === "starter") {
    const S = starters[key];
    if (!S) return { ok: false, error: "Unknown starter." };
    return { ok: true, kind, deck: S.deck, extra: S.extra || [], label: String(S.name || key).toUpperCase() };
  }
  if (kind !== "custom") return { ok: false, error: "Pick a deck." };
  const raw = decks?.[key];
  if (raw == null) return { ok: false, error: "No custom deck with that name." };
  const saved = asSavedDeck(raw);
  const err = customDoorError(saved.main, saved.extra, profile);
  if (err) return { ok: false, error: err };
  return { ok: true, kind, deck: saved.main, extra: saved.extra, label: String(key).toUpperCase() };
}

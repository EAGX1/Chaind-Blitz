// Format legality. Copies: 0 = Forbidden, 1 / 2 = Limited, 3 = the normal playset.
// Dev Mode can retune any card. Live ops / cloud may overlay window.__CB_BANLIST.

export const FORMATS = ["Advanced", "Unlimited"];

export const DECK_SIZE = 40;
export const MAX_COPIES = 3;
export const EXTRA_MAX = 15;
export const COPY_OPTIONS = [0, 1, 2, 3];

/** Default Advanced — bombs only. Shipped loaners stay legal. */
export const ADVANCED_COPIES = {
  starfall: 1,
  lightning_tempest: 1,
  both_boards: 1,
  scream_home: 1,
  research_burn: 1,
  empty_sky: 1,
  tactic_choice: 1
};

export const PRESETS = {
  unlimited: { name: "Unlimited", copies: {} },
  advanced: { name: "Advanced", copies: { ...ADVANCED_COPIES } }
};

export const FORBIDDEN = Object.keys(ADVANCED_COPIES).filter((id) => ADVANCED_COPIES[id] === 0);
export const LIMITED = Object.fromEntries(
  Object.entries(ADVANCED_COPIES).filter(([, n]) => n === 1 || n === 2)
);

export function normalizeBanlist(raw = {}) {
  const copies = {};
  const src = raw.copies && typeof raw.copies === "object" ? raw.copies : null;
  if (src) {
    for (const [id, n] of Object.entries(src)) {
      const v = Number(n);
      if (!Number.isInteger(v) || v < 0 || v > MAX_COPIES) continue;
      if (v < MAX_COPIES) copies[id] = v;
    }
  } else {
    for (const id of raw.forbidden || []) copies[id] = 0;
    if (raw.limited && typeof raw.limited === "object") {
      for (const [id, n] of Object.entries(raw.limited)) {
        const v = Number(n);
        if (!Number.isInteger(v) || v < 0 || v >= MAX_COPIES) continue;
        copies[id] = v;
      }
    }
  }
  const preset = raw.preset === "unlimited" || raw.preset === "advanced" || raw.preset === "custom"
    ? raw.preset
    : (Object.keys(copies).length ? "custom" : "advanced");
  return { preset, copies };
}

export function banlistFromPreset(id) {
  if (id === "unlimited") return { preset: "unlimited", copies: {} };
  return { preset: "advanced", copies: { ...ADVANCED_COPIES } };
}

export function getBanlist(profile = null) {
  if (typeof window !== "undefined" && window.__CB_BANLIST) {
    return normalizeBanlist(window.__CB_BANLIST);
  }
  if (profile?.banlist) return normalizeBanlist(profile.banlist);
  return banlistFromPreset("advanced");
}

export function setCopyLimit(banlist, cardId, n) {
  const next = normalizeBanlist(banlist);
  const v = Math.max(0, Math.min(MAX_COPIES, Number(n)));
  if (v >= MAX_COPIES) delete next.copies[cardId];
  else next.copies[cardId] = v;
  next.preset = "custom";
  return next;
}

export function activeFormat(banlist = null) {
  const bl = banlist || getBanlist();
  return bl.preset === "unlimited" ? "Unlimited" : "Advanced";
}

export function isExtraCard(def) {
  return !!(def && def.type === "monster" && (def.summon === "fusion" || def.fusion));
}

export function copyLimit(cardId, format = "Advanced", banlist = null) {
  if (format !== "Advanced") return MAX_COPIES;
  const bl = banlist || getBanlist();
  if (Object.prototype.hasOwnProperty.call(bl.copies, cardId)) return bl.copies[cardId];
  return MAX_COPIES;
}

export function banlistSummary(banlist = null) {
  const bl = banlist || getBanlist();
  const forbidden = [];
  const limited = [];
  for (const [id, n] of Object.entries(bl.copies || {})) {
    if (n <= 0) forbidden.push(id);
    else limited.push(`${id}≤${n}`);
  }
  const bits = [];
  if (bl.preset === "unlimited") bits.push("Banlist: Unlimited (3 copies)");
  else if (!forbidden.length && !limited.length) bits.push("Banlist: Advanced (no extra limits)");
  else bits.push(`Banlist: ${bl.preset}`);
  if (forbidden.length) bits.push(`Forbidden (0): ${forbidden.join(", ")}`);
  if (limited.length) bits.push(`Limited: ${limited.join(", ")}`);
  return bits.join(" · ");
}

export function asSavedDeck(raw) {
  if (!raw) return { main: [], extra: [] };
  if (Array.isArray(raw)) return { main: raw.slice(), extra: [] };
  const main = Array.isArray(raw.main) ? raw.main.slice()
    : Array.isArray(raw.cards) ? raw.cards.slice()
    : Array.isArray(raw.deck) ? raw.deck.slice()
    : [];
  const extra = Array.isArray(raw.extra) ? raw.extra.slice() : [];
  return { main, extra };
}

function asLists(deck) {
  if (Array.isArray(deck)) {
    return { main: deck, extra: deck.extra || [] };
  }
  const saved = asSavedDeck(deck);
  return saved;
}

function countIds(ids) {
  const counts = {};
  for (const id of ids) counts[id] = (counts[id] || 0) + 1;
  return counts;
}

export function validateDeck(deck, format = "Advanced", banlist = null) {
  const fmt = FORMATS.includes(format) ? format : "Advanced";
  const { main, extra } = asLists(deck);
  const errors = [];
  const bl = banlist || getBanlist();

  if (main.length !== DECK_SIZE) {
    errors.push(`Main deck must be exactly ${DECK_SIZE} cards (${main.length}/${DECK_SIZE})`);
  }
  if (extra.length > EXTRA_MAX) {
    errors.push(`Extra Deck max ${EXTRA_MAX} cards (${extra.length}/${EXTRA_MAX})`);
  }

  const combined = countIds([...main, ...extra]);
  for (const [id, n] of Object.entries(combined)) {
    const cap = copyLimit(id, fmt, bl);
    if (cap <= 0) errors.push(`${id} is Forbidden (0 copies)`);
    else if (n > cap) errors.push(`${id}: ${n} copies, max ${cap}`);
  }

  return { ok: errors.length === 0, errors, format: fmt };
}

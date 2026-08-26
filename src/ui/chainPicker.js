/** Master Duel-style chain window copy. One click activates — no second Confirm. */

export function escapeChainHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

export function chainActSource(act) {
  if (act?.type === "set") return "Set";
  if (act?.type === "hand" || act?.type === "handQuick") return "Hand";
  return "Field";
}

export function lastChainCardName(chain) {
  return String(chain?.[chain.length - 1]?.card?.def?.name || "");
}

const DS_TITLE = {
  dsStart: "DAMAGE STEP · START — respond?",
  dsBefore: "DAMAGE STEP · BEFORE CALC — respond?",
  dsDuring: "DAMAGE STEP · DURING CALC — Surge etc.",
  dsAfter: "DAMAGE STEP · AFTER CALC — respond?",
  dsEnd: "DAMAGE STEP · END — respond?"
};

function namedActivateCopy(name, cl) {
  if (!name) {
    return {
      plain: `Chain another card or effect? · Chain Link ${cl}`,
      html: `<span class="chain-kw">Chain</span> another card or effect? · Chain Link ${cl}`
    };
  }
  return {
    plain: `The effect of '${name}' is activated. Chain another card or effect?`,
    html: `The effect of <span class="chain-name">'${escapeChainHtml(name)}'</span> is <span class="chain-kw">activated</span>. <span class="chain-kw">Chain</span> another card or effect?`
  };
}

function withPrefix(prefix, body) {
  if (!body) return { plain: prefix, html: null };
  return {
    plain: `${prefix} ${body.plain}`,
    html: `${escapeChainHtml(prefix)} ${body.html}`
  };
}

/** Sentence + optional HTML. Gold spans are our markup only. */
export function chainWindowTitle(chain, extra = {}) {
  const name = lastChainCardName(chain);
  const cl = (chain?.length || 0) + 1;
  const body = namedActivateCopy(name, cl);
  const ds = extra.damageStep;
  if (DS_TITLE[ds]) return name ? withPrefix(DS_TITLE[ds], body) : { plain: DS_TITLE[ds], html: null };
  if (extra.damageCalc) {
    const prefix = "DAMAGE CALCULATION — use an effect?";
    return name ? withPrefix(prefix, body) : { plain: prefix, html: null };
  }
  return body;
}

export function chainWindowHint() {
  return "Click a card face to chain · 1–9 · P pass · F until my turn — not a second Confirm";
}

export function chainLifoCaption() {
  return "Resolves last → first";
}

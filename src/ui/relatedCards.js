// Master Duel–style Related Cards: fusion recipes + Extra partners.

import { ALL_CARDS, CARD_DB } from "../data/cards/index.js";
import { LOANER_DECKS } from "../data/loaners.js";
import { STARTERS } from "../data/starters.js";

function extraPool() {
  return ALL_CARDS.filter((d) => d.fusion || d.summon === "fusion");
}

function materialLabel(spec, db = CARD_DB) {
  if (!spec) return "?";
  if (spec.kind === "id") return db[spec.id]?.name || spec.id;
  if (spec.kind === "name") return spec.name;
  if (spec.kind === "fusion") return "Fusion monster";
  if (spec.kind === "generic") {
    if (spec.label) return spec.label;
    const hits = ALL_CARDS.filter((d) => d.type === "monster" && spec.filter?.({ def: d, id: d.id }));
    const tribes = [...new Set(hits.map((d) => d.tribe).filter(Boolean))];
    if (tribes.length === 1) return `any ${tribes[0]}`;
    return "matching monster";
  }
  return "?";
}

export function recipeLines(def, db = CARD_DB) {
  return (def?.fusion?.recipes || []).map((r) =>
    (r.materials || []).map((spec) => materialLabel(spec, db)).join(" + ")
  );
}

/**
 * Cards related to `def`: named materials, fusions that list it, Extra in the
 * same starter/loaner, and same-tribe Extra. Cap 8.
 */
export function relatedCardsFor(def, db = CARD_DB) {
  if (!def) return [];
  const out = [];
  const seen = new Set([def.id]);
  const push = (id, why) => {
    if (!id || seen.has(id)) return;
    const d = db[id];
    if (!d) return;
    seen.add(id);
    out.push({ id, name: d.name, why, def: d });
  };

  for (const recipe of def.fusion?.recipes || []) {
    for (const spec of recipe.materials || []) {
      if (spec.kind === "id") push(spec.id, "Material");
    }
  }

  for (const extra of extraPool()) {
    for (const recipe of extra.fusion?.recipes || []) {
      if ((recipe.materials || []).some((m) => m.kind === "id" && m.id === def.id)) {
        push(extra.id, "Fuses into");
      }
    }
  }

  const lists = [
    ...Object.values(STARTERS || {}),
    ...Object.values(LOANER_DECKS || {})
  ];
  for (const list of lists) {
    const inMain = (list.deck || []).includes(def.id);
    const inExtra = (list.extra || []).includes(def.id);
    if (inMain) {
      for (const eid of list.extra || []) push(eid, "Loaner Extra");
    }
    if (inExtra) {
      for (const eid of list.extra || []) push(eid, "Extra partner");
    }
  }

  if (def.type === "monster" && def.tribe) {
    for (const extra of extraPool()) {
      if (extra.tribe === def.tribe) push(extra.id, "Extra partner");
    }
  }

  return out.slice(0, 8);
}

export function relatedInspectCard(def) {
  if (!def) return null;
  return { id: def.id, def, uid: `rel-${def.id}`, loc: "", dmg: 0, faceup: true };
}

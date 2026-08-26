/** Master Duel-style location pip: HAND / FIELD / GY / EX / BAN. */

export function locLabel(card) {
  const loc = card?.loc || "";
  if (loc === "hand") return "HAND";
  if (loc === "gy") return "GY";
  if (loc === "ban") return "BAN";
  if (loc === "extra") return "EX";
  if (loc === "mz" || loc === "stz") return "FIELD";
  if (loc === "deck") return "DECK";
  return loc ? String(loc).toUpperCase() : "";
}

export function paintLocPip(el, card) {
  if (!el || !card) return el;
  const label = locLabel(card);
  if (!label) return el;
  el.dataset.loc = card.loc || "";
  if (el.querySelector(".loc-pip")) return el;
  const pip = document.createElement("span");
  pip.className = `loc-pip loc-${card.loc || "field"}`;
  pip.textContent = label;
  pip.title = label;
  el.appendChild(pip);
  return el;
}

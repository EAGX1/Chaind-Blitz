/** Paint ATK vs remaining HP on the cards. Not a search. */

export function clearCombatOverlay() {
  document.querySelectorAll(".combat-fx").forEach((n) => n.remove());
  document.querySelectorAll(".combat-lethal, .combat-you-die").forEach((el) => {
    el.classList.remove("combat-lethal", "combat-you-die");
  });
}

function stamp(el, text, extraClass = "") {
  if (!el) return;
  el.querySelector(".combat-fx")?.remove();
  const n = document.createElement("div");
  n.className = `combat-fx ${extraClass}`.trim();
  n.textContent = text;
  el.appendChild(n);
}

/**
 * @param {HTMLElement | null} atkEl
 * @param {HTMLElement | null} foeEl
 * @param {{ kind?: string, aAtk?: number, dAtk?: number, theyDie?: boolean, youDie?: boolean, lethal?: boolean, face?: number }} prev
 * @param {{ lpId?: string }} [opts] Direct-attack LP stamp. Defaults to foe LP (lp-1).
 */
export function paintCombatOverlay(atkEl, foeEl, prev, opts = {}) {
  clearCombatOverlay();
  if (!prev) return;
  if (prev.kind === "direct") {
    stamp(atkEl, `→${prev.face ?? prev.aAtk}`, prev.lethal ? "lethal" : "");
    const lp = document.getElementById(opts.lpId || "lp-1");
    if (lp) stamp(lp, `-${prev.face ?? prev.aAtk}`, prev.lethal ? "lethal" : "");
    return;
  }
  if (atkEl) {
    stamp(atkEl, `-${prev.dAtk ?? 0}`, prev.youDie ? "lethal" : "");
    if (prev.youDie) atkEl.classList.add("combat-you-die");
  }
  if (foeEl) {
    stamp(foeEl, `-${prev.aAtk ?? 0}`, prev.theyDie ? "lethal" : "");
    if (prev.theyDie) foeEl.classList.add("combat-lethal");
  }
}

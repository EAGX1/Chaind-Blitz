/** VS CPU seat + rematch swap. Talishar / Dueling Nexus steal. */

export function parseDuelSeat(value) {
  const v = String(value ?? "random").trim().toLowerCase();
  if (v === "first" || v === "0") return 0;
  if (v === "second" || v === "1") return 1;
  return null;
}

export function swapDuelSides(sides = {}) {
  const youRaw = String(sides.youName || "YOU");
  const foeRaw = String(sides.foeName || "FOE");
  const youWasCpu = /\sCPU$/i.test(youRaw);
  const foeWasCpu = /\sCPU$/i.test(foeRaw);
  const you = youRaw.replace(/\s*CPU$/i, "").trim() || "YOU";
  const foe = foeRaw.replace(/\s*CPU$/i, "").trim() || "FOE";
  return {
    ...sides,
    deckYou: sides.deckFoe,
    deckFoe: sides.deckYou,
    extraYou: [...(sides.extraFoe || [])],
    extraFoe: [...(sides.extraYou || [])],
    youName: youWasCpu ? `${foe} CPU` : foe,
    foeName: foeWasCpu ? `${you} CPU` : you
  };
}

/** How many copies to push. Shift-click fills to cap; click adds one. */
export function copiesToAdd(have, cap, room = Infinity, { fill = false } = {}) {
  const need = Math.max(0, (Number(cap) || 0) - (Number(have) || 0));
  const space = room === Infinity ? need : Math.max(0, Number(room) || 0);
  const want = fill ? need : Math.min(1, need);
  return Math.min(want, space);
}

export function removeAllCopies(list, id) {
  return (list || []).filter((x) => x !== id);
}

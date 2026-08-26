/** Cards this seat has already seen. TES / Master Duel revealed-in-hand.
 * Not a cheat sheet of the whole foe hand. */

export function isPublicFace(card) {
  if (!card) return false;
  const loc = card.loc;
  if (loc === "gy" || loc === "ban") return true;
  if (loc === "mz" && card.faceup) return true;
  if (loc === "stz" && card.faceup) return true;
  return false;
}

export function harvestSeen(G, seen) {
  const out = seen instanceof Set ? seen : new Set(seen || []);
  for (const pl of G?.players || []) {
    for (const loc of ["mz", "stz", "gy", "ban"]) {
      for (const c of pl[loc] || []) {
        if (isPublicFace(c)) out.add(c.uid);
      }
    }
  }
  for (const link of G?.chain || []) {
    if (link?.card?.uid != null) out.add(link.card.uid);
  }
  return out;
}

export function handFaceUp(card, { revealAll = false, seen } = {}) {
  if (revealAll) return true;
  return !!(card && seen && seen.has(card.uid));
}

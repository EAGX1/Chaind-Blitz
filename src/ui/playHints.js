// Eternal / Master Duel steal: say why a card is dead without a shake-click.
import {
  cannotPlayReason, legalMainActions, LOCKED_SET_REASON, isLockedSetThisTurn
} from "../engine/game.js";
import { cannotAttackReason } from "../engine/state.js";

export { LOCKED_SET_REASON, isLockedSetThisTurn };

/** Why this hand card has no Main action, or null if it is playable / not your Main. */
export function handUnplayableReason(G, card) {
  if (!G || !card || card.loc !== "hand") return null;
  const p = card.controller;
  if (p !== G.tp) return null;
  if (G.phase !== "M1" && G.phase !== "M2") return null;
  const acts = legalMainActions(G, p);
  if (acts.some((a) => a.card && a.card.uid === card.uid)) return null;
  return cannotPlayReason(G, p, card);
}

/** Why this monster cannot declare an attack on your Battle Phase. */
export function battleUnplayableReason(G, card) {
  if (!G || !card || card.loc !== "mz") return null;
  if (G.phase !== "BP") return null;
  if (card.controller !== G.tp) return null;
  return cannotAttackReason(G, card);
}

export function playHintReason(G, card) {
  if (!G || !card) return null;
  if (isLockedSetThisTurn(G, card)) return LOCKED_SET_REASON;
  return handUnplayableReason(G, card) || battleUnplayableReason(G, card);
}

export function applyPlayHint(el, G, card) {
  if (!el) return null;
  const hiddenHand = el.classList.contains("card-back") && card?.loc === "hand";
  if (hiddenHand) {
    el.classList.remove("unplayable");
    return null;
  }
  const why = playHintReason(G, card);
  el.classList.toggle("unplayable", !!why);
  if (why) el.title = why;
  else el.removeAttribute("title");
  return why;
}

/** Extra inspector lines: locked Set copy and Main-hand play-why. */
export function inspectorPlayBits(G, card) {
  const bits = [];
  if (!card) return bits;
  if (isLockedSetThisTurn(G, card)) bits.push(LOCKED_SET_REASON);
  else if (card.setTurn && !card.faceup) bits.push(`SET T${card.setTurn}`);
  const why = handUnplayableReason(G, card);
  if (why) bits.push(why);
  return bits;
}

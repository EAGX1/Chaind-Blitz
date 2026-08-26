// Post-game face-up hands (OPTCG Sim). Not a live seen-set during the duel.

import { buildCardEl } from "./cardArt.js";

export function handNames(cards, cardDb) {
  return (cards || []).map((c) => {
    const def = (c?.def && typeof c.def === "object") ? c.def : cardDb?.[c?.id];
    return def?.name || c?.id || "?";
  });
}

export function revealedHands(G, cardDb) {
  return {
    you: handNames(G?.players?.[0]?.hand, cardDb),
    foe: handNames(G?.players?.[1]?.hand, cardDb)
  };
}

function paintSeat(host, cards, cardDb, label) {
  const cap = document.createElement("div");
  cap.className = "go-hands-label";
  cap.textContent = label;
  host.appendChild(cap);
  const row = document.createElement("div");
  row.className = "go-hands-row";
  const list = cards || [];
  if (!list.length) {
    const empty = document.createElement("span");
    empty.className = "dim";
    empty.textContent = "(empty)";
    row.appendChild(empty);
  } else {
    for (const c of list) {
      const def = (c.def && typeof c.def === "object") ? c.def : cardDb?.[c.id];
      row.appendChild(buildCardEl(def ? { ...c, def } : c, { tilt: false }));
    }
  }
  host.appendChild(row);
}

export function fillRevealedHands(host, G, cardDb, { youLabel = "Your hand", foeLabel = "CPU hand (revealed)" } = {}) {
  if (!host) return;
  host.innerHTML = "";
  if (!G?.players) {
    host.hidden = true;
    return;
  }
  host.hidden = false;
  const foe = document.createElement("div");
  const you = document.createElement("div");
  paintSeat(foe, G.players[1].hand, cardDb, foeLabel);
  paintSeat(you, G.players[0].hand, cardDb, youLabel);
  host.appendChild(foe);
  host.appendChild(you);
}

export function clearRevealedHands(host) {
  if (!host) return;
  host.innerHTML = "";
  host.hidden = true;
}

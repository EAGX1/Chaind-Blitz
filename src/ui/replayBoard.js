// Display-only board for the replay viewer. Applies recorded snapshots.
// Not live match undo and not Hearthstone Rewind of a running duel.

import { buildCardEl, cardBackEl } from "./cardArt.js";

function asView(c, cardDb) {
  if (!c) return null;
  const def = cardDb?.[c.id];
  return def ? { ...c, def } : c;
}

function paintHand(rowEl, cards, cardDb) {
  rowEl.innerHTML = "";
  for (const c of cards || []) {
    rowEl.appendChild(buildCardEl(asView(c, cardDb), { tilt: false }));
  }
  if (!(cards || []).length) {
    const empty = document.createElement("span");
    empty.className = "dim";
    empty.style.fontSize = "11px";
    empty.textContent = "(empty hand)";
    rowEl.appendChild(empty);
  }
}

function paintZones(rowEl, zones, cardDb, { stz = false } = {}) {
  rowEl.innerHTML = "";
  for (let z = 0; z < 6; z++) {
    const cell = document.createElement("div");
    cell.className = "replay-zone";
    const c = zones?.[z];
    if (c) {
      const faceDown = stz && !c.faceup;
      cell.appendChild(faceDown
        ? cardBackEl()
        : buildCardEl(asView(c, cardDb), { tilt: false }));
    }
    rowEl.appendChild(cell);
  }
}

export function paintReplayBoard(host, snap, cardDb) {
  if (!host) return;
  if (!snap?.players) {
    host.innerHTML = `<p class="dim" style="font-size:12px;margin:0;">No board snapshot at this step — action list only.</p>`;
    return;
  }
  const you = snap.players[0];
  const foe = snap.players[1];
  host.innerHTML = `
    <div class="replay-board">
      <div class="replay-hud dim">Foe LP ${foe.lp} · EP ${foe.ep} · T${snap.turnCount} ${snap.phase || ""}</div>
      <div class="replay-hand" data-side="1"></div>
      <div class="replay-zones" data-side="1" data-kind="stz"></div>
      <div class="replay-zones" data-side="1" data-kind="mz"></div>
      <div class="replay-mid dim">${snap.over ? "Duel over" : "Recorded board"} · hidden info shown</div>
      <div class="replay-zones" data-side="0" data-kind="mz"></div>
      <div class="replay-zones" data-side="0" data-kind="stz"></div>
      <div class="replay-hand" data-side="0"></div>
      <div class="replay-hud dim">You LP ${you.lp} · EP ${you.ep}</div>
    </div>
  `;
  paintHand(host.querySelector('[data-side="1"].replay-hand'), foe.hand, cardDb);
  paintZones(host.querySelector('[data-side="1"][data-kind="stz"]'), foe.stz, cardDb, { stz: true });
  paintZones(host.querySelector('[data-side="1"][data-kind="mz"]'), foe.mz, cardDb);
  paintZones(host.querySelector('[data-side="0"][data-kind="mz"]'), you.mz, cardDb);
  paintZones(host.querySelector('[data-side="0"][data-kind="stz"]'), you.stz, cardDb, { stz: true });
  paintHand(host.querySelector('[data-side="0"].replay-hand'), you.hand, cardDb);
}

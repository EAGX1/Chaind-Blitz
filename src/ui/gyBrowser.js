// Graveyard / Banished browser modal with click-to-inspect.

import { P } from "../engine/state.js";
import { buildCardEl, cardBackEl } from "./cardArt.js";

export function cardMatchesQuery(card, q) {
  const s = String(q || "").trim().toLowerCase();
  if (!s) return true;
  const def = (card?.def && typeof card.def === "object") ? card.def : card;
  return [def?.name, def?.id, def?.tribe, def?.text].some((x) => String(x || "").toLowerCase().includes(s));
}

/** GY / Banished are push-newest. Display newest first (EDOPro). */
export function gyNewestFirst(cards) {
  return [...(cards || [])].reverse();
}

export function gyOrderCaption() {
  return "Newest at top · oldest at bottom";
}

function listSection(title, cards, onInspect, { faceDown = false, caption } = {}) {
  const sec = document.createElement("div");
  sec.className = "gy-section";
  const h = document.createElement("h3");
  h.textContent = `${title} (${cards.length})`;
  sec.appendChild(h);
  if (caption) {
    const cap = document.createElement("p");
    cap.className = "dim gy-order-caption";
    cap.textContent = caption;
    cap.style.cssText = "margin:0 0 8px;font-size:11px;";
    sec.appendChild(cap);
  }
  const grid = document.createElement("div");
  grid.className = "gy-grid";
  if (!cards.length) {
    const empty = document.createElement("p");
    empty.className = "dim";
    empty.textContent = "Empty";
    grid.appendChild(empty);
  } else {
    for (const c of cards) {
      const el = faceDown ? cardBackEl() : buildCardEl(c);
      if (!faceDown) {
        el.style.cursor = "pointer";
        el.title = "Click to inspect";
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onInspect(c);
        });
      }
      grid.appendChild(el);
    }
  }
  sec.appendChild(grid);
  return sec;
}

function wireSearch(card, paint) {
  const input = document.createElement("input");
  input.type = "search";
  input.className = "cb-input";
  input.placeholder = "Search name / tribe / text";
  input.setAttribute("aria-label", "Filter cards");
  input.style.cssText = "width:100%;margin-top:10px;";
  const head = card.querySelector(".row");
  head?.after(input);
  input.addEventListener("input", () => paint(input.value));
  return input;
}

/**
 * Open a modal listing GY and Banished for `player` (0|1).
 * Click a card to show it in the inspect pane.
 * @returns {{ close: () => void }}
 */
export function openGyBrowser(G, player) {
  const pl = P(G, player);
  const gy = [...(pl.gy || [])];
  const ban = [...(pl.ban || [])];

  const modal = document.createElement("div");
  modal.className = "cb-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-label", "Graveyard & Banished");

  const card = document.createElement("div");
  card.className = "cb-modal-card wide";
  card.innerHTML = `
    <div class="row" style="justify-content:space-between;align-items:center;gap:12px;">
      <h2 style="margin:0">GY / BANISHED — P${player}</h2>
      <button type="button" class="cb-btn" data-gy-close>CLOSE</button>
    </div>
    <div class="gy-browser-body" style="display:grid;grid-template-columns:1fr minmax(140px,180px);gap:12px;margin-top:12px;">
      <div data-gy-lists></div>
      <aside data-gy-inspect class="inspector">
        <p class="dim">Click a card to inspect.</p>
      </aside>
    </div>
  `;
  modal.appendChild(card);
  document.body.appendChild(modal);

  const lists = card.querySelector("[data-gy-lists]");
  const inspect = card.querySelector("[data-gy-inspect]");

  function onInspect(c) {
    inspect.innerHTML = "";
    inspect.appendChild(buildCardEl(c));
  }

  function paint(q) {
    lists.innerHTML = "";
    lists.appendChild(listSection(
      "Graveyard",
      gyNewestFirst(gy.filter((c) => cardMatchesQuery(c, q))),
      onInspect,
      { caption: gyOrderCaption() }
    ));
    lists.appendChild(listSection(
      "Banished",
      gyNewestFirst(ban.filter((c) => cardMatchesQuery(c, q))),
      onInspect,
      { caption: gyOrderCaption() }
    ));
  }
  wireSearch(card, paint);
  paint("");

  function close() {
    modal.remove();
  }

  card.querySelector("[data-gy-close]").addEventListener("click", close);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });

  return { close };
}

/** Browse Extra Deck. Your extra is face-up; the foe's extra stays face-down. */
export function openExtraBrowser(G, player) {
  const pl = P(G, player);
  const extra = [...(pl.extra || [])];
  const faceDown = player !== 0;
  const who = player === 0 ? "YOU" : "FOE";

  const modal = document.createElement("div");
  modal.className = "cb-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-label", "Extra Deck");

  const card = document.createElement("div");
  card.className = "cb-modal-card wide";
  card.innerHTML = `
    <div class="row" style="justify-content:space-between;align-items:center;gap:12px;">
      <h2 style="margin:0">EXTRA DECK — ${who}</h2>
      <button type="button" class="cb-btn" data-gy-close>CLOSE</button>
    </div>
    <div class="gy-browser-body" style="display:grid;grid-template-columns:1fr minmax(140px,180px);gap:12px;margin-top:12px;">
      <div data-gy-lists></div>
      <aside data-gy-inspect class="inspector">
        <p class="dim">${faceDown ? "Face-down — you cannot inspect foe Extra." : "Click a card to inspect."}</p>
      </aside>
    </div>
  `;
  modal.appendChild(card);
  document.body.appendChild(modal);

  const lists = card.querySelector("[data-gy-lists]");
  const inspect = card.querySelector("[data-gy-inspect]");

  function onInspect(c) {
    inspect.innerHTML = "";
    inspect.appendChild(buildCardEl(c));
  }

  function paint(q) {
    lists.innerHTML = "";
    const shown = faceDown ? extra : extra.filter((c) => cardMatchesQuery(c, q));
    lists.appendChild(listSection("Extra Deck", shown, onInspect, { faceDown }));
  }
  if (!faceDown) wireSearch(card, paint);
  paint("");

  function close() {
    modal.remove();
  }

  card.querySelector("[data-gy-close]").addEventListener("click", close);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });

  return { close };
}

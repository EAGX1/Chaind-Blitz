// Modal replay viewer: action list + recorded board rewind + Play / Step.

import { importReplay, exportReplay, boardAt, hasBoardRewind, replayLogTiles, actionIndexForLogLine } from "../meta/replay.js";
import { CARD_DB } from "../data/cards/index.js";
import { paintReplayBoard } from "./replayBoard.js";

/** Clamp a skip on the viewer tile list (opening + actions). */
export function replaySkipIndex(index, delta, length) {
  if (!length) return 0;
  return Math.max(0, Math.min(length - 1, index + delta));
}

export function openReplayScrubber(json) {
  const data = importReplay(json);
  if (!data) {
    console.warn("replayScrubber: invalid replay");
    return null;
  }

  const actions = data.actions || [];
  const rewind = hasBoardRewind(data);
  const tiles = replayLogTiles(data);
  let index = Math.max(0, tiles.length - 1);
  let playing = false;
  let timer = null;

  const existing = document.getElementById("replay-scrubber-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "replay-scrubber-modal";
  modal.className = "cb-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-label", "Duel log");
  const caption = rewind
    ? "Full match log. Board rewind from recorded snapshots — not live match undo. Hidden info is shown. ← → skip."
    : "Full match log. History tiles — no board snapshots on this file. ← → skip.";
  modal.innerHTML = `
    <div class="cb-modal-card wide" style="width:min(720px,94vw);">
      <h2>Duel log</h2>
      <p class="dim" style="font-size:12px;margin:0 0 10px;">
        ${caption} Seed ${data.seed ?? "—"} · ${tiles.length} line${tiles.length === 1 ? "" : "s"}
      </p>
      <div id="replay-board-host" class="replay-board-host"></div>
      <div id="replay-action-list" style="max-height:280px;overflow:auto;border:1px solid var(--line,#2a3348);border-radius:8px;padding:6px;font-size:13px;"></div>
      <div class="row" style="margin-top:12px;align-items:center;gap:10px;flex-wrap:wrap;">
        <label class="dim" style="font-size:12px;">Scrub
          <input type="range" id="replay-scrub" min="0" max="${Math.max(0, tiles.length - 1)}" value="${index}" style="width:200px;vertical-align:middle;">
        </label>
        <span id="replay-index-label" class="dim" style="font-size:12px;"></span>
        <button type="button" class="cb-btn" id="replay-step">Step</button>
        <button type="button" class="cb-btn primary" id="replay-play">Play</button>
        <button type="button" class="cb-btn" id="replay-copy">Copy JSON</button>
        <button type="button" class="cb-btn" id="replay-dl">Download</button>
        <button type="button" class="cb-btn" id="replay-close">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const listEl = modal.querySelector("#replay-action-list");
  const boardHost = modal.querySelector("#replay-board-host");
  const scrub = modal.querySelector("#replay-scrub");
  const label = modal.querySelector("#replay-index-label");
  const playBtn = modal.querySelector("#replay-play");

  function actionIndex() {
    const tile = tiles[index];
    if (!tile) return -1;
    if (tile.kind === "log") return actionIndexForLogLine(data, tile.i);
    return tile.i;
  }

  function renderList() {
    listEl.innerHTML = tiles.length
      ? tiles.map((t, i) => {
        const active = i === index ? "background:rgba(245,197,66,.18);" : "";
        return `<div data-i="${i}" class="replay-tile" style="padding:8px 10px;cursor:pointer;border-radius:6px;margin-bottom:4px;border:1px solid var(--line,#2a3348);${active}">${t.label}</div>`;
      }).join("")
      : `<p class="dim">No actions recorded.</p>`;
    label.textContent = tiles.length ? `${index + 1} / ${tiles.length}` : "0 / 0";
    scrub.value = String(index);
    const activeRow = listEl.querySelector(`[data-i="${index}"]`);
    activeRow?.scrollIntoView({ block: "nearest" });
    paintReplayBoard(boardHost, boardAt(data, actionIndex()), CARD_DB);
  }

  function setIndex(i) {
    if (!tiles.length) { index = 0; renderList(); return; }
    index = Math.max(0, Math.min(tiles.length - 1, i));
    renderList();
  }

  function stopPlay() {
    playing = false;
    if (timer) { clearInterval(timer); timer = null; }
    playBtn.textContent = "Play";
  }

  listEl.addEventListener("click", (e) => {
    const row = e.target.closest("[data-i]");
    if (!row) return;
    stopPlay();
    setIndex(Number(row.dataset.i));
  });
  scrub.addEventListener("input", () => {
    stopPlay();
    setIndex(Number(scrub.value));
  });
  modal.querySelector("#replay-step").addEventListener("click", () => {
    stopPlay();
    if (!tiles.length) return;
    setIndex(index >= tiles.length - 1 ? 0 : index + 1);
  });
  playBtn.addEventListener("click", () => {
    if (playing) { stopPlay(); return; }
    if (!tiles.length) return;
    playing = true;
    playBtn.textContent = "Pause";
    timer = setInterval(() => {
      if (index >= tiles.length - 1) { stopPlay(); return; }
      setIndex(index + 1);
    }, 400);
  });
  modal.querySelector("#replay-copy")?.addEventListener("click", async () => {
    const raw = exportReplay(data);
    try {
      await navigator.clipboard.writeText(raw);
      modal.querySelector("#replay-copy").textContent = "Copied";
    } catch {
      modal.querySelector("#replay-copy").textContent = "Copy failed";
    }
    setTimeout(() => {
      const b = modal.querySelector("#replay-copy");
      if (b) b.textContent = "Copy JSON";
    }, 1400);
  });
  modal.querySelector("#replay-dl")?.addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([exportReplay(data)], { type: "application/json" }));
    a.download = "chaind-blitz-replay.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 500);
  });
  modal.querySelector("#replay-close").addEventListener("click", close);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });
  function onKey(e) {
    if (!document.body.contains(modal)) return;
    if (e.target?.closest?.("textarea, [contenteditable]")) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      stopPlay();
      setIndex(replaySkipIndex(index, -1, tiles.length));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      stopPlay();
      setIndex(replaySkipIndex(index, 1, tiles.length));
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  }
  window.addEventListener("keydown", onKey);
  function close() {
    stopPlay();
    window.removeEventListener("keydown", onKey);
    modal.remove();
  }

  renderList();
  return modal;
}

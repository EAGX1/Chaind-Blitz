// Human decision provider: renders the engine's questions into clickable UI.
// Every method returns a Promise resolved by the player's clicks.

import { sfx } from "./fx.js";
import { shouldPromptChain } from "./chainPrompt.js";
import { chainWindowTitle, chainWindowHint, chainActSource } from "./chainPicker.js";
import { lockedMzZones, lockedStzZones, freeMz, cannotPlayReason, LOCKED_SET_REASON, isLockedSetThisTurn } from "../engine/game.js";
import { monstersOf, cardByUid, cannotAttackReason, previewCombat } from "../engine/state.js";
import { buildCardEl } from "./cardArt.js";
import { openPauseMenu } from "./pauseMenu.js";
import { showAttackArrow, showAttackArrows, clearAttackArrows, chainLinkEls } from "./attackArrows.js";
import { loadSettings } from "./settingsStore.js";
import { rankFieldActions, promptBarActs } from "./actionRank.js";
import { confirmDialog } from "./confirmDialog.js";
import { paintLocPip } from "./locPip.js";
import { paintCombatOverlay, clearCombatOverlay } from "./combatOverlay.js";
import { openMulliganStage, closeMulliganStage } from "./mulliganStage.js";
import { shouldConfirmEndMain, shouldConfirmEndBattle, unusedPlayCount, unusedEndBody } from "./unusedEnd.js";
import { hideCardHover } from "./cardHover.js";
import {
  watchDrag, clearDragUi, actForZoneDrop, actForBoardDrop, attackFromDrop, zoneKindForType
} from "./dragPlay.js";
import { isTeachDuel, teachRecommended, teachAttackHint, teachChainHint } from "./teachDuel.js";

const $ = (id) => document.getElementById(id);

let pauseWired = false;
let pauseHandle = null;
let activeIo = null;
let choiceForced = false;

function inDuel() {
  const duel = $("screen-duel");
  return duel && !duel.classList.contains("hidden");
}

function concedeViaCurrentG(io) {
  const g = window.__CB?.currentG;
  if (g && !g.over) {
    g.over = true;
    g.winner = 1;
    g.winReason = "You conceded.";
  }
  io?.cancelPending?.();
}

/** Esc always pauses in a duel — including a forced chain. Concede stays on the pause menu. */
export function escPauseAction({ inDuel, pauseOpen, inField } = {}) {
  if (inField || !inDuel) return null;
  if (pauseOpen) return "close";
  return "open";
}

function ensurePauseKeys() {
  if (pauseWired) return;
  pauseWired = true;
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || e.repeat) return;
    const inField = !!e.target?.closest?.("input, textarea, select, [contenteditable]");
    const act = escPauseAction({
      inDuel: inDuel(),
      pauseOpen: !!pauseHandle,
      inField
    });
    if (!act || !activeIo) return;
    e.preventDefault();
    if (act === "close") {
      pauseHandle.close();
      pauseHandle = null;
      return;
    }
    pauseHandle = openPauseMenu({
      onResume() { pauseHandle = null; },
      async onConcede() {
        pauseHandle = null;
        const ok = await confirmDialog({
          title: "Concede?",
          body: "This ends the duel as a loss.",
          confirm: "CONCEDE",
          cancel: "KEEP PLAYING",
          danger: true
        });
        if (ok) concedeViaCurrentG(activeIo);
      },
      onRulebook() {
        pauseHandle = null;
        window.dispatchEvent(new CustomEvent("cb-open-glossary"));
      },
      onSettings() {
        pauseHandle = null;
        window.dispatchEvent(new CustomEvent("cb-open-settings"));
      }
    });
  });
}

export function makeHumanIo(G, view) {
  let pendingCancel = null;
  ensurePauseKeys();
  // card elements persist across renders now, so prompt-bound click handlers
  // must be tracked and removed explicitly or they'd accumulate/fire twice
  const bound = [];
  const keyBound = [];
  function bind(el, fn) { el.addEventListener("click", fn); bound.push([el, "click", fn]); }
  function bindEv(el, type, fn) { el.addEventListener(type, fn); bound.push([el, type, fn]); }
  function onKey(fn) {
    const wrap = (e) => {
      if (e.repeat) return;
      if (e.target?.closest?.("input, textarea, select, [contenteditable]")) return;
      if (pauseHandle) return;
      if (document.querySelector(".cb-modal")) return;
      if (document.body?.classList?.contains("cb-dragging")) return;
      fn(e);
    };
    window.addEventListener("keydown", wrap);
    keyBound.push(wrap);
  }
  function unbindAll() {
    for (const [el, type, fn] of bound) el.removeEventListener(type, fn);
    bound.length = 0;
    for (const fn of keyBound) window.removeEventListener("keydown", fn);
    keyBound.length = 0;
    $("phase-orb")?.classList.remove("clickable");
    clearCombatOverlay();
  }
  function digitIndex(e) {
    if (e.key >= "1" && e.key <= "9") return Number(e.key) - 1;
    return -1;
  }
  function choiceRange(req) {
    const min = Number.isFinite(+req.min) ? Math.max(0, +req.min) : 0;
    let max = Number.isFinite(+req.max) ? +req.max : min;
    if (max < min) max = min;
    return { min, max };
  }
  function paintKb(els, i) {
    els.forEach((el, n) => el.classList.toggle("kb-focus", n === i));
  }
  function bindCycleKeys(els, { onEnd, onBack, onUndo } = {}) {
    let focus = 0;
    if (els.length) paintKb(els, focus);
    onKey((e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "Tab") {
        e.preventDefault();
        if (!els.length) return;
        focus = (focus + 1) % els.length;
        paintKb(els, focus);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!els.length) return;
        focus = (focus - 1 + els.length) % els.length;
        paintKb(els, focus);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        els[focus]?.click();
      } else if ((e.key === "e" || e.key === "E") && onEnd) {
        e.preventDefault();
        onEnd();
      } else if ((e.key === "u" || e.key === "U") && onUndo) {
        e.preventDefault();
        onUndo();
      } else if ((e.key === "Backspace" || e.key === "b" || e.key === "B") && onBack) {
        e.preventDefault();
        onBack();
      } else {
        const i = digitIndex(e);
        if (i >= 0 && els[i]) {
          e.preventDefault();
          focus = i;
          paintKb(els, focus);
          els[i].click();
        }
      }
    });
  }

  function promptShell(title, { forced = false, html = false, chainWindow = false } = {}) {
    unbindAll();
    choiceForced = forced;
    const bar = $("prompt");
    bar.classList.remove("hidden");
    bar.classList.toggle("chain-window", !!chainWindow);
    if (chainWindow) ensureChainChrome(bar);
    else bar.querySelector(".chain-chrome")?.remove();
    const titleEl = $("prompt-title");
    if (html) titleEl.innerHTML = title;
    else titleEl.textContent = title;
    const opts = $("prompt-options");
    opts.innerHTML = "";
    return opts;
  }
  function ensureChainChrome(bar) {
    if (bar.querySelector(".chain-chrome")) return;
    const chrome = document.createElement("div");
    chrome.className = "chain-chrome";
    chrome.setAttribute("aria-hidden", "true");
    chrome.innerHTML = '<span class="cl tl"></span><span class="cl tr"></span><span class="cl bl"></span><span class="cl br"></span>';
    bar.prepend(chrome);
  }
  function hidePrompt() {
    unbindAll();
    choiceForced = false;
    const bar = $("prompt");
    bar.classList.add("hidden");
    bar.classList.remove("chain-window");
    bar.querySelector(".chain-chrome")?.remove();
    $("prompt-title").textContent = "";
    $("prompt-options").innerHTML = "";
    clearHighlights();
    closeMulliganStage();
    clearCombatOverlay();
    clearDragUi();
    clearAttackArrows();
  }
  function clearHighlights() {
    document.querySelectorAll(".selectable, .selected, .target-hl, .target-hl-enemy, .zone-selectable, .kb-focus, .target-illegal, .combat-lethal, .combat-you-die, .chain-source, .chain-legal, .teach-next")
      .forEach((el) => el.classList.remove("selectable", "selected", "target-hl", "target-hl-enemy", "zone-selectable", "kb-focus", "target-illegal", "combat-lethal", "combat-you-die", "chain-source", "chain-legal", "teach-next"));
  }
  function btn(label, cls = "") {
    const b = document.createElement("button");
    b.className = `prompt-btn ${cls}`;
    b.textContent = label;
    return b;
  }
  const elByUid = (uid) => document.querySelector(
    `#hand-0 [data-uid="${uid}"], #hand-1 [data-uid="${uid}"], #mz-0 [data-uid="${uid}"], #mz-1 [data-uid="${uid}"], #stz-0 [data-uid="${uid}"], #stz-1 [data-uid="${uid}"], [data-uid="${uid}"]`
  );

  /* ---------- zone picking (player chooses where their card goes) ---------- */
  function zoneKindFor(act) {
    if (act.type === "summon" || act.type === "ambushSet" || act.type === "contactFusion") return "mz";
    if (act.type === "set") return "stz";
    if (act.type === "activate" && act.card?.def?.spell?.subtype === "continuous") return "stz";
    return null;
  }
  function freeZoneIdxs(kind, p, extraUids = []) {
    const pl = G.players[p];
    const out = [];
    const locked = kind === "mz" ? lockedMzZones(G, p) : lockedStzZones(G, p);
    const extraZones = new Set();
    if (kind === "mz") {
      for (const uid of extraUids) {
        const m = pl.mz.find((c) => c && c.uid === uid);
        if (m) extraZones.add(m.zone);
      }
    }
    for (let z = 0; z < 6; z++) {
      if (locked.includes(z)) continue;
      if (!pl[kind][z] || extraZones.has(z)) out.push(z);
    }
    return out;
  }
  function laneHint(z) {
    const li = z < 2 ? 0 : z < 4 ? 1 : 2;
    const lane = G.lanes[li];
    if (!lane) return `Lane ${li + 1}`;
    return lane.revealed ? lane.def.name : `Lane ${li + 1}`;
  }
  function pickZone(kind, p, cardName, onPick, onBack, extraUids = []) {
    const opts = promptShell(`${cardName} — glowing ${kind === "mz" ? "MONSTER" : "SPELL"} zone · 1–6, B back`, { forced: true });
    const zoneEls = [];
    const zones = freeZoneIdxs(kind, p, extraUids);
    for (const z of zones) {
      const el = document.querySelector(`[data-zone="${kind}-${p}-${z}"]`);
      if (!el) continue;
      el.classList.add("zone-selectable");
      el.dataset.lane = laneHint(z);
      el.title = laneHint(z);
      el.style.pointerEvents = "auto";
      bind(el, () => { sfx.click(); onPick(z); });
      zoneEls.push(el);
    }
    const back = btn("BACK", "pass");
    back.addEventListener("click", () => { sfx.click(); onBack(); });
    opts.appendChild(back);
    bindCycleKeys(zoneEls, { onBack });
  }

  function cancellable(resolve, defaultValue) {
    pendingCancel = () => { cleanupAll(); resolve(defaultValue); };
  }
  function cleanupAll() {
    hidePrompt();
    pendingCancel = null;
  }

  function denyReason(card, p) {
    return cannotPlayReason(G, p, card);
  }

  function denyShake(el, why) {
    if (!el) return;
    sfx.negate();
    el.classList.remove("shake");
    void el.offsetWidth;
    el.classList.add("shake");
    const title = $("prompt-title");
    if (title) title.textContent = why;
  }

  /* ---------- generic card selection (targets, discards, costs) ---------- */
  function selectCardsUi(req) {
    return new Promise((resolve) => {
      const { min, max } = choiceRange(req);
      const opts = promptShell(req.title || "Choose cards", { forced: min > 0 });
      const picked = new Set();
      const srcEl = req.sourceUid != null ? elByUid(req.sourceUid) : null;
      const paintTargetArrows = (hoverUid) => {
        if (!srcEl) return;
        const ids = [...picked];
        if (hoverUid != null && !picked.has(hoverUid)) ids.push(hoverUid);
        showAttackArrows(srcEl, ids.map((id) => elByUid(id)).filter(Boolean));
      };
      const confirm = btn("CONFIRM", "confirm");
      confirm.disabled = true;
      const refresh = () => {
        confirm.disabled = !(picked.size >= min && picked.size <= max);
        paintTargetArrows();
      };
      const toggle = (uid, el) => {
        sfx.click();
        if (picked.has(uid)) { picked.delete(uid); el.classList.remove("selected"); }
        else if (picked.size < max) { picked.add(uid); el.classList.add("selected"); }
        refresh();
      };
      const missing = [];
      for (const uid of req.uids || []) {
        const el = elByUid(uid);
        if (!el) { missing.push(uid); continue; }
        el.classList.add("selectable");
        const live = cardByUid(G, uid);
        if (live) paintLocPip(el, live);
        bind(el, () => toggle(uid, el));
        bindEv(el, "mouseenter", () => paintTargetArrows(uid));
        bindEv(el, "mouseleave", () => paintTargetArrows());
      }
      const listEls = [];
      if (missing.length) {
        const grid = document.createElement("div");
        grid.className = "card-list-picker";
        grid.setAttribute("aria-label", "Card list");
        missing.forEach((uid) => {
          const card = cardByUid(G, uid);
          const label = req.options?.[req.uids.indexOf(uid)] || card?.def?.name || `#${uid}`;
          const el = card ? buildCardEl(card) : btn(label);
          el.classList.add("selectable");
          el.title = label;
          if (card) paintLocPip(el, card);
          bind(el, () => toggle(uid, el));
          bindEv(el, "mouseenter", () => paintTargetArrows(uid));
          bindEv(el, "mouseleave", () => paintTargetArrows());
          grid.appendChild(el);
          listEls.push(el);
        });
        opts.appendChild(grid);
      }
      confirm.addEventListener("click", () => {
        const idxs = (req.uids || []).map((u, i) => i).filter((i) => picked.has(req.uids[i]));
        cleanupAll();
        resolve(idxs.slice(0, max));
      });
      opts.appendChild(confirm);
      if (min === 0) {
        const skip = btn("SKIP", "pass");
        skip.addEventListener("click", () => { cleanupAll(); resolve([]); });
        opts.appendChild(skip);
        cancellable(resolve, []);
      }
      refresh();
      const pickEls = [...(req.uids || []).map((uid) => elByUid(uid)).filter(Boolean), ...listEls];
      onKey((e) => {
        const i = digitIndex(e);
        if (i >= 0 && pickEls[i]) { e.preventDefault(); pickEls[i].click(); }
        else if (e.key === "Enter") { e.preventDefault(); if (!confirm.disabled) confirm.click(); }
      });
    });
  }

  /* ---------- ordered selection (SEGOC trigger ordering) ---------- */
  function orderUi(req) {
    return new Promise((resolve) => {
      const { min, max } = choiceRange(req);
      const opts = promptShell(req.title || "Choose in order", { forced: min > 0 });
      const order = [];
      const buttons = req.options.map((label, i) => {
        const b = btn(label);
        b.addEventListener("click", () => {
          sfx.click();
          const at = order.indexOf(i);
          if (at >= 0) { order.splice(at, 1); b.textContent = label; b.classList.remove("confirm"); }
          else if (order.length < max) { order.push(i); b.textContent = `${order.length}. ${label}`; b.classList.add("confirm"); }
          refresh();
        });
        return b;
      });
      const confirm = btn("CONFIRM", "confirm");
      const refresh = () => {
        confirm.disabled = !(order.length >= min && order.length <= max);
        if (min === 0 && order.length === 0) confirm.disabled = false;
      };
      confirm.addEventListener("click", () => { cleanupAll(); resolve(order.slice(0, max)); });
      buttons.forEach((b) => opts.appendChild(b));
      opts.appendChild(confirm);
      if (min === 0) cancellable(resolve, []);
      refresh();
      onKey((e) => {
        const i = digitIndex(e);
        if (i >= 0 && buttons[i]) { e.preventDefault(); buttons[i].click(); }
        else if (e.key === "Enter") { e.preventDefault(); if (!confirm.disabled) confirm.click(); }
      });
    });
  }

  function pickOneUi(req) {
    return new Promise((resolve) => {
      const opts = promptShell(req.title || "Choose", { forced: true });
      (req.options || []).forEach((label, i) => {
        const b = btn(label);
        b.addEventListener("click", () => { sfx.click(); cleanupAll(); resolve([i]); });
        opts.appendChild(b);
      });
      cancellable(resolve, [0]);
      const oneBtns = [...opts.querySelectorAll(".prompt-btn")];
      onKey((e) => {
        const i = digitIndex(e);
        if (i >= 0 && oneBtns[i]) { e.preventDefault(); oneBtns[i].click(); }
      });
    });
  }

  const api = {
    onLog: () => {},

    async choose(p, req) {
      if (req.kind === "triggerOrder") return orderUi(req);
      if (req.kind === "gyFusion") return pickOneUi(req);
      if (req.uids) return selectCardsUi(req);
      return orderUi(req); // option-list fallback
    },

    async askChain(p, legal, chain, extra) {
      if (G._passUntilMyTurn && G.tp !== p) return null;
      const mode = loadSettings()?.chainMode || "smart";
      if (!shouldPromptChain(mode, p, legal, chain, extra)) return null;
      return new Promise((resolve) => {
        const copy = chainWindowTitle(chain, extra);
        const opts = promptShell(copy.html || copy.plain, {
          forced: true,
          html: !!copy.html,
          chainWindow: true
        });
        const hint = document.createElement("p");
        hint.className = "dim chain-window-hint";
        hint.textContent = chainWindowHint();
        opts.appendChild(hint);

        const last = chain?.[chain.length - 1]?.card;
        if (last) elByUid(last.uid)?.classList.add("chain-source");

        const tray = document.createElement("div");
        tray.className = "chain-face-tray";
        const chainBtns = [];
        const showArrowsFrom = (act) => {
          const from = elByUid(act.card.uid);
          const toEls = chainLinkEls(chain, elByUid);
          if (from && toEls.length) showAttackArrows(from, toEls);
          else if (from) {
            const fallback = $("chain-popup");
            if (fallback) showAttackArrow(from, fallback);
          }
        };
        legal.forEach((act, i) => {
          const d = act.card.def;
          const src = chainActSource(act);
          const boardEl = elByUid(act.card.uid);
          if (boardEl) {
            boardEl.classList.add("chain-legal", "selectable");
            bind(boardEl, () => { sfx.click(); cleanupAll(); resolve(i); });
            bindEv(boardEl, "mouseenter", () => showArrowsFrom(act));
            bindEv(boardEl, "mouseleave", () => clearAttackArrows());
          }
          const wrap = document.createElement("button");
          wrap.type = "button";
          wrap.className = "chain-face";
          wrap.title = `${d.name} · SS${act.speed} · ${src}`;
          wrap.setAttribute("aria-label", `Chain ${d.name}, spell speed ${act.speed}, ${src}`);
          const face = buildCardEl(act.card, { tilt: false });
          face.style.setProperty("--cw", "92px");
          wrap.appendChild(face);
          const cap = document.createElement("span");
          cap.className = "chain-face-cap";
          cap.textContent = `${i + 1} · ${src} · SS${act.speed}`;
          wrap.appendChild(cap);
          wrap.addEventListener("click", () => { sfx.click(); cleanupAll(); resolve(i); });
          wrap.addEventListener("mouseenter", () => showArrowsFrom(act));
          wrap.addEventListener("mouseleave", () => clearAttackArrows());
          tray.appendChild(wrap);
          chainBtns.push(wrap);
        });
        const rec = teachChainHint(G, legal);
        if (rec) {
          elByUid(rec.card.uid)?.classList.add("teach-next");
          const idx = legal.indexOf(rec);
          if (idx >= 0) chainBtns[idx]?.classList.add("teach-next");
        }
        opts.appendChild(tray);
        const row = document.createElement("div");
        row.className = "chain-pass-row";
        const pass = btn("PASS", "pass");
        pass.addEventListener("click", () => { sfx.click(); cleanupAll(); resolve(null); });
        row.appendChild(pass);
        const hold = btn("PASS UNTIL MY TURN (F)");
        hold.title = "Skip optional responses until your next turn. Not AI Pilot.";
        hold.addEventListener("click", () => {
          sfx.click();
          G._passUntilMyTurn = true;
          cleanupAll();
          resolve(null);
        });
        row.appendChild(hold);
        opts.appendChild(row);
        cancellable(resolve, null);
        onKey((e) => {
          const i = digitIndex(e);
          if (i >= 0 && chainBtns[i]) { e.preventDefault(); chainBtns[i].click(); }
          else if (e.key === "f" || e.key === "F") {
            e.preventDefault();
            hold.click();
          } else if (e.key === "p" || e.key === "P" || e.key === " ") {
            e.preventDefault();
            pass.click();
          }
        });
      });
    },

    async chooseMain(p, actions) {
      return new Promise((resolve) => {
        if (p === 0) G._passUntilMyTurn = false;
        const opts = promptShell(`${G.phase} — glowing card to play · drag onto a zone · Tab / Enter / E end`);
        const byUid = new Map();
        for (const act of actions) {
          if (!act.card) continue;
          if (!byUid.has(act.card.uid)) byUid.set(act.card.uid, []);
          byUid.get(act.card.uid).push(act);
        }
        const preferredOf = (acts) => {
          const order = ["summon", "activate", "activateSet", "evolve", "ignition", "contactFusion", "ambushSet", "set"];
          for (const t of order) {
            const hit = acts.find((a) => a.type === t);
            if (hit) return hit;
          }
          return acts[0];
        };
        let busy = false;
        const commit = async (act, presetZone) => {
          if (busy) return;
          busy = true;
          const trib = act.tributes || 0;
          let tributeUids = [];
          if (trib > 0) {
            const mats = G.players[p].mz.filter(Boolean);
            const idxs = await selectCardsUi({
              kind: "tribute",
              min: trib,
              max: trib,
              uids: mats.map((m) => m.uid),
              title: `Tribute ${trib} monster${trib > 1 ? "s" : ""}`
            });
            tributeUids = (idxs || []).map((i) => mats[i]?.uid).filter(Boolean);
            if (tributeUids.length < trib) {
              cleanupAll();
              resolve(await api.chooseMain(p, actions));
              return;
            }
          }
          const kind = zoneKindFor(act);
          if (!kind) {
            cleanupAll();
            resolve({ ...act, tributeUids });
            return;
          }
          if (presetZone != null && Number.isFinite(presetZone)) {
            cleanupAll();
            resolve({ ...act, zone: presetZone, tributeUids });
            return;
          }
          const free = freeZoneIdxs(kind, p, tributeUids);
          if (free.length <= 1) {
            cleanupAll();
            resolve({ ...act, zone: free[0] ?? null, tributeUids });
            return;
          }
          pickZone(kind, p, act.card?.def?.name || act.label || "Card",
            (z) => { cleanupAll(); resolve({ ...act, zone: z, tributeUids }); },
            async () => { cleanupAll(); resolve(await api.chooseMain(p, actions)); },
            tributeUids);
        };
        const openChooser = (acts) => {
          const ranked = rankFieldActions(acts);
          const name = acts[0]?.card?.def?.name || "Card";
          const sub = promptShell(`${name} — Evolve or ignition · 1–9, B back`, { forced: true });
          const btns = [];
          for (const act of ranked) {
            const b = btn(act.label || act.type, act.type === "evolve" ? "confirm" : "");
            b.addEventListener("click", () => { sfx.click(); commit(act); });
            sub.appendChild(b);
            btns.push(b);
          }
          const back = btn("BACK", "pass");
          back.addEventListener("click", async () => {
            sfx.click();
            cleanupAll();
            resolve(await api.chooseMain(p, actions));
          });
          sub.appendChild(back);
          bindCycleKeys(btns, { onBack: () => back.click() });
        };
        const pickCard = (acts) => {
          const ranked = rankFieldActions(acts);
          if (ranked.length > 1) openChooser(acts);
          else commit(ranked[0] || preferredOf(acts));
        };
        const rec = teachRecommended(G, actions);
        if (rec?.card) elByUid(rec.card.uid)?.classList.add("teach-next");
        if (rec?.type === "end") $("phase-orb")?.classList.add("teach-next");
        for (const [uid, acts] of byUid) {
          const el = elByUid(uid);
          if (!el) continue;
          el.classList.add("selectable");
          el.style.pointerEvents = "auto";
          const drag = watchDrag(el, {
            onDragStart() {
              hideCardHover();
              const kinds = new Set();
              for (const a of acts) {
                const k = zoneKindForType(a.type, a.card?.def?.spell?.subtype);
                if (k) kinds.add(k);
              }
              if (!kinds.size && actForBoardDrop(acts)) {
                $("mz-0")?.classList.add("zone-drop");
                $("stz-0")?.classList.add("zone-drop");
              }
              for (const kind of kinds) {
                for (const z of freeZoneIdxs(kind, p)) {
                  document.querySelector(`[data-zone="${kind}-${p}-${z}"]`)?.classList.add("zone-drop");
                }
              }
            },
            onDrop(drop) {
              if (drop?.kind === "hand") {
                view.reorderHand?.(uid, drop.uid);
                return;
              }
              if (!drop) { sfx.negate(); return; }
              if (drop.kind === "mz" || drop.kind === "stz") {
                if (drop.p !== p) { sfx.negate(); return; }
                const act = actForZoneDrop(acts, drop.kind);
                if (!act) { sfx.negate(); return; }
                if (!freeZoneIdxs(drop.kind, p).includes(drop.z)) { sfx.negate(); return; }
                sfx.click();
                commit(act, drop.z);
                return;
              }
              if (drop.kind === "board") {
                const act = actForBoardDrop(acts) || actForZoneDrop(acts, "mz") || actForZoneDrop(acts, "stz");
                if (!act) { sfx.negate(); return; }
                sfx.click();
                commit(act);
                return;
              }
              sfx.negate();
            }
          });
          bindEv(el, "pointerdown", drag.down);
          bind(el, () => {
            if (drag.consumeClick()) return;
            sfx.click();
            pickCard(acts);
          });
        }
        for (const c of G.players[p].hand) {
          if (byUid.has(c.uid)) continue;
          const el = elByUid(c.uid);
          if (!el) continue;
          const why = denyReason(c, p);
          el.classList.add("unplayable");
          el.title = why;
          bind(el, () => denyShake(el, why));
        }
        for (const c of G.players[p].stz) {
          if (!c || byUid.has(c.uid) || !isLockedSetThisTurn(G, c)) continue;
          const el = elByUid(c.uid);
          if (!el) continue;
          el.classList.add("unplayable");
          el.title = LOCKED_SET_REASON;
          bind(el, () => denyShake(el, LOCKED_SET_REASON));
        }
        for (const act of promptBarActs(actions)) {
          const primary = act.type === "activate" || act.type === "activateSet" || act.type === "contactFusion";
          const b = btn(act.label || act.type, primary ? "confirm" : "");
          b.addEventListener("click", () => { sfx.click(); commit(act); });
          opts.appendChild(b);
        }
        function endButton() {
          const end = actions.find((a) => a.type === "end");
          let ending = false;
          const tryEnd = async () => {
            if (busy || ending) return;
            ending = true;
            if (shouldConfirmEndMain(actions) && !isTeachDuel(G)) {
              const ok = await confirmDialog({
                title: `End ${G.phase}?`,
                body: unusedEndBody(unusedPlayCount(actions), G.phase),
                confirm: `END ${G.phase}`,
                cancel: "KEEP PLAYING"
              });
              if (!ok) { ending = false; return; }
            }
            if (busy) { ending = false; return; }
            busy = true;
            sfx.click();
            cleanupAll();
            resolve(end);
          };
          const b = btn(`END ${G.phase} ▶`, "confirm");
          b.addEventListener("click", () => { tryEnd(); });
          const orb = $("phase-orb");
          if (orb) {
            orb.classList.add("clickable");
            bind(orb, () => { tryEnd(); });
          }
          return b;
        }
        if (G._canUndo && G._mainUndo) {
          const undo = btn("UNDO last play (U)");
          undo.addEventListener("click", () => { sfx.click(); cleanupAll(); resolve({ type: "undo" }); });
          opts.appendChild(undo);
        }
        opts.appendChild(endButton());
        const playable = [...byUid.keys()].map((uid) => elByUid(uid)).filter(Boolean);
        bindCycleKeys(playable, {
          onEnd: () => $("phase-orb")?.click(),
          onUndo: (G._canUndo && G._mainUndo) ? () => {
            cleanupAll();
            resolve({ type: "undo" });
          } : null
        });
        cancellable(resolve, actions.find((a) => a.type === "end"));
      });
    },

    async askAttack(p, attackers, targetsFn) {
      return new Promise((resolve) => {
        const opts = promptShell("BATTLE — drag onto a target, or click · Tab / Enter / E");
        const atkEls = [];
        const hintAtk = teachAttackHint(G, attackers);
        for (const atk of attackers) {
          const el = elByUid(atk.uid);
          if (!el) continue;
          atkEls.push(el);
          el.classList.add("selectable");
          if (hintAtk && hintAtk.uid === atk.uid) el.classList.add("teach-next");
          bindEv(el, "mouseenter", () => {
            const { foes, canDirect } = targetsFn(atk);
            if (document.querySelector(".cb-card.selected") === el) return;
            if (foes[0]) paintCombatOverlay(el, elByUid(foes[0].uid), previewCombat(G, atk, foes[0]));
            else if (canDirect) paintCombatOverlay(el, null, previewCombat(G, atk, null));
          });
          bindEv(el, "mouseleave", () => {
            if (document.querySelector(".cb-card.selected") === el) return;
            clearCombatOverlay();
          });
          const dragAtk = watchDrag(el, {
            onDragStart() {
              hideCardHover();
              const { foes, canDirect, blocked = [] } = targetsFn(atk);
              for (const foe of foes) elByUid(foe.uid)?.classList.add("target-hl-enemy", "zone-drop");
              if (canDirect) $("hud-1")?.classList.add("zone-drop");
              for (const { card: foe } of blocked) elByUid(foe.uid)?.classList.add("target-illegal");
            },
            onDrop(drop) {
              const hit = attackFromDrop(drop);
              if (!hit) { sfx.negate(); return; }
              const { foes, canDirect, blocked = [] } = targetsFn(atk);
              if (hit.targetUid == null) {
                if (!canDirect) { sfx.negate(); return; }
                sfx.click();
                cleanupAll();
                resolve({ attackerUid: atk.uid, targetUid: null });
                return;
              }
              if (foes.some((f) => f.uid === hit.targetUid)) {
                sfx.click();
                cleanupAll();
                resolve({ attackerUid: atk.uid, targetUid: hit.targetUid });
                return;
              }
              const block = blocked.find((b) => b.card?.uid === hit.targetUid);
              sfx.negate();
              $("prompt-title").textContent = block?.reason || "Illegal attack.";
            }
          });
          bindEv(el, "pointerdown", dragAtk.down);
          bind(el, () => {
            if (dragAtk.consumeClick()) return;
            sfx.click();
            clearHighlights();
            clearAttackArrows();
            el.classList.add("selected");
            const { foes, canDirect, blocked = [] } = targetsFn(atk);
            const sub = promptShell(`${atk.def.name} attacks — click a target`, { forced: true });
            const foeEls = [];
            let pending = null;
            const paintPreview = (line) => {
              $("prompt-title").textContent = line;
            };
            const commitAttack = (targetUid) => {
              sfx.click();
              const foeEl = targetUid != null ? elByUid(targetUid) : null;
              if (foeEl) showAttackArrow(el, foeEl);
              setTimeout(() => {
                clearAttackArrows();
                cleanupAll();
                resolve({ attackerUid: atk.uid, targetUid });
              }, 120);
            };
            const confirmAtk = btn("CONFIRM ATTACK", "confirm");
            confirmAtk.disabled = true;
            const arm = (targetUid, line, lethal = false, prev = null) => {
              pending = { targetUid, line, prev };
              paintPreview(`${line} — Enter confirm, B back`);
              confirmAtk.disabled = false;
              const foeEl = targetUid != null ? elByUid(targetUid) : null;
              paintCombatOverlay(el, foeEl, prev);
              document.querySelectorAll(".combat-lethal").forEach((n) => n.classList.remove("combat-lethal"));
              if (lethal && targetUid != null) elByUid(targetUid)?.classList.add("combat-lethal");
            };
            for (const foe of foes) {
              const foeEl = elByUid(foe.uid);
              if (!foeEl) continue;
              foeEl.classList.add("target-hl-enemy");
              const prev = previewCombat(G, atk, foe);
              foeEl.title = prev.line;
              bindEv(foeEl, "mouseenter", () => {
                paintCombatOverlay(el, foeEl, prev);
                paintPreview(prev.line);
              });
              bind(foeEl, () => {
                sfx.click();
                commitAttack(foe.uid);
              });
              foeEls.push(foeEl);
            }
            for (const { card: foe, reason } of blocked) {
              const foeEl = elByUid(foe.uid);
              if (!foeEl) continue;
              foeEl.classList.add("target-illegal");
              foeEl.title = reason;
              bind(foeEl, () => {
                sfx.negate();
                $("prompt-title").textContent = reason;
              });
            }
            let directBtn = null;
            if (canDirect) {
              const dprev = previewCombat(G, atk, null);
              directBtn = btn(dprev.line, dprev.lethal ? "confirm" : "");
              directBtn.addEventListener("click", () => {
                if (pending && pending.targetUid == null) { commitAttack(null); return; }
                sfx.click();
                if (dprev.lethal) {
                  clearAttackArrows();
                  arm(null, dprev.line, dprev.lethal, dprev);
                } else {
                  commitAttack(null);
                }
              });
              sub.appendChild(directBtn);
            }
            confirmAtk.addEventListener("click", () => {
              if (pending) commitAttack(pending.targetUid);
            });
            sub.appendChild(confirmAtk);
            const cancel = btn("BACK", "pass");
            cancel.addEventListener("click", () => {
              sfx.click();
              clearAttackArrows();
              cleanupAll();
              resolve(retry());
            });
            sub.appendChild(cancel);
            const cycle = [...foeEls];
            if (directBtn) cycle.push(directBtn);
            cycle.push(confirmAtk);
            bindCycleKeys(cycle, { onBack: () => cancel.click() });
            async function retry() { return await api.askAttack(p, attackers, targetsFn); }
          });
        }
        const atkUids = new Set(attackers.map((a) => a.uid));
        for (const m of monstersOf(G, p)) {
          if (atkUids.has(m.uid)) continue;
          const el = elByUid(m.uid);
          if (!el) continue;
          const why = cannotAttackReason(G, m) || "Cannot attack.";
          el.classList.add("target-illegal");
          el.title = why;
          bind(el, () => denyShake(el, why));
        }
        const end = btn("END BATTLE", "pass");
        let endingBp = false;
        const tryEndBattle = async () => {
          if (endingBp) return;
          endingBp = true;
          if (shouldConfirmEndBattle(attackers) && !isTeachDuel(G)) {
            const ok = await confirmDialog({
              title: "End Battle?",
              body: unusedEndBody(attackers.length, "BP"),
              confirm: "END BATTLE",
              cancel: "KEEP ATTACKING"
            });
            if (!ok) { endingBp = false; return; }
          }
          sfx.click();
          clearAttackArrows();
          cleanupAll();
          resolve(null);
        };
        end.addEventListener("click", () => { tryEndBattle(); });
        opts.appendChild(end);
        const orb = $("phase-orb");
        if (orb) {
          orb.classList.add("clickable");
          bind(orb, () => { tryEndBattle(); });
        }
        bindCycleKeys(atkEls, { onEnd: () => end.click() });
        cancellable(resolve, null);
      });
    },

    async askMulligan(p, hand) {
      if (G.meta?.labs) return [];
      return new Promise((resolve) => {
        document.getElementById("duel-hint")?.remove();
        const picked = new Set();
        const finish = (uids) => {
          closeMulliganStage();
          cleanupAll();
          resolve(uids);
        };
        const stage = openMulliganStage({
          onKeep: () => { sfx.click(); finish([]); },
          onRedraw: () => { sfx.click(); finish([...picked]); }
        });
        promptShell("OPENING HAND — click a card to replace · Enter keep · R redraw", { forced: true });
        $("prompt")?.classList.add("hidden");
        const handEls = [];
        for (const c of hand) {
          const el = elByUid(c.uid);
          if (!el) continue;
          handEls.push(el);
          el.classList.add("selectable");
          el.style.pointerEvents = "auto";
          bind(el, () => {
            sfx.click();
            if (picked.has(c.uid)) {
              picked.delete(c.uid);
              el.classList.remove("selected");
              stage.mark(el, false);
            } else {
              picked.add(c.uid);
              el.classList.add("selected");
              stage.mark(el, true);
            }
          });
        }
        cancellable(resolve, []);
        onKey((e) => {
          const i = digitIndex(e);
          if (i >= 0 && handEls[i]) { e.preventDefault(); handEls[i].click(); }
          else if (e.key === "Enter") { e.preventDefault(); finish([]); }
          else if (e.key === "r" || e.key === "R") { e.preventDefault(); finish([...picked]); }
        });
      });
    },

    async askComeback(_p) {
      return new Promise((resolve) => {
        const opts = promptShell("COMEBACK (LP≤10) — choose once per duel", { forced: true });
        const draw = btn("+1 DRAW next turn", "confirm");
        const evo = btn("FREE EVOLVE once", "confirm");
        draw.addEventListener("click", () => { sfx.click(); cleanupAll(); resolve("draw"); });
        evo.addEventListener("click", () => { sfx.click(); cleanupAll(); resolve("evolve"); });
        opts.appendChild(draw);
        opts.appendChild(evo);
        cancellable(resolve, "draw");
        onKey((e) => {
          if (e.key === "1" || e.key === "Enter") { e.preventDefault(); draw.click(); }
          else if (e.key === "2") { e.preventDefault(); evo.click(); }
        });
      });
    },

    cancelPending() { pendingCancel?.(); }
  };
  activeIo = api;
  return api;
}

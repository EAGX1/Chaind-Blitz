// Hub screens: PLAY, DECK editor, COLLECTION + crafting, SHOP (packs),
// RANKED ladder, RUN (roguelike), RULEBOOK.

import { STARTERS } from "../data/starters.js";
import { CARD_DB, ALL_CARDS } from "../data/cards/index.js";
import { shippedLoaners } from "../data/loaners.js";
import { monsterLevel } from "../engine/state.js";
import { buildCardEl } from "./cardArt.js";
import { bindCardHover } from "./cardHover.js";
import { fxFilterBarHtml, effectsOf } from "../data/effectTags.js";
import { openPack, grantCards, PACK_COST_GEMS } from "../meta/packs.js";
import { grantStarterCards, spendGems, canAffordGems, ownedCardDefs, ownedCopies } from "../meta/campaign.js";
import { craft, dismantle, canCraft, canDismantle, dustLine, CRAFT_COST, DUST_SHOP, DUST_SHOP_AMOUNT, buyDustWithCoins, canBuyDust } from "../meta/crafting.js";
import { rankLabel } from "../meta/ranked.js";
import { TIERS, poolForTier, tierName } from "../meta/pools.js";
import { makeRng } from "../engine/rng.js";
import { sfx } from "./fx.js";
import { announce } from "./liveAnnounce.js";
import {
  tryQueueDeck, deckTokenOptionsHtml, pickRankedToken, saveSessionRankedToken
} from "./deckDoor.js";
import { slamPackCards, packRecapLine } from "./packSlam.js";
import { showHubToast, pulseWallet, walletDeltaLine } from "./hubToast.js";
import { puzzleOfTheDay, isLabCleared } from "../meta/labs.js";
import { canClaim as canClaimLogin, claimToday } from "../meta/loginCalendar.js";
import { claimTier, unlockedTiers, TRACK as PASS_TRACK } from "../meta/duelPass.js";
import { rollDailies, claim as claimMission, missionStatus, progress as missionProgress } from "../meta/missions.js";
import {
  RELICS, EVENTS, hasRelic, canEnter, enterNode,
  pickReward, pickRelic, openRest, applyRest, restHealAmount,
  openShop, buyShopCard, buyShopRelic, buyShopRemove, leaveShop,
  openEvent, applyEvent, clearCurrent
} from "../meta/rogue.js";
import {
  newDraft, rollDraftChoices, draftPick, draftDone, draftDeck, DRAFT_PICKS,
  newSealed, sealedDeckValid, SEALED_DECK_SIZE,
  GAUNTLET_FOE_LP, GAUNTLET_ROUNDS, GAUNTLET_REWARDS,
  isHighlander, newTourney, TOURNEY_ROUNDS, TOURNEY_REWARDS,
  brawlForWeek, weekKey, BRAWL_WIN_REWARD
} from "../meta/modes.js";
import { validateDeck, asSavedDeck, getBanlist, setCopyLimit, banlistFromPreset, EXTRA_MAX, copyLimit, isExtraCard, banlistSummary, activeFormat } from "../meta/banlist.js";
import { loadSettings } from "./settingsStore.js";
import { openReplayScrubber } from "./replayScrubber.js";
import { createAndHost, joinRoom, queueRankedPvp, formatRoomCode, BACKEND_OFFLINE_REASON } from "../meta/peerNet.js";
import { deckCurveHtml } from "./deckCurve.js";
import { deckCircuits, deckComboLine, suggestedGlueForDeck, CIRCUITS, comboTagsFor, circuitClass } from "../data/comboTags.js";
import { serializeDeckList, parseDeckList, drawOpeningHand, openingSeatNote } from "./deckList.js";
import { copiesToAdd, removeAllCopies } from "./duelSeat.js";

const $ = (id) => document.getElementById(id);
const DECK_SIZE = 40;
const BRONZE_DB = CARD_DB;
const BRONZE_CARDS = ALL_CARDS;
function deckPip(def) {
  if (!def) return "?";
  if (def.summon === "fusion") return "E";
  if (def.type === "spell") return def.spell?.subtype === "counter" ? "T" : "S";
  return `★${monsterLevel(def)}`;
}

function openDeckTextModal({ title, value = "", confirm = "APPLY", hint = "", readOnly = false }) {
  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.className = "cb-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-label", title);
    modal.innerHTML = `
      <div class="cb-modal-card wide" style="width:min(480px,94vw);">
        <h2 style="margin:0 0 8px;">${title}</h2>
        ${hint ? `<p class="dim" style="font-size:12px;margin:0 0 8px;">${hint}</p>` : ""}
        <textarea id="deck-list-text" class="cb-input deck-list-text" ${readOnly ? "readonly" : ""}></textarea>
        <div class="row" style="margin-top:12px;justify-content:flex-end;gap:8px;">
          ${readOnly ? "" : `<button type="button" class="cb-btn" data-act="no">CANCEL</button>`}
          <button type="button" class="cb-btn primary" data-act="ok">${confirm}</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const ta = modal.querySelector("#deck-list-text");
    ta.value = value;
    ta.focus();
    const done = (v) => { modal.remove(); resolve(v); };
    modal.addEventListener("click", (e) => {
      const act = e.target.closest("[data-act]")?.getAttribute("data-act");
      if (act === "ok") done(readOnly ? undefined : ta.value);
      else if (act === "no" || e.target === modal) done(null);
    });
  });
}

function openOpeningHand(mainIds, seed, seat = "first") {
  const modal = document.createElement("div");
  modal.className = "cb-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-label", "Opening hand");
  modal.innerHTML = `
    <div class="cb-modal-card wide" style="width:min(640px,94vw);">
      <h2 style="margin:0 0 6px;" data-title>DRAW 5 · FIRST</h2>
      <p class="dim" style="font-size:12px;margin:0 0 8px;">Seeded shuffle — not a search.</p>
      <p class="dim" data-seat-note style="font-size:12px;margin:0 0 10px;"></p>
      <div class="row" style="margin:0 0 10px;gap:8px;">
        <button type="button" class="cb-btn" data-seat="first">DRAW 5 · FIRST</button>
        <button type="button" class="cb-btn" data-seat="second">DRAW 5 · SECOND</button>
      </div>
      <div class="opening-hand" data-hand></div>
      <p class="dim" data-seed style="font-size:11px;margin:8px 0 0;"></p>
      <div class="row" style="margin-top:12px;justify-content:flex-end;gap:8px;">
        <button type="button" class="cb-btn" data-act="again">SHUFFLE AGAIN</button>
        <button type="button" class="cb-btn primary" data-act="ok">CLOSE</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  const grid = modal.querySelector("[data-hand]");
  const seedEl = modal.querySelector("[data-seed]");
  const titleEl = modal.querySelector("[data-title]");
  const noteEl = modal.querySelector("[data-seat-note]");
  let current = seed;
  let currentSeat = seat === "second" ? "second" : "first";
  const paintSeats = () => {
    modal.querySelectorAll("[data-seat]").forEach((b) => {
      b.classList.toggle("primary", b.getAttribute("data-seat") === currentSeat);
    });
  };
  const paint = (s) => {
    current = s;
    const note = openingSeatNote(currentSeat);
    titleEl.textContent = `DRAW 5 · ${note.label}`;
    noteEl.textContent = note.caption;
    const { cards, remaining } = drawOpeningHand(mainIds, { seed: s, n: 5 });
    grid.innerHTML = "";
    for (const id of cards) {
      const def = BRONZE_DB[id];
      if (!def) continue;
      grid.appendChild(buildCardEl(def));
    }
    seedEl.textContent = `Seed ${s} · ${remaining} left in deck · ${note.ep} EP`;
    paintSeats();
  };
  paint(seed);
  modal.addEventListener("click", (e) => {
    const seatBtn = e.target.closest("[data-seat]");
    if (seatBtn) {
      currentSeat = seatBtn.getAttribute("data-seat") === "second" ? "second" : "first";
      paint(current);
      return;
    }
    const act = e.target.closest("[data-act]")?.getAttribute("data-act");
    if (act === "again") paint((Date.now() & 0xffffffff) >>> 0);
    else if (act === "ok" || e.target === modal) modal.remove();
  });
}

function deckAnalyticsLine(cards) {
  if (!cards?.length) return "Tribes — · avg ★ —";
  const tribes = {};
  let lvSum = 0;
  let nMon = 0;
  for (const id of cards) {
    const def = BRONZE_DB[id];
    if (!def) continue;
    const t = def.type === "spell" ? "Spell" : (def.tribe || "Neutral");
    tribes[t] = (tribes[t] || 0) + 1;
    if (def.type === "monster") {
      lvSum += monsterLevel(def);
      nMon++;
    }
  }
  const tribeStr = Object.entries(tribes).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(" · ");
  const avg = nMon ? (lvSum / nMon).toFixed(1) : "—";
  return `${tribeStr} · avg ★ ${avg}`;
}

function banlistStatusLine(cards, extra = [], profile = null) {
  const bl = getBanlist(profile);
  const fmt = activeFormat(bl);
  const v = validateDeck({ main: cards, extra }, fmt, bl);
  const bits = [banlistSummary(bl)];
  if (!v.ok) bits.push(`⚠ ${v.errors[0]}`);
  return bits.join(" · ");
}

function playFromSave(raw) {
  const { main, extra } = asSavedDeck(raw);
  return { deck: main, extra };
}

export function initHub(ctx) {
  // ctx: { profile, save(), startPvE(deckIds, youLabel, foeId), startAiVsAi(aId, bId), startRanked(deckIds), startRogue(), refreshWallet() }
  const { profile } = ctx;
  const freshPulls = new Set();
  let lastWallet = { gems: profile.gems, coins: profile.coins, dust: { ...profile.dust } };

  /* ================= wallet ================= */
  function refreshWallet({ toast } = {}) {
    $("wallet-gems").textContent = profile.gems;
    $("wallet-coins").textContent = profile.coins;
    const dust = $("wallet-dust");
    if (dust) dust.textContent = dustLine(profile);
    const r = $("wallet-rank");
    r.textContent = tierName(profile.rank.tier).toUpperCase();
    r.style.color = TIERS[profile.rank.tier].color;
    r.style.borderColor = TIERS[profile.rank.tier].color;
    const now = { gems: profile.gems, coins: profile.coins, dust: { ...profile.dust } };
    const delta = walletDeltaLine(lastWallet, now);
    if (delta) {
      pulseWallet();
      if (toast !== false) showHubToast(delta, "wallet");
    }
    lastWallet = now;
  }

  /* ================= PLAY ================= */
  function queueCtx() {
    return { starters: STARTERS, loaners: shippedLoaners(), decks: profile.decks, profile };
  }

  function refuseDoor(elId, error) {
    sfx.defeat();
    announce(error);
    const el = $(elId);
    if (el) el.textContent = error;
  }

  function renderPlay() {
    const customDecks = Object.keys(profile.decks);
    const loaners = shippedLoaners();
    const deckOpts = deckTokenOptionsHtml({ loaners, starters: STARTERS, customNames: customDecks });
    const foeOpts = [
      ...loaners.map((s) => `<option value="${s.id}">◆ ${s.name}</option>`),
      ...Object.values(STARTERS).map((s) => `<option value="${s.id}">★ ${s.name}</option>`)
    ].join("");
    const byPillar = {};
    for (const d of loaners) (byPillar[d.pillar] ||= []).push(d);
    const avaOpts = [
      ...Object.entries(byPillar).map(([pillar, decks]) =>
        `<optgroup label="${pillar}">${decks.map((d) => `<option value="${d.id}">${d.name}</option>`).join("")}</optgroup>`
      ),
      `<optgroup label="Starters">${Object.values(STARTERS).map((s) => `<option value="${s.id}">★ ${s.name}</option>`).join("")}</optgroup>`,
      ...(customDecks.length
        ? [`<optgroup label="Custom">${customDecks.map((n) => `<option value="custom:${n}">${n}</option>`).join("")}</optgroup>`]
        : [])
    ].join("");
    const taught = !!profile.soloGates?.tutorialSeen;
    const puzzle = puzzleOfTheDay();
    const puzzleCleared = isLabCleared(profile, puzzle.id);
    $("panel-play").innerHTML = `
      <div class="home-play">
        <section class="home-hero">
          <div class="home-hero-copy">
            <p class="home-kicker">${taught ? "Today" : "First duel"}</p>
            <h2>${taught ? "PUZZLE OF THE DAY" : "LEARN IN ONE FIGHT"}</h2>
            <p>${taught
              ? `${puzzle.label}${puzzleCleared ? " · already cleared" : ""} — the reason to open Chaind today.`
              : "Normal Summon, one Set, one chain, one Evolve. The rulebook stays a tab away."}</p>
          </div>
          <div class="home-hero-actions">
            <select class="cb-select" id="pve-seat" title="Who goes first — going first skips Battle, going second gets 3 EP">
              <option value="random">SEAT · RANDOM</option>
              <option value="first">I GO FIRST · 2 EP, no Battle</option>
              <option value="second">I GO SECOND · 3 EP, you may attack</option>
            </select>
            ${taught
              ? `<button class="home-cta" id="btn-puzzle-day">PLAY ${puzzle.label.toUpperCase()}</button>
                 <button class="cb-btn" id="btn-quick-duel">QUICK DUEL</button>`
              : `<button class="home-cta" id="btn-quick-duel">FIRST DUEL</button>
                 <button class="cb-btn" id="btn-puzzle-day">PUZZLE</button>`}
          </div>
        </section>
        <div class="home-grid">
          <article class="home-tile featured">
            <span class="home-tag">CPU</span>
            <h3>VS CPU</h3>
            <p>Pick your loaner and a foe.</p>
            <div class="home-tile-row">
              <select class="cb-select" id="pve-you">${deckOpts}</select>
              <select class="cb-select" id="pve-foe">${foeOpts}</select>
              <button class="cb-btn primary" id="btn-pve">START</button>
            </div>
            <p class="dim" id="pve-door-msg" style="font-size:12px;margin:8px 0 0;"></p>
          </article>
          <article class="home-tile">
            <span class="home-tag">RANK</span>
            <h3>RANKED</h3>
            <p>${tierName(profile.rank.tier)} · ${profile.rank.lp || 0} LP</p>
            <button class="cb-btn primary" id="btn-home-ranked">QUEUE</button>
          </article>
          <article class="home-tile">
            <span class="home-tag">TODAY</span>
            <h3>DAILY RITUAL</h3>
            <div id="today-body"></div>
          </article>
          <article class="home-tile home-history">
            <span class="home-tag">LOG</span>
            <h3>RECENT</h3>
            <div id="match-history-list" class="home-hist"></div>
            <button class="cb-btn" id="btn-last-replay">DUEL LOG</button>
          </article>
          <details class="home-more">
            <summary>MORE MODES</summary>
            <div class="home-more-grid">
              <article class="home-tile">
                <span class="home-tag">RUN</span>
                <h3>ROGUELIKE</h3>
                <p>${profile.rogue ? "A run is in progress." : "Node map. Draft. Boss."}</p>
                <button class="cb-btn primary" id="btn-rogue">${profile.rogue ? "CONTINUE" : "START RUN"}</button>
              </article>
              <article class="home-tile">
                <span class="home-tag">WATCH</span>
                <h3>AI VS AI</h3>
                <p>Spectate any two decks.</p>
                <div class="home-tile-row">
                  <select class="cb-select" id="ava-a">${avaOpts}</select>
                  <select class="cb-select" id="ava-b">${avaOpts}</select>
                  <button class="cb-btn" id="btn-ava">WATCH</button>
                </div>
              </article>
              <article class="home-tile">
                <span class="home-tag">ARENA</span>
                <h3>DRAFT &amp; MORE</h3>
                <p>Draft, sealed, brawl, hotseat.</p>
                <button class="cb-btn" id="btn-modes">OPEN</button>
              </article>
            </div>
          </details>
        </div>
      </div>
    `;
    const hist = profile.matchHistory || [];
    const histEl = $("match-history-list");
    if (!hist.length) {
      histEl.innerHTML = `<p class="dim">No matches yet.</p>`;
    } else {
      histEl.innerHTML = hist.slice(0, 12).map((m) => {
        const when = m.at ? new Date(m.at).toLocaleString() : "";
        const outcome = m.won ? "W" : "L";
        return `<div class="deck-row" style="cursor:default;"><span class="deck-cost">${outcome}</span><span class="deck-name">${m.mode || "?"} · ${m.reason || ""}</span><span class="deck-count">${when}</span></div>`;
      }).join("");
    }
    renderToday();
    $("btn-last-replay").addEventListener("click", () => {
      const json = window.__CB?.exportLastReplay?.();
      if (!json) { sfx.defeat?.(); return; }
      openReplayScrubber(json);
      sfx.click();
    });
    $("btn-pve").addEventListener("click", () => {
      const token = $("pve-you").value;
      const result = tryQueueDeck(token, queueCtx());
      if (!result.ok) {
        refuseDoor("pve-door-msg", result.error);
        return;
      }
      const msg = $("pve-door-msg");
      if (msg) msg.textContent = "";
      ctx.startPvE(result.deck, result.label, $("pve-foe").value, { extraYou: result.extra, seat: $("pve-seat")?.value });
    });
    $("btn-quick-duel").addEventListener("click", () => {
      if (ctx.startQuickDuel) {
        ctx.startQuickDuel();
        return;
      }
      const L = shippedLoaners()[0];
      ctx.startPvE(L.deck, L.name.toUpperCase(), "control_counters", {
        extraYou: L.extra || [],
        seat: $("pve-seat")?.value
      });
    });
    $("btn-puzzle-day")?.addEventListener("click", () => ctx.startPuzzleOfTheDay?.());
    $("ava-b").value = "control_counters";
    $("btn-ava").addEventListener("click", () => ctx.startAiVsAi($("ava-a").value, $("ava-b").value));
    $("btn-rogue").addEventListener("click", () => ctx.startRogue());
    $("btn-modes").addEventListener("click", () => document.querySelector('[data-tab="modes"]').click());
    $("btn-home-ranked")?.addEventListener("click", () => document.querySelector('[data-tab="ranked"]').click());
  }

  /* ================= TODAY (login + dailies + pass claims, classic hub) ================= */
  function renderToday() {
    const box = $("today-body");
    if (!box) return;
    rollDailies(profile);
    const dailies = missionStatus(profile).dailies;
    const passTier = unlockedTiers(profile);
    const passPending = PASS_TRACK.filter((t) => t.tier <= passTier && !profile.duelPass?.claimed?.includes(t.tier)).length;
    box.innerHTML = `
      <div class="home-tile-row" style="margin-bottom:8px;">
        <button class="cb-btn primary" id="btn-today-login" ${canClaimLogin(profile) ? "" : "disabled"}>
          ${canClaimLogin(profile) ? "CLAIM LOGIN" : "LOGIN CLAIMED"}
        </button>
        <button class="cb-btn" id="btn-today-pass" ${passPending ? "" : "disabled"}>
          PASS ${passPending ? `(${passPending} READY)` : `· TIER ${passTier}`}
        </button>
      </div>
      <div class="today-dailies">
        ${dailies.map((d) => `
          <div class="deck-row" style="cursor:default;">
            <span class="deck-name">${d.label} · ${d.have}/${d.goal}</span>
            <button class="cb-btn" data-daily="${d.id}" ${d.done && !d.claimed ? "" : "disabled"}>
              ${d.claimed ? "CLAIMED" : d.done ? "CLAIM" : "…"}
            </button>
          </div>`).join("")}
      </div>
      <p class="dim" id="today-msg" style="font-size:12px;margin:8px 0 0;"></p>`;
    const note = (m) => { const el = $("today-msg"); if (el) el.textContent = m; };
    $("btn-today-login")?.addEventListener("click", () => {
      const r = claimToday(profile);
      if (r?.ok) { missionProgress(profile, "login"); sfx.chain(); note(`Login day ${r.day} claimed.`); }
      else note(r?.reason || "Already claimed");
      ctx.save();
      renderToday();
    });
    $("btn-today-pass")?.addEventListener("click", () => {
      const r = claimTier(profile);
      if (r?.ok) { sfx.chain(); note(`Pass tier ${r.tier} claimed.`); } else note(r?.reason || "Nothing to claim");
      ctx.save();
      renderToday();
    });
    box.querySelectorAll("[data-daily]").forEach((b) => b.addEventListener("click", () => {
      const r = claimMission(profile, b.dataset.daily);
      if (r?.ok) { sfx.chain(); note("Daily claimed."); } else note(r?.reason || "Not complete");
      ctx.save();
      renderToday();
    }));
  }

  /* ================= DECK editor ================= */
  const editor = { name: null, cards: [], extra: [], poolTab: "main", poolQ: "", poolFx: new Set() };

  function ensureStarterCollection() {
    const s = STARTERS[profile.starterId];
    if (!s) return;
    if (grantStarterCards(profile, s)) ctx.save();
  }

  function editorBanlist() {
    return getBanlist(profile);
  }

  function editorFormat() {
    return activeFormat(editorBanlist());
  }

  function deckIsValid() {
    const bl = editorBanlist();
    const v = validateDeck({ main: editor.cards, extra: editor.extra }, editorFormat(), bl);
    if (!v.ok) return v.errors[0];
    const counts = {};
    for (const id of [...editor.cards, ...editor.extra]) {
      counts[id] = (counts[id] || 0) + 1;
      if ((profile.collection[id] || 0) < counts[id]) {
        return `You don't own enough copies of ${BRONZE_DB[id]?.name || id}`;
      }
    }
    return null;
  }

  function copiesInEditor(id) {
    return editor.cards.filter((x) => x === id).length + editor.extra.filter((x) => x === id).length;
  }

  function capFor(id) {
    return Math.min(copyLimit(id, editorFormat(), editorBanlist()), profile.collection[id] || 0);
  }

  function renderDeck() {
    ensureStarterCollection();
    const saved = Object.keys(profile.decks);
    const dev = !!loadSettings().devMode;
    const loaners = shippedLoaners();
    const byPillar = {};
    for (const d of loaners) (byPillar[d.pillar] ||= []).push(d);
    const loadOpts = [
      `<optgroup label="Starters">${Object.values(STARTERS).map((s) => `<option value="starter:${s.id}">★ ${s.name}</option>`).join("")}</optgroup>`,
      ...Object.entries(byPillar).map(([pillar, decks]) =>
        `<optgroup label="${pillar}">${decks.map((d) => `<option value="loaner:${d.id}">◆ ${d.name}</option>`).join("")}</optgroup>`
      ),
      ...(saved.length
        ? [`<optgroup label="Custom">${saved.map((n) => `<option value="custom:${n}">${n}</option>`).join("")}</optgroup>`]
        : [])
    ].join("");
    $("panel-deck").innerHTML = `
      <div class="panel-head">
        <h2>DECK EDITOR</h2>
        <div class="row">
          <select class="cb-select" id="deck-load"><option value="">— load a list —</option>
            ${loadOpts}
          </select>
          <input class="cb-input" id="deck-name" placeholder="Deck name" value="${editor.name ?? ""}">
          <button class="cb-btn primary" id="deck-save">SAVE</button>
          <button class="cb-btn" id="deck-copy" title="Copy one id per line">COPY LIST</button>
          <button class="cb-btn" id="deck-paste" title="Paste a list of ids">PASTE LIST</button>
          <button class="cb-btn" id="deck-draw5-first" title="Seeded shuffle — going first: 2 EP, no Battle">DRAW 5 · FIRST</button>
          <button class="cb-btn" id="deck-draw5-second" title="Seeded shuffle — going second: 3 EP, you may attack">DRAW 5 · SECOND</button>
          <button class="cb-btn danger" id="deck-clear">CLEAR</button>
        </div>
      </div>
      <p class="dim" id="deck-status"></p>
      <p class="dim" id="deck-banlist" style="font-size:11px;margin:0 0 8px;"></p>
      <p class="dim" id="deck-analytics" style="font-size:11px;margin:0 0 8px;"></p>
      <div id="deck-curve-host" class="deck-curve-host"></div>
      <div id="deck-combo-host" class="deck-combo-host"></div>
      ${dev ? `<div class="banlist-editor" id="banlist-editor"></div>` : `<p class="dim" style="font-size:11px;margin:0 0 8px;">Dev Mode (Settings) unlocks the banlist editor — set any card to 0 / 1 / 2 / 3 copies.</p>`}
      <div class="deck-editor">
        <div class="deck-pool" id="deck-pool"></div>
        <div class="deck-side">
          <div class="deck-inspect" id="deck-inspect"><p class="dim">Hover a card to read its effect.</p></div>
          <div class="deck-list" id="deck-list"></div>
          <div class="deck-list" id="deck-extra"></div>
        </div>
      </div>
    `;
    renderBanlistEditor();
    renderDeckPool();
    renderDeckList();
    $("deck-load").addEventListener("change", () => {
      const v = $("deck-load").value;
      if (!v) return;
      const [kind, key] = v.split(":");
      if (kind === "starter") {
        editor.cards = [...STARTERS[key].deck];
        editor.extra = [...(STARTERS[key].extra || [])];
        editor.name = `${STARTERS[key].name} Copy`;
      } else if (kind === "loaner") {
        const L = shippedLoaners().find((d) => d.id === key);
        if (!L) return;
        editor.cards = [...L.deck];
        editor.extra = [...(L.extra || [])];
        editor.name = `${L.name} Copy`;
      } else {
        const savedDeck = asSavedDeck(profile.decks[key]);
        editor.cards = savedDeck.main;
        editor.extra = savedDeck.extra;
        editor.name = key;
      }
      $("deck-name").value = editor.name;
      renderDeckList();
    });
    $("deck-clear").addEventListener("click", () => {
      editor.cards = [];
      editor.extra = [];
      editor.name = "";
      $("deck-name").value = "";
      renderDeckList();
    });
    $("deck-save").addEventListener("click", () => {
      const name = $("deck-name").value.trim();
      const err = deckIsValid();
      if (!name) return setStatus("Name your deck first.", true);
      if (err) return setStatus(err, true);
      profile.decks[name] = { main: [...editor.cards], extra: [...editor.extra] };
      editor.name = name;
      ctx.save();
      renderPlay();
      setStatus(`Saved "${name}" (${editor.cards.length} main + ${editor.extra.length} extra). It now appears in PLAY.`);
    });
    $("deck-copy").addEventListener("click", async () => {
      const text = serializeDeckList({ main: editor.cards, extra: editor.extra });
      try {
        await navigator.clipboard.writeText(text);
        setStatus("Copied list (one id per line).");
      } catch {
        openDeckTextModal({
          title: "COPY LIST",
          value: text,
          confirm: "CLOSE",
          readOnly: true
        });
        setStatus("Clipboard blocked — copy from the box.");
      }
    });
    $("deck-paste").addEventListener("click", async () => {
      const text = await openDeckTextModal({
        title: "PASTE LIST",
        value: "",
        confirm: "APPLY",
        hint: "One id per line. Optional 3 ember_fox. # Extra for Extra Deck."
      });
      if (text == null) return;
      const parsed = parseDeckList(text);
      editor.cards = parsed.main;
      editor.extra = parsed.extra;
      renderDeckList();
      const unk = parsed.unknown.length ? ` · unknown: ${parsed.unknown.slice(0, 6).join(", ")}` : "";
      setStatus(`Pasted ${parsed.main.length} main + ${parsed.extra.length} extra${unk}.`, !!parsed.unknown.length);
    });
    const openDraw5 = (seat) => {
      if (!editor.cards.length) return setStatus("Add main-deck cards first.", true);
      const seed = (Date.now() & 0xffffffff) >>> 0;
      openOpeningHand(editor.cards, seed, seat);
    };
    $("deck-draw5-first").addEventListener("click", () => openDraw5("first"));
    $("deck-draw5-second").addEventListener("click", () => openDraw5("second"));
    function setStatus(msg, bad = false) {
      const el = $("deck-status");
      el.textContent = msg;
      el.style.color = bad ? "var(--red)" : "var(--terra)";
    }

    function renderBanlistEditor() {
      const box = $("banlist-editor");
      if (!box) return;
      const keepFocus = document.activeElement?.id === "ban-search";
      const bl = editorBanlist();
      const q = (box.querySelector("#ban-search")?.value || "").trim().toLowerCase();
      const restricted = Object.keys(bl.copies);
      const hits = q
        ? BRONZE_CARDS.filter((c) => c.name.toLowerCase().includes(q) || c.id.includes(q)).slice(0, 24)
        : BRONZE_CARDS.filter((c) => restricted.includes(c.id));
      box.innerHTML = `
        <h3>DEV BANLIST — copies allowed</h3>
        <p class="dim" style="font-size:11px;margin:0 0 8px;">0 = forbidden · 1 / 2 = limited · 3 = normal playset. Combined main + extra.</p>
        <div class="row" style="margin-bottom:8px;flex-wrap:wrap;gap:8px;">
          <button class="cb-btn ${bl.preset === "advanced" ? "primary" : ""}" id="ban-advanced">Advanced</button>
          <button class="cb-btn ${bl.preset === "unlimited" ? "primary" : ""}" id="ban-unlimited">Unlimited</button>
          <input class="cb-input" id="ban-search" placeholder="Search a card to limit…" value="${q.replace(/"/g, "&quot;")}">
        </div>
        <div id="ban-rows"></div>
      `;
      const rows = box.querySelector("#ban-rows");
      if (!hits.length) {
        rows.innerHTML = `<p class="dim">No limits yet. Search a card, then set 0 / 1 / 2 / 3.</p>`;
      } else {
        for (const def of hits) {
          const cap = copyLimit(def.id, "Advanced", bl);
          const row = document.createElement("div");
          row.className = "ban-row";
          row.innerHTML = `<span class="deck-name">${def.name}</span><span class="ban-caps">${[0, 1, 2, 3].map((n) =>
            `<button data-id="${def.id}" data-n="${n}" class="${cap === n ? "on" : ""}">${n}</button>`
          ).join("")}</span>`;
          rows.appendChild(row);
        }
      }
      box.querySelector("#ban-advanced").addEventListener("click", () => {
        profile.banlist = banlistFromPreset("advanced");
        ctx.save();
        renderBanlistEditor();
        renderDeckList();
      });
      box.querySelector("#ban-unlimited").addEventListener("click", () => {
        profile.banlist = banlistFromPreset("unlimited");
        ctx.save();
        renderBanlistEditor();
        renderDeckList();
      });
      const search = box.querySelector("#ban-search");
      search.addEventListener("input", () => renderBanlistEditor());
      if (keepFocus) {
        search.focus();
        const pos = search.value.length;
        search.setSelectionRange(pos, pos);
      }
      rows.querySelectorAll("button[data-id]").forEach((b) => {
        b.addEventListener("click", () => {
          profile.banlist = setCopyLimit(editorBanlist(), b.dataset.id, Number(b.dataset.n));
          ctx.save();
          renderBanlistEditor();
          renderDeckList();
        });
      });
    }

    function renderDeckPool() {
      const pool = $("deck-pool");
      const extraTab = editor.poolTab === "extra";
      const q = editor.poolQ || "";
      const have = ownedCardDefs(profile, BRONZE_CARDS);
      pool.innerHTML = `
        <h3>YOUR CARDS · ${have.length}</h3>
        <div class="row" style="margin-bottom:8px;flex-wrap:wrap;gap:8px;">
          <button class="cb-btn ${extraTab ? "" : "primary"}" id="pool-main">MAIN</button>
          <button class="cb-btn ${extraTab ? "primary" : ""}" id="pool-extra">EXTRA</button>
          <input class="cb-input" id="pool-search" placeholder="Search owned cards…" value="${q.replace(/"/g, "&quot;")}">
        </div>
        ${fxFilterBarHtml(editor.poolFx)}
        <div class="card-grid" id="pool-grid"></div>`;
      pool.querySelector("#pool-main").addEventListener("click", () => { editor.poolTab = "main"; renderDeckPool(); });
      pool.querySelector("#pool-extra").addEventListener("click", () => { editor.poolTab = "extra"; renderDeckPool(); });
      pool.querySelectorAll(".fx-chip").forEach((b) => {
        b.addEventListener("click", () => {
          const id = b.dataset.fx;
          if (editor.poolFx.has(id)) editor.poolFx.delete(id);
          else editor.poolFx.add(id);
          renderDeckPool();
        });
      });
      const search = pool.querySelector("#pool-search");
      search.addEventListener("input", () => { editor.poolQ = search.value; renderDeckPool(); });
      if (document.activeElement?.id === "pool-search" || q) {
        search.focus();
        const pos = search.value.length;
        search.setSelectionRange(pos, pos);
      }
      const grid = pool.querySelector("#pool-grid");
      const qn = q.trim().toLowerCase();
      const owned = have
        .filter((c) => extraTab ? isExtraCard(c) : !isExtraCard(c))
        .filter((c) => {
          if (!qn) return true;
          const tags = comboTagsFor(c.id);
          const circuits = [...tags.enables, ...tags.pays].map((id) => CIRCUITS[id]?.label || id).join(" ");
          return c.name.toLowerCase().includes(qn) || c.id.includes(qn) || (c.tribe || "").toLowerCase().includes(qn)
            || effectsOf(c).some((t) => t.label.toLowerCase().includes(qn) || t.id === qn)
            || circuits.toLowerCase().includes(qn);
        })
        .filter((c) => !editor.poolFx.size || effectsOf(c).some((t) => editor.poolFx.has(t.id)));
      for (const def of owned) {
        const wrap = document.createElement("div");
        wrap.className = "card-wrap";
        const el = buildCardEl(def, { count: ownedCopies(profile, def.id) });
        el.style.setProperty("--cw", "88px");
        el.style.cursor = "pointer";
        el.title = extraTab
          ? "Hover to read · click to add to Extra · Shift-click fills to the copy cap"
          : "Hover to read · click to add to Main · Shift-click fills to the copy cap";
        bindCardHover(el, def);
        el.addEventListener("click", (e) => {
          const cap = capFor(def.id);
          if (cap <= 0) return setStatus(`${def.name} is forbidden (0 copies).`, true);
          const dest = extraTab ? editor.extra : editor.cards;
          const have = copiesInEditor(def.id);
          if (have >= cap) return setStatus(`No more copies of ${def.name} available (max ${cap}).`, true);
          const room = extraTab ? EXTRA_MAX - dest.length : Infinity;
          const n = copiesToAdd(have, cap, room, { fill: !!e.shiftKey });
          if (!n) return setStatus(extraTab ? `Extra Deck max ${EXTRA_MAX}.` : `No more copies of ${def.name}.`, true);
          for (let i = 0; i < n; i++) dest.push(def.id);
          sfx.click();
          renderDeckList();
        });
        wrap.appendChild(el);
        grid.appendChild(wrap);
      }
      if (!owned.length) {
        const empty = extraTab
          ? "No Extra Deck cards owned yet. Pull fusions from packs or craft them."
          : "Only cards you own appear here. Open packs or craft to grow the pool.";
        grid.innerHTML = `<p class="dim">${qn ? "No owned cards match that search." : empty}</p>`;
      }
    }

    function renderIdList(host, ids, title, onRemove) {
      const counts = {};
      for (const id of ids) counts[id] = (counts[id] || 0) + 1;
      host.innerHTML = `<h3>${title}</h3>`;
      const scroll = document.createElement("div");
      scroll.className = "deck-list-scroll";
      const sorted = Object.keys(counts).sort((a, b) => ((BRONZE_DB[a]?.cost || 0) - (BRONZE_DB[b]?.cost || 0)) || a.localeCompare(b));
      for (const id of sorted) {
        const def = BRONZE_DB[id];
        const row = document.createElement("div");
        row.className = "deck-row";
        row.dataset.cardId = id;
        const fx = effectsOf(def).slice(0, 3).map((t) => `<span class="fx-pip" title="${t.label}">${t.icon}</span>`).join("");
        row.innerHTML = `<span class="deck-cost">${deckPip(def)}</span><span class="deck-name">${def?.name || id}</span><span class="deck-fx">${fx}</span><span class="deck-count">x${counts[id]}</span>`;
        row.title = "Hover to read · click to remove one · Shift-click removes all copies";
        bindCardHover(row, def);
        row.addEventListener("click", (e) => {
          onRemove(id, { all: !!e.shiftKey });
          sfx.click();
          renderDeckList();
        });
        scroll.appendChild(row);
      }
      host.appendChild(scroll);
    }

    /** Circuit meter: which combo verbs this list feeds, and what pays them off. */
    function renderComboMeter() {
      const host = $("deck-combo-host");
      if (!host) return;
      const ids = [...editor.cards, ...editor.extra];
      if (!ids.length) { host.innerHTML = ""; return; }
      const rows = deckCircuits(ids);
      const glue = suggestedGlueForDeck(ids, { limit: 6 });
      host.innerHTML = `
        <p class="combo-meter-line">${deckComboLine(ids)}</p>
        <div class="combo-meter">
          ${rows.map((r) => `
            <div class="combo-meter-row ${r.live ? "live" : r.payoffs ? "warm" : "cold"}" title="${r.blurb}">
              <span class="cm-name">${r.label}</span>
              <span class="cm-bar"><i style="width:${Math.min(100, r.enablers * 4)}%"></i></span>
              <span class="cm-num">${r.enablers} feed · ${r.payoffs} payoff</span>
            </div>`).join("")}
        </div>
        ${glue.length ? `<p class="combo-glue-label">Missing glue — click to add if you own it</p>
          <div class="combo-glue">${glue.map((g) =>
            `<button type="button" class="combo-glue-chip ${circuitClass(g.circuit)}" data-glue="${g.id}" title="${g.why}">${CIRCUITS[g.circuit].label} · ${g.name}</button>`
          ).join("")}</div>` : ""}`;
      host.querySelectorAll("[data-glue]").forEach((b) => {
        b.addEventListener("click", () => {
          const id = b.dataset.glue;
          const def = BRONZE_DB[id];
          const cap = capFor(id);
          if (!def) return;
          if (cap <= 0) return setStatus(`You don't own ${def.name} yet — craft it in Collection.`, true);
          if (copiesInEditor(id) >= cap) return setStatus(`No more copies of ${def.name}.`, true);
          if (editor.cards.length >= DECK_SIZE) return setStatus(`Main deck is ${DECK_SIZE}.`, true);
          editor.cards.push(id);
          sfx.click();
          renderDeckList();
          renderDeckPool();
        });
      });
    }

    function renderDeckList() {
      const err = deckIsValid();
      const banEl = $("deck-banlist");
      if (banEl) banEl.textContent = banlistStatusLine(editor.cards, editor.extra, profile);
      const anEl = $("deck-analytics");
      if (anEl) anEl.textContent = deckAnalyticsLine(editor.cards);
      const curveHost = $("deck-curve-host");
      if (curveHost) curveHost.innerHTML = editor.cards?.length ? deckCurveHtml(editor.cards) : "";
      renderComboMeter();
      const list = $("deck-list");
      const extraEl = $("deck-extra");
      renderIdList(list, editor.cards, `MAIN — ${editor.cards.length}/${DECK_SIZE}${err && editor.cards.length ? ` <span style="color:var(--red);font-size:11px;">${err}</span>` : ""}`, (id, { all } = {}) => {
        if (all) editor.cards = removeAllCopies(editor.cards, id);
        else editor.cards.splice(editor.cards.indexOf(id), 1);
      });
      renderIdList(extraEl, editor.extra, `EXTRA — ${editor.extra.length}/${EXTRA_MAX}`, (id, { all } = {}) => {
        if (all) editor.extra = removeAllCopies(editor.extra, id);
        else editor.extra.splice(editor.extra.indexOf(id), 1);
      });
    }
  }

  /* ================= COLLECTION + crafting ================= */
  function renderCollection() {
    const ownedTotal = BRONZE_CARDS.filter((c) => (profile.collection[c.id] || 0) > 0).length;
    $("panel-collection").innerHTML = `
      <div class="panel-head">
        <h2>COLLECTION</h2>
        <p>Owned <b style="color:var(--gold)">${ownedTotal}</b> / ${BRONZE_CARDS.length} · Dust <b style="color:var(--gold)">${dustLine(profile)}</b> · Dismantle 10 · Craft 30</p>
        <p class="dim" style="font-size:12px;margin:0 0 6px;">Dust shop: ${Object.entries(DUST_SHOP).map(([r, price]) =>
          `<button class="mini-btn" data-dustbuy="${r}" ${canBuyDust(profile, r) ? "" : "disabled"}>+${DUST_SHOP_AMOUNT} ${r} · ${price}c</button>`).join(" ")}
          <span id="dust-shop-msg"></span></p>
        <div class="row">
          <input class="cb-input" id="col-search" placeholder="Search name or text…" />
          <select class="cb-select" id="col-filter">
            <option value="">All tribes</option><option>Ignis</option><option>Abyss</option><option>Terra</option><option>Neutral</option>
          </select>
          <select class="cb-select" id="col-circuit">
            <option value="">All circuits</option>
            ${Object.values(CIRCUITS).map((c) => `<option value="${c.id}">${c.label}</option>`).join("")}
          </select>
          <select class="cb-select" id="col-rarity">
            <option value="">All rarities</option>
            <option value="N">N</option><option value="R">R</option><option value="SR">SR</option><option value="UR">UR</option>
          </select>
          <label class="dim"><input type="checkbox" id="col-owned" checked> owned only</label>
        </div>
      </div>
      <div class="card-grid" id="col-grid"></div>
    `;
    const draw = () => {
      const tribe = $("col-filter").value;
      const rarity = $("col-rarity")?.value || "";
      const circuit = $("col-circuit")?.value || "";
      const q = ($("col-search")?.value || "").trim().toLowerCase();
      const ownedOnly = $("col-owned").checked;
      const grid = $("col-grid");
      grid.innerHTML = "";
      for (const def of BRONZE_CARDS) {
        if (tribe && def.tribe !== tribe) continue;
        if (rarity && def.rarity !== rarity) continue;
        if (circuit) {
          const tags = comboTagsFor(def.id);
          if (!tags.enables.includes(circuit) && !tags.pays.includes(circuit)) continue;
        }
        if (q) {
          const tags = comboTagsFor(def.id);
          const circuits = [...tags.enables, ...tags.pays].map((id) => CIRCUITS[id]?.label || id).join(" ");
          const blob = `${def.name} ${def.id} ${def.text || ""} ${circuits}`.toLowerCase();
          if (!blob.includes(q)) continue;
        }
        const owned = profile.collection[def.id] || 0;
        if (ownedOnly && !owned) continue;
        const wrap = document.createElement("div");
        wrap.className = `card-wrap col-card r-${def.rarity || "N"}`;
        const el = buildCardEl(def, { count: owned });
        el.style.setProperty("--cw", "110px");
        bindCardHover(el, def);
        if (!owned) el.style.filter = "grayscale(.9) brightness(.5)";
        if (freshPulls.has(def.id) && owned) {
          const pip = document.createElement("span");
          pip.className = "col-new";
          pip.textContent = "NEW";
          wrap.appendChild(pip);
        }
        const bar = document.createElement("div");
        bar.className = "row";
        bar.style.cssText = "justify-content:center;margin-top:6px;gap:6px;";
        const bCraft = document.createElement("button");
        bCraft.className = "mini-btn";
        bCraft.textContent = `CRAFT ${CRAFT_COST}`;
        bCraft.disabled = !canCraft(profile, def);
        bCraft.addEventListener("click", () => {
          if (craft(profile, def)) {
            ctx.save();
            showHubToast(`Crafted ${def.name} · −${CRAFT_COST} ${def.rarity} dust`, "craft");
            refreshWallet({ toast: false });
            draw();
            sfx.heal();
          }
        });
        const bDust = document.createElement("button");
        bDust.className = "mini-btn danger";
        bDust.textContent = "DUST 10";
        bDust.disabled = !canDismantle(profile, def);
        bDust.addEventListener("click", () => {
          if (dismantle(profile, def)) {
            ctx.save();
            showHubToast(`Dismantled ${def.name} · +10 ${def.rarity} dust`, "dust");
            refreshWallet({ toast: false });
            draw();
            sfx.click();
          }
        });
        bar.appendChild(bCraft);
        bar.appendChild(bDust);
        wrap.appendChild(el);
        wrap.appendChild(bar);
        grid.appendChild(wrap);
      }
    };
    $("col-filter").addEventListener("change", draw);
    $("col-rarity")?.addEventListener("change", draw);
    $("col-circuit")?.addEventListener("change", draw);
    $("col-owned").addEventListener("change", draw);
    $("col-search")?.addEventListener("input", draw);
    document.querySelectorAll("[data-dustbuy]").forEach((b) => b.addEventListener("click", () => {
      const r = b.dataset.dustbuy;
      if (buyDustWithCoins(profile, r)) {
        ctx.save();
        showHubToast(`Bought +${DUST_SHOP_AMOUNT} ${r} dust`, "dust");
        refreshWallet({ toast: false });
        renderCollection();
        sfx.chain();
      }
    }));
    draw();
  }

  /* ================= SHOP ================= */
  function renderShop() {
    const pool = poolForTier(profile.rank.tier);
    const pityLeft = 10 - (profile.packPity || 0);
    $("panel-shop").innerHTML = `
      <div class="panel-head">
        <h2>SHOP</h2>
        <p id="pack-pity-line">Pool: <b style="color:var(--teal)">${tierName(profile.rank.tier)}</b> — ${pool.length} cards · UR pity in <b>${pityLeft}</b> pack(s)</p>
      </div>
      <div class="shop-cinema">
        <div class="mode-card shop-kiosk">
          <h3>TIER PACK</h3>
          <p>10 cards from your ${tierName(profile.rank.tier)} pool. 8× N/R, 1× R+, 1× SR+ (UR pity).</p>
          <div class="pity-meter" id="pity-meter" aria-label="UR pity">${pityTicks(profile.packPity || 0)}</div>
          <div class="row" style="margin-top:12px;">
            <button class="cb-btn primary" id="btn-pack">OPEN — ${PACK_COST_GEMS} GEMS</button>
          </div>
        </div>
        <div class="shop-stage">
          <div class="card-grid pack-slam" id="pack-reveal"></div>
          <p class="dim pack-recap" id="pack-recap">Crack a pack. Click the row to skip the flip.</p>
        </div>
      </div>
    `;
    $("btn-pack").addEventListener("click", () => {
      if (!spendGems(profile, PACK_COST_GEMS)) return;
      const rng = makeRng((Date.now() ^ (Math.random() * 2 ** 31)) >>> 0);
      const cards = openPack(rng, pool, profile);
      grantCards(profile, cards);
      for (const c of cards) if (c?.id) freshPulls.add(c.id);
      ctx.save();
      refreshWallet({ toast: false });
      showHubToast(`−${PACK_COST_GEMS} gems · ${packRecapLine(cards) || "pack opened"}`, "pack");
      slamPackCards($("pack-reveal"), cards);
      const recap = $("pack-recap");
      if (recap) recap.textContent = packRecapLine(cards) || "Pack opened.";
      renderShopPityOnly();
    });
    function renderShopPityOnly() {
      $("btn-pack").disabled = !canAffordGems(profile, PACK_COST_GEMS);
      const left = 10 - (profile.packPity || 0);
      const line = $("pack-pity-line");
      if (line) {
        line.innerHTML = `Pool: <b style="color:var(--teal)">${tierName(profile.rank.tier)}</b> — ${pool.length} cards · UR pity in <b>${left}</b> pack(s)`;
      }
      const meter = $("pity-meter");
      if (meter) meter.innerHTML = pityTicks(profile.packPity || 0);
    }
  }

  function pityTicks(n) {
    const filled = Math.max(0, Math.min(10, n | 0));
    return Array.from({ length: 10 }, (_, i) =>
      `<span class="pity-tick${i < filled ? " on" : ""}"></span>`
    ).join("");
  }

  /* ================= RANKED ================= */
  function queueRanked(token) {
    const customNames = Object.keys(profile.decks);
    const t = token
      || $("ranked-you")?.value
      || pickRankedToken({ loaners: shippedLoaners(), starters: STARTERS, customNames });
    const result = tryQueueDeck(t, { ...queueCtx(), ranked: true });
    const el = $("ranked-door-msg");
    if (!result.ok) {
      refuseDoor("ranked-door-msg", result.error);
      return false;
    }
    if (el) el.textContent = "";
    saveSessionRankedToken(t);
    ctx.startRanked(result.deck, result.label, result.extra);
    return true;
  }

  function renderRanked() {
    const r = profile.rank;
    const tier = TIERS[r.tier];
    const pool = poolForTier(r.tier);
    const lpPct = tier.lpToPromo === Infinity ? 100 : Math.min(100, r.lp);
    const customNames = Object.keys(profile.decks);
    const loaners = shippedLoaners();
    const deckOpts = deckTokenOptionsHtml({ loaners, starters: STARTERS, customNames });
    const selected = pickRankedToken({ loaners, starters: STARTERS, customNames });
    $("panel-ranked").innerHTML = `
      <div class="home-ranked">
        <section class="rank-hero" style="--rank:${tier.color}">
          <div class="rank-badge" style="border-color:${tier.color};color:${tier.color}">${tier.name.toUpperCase()}</div>
          <div class="rank-info">
            <p class="home-kicker">Ladder vs CPU, or PvP when the backend is up</p>
            <h2>${rankLabel(profile)}</h2>
            <div class="lp-bar"><div class="lp-fill" style="width:${lpPct}%;background:${tier.color}"></div></div>
            ${r.promo ? `<p class="rank-promo">PROMO SERIES — win ${2 - r.promo.wins} more of ${3 - r.promo.wins - r.promo.losses} remaining (separate ranked queues)</p>` : `<p class="dim">100 LP starts a promotion series: queue ranked duels one at a time, win 2 of 3. Pool: ${pool.length} cards.</p>`}
            <p class="dim">${profile.stats.rankedWins} ranked wins · ${profile.stats.wins}W / ${profile.stats.losses}L</p>
            <div class="home-tile-row" style="margin-top:10px;">
              <select class="cb-select" id="ranked-you" title="Deck for this ranked queue">${deckOpts}</select>
              <button class="home-cta" id="btn-queue">QUEUE RANKED · VS CPU</button>
              <button class="cb-btn" id="btn-queue-pvp">QUEUE RANKED · PVP</button>
            </div>
            <p class="dim" style="font-size:11px;margin:6px 0 0;">Starters and your own lists only — loaners cover Quick Duel and Labs. Ladder soft-resets each monthly season.</p>
            <p class="dim" id="ranked-door-msg" style="font-size:12px;margin:8px 0 0;"></p>
          </div>
        </section>
        <div class="tier-track">
          ${TIERS.map((t, i) => `<div class="tier-node ${i === r.tier ? "current" : ""} ${i < r.tier ? "done" : ""}" style="border-color:${t.color}"><b>${t.name}</b><span>${poolForTier(i).length} cards</span></div>`).join("")}
        </div>
      </div>
    `;
    const sel = $("ranked-you");
    if (sel && [...sel.options].some((o) => o.value === selected)) sel.value = selected;
    sel?.addEventListener("change", () => saveSessionRankedToken(sel.value));
    $("btn-queue").addEventListener("click", () => queueRanked(sel?.value));
    $("btn-queue-pvp")?.addEventListener("click", async () => {
      const customNames = Object.keys(profile.decks);
      const t = sel?.value || pickRankedToken({ loaners: shippedLoaners(), starters: STARTERS, customNames });
      const result = tryQueueDeck(t, { ...queueCtx(), ranked: true });
      const el = $("ranked-door-msg");
      if (!result.ok) {
        refuseDoor("ranked-door-msg", result.error);
        return;
      }
      if (el) el.textContent = "Searching for a ranked opponent…";
      const session = await queueRankedPvp({
        name: profile.name || "Duelist",
        deck: result.deck,
        extra: result.extra || []
      });
      if (!session.ok) {
        if (el) el.textContent = session.reason || BACKEND_OFFLINE_REASON;
        return;
      }
      if (el) el.textContent = session.waiting ? "Waiting for another ranked queue…" : "Match found.";
      const ok = await ctx.startPeerDuel?.(session, true);
      if (!ok && el) el.textContent = "No opponent (backend dropped or queue timed out).";
    });
  }

  /* ================= MODES (draft/cube/sealed/highlander/tourney/brawl/hotseat) ================= */
  let modesView = "draft";
  const MODE_TABS = [
    ["draft", "DRAFT"], ["cube", "CUBE DRAFT"], ["sealed", "SEALED"],
    ["highlander", "HIGHLANDER"], ["tourney", "TOURNAMENT"], ["brawl", "TAVERN BRAWL"],
    ["hotseat", "HOTSEAT"], ["pvp", "HOST / JOIN"]
  ];

  function renderModes() {
    const panel = $("panel-modes");
    panel.innerHTML = `
      <div class="panel-head"><h2>GAME MODES</h2>
        <p class="dim" style="font-size:11px;">CPU modes stay offline. Host/Join uses the optional local backend.</p>
      </div>
      <div class="modes-nav">
        ${MODE_TABS.map(([k, label]) => `<button class="cb-btn mode-nav-btn ${modesView === k ? "active" : ""}" data-mode="${k}">${label}</button>`).join("")}
      </div>
      <div id="modes-detail"></div>`;
    panel.querySelectorAll(".mode-nav-btn").forEach((b) => b.addEventListener("click", () => {
      modesView = b.dataset.mode;
      sfx.click();
      renderModes();
    }));
    const box = $("modes-detail");
    if (modesView === "draft") renderDraftDetail(box, false);
    else if (modesView === "cube") renderDraftDetail(box, true);
    else if (modesView === "sealed") renderSealedDetail(box);
    else if (modesView === "highlander") renderHighlanderDetail(box);
    else if (modesView === "tourney") renderTourneyDetail(box);
    else if (modesView === "hotseat") renderHotseatDetail(box);
    else if (modesView === "pvp") renderPvpDetail(box);
    else renderBrawlDetail(box);
  }

  /* ---- draft / cube draft ---- */
  function renderDraftDetail(box, cube) {
    const key = cube ? "cube" : "draft";
    const st = profile.modes[key];
    if (!st || (st.over && st.claimed)) {
      box.innerHTML = `
        <div class="mode-intro">
          <h3>${cube ? "CUBE DRAFT" : "DRAFT"}</h3>
          <p>${cube
            ? "Pick 1 of 3 from the curated power Cube, 40 times. Bombs and counter spells everywhere — degenerate decks guaranteed."
            : "Pick 1 of 3 from the Bronze pool, 40 times, max 3 copies each. Then survive a 3-round gauntlet with escalating foe LP."}</p>
          <p class="dim">Gauntlet rewards: ${GAUNTLET_REWARDS.map((r) => `${r.wins}W=${r.gems}g${r.packs ? `+${r.packs}p` : ""}`).join(" · ")}</p>
          <button class="cb-btn primary" id="btn-draft-start">${st ? "START NEW DRAFT" : "START DRAFT"}</button>
        </div>`;
      $("btn-draft-start").addEventListener("click", () => {
        profile.modes[key] = newDraft(Math.floor(Math.random() * 2 ** 31), { cube });
        rollDraftChoices(profile.modes[key]);
        ctx.save();
        sfx.chain();
        renderModes();
      });
      return;
    }

    if (!draftDone(st)) {
      const pct = Math.round((st.picks.length / DRAFT_PICKS) * 100);
      box.innerHTML = `
        <div class="mode-intro">
          <h3>${cube ? "CUBE DRAFT" : "DRAFT"} — pick ${st.picks.length + 1}/${DRAFT_PICKS}</h3>
          <div class="lp-bar" style="margin:8px 0 14px;"><div class="lp-fill" style="width:${pct}%"></div></div>
          <div class="card-grid" id="draft-choices"></div>
        </div>`;
      const grid = $("draft-choices");
      st.choices.forEach((id, i) => {
        const el = buildCardEl(BRONZE_DB[id]);
        el.classList.add("draft-choice");
        el.id = `draft-choice-${i}`;
        el.style.setProperty("--cw", "120px");
        el.style.cursor = "pointer";
        el.addEventListener("click", () => {
          draftPick(st, id);
          ctx.save();
          sfx.click();
          renderModes();
        });
        grid.appendChild(el);
      });
      return;
    }

    // deck built — gauntlet phase
    const foeLp = GAUNTLET_FOE_LP[st.round] ?? 0;
    box.innerHTML = `
      <div class="mode-intro">
        <h3>GAUNTLET — ${st.wins} win${st.wins === 1 ? "" : "s"} so far</h3>
        <p class="dim">${st.over
          ? `Run finished: ${st.wins}/${GAUNTLET_ROUNDS} wins. Rewards claimed.`
          : `Round ${st.round + 1}/${GAUNTLET_ROUNDS} — the foe starts with +${foeLp} LP.`}</p>
        ${st.over
          ? `<button class="cb-btn primary" id="btn-draft-again">DRAFT AGAIN</button>`
          : `<button class="cb-btn primary" id="btn-gauntlet-play">PLAY ROUND ${st.round + 1}</button>`}
        <div class="deck-list-scroll tall" id="draft-deck-list" style="margin-top:14px;max-width:420px;"></div>
      </div>`;
    renderDeckCounts($("draft-deck-list"), draftDeck(st));
    if (st.over) $("btn-draft-again").addEventListener("click", () => {
      profile.modes[key] = null;
      ctx.save();
      renderModes();
    });
    else $("btn-gauntlet-play").addEventListener("click", () => ctx.startGauntlet(key));
  }

  function renderDeckCounts(container, deckIds) {
    const counts = {};
    for (const id of deckIds) counts[id] = (counts[id] || 0) + 1;
    const ids = Object.keys(counts).sort((a, b) => (BRONZE_DB[a].cost - BRONZE_DB[b].cost) || a.localeCompare(b));
    container.innerHTML = ids.map((id) => {
      const d = BRONZE_DB[id];
      return `<div class="deck-row" data-card-id="${id}"><span class="deck-cost">${deckPip(d)}</span><span class="deck-name">${d.name}</span><span class="deck-count">x${counts[id]}</span></div>`;
    }).join("");
  }

  /* ---- sealed ---- */
  const sealedBuilder = { deck: [] };

  function renderSealedDetail(box) {
    const st = profile.modes.sealed;
    if (!st) {
      box.innerHTML = `
        <div class="mode-intro">
          <h3>SEALED DECK</h3>
          <p>Crack ${6} packs from your tier pool, then build a ${SEALED_DECK_SIZE}-card deck from only what you open.
          Take it through the 3-round gauntlet.</p>
          <button class="cb-btn primary" id="btn-sealed-open">OPEN 6 PACKS</button>
        </div>`;
      $("btn-sealed-open").addEventListener("click", () => {
        profile.modes.sealed = newSealed(Math.floor(Math.random() * 2 ** 31), poolForTier(profile.rank.tier));
        sealedBuilder.deck = [];
        ctx.save();
        sfx.victory();
        renderModes();
      });
      return;
    }

    if (!st.deck) {
      const err = sealedDeckValid(st, sealedBuilder.deck);
      box.innerHTML = `
        <div class="mode-intro wide">
          <h3>SEALED — build ${SEALED_DECK_SIZE} from ${st.pool.length}</h3>
          <p class="dim" id="sealed-status">${err ? `${sealedBuilder.deck.length}/${SEALED_DECK_SIZE} — ${err}` : "Deck legal!"}</p>
          <button class="cb-btn primary" id="btn-sealed-lock" ${err ? "disabled" : ""}>LOCK DECK & ENTER GAUNTLET</button>
          <div class="deck-editor">
            <div class="deck-pool"><h3>SEALED POOL</h3><div class="card-grid" id="sealed-pool-grid"></div></div>
            <div class="deck-list"><h3>DECK</h3><div class="deck-list-scroll" id="sealed-deck-list"></div></div>
          </div>
        </div>`;
      const counts = {};
      for (const id of st.pool) counts[id] = (counts[id] || 0) + 1;
      const grid = $("sealed-pool-grid");
      for (const id of Object.keys(counts).sort()) {
        const wrap = document.createElement("div");
        wrap.className = "card-wrap";
        const el = buildCardEl(BRONZE_DB[id], { count: counts[id] });
        el.style.setProperty("--cw", "88px");
        el.style.cursor = "pointer";
        el.title = "Hover to read · click to add";
        bindCardHover(el, BRONZE_DB[id]);
        el.addEventListener("click", () => {
          const used = sealedBuilder.deck.filter((x) => x === id).length;
          if (used >= Math.min(3, counts[id])) return;
          sealedBuilder.deck.push(id);
          sfx.click();
          renderModes();
        });
        wrap.appendChild(el);
        grid.appendChild(wrap);
      }
      const list = $("sealed-deck-list");
      sealedBuilder.deck.forEach((id, idx) => {
        const d = BRONZE_DB[id];
        const row = document.createElement("div");
        row.className = "deck-row";
        row.dataset.cardId = id;
        row.innerHTML = `<span class="deck-cost">${deckPip(d)}</span><span class="deck-name">${d.name}</span><span class="deck-count">✕</span>`;
        row.title = "Hover to read · click to remove";
        row.addEventListener("click", () => { sealedBuilder.deck.splice(idx, 1); sfx.click(); renderModes(); });
        list.appendChild(row);
      });
      $("btn-sealed-lock").addEventListener("click", () => {
        if (sealedDeckValid(st, sealedBuilder.deck)) return;
        st.deck = sealedBuilder.deck.slice();
        ctx.save();
        sfx.chain();
        renderModes();
      });
      return;
    }

    // locked — gauntlet
    const foeLp = GAUNTLET_FOE_LP[st.round] ?? 0;
    box.innerHTML = `
      <div class="mode-intro">
        <h3>SEALED GAUNTLET — ${st.wins} win${st.wins === 1 ? "" : "s"}</h3>
        <p class="dim">${st.over
          ? `Finished ${st.wins}/${GAUNTLET_ROUNDS}. Rewards claimed.`
          : `Round ${st.round + 1}/${GAUNTLET_ROUNDS} — foe LP +${foeLp}.`}</p>
        ${st.over
          ? `<button class="cb-btn primary" id="btn-sealed-again">CRACK NEW PACKS</button>`
          : `<button class="cb-btn primary" id="btn-sealed-play">PLAY ROUND ${st.round + 1}</button>`}
        <div class="deck-list-scroll tall" id="sealed-deck-summary" style="margin-top:14px;max-width:420px;"></div>
      </div>`;
    renderDeckCounts($("sealed-deck-summary"), st.deck);
    if (st.over) $("btn-sealed-again").addEventListener("click", () => {
      profile.modes.sealed = null;
      sealedBuilder.deck = [];
      ctx.save();
      renderModes();
    });
    else $("btn-sealed-play").addEventListener("click", () => ctx.startGauntlet("sealed"));
  }

  /* ---- highlander ---- */
  function renderHighlanderDetail(box) {
    const customHighlander = Object.keys(profile.decks).filter((n) => {
      const main = asSavedDeck(profile.decks[n]).main;
      return main.length === 40 && isHighlander(main);
    });
    box.innerHTML = `
      <div class="mode-intro">
        <h3>HIGHLANDER</h3>
        <p>Singleton rules: no duplicates, 40 unique cards. Your starter gets deduped and refilled from your tier pool;
        so does the CPU's. Custom 40-card singleton decks can queue directly.</p>
        <div class="row" style="margin-top:14px;">
          <select class="cb-select" id="hl-you">
            ${Object.values(STARTERS).map((s) => `<option value="starter:${s.id}">★ ${s.name} (auto-singleton)</option>`).join("")}
            ${customHighlander.map((n) => `<option value="custom:${n}">${n} (singleton)</option>`).join("")}
          </select>
          <button class="cb-btn primary" id="btn-hl-start">START HIGHLANDER DUEL</button>
        </div>
      </div>`;
    $("btn-hl-start").addEventListener("click", () => {
      const [kind, key] = $("hl-you").value.split(":");
      if (kind === "starter") {
        ctx.startHighlander(STARTERS[key].deck, STARTERS[key].name.toUpperCase(), STARTERS[key].extra || []);
      } else {
        const saved = playFromSave(profile.decks[key]);
        ctx.startHighlander(saved.deck, key.toUpperCase(), saved.extra);
      }
    });
  }

  /* ---- tournament ---- */
  function renderTourneyDetail(box) {
    const t = profile.modes.tourney;
    if (!t) {
      const customDecks = Object.keys(profile.decks);
      box.innerHTML = `
        <div class="mode-intro">
          <h3>TOURNAMENT — 3-ROUND CPU GAUNTLET</h3>
          <p>Three rounds: quarterfinal, semifinal, final. Foes hit harder each round (+0/+3/+6 LP).
          Champion: +${TOURNEY_REWARDS[3].gems} gems and ${TOURNEY_REWARDS[3].packs} packs.</p>
          <div class="row" style="margin-top:14px;">
            <select class="cb-select" id="tourney-deck">
              ${Object.values(STARTERS).map((s) => `<option value="starter:${s.id}">★ ${s.name}</option>`).join("")}
              ${customDecks.map((n) => `<option value="custom:${n}">${n} (custom)</option>`).join("")}
            </select>
            <button class="cb-btn primary" id="btn-tourney-start">ENTER BRACKET</button>
          </div>
        </div>`;
      $("btn-tourney-start").addEventListener("click", () => {
        const [kind, key] = $("tourney-deck").value.split(":");
        if (kind === "starter") {
          profile.modes.tourney = newTourney(Math.floor(Math.random() * 2 ** 31), STARTERS[key].deck, STARTERS[key].extra || []);
        } else {
          const saved = playFromSave(profile.decks[key]);
          profile.modes.tourney = newTourney(Math.floor(Math.random() * 2 ** 31), saved.deck, saved.extra);
        }
        ctx.save();
        sfx.chain();
        renderModes();
      });
      return;
    }

    box.innerHTML = `
      <div class="mode-intro">
        <h3>${t.champion ? "CHAMPION!" : t.alive ? `NEXT UP: ${TOURNEY_ROUNDS[t.round]}` : "ELIMINATED"}</h3>
        <div class="bracket">
          ${TOURNEY_ROUNDS.map((r, i) => `
            <div class="bracket-round ${i < t.round || t.champion ? "done" : i === t.round && t.alive ? "current" : ""}">
              <b>${r}</b><span>${i < t.round || t.champion ? "WON" : i === t.round ? (t.alive ? "NEXT" : "LOST") : "—"}</span>
            </div>`).join("")}
        </div>
        ${t.alive
          ? `<button class="cb-btn primary" id="btn-tourney-play">PLAY ${TOURNEY_ROUNDS[t.round]}</button>`
          : `<button class="cb-btn primary" id="btn-tourney-new">NEW BRACKET</button>`}
        <div class="deck-list-scroll tall" id="tourney-deck-list" style="margin-top:14px;max-width:420px;"></div>
      </div>`;
    renderDeckCounts($("tourney-deck-list"), t.deck);
    if (t.alive) $("btn-tourney-play").addEventListener("click", () => ctx.startTourneyMatch());
    else $("btn-tourney-new").addEventListener("click", () => { profile.modes.tourney = null; ctx.save(); renderModes();     });
  }

  function activePvpList() {
    const name = profile.activeDeck;
    if (name && profile.decks?.[name]) {
      const saved = playFromSave(profile.decks[name]);
      return { deck: saved.deck, extra: saved.extra, name };
    }
    const s = STARTERS[profile.starterId] || STARTERS.ignis;
    return { deck: s.deck, extra: s.extra || [], name: s.name };
  }

  function renderPvpDetail(box) {
    const list = activePvpList();
    box.innerHTML = `
      <div class="mode-intro">
        <h3>HOST / JOIN</h3>
        <p>Two browsers, one optional backend (<code>npm run backend</code>). Airplane mode still plays vs CPU.</p>
        <p class="dim">Using <b>${list.name}</b> (active list or starter).</p>
        <div class="row" style="margin-top:14px;flex-wrap:wrap;gap:8px;">
          <button class="cb-btn primary" id="btn-pvp-host">HOST ROOM</button>
          <input class="cb-input" id="pvp-code" maxlength="6" placeholder="ROOM CODE" style="width:8em;text-transform:uppercase;">
          <button class="cb-btn" id="btn-pvp-join">JOIN</button>
        </div>
        <p class="dim" id="pvp-msg" style="margin-top:10px;"></p>
      </div>`;
    const note = (m) => { const el = $("pvp-msg"); if (el) el.textContent = m; };
    $("btn-pvp-host").addEventListener("click", async () => {
      note("Opening room…");
      const session = await createAndHost({
        name: profile.name || "Host",
        deck: list.deck,
        extra: list.extra
      });
      if (!session.ok) { note(session.reason || BACKEND_OFFLINE_REASON); return; }
      window.__CB_PVP_CODE = session.code;
      note(`Room ${session.code} — wait for a guest, then the duel starts.`);
      const ok = await ctx.startPeerDuel?.(session, false);
      if (!ok) note("Guest never joined (or backend dropped).");
    });
    $("btn-pvp-join").addEventListener("click", async () => {
      const code = formatRoomCode($("pvp-code").value);
      if (code.length < 4) { note("Enter a room code."); return; }
      note(`Joining ${code}…`);
      const session = await joinRoom(code, {
        name: profile.name || "Guest",
        deck: list.deck,
        extra: list.extra
      });
      if (!session.ok) { note(session.reason || BACKEND_OFFLINE_REASON); return; }
      const ok = await ctx.startPeerDuel?.(session, false);
      if (!ok) note("Could not start the room duel.");
    });
  }

  /* ---- hotseat (local two-player) ---- */
  function renderHotseatDetail(box) {
    const customDecks = Object.keys(profile.decks);
    box.innerHTML = `
      <div class="mode-intro">
        <h3>HOTSEAT (LOCAL)</h3>
        <p>Pass-and-play on one device. Both sides use the human UI (compositeIo <code>humanSide: "both"</code>).</p>
        <div class="row" style="margin-top:14px;flex-wrap:wrap;gap:8px;">
          <select class="cb-select" id="hs-you">
            ${Object.values(STARTERS).map((s) => `<option value="starter:${s.id}">P1 · ★ ${s.name}</option>`).join("")}
            ${customDecks.map((n) => `<option value="custom:${n}">P1 · ${n}</option>`).join("")}
          </select>
          <select class="cb-select" id="hs-foe">
            ${Object.values(STARTERS).map((s) => `<option value="starter:${s.id}" ${s.id === "abyss" ? "selected" : ""}>P2 · ★ ${s.name}</option>`).join("")}
            ${customDecks.map((n) => `<option value="custom:${n}">P2 · ${n}</option>`).join("")}
          </select>
          <button class="cb-btn primary" id="btn-hotseat-start">Hotseat (local)</button>
        </div>
      </div>`;
    $("btn-hotseat-start").addEventListener("click", () => {
      const parse = (v) => {
        const [kind, key] = v.split(":");
        if (kind === "starter") {
          return { deck: STARTERS[key].deck, extra: STARTERS[key].extra || [], name: STARTERS[key].name.toUpperCase() };
        }
        const saved = playFromSave(profile.decks[key]);
        return { deck: saved.deck, extra: saved.extra, name: key.toUpperCase() };
      };
      const a = parse($("hs-you").value);
      const b = parse($("hs-foe").value);
      (ctx.startHotseat || window.__CB?.startHotseat)?.(a.deck, b.deck, a.name, b.name, {
        extraYou: a.extra, extraFoe: b.extra
      });
    });
  }

  /* ---- tavern brawl ---- */
  function renderBrawlDetail(box) {
    const brawl = brawlForWeek();
    const claimed = profile.lastBrawl === weekKey();
    box.innerHTML = `
      <div class="mode-intro">
        <div class="event-card" style="max-width:620px;">
          <span class="event-icon">${brawl.icon}</span>
          <h3>${brawl.name}</h3>
          <p>${brawl.desc}</p>
          <p class="dim">${claimed
            ? "Weekly reward claimed — keep brawling for fun."
            : `First win this week: +${BRAWL_WIN_REWARD.gems} gems and a pack.`}</p>
          <div class="row" style="justify-content:center;">
            <button class="cb-btn primary" id="btn-brawl-start">START BRAWL DUEL</button>
          </div>
        </div>
      </div>`;
    $("btn-brawl-start").addEventListener("click", () => ctx.startBrawl());
  }

  /* ================= RULEBOOK ================= */
  const RULEBOOK_SECTIONS = [
    ["THE ARENA", `
      <p>Two duelists, <b>20 LP</b> each. Reduce your opponent to 0, or win when they must draw from an empty deck.</p>
      <p>Your side: <b>6 monster zones</b> and <b>6 spell zones</b>. Deck and GY sit on your <b>right</b>; Extra Deck and Banished on your <b>left</b> — the foe is mirrored.
      Between the boards lie <b>3 Field Lanes</b> that reshape the duel as turns pass.</p>`],
    ["TURN STRUCTURE", `
      <p>Every turn runs the classic six phases: <b>Draw Phase</b> → <b>Standby Phase</b> → <b>Main Phase 1</b> →
      <b>Battle Phase</b> (Start Step, Battle Step, Damage Step with all five windows, End Step) →
      <b>Main Phase 2</b> → <b>End Phase</b> (hand limit 6).</p>
      <p>The player who goes first <b>cannot attack on their first turn</b> — Battle Phase <i>and</i> Main Phase 2 are skipped, even for Rush.
      They also skip the opening Draw Phase (the starting hand is already 5). The second player may attack on their first turn.</p>
      <p>Fast effects can be activated in the windows between phases, at every chain, and on every summon. The phase orb on the right advances the turn.</p>`],
    ["SUMMONING & EVOLUTION", `
      <p><b>One Normal Summon or Set per turn</b>. Level 4 and below summon for free.
      Level 5–6 need <b>1 tribute</b>; Level 7+ need <b>2 tributes</b>.
      Spells activate or Set without spending a resource (Counters must still be Set a turn first).
      Special Summons from card effects are unlimited.</p>
      <p><b>Evolution Points (EP)</b>: the first player holds 2, the second 3. From your 3rd turn, once per turn you may evolve a monster:
      it gains <b>+2/+2 and Rush</b> (it may attack immediately, ignoring summoning sickness). Evolution spends EP as a game action,
      then the Evolve effect starts a Speed 1 chain (Ash Whisper can answer).</p>
      <p>Freshly summoned monsters have <b>summoning sickness</b> and cannot attack unless they have <b>Rush</b>.
      Rush still cannot attack on the going-first player's first turn.</p>`],
    ["COMBOS", `
      <p>Every card <b>feeds</b> at least one circuit and many <b>pay off</b> on another. Two cards that share a verb are a combo — three cards are a chain.</p>
      <p><b>Spellchain</b> — you activate a spell. <b>Muster</b> — a monster hits the field. <b>Overdraw</b> — you draw outside the Draw Phase. <b>Pitch</b> — a card leaves your hand. <b>Harvest</b> — a monster hits the GY. <b>Exile</b> — a card is banished.</p>
      <p>Neutral glue like Sigil Courier, Salvage Wisp, Spark Offering, and Ledger Imp goes in any deck. In a duel, a pulsing ring means a partner is already live — play the glowing card to pay off. The deck editor's circuit meter tells you when you feed a verb with no payoff.</p>`],
    ["CHAINS", `
      <p>When a card or effect is activated, a <b>chain</b> opens. Both players may respond with legal fast effects, stacking
      <b>Chain Links</b> (CL1, CL2, CL3...). When both players pass, the chain resolves <b>backwards</b> — the last link resolves first.</p>
      <p>Nothing can be added to a chain once it starts resolving. Activated spell cards hit the graveyard
      <b>simultaneously</b> after the final link resolves — all at once, not one by one.</p>`],
    ["SPELL SPEEDS", `
      <p><b>Speed 1</b> — Normal spells, Continuous spells, and ignition monster effects. They can only be activated in your own
      Main Phase 1 or 2 with an empty chain, and can <i>never</i> respond to anything.</p>
      <p><b>Speed 2</b> — Quick-Play spells and fast monster effects. They can respond to Speed 1 or 2. A Quick-Play can be played
      from hand only during <i>your</i> turn; if you set it first, it can be used on either turn — but <b>not the turn it was set</b>.</p>
      <p><b>Speed 3</b> — Counter spells. They must be set for a turn before use. Only another Counter can answer a Counter:
      the engine physically blocks Speed 2 cards from chaining to them.</p>`],
    ["MISSING THE TIMING", `
      <p>Optional effects worded <i>"When X happens: you can..."</i> only trigger if X was <b>the last thing to happen</b>.</p>
      <p><b>Jestling, Grinning Imp</b> is the living lesson: if it is destroyed as Chain Link 2 or higher, discarded as a cost,
      or used for a summon, its trigger window vanishes and the log tells you exactly why it missed.</p>
      <p>Effects worded <i>"If X..."</i> and mandatory effects <b>never</b> miss their timing.</p>`],
    ["SEGOC — SIMULTANEOUS EFFECTS", `
      <p>When several triggers fire at once, they enter the chain in a strict order:
      <b>turn player's mandatory</b> → opponent's mandatory → <b>turn player's optional</b> → opponent's optional.
      Within your own bucket you choose the order.</p>`],
    ["PRIORITY (POST-2012)", `
      <p>The turn player holds priority to act first in every open window — but there is <b>no ignition-effect priority</b>:
      summon a monster into an enemy trap and the trap can chain before the monster's effect ever starts.
      Priority passes on every window, phase change, and summon.</p>`],
    ["FIELD LANES", `
      <p>Three lanes sit between the boards, drawn from a rotating pool every duel. <b>Lane 1</b> is revealed at duel start and governs
      monster zones 1–2. <b>Lane 2</b> flips on turn 3 (zones 3–4). <b>Lane 3</b> flips on turn 5 (zones 5–6 and those spell columns).</p>
      <p>When you play a monster or set a spell, <b>click the glowing zone</b> you want — put bodies on the hot lane, park spells off a lock.
      Lanes are Snap-style twists: lone-body ATK spikes, copies into hand or the other zone, delayed wipes, hand swaps, empty-lane EP, and worse. Scout them, then build around them.</p>`],
    ["PROGRESSION", `
      <p>Ranked climbs Bronze → Silver → Gold → Platinum → Diamond → Master, 100 LP per tier. Hitting 100 LP starts a
      <b>promotion series</b>: you queue ranked duels one at a time and need 2 wins before 2 losses.
      Ranked is for your own collection (starters and custom lists); the ladder <b>soft-resets two tiers</b> each monthly season.
      Your <b>card pool grows with your tier</b> — Bronze 60, Silver unlocks the 1000 Neutral generics (any-deck staples) plus Wave C / Silver / combo core,
      then Gold, Platinum, and Diamond (full catalog, 1329). Master is prestige: the pool is already complete.</p>
      <p>Packs drop cards only from your unlocked pool. Dismantle 3 cards of a rarity to craft any 1 card of that rarity (10 CP in, 30 CP out).</p>
      <p><b>Advanced</b> limits Starfall, Lightning Tempest, Both Boards, Scream Home, Research Burn, Empty Sky, and Tactic Choice to 1 copy. Unlimited is 3.</p>`],
    ["MODES", `
      <p><b>Roguelike Run</b> — a Slay-the-Spire gauntlet: 20-card run deck, HP carries between duels, node map of battles,
      elites, rests, shops and events, relics, and a boss.</p>
      <p><b>Draft / Cube Draft</b> — pick 1-of-3 forty times, then survive a 3-round gauntlet. <b>Sealed</b> — crack 6 packs, build 30, same gauntlet.</p>
      <p><b>Highlander</b> — singleton decks. <b>Tournament</b> — a 3-round CPU gauntlet with escalating foe LP. <b>Tavern Brawl</b> — a new rule-breaking modifier every week.</p>
      <p><b>Two players</b> — Hotseat is local pass-and-play. Host/Join and ranked PvP use the optional local backend (<code>npm run backend</code>). Offline, every mode still plays vs CPU.</p>`]
  ];

  function renderRulebook() {
    profile.seenRulebook = true;
    ctx.save();
    $("panel-rulebook").innerHTML = `
      <div class="panel-head"><h2>RULEBOOK</h2><p>The complete laws of Chaind Blitz.</p></div>
      <div class="rulebook">
        ${RULEBOOK_SECTIONS.map(([title, body]) => `
          <details class="rule-section" ${title === "CHAINS" ? "open" : ""}>
            <summary>${title}</summary>
            <div class="rule-body">${body}</div>
          </details>`).join("")}
        <details class="rule-section">
          <summary>PRIVACY & CREDITS</summary>
          <div class="rule-body">
            <p>Chaind Blitz keeps progress <b>on this device</b> by default. Opt-in cloud sync mirrors the save to the optional backend. Host/Join rooms work when that backend is running.</p>
            <p>Local storage holds decks, collection, and settings. Nothing is uploaded unless you opt into cloud sync or export a backup yourself.</p>
            <p><b>Credits</b> — Chaind Blitz engine &amp; UI. Procedural card art; plaza GLTF/HDRI/PBR placeholders documented in docs/ART.md. Music/SFX are procedural beds. Third-party fonts and libraries retain their own licenses.</p>
          </div>
        </details>
      </div>`;
  }

  /* ================= RUN (roguelike) ================= */
  const NODE_ICONS = { battle: "⚔", elite: "💀", rest: "🏕", shop: "🛒", event: "❓", boss: "👑" };
  const NODE_LABELS = { battle: "Battle", elite: "Elite", rest: "Rest", shop: "Shop", event: "Event", boss: "BOSS" };

  function renderRogue() {
    const panel = $("panel-rogue");
    const run = profile.rogue;
    if (!run) {
      panel.innerHTML = `
        <div class="panel-head"><h2>ROGUELIKE RUN</h2></div>
        <div class="run-start">
          <div class="run-start-card">
            <h3>THE BLITZ GAUNTLET</h3>
            <p>Start with a 20-card run deck and 20 HP. Your HP <b>carries between duels</b> — there is no free lunch.
            Climb the node map: battles pay gold and cards, elites guard relics, rest sites mend or purge,
            the shop spends what you earn, and a boss waits at the top with +10 LP.</p>
            <p class="dim">Win the run: <b>+300 gems, +2 packs</b>. Fall on floor N: +10 gems per floor cleared.
            Best run so far: <b>${profile.stats.bestFloor || 0} floors</b>.</p>
            <button class="cb-btn primary big" id="btn-run-start">ENTER THE GAUNTLET</button>
          </div>
        </div>`;
      $("btn-run-start").addEventListener("click", () => ctx.startRogue());
      return;
    }

    const hpPct = Math.max(0, Math.min(100, (run.hp / run.maxHp) * 100));
    panel.innerHTML = `
      <div class="panel-head">
        <h2>ROGUELIKE RUN</h2>
        <div class="row">
          <button class="cb-btn" id="btn-run-deck">RUN DECK (${run.deck.length})</button>
          <button class="cb-btn danger" id="btn-run-abandon">ABANDON</button>
        </div>
      </div>
      <div class="run-hud">
        <div class="run-hp">
          <span class="run-hp-label">HP ${run.hp}/${run.maxHp}</span>
          <div class="run-hp-bar"><div style="width:${hpPct}%"></div></div>
        </div>
        <div class="run-stat">🪙 <b>${run.gold}</b></div>
        <div class="run-stat">FLOOR <b>${run.floor}</b></div>
        <div class="run-relics">${run.relics.length
          ? run.relics.map((id) => `<span class="relic-chip" title="${RELICS[id].name} — ${RELICS[id].desc}">${RELICS[id].icon}</span>`).join("")
          : '<span class="dim">no relics yet</span>'}</div>
      </div>
      <div id="rogue-main"></div>
      <div class="run-log">${run.log.slice(-8).map((l) => `<div>› ${l}</div>`).join("")}</div>
    `;

    $("btn-run-deck").addEventListener("click", () => showRunDeck(run));
    $("btn-run-abandon").addEventListener("click", () => {
      if (!confirm("Abandon this run? No rewards are paid.")) return;
      profile.rogue = null;
      ctx.save();
      sfx.defeat();
      renderRogue();
      renderPlay();
    });

    const main = $("rogue-main");
    if (run.pendingReward) return renderRunReward(run, main);
    if (run.pendingRelic) return renderRunRelics(run, main);
    if (run.pendingEvent) return renderRunEvent(run, main);
    if (run.pendingShop) return renderRunShop(run, main);
    if (run.pendingRest) return renderRunRest(run, main);
    renderRunMap(run, main);
  }

  function afterRunAction() {
    ctx.save();
    renderRogue();
    renderPlay();
  }

  /* ---- map ---- */
  function renderRunMap(run, main) {
    main.innerHTML = `<div class="rogue-map-wrap"><svg class="rogue-edges" id="rogue-edges"></svg><div class="rogue-map" id="rogue-map"></div></div>`;
    const map = $("rogue-map");
    for (const col of run.map) {
      const colEl = document.createElement("div");
      colEl.className = "rogue-col";
      for (const n of col) {
        const b = document.createElement("button");
        b.className = `rogue-node ${n.type} ${n.state}`;
        b.dataset.nodeId = n.id;
        b.innerHTML = `<span class="node-icon">${NODE_ICONS[n.type]}</span><span class="node-label">${NODE_LABELS[n.type]}</span>`;
        b.disabled = !canEnter(run, n.id);
        if (n.state === "active") b.classList.add("active");
        b.addEventListener("click", () => {
          const node = enterNode(run, n.id);
          if (!node) return;
          sfx.click();
          if (node.type === "battle" || node.type === "elite" || node.type === "boss") {
            ctx.startRogueBattle(node);
            return; // duel screen takes over; hub re-renders on return
          }
          if (node.type === "rest") openRest(run);
          else if (node.type === "shop") openShop(run, poolForTier(profile.rank.tier));
          else if (node.type === "event") openEvent(run);
          afterRunAction();
        });
        colEl.appendChild(b);
      }
      map.appendChild(colEl);
    }
    // edges after layout
    requestAnimationFrame(() => {
      const svg = $("rogue-edges");
      if (!svg) return;
      const wrap = svg.parentElement.getBoundingClientRect();
      const pos = {};
      map.querySelectorAll(".rogue-node").forEach((el) => {
        const r = el.getBoundingClientRect();
        pos[el.dataset.nodeId] = { x: r.left - wrap.left + r.width / 2, y: r.top - wrap.top + r.height / 2 };
      });
      svg.setAttribute("viewBox", `0 0 ${wrap.width} ${wrap.height}`);
      let lines = "";
      for (const col of run.map) for (const n of col) {
        for (const t of n.next) {
          const a = pos[n.id], b2 = pos[t];
          if (a && b2) lines += `<line x1="${a.x}" y1="${a.y}" x2="${b2.x}" y2="${b2.y}" class="edge ${n.state === "cleared" ? "done" : ""}"/>`;
        }
      }
      svg.innerHTML = lines;
    });
  }

  /* ---- card reward ---- */
  function renderRunReward(run, main) {
    main.innerHTML = `
      <div class="run-screen">
        <h3>BATTLE SPOILS — pick one card</h3>
        <div class="card-grid" id="run-reward-grid"></div>
        <button class="cb-btn" id="btn-reward-skip">SKIP</button>
      </div>`;
    const grid = $("run-reward-grid");
    run.pendingReward.choices.forEach((id, i) => {
      const el = buildCardEl(BRONZE_DB[id]);
      el.id = `reward-pick-${i}`;
      el.style.setProperty("--cw", "120px");
      el.style.cursor = "pointer";
      el.addEventListener("click", () => {
        pickReward(run, id);
        sfx.evolve();
        afterRunAction();
      });
      grid.appendChild(el);
    });
    $("btn-reward-skip").addEventListener("click", () => { pickReward(run, null); afterRunAction(); });
  }

  /* ---- relic reward ---- */
  function renderRunRelics(run, main) {
    main.innerHTML = `
      <div class="run-screen">
        <h3>ELITE SPOILS — claim a relic</h3>
        <div class="relic-grid" id="run-relic-grid"></div>
      </div>`;
    const grid = $("run-relic-grid");
    run.pendingRelic.choices.forEach((id, i) => {
      const r = RELICS[id];
      const b = document.createElement("button");
      b.className = "relic-card";
      b.id = `relic-pick-${i}`;
      b.innerHTML = `<span class="relic-icon">${r.icon}</span><b>${r.name}</b><p>${r.desc}</p>`;
      b.addEventListener("click", () => { pickRelic(run, id); sfx.victory(); afterRunAction(); });
      grid.appendChild(b);
    });
  }

  /* ---- event ---- */
  function renderRunEvent(run, main) {
    const ev = EVENTS[run.pendingEvent];
    main.innerHTML = `
      <div class="run-screen">
        <div class="event-card">
          <span class="event-icon">${ev.icon}</span>
          <h3>${ev.title}</h3>
          <p>${ev.text}</p>
          <div class="row" id="event-opts"></div>
        </div>
      </div>`;
    const opts = $("event-opts");
    ev.options.forEach((opt, i) => {
      const b = document.createElement("button");
      b.className = "cb-btn primary";
      b.id = `event-opt-${i}`;
      b.textContent = opt.label;
      b.disabled = !!(opt.needsGold && run.gold < opt.needsGold);
      b.addEventListener("click", () => { if (applyEvent(run, i, poolForTier(profile.rank.tier))) { sfx.lane(); afterRunAction(); } });
      opts.appendChild(b);
    });
  }

  /* ---- shop ---- */
  function renderRunShop(run, main) {
    const s = run.pendingShop;
    main.innerHTML = `
      <div class="run-screen">
        <h3>TRAVELING SHOP <span class="dim">— your gold: 🪙 ${run.gold}</span></h3>
        <div class="shop-grid" id="run-shop-cards"></div>
        <div class="row shop-services" id="shop-services"></div>
        <div id="shop-remove-zone"></div>
        <button class="cb-btn primary" id="btn-shop-leave">LEAVE SHOP</button>
      </div>`;
    const grid = $("run-shop-cards");
    s.cards.forEach((item, i) => {
      const wrap = document.createElement("div");
      wrap.className = "card-wrap";
      const el = buildCardEl(BRONZE_DB[item.id]);
      el.style.setProperty("--cw", "105px");
      wrap.appendChild(el);
      const b = document.createElement("button");
      b.className = "mini-btn";
      b.id = `shop-buy-${i}`;
      b.textContent = item.sold ? "SOLD" : `BUY ${item.price}g`;
      b.disabled = item.sold || run.gold < item.price;
      b.addEventListener("click", () => { if (buyShopCard(run, i)) { sfx.chain(); afterRunAction(); } });
      wrap.appendChild(b);
      grid.appendChild(wrap);
    });
    const svc = $("shop-services");
    if (s.relic) {
      const rb = document.createElement("button");
      rb.className = "relic-card small";
      rb.id = "shop-buy-relic";
      rb.innerHTML = `<span class="relic-icon">${RELICS[s.relic.id].icon}</span><b>${RELICS[s.relic.id].name}</b><p>${RELICS[s.relic.id].desc}</p><b>${s.relic.sold ? "SOLD" : `${s.relic.price}g`}</b>`;
      rb.disabled = s.relic.sold || run.gold < s.relic.price;
      rb.addEventListener("click", () => { if (buyShopRelic(run)) { sfx.victory(); afterRunAction(); } });
      svc.appendChild(rb);
    }
    const rm = document.createElement("button");
    rm.className = "cb-btn";
    rm.id = "shop-remove";
    rm.textContent = s.removeSold ? "REMOVAL USED" : `REMOVE A CARD — ${s.removePrice}g`;
    rm.disabled = s.removeSold || run.gold < s.removePrice;
    rm.addEventListener("click", () => {
      $("shop-remove-zone").innerHTML = `<p class="dim">Click a card in your run deck to purge it:</p><div class="deck-list-scroll tall" id="shop-remove-list"></div>`;
      renderRunDeckList($("shop-remove-list"), run, (idx) => {
        if (buyShopRemove(run, idx)) { sfx.chain(); afterRunAction(); }
      });
    });
    svc.appendChild(rm);
    $("btn-shop-leave").addEventListener("click", () => { leaveShop(run); afterRunAction(); });
  }

  /* ---- rest ---- */
  function renderRunRest(run, main) {
    const both = hasRelic(run, "purge_stone");
    const queued = { heal: false, removeIdx: null };
    main.innerHTML = `
      <div class="run-screen">
        <div class="event-card">
          <span class="event-icon">🏕</span>
          <h3>REST SITE</h3>
          <p>Embers crackle. Heal <b>${restHealAmount(run)} HP</b>${both ? " and/or purge a card (Purge Stone lets you do both)." : ", or purge a card from your run deck."}</p>
          <div class="row">
            <button class="cb-btn primary" id="btn-rest-heal">HEAL ${restHealAmount(run)} HP</button>
            <button class="cb-btn" id="btn-rest-remove">PURGE A CARD</button>
            ${both ? '<button class="cb-btn" id="btn-rest-done">DONE</button>' : ""}
          </div>
          <div id="rest-remove-zone"></div>
        </div>
      </div>`;
    const finish = () => {
      if (applyRest(run, queued)) { sfx.heal?.(); afterRunAction(); }
    };
    $("btn-rest-heal").addEventListener("click", () => {
      if (both) { queued.heal = true; $("btn-rest-heal").disabled = true; $("btn-rest-heal").textContent = "HEAL QUEUED ✓"; }
      else { queued.heal = true; finish(); }
    });
    $("btn-rest-remove").addEventListener("click", () => {
      $("rest-remove-zone").innerHTML = `<div class="deck-list-scroll tall" id="rest-remove-list"></div>`;
      renderRunDeckList($("rest-remove-list"), run, (idx) => {
        if (both) { queued.removeIdx = idx; $("rest-remove-zone").innerHTML = `<p class="dim">Purge queued. Press DONE.</p>`; }
        else { queued.removeIdx = idx; finish(); }
      });
    });
    if (both) $("btn-rest-done").addEventListener("click", finish);
  }

  /* ---- run deck viewer ---- */
  function renderRunDeckList(container, run, onPick) {
    container.innerHTML = "";
    run.deck.forEach((id, idx) => {
      const def = BRONZE_DB[id];
      const row = document.createElement("div");
      row.className = "deck-row";
      row.dataset.cardId = id;
      row.innerHTML = `<span class="deck-cost">${deckPip(def)}</span><span class="deck-name">${def.name}</span><span class="deck-count">${def.type === "spell" ? "✦" : `${def.atk}/${def.def}`}</span>`;
      if (onPick) {
        row.title = "Click to choose";
        row.addEventListener("click", () => onPick(idx));
      }
      container.appendChild(row);
    });
  }

  function showRunDeck(run) {
    const modal = document.createElement("div");
    modal.className = "cb-modal";
    modal.innerHTML = `
      <div class="cb-modal-card">
        <div class="row" style="justify-content:space-between;"><h3>RUN DECK — ${run.deck.length} cards</h3><button class="cb-btn" id="modal-close">CLOSE</button></div>
        <div class="deck-list-scroll tall" id="run-deck-list"></div>
      </div>`;
    document.body.appendChild(modal);
    renderRunDeckList(modal.querySelector("#run-deck-list"), run, null);
    modal.querySelector("#modal-close").addEventListener("click", () => modal.remove());
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
  }

  function renderAll() {
    refreshWallet();
    renderPlay();
    renderDeck();
    renderCollection();
    renderShop();
    renderRanked();
    renderRogue();
    renderModes();
    renderRulebook();
  }

  renderAll();
  return {
    renderAll,
    refreshWallet,
    queueRanked,
    renderers: {
      play: renderPlay,
      deck: renderDeck,
      collection: renderCollection,
      shop: renderShop,
      ranked: renderRanked,
      rogue: renderRogue,
      modes: renderModes,
      rulebook: renderRulebook
    }
  };
}

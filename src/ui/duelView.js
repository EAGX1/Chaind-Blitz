// Duel screen renderer: mirrors engine state into the DOM.
// Re-renders cheaply after every engine decision; log is append-only.

import { P, getATK, getDEF, remainingHealth, opp, cannotAttackReason, isFirstTurnNoBattle, canEvolveNow, cardByUid, cardStatusBadges } from "../engine/index.js";
import { applyPlayHint, inspectorPlayBits } from "./playHints.js";
import { phaseSentence } from "./phaseSentence.js";
import { installHelpOverlay } from "./helpOverlay.js";
import { loadSettings, saveSettings, CHAIN_MODES } from "./settingsStore.js";
import { laneTheme } from "../data/fields.js";
import { buildCardEl, cardBackEl } from "./cardArt.js";
import { pulsePhase, splashTurn, juiceOk } from "./juice.js";
import { sfx, fxNumberOnElement } from "./fx.js";
import { openGyBrowser, openExtraBrowser } from "./gyBrowser.js";
import { getHoverAnchor } from "./cardHover.js";
import { relatedCardsFor, recipeLines, relatedInspectCard } from "./relatedCards.js";
import { teachCoachLine, isTeachDuel } from "./teachDuel.js";
import { lastPlayTiles, shortenPlayMsg, highlightLogIndex, LOG_FILTERS, logRowIsVisible, loadSessionLogFilter, saveSessionLogFilter } from "./playHistory.js";
import { chainLifoCaption } from "./chainPicker.js";
import { formatDuelLog, copyText, logLineText } from "./duelLogText.js";
import { installIdleBoardKeys } from "./idleKeys.js";
import { paintCombatOverlay, clearCombatOverlay } from "./combatOverlay.js";
import { CARD_DB } from "../data/cards/index.js";
import { comboTagsFor, comboPartnersFor, CIRCUITS, circuitClass } from "../data/comboTags.js";
import { announce, installAnnounceRepeat } from "./liveAnnounce.js";
import { harvestSeen, handFaceUp } from "./seenSet.js";
import { watchDrag, reorderHandList } from "./dragPlay.js";
import { playStinger } from "../meta/music.js";

const $ = (id) => document.getElementById(id);

function liveCardStats(G, c) {
  const hp = remainingHealth(G, c);
  const printed = getDEF(G, c);
  return { atk: getATK(G, c), def: printed, printedDef: printed, hp };
}

function coachTip(G) {
  if (G.meta?.labs === "fanfare_lane") {
    return "LABS: Normal Summon Heal Bloom into Lane 1 (Mirror Pool). Fanfare still heals 2 — the lane draw happens after.";
  }
  if (G.meta?.labs === "ward") {
    return "LABS: End Main, then attack. You must hit Ward Sentinel — Ember Fox is illegal (tap it to see why).";
  }
  if (G.meta?.labs === "contact") {
    return "LABS: Click Contact Fusion Pyre Wyrm. Ember Fox + Cinder Knight are already on the field.";
  }
  if (G.meta?.labs === "counter") {
    return "LABS: Opponent activated a Speed 1 spell. Chain Null Seal (SS3). A Speed 2 Quick cannot answer that counter.";
  }
  if (G.meta?.labs === "ambush") {
    return "LABS: End Main, then attack the face-down monster. Ambush flips it face-up and its Fanfare fires.";
  }
  if (G.meta?.labs === "tribute") {
    return "LABS: Tribute Ember Fox, then Normal Summon Gem Golem. Level 5 needs one tribute.";
  }
  if (G.meta?.labs === "damage_step") {
    return "LABS: Attack, then chain Surge Imp during damage calculation. Click the card face — not a second Confirm.";
  }
  if (isTeachDuel(G)) return teachCoachLine(G);
  if (isFirstTurnNoBattle(G) && G.phase !== "EP") {
    return "First turn: no Battle Phase and no Main Phase 2 — even Rush.";
  }
  if (G.phase === "BP") {
    return "Battle: click an attacker, then a target or Direct Attack. Combat is ATK vs ATK. Illegal targets stay visible with a reason.";
  }
  if (G.phase === "M1" || G.phase === "M2") {
    const pl = P(G, G.tp);
    if (canEvolveNow(G, G.tp) && G.tp === 0) {
      return "Evolve ready: click a monster. If it also has an ignition, pick Evolve on the prompt.";
    }
    if ((pl.ownTurnCount || 0) >= 3) {
      return "Evolve: click a monster you control (1 EP, +2/+2 and Rush).";
    }
    if (G.firstPlayer === 1 && G.tp === 0 && G.turnCount <= 2) {
      return "You went second: 3 EP. LV4 summons free. You may attack this turn.";
    }
    return "Main Phase: click a glowing card. LV4 summons free. LV5+ needs tributes. Spells do not spend a resource.";
  }
  return "";
}

export function createDuelView(G) {
  const last = { lp: [20, 20], lanesRevealed: [true, false, false] };
  const logEl = $("duel-log");
  // render signatures: skip DOM rebuilds for regions whose state didn't change,
  // so unchanged cards keep their elements (no entrance-animation flicker,
  // no lost hover/click state)
  const sig = { hand: ["", ""], lanes: "", chain: "", orb: "", turn: "" };
  const wellsWired = { 0: false, 1: false };
  let pinnedUid = null;
  let inspectKeysWired = false;

  function wireCopyLog() {
    const btn = $("btn-copy-log");
    if (!btn || btn.dataset.wired) return;
    btn.dataset.wired = "1";
    btn.addEventListener("click", () => {
      const ok = copyText(formatDuelLog(G.log));
      btn.textContent = ok ? "COPIED" : "COPY FAILED";
      setTimeout(() => { if (btn.isConnected) btn.textContent = "COPY LOG"; }, 1400);
    });
  }
  wireCopyLog();

  function wireWellClicks(p) {
    if (wellsWired[p]) return;
    wellsWired[p] = true;
    const openGy = () => openGyBrowser(G, p);
    for (const id of [`gy-${p}`, `ban-${p}`]) {
      const el = $(id);
      if (!el) continue;
      el.style.cursor = "pointer";
      el.title = (el.title || "") + " — click to browse";
      el.addEventListener("click", openGy);
    }
    const extra = $(`extra-${p}`);
    if (extra) {
      extra.style.cursor = "pointer";
      extra.title = (extra.title || "") + " — click to browse";
      extra.addEventListener("click", () => openExtraBrowser(G, p));
    }
  }

  function epRow(p) {
    const pl = P(G, p);
    const ready = p === 0 && G.tp === 0 && canEvolveNow(G, 0);
    let html = `<span class="ep-label">EP</span>`;
    const max = p === G.firstPlayer ? 2 : 3;
    for (let i = 0; i < max; i++) {
      html += `<span class="ep-pip ${i < pl.ep ? "full" : ""} ${ready && i < pl.ep ? "ready" : ""}" title="${ready ? "Evolve ready" : "Evolution Point"}"></span>`;
    }
    return html;
  }

  function renderHud(p) {
    const pl = P(G, p);
    const lpEl = $(`lp-${p}`);
    const newLp = pl.lp;
    if (last.lp[p] !== newLp) {
      lpEl.classList.remove("lp-hit", "lp-heal");
      void lpEl.offsetWidth;
      const delta = newLp - last.lp[p];
      lpEl.classList.add(delta < 0 ? "lp-hit" : "lp-heal");
      fxNumberOnElement(lpEl, delta > 0 ? `+${delta}` : String(delta), delta > 0 ? "heal" : "dmg");
      last.lp[p] = newLp;
      const who = p === 0 ? "You" : "Foe";
      announce(`${who} LP ${newLp} (${delta > 0 ? "+" : ""}${delta})`, { assertive: delta < 0 });
    }
    lpEl.textContent = newLp;
    $(`ep-${p}`).innerHTML = epRow(p);
    $(`hcount-${p}`).textContent = pl.hand.length;
    $(`dcount-${p}`).textContent = pl.deck.length;
  }

  let revealFoe = false;
  const seenUids = new Set();

  function reorderHand(fromUid, ontoUid) {
    const pl = P(G, 0);
    const next = reorderHandList(pl.hand, fromUid, ontoUid);
    if (next.map((c) => c.uid).join() === pl.hand.map((c) => c.uid).join()) return;
    pl.hand = next;
    const rail = $("hand-0");
    if (rail) {
      const map = new Map([...rail.querySelectorAll("[data-uid]")].map((n) => [Number(n.dataset.uid), n]));
      for (const c of next) {
        const n = map.get(c.uid);
        if (n) rail.appendChild(n);
      }
    }
    sig.hand[0] = next.map((c) => `${c.uid}:${getATK(G, c)}:${getDEF(G, c)}:${c.dmg}`).join(",");
  }

  function wireHandReorder() {
    const rail = $("hand-0");
    if (!rail || rail.dataset.reorderWired) return;
    rail.dataset.reorderWired = "1";
    rail.addEventListener("pointerdown", (e) => {
      const el = e.target.closest("#hand-0 [data-uid]");
      if (!el || el.classList.contains("selectable")) return;
      const uid = Number(el.dataset.uid);
      const drag = watchDrag(el, {
        onDrop(drop) {
          if (drop?.kind !== "hand") return;
          reorderHand(uid, drop.uid);
        }
      });
      drag.down(e);
    });
  }
  wireHandReorder();

  function renderHand(p) {
    const rail = $(`hand-${p}`);
    const cards = P(G, p).hand;
    const faceAll = p === 0 || revealFoe;
    const s = faceAll
      ? cards.map((c) => `${c.uid}:${getATK(G, c)}:${getDEF(G, c)}:${c.dmg}`).join(",")
      : cards.map((c) => `${c.uid}:${handFaceUp(c, { seen: seenUids }) ? 1 : 0}`).join(",");
    if (sig.hand[p] === s) {
      hintHand(rail, cards);
      return;
    }
    const prevUids = new Set(
      sig.hand[p].split(",").map((tok) => Number(tok.split(":")[0])).filter((n) => Number.isFinite(n) && n > 0)
    );
    sig.hand[p] = s;
    rail.innerHTML = "";
    for (const c of cards) {
      const face = faceAll || handFaceUp(c, { seen: seenUids });
      const el = face ? buildCardEl(c, { stats: liveCardStats(G, c) }) : cardBackEl();
      el.dataset.uid = c.uid;
      if (juiceOk() && prevUids.size && !prevUids.has(c.uid)) el.classList.add("hand-enter");
      attachInspect(el, c);
      applyPlayHint(el, G, c);
      rail.appendChild(el);
    }
    if (p === 0) paintComboLive();
  }

  function hintHand(rail, cards) {
    if (!rail) return;
    for (const c of cards) {
      const el = rail.querySelector(`[data-uid="${c.uid}"]`);
      applyPlayHint(el, G, c);
    }
    paintComboLive();
  }

  function circuitSetsFrom(cards) {
    const enables = new Set();
    const pays = new Set();
    for (const c of cards) {
      if (!c) continue;
      const t = comboTagsFor(c.id);
      for (const x of t.enables) enables.add(x);
      for (const x of t.pays) pays.add(x);
    }
    return { enables, pays };
  }

  function comboHit(id, others) {
    const t = comboTagsFor(id);
    return t.pays.find((x) => others.enables.has(x)) || t.enables.find((x) => others.pays.has(x)) || null;
  }

  function markComboLive(el, hit) {
    if (!el) return;
    el.classList.toggle("combo-live", !!hit);
    if (hit) {
      el.dataset.circuit = hit;
      el.title = `Combo live: ${CIRCUITS[hit].label} — ${CIRCUITS[hit].blurb}`;
    } else {
      delete el.dataset.circuit;
    }
  }

  /** Ring a hand card when a circuit partner is on the board, and the reverse. */
  function paintComboLive() {
    const mine = [...P(G, 0).mz, ...P(G, 0).stz].filter((c) => c && c.faceup);
    const hand = P(G, 0).hand || [];
    const fromBoard = circuitSetsFrom(mine);
    const fromHand = circuitSetsFrom(hand);
    const rail = $("hand-0");
    if (rail) {
      for (const c of hand) markComboLive(rail.querySelector(`[data-uid="${c.uid}"]`), comboHit(c.id, fromBoard));
    }
    for (const c of mine) {
      const el = document.querySelector(`#mz-0 [data-uid="${c.uid}"], #stz-0 [data-uid="${c.uid}"]`);
      markComboLive(el, comboHit(c.id, fromHand));
    }
  }

  function renderZones(p) {
    for (const kind of ["mz", "stz"]) {
      const row = $(`${kind}-${p}`);
      for (let z = 0; z < 6; z++) {
        let zone = row.children[z];
        if (!zone) {
          zone = document.createElement("div");
          zone.className = "zone";
          zone.dataset.zone = `${kind}-${p}-${z}`;
          zone.dataset.sig = "";
          row.appendChild(zone);
        }
        const c = P(G, p)[kind][z];
        const li = z < 2 ? 0 : z < 4 ? 1 : 2;
        const lane = G.lanes?.[li];
        zone.dataset.theme = lane?.revealed ? laneTheme(lane.def.id) : "";
        const sealed = kind === "mz" ? isZoneLocked(p, z) : isSpellZoneLocked(p, z);
        zone.classList.toggle("locked-zone", sealed);
        const faceDown = !!c && kind === "stz" && !c.faceup;
        const evoReady = !!(c && kind === "mz" && p === 0 && G.tp === 0 && (G.phase === "M1" || G.phase === "M2")
          && canEvolveNow(G, 0) && c.faceup && !c.evolved);
        const badges = c ? cardStatusBadges(G, c).map((b) => b.id).join(",") : "";
        const prevDmg = Number(zone.dataset.dmg || 0);
        const locked = !!(c && kind === "stz" && !c.faceup && c.setTurn === G.turnCount);
        const cardSig = c ? `${c.uid}|${getATK(G, c)}|${getDEF(G, c)}|${faceDown ? 1 : 0}|${c.evolved ? 1 : 0}|${c.dmg}|${evoReady ? 1 : 0}|${c.negated ? 1 : 0}|${badges}|${locked ? 1 : 0}` : "";
        if (zone.dataset.sig === cardSig) {
          applyPlayHint(zone.querySelector(".cb-card"), G, c);
          continue; // unchanged: keep the live element
        }
        zone.dataset.sig = cardSig;
        const prevUid = zone.dataset.cardUid || "";
        zone.innerHTML = "";
        if (c) {
          const el = buildCardEl(c, { faceDown, stats: liveCardStats(G, c) });
          el.dataset.uid = c.uid;
          if (evoReady) el.classList.add("evolve-ready");
          if (juiceOk() && prevUid !== String(c.uid)) el.classList.add("board-enter");
          paintStatusBadges(el, G, c);
          attachInspect(el, c);
          applyPlayHint(el, G, c);
          zone.appendChild(el);
          if (c.dmg > prevDmg) fxNumberOnElement(el, `-${c.dmg - prevDmg}`, "dmg");
          zone.dataset.cardUid = String(c.uid);
        } else {
          zone.dataset.cardUid = "";
        }
        zone.dataset.dmg = c ? String(c.dmg || 0) : "0";
      }
    }
    if (p === 0) paintComboLive();
  }

  function isZoneLocked(p, z) {
    for (const lane of G.lanes) {
      if (lane.revealed && lane.def.locksZone && lane.def.locksZone(G, lane, p, z)) return true;
    }
    return false;
  }
  function isSpellZoneLocked(p, z) {
    for (const lane of G.lanes) {
      if (lane.revealed && lane.def.locksSpellZone && lane.def.locksSpellZone(G, lane, p, z)) return true;
    }
    return false;
  }

  function renderLanes() {
    const row = $("lanes");
    const s = G.lanes.map((l) => (l.revealed ? l.def.id : "?")).join(",");
    if (sig.lanes === s) return;
    sig.lanes = s;
    row.innerHTML = "";
    G.lanes.forEach((lane, i) => {
      const el = document.createElement("div");
      const due = i === 0 ? 1 : i === 1 ? 3 : 5;
      if (lane.revealed) {
        el.className = "lane";
        el.dataset.theme = laneTheme(lane.def.id);
        if (!last.lanesRevealed[i]) {
          el.classList.add("revealing");
          last.lanesRevealed[i] = true;
          sfx.lane();
        }
        el.innerHTML = `<span class="lane-tag">LANE ${i + 1}</span><div class="lane-inner"><div class="lane-name">${lane.def.name}</div><div class="lane-text">${lane.def.text}</div></div>`;
        el.style.cursor = "pointer";
        el.title = "Click for who this lane is modifying";
        el.addEventListener("click", () => showLaneBreakdown(lane, i));
      } else {
        el.className = "lane hidden-lane";
        el.innerHTML = `<div class="lane-inner"><div class="lane-q">?</div><div class="lane-text">Reveals on turn ${due}</div></div>`;
      }
      row.appendChild(el);
    });
  }

  function renderWells(p) {
    const pl = P(G, p);
    const setCount = (id, n) => {
      const el = $(id);
      if (el) el.querySelector("b").textContent = n;
    };
    setCount(`deck-${p}`, pl.deck.length);
    setCount(`gy-${p}`, pl.gy.length);
    setCount(`ban-${p}`, pl.ban.length);
    setCount(`extra-${p}`, (pl.extra || []).length);
    wireWellClicks(p);
  }

  function renderOrb() {
    const spoken = phaseSentence(G);
    $("orb-turn").textContent = `T${G.turnCount} · ${G.tp === 0 ? "YOU" : "FOE"}`;
    $("orb-phase").textContent = spoken.code;
    const hint = $("orb-hint");
    if (hint) hint.textContent = spoken.hint;
    $("phase-orb").title = `${spoken.sentence} · click to end · F1 shortcuts`;
    $("phase-orb").classList.toggle("your-turn", G.tp === 0);
    const arena = $("arena");
    arena?.classList.toggle("your-turn", G.tp === 0);
    arena?.classList.toggle("foe-turn", G.tp !== 0);
    const live = !G.over && G.players?.every((pl) => pl.mulliganDone);
    const turnKey = `${G.turnCount}|${G.tp}`;
    if (live && sig.turn !== turnKey) {
      const side = G.tp === 0 ? "you" : "foe";
      splashTurn(side);
      playStinger(side === "you" ? "turnYou" : "turnFoe");
      announce(side === "you" ? "Your turn" : "Opponent's turn");
      sig.turn = turnKey;
    }
    const orbKey = `${G.turnCount}|${G.tp}|${G.phase}|${G.battleStep || ""}`;
    if (sig.orb && sig.orb !== orbKey) pulsePhase();
    sig.orb = orbKey;
    let banner = $("first-turn-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "first-turn-banner";
      banner.className = "first-turn-banner";
      const orb = $("phase-orb");
      orb?.parentElement?.insertBefore(banner, orb);
    }
    const showSkip = isFirstTurnNoBattle(G) && G.phase !== "EP";
    banner.hidden = false;
    banner.textContent = showSkip
      ? "First turn — no Battle Phase or Main Phase 2"
      : spoken.sentence;

    let coach = $("coach-banner");
    if (!coach) {
      coach = document.createElement("div");
      coach.id = "coach-banner";
      coach.className = "coach-banner";
      banner.parentElement?.insertBefore(coach, banner.nextSibling);
    }
    const tip = (window.__CB_TEACH || G.meta?.labs || isTeachDuel(G)) ? coachTip(G) : "";
    coach.hidden = !tip;
    coach.textContent = tip;
  }

  function paintStatusBadges(el, g, c) {
    const badges = cardStatusBadges(g, c);
    if (!badges.length) return;
    const wrap = document.createElement("div");
    wrap.className = "status-badges";
    for (const b of badges) {
      const s = document.createElement("span");
      s.className = `status-badge badge-${b.id}`;
      s.textContent = b.label;
      s.title = b.title;
      wrap.appendChild(s);
    }
    el.appendChild(wrap);
    el.classList.add("has-status");
  }

  function attachInspect(el, c) {
    el.addEventListener("mouseenter", () => {
      if (pinnedUid != null) return;
      showInspector(c);
    });
  }

  function showInspector(c) {
    const box = $("inspector");
    if (!box || !c) return;
    box.innerHTML = "";
    box.classList.toggle("inspector-pinned", pinnedUid != null && Number(c.uid) === Number(pinnedUid));
    const el = buildCardEl(c, { stats: liveCardStats(G, c) });
    paintStatusBadges(el, G, c);
    box.appendChild(el);
    const meta = document.createElement("p");
    meta.className = "dim";
    meta.style.cssText = "font-size:11px;margin-top:8px;text-align:center;";
    const bits = [];
    if (pinnedUid != null && Number(c.uid) === Number(pinnedUid)) bits.push("PINNED · I to unpin");
    if (c.loc) bits.push(c.loc.toUpperCase());
    if (c.evolved) bits.push("EVOLVED");
    bits.push(...inspectorPlayBits(G, c));
    if (c.dmg > 0) bits.push(`DMG ${c.dmg}`);
    if (c.loc === "mz") {
      const why = cannotAttackReason(G, c);
      if (why) bits.push(why);
      else if (G.phase === "BP") bits.push("Can declare an attack");
    }
    meta.textContent = bits.join(" · ");
    box.appendChild(meta);
    paintCombos(box, c.def, showInspector);
    paintRelated(box, c.def);
  }

  /** COMBOS WITH: partners drawn from the shared circuit web. */
  function paintCombos(box, def, onPick) {
    const tags = comboTagsFor(def.id);
    const partners = comboPartnersFor(def, { limit: 6 });
    if (!partners.length) return;
    const wrap = document.createElement("div");
    wrap.className = "combo-block";
    const head = document.createElement("p");
    head.className = "related-head";
    head.textContent = "COMBOS WITH";
    wrap.appendChild(head);
    if (tags.enables.length || tags.pays.length) {
      const line = document.createElement("p");
      line.className = "combo-circuits dim";
      const feeds = tags.enables.map((c) => CIRCUITS[c].label).join(", ") || "—";
      const pays = tags.pays.map((c) => CIRCUITS[c].label).join(", ") || "—";
      line.textContent = `Feeds ${feeds} · Pays off on ${pays}`;
      wrap.appendChild(line);
    }
    const list = document.createElement("div");
    list.className = "related-list";
    for (const row of partners) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `combo-chip ${circuitClass(row.circuit)}`;
      b.innerHTML = `<span class="combo-circuit ${circuitClass(row.circuit)}">${CIRCUITS[row.circuit].label}</span>${row.name}`;
      b.title = row.why;
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        const fake = relatedInspectCard(row.def);
        if (fake) onPick(fake);
      });
      list.appendChild(b);
    }
    wrap.appendChild(list);
    box.appendChild(wrap);
  }

  function paintRelated(box, def) {
    const recipes = recipeLines(def, CARD_DB);
    const related = relatedCardsFor(def, CARD_DB);
    if (!recipes.length && !related.length) return;
    const wrap = document.createElement("div");
    wrap.className = "related-block";
    const head = document.createElement("p");
    head.className = "related-head";
    head.textContent = "RELATED";
    wrap.appendChild(head);
    if (recipes.length) {
      const rec = document.createElement("p");
      rec.className = "related-recipes dim";
      rec.textContent = recipes.slice(0, 3).join(" · ");
      wrap.appendChild(rec);
    }
    const list = document.createElement("div");
    list.className = "related-list";
    for (const row of related) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "related-chip";
      b.textContent = `${row.name} · ${row.why}`;
      b.title = row.def.text || row.name;
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        const fake = relatedInspectCard(row.def);
        if (fake) showInspector(fake);
      });
      list.appendChild(b);
    }
    wrap.appendChild(list);
    box.appendChild(wrap);
  }

  function cardFromFocus() {
    const kb = document.querySelector(".cb-card.kb-focus");
    const hover = getHoverAnchor();
    const hovered = document.querySelector(".cb-card:hover");
    const el = kb || hover || hovered;
    const uid = el?.dataset?.uid;
    if (uid == null || uid === "") return null;
    return cardByUid(G, Number(uid));
  }

  function togglePinInspector() {
    const cur = cardFromFocus() || (pinnedUid != null ? cardByUid(G, pinnedUid) : null);
    if (pinnedUid != null && (!cur || Number(cur.uid) === Number(pinnedUid))) {
      pinnedUid = null;
      const box = $("inspector");
      if (box) {
        box.classList.remove("inspector-pinned");
        box.innerHTML = `<p class="dim">Hover a card to inspect it. Press I to pin.</p>`;
      }
      return;
    }
    if (!cur) return;
    pinnedUid = cur.uid;
    showInspector(cur);
  }

  function wireInspectKey() {
    if (inspectKeysWired) return;
    inspectKeysWired = true;
    document.addEventListener("keydown", (e) => {
      if (e.key !== "i" && e.key !== "I") return;
      if (e.repeat) return;
      if (e.target?.closest?.("input, textarea, select, [contenteditable]")) return;
      const duel = $("screen-duel");
      if (!duel || duel.classList.contains("hidden")) return;
      e.preventDefault();
      togglePinInspector();
    });
  }
  wireInspectKey();
  installHelpOverlay();
  installIdleBoardKeys({ showInspector });
  installAnnounceRepeat();

  function showLaneBreakdown(lane, index) {
    document.getElementById("lane-breakdown")?.remove();
    const z0 = index * 2, z1 = index * 2 + 1;
    const rows = [];
    for (const p of [0, 1]) {
      for (const z of [z0, z1]) {
        const c = P(G, p).mz[z];
        if (!c || !c.faceup) continue;
        const printed = `${c.def.atk}/${c.def.def}`;
        const live = `${getATK(G, c)}/${getDEF(G, c)}`;
        rows.push(`<li><b>${p === 0 ? "You" : "Foe"}</b> Z${z + 1} ${c.def.name}: printed ${printed} → now ${live}</li>`);
      }
    }
    const modal = document.createElement("div");
    modal.id = "lane-breakdown";
    modal.className = "cb-modal";
    modal.innerHTML = `
      <div class="cb-modal-card">
        <h2 style="margin:0 0 8px;">${lane.def.name}</h2>
        <p class="dim">${lane.def.text}</p>
        <p style="font-size:12px;margin:10px 0 6px;">Monsters in zones ${z0 + 1}–${z1 + 1}</p>
        ${rows.length ? `<ul class="lane-break-list">${rows.join("")}</ul>` : `<p class="dim">No face-up monsters in this lane right now.</p>`}
        <button type="button" class="cb-btn" data-close>CLOSE</button>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector("[data-close]").addEventListener("click", () => modal.remove());
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
  }

  function wireChainChip() {
    const el = $("btn-chain-mode");
    if (!el || el.dataset.wired) return;
    el.dataset.wired = "1";
    const paint = () => {
      const m = loadSettings()?.chainMode || "smart";
      el.textContent = `CHAIN: ${String(m).toUpperCase()}`;
    };
    paint();
    el.addEventListener("click", () => {
      const cur = loadSettings()?.chainMode || "smart";
      const i = CHAIN_MODES.indexOf(cur);
      const next = CHAIN_MODES[(i < 0 ? 0 : i + 1) % CHAIN_MODES.length];
      saveSettings({ chainMode: next });
      paint();
    });
  }
  wireChainChip();

  function appendLogRow(e, i) {
    const div = document.createElement("div");
    div.className = `log-entry cls-${e.cls || ""}`;
    div.dataset.logI = String(i);
    div.dataset.cls = e.cls || "";
    div.textContent = logLineText(e);
    div.hidden = !logRowIsVisible(e.cls, logLineText(e), logFilter, logQuery);
    logEl.appendChild(div);
  }

  let logFilter = loadSessionLogFilter();
  let logQuery = "";

  function applyLogFilter() {
    if (!logEl) return;
    for (const row of logEl.querySelectorAll(".log-entry")) {
      row.hidden = !logRowIsVisible(row.dataset.cls, row.textContent, logFilter, logQuery);
    }
    paintLogFilterChips();
  }

  function paintLogFilterChips() {
    const bar = $("log-filter");
    if (!bar) return;
    for (const b of bar.querySelectorAll("[data-log-filter]")) {
      b.classList.toggle("on", b.dataset.logFilter === logFilter);
    }
  }

  function showLogIndex(i) {
    if (!logEl) return false;
    const row = logEl.querySelector(`[data-log-i="${i}"]`);
    if (row?.hidden) {
      logFilter = "all";
      logQuery = "";
      const box = $("log-search");
      if (box) box.value = "";
      applyLogFilter();
    }
    return highlightLogIndex(logEl, i);
  }

  function wireLogUi() {
    if (!logEl || logEl.dataset.logUi) return;
    logEl.dataset.logUi = "1";
    logEl.addEventListener("click", (ev) => {
      const row = ev.target.closest(".log-entry");
      if (!row || !logEl.contains(row)) return;
      const i = Number(row.dataset.logI);
      if (!Number.isFinite(i)) return;
      highlightLogIndex(logEl, i);
    });
    const wrap = $("duel-log-wrap");
    const head = wrap?.querySelector(".duel-log-head");
    if (!head) return;
    let bar = $("log-filter");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "log-filter";
      bar.className = "log-filter";
      bar.setAttribute("aria-label", "Log filter");
      bar.innerHTML = LOG_FILTERS.map((f) =>
        `<button type="button" class="log-filter-chip${f.id === logFilter ? " on" : ""}" data-log-filter="${f.id}">${f.label}</button>`
      ).join("") + `<input type="search" id="log-search" class="log-search" placeholder="Search log" aria-label="Search log" autocomplete="off" spellcheck="false">`;
      bar.addEventListener("click", (ev) => {
        const b = ev.target.closest("[data-log-filter]");
        if (!b || !bar.contains(b)) return;
        logFilter = saveSessionLogFilter(b.dataset.logFilter);
        applyLogFilter();
      });
      head.after(bar);
    }
    const box = $("log-search");
    if (box && !box.dataset.wired) {
      box.dataset.wired = "1";
      box.addEventListener("input", () => {
        logQuery = box.value;
        applyLogFilter();
      });
      box.addEventListener("keydown", (ev) => {
        if (ev.key === "Escape") {
          box.value = "";
          logQuery = "";
          applyLogFilter();
          box.blur();
          ev.preventDefault();
          ev.stopPropagation();
        }
      });
    }
    paintLogFilterChips();
  }
  wireLogUi();

  function syncLog() {
    if (!logEl) return;
    const n = (G.log || []).length;
    let shown = logEl.childElementCount;
    if (shown > n) {
      logEl.innerHTML = "";
      shown = 0;
    }
    for (let i = shown; i < n; i++) appendLogRow(G.log[i], i);
    if (shown < n) logEl.scrollTop = logEl.scrollHeight;
    syncHistoryStrip();
  }

  function syncHistoryStrip() {
    let strip = $("play-history");
    if (!strip) {
      strip = document.createElement("div");
      strip.id = "play-history";
      strip.className = "play-history";
      strip.setAttribute("aria-label", "Play history");
      strip.addEventListener("click", (ev) => {
        const tile = ev.target.closest(".hist-tile");
        if (!tile || !strip.contains(tile)) return;
        const i = Number(tile.dataset.logI);
        if (!Number.isFinite(i)) return;
        showLogIndex(i);
      });
      const log = $("duel-log");
      const wrap = $("duel-log-wrap");
      (wrap || log)?.parentElement?.insertBefore(strip, wrap || log);
    }
    const tiles = lastPlayTiles(G.log, 6);
    strip.hidden = tiles.length === 0;
    strip.innerHTML = tiles.map((e) =>
      `<button type="button" class="hist-tile cls-${e.cls}" data-log-i="${e.i}" title="${escapeAttr(e.msg)}">${escapeAttr(shortenPlayMsg(e.msg, 28))}</button>`
    ).join("");
  }

  function escapeAttr(s) {
    return String(s || "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  }

  function showActionToast(msg, cls) {
    const keep = new Set(["summon", "attack", "chain", "evolve", "negate", "set", "destroy"]);
    if (!keep.has(cls)) return;
    let toast = $("action-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "action-toast";
      toast.className = "action-toast";
      toast.setAttribute("aria-live", "polite");
      ($("screen-duel") || document.body).appendChild(toast);
    }
    toast.textContent = msg;
    toast.dataset.cls = cls;
    toast.classList.add("on");
    announce(msg, { assertive: cls === "destroy" || cls === "negate" || cls === "attack" });
    clearTimeout(showActionToast._t);
    showActionToast._t = setTimeout(() => toast.classList.remove("on"), 2200);
  }

  return {
    renderAll() {
      harvestSeen(G, seenUids);
      renderHud(0); renderHud(1);
      renderHand(0); renderHand(1);
      renderZones(0); renderZones(1);
      renderLanes();
      renderWells(0); renderWells(1);
      renderOrb();
      $("linger-strip")?.remove();
      this.renderChain();
      syncLog();
      syncHistoryStrip();
      if (pinnedUid != null) {
        const c = cardByUid(G, pinnedUid);
        if (c) showInspector(c);
      }
    },

    renderChain(resolvingUid = null) {
      const popup = $("chain-popup");
      const links = $("chain-links");
      if (!G.chain || G.chain.length === 0) {
        popup.classList.add("hidden");
        const cap = $("chain-lifo");
        if (cap) cap.hidden = true;
        if (sig.chain !== "") { sig.chain = ""; links.innerHTML = ""; }
        return;
      }
      const s = G.chain.map((l) => `${l.card.uid}:${l.negated ? 1 : 0}`).join(",") + `|${resolvingUid || ""}`;
      if (sig.chain === s) { popup.classList.remove("hidden"); return; }
      sig.chain = s;
      popup.classList.remove("hidden");
      let cap = $("chain-lifo");
      if (!cap) {
        cap = document.createElement("p");
        cap.id = "chain-lifo";
        cap.className = "chain-lifo";
        $("chain-head")?.after(cap);
      }
      cap.hidden = false;
      cap.textContent = chainLifoCaption();
      links.innerHTML = "";
      G.chain.forEach((link, i) => {
        const cl = i + 1;
        const el = document.createElement("div");
        el.className = `chain-link${link.negated ? " negated" : ""}${link.card.uid === resolvingUid ? " resolving" : ""}`;
        const card = buildCardEl(link.card);
        card.style.cursor = "pointer";
        card.title = "Click to inspect — not live match undo";
        card.addEventListener("click", (ev) => {
          ev.stopPropagation();
          showInspector(link.card);
        });
        el.appendChild(card);
        const num = document.createElement("div");
        num.className = "cl-num";
        num.textContent = `CL${cl}`;
        el.appendChild(num);
        const label = document.createElement("div");
        label.className = "cl-label";
        label.textContent = link.card.def.name;
        el.appendChild(label);
        links.appendChild(el);
      });
    },

    log(msg, cls = "") {
      showActionToast(msg, cls);
      if (cls === "chain") { sfx.chain(); playStinger("chain"); }
      else if (cls === "set") { sfx.set(); playStinger("set"); }
      else if (cls === "negate") sfx.negate();
      else if (cls === "dmg") {
        if (/LP /i.test(msg)) sfx.lp();
        else sfx.damage();
        playStinger("damage");
      }
      else if (cls === "heal") sfx.heal();
      else if (cls === "summon") {
        sfx.summon();
        if (/fusion/i.test(msg)) playStinger("fusion");
        else playStinger("summon");
      }
      else if (cls === "evolve") { sfx.evolve(); playStinger("evolve"); }
      else if (cls === "attack") sfx.attack();
      else if (cls === "draw") sfx.draw();
      else if (cls === "destroy") sfx.destroy();
      else if (cls === "resolve") sfx.resolve();
      else if (cls === "phase") $("phase-orb")?.classList.add("pulse"), setTimeout(() => $("phase-orb")?.classList.remove("pulse"), 800);
    },

    setNames(you, foe) {
      $("name-0").textContent = you;
      $("name-1").textContent = foe;
    },

    revealFoeHand() {
      revealFoe = true;
      sig.hand[1] = "";
      renderHand(1);
    },

    reorderHand,

    showInspector,
    showCombo(n) {
      let chip = $("combo-counter");
      if (!chip) {
        chip = document.createElement("div");
        chip.id = "combo-counter";
        chip.className = "combo-counter";
        document.getElementById("arena")?.appendChild(chip);
      }
      chip.hidden = false;
      chip.textContent = `COMBO ×${n}`;
      chip.classList.remove("pop");
      void chip.offsetWidth;
      chip.classList.add("pop");
      announce(`Combo ${n}`);
    },
    clearCombo() {
      const chip = $("combo-counter");
      if (chip) chip.hidden = true;
    },
    showCpuIntent(intent) {
      let chip = $("cpu-intent");
      if (!chip) {
        chip = document.createElement("div");
        chip.id = "cpu-intent";
        chip.className = "cpu-intent";
        chip.title = "Heuristic — not a search";
        ($("screen-duel") || document.body).appendChild(chip);
      }
      const line = intent?.line || "CPU will act";
      chip.hidden = false;
      chip.classList.toggle("lethal", !!intent?.lethal);
      chip.innerHTML = `<b>${line}</b><span>heuristic · not a search</span>`;
      document.querySelectorAll(".cpu-intent-atk, .cpu-intent-tgt").forEach((n) => {
        n.classList.remove("cpu-intent-atk", "cpu-intent-tgt");
      });
      const atkEl = intent?.attackerUid != null
        ? document.querySelector(`[data-uid="${intent.attackerUid}"]`) : null;
      const tgtEl = intent?.targetUid != null
        ? document.querySelector(`[data-uid="${intent.targetUid}"]`) : null;
      if (atkEl) atkEl.classList.add("cpu-intent-atk");
      if (tgtEl) tgtEl.classList.add("cpu-intent-tgt");
      if (intent?.prev) {
        const lpId = intent.kind === "direct" && intent.facePlayer != null
          ? `lp-${intent.facePlayer}` : "lp-1";
        paintCombatOverlay(atkEl, tgtEl, intent.prev, { lpId });
      }
    },
    clearCpuIntent() {
      const chip = $("cpu-intent");
      if (chip) chip.hidden = true;
      document.querySelectorAll(".cpu-intent-atk, .cpu-intent-tgt").forEach((n) => {
        n.classList.remove("cpu-intent-atk", "cpu-intent-tgt");
      });
      clearCombatOverlay();
    },
    clearLog() { logEl.innerHTML = ""; const h = $("play-history"); if (h) h.innerHTML = ""; }
  };
}

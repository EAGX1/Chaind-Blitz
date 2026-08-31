// Chaind Blitz bootstrap: profile, wallet, hub <-> duel routing, duel lifecycle.

import { createDuel, runDuel, drawCards } from "../engine/index.js";
import { CARD_DB } from "../data/cards/index.js";
import { STARTERS } from "../data/starters.js";
import { shippedLoaners, loanerById } from "../data/loaners.js";
import { shouldStartLesson, lessonDuelOpts, lessonLossLine } from "../data/lessonDuel.js";
import { drawLanes, FIELD_LANES } from "../data/fields.js";
import { makeRng } from "../engine/rng.js";
import { loadProfile, saveProfile } from "../meta/profile.js";
import { loadSettings } from "./settingsStore.js";
import { applyEquippedToDom, ensureCosmetics } from "../meta/cosmetics.js";
import { duelRewards } from "../meta/rewards.js";
import { applyRankedResult } from "../meta/ranked.js";
import { openPack, grantCards } from "../meta/packs.js";
import { poolForTier } from "../meta/pools.js";
import { addWinXp } from "../meta/duelPass.js";
import { clearGate, isUnlocked, markTutorialSeen } from "../meta/soloGates.js";
import { clearLab, puzzleOfTheDay, claimPuzzleToday } from "../meta/labs.js";
import { progress as missionProgress, applyDuelMissions, rollDailies } from "../meta/missions.js";
import { startRecording, pushAction, exportReplay, wrapIoReplay, captureLog } from "../meta/replay.js";
import { wrapIoPeer, disconnectPeer, joinRoom } from "../meta/peerNet.js";
import { pushLeaderboard, cloudPush, deviceId } from "../meta/backendClient.js";
import {
  newRun, resolveBattle, openCardReward, openRelicReward,
  duelMods, foeLpBonus, runMetaRewards
} from "../meta/rogue.js";
import {
  draftDeck, gauntletResult, gauntletRewards, GAUNTLET_FOE_LP,
  highlanderize, tourneyResult, tourneyRewards, TOURNEY_ROUNDS,
  brawlForWeek, weekKey, BRAWL_WIN_REWARD
} from "../meta/modes.js";
import { makeCard } from "../engine/state.js";
import { asSavedDeck } from "../meta/banlist.js";
import { createDuelView } from "./duelView.js";
import { confirmDialog } from "./confirmDialog.js";
import { openReplayScrubber } from "./replayScrubber.js";
import { makeHumanIo } from "./humanIo.js";
import { makeCompositeIo } from "./compositeIo.js";
import { initHub } from "./hub.js";
import { sfx } from "./fx.js";
import { playBed, playStinger, preloadAudio } from "../meta/music.js";
import { burstWin, burstLose } from "./juice.js";
import { installCardHover } from "./cardHover.js";
import { installKeywordTips } from "../data/effectTags.js";
import { mountEmoteWheel } from "./emotes.js";
import { parseDuelSeat, swapDuelSides } from "./duelSeat.js";
import { fillRevealedHands, clearRevealedHands } from "./handReveal.js";
import { HUB_TAB_GUIDE, applyHubTabGuide } from "./hubGuide.js";

const $ = (id) => document.getElementById(id);
const profile = loadProfile();
if (loadSettings(profile).devMode) profile.devCheats = true;
const save = () => {
  saveProfile(profile);
  if (profile?.settings?.cloudSync) {
    cloudPush(deviceId(), profile).catch(() => {});
  }
};
let currentDuel = null;
let hub = null;
let lastReplay = null;

function setInert(el, on) {
  if (!el) return;
  if (on) {
    el.setAttribute("inert", "");
    el.setAttribute("aria-hidden", "true");
  } else {
    el.removeAttribute("inert");
    el.removeAttribute("aria-hidden");
  }
}

function setGameoverOpen(open) {
  const el = $("gameover");
  if (!el) return;
  el.classList.toggle("hidden", !open);
  setInert(el, !open);
}

function showScreen(name) {
  const hub = $("screen-hub");
  const duel = $("screen-duel");
  hub.classList.toggle("hidden", name !== "hub");
  duel.classList.toggle("hidden", name !== "duel");
  setInert(hub, name !== "hub");
  setInert(duel, name !== "duel");
  document.body.dataset.screen = name;
  window.dispatchEvent(new CustomEvent("cb-screen", { detail: { screen: name } }));
  if (name === "duel") {
    document.querySelector(".city-root")?.setAttribute("hidden", "");
    document.querySelector(".battle-city")?.setAttribute("hidden", "");
  } else {
    document.querySelector(".city-root")?.removeAttribute("hidden");
    document.querySelector(".battle-city")?.removeAttribute("hidden");
  }
  if (name === "hub") {
    const city = document.getElementById("app")?.classList.contains("city-mode");
    playBed(city ? "city" : "hub");
  }
  if (name === "duel") preloadAudio();
}

function setupTabs() {
  const nav = $("hub-tabs");
  if (!nav) return;
  nav.querySelectorAll(".hub-tab").forEach((b) => {
    const line = HUB_TAB_GUIDE[b.dataset.tab];
    if (line) b.title = line;
  });
  applyHubTabGuide(nav.querySelector(".hub-tab.active")?.dataset.tab || "play");
  nav.addEventListener("click", (e) => {
    const t = e.target.closest(".hub-tab");
    if (!t) return;
    document.querySelectorAll(".hub-tab").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".hub-panel").forEach((p) => p.classList.remove("active"));
    t.classList.add("active");
    $(`panel-${t.dataset.tab}`).classList.add("active");
    applyHubTabGuide(t.dataset.tab);
    // re-render the freshly shown panel so wallet/dust/collection state is live
    hub?.renderers?.[t.dataset.tab]?.();
  });
}

async function startDuel({
  deckYou, deckFoe, extraYou = [], extraFoe = [],
  youName, foeName, aiVsAi = false, seed = null, mode = "pve", onEnd = null, onCreated = null,
  humanSide = null, laneDefs: laneOverride = null, firstPlayer = null, meta = {}, wrapIo = null
}) {
  if (currentDuel) return;
  const duelSeed = seed ?? Math.floor(Math.random() * 2 ** 31);
  const laneRng = makeRng(duelSeed ^ 0x9e3779b9);
  const laneDefs = laneOverride || (window.__CB_FAST
    ? [FIELD_LANES[3], FIELD_LANES[10], FIELD_LANES[11]]
    : drawLanes(laneRng, 3));

  showScreen("duel");
  playBed("duel");
  setGameoverOpen(false);
  clearRevealedHands($("go-hands"));
  $("duel-log").innerHTML = "";
  $("inspector").innerHTML = `<p class="dim">Hover a card to inspect it. Press I to pin. Grey cards tell you why they cannot play.</p>`;

  const G = createDuel({
    cardDb: CARD_DB,
    decks: [deckYou, deckFoe],
    extras: [extraYou, extraFoe],
    laneDefs,
    seed: duelSeed,
    io: null,
    meta,
    firstPlayer
  });
  // Brawl/rogue/gauntlet mutators must run AFTER setupDuel (it assigns EP,
  // builds decks, draws openers) — stashing on G and runDuel fires it.
  if (onCreated) {
    Object.defineProperty(G, "afterSetup", { value: onCreated, enumerable: false, configurable: true, writable: true });
  }
  lastReplay = startRecording(G);
  window.__CB && (window.__CB.currentG = G);
  window.__CB && (window.__CB.lastReplay = lastReplay);
  applyEquippedToDom(profile);

  const view = createDuelView(G);
  view.setNames(youName, foeName);
  let humanIo = makeHumanIo(G, view);
  const side = humanSide != null ? humanSide : (aiVsAi ? -1 : 0);
  let io = makeCompositeIo(G, { humanIo, view, humanSide: side });
  if (typeof wrapIo === "function") io = wrapIo(io, { G, humanIo }) || io;
  io = wrapIoReplay(io, lastReplay, G);
  G.io = io;
  view.renderAll();

  const autoBtn = $("btn-auto");
  autoBtn.style.display = aiVsAi || side === "both" ? "none" : "";
  autoBtn.textContent = "AI PILOT";
  autoBtn.title = "Lets the CPU play your cards. Not pass-priority.";
  autoBtn.onclick = () => {
    io.state.autoHuman = !io.state.autoHuman;
    autoBtn.textContent = io.state.autoHuman ? "AI PILOT: ON" : "AI PILOT";
    if (io.state.autoHuman) humanIo.cancelPending();
  };
  $("btn-concede").onclick = async () => {
    if (G.over) return;
    const ok = await confirmDialog({
      title: "Concede?",
      body: "This ends the duel as a loss.",
      confirm: "CONCEDE",
      cancel: "KEEP PLAYING",
      danger: true
    });
    if (!ok || G.over) return;
    G.over = true;
    G.winner = (typeof side === "number" && side >= 0) ? 1 - side : 1;
    G.winReason = "You conceded.";
    pushAction(lastReplay, { type: "end", result: { winner: 1, reason: G.winReason } }, G);
    captureLog(lastReplay, G);
    humanIo.cancelPending();
  };
  const emoteBtn = $("btn-emote");
  if (emoteBtn) {
    emoteBtn.style.display = aiVsAi || side === "both" ? "none" : "";
    mountEmoteWheel(emoteBtn);
  }

  currentDuel = { G, io, view, humanIo, mode };
  const firstTeach = !aiVsAi && !window.__CB_FAST && !profile.soloGates?.tutorialSeen
    && mode !== "labs" && mode !== "pvp" && side !== "both";
  if (firstTeach) window.__CB_TEACH = true;
  try {
    const result = await runDuel(G);
    pushAction(lastReplay, { type: "end", result }, G);
    captureLog(lastReplay, G);
    view.revealFoeHand();
    view.renderAll();
    const localSeat = side === 1 ? 1 : 0;
    const won = result.winner === localSeat;
    const draw = result.winner == null;
    let extra = "";
    // modes with their own reward pipelines handle them in onEnd instead
    const CUSTOM_REWARD_MODES = ["rogue", "gauntlet", "tourney", "brawl", "hotseat", "labs", "pvp"];
    if (mode === "labs" && !aiVsAi) {
      if (won) {
        const r = clearLab(profile, G.meta?.labId);
        if (r?.ok) {
          extra = ` Lab cleared! +${r.reward?.coins || 0} coins.`;
          if (r.firstFarer) extra += " First Farer — all Labs complete (+120c, +20◆).";
        } else if (r?.already) extra = " Lab already cleared.";
        if (G.meta?.puzzleOfTheDay) {
          const puz = claimPuzzleToday(profile);
          if (puz?.ok) extra += ` Puzzle of the day +${puz.reward?.coins || 0} coins.`;
        }
      }
      save();
    } else if (!aiVsAi && side !== "both" && !CUSTOM_REWARD_MODES.includes(mode)) {
      const rewards = duelRewards(profile, { won, mode });
      extra = ` +${rewards.gems} gems, +${rewards.coins} coins.`;
      applyDuelMissions(profile, result);
      if (won) {
        addWinXp(profile);
        missionProgress(profile, "win");
        if (mode === "ranked") missionProgress(profile, "ranked_win");
        if (isUnlocked(profile, "gate1") && !profile.soloGates?.cleared?.gate1) {
          clearGate(profile, "gate1");
          extra += " Solo Gate 1 cleared!";
        }
      }
      if (mode === "ranked") {
        const rk = applyRankedResult(profile, won);
        if (rk.tierUp) extra += " TIER UP! Your card pool expanded.";
        else if (rk.promoStarted) extra += " Promotion series started — win 2 of 3!";
        else if (rk.promoWon) extra += " Promo won!";
        else         if (rk.promoLost) extra += " Promo lost — back to 60 LP.";
        else extra += ` ${rk.lpDelta >= 0 ? "+" : ""}${rk.lpDelta} LP.`;
        const score = (profile.rank.tier || 0) * 100 + (profile.rank.lp || 0);
        pushLeaderboard("ranked", profile.name || "Duelist", score).catch(() => {});
        if (won && isUnlocked(profile, "gate5") && !profile.soloGates?.cleared?.gate5) {
          clearGate(profile, "gate5");
          extra += " Solo Gate 5 cleared!";
        }
        if ((profile.rank?.tier || 0) >= 1 && isUnlocked(profile, "gate6") && !profile.soloGates?.cleared?.gate6) {
          clearGate(profile, "gate6");
          extra += " Solo Gate 6 cleared — Silver pool unlocked!";
        }
      }
      if (rewards.pack) {
        const rng = makeRng((Date.now()) >>> 0);
        grantCards(profile, openPack(rng, poolForTier(profile.rank.tier), profile));
        extra += " Milestone pack added to your collection!";
      }
      profile.matchHistory = profile.matchHistory || [];
      profile.matchHistory.unshift({
        at: Date.now(), mode, won, reason: result.reason, seed: duelSeed
      });
      profile.matchHistory = profile.matchHistory.slice(0, 40);
      save();
    }
    $("go-title").textContent = draw ? "DRAW" : won ? (aiVsAi || side === "both" ? `${youName} WINS` : "VICTORY") : (aiVsAi || side === "both" ? `${foeName} WINS` : "DEFEAT");
    $("go-title").className = won ? "win" : "lose";
    $("go-reason").textContent = (G.meta?.teachLesson && !won && !draw && !aiVsAi && side !== "both")
      ? lessonLossLine(result)
      : result.reason + extra;
    fillRevealedHands($("go-hands"), G, CARD_DB, {
      youLabel: `${youName} hand`,
      foeLabel: `${foeName} hand (revealed)`
    });
    setGameoverOpen(true);
    if (aiVsAi || side === "both" || won) { sfx.victory(); playStinger("win"); }
    else { sfx.defeat(); playStinger("lose"); }
    if (won || aiVsAi || side === "both") burstWin();
    else burstLose();
    hub?.refreshWallet();
    onEnd?.(result, G);
  } finally {
    if (firstTeach) {
      markTutorialSeen(profile);
      save();
    }
    window.__CB_TEACH = false;
    currentDuel = null;
  }
}

function copyReplayJson(json) {
  if (!json) return false;
  try {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(json);
      return true;
    }
  } catch { /* fall through */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = json;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    return true;
  } catch {
    return false;
  }
}

function downloadReplayJson(json, name = "chaind-blitz-replay.json") {
  if (!json) return;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 500);
}

function wireGameoverButtons(replay, { allowRematch = true, onSwap = null } = {}) {
  const rematch = $("btn-go-rematch");
  rematch.style.display = allowRematch ? "" : "none";
  rematch.onclick = () => {
    setGameoverOpen(false);
    replay();
  };
  const swapBtn = $("btn-go-swap");
  if (swapBtn) {
    const showSwap = allowRematch && typeof onSwap === "function";
    swapBtn.style.display = showSwap ? "" : "none";
    swapBtn.onclick = showSwap
      ? () => {
        setGameoverOpen(false);
        onSwap();
      }
      : null;
  }
  const logBtn = $("btn-go-replay");
  if (logBtn) {
    logBtn.onclick = () => {
      const json = exportReplay(lastReplay);
      if (json) openReplayScrubber(json);
    };
  }
  const copyBtn = $("btn-go-copy");
  if (copyBtn) {
    copyBtn.onclick = () => {
      const json = exportReplay(lastReplay);
      copyBtn.textContent = copyReplayJson(json) ? "COPIED" : "COPY FAILED";
      setTimeout(() => { copyBtn.textContent = "COPY REPLAY"; }, 1400);
    };
  }
  const dlBtn = $("btn-go-dl");
  if (dlBtn) {
    dlBtn.onclick = () => downloadReplayJson(exportReplay(lastReplay));
  }
  $("btn-go-hub").onclick = () => {
    setGameoverOpen(false);
    showScreen("hub");
    hub?.renderAll();
  };
}

function runDuelWithRematch(opts, { allowRematch = true, allowSwap = true } = {}) {
  let sides = { ...opts };
  const rematch = () => startDuel({ ...sides });
  const swap = () => {
    sides = swapDuelSides(sides);
    rematch();
  };
  wireGameoverButtons(rematch, {
    allowRematch,
    onSwap: allowRematch && allowSwap ? swap : null
  });
  rematch();
}

function launchQuickDuel() {
  if (shouldStartLesson(profile)) {
    runDuelWithRematch(lessonDuelOpts());
    return;
  }
  const you = shippedLoaners()[0];
  const foe = loanerById("control_counters") || STARTERS.terra;
  runDuelWithRematch({
    deckYou: you.deck, deckFoe: foe.deck,
    extraYou: you.extra || [], extraFoe: foe.extra || [],
    youName: you.name.toUpperCase(), foeName: `${foe.name} CPU`, mode: "pve",
    firstPlayer: parseDuelSeat(document.getElementById("pve-seat")?.value)
  });
}

function randomFoeStarter() {
  const ids = Object.keys(STARTERS);
  return ids[Math.floor(Math.random() * ids.length)];
}

/** Local hotseat: both sides use humanIo (compositeIo humanSide: "both"). */
function startHotseat(deckYou, deckFoe, youName = "P1", foeName = "P2", extras = {}) {
  const you = deckYou || STARTERS.ignis.deck;
  const foe = deckFoe || STARTERS.abyss.deck;
  runDuelWithRematch({
    deckYou: you, deckFoe: foe,
    extraYou: extras.extraYou || [],
    extraFoe: extras.extraFoe || [],
    youName, foeName, mode: "hotseat", humanSide: "both"
  });
}

function startRoomDuel(opts) {
  const o = opts || {};
  const peer = o.peer;
  const localSeat = o.localSeat === 1 ? 1 : 0;
  const seed = o.seed;
  const launch = () => startDuel({
    deckYou: o.hostDeck,
    deckFoe: o.guestDeck,
    extraYou: o.hostExtra || [],
    extraFoe: o.guestExtra || [],
    youName: o.hostName || "HOST",
    foeName: o.guestName || "GUEST",
    seed: seed,
    mode: o.mode || "pvp",
    humanSide: localSeat,
    meta: { pvp: true, room: peer && peer.code },
    wrapIo: (io, ctx) => {
      const G = ctx && ctx.G;
      const humanIo = ctx && ctx.humanIo;
      if (peer && peer.onClose) {
        peer.onClose(() => {
          if (G && !G.over) {
            G.over = true;
            G.winner = localSeat;
            G.winReason = "Opponent disconnected.";
          }
          if (humanIo && humanIo.cancelPending) humanIo.cancelPending();
        });
      }
      return wrapIoPeer(io, {
        localSeat: localSeat,
        send: (payload) => peer && peer.send && peer.send(payload),
        pullAction: (method, player) => peer && peer.pullAction ? peer.pullAction(method, player) : Promise.resolve(null)
      });
    },
    onCreated(G) {
      const line = localSeat === 0
        ? "Room duel: you are the host (bottom board)." 
        : "Room duel: you are the guest — you control the top board.";
      G.log.push({ msg: line, cls: "system", t: G.turnCount, phase: G.phase });
    },
    onEnd() {
      try { disconnectPeer(); } catch (e) { /* ignore */ }
    }
  });
  wireGameoverButtons(launch, { allowRematch: false });
  launch();
}

async function launchPeerSession(session, ranked) {
  if (!session?.ok || !session.peer) return false;
  const start = await session.peer.waitStart();
  if (!start) {
    disconnectPeer();
    return false;
  }
  startRoomDuel({
    peer: session.peer,
    localSeat: session.seat === 1 ? 1 : 0,
    seed: start.seed,
    hostDeck: start.host?.deck || [],
    guestDeck: start.guest?.deck || [],
    hostExtra: start.host?.extra || [],
    guestExtra: start.guest?.extra || [],
    hostName: start.host?.name || "HOST",
    guestName: start.guest?.name || "GUEST",
    mode: ranked ? "ranked" : "pvp"
  });
  return true;
}

function startRoomSeedCpu(opts) {
  const o = opts || {};
  const foe = STARTERS[randomFoeStarter()];
  runDuelWithRematch({
    deckYou: o.deckYou,
    extraYou: o.extraYou || [],
    deckFoe: foe.deck,
    extraFoe: foe.extra || [],
    youName: o.youName || "YOU",
    foeName: (foe.name || "FOE") + " CPU",
    seed: o.seed,
    mode: "pve",
    meta: { roomSeedFallback: true }
  });
}

function boot() {
  ensureCosmetics(profile);
  applyEquippedToDom(profile);
  rollDailies(profile);
  installCardHover();
  installKeywordTips();
  setupTabs();
  hub = initHub({
    profile,
    save,
    startPvE(deck, label, foeId, extras = {}) {
      const loaner = loanerById(foeId);
      const foe = loaner || STARTERS[foeId] || STARTERS.terra;
      runDuelWithRematch({
        deckYou: deck, deckFoe: foe.deck,
        extraYou: extras.extraYou || [],
        extraFoe: foe.extra || [],
        youName: label, foeName: `${foe.name} CPU`,
        mode: "pve",
        firstPlayer: parseDuelSeat(extras.seat)
      });
    },
    startQuickDuel: launchQuickDuel,
    startLoaner(loanerId, foeId = "control_counters") {
      const you = loanerById(loanerId);
      if (!you) return;
      this.startPvE(you.deck, you.name.toUpperCase(), foeId, { extraYou: you.extra || [] });
    },
    startAiVsAi(aId, bId) {
      const resolve = (id) => {
        if (id?.startsWith("custom:")) {
          const name = id.slice(7);
          const saved = asSavedDeck(profile.decks[name]);
          return saved.main.length ? { name, deck: saved.main, extra: saved.extra } : null;
        }
        return loanerById(id) || STARTERS[id] || null;
      };
      const a = resolve(aId) || shippedLoaners()[0] || Object.values(STARTERS)[0];
      const b = resolve(bId) || shippedLoaners()[1] || Object.values(STARTERS)[1] || a;
      runDuelWithRematch({
        deckYou: a.deck, deckFoe: b.deck,
        extraYou: a.extra || [], extraFoe: b.extra || [],
        youName: a.name.toUpperCase(), foeName: b.name.toUpperCase(), aiVsAi: true
      });
    },
    startRanked(deck, label, extra = []) {
      const foe = STARTERS[randomFoeStarter()];
      runDuelWithRematch({
        deckYou: deck, deckFoe: foe.deck,
        extraYou: extra, extraFoe: foe.extra || [],
        youName: label, foeName: `${foe.name} CPU`, mode: "ranked"
      });
    },
    startRogue() {
      if (!profile.rogue) {
        profile.rogue = newRun(Math.floor(Math.random() * 2 ** 31));
        save();
      }
      document.querySelector('[data-tab="rogue"]').click();
    },
    startPuzzleOfTheDay() {
      const lab = puzzleOfTheDay();
      window.__CB?.startLabs?.(lab.id, { puzzleOfTheDay: true });
    },
    startRogueBattle(node) {
      const run = profile.rogue;
      if (!run) return;
      const foe = STARTERS[randomFoeStarter()];
      const mods = duelMods(run);
      const title = node.type === "boss" ? "BOSS" : node.type === "elite" ? "ELITE" : foe.name.toUpperCase();
      const launch = () => startDuel({
        deckYou: run.deck,
        deckFoe: foe.deck,
        youName: "RUNNER",
        foeName: `${title} CPU`,
        mode: "rogue",
        onCreated(G) {
          // HP carries between duels; relics modify the opening state
          G.players[0].lp = Math.max(1, run.hp + mods.lpBonus);
          G.players[1].lp += foeLpBonus(node);
          if (mods.extraDraw) drawCards(G, 0, mods.extraDraw);
        },
        onEnd(result, G) {
          const won = result.winner === 0;
          const lpLeft = won ? Math.max(1, G.players[0].lp) : 0;
          const r = resolveBattle(run, { won, lpLeft });
          let tail;
          if (won && r.reward === "card") {
            openCardReward(run, poolForTier(profile.rank.tier), "battle");
            if (r.elite) openRelicReward(run);
            tail = " Spoils await on the map.";
          }
          if (run.over) {
            const meta = runMetaRewards(run);
            profile.gems += meta.gems;
            const rng = makeRng((Date.now() ^ 0x5f3759df) >>> 0);
            for (let i = 0; i < meta.packs; i++) grantCards(profile, openPack(rng, poolForTier(profile.rank.tier), profile));
            profile.stats.bestFloor = Math.max(profile.stats.bestFloor || 0, run.floor);
            tail = ` Run ${run.won ? "COMPLETE" : "over"} — +${meta.gems} gems${meta.packs ? `, +${meta.packs} pack${meta.packs > 1 ? "s" : ""}` : ""}.`;
            profile.rogue = null;
          }
          save();
          if (tail) $("go-reason").textContent += tail;
        }
      });
      wireGameoverButtons(launch, { allowRematch: false });
      launch();
    },
    startGauntlet(key) {
      const st = profile.modes[key];
      if (!st || st.over) return;
      const deck = key === "sealed" ? st.deck : draftDeck(st);
      const foe = STARTERS[randomFoeStarter()];
      const launch = () => startDuel({
        deckYou: deck, deckFoe: foe.deck,
        youName: key.toUpperCase(), foeName: `${foe.name} CPU`,
        mode: "gauntlet",
        onCreated(G) { G.players[1].lp += GAUNTLET_FOE_LP[st.round] || 0; },
        onEnd(result) {
          const won = result.winner === 0;
          gauntletResult(st, won);
          let tail;
          if (st.over) {
            const rw = gauntletRewards(st);
            profile.gems += rw.gems;
            const rng = makeRng(Date.now() >>> 0);
            for (let i = 0; i < rw.packs; i++) grantCards(profile, openPack(rng, poolForTier(profile.rank.tier), profile));
            tail = ` Gauntlet over: ${st.wins}/3 wins — +${rw.gems} gems${rw.packs ? `, +${rw.packs} pack${rw.packs > 1 ? "s" : ""}` : ""}.`;
          } else {
            tail = won ? ` Round ${st.round + 1} unlocked — foe LP +${GAUNTLET_FOE_LP[st.round]}.` : " A strike, but the gauntlet continues.";
          }
          save();
          $("go-reason").textContent += tail;
        }
      });
      wireGameoverButtons(launch, { allowRematch: false });
      launch();
    },
    startHighlander(deck, label, extra = []) {
      const pool = poolForTier(profile.rank.tier);
      const rng = makeRng(Date.now() >>> 0);
      const foe = STARTERS[randomFoeStarter()];
      const youD = highlanderize(deck, pool, rng);
      const foeD = highlanderize(foe.deck, pool, rng);
      runDuelWithRematch({
        deckYou: youD, deckFoe: foeD,
        extraYou: extra, extraFoe: foe.extra || [],
        youName: label, foeName: `${foe.name} CPU`, mode: "highlander"
      });
    },
    startTourneyMatch() {
      const t = profile.modes.tourney;
      if (!t || !t.alive) return;
      const foe = STARTERS[randomFoeStarter()];
      const roundName = TOURNEY_ROUNDS[t.round];
      const launch = () => startDuel({
        deckYou: t.deck, deckFoe: foe.deck,
        extraYou: t.extra || [], extraFoe: foe.extra || [],
        youName: "CONTENDER", foeName: `${foe.name} CPU`, mode: "tourney",
        onCreated(G) { G.players[1].lp += [0, 3, 6][t.round] || 0; },
        onEnd(result) {
          const won = result.winner === 0;
          tourneyResult(t, won);
          let tail;
          if (!t.alive) {
            const rw = tourneyRewards(t);
            profile.gems += rw.gems;
            const rng = makeRng(Date.now() >>> 0);
            for (let i = 0; i < rw.packs; i++) grantCards(profile, openPack(rng, poolForTier(profile.rank.tier), profile));
            tail = t.champion
              ? ` CHAMPION! +${rw.gems} gems, +${rw.packs} packs.`
              : ` Eliminated in the ${roundName} — +${rw.gems} gems${rw.packs ? `, +${rw.packs} pack` : ""}.`;
          } else {
            tail = ` Advancing to the ${TOURNEY_ROUNDS[t.round]}.`;
          }
          save();
          $("go-reason").textContent += tail;
        }
      });
      wireGameoverButtons(launch, { allowRematch: false });
      launch();
    },
    startBrawl() {
      const brawl = brawlForWeek();
      const wk = weekKey();
      window.__CB && (window.__CB.activeBrawl = brawl.id);
      const custom = Object.keys(profile.decks);
      const saved = custom.length ? asSavedDeck(profile.decks[custom[0]]) : { main: STARTERS.ignis.deck, extra: STARTERS.ignis.extra || [] };
      const deck = saved.main;
      const extraYou = saved.extra;
      const foe = STARTERS[randomFoeStarter()];
      runDuelWithRematch({
        deckYou: deck, deckFoe: foe.deck,
        extraYou, extraFoe: foe.extra || [],
        youName: "BRAWLER", foeName: `${foe.name} CPU`, mode: "brawl",
        onCreated(G) {
          brawl.apply(G, {
            drawCards,
            addToDeck: (p, id) => { G.players[p].deck.push(makeCard(id, CARD_DB[id], p)); }
          });
        },
        onEnd(result) {
          const won = result.winner === 0;
          let tail = "";
          if (won && profile.lastBrawl !== wk) {
            profile.lastBrawl = wk;
            profile.gems += BRAWL_WIN_REWARD.gems;
            const rng = makeRng(Date.now() >>> 0);
            grantCards(profile, openPack(rng, poolForTier(profile.rank.tier), profile));
            tail = ` First brawl win of the week: +${BRAWL_WIN_REWARD.gems} gems and a pack!`;
          } else if (won) {
            tail = " Brawl won (weekly reward already claimed).";
          }
          save();
          if (tail) $("go-reason").textContent += tail;
        }
      });
    },
    startHotseat,
    startRoomDuel,
    startRoomSeedCpu,
    startPeerDuel: launchPeerSession
  });
  window.addEventListener("cb-join-room", async (ev) => {
    const code = ev.detail?.code;
    if (!code) return;
    const deck = STARTERS[profile.starterId] || STARTERS.ignis;
    const session = await joinRoom(code, {
      name: profile.name || "Guest",
      deck: deck.deck,
      extra: deck.extra || []
    });
    if (session.ok) launchPeerSession(session, false);
  });
  showScreen("hub");
  window.__CB = {
    startDuel, STARTERS, CARD_DB, BRONZE_DB: CARD_DB, profile, save,
    shippedLoaners, loanerById, hub,
    lastReplay: null,
    startHotseat,
    startRoomDuel,
    startRoomSeedCpu,
    startPeerDuel: launchPeerSession,
    startQuickDuel: launchQuickDuel,
    startGateDuel(gateId) {
      if (gateId === "puzzle") {
        this.startPuzzleOfTheDay();
        return;
      }
      if (String(gateId).startsWith("labs_")) {
        this.startLabs(gateId);
        return;
      }
      if (gateId === "gate5" || gateId === "gate6") {
        this.hub?.queueRanked?.();
        return;
      }
      const you = shippedLoaners()[0];
      const foe = STARTERS.abyss;
      runDuelWithRematch({
        deckYou: you.deck, deckFoe: foe.deck,
        extraYou: you.extra || [],
        youName: "GATES", foeName: `${foe.name} CPU`, mode: "pve",
        onEnd(result) {
          if (result.winner === 0 && gateId && isUnlocked(profile, gateId) && !profile.soloGates?.cleared?.[gateId]) {
            const st = result.stats || {};
            if (gateId === "gate2" && !(st.evolutions > 0)) return;
            if (gateId === "gate3" && !(st.fusions > 0)) return;
            if (gateId !== "gate1") clearGate(profile, gateId);
            save();
          }
        }
      });
    },
    startLabsFanfare() {
      this.startLabs("labs_fanfare");
    },
    startLabs(labId, extraMeta = {}) {
      const safePlay = [
        FIELD_LANES.find((l) => l.id === "high_ground"),
        FIELD_LANES.find((l) => l.id === "stillwater"),
        FIELD_LANES.find((l) => l.id === "echo_canyon")
      ];
      const setups = {
        labs_fanfare: () => {
          const pool = FIELD_LANES.find((l) => l.id === "mirror_pool");
          return {
            deckYou: ["heal_bloom", "heal_bloom", "heal_bloom", ...STARTERS.terra.deck].slice(0, 40),
            deckFoe: STARTERS.abyss.deck,
            extraYou: STARTERS.terra.extra || [],
            extraFoe: STARTERS.abyss.extra || [],
            youName: "LABS",
            foeName: "MIRROR POOL",
            firstPlayer: 0,
            laneDefs: [
              pool,
              FIELD_LANES.find((l) => l.id === "high_ground"),
              FIELD_LANES.find((l) => l.id === "echo_canyon")
            ],
            meta: { labs: "fanfare_lane", labId: "labs_fanfare", noShuffle: true },
            seed: 7
          };
        },
        labs_ward: () => ({
          deckYou: STARTERS.terra.deck,
          deckFoe: STARTERS.abyss.deck,
          extraYou: STARTERS.terra.extra || [],
          extraFoe: STARTERS.abyss.extra || [],
          youName: "LABS",
          foeName: "WARD WALL",
          firstPlayer: 0,
          seed: 11,
          laneDefs: safePlay,
          meta: {
            labs: "ward",
            labId: "labs_ward",
            noShuffle: true,
            allowFirstTurnBattle: true,
            labsBoard: [
              { p: 0, id: "swift_falcon", zone: 0, summonedTurn: 0 },
              { p: 1, id: "ward_sentinel", zone: 0, summonedTurn: 0 },
              { p: 1, id: "ember_fox", zone: 1, summonedTurn: 0 }
            ]
          }
        }),
        labs_contact: () => ({
          deckYou: STARTERS.ignis.deck,
          deckFoe: STARTERS.abyss.deck,
          extraYou: ["fusion_pyre_wyrm"],
          extraFoe: STARTERS.abyss.extra || [],
          youName: "LABS",
          foeName: "CONTACT",
          firstPlayer: 0,
          seed: 13,
          laneDefs: safePlay,
          meta: {
            labs: "contact",
            labId: "labs_contact",
            noShuffle: true,
            labsBoard: [
              { p: 0, id: "ember_fox", zone: 0, summonedTurn: 0 },
              { p: 0, id: "cinder_knight", zone: 1, summonedTurn: 0 }
            ]
          }
        }),
        labs_counter: () => ({
          deckYou: ["shatter_sigil", ...STARTERS.abyss.deck].slice(0, 40),
          deckFoe: STARTERS.ignis.deck,
          extraYou: [],
          extraFoe: [],
          youName: "LABS",
          foeName: "COUNTER",
          firstPlayer: 0,
          seed: 17,
          laneDefs: safePlay,
          meta: {
            labs: "counter",
            labId: "labs_counter",
            noShuffle: true,
            labsBoard: [
              { p: 0, id: "null_seal", loc: "stz", zone: 0, setTurn: 0 },
              { p: 0, id: "shatter_sigil", loc: "stz", zone: 1, setTurn: 0 },
              { p: 1, id: "ember_fox", zone: 0, summonedTurn: 0 }
            ]
          }
        }),
        labs_ambush: () => ({
          deckYou: STARTERS.terra.deck,
          deckFoe: STARTERS.abyss.deck,
          extraYou: STARTERS.terra.extra || [],
          extraFoe: STARTERS.abyss.extra || [],
          youName: "LABS",
          foeName: "AMBUSH",
          firstPlayer: 0,
          seed: 19,
          laneDefs: safePlay,
          meta: {
            labs: "ambush",
            labId: "labs_ambush",
            noShuffle: true,
            allowFirstTurnBattle: true,
            labsBoard: [
              { p: 0, id: "swift_falcon", zone: 0, summonedTurn: 0 },
              { p: 1, id: "silver_ambush_door", zone: 0, summonedTurn: 0, faceup: false }
            ]
          }
        }),
        labs_tribute: () => ({
          deckYou: STARTERS.terra.deck,
          deckFoe: STARTERS.abyss.deck,
          extraYou: STARTERS.terra.extra || [],
          extraFoe: STARTERS.abyss.extra || [],
          youName: "LABS",
          foeName: "TRIBUTE",
          firstPlayer: 0,
          seed: 23,
          laneDefs: safePlay,
          meta: {
            labs: "tribute",
            labId: "labs_tribute",
            noShuffle: true,
            labsBoard: [
              { p: 0, id: "ember_fox", zone: 0, summonedTurn: 0 },
              { p: 0, id: "gem_golem", loc: "hand" }
            ]
          }
        }),
        labs_damage_step: () => ({
          deckYou: STARTERS.ignis.deck,
          deckFoe: STARTERS.abyss.deck,
          extraYou: STARTERS.ignis.extra || [],
          extraFoe: STARTERS.abyss.extra || [],
          youName: "LABS",
          foeName: "DAMAGE STEP",
          firstPlayer: 0,
          seed: 29,
          laneDefs: safePlay,
          meta: {
            labs: "damage_step",
            labId: "labs_damage_step",
            noShuffle: true,
            allowFirstTurnBattle: true,
            labsBoard: [
              { p: 0, id: "swift_falcon", zone: 0, summonedTurn: 0 },
              { p: 0, id: "surge_imp", loc: "hand" },
              { p: 1, id: "ember_fox", zone: 0, summonedTurn: 0 }
            ]
          }
        })
      };
      const make = setups[labId] || setups.labs_fanfare;
      window.__CB_TEACH = true;
      const replay = () => {
        const spec = make();
        spec.meta = { ...(spec.meta || {}), ...extraMeta };
        return startDuel({ mode: "labs", ...spec });
      };
      wireGameoverButtons(replay, { allowSwap: false });
      replay();
    },
    startPuzzleOfTheDay() {
      const lab = puzzleOfTheDay();
      this.startLabs(lab.id, { puzzleOfTheDay: true });
    },
    exportLastReplay() {
      return lastReplay ? exportReplay(lastReplay) : null;
    }
  };
}

try {
  boot();
} catch (err) {
  console.error("hub boot failed", err);
  window.__CB_BOOT_ERR = String(err?.stack || err);
}
window.__CB = window.__CB || { profile, save };

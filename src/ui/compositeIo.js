// Composite io: routes each decision to the human (player 0) or the AI
// (player 1), renders the board after every beat, paces AI-vs-AI spectating,
// and animates chain resolutions link by link.

import { makeAutopilot } from "../ai/autopilot.js";
import { wrapWithWorkerAi } from "../ai/workerClient.ts";
import { budgetFor } from "../ai/budgets.ts";
import { describeCpuIntent, describeCpuChainIntent } from "../ai/cpuIntent.js";
import { P, opp, monstersOf } from "../engine/index.js";
import { sfx, fxOnElement, fxFlash, fxAttackLunge } from "./fx.js";
import { fxDelay } from "./fxPace.js";
import { playStinger } from "../meta/music.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function flashLatestUid(cls) {
  const nodes = document.querySelectorAll("#mz-0 [data-uid], #mz-1 [data-uid]");
  let best = null;
  let bestUid = -1;
  for (const n of nodes) {
    const uid = Number(n.dataset.uid);
    if (Number.isFinite(uid) && uid > bestUid) {
      bestUid = uid;
      best = n;
    }
  }
  if (best) fxOnElement(best, cls);
}

function findBoardCardByName(name) {
  const nodes = document.querySelectorAll("#mz-0 [data-uid], #mz-1 [data-uid]");
  for (const n of nodes) {
    const cardName = n.querySelector(".card-name")?.textContent;
    if (cardName && name.includes(cardName)) return n;
  }
  return null;
}

function flashNamedOnBoard(msg, cls) {
  const hit = findBoardCardByName(msg);
  if (hit) fxOnElement(hit, cls);
  else flashLatestUid(cls);
}

function currentAiTier(G) {
  const forced = G?.meta?.aiTier;
  if (forced === "easy" || forced === "normal" || forced === "hard") return forced;
  return window.__CB_SETTINGS?.aiTier || "normal";
}

export function makeCompositeIo(G, { humanIo, view, speed = 1, humanSide = 0 }) {
  const baseAi = makeAutopilot(G, { getTier: () => currentAiTier(G) });
  const ai = wrapWithWorkerAi(baseAi, () => currentAiTier(G));
  const state = {
    humanSide,          // 0, 1, "both", or -1 (AI vs AI)
    autoHuman: false,   // AUTO button: let the AI drive the human side
    speed               // 1 | 4 (spectate pacing)
  };

  let comboRun = 0;

  const isHuman = (p) => {
    if (state.autoHuman) return false;
    if (state.humanSide === "both") return true;
    return p === state.humanSide;
  };
  const pace = (p) => {
    if (isHuman(p)) return 0;
    if (state.speed >= 4) return fxDelay(60);
    return fxDelay(budgetFor(currentAiTier(G)).ms);
  };

  const wrap = (p, fn) => async (...args) => {
    const side = isHuman(p) ? humanIo : ai;
    try {
      const out = await side[fn](p, ...args);
      // Mulligan apply happens after this returns; paint once both seats are done.
      if (fn !== "askMulligan") view.renderAll();
      await sleep(pace(p));
      return out;
    } catch (err) {
      console.warn(`[io ${fn}]`, err);
      view.renderAll();
      if (fn === "chooseMain") return (args[0] || []).find((a) => a.type === "end") || { type: "end" };
      if (fn === "askChain") return null;
      if (fn === "askAttack") return null;
      if (fn === "askMulligan") return [];
      if (fn === "choose") return [];
      if (fn === "askComeback") return "draw";
      return null;
    }
  };

  return {
    state,

    async choose(p, req) { return wrap(p, "choose")(req); },
    async askChain(p, legal, chain, extra) {
      view.renderAll();
      if (isHuman(p) && (!legal || legal.length === 0)) {
        view.log("No legal response — passing automatically.", "dim");
        await sleep(fxDelay(state.speed >= 4 ? 60 : 120));
        return null;
      }
      if (isHuman(p)) return wrap(p, "askChain")(legal, chain, extra);
      try {
        const pick = await ai.askChain(p, legal, chain, extra);
        const telegraph = window.__CB_SETTINGS?.cpuIntent !== false;
        if (legal?.length && telegraph) {
          const intent = describeCpuChainIntent(G, legal, pick);
          view.showCpuIntent?.(intent);
          await sleep(pace(p));
          if (state.speed < 4) await sleep(fxDelay(260));
          view.clearCpuIntent?.();
        } else {
          await sleep(pace(p));
        }
        view.renderAll();
        return pick;
      } catch (err) {
        console.warn("[io askChain]", err);
        view.clearCpuIntent?.();
        view.renderAll();
        return null;
      }
    },
    async chooseMain(p, actions) {
      view.renderAll();
      return wrap(p, "chooseMain")(actions);
    },
    async askAttack(p, attackers, targetsFn, battleActs) {
      view.renderAll();
      if (isHuman(p)) return wrap(p, "askAttack")(attackers, targetsFn, battleActs);
      try {
        const choice = await ai.askAttack(p, attackers, targetsFn, battleActs);
        const telegraph = window.__CB_SETTINGS?.cpuIntent !== false;
        if (telegraph) {
          const intent = describeCpuIntent(G, choice);
          view.showCpuIntent?.(intent);
          await sleep(pace(p));
          if (state.speed < 4) await sleep(fxDelay(260));
          view.clearCpuIntent?.();
        } else {
          await sleep(pace(p));
        }
        view.renderAll();
        return choice;
      } catch (err) {
        console.warn("[io askAttack]", err);
        view.clearCpuIntent?.();
        view.renderAll();
        return null;
      }
    },
    async askMulligan(p, hand) {
      view.renderAll();
      return wrap(p, "askMulligan")(hand);
    },
    async askComeback(p) {
      view.renderAll();
      return wrap(p, "askComeback")();
    },

    onLog(msg, cls) {
      view.log(msg, cls);
      view.renderAll();
      if (cls === "summon") flashNamedOnBoard(msg, "fx-summon");
      if (cls === "destroy") {
        const arena = document.getElementById("arena");
        if (arena) {
          const r = arena.getBoundingClientRect();
          fxFlash(r.left + r.width / 2, r.top + r.height * 0.45, 220);
        }
        const gy = document.getElementById("gy-0") || document.getElementById("gy-1");
        if (gy) fxOnElement(gy, "fx-destroy");
      }
      if (cls === "attack") {
        const m = msg.match(/^(.*?) attacks (.*)!$/);
        const atkEl = m ? findBoardCardByName(m[1]) : null;
        let tgtEl = null;
        if (m && m[2] && m[2] !== "directly") tgtEl = findBoardCardByName(m[2]);
        else if (atkEl) {
          const foeSide = atkEl.closest("#mz-0") ? 1 : 0;
          tgtEl = document.getElementById(`hud-${foeSide}`);
        }
        if (atkEl) fxAttackLunge(atkEl, tgtEl);
        else flashNamedOnBoard(msg, "fx-flash");
      }
    },

    async onResolveLink(link, clNum, remaining) {
      view.renderChain(link.card.uid);
      const el = document.querySelector(`[data-uid="${link.card.uid}"]`);
      if (el) fxOnElement(el, "fx-chain");
      // Two or more of your own links resolving back to back is a combo.
      if (link.controller === 0 && link.kind === "trigger") {
        comboRun += 1;
        if (comboRun >= 2) {
          view.showCombo?.(comboRun);
          if (comboRun === 2) playStinger("combo");
          document.querySelectorAll(".cb-card.combo-live").forEach((node) => fxOnElement(node, "fx-combo"));
        }
      }
      if (remaining === 0) {
        setTimeout(() => { comboRun = 0; view.clearCombo?.(); }, fxDelay(1600) || 1);
      }
      await sleep(fxDelay(state.speed >= 4 ? 100 : 200));
    },

    async onLaneReveal(lane) {
      view.renderAll();
      const { fxLaneBanner } = await import("./fx.js");
      fxLaneBanner(lane.index, lane.def);
      sfx.lane();
      const laneEl = document.querySelectorAll("#lanes .lane")[lane.index];
      if (laneEl) {
        laneEl.classList.add("lane-flip");
        setTimeout(() => laneEl.classList.remove("lane-flip"), fxDelay(700) || 1);
      }
      await sleep(fxDelay(state.speed >= 4 ? 400 : 800));
    },

    onEvolve(card) {
      const el = document.querySelector(`[data-uid="${card.uid}"]`);
      if (el) {
        import("./fx.js").then(({ fxOnElement }) => fxOnElement(el, "fx-evolve"));
      }
    },

    onComeback(p) {
      view.log(`Comeback available for player ${p}.`, "system");
    },

    onMulliganDone() {
      view.renderAll();
      window.dispatchEvent(new CustomEvent("cb-mulligan-done"));
    },

    async hint(p, actions) {
      if (typeof ai.hint === "function") {
        return ai.hint(p, actions, {
          enemyCount: monstersOf(G, opp(p)).length,
          handRest: Math.max(0, P(G, p).hand.length - 1)
        });
      }
      return [];
    }
  };
}

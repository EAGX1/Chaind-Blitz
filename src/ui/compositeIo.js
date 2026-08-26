// Composite io: routes each decision to the human (player 0) or the AI
// (player 1), renders the board after every beat, paces AI-vs-AI spectating,
// and animates chain resolutions link by link.

import { makeAutopilot } from "../ai/autopilot.js";
import { wrapWithWorkerAi } from "../ai/workerClient.ts";
import { budgetFor } from "../ai/budgets.ts";
import { describeCpuIntent, describeCpuChainIntent } from "../ai/cpuIntent.js";
import { sfx, fxOnElement, fxFlash } from "./fx.js";
import { fxDelay } from "./fxPace.js";

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

function flashNamedOnBoard(msg, cls) {
  const nodes = document.querySelectorAll("#mz-0 [data-uid], #mz-1 [data-uid]");
  let hit = null;
  for (const n of nodes) {
    const name = n.querySelector(".card-name")?.textContent;
    if (name && msg.includes(name)) hit = n;
  }
  if (hit) fxOnElement(hit, cls);
  else flashLatestUid(cls);
}

function currentAiTier() {
  return window.__CB_SETTINGS?.aiTier || "normal";
}

export function makeCompositeIo(G, { humanIo, view, speed = 1, humanSide = 0 }) {
  const baseAi = makeAutopilot(G, { getTier: currentAiTier });
  const ai = wrapWithWorkerAi(baseAi, currentAiTier);
  const state = {
    humanSide,          // 0, 1, "both", or -1 (AI vs AI)
    autoHuman: false,   // AUTO button: let the AI drive the human side
    speed               // 1 | 4 (spectate pacing)
  };

  const isHuman = (p) => {
    if (state.autoHuman) return false;
    if (state.humanSide === "both") return true;
    return p === state.humanSide;
  };
  const pace = (p) => {
    if (isHuman(p)) return 0;
    if (state.speed >= 4) return fxDelay(60);
    return fxDelay(budgetFor(currentAiTier()).ms);
  };

  const wrap = (p, fn) => async (...args) => {
    const side = isHuman(p) ? humanIo : ai;
    try {
      const out = await side[fn](p, ...args);
      view.renderAll();
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
        await sleep(fxDelay(state.speed >= 4 ? 60 : 350));
        return null;
      }
      if (isHuman(p)) return wrap(p, "askChain")(legal, chain, extra);
      try {
        const pick = await ai.askChain(p, legal, chain, extra);
        if (legal?.length) {
          const intent = describeCpuChainIntent(G, legal, pick);
          view.showCpuIntent?.(intent);
          await sleep(pace(p));
          if (state.speed < 4) await sleep(fxDelay(420));
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
    async askAttack(p, attackers, targetsFn) {
      view.renderAll();
      if (isHuman(p)) return wrap(p, "askAttack")(attackers, targetsFn);
      try {
        const choice = await ai.askAttack(p, attackers, targetsFn);
        const intent = describeCpuIntent(G, choice);
        view.showCpuIntent?.(intent);
        await sleep(pace(p));
        if (state.speed < 4) await sleep(fxDelay(420));
        view.clearCpuIntent?.();
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
      if (cls === "attack") flashNamedOnBoard(msg, "fx-flash");
    },

    async onResolveLink(link, clNum, remaining) {
      view.renderChain(link.card.uid);
      const el = document.querySelector(`[data-uid="${link.card.uid}"]`);
      if (el) fxOnElement(el, "fx-chain");
      await sleep(fxDelay(state.speed >= 4 ? 120 : 500));
    },

    async onLaneReveal(lane) {
      view.renderAll();
      const { fxLaneBanner } = await import("./fx.js");
      fxLaneBanner(lane.index, lane.def);
      sfx.lane();
      const laneEl = document.querySelectorAll("#lanes .lane")[lane.index];
      if (laneEl) {
        laneEl.classList.add("lane-flip");
        setTimeout(() => laneEl.classList.remove("lane-flip"), fxDelay(900) || 1);
      }
      await sleep(fxDelay(state.speed >= 4 ? 500 : 1600));
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
      window.dispatchEvent(new CustomEvent("cb-mulligan-done"));
    },

    async hint(p, actions) {
      if (typeof ai.hint === "function") return ai.hint(p, actions);
      return [];
    }
  };
}

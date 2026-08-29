import { AI_BUDGETS, budgetFor } from "./budgets.ts";

let worker = null;
let seq = 1;
const pending = new Map();

function getWorker() {
  if (typeof Worker === "undefined") return null;
  if (!worker) {
    try {
      worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (ev) => {
        const p = pending.get(ev.data.id);
        if (p) {
          pending.delete(ev.data.id);
          p.resolve(ev.data);
        }
      };
    } catch {
      worker = null;
    }
  }
  return worker;
}

function askWorker(req, timeoutMs) {
  const w = getWorker();
  const id = seq++;
  if (!w) {
    return Promise.resolve({ id, pick: null, timedOut: true });
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        resolve({ id, pick: null, timedOut: true });
      }
    }, timeoutMs + 100);
    pending.set(id, {
      resolve: (v) => {
        clearTimeout(timer);
        resolve(v);
      },
    });
    try {
      w.postMessage({ ...req, id });
    } catch {
      pending.delete(id);
      clearTimeout(timer);
      resolve({ id, pick: null, timedOut: true });
    }
  });
}

function slimActs(actions, ctx = {}) {
  return (actions || []).map((a) => ({
    type: a.type,
    label: a.label,
    tributes: a.tributes || 0,
    cost: typeof a.card?.def?.cost === "number" ? a.card.def.cost : 0,
    cardId: a.card?.id || a.card?.def?.id || a.fusion?.id || null,
    speed: a.card?.def?.spell?.speed || 0,
    handTrap: !!(a.card?.def?.handTrap || a.card?.def?.spell?.handTrap),
    enemyCount: typeof ctx.enemyCount === "number" ? ctx.enemyCount : undefined,
    handRest: typeof ctx.handRest === "number" ? ctx.handRest : undefined
  }));
}

/**
 * Wrap an autopilot io. Live picks always come from the board-aware heuristic.
 * The Worker is used only for optional hints (not as a fake search).
 */
export function wrapWithWorkerAi(baseIo, getTier = () => "normal") {
  const tierOf = () => (typeof getTier === "function" ? getTier() : getTier) || "normal";
  return {
    ...baseIo,
    async chooseMain(p, actions) {
      return baseIo.chooseMain(p, actions);
    },
    async askChain(p, legal, chain, ctx) {
      return baseIo.askChain(p, legal, chain, ctx);
    },
    async hint(p, actions, ctx = {}) {
      try {
        const tier = tierOf() === "easy" ? "normal" : tierOf();
        const budget = budgetFor(tier);
        const res = await askWorker(
          { type: "hint", snapshot: null, player: p, tier, actions: slimActs(actions, ctx) },
          budget.ms
        );
        return res.pv || [];
      } catch {
        return [];
      }
    },
  };
}

export { AI_BUDGETS, budgetFor };

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { DuelBoard3D } from "./DuelBoard3D";
import { loadSettings } from "../../ui/settingsStore.js";

type SlimCard = {
  rarity?: string;
  tribe?: string;
  faceup?: boolean;
  faceDownMz?: boolean;
} | null;

type SlimSnap = {
  players?: Array<{
    mz?: SlimCard[];
    stz?: SlimCard[];
  }>;
  lanes?: Array<{ index: number; revealed?: boolean }>;
};

function slimCard(c: any, db: Record<string, any>): SlimCard {
  if (!c) return null;
  const def = db[c.id] || c.def || {};
  return {
    rarity: def.rarity || c.def?.rarity || "N",
    tribe: def.tribe || c.def?.tribe,
    faceup: !!c.faceup,
    faceDownMz: !!c.faceDownMz,
  };
}

function slimFromLive(): SlimSnap | null {
  const G = (window as unknown as { __CB?: { currentG?: any; profile?: any } }).__CB?.currentG;
  if (!G?.players) return null;
  const db = G.cardDb || {};
  return {
    players: G.players.map((pl: any) => ({
      mz: (pl.mz || []).map((c: any) => slimCard(c, db)),
      stz: (pl.stz || []).map((c: any) => slimCard(c, db)),
    })),
    lanes: (G.lanes || []).map((l: any, i: number) => ({ index: i, revealed: !!l.revealed })),
  };
}

/**
 * Optional 3D backdrop. CSS already sets pointer-events: none on #board-3d-host
 * so this cannot steal 2D clicks. Off unless Settings → 3D board is checked.
 */
export function DuelBoardMount() {
  const [on, setOn] = useState(() => !!loadSettings().board3d);
  const [snap, setSnap] = useState<SlimSnap | null>(null);
  const host = typeof document !== "undefined" ? document.getElementById("board-3d-host") : null;

  useEffect(() => {
    const sync = (e?: Event) => {
      const s = (e as CustomEvent)?.detail || loadSettings();
      setOn(!!s.board3d);
    };
    window.addEventListener("cb-settings-changed", sync);
    return () => window.removeEventListener("cb-settings-changed", sync);
  }, []);

  useEffect(() => {
    if (!on) {
      setSnap(null);
      return;
    }
    const tick = () => setSnap(slimFromLive());
    tick();
    const id = window.setInterval(tick, 400);
    return () => window.clearInterval(id);
  }, [on]);

  if (!on || !host) return null;
  return createPortal(
    <DuelBoard3D snapshot={snap} />,
    host
  );
}

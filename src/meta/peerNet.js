// Solo stub — no sockets. Host/Join stays "coming soon".
export function connectPeer() { return { ok: false, reason: "coming soon" }; }
export function disconnectPeer() {}
export function wrapIoPeer(io) { return io; }

// Named extras hub.js / tests still import. No WebSocket, no room relay.
export function formatRoomCode(raw) {
  return String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}
export const BACKEND_OFFLINE_REASON = "coming soon";
export async function createAndHost() {
  return { ok: false, reason: "coming soon", code: "", seed: null };
}

export function serializePick(method, pick, args) {
  if (!args) args = [];
  if (pick == null) return null;
  if (method === "chooseMain") {
    if (pick.type === "undo") return { type: "undo" };
    const actions = args[1] || [];
    let i = actions.indexOf(pick);
    if (i < 0) {
      i = actions.findIndex(function (a) {
        if (!a || a.type !== pick.type) return false;
        if (pick.card && a.card && a.card.uid !== pick.card.uid) return false;
        if (pick.fusion && a.fusion) {
          if (a.fusion.uid !== pick.fusion.uid && !(a.fusion.def && pick.fusion.def && a.fusion.def.id === pick.fusion.def.id)) return false;
        }
        return true;
      });
    }
    return {
      i: i,
      type: pick.type,
      zone: pick.zone == null ? null : pick.zone,
      tributeUids: Array.isArray(pick.tributeUids) ? pick.tributeUids : [],
      cardUid: pick.card && pick.card.uid,
      fusionUid: pick.fusion && pick.fusion.uid
    };
  }
  return pick;
}

export function applyPick(method, packed, args) {
  if (!args) args = [];
  if (packed == null) {
    if (method === "chooseMain") return { type: "end" };
    if (method === "askMulligan" || method === "choose") return [];
    if (method === "askComeback") return "draw";
    return null;
  }
  if (method === "chooseMain") {
    if (packed.type === "undo") return { type: "undo" };
    if (packed.type === "end") return { type: "end", zone: packed.zone == null ? null : packed.zone };
    const actions = args[1] || [];
    let base = packed.i >= 0 ? actions[packed.i] : null;
    if (!base) {
      base = actions.find(function (a) {
        if (!a || a.type !== packed.type) return false;
        if (packed.cardUid != null && a.card && a.card.uid !== packed.cardUid) return false;
        if (packed.fusionUid != null && a.fusion && a.fusion.uid !== packed.fusionUid) return false;
        return true;
      });
    }
    if (!base) return { type: "end" };
    return Object.assign({}, base, {
      zone: packed.zone == null ? (base.zone == null ? null : base.zone) : packed.zone,
      tributeUids: packed.tributeUids || []
    });
  }
  return packed;
}

/**
 * Serializable duel snapshots. Live UI uses these for one Main-Phase Undo
 * (Arena misclick), not a full-match rewind.
 * Cards store `id` + runtime fields; `def` is rehydrated from cardDb.
 */

import { setUid } from "./state.js";

function cardToSnap(c) {
  return {
    uid: c.uid,
    id: c.id,
    owner: c.owner,
    controller: c.controller,
    loc: c.loc,
    zone: c.zone,
    faceup: !!c.faceup,
    setTurn: c.setTurn || 0,
    summonedTurn: c.summonedTurn || 0,
    evolved: !!c.evolved,
    atkMod: c.atkMod || 0,
    defMod: c.defMod || 0,
    tempAtk: c.tempAtk || 0,
    tempDef: c.tempDef || 0,
    tempTurn: c.tempTurn || 0,
    rushGranted: !!c.rushGranted,
    wardGranted: !!c.wardGranted,
    negated: !!c.negated,
    negateUntilTurn: c.negateUntilTurn ?? null,
    stolenFrom: c.stolenFrom ?? null,
    stolenTurn: c.stolenTurn ?? null,
    dmg: c.dmg || 0,
    attacksUsed: c.attacksUsed || 0,
    ambush: c.ambush,
    faceDownMz: c.faceDownMz,
    cannotAttackTurn: c.cannotAttackTurn,
    _ignTurns: c._ignTurns ? { ...c._ignTurns } : undefined,
  };
}

function zoneSnap(arr) {
  return arr.map((c) => (c ? cardToSnap(c) : null));
}

function listSnap(arr) {
  return arr.map(cardToSnap);
}

let maxUidSeen = 1;

function trackUid(c) {
  if (c && c.uid >= maxUidSeen) maxUidSeen = c.uid + 1;
}

export function serializeGame(G) {
  maxUidSeen = 1;
  const players = G.players.map((pl) => {
    const snap = {
      lp: pl.lp,
      ep: pl.ep,
      hand: listSnap(pl.hand),
      deck: listSnap(pl.deck),
      extra: listSnap(pl.extra || []),
      gy: listSnap(pl.gy),
      ban: listSnap(pl.ban),
      mz: zoneSnap(pl.mz),
      stz: zoneSnap(pl.stz),
      normalSummoned: !!pl.normalSummoned,
      ownTurnCount: pl.ownTurnCount || 0,
      evolveUsedThisTurn: !!pl.evolveUsedThisTurn,
      contactOpt: pl.contactOpt ? { ...pl.contactOpt } : {},
      comebackUsed: !!pl.comebackUsed,
      comebackPending: pl.comebackPending ?? null,
      freeEvolvePending: !!pl.freeEvolvePending,
      bonusDrawNextTurn: pl.bonusDrawNextTurn || 0,
      mulliganDone: !!pl.mulliganDone,
    };
    [...snap.hand, ...snap.deck, ...snap.extra, ...snap.gy, ...snap.ban].forEach(trackUid);
    snap.mz.forEach(trackUid);
    snap.stz.forEach(trackUid);
    return snap;
  });

  return {
    version: 1,
    seed: G.seed,
    turnCount: G.turnCount,
    tp: G.tp,
    firstPlayer: G.firstPlayer,
    phase: G.phase,
    over: !!G.over,
    winner: G.winner,
    winReason: G.winReason || "",
    mustAttackUid: G.mustAttackUid ?? null,
    mustAttackTurn: G.mustAttackTurn ?? null,
    players,
    lanes: (G.lanes || []).map((l) => ({
      index: l.index,
      revealed: !!l.revealed,
      defId: l.def?.id || l.defId || "unknown",
    })),
    stats: { ...(G.stats || { turns: 0, chainsResolved: 0, evolutions: 0, fusions: 0, negates: 0 }) },
    uidNext: maxUidSeen,
    eventsLen: (G.events || []).length,
    eventsCheckedIdx: G.eventsCheckedIdx || 0,
    logLen: (G.log || []).length,
  };
}

function hydrateCard(snap, cardDb) {
  return {
    ...snap,
    def: cardDb[snap.id],
    _queued: false,
  };
}

/** Rebuild a playable G shell from snapshot (no io/hooks). Caller attaches cardDb/io. */
export function deserializeGame(snap, cardDb, laneDb = {}) {
  const reviveList = (arr) => arr.map((c) => hydrateCard(c, cardDb));
  const reviveZone = (arr) => arr.map((c) => (c ? hydrateCard(c, cardDb) : null));

  return {
    seed: snap.seed,
    turnCount: snap.turnCount,
    tp: snap.tp,
    firstPlayer: snap.firstPlayer,
    phase: snap.phase,
    over: snap.over,
    winner: snap.winner,
    winReason: snap.winReason,
    mustAttackUid: snap.mustAttackUid ?? null,
    mustAttackTurn: snap.mustAttackTurn ?? null,
    chain: [],
    resolving: false,
    events: [],
    eventsCheckedIdx: 0,
    lastThings: [],
    pendingTriggers: [],
    summonNegCtx: null,
    attackCtx: null,
    battleStep: null,
    log: [],
    io: null,
    cardDb,
    stats: { ...snap.stats },
    players: snap.players.map((pl) => ({
      ...pl,
      hand: reviveList(pl.hand),
      deck: reviveList(pl.deck),
      extra: reviveList(pl.extra || []),
      gy: reviveList(pl.gy),
      ban: reviveList(pl.ban),
      mz: reviveZone(pl.mz),
      stz: reviveZone(pl.stz),
      contactOpt: pl.contactOpt || {},
      comebackUsed: !!pl.comebackUsed,
      comebackPending: pl.comebackPending ?? null,
      freeEvolvePending: !!pl.freeEvolvePending,
      bonusDrawNextTurn: pl.bonusDrawNextTurn || 0,
    })),
    lanes: snap.lanes.map((l) => ({
      index: l.index,
      revealed: l.revealed,
      def: laneDb[l.defId] || { id: l.defId, name: l.defId, text: "" },
    })),
  };
}

/**
 * Restore a live G in place (keep io, rng, meta, hooks, cardDb).
 * Truncates events/log to the snapshot lengths so Labs goals and the duel log stay honest.
 */
export function applySnapshot(G, snap) {
  if (!G || !snap) return G;
  const laneDb = {};
  for (const l of G.lanes || []) {
    const id = l.def?.id || l.defId;
    if (id) laneDb[id] = l.def;
  }
  const shell = deserializeGame(snap, G.cardDb, laneDb);
  G.turnCount = shell.turnCount;
  G.tp = shell.tp;
  G.firstPlayer = shell.firstPlayer;
  G.phase = shell.phase;
  G.over = shell.over;
  G.winner = shell.winner;
  G.winReason = shell.winReason;
  G.mustAttackUid = shell.mustAttackUid ?? null;
  G.mustAttackTurn = shell.mustAttackTurn ?? null;
  G.players = shell.players;
  G.stats = { ...shell.stats };
  if (shell.lanes?.length === G.lanes?.length) {
    G.lanes.forEach((l, i) => { l.revealed = !!shell.lanes[i].revealed; });
  } else {
    G.lanes = shell.lanes;
  }
  G.chain = [];
  G.resolving = false;
  G.pendingTriggers = [];
  G.summonNegCtx = null;
  G.attackCtx = null;
  G.battleStep = null;
  G.lastThings = [];
  if (typeof snap.eventsLen === "number" && Array.isArray(G.events)) {
    G.events.length = Math.min(G.events.length, snap.eventsLen);
    G.eventsCheckedIdx = Math.min(snap.eventsCheckedIdx ?? snap.eventsLen, G.events.length);
  }
  if (typeof snap.logLen === "number" && Array.isArray(G.log)) {
    G.log.length = Math.min(G.log.length, snap.logLen);
  }
  setUid(snap.uidNext || 1);
  return G;
}

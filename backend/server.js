/**
 * Optional thin backend — never required for offline play.
 * Cloud save mirror, leaderboards, room codes, banlist/season push, opt-in telemetry.
 *
 * Run: npm run backend
 * Client still works fully offline from static dist/.
 */

import http from "node:http";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { createAccountStore, bearerToken } from "./accounts.js";

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dir, "data");
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";

if (!existsSync(DATA)) mkdirSync(DATA, { recursive: true });

const files = {
  saves: join(DATA, "saves.json"),
  leaders: join(DATA, "leaders.json"),
  rooms: join(DATA, "rooms.json"),
  banlist: join(DATA, "banlist.json"),
  telemetry: join(DATA, "telemetry.jsonl"),
  accounts: join(DATA, "accounts.json"),
};

const accounts = createAccountStore(files.accounts);

function load(path, fallback) {
  try {
    if (existsSync(path)) return JSON.parse(readFileSync(path, "utf8"));
  } catch { /* ignore */ }
  return fallback;
}
function save(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2));
}

if (!existsSync(files.banlist)) {
  save(files.banlist, {
    seasonId: "s1-launch",
    format: "Advanced",
    forbidden: [],
    limited: [],
    updatedAt: new Date().toISOString(),
  });
}

function json(res, code, body) {
  const raw = JSON.stringify(body);
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(raw);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return json(res, 204, {});

  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  try {
    if (url.pathname === "/health") {
      return json(res, 200, { ok: true, offlineFallback: true, accounts: true, host: HOST });
    }

    if (url.pathname === "/v1/register" && req.method === "POST") {
      const body = await readBody(req);
      const out = accounts.register(body.name, body.password);
      return json(res, out.ok ? 200 : 400, out);
    }
    if (url.pathname === "/v1/login" && req.method === "POST") {
      const body = await readBody(req);
      const out = accounts.login(body.name, body.password);
      return json(res, out.ok ? 200 : 401, out);
    }
    if (url.pathname === "/v1/logout" && req.method === "POST") {
      accounts.logout(bearerToken(req));
      return json(res, 200, { ok: true });
    }
    if (url.pathname === "/v1/me" && req.method === "GET") {
      const me = accounts.userFromToken(bearerToken(req));
      if (!me) return json(res, 401, { error: "not signed in" });
      return json(res, 200, { ok: true, ...me });
    }

    function saveKey(req, body) {
      const me = accounts.userFromToken(bearerToken(req));
      if (me) return `user:${me.id}`;
      return String(body?.deviceId || "").slice(0, 64);
    }

    // Cloud save — account token when signed in, else opt-in device id
    if (url.pathname === "/v1/save" && req.method === "POST") {
      const body = await readBody(req);
      const key = saveKey(req, body);
      if (!key || !body.profile) return json(res, 400, { error: "account or deviceId + profile required" });
      const saves = load(files.saves, {});
      saves[key] = { profile: body.profile, updatedAt: new Date().toISOString() };
      save(files.saves, saves);
      return json(res, 200, { ok: true, key });
    }
    if (url.pathname.startsWith("/v1/save/") && req.method === "GET") {
      const me = accounts.userFromToken(bearerToken(req));
      const deviceId = decodeURIComponent(url.pathname.slice("/v1/save/".length));
      const key = me ? `user:${me.id}` : deviceId;
      const saves = load(files.saves, {});
      const row = saves[key];
      if (!row) return json(res, 404, { error: "not found" });
      return json(res, 200, row);
    }

    // Leaderboards
    if (url.pathname === "/v1/leaderboard" && req.method === "GET") {
      const board = url.searchParams.get("board") || "ranked";
      const leaders = load(files.leaders, {});
      const rows = (leaders[board] || []).slice(0, 50);
      return json(res, 200, { board, rows });
    }
    if (url.pathname === "/v1/leaderboard" && req.method === "POST") {
      const body = await readBody(req);
      const board = String(body.board || "ranked");
      const name = String(body.name || "Duelist").slice(0, 24);
      const score = Number(body.score) || 0;
      const leaders = load(files.leaders, {});
      const rows = leaders[board] || [];
      rows.push({ name, score, at: new Date().toISOString() });
      rows.sort((a, b) => b.score - a.score);
      leaders[board] = rows.slice(0, 100);
      save(files.leaders, leaders);
      return json(res, 200, { ok: true });
    }

    // Room codes (seed + action log relay stub)
    if (url.pathname === "/v1/rooms" && req.method === "POST") {
      const body = await readBody(req);
      const code = (body.code || randomBytes(3).toString("hex")).toUpperCase().slice(0, 6);
      const rooms = load(files.rooms, {});
      rooms[code] = {
        seed: body.seed ?? Math.floor(Math.random() * 2 ** 31),
        host: body.host || "host",
        actions: [],
        createdAt: new Date().toISOString(),
      };
      save(files.rooms, rooms);
      return json(res, 200, { code, seed: rooms[code].seed });
    }
    if (url.pathname.startsWith("/v1/rooms/") && req.method === "GET") {
      const code = url.pathname.slice("/v1/rooms/".length).toUpperCase();
      const rooms = load(files.rooms, {});
      if (!rooms[code]) return json(res, 404, { error: "room not found" });
      return json(res, 200, rooms[code]);
    }
    if (url.pathname.startsWith("/v1/rooms/") && req.method === "POST") {
      const code = url.pathname.slice("/v1/rooms/".length).toUpperCase();
      const body = await readBody(req);
      const rooms = load(files.rooms, {});
      if (!rooms[code]) return json(res, 404, { error: "room not found" });
      if (body.action) rooms[code].actions.push(body.action);
      save(files.rooms, rooms);
      return json(res, 200, { ok: true, actions: rooms[code].actions.length });
    }

    // Banlist / season push
    if (url.pathname === "/v1/banlist" && req.method === "GET") {
      return json(res, 200, load(files.banlist, {}));
    }

    // Opt-in telemetry
    if (url.pathname === "/v1/telemetry" && req.method === "POST") {
      const body = await readBody(req);
      if (!body.optIn) return json(res, 400, { error: "optIn required" });
      const line = JSON.stringify({ ...body, at: new Date().toISOString() }) + "\n";
      writeFileSync(files.telemetry, line, { flag: "a" });
      return json(res, 200, { ok: true });
    }

    json(res, 404, { error: "not found" });
  } catch (e) {
    json(res, 500, { error: String(e.message || e) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Chaind Blitz optional backend on http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`);
  console.log("Bind 0.0.0.0 so LAN / Docker can reach it. Offline play does not need this server.");
});

/* ---- Plaza WebSocket presence ---- */
const plaza = new Map(); // ws -> { id, name, x, z }
const wss = new WebSocketServer({ noServer: true });

function broadcastPeers() {
  const peers = [...plaza.values()].map((p) => ({ id: p.id, name: p.name, x: p.x, z: p.z }));
  const raw = JSON.stringify({ type: "peers", peers });
  for (const client of plaza.keys()) {
    if (client.readyState === 1) client.send(raw);
  }
}

wss.on("connection", (socket) => {
  const id = `p_${randomBytes(3).toString("hex")}`;
  plaza.set(socket, { id, name: "Duelist", x: 0, z: 0 });
  broadcastPeers();
  socket.on("message", (buf) => {
    try {
      const msg = JSON.parse(String(buf));
      const me = plaza.get(socket);
      if (!me) return;
      if (msg.type === "hello") {
        me.id = msg.id || me.id;
        me.name = String(msg.name || "Duelist").slice(0, 24);
      } else if (msg.type === "move") {
        me.x = Number(msg.x) || 0;
        me.z = Number(msg.z) || 0;
        me.id = msg.id || me.id;
        broadcastPeers();
      } else if (msg.type === "chat") {
        const payload = JSON.stringify({ type: "chat", id: me.id, name: me.name, msg: String(msg.msg || "").slice(0, 240) });
        for (const client of plaza.keys()) if (client.readyState === 1) client.send(payload);
      } else if (msg.type === "invite") {
        const payload = JSON.stringify({
          type: "invite",
          fromId: me.id,
          name: me.name,
          toId: String(msg.toId || ""),
          code: String(msg.code || "").toUpperCase().slice(0, 6)
        });
        for (const [client, peer] of plaza) {
          if (client.readyState !== 1) continue;
          if (!msg.toId || peer.id === msg.toId) client.send(payload);
        }
      }
    } catch { /* ignore */ }
  });
  socket.on("close", () => {
    plaza.delete(socket);
    broadcastPeers();
  });
});

/* ---- Live duel rooms (Host/Join + ranked queue) ---- */
const duelWss = new WebSocketServer({ noServer: true });
const liveRooms = new Map();
const waitQueues = { ranked: null, draft: null, sealed: null };

function sendJson(ws, obj) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
}

function roomCode() {
  return randomBytes(3).toString("hex").toUpperCase().slice(0, 6);
}

function ensureRoom(code, seed, kind = "pvp") {
  const id = String(code || roomCode()).toUpperCase().slice(0, 6);
  if (!liveRooms.has(id)) {
    liveRooms.set(id, {
      code: id,
      kind,
      seed: seed ?? Math.floor(Math.random() * 2 ** 31),
      seats: [null, null],
      decks: [null, null],
      extras: [[], []],
      names: ["Host", "Guest"],
      buildingSent: false
    });
  }
  return liveRooms.get(id);
}

function needsBuild(kind) {
  return kind === "draft" || kind === "sealed";
}

function tryStart(room) {
  if (!room.seats[0] || !room.seats[1]) return;
  if (!room.decks[0] || !room.decks[1]) return;
  const payload = {
    type: "start",
    kind: room.kind || "pvp",
    code: room.code,
    seed: room.seed,
    host: { name: room.names[0], deck: room.decks[0], extra: room.extras[0] },
    guest: { name: room.names[1], deck: room.decks[1], extra: room.extras[1] }
  };
  sendJson(room.seats[0], payload);
  sendJson(room.seats[1], payload);
}

function tryBuild(room) {
  if (!needsBuild(room.kind)) return;
  if (room.buildingSent) return;
  if (!room.seats[0] || !room.seats[1]) return;
  room.buildingSent = true;
  for (let i = 0; i < 2; i++) {
    sendJson(room.seats[i], {
      type: "build",
      kind: room.kind,
      seed: room.seed,
      seat: i,
      code: room.code
    });
  }
}

function seatOf(room, ws) {
  if (room.seats[0] === ws) return 0;
  if (room.seats[1] === ws) return 1;
  return -1;
}

function takeSeat(room, socket, seat, msg) {
  room.seats[seat] = socket;
  room.names[seat] = String(msg.name || (seat === 0 ? "Host" : "Guest")).slice(0, 24);
  if (needsBuild(room.kind)) {
    room.decks[seat] = null;
    room.extras[seat] = [];
  } else {
    room.decks[seat] = Array.isArray(msg.deck) ? msg.deck : [];
    room.extras[seat] = Array.isArray(msg.extra) ? msg.extra : [];
  }
  socket._cbRoom = room;
}

function pairQueue(kind, entry, socket) {
  const waiter = waitQueues[kind];
  if (waiter && waiter.ws.readyState === 1 && waiter.ws !== socket) {
    waitQueues[kind] = null;
    const room = ensureRoom(roomCode(), Math.floor(Math.random() * 2 ** 31), kind);
    takeSeat(room, waiter.ws, 0, waiter);
    takeSeat(room, socket, 1, entry);
    sendJson(waiter.ws, { type: "matched", kind, code: room.code, seed: room.seed, seat: 0 });
    sendJson(socket, { type: "matched", kind, code: room.code, seed: room.seed, seat: 1 });
    tryBuild(room);
    tryStart(room);
    return room;
  }
  waitQueues[kind] = entry;
  sendJson(socket, { type: "queued", kind, code: "", seed: null, seat: 0 });
  return null;
}

duelWss.on("connection", (socket) => {
  let room = null;
  socket.on("message", (buf) => {
    let msg;
    try { msg = JSON.parse(String(buf)); } catch { return; }
    if (msg.type === "host") {
      const kind = String(msg.kind || "pvp");
      room = ensureRoom(msg.code, msg.seed, kind);
      room.kind = kind;
      if (msg.seed != null) room.seed = Number(msg.seed) || room.seed;
      takeSeat(room, socket, 0, msg);
      sendJson(socket, { type: "hosted", kind, code: room.code, seed: room.seed, seat: 0 });
      tryBuild(room);
      tryStart(room);
    } else if (msg.type === "join") {
      const code = String(msg.code || "").toUpperCase().slice(0, 6);
      room = liveRooms.get(code) || ensureRoom(code, msg.seed, msg.kind || "pvp");
      takeSeat(room, socket, 1, msg);
      sendJson(socket, { type: "joined", kind: room.kind, code: room.code, seed: room.seed, seat: 1 });
      tryBuild(room);
      tryStart(room);
    } else if (msg.type === "queue") {
      const kind = String(msg.kind || (msg.ranked ? "ranked" : "pvp"));
      const entry = {
        ws: socket,
        name: String(msg.name || "Duelist").slice(0, 24),
        deck: Array.isArray(msg.deck) ? msg.deck : [],
        extra: Array.isArray(msg.extra) ? msg.extra : [],
        kind
      };
      room = pairQueue(kind, entry, socket) || room;
    } else if (msg.type === "ready" && room) {
      const seat = seatOf(room, socket);
      if (seat < 0) return;
      room.decks[seat] = Array.isArray(msg.deck) ? msg.deck : [];
      room.extras[seat] = Array.isArray(msg.extra) ? msg.extra : [];
      tryStart(room);
    } else if (msg.type === "pick" && room) {
      const from = seatOf(room, socket);
      const other = from === 0 ? room.seats[1] : room.seats[0];
      sendJson(other, msg);
    }
  });
  socket.on("close", () => {
    for (const k of Object.keys(waitQueues)) {
      if (waitQueues[k]?.ws === socket) waitQueues[k] = null;
    }
    if (!room) return;
    const other = room.seats[0] === socket ? room.seats[1] : room.seats[0];
    sendJson(other, { type: "peer-left" });
    liveRooms.delete(room.code);
    room = null;
  });
});

server.on("upgrade", (req, socket, head) => {
  const path = String(req.url || "").split("?")[0];
  if (path === "/plaza") {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
    return;
  }
  if (path === "/duel") {
    duelWss.handleUpgrade(req, socket, head, (ws) => duelWss.emit("connection", ws, req));
    return;
  }
  socket.destroy();
});

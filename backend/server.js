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

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dir, "data");
const PORT = Number(process.env.PORT || 8787);

if (!existsSync(DATA)) mkdirSync(DATA, { recursive: true });

const files = {
  saves: join(DATA, "saves.json"),
  leaders: join(DATA, "leaders.json"),
  rooms: join(DATA, "rooms.json"),
  banlist: join(DATA, "banlist.json"),
  telemetry: join(DATA, "telemetry.jsonl"),
};

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
    "Access-Control-Allow-Headers": "Content-Type",
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
      return json(res, 200, { ok: true, offlineFallback: true });
    }

    // Cloud save — opt-in device id
    if (url.pathname === "/v1/save" && req.method === "POST") {
      const body = await readBody(req);
      const deviceId = String(body.deviceId || "").slice(0, 64);
      if (!deviceId || !body.profile) return json(res, 400, { error: "deviceId + profile required" });
      const saves = load(files.saves, {});
      saves[deviceId] = { profile: body.profile, updatedAt: new Date().toISOString() };
      save(files.saves, saves);
      return json(res, 200, { ok: true });
    }
    if (url.pathname.startsWith("/v1/save/") && req.method === "GET") {
      const deviceId = decodeURIComponent(url.pathname.slice("/v1/save/".length));
      const saves = load(files.saves, {});
      const row = saves[deviceId];
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

server.listen(PORT, () => {
  console.log(`Chaind Blitz optional backend on http://localhost:${PORT}`);
  console.log("Offline play does not need this server.");
});

/* ---- Plaza WebSocket presence ---- */
const plaza = new Map(); // ws -> { id, name, x, z }
const wss = new WebSocketServer({ server, path: "/plaza" });

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
      }
    } catch { /* ignore */ }
  });
  socket.on("close", () => {
    plaza.delete(socket);
    broadcastPeers();
  });
});

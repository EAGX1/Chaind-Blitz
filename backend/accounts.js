/**
 * Optional password accounts for the local/hosted backend.
 * Offline play never requires this — tokens just unlock cloud save + a name.
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const SCRYPT = { N: 4096, r: 8, p: 1, keylen: 32 };

export function createAccountStore(file) {
  function load() {
    try {
      if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
    } catch { /* ignore */ }
    return { users: {}, sessions: {} };
  }
  function save(data) {
    writeFileSync(file, JSON.stringify(data));
  }

  function hashPassword(password, saltHex) {
    const salt = saltHex ? Buffer.from(saltHex, "hex") : randomBytes(16);
    const hash = scryptSync(String(password), salt, SCRYPT.keylen, {
      N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p
    });
    return { salt: salt.toString("hex"), hash: hash.toString("hex") };
  }

  function verify(password, row) {
    if (!row?.hash || !row?.salt) return false;
    const next = hashPassword(password, row.salt);
    const a = Buffer.from(next.hash, "hex");
    const b = Buffer.from(row.hash, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  }

  function purgeSessions(data) {
    const now = Date.now();
    for (const [tok, s] of Object.entries(data.sessions)) {
      if (!s?.exp || s.exp < now) delete data.sessions[tok];
    }
  }

  function register(name, password) {
    const n = String(name || "").trim().slice(0, 24);
    const pw = String(password || "");
    if (n.length < 2) return { ok: false, error: "name too short" };
    if (pw.length < 6) return { ok: false, error: "password must be 6+ characters" };
    const data = load();
    const key = n.toLowerCase();
    if (data.users[key]) return { ok: false, error: "name taken" };
    const id = `u_${randomBytes(6).toString("hex")}`;
    const { salt, hash } = hashPassword(pw);
    data.users[key] = { id, name: n, salt, hash, createdAt: new Date().toISOString() };
    const token = issue(data, id, n);
    save(data);
    return { ok: true, token, name: n, id };
  }

  function login(name, password) {
    const data = load();
    const row = data.users[String(name || "").trim().toLowerCase()];
    if (!row || !verify(password, row)) return { ok: false, error: "bad name or password" };
    const token = issue(data, row.id, row.name);
    save(data);
    return { ok: true, token, name: row.name, id: row.id };
  }

  function issue(data, id, name) {
    purgeSessions(data);
    const token = randomBytes(24).toString("hex");
    data.sessions[token] = { id, name, exp: Date.now() + 14 * 24 * 60 * 60 * 1000 };
    return token;
  }

  function userFromToken(token) {
    if (!token) return null;
    const data = load();
    const s = data.sessions[token];
    if (!s || s.exp < Date.now()) return null;
    return { id: s.id, name: s.name };
  }

  function logout(token) {
    const data = load();
    delete data.sessions[token];
    save(data);
  }

  return { register, login, userFromToken, logout };
}

export function bearerToken(req) {
  const h = String(req.headers.authorization || req.headers.Authorization || "");
  if (h.toLowerCase().startsWith("bearer ")) return h.slice(7).trim();
  return "";
}

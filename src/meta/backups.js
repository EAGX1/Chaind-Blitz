// Rotate the last 5 profile snapshots in localStorage (chaind-blitz-backup-N).
// Independent of the live save key so restore still works if the main save is corrupt.

export const BACKUP_COUNT = 5;
export const BACKUP_PREFIX = "chaind-blitz-backup-";
const SAVE_KEY = "chaind-blitz-save-v1";

function key(n) {
  return `${BACKUP_PREFIX}${n}`;
}

function storage() {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

export function rotateBackup(profile) {
  const ls = storage();
  if (!ls || !profile) return false;
  try {
    for (let n = BACKUP_COUNT; n >= 2; n--) {
      const prev = ls.getItem(key(n - 1));
      if (prev != null) ls.setItem(key(n), prev);
      else ls.removeItem(key(n));
    }
    ls.setItem(key(1), JSON.stringify(profile));
    return true;
  } catch (e) {
    console.warn("backup rotate failed", e);
    return false;
  }
}

export function loadBackup(n) {
  const ls = storage();
  if (!ls || n < 1 || n > BACKUP_COUNT) return null;
  try {
    const raw = ls.getItem(key(n));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function listBackups() {
  const out = [];
  for (let n = 1; n <= BACKUP_COUNT; n++) {
    const p = loadBackup(n);
    out.push({ n, present: !!p, name: p?.name, gems: p?.gems, coins: p?.coins });
  }
  return out;
}

export function restoreBackup(n) {
  const p = loadBackup(n);
  const ls = storage();
  if (!p || !ls) return null;
  try {
    ls.setItem(SAVE_KEY, JSON.stringify(p));
    return p;
  } catch (e) {
    console.warn("backup restore failed", e);
    return null;
  }
}

/** Downloadable JSON of the live save (or newest backup). */
export function exportSaveJson() {
  const ls = storage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(SAVE_KEY);
    if (raw) return raw;
    const b = loadBackup(1);
    return b ? JSON.stringify(b) : null;
  } catch {
    return null;
  }
}

/** Write a profile JSON string into the live save key. Returns parsed profile or null. */
export function importSaveJson(json) {
  const ls = storage();
  if (!ls || json == null) return null;
  try {
    const data = typeof json === "string" ? JSON.parse(json) : json;
    if (!data || typeof data !== "object") return null;
    ls.setItem(SAVE_KEY, JSON.stringify(data));
    return data;
  } catch (e) {
    console.warn("save import failed", e);
    return null;
  }
}

export async function copySaveToClipboard() {
  const json = exportSaveJson();
  if (!json || typeof navigator === "undefined" || !navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(json);
    return true;
  } catch {
    return false;
  }
}

export async function shareSave() {
  const json = exportSaveJson();
  if (!json || typeof navigator === "undefined" || typeof navigator.share !== "function") return false;
  try {
    const file = new File([json], "chaind-blitz-save.json", { type: "application/json" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: "Chaind Blitz save", files: [file] });
      return true;
    }
    await navigator.share({ title: "Chaind Blitz save", text: json });
    return true;
  } catch {
    return false;
  }
}

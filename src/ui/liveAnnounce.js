// Screen-reader announces. Public MagicProject / AccessibleArena steal.
// Polite for plays; assertive for LP hits. Ctrl+R / Cmd+R repeats the last line.

let lastLine = "";

export function lastAnnounce() {
  return lastLine;
}

export function resetAnnounce() {
  lastLine = "";
}

function ensureLive(id, assertive) {
  if (typeof document === "undefined") return null;
  let el = document.getElementById(id);
  if (el) return el;
  el = document.createElement("div");
  el.id = id;
  el.className = "sr-only";
  el.setAttribute("aria-live", assertive ? "assertive" : "polite");
  el.setAttribute("aria-atomic", "true");
  document.body.appendChild(el);
  return el;
}

export function announce(msg, { assertive = false } = {}) {
  lastLine = String(msg || "").trim();
  if (!lastLine || typeof document === "undefined") return lastLine;
  const el = ensureLive(assertive ? "cb-live-assertive" : "cb-live-polite", assertive);
  if (!el) return lastLine;
  el.textContent = "";
  const line = lastLine;
  queueMicrotask(() => { el.textContent = line; });
  return lastLine;
}

export function installAnnounceRepeat() {
  if (installAnnounceRepeat._wired) return;
  installAnnounceRepeat._wired = true;
  window.addEventListener("keydown", (e) => {
    if (e.key !== "r" && e.key !== "R") return;
    if (!e.ctrlKey && !e.metaKey) return;
    if (e.repeat) return;
    if (e.target?.closest?.("input, textarea, select, [contenteditable]")) return;
    const duel = document.getElementById("screen-duel");
    if (!duel || duel.classList.contains("hidden")) return;
    e.preventDefault();
    if (lastLine) announce(lastLine, { assertive: true });
  });
}

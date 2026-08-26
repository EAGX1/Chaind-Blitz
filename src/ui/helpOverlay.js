/** F1 shortcut overlay during a duel. Accessible Arena / Master Duel steal. */

const LINES = [
  ["Drag", "Play a glowing card onto a zone, or drag an attacker onto a target — click still works"],
  ["Hand drag", "Reorder your hand — not the same as drag-to-play"],
  ["Home / End", "First / last card on the idle board"],
  ["H / F / G", "Idle: your hand / field / GY"],
  ["Enter / Space", "Confirm the focused choice · Space also ends an idle phase"],
  ["E", "End this phase (also when idle if the orb is live)"],
  ["U", "Undo last Main Phase play"],
  ["I", "Pin / unpin the inspector"],
  ["P / Space (chain)", "Pass this window"],
  ["Chain faces", "Click a card face to chain — not a second Confirm"],
  ["CL strip", "Click a chain face to inspect. Resolves last → first"],
  ["Dim cards", "Greyed hand or field cards cannot be used — hover for why. Locked Sets arm next turn. Battle greys illegal attackers"],
  ["COPY LOG", "Copies the full match text — not replay JSON. Filter chips only hide rows — All / Plays / Combat / Chain. Search filters the list the same way"],
  ["/", "Idle: focus Search log — not a mill or deck search. Phone: 16px on Search log and hub inputs so Safari does not zoom. Prompt docks above your hand — not over the field"],
  ["F", "Idle: field · chain: pass until your turn (not AI Pilot)"],
  ["Ctrl+R", "Repeat last announce"],
  ["← / →", "Idle: cycle the board. Replay viewer rewinds the recorded board — not live match undo"],
  ["1–9", "Pick the nth option"],
  ["B / Backspace", "Back out of targeting"],
  ["Esc", "Pause — works during a forced chain. Concede stays on the pause menu"],
  ["F1", "Close this list"]
];

export function helpLines() {
  return LINES.map(([k, v]) => `${k} — ${v}`);
}

export function closeHelpOverlay() {
  document.getElementById("help-overlay")?.remove();
}

export function openHelpOverlay() {
  closeHelpOverlay();
  const modal = document.createElement("div");
  modal.id = "help-overlay";
  modal.className = "cb-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-label", "Shortcuts");
  modal.innerHTML = `
    <div class="cb-modal-card" style="max-width:420px;">
      <h2 style="margin:0 0 12px;">SHORTCUTS</h2>
      <ul class="help-list">
        ${LINES.map(([k, v]) => `<li><b>${k}</b> ${v}</li>`).join("")}
      </ul>
      <p class="dim" style="font-size:11px;margin:12px 0 0;">F1 or Esc to close. Arrows, H/F/G, and E also work on an idle board.</p>
      <button type="button" class="cb-btn primary" data-help-close style="margin-top:12px;">CLOSE</button>
    </div>
  `;
  const close = () => closeHelpOverlay();
  modal.addEventListener("click", (e) => {
    if (e.target === modal || e.target.closest("[data-help-close]")) close();
  });
  document.body.appendChild(modal);
  return { close };
}

export function toggleHelpOverlay() {
  if (document.getElementById("help-overlay")) closeHelpOverlay();
  else openHelpOverlay();
}

let wired = false;
export function installHelpOverlay() {
  if (wired) return;
  wired = true;
  window.addEventListener("keydown", (e) => {
    if (e.key !== "F1") return;
    if (e.repeat) return;
    if (e.target?.closest?.("input, textarea, select, [contenteditable]")) return;
    const duel = document.getElementById("screen-duel");
    if (!duel || duel.classList.contains("hidden")) return;
    e.preventDefault();
    toggleHelpOverlay();
  });
}

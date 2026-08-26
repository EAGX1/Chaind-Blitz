// In-duel pause menu: resume, concede, rulebook, settings.

/**
 * @param {{ onResume?: () => void, onConcede?: () => void, onRulebook?: () => void, onSettings?: () => void }} handlers
 * @returns {{ close: () => void }}
 */
export function openPauseMenu({ onResume, onConcede, onRulebook, onSettings } = {}) {
  const modal = document.createElement("div");
  modal.className = "cb-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-label", "Paused");

  modal.innerHTML = `
    <div class="cb-modal-card" style="text-align:center;min-width:min(280px,92vw);">
      <h2 style="margin:0 0 16px;">PAUSED</h2>
      <div class="pause-actions" style="display:flex;flex-direction:column;gap:8px;">
        <button type="button" class="cb-btn primary" data-act="resume">RESUME</button>
        <button type="button" class="cb-btn" data-act="rulebook">RULEBOOK</button>
        <button type="button" class="cb-btn" data-act="settings">SETTINGS</button>
        <button type="button" class="cb-btn danger" data-act="concede">CONCEDE</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  function close() {
    modal.remove();
  }

  modal.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) {
      if (e.target === modal) {
        close();
        onResume?.();
      }
      return;
    }
    const act = btn.getAttribute("data-act");
    if (act === "resume") {
      close();
      onResume?.();
    } else if (act === "concede") {
      close();
      onConcede?.();
    } else if (act === "rulebook") {
      close();
      onRulebook?.();
    } else if (act === "settings") {
      close();
      onSettings?.();
    }
  });

  return { close };
}

/** Small confirm modal. Resolves true/false. */

export function confirmDialog({ title, body, confirm = "CONFIRM", cancel = "CANCEL", danger = false } = {}) {
  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.className = "cb-modal";
    modal.style.zIndex = "140";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-label", title || "Confirm");
    modal.innerHTML = `
      <div class="cb-modal-card" style="text-align:center;min-width:min(280px,92vw);">
        <h2 style="margin:0 0 8px;">${title || "Confirm"}</h2>
        ${body ? `<p class="dim" style="margin:0 0 16px;">${body}</p>` : ""}
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
          <button type="button" class="cb-btn ${danger ? "danger" : "primary"}" data-act="ok">${confirm}</button>
          <button type="button" class="cb-btn" data-act="no">${cancel}</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); done(false); }
      else if (e.key === "Enter") { e.preventDefault(); done(true); }
    };
    const done = (v) => {
      window.removeEventListener("keydown", onKey);
      modal.remove();
      resolve(v);
    };
    modal.addEventListener("click", (e) => {
      const act = e.target.closest("[data-act]")?.getAttribute("data-act");
      if (act === "ok") done(true);
      else if (act === "no" || e.target === modal) done(false);
    });
    window.addEventListener("keydown", onKey);
  });
}

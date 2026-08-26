/** Darkened first-class mulligan. Hearthstone / Gwent steal. */

export function closeMulliganStage() {
  document.getElementById("mulligan-stage")?.remove();
  document.getElementById("screen-duel")?.classList.remove("mulligan-on");
  document.querySelectorAll(".mulligan-replace").forEach((el) => el.classList.remove("mulligan-replace"));
}

/**
 * @param {{ onKeep: () => void, onRedraw: () => void }} handlers
 */
export function openMulliganStage({ onKeep, onRedraw } = {}) {
  closeMulliganStage();
  const duel = document.getElementById("screen-duel");
  duel?.classList.add("mulligan-on");
  const stage = document.createElement("div");
  stage.id = "mulligan-stage";
  stage.className = "mulligan-stage";
  stage.setAttribute("role", "dialog");
  stage.setAttribute("aria-label", "Mulligan");
  stage.innerHTML = `
    <div class="mulligan-banner">
      <div class="mulligan-copy">
        <h2>OPENING HAND</h2>
        <p>Click a card to mark it REPLACED. Enter keeps. R redraws selected.</p>
      </div>
      <div class="mulligan-actions">
        <button type="button" class="cb-btn primary" data-mull="keep">KEEP HAND</button>
        <button type="button" class="cb-btn" data-mull="redraw">REDRAW SELECTED</button>
      </div>
    </div>
  `;
  stage.addEventListener("click", (e) => {
    const act = e.target.closest("[data-mull]")?.getAttribute("data-mull");
    if (act === "keep") onKeep?.();
    if (act === "redraw") onRedraw?.();
  });
  document.body.appendChild(stage);
  return {
    close: closeMulliganStage,
    mark(el, on) {
      el?.classList.toggle("mulligan-replace", !!on);
    }
  };
}

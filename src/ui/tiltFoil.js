// Cheap mouse parallax for .foil cards. Noop-safe if el missing / reduced motion.

const bound = new WeakSet();

/**
 * @param {HTMLElement|null|undefined} el
 */
export function enableCardTilt(el) {
  if (!el || !(el instanceof HTMLElement)) return;
  if (!el.classList.contains("foil")) return;
  if (bound.has(el)) return;
  if (document.documentElement.dataset.reducedMotion === "1") return;
  if (window.matchMedia?.("(pointer: coarse)")?.matches) return;

  bound.add(el);
  el.style.transformStyle = "preserve-3d";
  el.style.willChange = "transform";

  const onMove = (e) => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(600px) rotateY(${x * 10}deg) rotateX(${-y * 8}deg)`;
  };
  const onLeave = () => {
    el.style.transform = "";
  };

  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerleave", onLeave);
}

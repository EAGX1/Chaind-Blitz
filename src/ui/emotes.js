// Mid-duel emote wheel. Cosmetics stay local — never uploaded.

import { CATALOG, CATALOG_BY_ID, owned } from "../meta/cosmetics.js";
import { loadProfile } from "../meta/profile.js";
import { sfx } from "./fx.js";

function ownedEmotes(profile) {
  return CATALOG.filter((c) => c.slot === "emote" && owned(profile, c.id));
}

export function showEmoteBubble(side, item) {
  const host = document.getElementById(`hud-${side}`);
  if (!host || !item) return;
  host.querySelectorAll(".emote-bubble").forEach((el) => el.remove());
  const bubble = document.createElement("div");
  bubble.className = "emote-bubble";
  bubble.textContent = `${item.icon} ${item.name}`;
  host.appendChild(bubble);
  setTimeout(() => bubble.remove(), 2200);
}

export function playOwnedEmote(id, side = 0) {
  const item = CATALOG_BY_ID[id];
  if (!item || item.slot !== "emote") return;
  sfx.click?.();
  showEmoteBubble(side, item);
}

export function mountEmoteWheel(btn) {
  if (!btn || btn.dataset.emoteWired) return;
  btn.dataset.emoteWired = "1";
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const existing = document.getElementById("emote-wheel");
    if (existing) {
      existing.remove();
      return;
    }
    const profile = window.__CB?.profile || loadProfile();
    const list = ownedEmotes(profile);
    const wheel = document.createElement("div");
    wheel.id = "emote-wheel";
    wheel.className = "emote-wheel";
    wheel.setAttribute("role", "menu");
    wheel.setAttribute("aria-label", "Emotes");
    if (!list.length) {
      wheel.innerHTML = `<p class="dim">No emotes owned.</p>`;
    } else {
      list.forEach((item) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "emote-chip";
        b.textContent = `${item.icon} ${item.name}`;
        b.addEventListener("click", () => {
          playOwnedEmote(item.id, 0);
          wheel.remove();
        });
        wheel.appendChild(b);
      });
    }
    btn.parentElement?.appendChild(wheel);
  });
  document.addEventListener("click", (ev) => {
    const wheel = document.getElementById("emote-wheel");
    if (!wheel) return;
    if (wheel.contains(ev.target) || btn.contains(ev.target)) return;
    wheel.remove();
  });
}

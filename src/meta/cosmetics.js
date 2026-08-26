// Boutique catalog: card backs, playmats, avatars, themes, mid-duel emotes.
// Prices are coins and/or rarity dust. Starter set is free and always owned.

export const SLOTS = ["back", "mat", "avatar", "theme"];

export const CATALOG = [
  // ---- card backs ----
  { id: "back_starter", slot: "back", name: "Chaind Back", icon: "🂠",
    desc: "Default card back. Every duelist starts here.", coins: 0, dust: null, free: true },
  { id: "back_ember", slot: "back", name: "Ember Back", icon: "🔥",
    desc: "Scorched foil with a living ember core.", coins: 500, dust: null, free: false },
  { id: "back_abyss", slot: "back", name: "Abyss Back", icon: "🌊",
    desc: "Deep-water ripple, almost black.", coins: 500, dust: null, free: false },
  { id: "back_ward", slot: "back", name: "Ward Back", icon: "🛡",
    desc: "Stone-etched barrier pattern.", coins: 800, dust: { R: 20 }, free: false },
  { id: "back_gold", slot: "back", name: "Gold Back", icon: "✦",
    desc: "Coliseum champion foil.", coins: 2000, dust: { UR: 10 }, free: false },

  // ---- playmats ----
  { id: "mat_starter", slot: "mat", name: "Plaza Mat", icon: "▭",
    desc: "Standard Battle City felt.", coins: 0, dust: null, free: true },
  { id: "mat_ember", slot: "mat", name: "Ember Mat", icon: "🌋",
    desc: "Lava-veined playmat.", coins: 800, dust: null, free: false },
  { id: "mat_coliseum", slot: "mat", name: "Coliseum Mat", icon: "🏟",
    desc: "Ranked-floor stone and gold inlay.", coins: 800, dust: null, free: false },
  { id: "mat_void", slot: "mat", name: "Void Mat", icon: "◉",
    desc: "Near-black mat with a single chain ring.", coins: 1200, dust: { SR: 15 }, free: false },
  { id: "mat_custom", slot: "mat", name: "Custom Mat", icon: "🖼",
    desc: "Load a local image (never uploaded).", coins: 0, dust: null, free: true },

  // ---- avatars ----
  { id: "avatar_starter", slot: "avatar", name: "Hover Duelist", icon: "♟",
    desc: "Original plaza standee — floating projector disc, not a wrist disk.", coins: 0, dust: null, free: true },
  { id: "avatar_custom", slot: "avatar", name: "PNG Cutout", icon: "🖼",
    desc: "Any local picture — cropped and stood in the plaza. Never uploaded.", coins: 0, dust: null, free: true },
  { id: "avatar_ember", slot: "avatar", name: "Ember Warden", icon: "🔥",
    desc: "Agro-pillar greeter.", coins: 400, dust: null, free: false },
  { id: "avatar_leviathan", slot: "avatar", name: "Leviathan", icon: "🐉",
    desc: "Abyss-pillar greeter.", coins: 400, dust: { SR: 10 }, free: false },
  { id: "avatar_crown", slot: "avatar", name: "Terra Crown", icon: "👑",
    desc: "Control-pillar greeter.", coins: 600, dust: null, free: false },

  // ---- themes ----
  { id: "theme_starter", slot: "theme", name: "Night Plaza", icon: "🌙",
    desc: "Default dark chrome.", coins: 0, dust: null, free: true },
  { id: "theme_ember", slot: "theme", name: "Ember", icon: "🧡",
    desc: "Warm golds and magma reds.", coins: 350, dust: null, free: false },
  { id: "theme_abyss", slot: "theme", name: "Abyss", icon: "💙",
    desc: "Cold teal and deep navy.", coins: 350, dust: null, free: false },
  { id: "theme_gold", slot: "theme", name: "Coliseum Gold", icon: "💛",
    desc: "High-contrast ranked chrome.", coins: 900, dust: { R: 30 }, free: false },

  // ---- emotes (owned, not an equip slot) ----
  { id: "emote_gg", slot: "emote", name: "GG", icon: "🤝",
    desc: "Good game.", coins: 0, dust: null, free: true },
  { id: "emote_chain", slot: "emote", name: "Chain", icon: "⛓",
    desc: "You just chained them.", coins: 300, dust: null, free: false },
  { id: "emote_evolve", slot: "emote", name: "Evolve", icon: "🧬",
    desc: "Flex an evolution.", coins: 300, dust: null, free: false },
  { id: "emote_oops", slot: "emote", name: "Oops", icon: "😅",
    desc: "Misplay acknowledged.", coins: 300, dust: null, free: false },
  { id: "emote_wow", slot: "emote", name: "Wow", icon: "✨",
    desc: "That resolve was filthy.", coins: 500, dust: null, free: false }
];

export const CATALOG_BY_ID = Object.fromEntries(CATALOG.map((c) => [c.id, c]));
export const STARTER_IDS = CATALOG.filter((c) => c.free).map((c) => c.id);

export const DEFAULT_EQUIPPED = {
  back: "back_starter",
  mat: "mat_starter",
  avatar: "avatar_starter",
  theme: "theme_starter"
};

export function catalogBySlot(slot) {
  return CATALOG.filter((c) => c.slot === slot);
}

export function ensureCosmetics(profile) {
  if (!Array.isArray(profile.cosmeticsOwned)) profile.cosmeticsOwned = [];
  for (const id of STARTER_IDS) {
    if (!profile.cosmeticsOwned.includes(id)) profile.cosmeticsOwned.push(id);
  }
  profile.equipped = { ...DEFAULT_EQUIPPED, ...(profile.equipped || {}) };
  return profile;
}

export function owned(profile, id) {
  ensureCosmetics(profile);
  return profile.cosmeticsOwned.includes(id);
}

function canPay(profile, item) {
  if (profile?.devCheats) return { ok: true };
  if (item.coins > 0 && (profile.coins || 0) < item.coins) {
    return { ok: false, reason: "Not enough coins" };
  }
  if (item.dust) {
    for (const [rarity, n] of Object.entries(item.dust)) {
      if ((profile.dust?.[rarity] || 0) < n) {
        return { ok: false, reason: `Not enough ${rarity} dust` };
      }
    }
  }
  return { ok: true };
}

function pay(profile, item) {
  if (profile?.devCheats) return;
  if (item.coins > 0) profile.coins -= item.coins;
  if (item.dust) {
    profile.dust = profile.dust || { N: 0, R: 0, SR: 0, UR: 0 };
    for (const [rarity, n] of Object.entries(item.dust)) {
      profile.dust[rarity] = (profile.dust[rarity] || 0) - n;
    }
  }
}

export function buyCosmetic(profile, id) {
  ensureCosmetics(profile);
  const item = CATALOG_BY_ID[id];
  if (!item) return { ok: false, reason: "Unknown cosmetic" };
  if (owned(profile, id)) return { ok: false, reason: "Already owned" };
  const afford = canPay(profile, item);
  if (!afford.ok) return afford;
  pay(profile, item);
  profile.cosmeticsOwned.push(id);
  return { ok: true, item };
}

export function equipCosmetic(profile, slot, id) {
  ensureCosmetics(profile);
  if (!SLOTS.includes(slot)) return { ok: false, reason: "Invalid slot" };
  const item = CATALOG_BY_ID[id];
  if (!item) return { ok: false, reason: "Unknown cosmetic" };
  if (item.slot !== slot) return { ok: false, reason: "Wrong slot for this item" };
  if (!owned(profile, id)) return { ok: false, reason: "Not owned" };
  profile.equipped[slot] = id;
  applyEquippedToDom(profile);
  return { ok: true, equipped: { ...profile.equipped } };
}

/** Paint equipped back / mat / theme / avatar onto the live DOM. */
export function applyEquippedToDom(profile) {
  if (typeof document === "undefined") return;
  ensureCosmetics(profile);
  const eq = profile.equipped || DEFAULT_EQUIPPED;
  const root = document.documentElement;
  root.dataset.cardBack = eq.back || DEFAULT_EQUIPPED.back;
  root.dataset.playmat = eq.mat || DEFAULT_EQUIPPED.mat;
  root.dataset.theme = eq.theme || DEFAULT_EQUIPPED.theme;
  root.dataset.avatar = eq.avatar || DEFAULT_EQUIPPED.avatar;
  const custom = loadCustomMatUrl();
  if (eq.mat === "mat_custom" && custom) {
    root.style.setProperty("--custom-mat", `url("${custom}")`);
  } else {
    root.style.removeProperty("--custom-mat");
  }
  const av = document.getElementById("avatar-0");
  if (av) {
    const item = CATALOG_BY_ID[eq.avatar];
    if (item) {
      av.textContent = item.icon || "YOU";
      av.title = item.name;
    }
  }
}

const CUSTOM_MAT_KEY = "chaind-blitz-custom-mat-v1";

export function loadCustomMatUrl() {
  if (typeof localStorage === "undefined") return "";
  try {
    return localStorage.getItem(CUSTOM_MAT_KEY) || "";
  } catch {
    return "";
  }
}

export function saveCustomMatUrl(dataUrl) {
  if (typeof localStorage === "undefined") return { ok: false, reason: "No storage" };
  try {
    if (!dataUrl) localStorage.removeItem(CUSTOM_MAT_KEY);
    else localStorage.setItem(CUSTOM_MAT_KEY, dataUrl);
    return { ok: true };
  } catch {
    return { ok: false, reason: "Image too large for this browser" };
  }
}

/** Resize a local image and store it for mat_custom. Never uploaded. */
export function readLocalMatFile(file) {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined" || !file) {
      reject(new Error("No file"));
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 1280;
      let w = img.width;
      let h = img.height;
      if (w > max || h > max) {
        const s = max / Math.max(w, h);
        w = Math.round(w * s);
        h = Math.round(h * s);
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      const data = canvas.toDataURL("image/jpeg", 0.72);
      const saved = saveCustomMatUrl(data);
      if (!saved.ok) {
        reject(new Error(saved.reason));
        return;
      }
      resolve(data);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}

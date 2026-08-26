// UI chrome i18n. Card-text locale packs can layer on later; EN is the fallback.

const EN = {
  "app.title": "Chaind Blitz",
  "hub.play": "Play",
  "hub.deck": "Deck",
  "hub.collection": "Collection",
  "hub.shop": "Shop",
  "hub.ranked": "Ranked",
  "hub.rogue": "Run",
  "hub.modes": "Modes",
  "hub.rulebook": "Rulebook",
  "hub.settings": "Settings",
  "city.packShop": "Pack Shop",
  "city.boutique": "Boutique",
  "city.soloGates": "Solo Gates",
  "city.coliseum": "Coliseum",
  "city.plaza": "Plaza",
  "city.battleCity": "Battle City",
  "cosmetic.backs": "Card backs",
  "cosmetic.mats": "Playmats",
  "cosmetic.avatars": "Avatars",
  "cosmetic.themes": "Themes",
  "cosmetic.emotes": "Emotes",
  "cosmetic.buy": "Buy",
  "cosmetic.equip": "Equip",
  "cosmetic.owned": "Owned",
  "gates.title": "Solo Gates",
  "gates.clear": "Clear",
  "gates.locked": "Locked",
  "pass.title": "Duel Pass",
  "pass.claim": "Claim",
  "pass.season": "Season",
  "login.claim": "Claim daily reward",
  "login.streak": "Streak",
  "login.claimed": "Claimed today",
  "missions.dailies": "Dailies",
  "missions.achievements": "Achievements",
  "missions.claim": "Claim",
  "missions.roll": "Refresh dailies",
  "format.advanced": "Advanced",
  "format.unlimited": "Unlimited",
  "settings.uiScale": "UI scale",
  "settings.chainMode": "Chain mode",
  "settings.board3d": "3D board overlay (2D stays clickable)",
  "settings.colorblind": "Colorblind tribe patterns",
  "settings.locale": "Language",
  "settings.music": "Music",
  "settings.sfx": "SFX",
  "settings.mute": "Mute",
  "settings.unmute": "Unmute",
  "settings.fxSpeed": "Duel FX speed",
  "settings.fxSpeedHint": "Skip animations only — never skips rules.",
  "settings.reducedMotion": "Reduced motion",
  "settings.hidePlaza": "Hide plaza",
  "chain.smart": "Smart",
  "chain.auto": "Auto",
  "chain.confirm": "Confirm",
  "chain.off": "Off",
  "duel.victory": "Victory",
  "duel.defeat": "Defeat",
  "duel.pause": "Pause",
  "duel.skip": "Skip",
  "common.ok": "OK",
  "common.cancel": "Cancel",
  "common.close": "Close",
  "common.save": "Save",
  "common.load": "Load"
};

const DICTS = { en: EN };

let locale = "en";

export function setLocale(code) {
  locale = DICTS[code] ? code : "en";
  return locale;
}

export function getLocale() {
  return locale;
}

export function t(key) {
  const dict = DICTS[locale] || EN;
  return dict[key] ?? EN[key] ?? key;
}

export { EN };

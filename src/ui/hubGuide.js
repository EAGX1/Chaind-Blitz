// One-line labels so hub tabs explain themselves without a rulebook.

export const HUB_TAB_GUIDE = {
  play: "PLAY — gold button starts a duel. Pick a loaner on VS CPU, or Rank / Run / More for other modes.",
  deck: "DECK — click a card on the left to add it, click the list to remove. The circuit meter shows live combos.",
  collection: "CARDS — search, tribe, and circuit filters. Craft spends dust; owned-only is on by default.",
  shop: "SHOP — packs from your ranked pool. 100 gems for 10 cards.",
  ranked: "RANK — ladder vs CPU. Your own 40-card list, not a loaner.",
  rogue: "RUN — a 20-card gauntlet. HP carries between nodes.",
  modes: "MORE — draft, sealed, brawl, hotseat. Ranked PvP is not in this build.",
  rulebook: "RULES — combat, chains, combos, and how DEF works as HP."
};

export function hubGuideLine(tab) {
  return HUB_TAB_GUIDE[tab] || HUB_TAB_GUIDE.play;
}

export function applyHubTabGuide(tab) {
  const el = document.getElementById("hub-guide");
  if (!el) return;
  el.textContent = hubGuideLine(tab);
}

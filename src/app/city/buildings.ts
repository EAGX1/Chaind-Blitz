/** Plaza building / kiosk definitions — stable POI ids. */
export const BUILDINGS = [
  {
    id: "pack_shop",
    label: "Pack Shop",
    short: "PACKS",
    position: [-8, 0, -4] as [number, number, number],
    color: "#c9a227",
    desc: "Open packs · pity · gems",
  },
  {
    id: "boutique",
    label: "Boutique",
    short: "STYLE",
    position: [8, 0, -4] as [number, number, number],
    color: "#7ec8e3",
    desc: "Cosmetics · emotes · playmats",
  },
  {
    id: "solo_gates",
    label: "Solo Gates",
    short: "GATES",
    position: [-8, 0, 8] as [number, number, number],
    color: "#6bcb77",
    desc: "Hour-1 quests · tutorials",
  },
  {
    id: "coliseum",
    label: "Coliseum",
    short: "RANK",
    position: [8, 0, 8] as [number, number, number],
    color: "#e85d4c",
    desc: "Ranked · Pass · calendar · dailies",
  },
] as const;

export const KIOSKS = [
  { id: "vault", label: "Vault", tab: "deck", position: [0, 0, -10] as [number, number, number], desc: "Build a deck" },
  { id: "collection", label: "Collection", tab: "collection", position: [-4, 0, -10] as [number, number, number], desc: "Browse cards" },
  { id: "tavern", label: "Tavern", tab: "rogue", position: [4, 0, 12] as [number, number, number], desc: "Roguelike run" },
  { id: "arena", label: "Arena", tab: "modes", position: [-4, 0, 12] as [number, number, number], desc: "Extra modes" },
  { id: "library", label: "Library", tab: "rulebook", position: [4, 0, -10] as [number, number, number], desc: "How to play" },
  { id: "today", label: "Today", tab: "puzzle", position: [0, 0, 6.4] as [number, number, number], desc: "Puzzle of the day" },
] as const;

export type BuildingId = (typeof BUILDINGS)[number]["id"];
export type KioskId = (typeof KIOSKS)[number]["id"];

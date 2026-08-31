/** Street building / kiosk definitions — stable POI ids. Lined along a north–south road. */

export const STREET_WALK = { x: 10.6, z: 30 } as const;

export function streetYaw(x: number, z = 0) {
  if (Math.abs(x) < 3.2) return z > 0 ? Math.PI : 0;
  return x < 0 ? Math.PI / 2 : -Math.PI / 2;
}

export const BUILDINGS = [
  {
    id: "pack_shop",
    label: "Pack Shop",
    short: "PACKS",
    position: [-9.6, 0, -8] as [number, number, number],
    color: "#c9a227",
    desc: "Open packs · pity · gems",
  },
  {
    id: "boutique",
    label: "Boutique",
    short: "STYLE",
    position: [9.6, 0, -8] as [number, number, number],
    color: "#7ec8e3",
    desc: "Cosmetics · emotes · playmats",
  },
  {
    id: "solo_gates",
    label: "Solo Gates",
    short: "GATES",
    position: [-9.6, 0, 10] as [number, number, number],
    color: "#6bcb77",
    desc: "Hour-1 quests · tutorials",
  },
  {
    id: "coliseum",
    label: "Coliseum",
    short: "RANK",
    position: [9.6, 0, 10] as [number, number, number],
    color: "#e85d4c",
    desc: "Ranked · Pass · calendar · dailies",
  },
] as const;

export const KIOSKS = [
  { id: "vault", label: "Vault", tab: "deck", position: [-5.55, 0, -18] as [number, number, number], desc: "Build a deck", color: "#c9a227" },
  { id: "collection", label: "Collection", tab: "collection", position: [-5.55, 0, -2] as [number, number, number], desc: "Browse cards", color: "#3aa0c8" },
  { id: "library", label: "Library", tab: "rulebook", position: [5.55, 0, -18] as [number, number, number], desc: "How to play", color: "#4a6a9a" },
  { id: "today", label: "Today", tab: "puzzle", position: [5.55, 0, -2] as [number, number, number], desc: "Puzzle of the day", color: "#c9a227" },
  { id: "tavern", label: "Tavern", tab: "rogue", position: [-5.55, 0, 18] as [number, number, number], desc: "Roguelike run", color: "#d4783a" },
  { id: "arena", label: "Arena", tab: "modes", position: [5.55, 0, 18] as [number, number, number], desc: "Extra modes", color: "#c45a3a" },
] as const;

export type BuildingId = (typeof BUILDINGS)[number]["id"];
export type KioskId = (typeof KIOSKS)[number]["id"];

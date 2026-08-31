# Chaind Blitz

A browser TCG that fuses Yu-Gi-Oh chains, Shadowverse evolution, Marvel Snap field lanes, and a Slay-the-Spire roguelike loop.

**Play on a phone or PC:** [https://eagx1.github.io/Chaind-Blitz/](https://eagx1.github.io/Chaind-Blitz/)

## Scripts

- npm run dev: Vite dev server
- npm run test: Vitest (engine + meta)
- npm run e2e: Playwright browser duels
- npm run build: production bundle to dist/
- npm run backend: optional local WS backend

## Ranked card pool

Bronze learns on 60 cards. Each tier-up unions new sets into the pack/legal pool (src/meta/pools.js).

| Tier | Unlocks | Pool size |
|------|---------|-----------|
| Bronze | Bronze set | 60 |
| Silver | Wave C + Silver | 105 |
| Gold | Wave D + Gold | 127 |
| Platinum | Wave E + Extra + Platinum | 165 |
| Diamond | Wave F | 241 |
| Master | Wave G (full unique catalog) | 290 |

Master lpToPromo is Infinity. Packs drop only from the unlocked pool.

## src/ layout

- src/ai/ — CPU autopilot and intent
- src/app/ — React plaza (city, chrome, 3D duel board)
- src/data/ — cards, field lanes, starters, loaners
- src/engine/ — pure rules engine (no DOM)
- src/meta/ — ranked, packs, profile, solo gates, rogue
- src/ui/ — classic hub and duel view

# UI design tokens

Shared chrome for hub, duel, city HUD, and modals. AAA polish pass owns visual refinements; tokens stay stable for CSS/React.

## Scale

| Token | Role | Notes |
|-------|------|-------|
| `--ui-scale` | Global UI multiplier | From settings `uiScale` (≈0.75–1.5); 1080p / 2K / 4K breakpoints clamp card size |
| `--cw` | Card width | Derived from scale + viewport |

## Color (CSS variables — target)

| Token | Use |
|-------|-----|
| `--cb-bg` | App / arena ground |
| `--cb-surface` | Panels, modals |
| `--cb-text` | Primary text |
| `--cb-muted` | Dim / secondary |
| `--cb-accent` | CTAs, phase orb |
| `--cb-danger` | Concede, damage |
| `--cb-tribe-ignis` / `abyss` / `terra` / `neutral` | Card chrome |

Avoid purple-default AI chrome; keep brand Orbitron/Rajdhani stack.

## Motion / a11y

| Setting | Behavior |
|---------|----------|
| `reducedMotion` | No juice cinema, flat backdrop, 2D duel if `board3d` |
| `music` / `sfx` | 0–1 buses |
| Focus | Visible outline on buttons / zones |

## Duel chrome

- MD-style inspector, chain popup, attack arrows (`attackArrows.js`).
- Chain modes (`settingsStore.js`):
  - `off` / `auto` — never prompt; you will not chain.
  - `smart` — skip empty and low-threat windows; still ask on damage calc, opponent chain links, counters, and hand traps.
  - `confirm` — always ask when you have a legal response.
- Pause menu peeks rulebook / settings without conceding.

## City HUD

Minimal: brand, wallet, Esc/Leave, building prompt. No dashboard clutter in first plaza viewport.

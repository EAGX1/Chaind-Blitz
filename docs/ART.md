# Art quality bar

Gate for shipping card and city art. Procedural faces are OK for bronze/N and R.
UR cards ship **unique authored SVG portraits** in `src/ui/cardArt.js` (`curatedPortrait`).
SR cards use a richer procedural pass (extra sparkles + inner frame), not the N four-variant pack.

## Rarity bar

| Tier | Allowed |
|------|---------|
| **N** | Procedural SVG (`cardArt.js`) OK |
| **R** | Procedural acceptable |
| **SR** | Rich procedural (foil frame + extra marks). Unique portrait optional. |
| **UR** | Unique SVG portrait per id in `curatedPortrait` — no generic shard/orb/wave/ray reuse |
| **Plaza / buildings** | Procedural Three.js plaza (floor language, lamps, skyline). GLTF/HDRI still optional, not required to ship |

## City / photoreal

- Optional later assets under `public/city/` (GLTF, HDRI, PBR maps).
- Live plaza is procedural: cobble disc, road grid, lamps, night sky, skyline windows.
- **LOD / reduced-motion** — teleporter mode skips the walk canvas load when `reducedMotion` is on.

## Process

1. New UR card → add a `curatedPortrait` entry before UI lists it.
2. New SR card → default rich procedural is enough; unique portrait welcome.
3. Live-ops may replace N/R procedural with hand art without rule changes.

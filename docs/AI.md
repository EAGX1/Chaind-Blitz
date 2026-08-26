# CHAIND BLITZ — AI

The opponent uses **board heuristics** (lethal face, Ward-forced attacks, profitable
trades, lane-aware zones). It is **fun-strong, not perfect**, and is never marketed
as unbeatable or as a search engine.

Live picks always come from `makeAutopilot`. The Worker is a **hint** helper only.
Difficulty changes **both** think-time and pick policy:

| Tier | Pause | Picks |
|------|-------|-------|
| Easy | ~120ms | Skips 2-wide board wipes; depth 1 (rarely fuses) |
| Normal | ~300ms | Default: lethal face, Ward, profitable trades |
| Hard | ~800ms | Depth 3 habits: hold counters, fuse when ahead — still not search |

## Guarantees

- Always returns a **legal** action from `makeAutopilot`.
- Never counters its own chain link.
- Direct-attacks for lethal when ATK ≥ enemy LP (Easy still goes face on an empty board).
- Attacks Ward monsters when Ward is present (cannot snipe past).
- Soak tests run Easy and Hard.

Settings UI persists `aiTier` in `localStorage` (`chaind-blitz-settings-v1`).

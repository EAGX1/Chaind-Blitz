# Battle City — POIs

Walkable 3D plaza is the default home. Buildings open 2D overlay panels; kiosks jump to classic hub tabs.

## Buildings (enterable)

| Id | Label | Systems |
|----|-------|---------|
| `pack_shop` | Pack Shop | Packs, pity, gems, pack-open cinema |
| `boutique` | Boutique | Cosmetics, emotes, playmats, themes |
| `solo_gates` | Solo Gates | Hour-1 quests, tutorials, checklist |
| `coliseum` | Coliseum | Ranked, Duel Pass, calendar, dailies |

Stable ids live in `src/app/city/buildings.ts` (`BUILDINGS`).

## Kiosks (plaza shortcuts)

| Id | Label | Hub tab |
|----|-------|---------|
| `vault` | Vault | deck |
| `collection` | Collection | collection |
| `tavern` | Tavern | rogue |
| `arena` | Arena | modes |
| `library` | Library | rulebook |

## Settings

- **Classic Hub** (`classicHub`) — tabbed hub for one release / a11y.
- **Hide Plaza** (`hidePlaza`) — skip city, land on classic hub.
- Reduced motion → teleporter / 2D list instead of free walk.

## Offline / MMO

Offline: NPC greeters only. Online (optional backend): presence avatars and
move sync. Chat UI and duel invites are not shipped. WebRTC PvP is a labeled
stub. Airplane mode must still open city + Quick Duel.

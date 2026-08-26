# City + Classic Hub — UX eval (current)

**Verdict:** Classic Hub is a working MD-adjacent shell (gold PLAY, wallet, mode grid). The plaza is no longer a blank graybox: cobble disc, lamps, labeled POIs, a navy/gold duelist pawn, local greeters, and room-skinned interiors are in. Neither screen is blocked for play.

## Shipped

- **Readable POIs.** Kiosk labels and interact prompts name Pack Shop, Coliseum, and the rest at a glance.
- **Ground + lighting.** Cobble plaza disc, extra street lamps, brighter night lighting, skyline ring. Procedural only — no GLTF/HDRI.
- **Pawn language.** Local avatar is a navy/gold duelist box (not a yellow capsule). Remote peers use the same box language.
- **Hub CTA.** Gold PLAY tab and featured CPU / Quick Duel as the primary press targets. Classic Hub can be forced via `hidePlaza`.
- **Quiet checklist.** Incomplete-only, corner dossier — not a debug overlay of every flag.
- **HUD chrome.** Sacred bar (brand + wallet) stays top-left. Reserved top-right utility slot holds Classic Hub, settings/gear, and glossary so they never sit on the wallet. `pointer-events: none` on the HUD except actual buttons.
- **Plaza greeters.** Four static local NPCs with unique silhouettes/tints near Pack Shop, Boutique, Solo Gates, and Coliseum. Offline meshes only — plazaNet / online presence is not enabled.
- **Building interiors.** Pack Shop + Coliseum (and Boutique / Solo Gates) reuse the same BuildingPanel content, skinned as rooms: inner frame, floor/ceiling depth, metal hub buttons.

## Leftover

1. **Online plaza identity** is still off by design. Greeters are local stand-ins; unique remote-peer silhouettes wait on plaza net (not this pass).
2. **Interiors** are 2D room skins, not walkable 3D MD rooms.
3. **Host/Join** stays a solo stub (`coming soon`) — no room-code sockets.

## Do not treat as ship gates

WebRTC plaza, extra locales, GLTF city, extra game modes, PP/mana.

## Next visual pass (optional)

1. Walkable 3D interiors if we ever leave the BuildingPanel overlay.
2. Distinct remote-peer tints if plaza net is ever turned on.

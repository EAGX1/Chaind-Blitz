# City + Classic Hub — UX eval (current)

**Verdict:** Classic Hub is a working MD-adjacent shell (gold PLAY, wallet, mode grid). The plaza is no longer a blank graybox: cobble disc, lamps, labeled POIs, and a navy/gold duelist pawn are in. HUD chrome and remote-peer identity are the leftover visual debt. Neither screen is blocked for play.

## Shipped

- **Readable POIs.** Kiosk labels and interact prompts name Pack Shop, Coliseum, and the rest at a glance.
- **Ground + lighting.** Cobble plaza disc, extra street lamps, brighter night lighting, skyline ring. Procedural only — no GLTF/HDRI.
- **Pawn language.** Local avatar is a navy/gold duelist box (not a yellow capsule). Remote peers use the same box language.
- **Hub CTA.** Gold PLAY tab and featured CPU / Quick Duel as the primary press targets. Classic Hub can be forced via `hidePlaza`.
- **Quiet checklist.** Incomplete-only, corner dossier — not a debug overlay of every flag.

## Leftover

1. **HUD chrome** still fights the 3D a bit (gear / hint / Classic Hub vs wallet). Sacred bar vs utility slot is not fully resolved.
2. **Peer avatars** are shared duelist boxes, not unique silhouettes. Fine offline; online plaza still reads as placeholders.
3. **Building interiors** (pack cinema, ranked queue skin) are functional screens, not full MD rooms.

## Do not treat as ship gates

WebRTC plaza, extra locales, GLTF city, extra game modes, PP/mana.

## Next visual pass (optional)

1. One reserved chrome slot so settings never sit on the wallet.
2. Distinct peer tints (still boxes) if plaza net is on.
3. Pack-open / Coliseum interiors that reuse hub metal buttons.

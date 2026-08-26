# CHAIND BLITZ — Game Design Document (lite)

## Vision
A browser-native TCG that plays like Yu-Gi-Oh's timing rules, Shadowverse's evolution
tempo, and Marvel Snap's mutating battlefields had a child — wrapped in a
Slay-the-Spire roguelike meta-loop. Offline-first, saves locally. Built with Vite.

## Pillars
1. **Rules integrity** — chains, spell speeds, SEGOC, priority and missing-the-timing
   are enforced by the engine, not by convention. The log explains every ruling.
2. **Tempo with intent** — Evolution Points create Shadowverse-style turns
   where one evolve swing changes the board.
3. **A field that fights back** — three Field Lanes flip on turns 1/3/5 and rewrite
   what two zones mean.
4. **Earned depth** — ranked tiers gate the card pool so new duelists learn on 60
   cards, not 600.

## Ruleset (the fused system)

### Resources
- **Normal Summon:** 1 per turn (Yu-Gi-Oh layer). Level 4 and below: free.
  Level 5–6: 1 tribute. Level 7+: 2 tributes. Special Summons via effects are
  unlimited. Spells activate or Set without spending a resource.
- **Evolution Points (EP):** the player going first receives 2 EP, the player going
  second receives 3 EP. Evolving unlocks on your 3rd own turn. Evolve spends 1 EP
  as a game action: the monster gains **+2/+2** and **Rush** (may attack the turn
  it evolved, overriding summoning sickness), then its **Evolve effect** starts a
  Speed 1 chain (Ash Whisper can answer). Once per turn, one monster may be evolved per EP spent.
- **Summoning sickness:** monsters cannot attack the turn they are summoned unless
  they have Rush.
- **First turn:** the player who goes first skips their opening draw, cannot attack
  (even with Rush), and skips Battle Phase **and** Main Phase 2. The second player
  may attack on their first turn if the monster is not sick.

### Card frame — Monsters + Spells only
| Spell subtype | Speed | Rules |
|---|---|---|
| Normal | SS1 | Activate only in your own M1/M2, only as CL1 |
| Continuous | SS1 | Activation is SS1; remains face-up with an ongoing effect |
| Quick-Play | SS2 | From hand only on YOUR turn; may be Set, then usable on either turn but NOT the turn it was Set |
| Counter | SS3 | Must be Set first (locked the turn Set); only SS3 can respond to SS3 |

Monster effects: Fanfare-style triggers, Continuous, Ignition-style (SS1, main
phase), Quick (SS2). Trigger effects follow YGO trigger rules ("if" vs optional
"when... you can").

### Timing core (engine-enforced)
- Chain Links stack with CL numbers; resolution is backwards (highest CL first);
  nothing can be added while a chain is resolving; activated non-continuous spells
  hit the GY simultaneously with the last resolution.
- Fast-effect windows open after every event, phase change and summon. Priority
  passes TP → NTP on every window. Post-2012: **no Ignition Effect priority** — a
  monster's once-per-turn main-phase effect cannot be fired in the summon response
  window before the opponent's fast effects.
- SEGOC: simultaneous triggers enter the chain in the order
  TP-mandatory → NTP-mandatory → TP-optional → NTP-optional; each player orders
  their own bucket.
- Missing the timing: optional "when X: you can" effects are lost if X was not the
  last thing to happen (dying at CL2+, being discarded as cost, being tributed).
  "If" triggers and mandatory triggers never miss; they queue for the next chain.
  The duel log narrates each whiff in plain language.
- Turn structure: DP → SP → M1 → BP (Start Step, Battle Step, Damage Step, End Step)
  → M2 → EP. On the going-first player's first turn, BP and M2 are skipped.
- LP 20 (Shadowverse-scale stats: costs 1-10, ATK/DEF roughly 1-12). Combat is
  Shadowverse-style: attacker and defender each deal damage equal to their ATK;
  damage persists on monsters; a monster whose damage >= its DEF is destroyed.
  During the Damage Step five windows open in order: Start, Before damage
  calculation, During damage calculation (only cards like Surge Imp that say so),
  After damage calculation, End of the Damage Step. Counters (SS3) may answer in
  any window; Speed 2 Quicks cannot unless they are flagged for the Damage Step.
  Opening hand 5; the player going first skips their first Draw Phase draw.
  Hand limit 6 at EP (discard down).

### Field Lanes (Marvel Snap layer)
Three lanes sit between the boards. Each duel, three fields are drawn randomly
from the field pool:
- Lane 1 reveals at duel start — affects monster zones 1-2 (both players).
- Lane 2 reveals at the start of Turn 3 — affects monster zones 3-4.
- Lane 3 reveals at the start of Turn 5 — affects monster zones 5-6 AND spell zones 5-6.
Effects include ATK/DEF modifiers, summon bonuses, zone locks and more.

### Board
6 monster zones + 6 spell zones per player. Deck 40 cards, max 3 copies.
GY and Banish are public, inspectable zones.

## Modes
PvE gates, AI vs AI (spectate + autopilot), Roguelike run (STS node map, 20-card
run deck, pick-1-of-3 rewards, relics, boss), Ranked (LoL tiers + LP + promo series of separately queued duels),
Draft, Cube Draft, Sealed (6 packs → 30), Highlander (singleton), Tavern Brawl
(rotating modifiers), Tournament (8-man bracket vs AI).

## Progression
- Tiers: Bronze → Silver → Gold → Platinum → Diamond → Master. 100 LP per tier,
  Bo3 promo series between tiers.
- Pool gating: Bronze **60**, Silver **105** (Wave C + Silver), Gold **127**
  (Wave D + Gold), Platinum **165** (Wave E + Extra + Platinum), Diamond **241**
  (Wave F), Master **290** (Wave G — full unique catalog). Diamond adds Wave F;
  Master adds Wave G. Packs only drop from your unlocked pool.
- Crafting (Master Duel model): rarities N/R/SR/UR. Dismantle = 10 CP of that
  rarity; craft = 30 CP. Three dusted cards of a rarity craft any card of it.
- Economy: packs from wins/ranked/roguelike milestones; gems + coins currencies.

## Content
Bronze pool: 60 cards across three tribes — **Ignis** (fire, aggression),
**Abyss** (water, control/disruption), **Terra** (nature, midrange/value) — plus
Neutral staples engineered to demo every rule (a "when destroyed: you can" card
that can miss timing, mandatory triggers, SEGOC piles, counter wars, evolve payoffs).

## Tech
Vite + TypeScript/React plaza, vanilla ES-module engine. Pure engine (no DOM)
tested with Vitest + seeded RNG; Playwright drives full browser duels.
`npm run dev` serves the live game; `npm run build` writes `dist/`.
Saves in localStorage (versioned). N/R faces are procedural SVG; UR cards have
unique portraits in `cardArt.js`. SFX is procedural WebAudio.

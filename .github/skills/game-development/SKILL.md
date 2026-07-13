---
name: game-development
description: Develop 2D&D features with Phaser 4, strict TypeScript, and D&D-inspired mechanics
license: MIT
---

# 2D&D Game Development

Use this skill for cross-cutting game features, new content, combat behavior,
and changes spanning scenes, systems, data, renderers, or managers.

## Core rules

1. Use strict TypeScript with explicit parameter and return types.
2. Keep content data-driven in `src/data/`; keep reusable logic in
   `src/systems/`.
3. Generate graphics in `src/renderers/textures.ts` and synthesize audio in
   `src/systems/audio.ts`; do not add external assets.
4. Preserve shared scene state across transitions.
5. Use `debugLog()` and debug-panel APIs instead of `console.log`.
6. Add deterministic Vitest coverage for game logic.

## Current architecture

- Phaser 4 scenes: `Boot`, `Overworld`, `Battle`, `Shop`, and `Codex`
- Overworld orchestration: `src/scenes/Overworld.ts`
- Battle orchestration: `src/scenes/Battle.ts`
- Core mechanics: `src/systems/`
- Immutable definitions: `src/data/`
- Extracted presentation: `src/renderers/`
- Stateful scene helpers: `src/managers/`

The map hub is `src/data/map.ts`; terrain/types, chunks, cities, and dungeons
are split into dedicated modules.

Non-combat checks are split across:

- `src/data/skillChecks.ts`: NPC challenges, negotiation choices, and terrain
  event definitions
- `src/systems/skillChecks.ts`: pure d20 resolution, normalization, and helpers
- `src/managers/skillChecks.ts`: Overworld rewards, hazards, chest checks, and
  dialogue orchestration

## Adding monsters

1. Define the monster in the appropriate pool in `src/data/monsters.ts`.
2. Use a camelCase ID and set stats, rewards, drops, abilities, and `isBoss`.
3. Add an `elementalProfile` when the monster has resistances, weaknesses, or
   immunities.
4. Add `element` and `statusEffect` to monster abilities when applicable.
5. Ensure the definition is included in `ALL_MONSTERS`; debug spawning, Codex
   browsing, and ID lookup depend on the master list.
6. Add encounter-pool, boss-map, and data-integrity tests.

Use `getMonster(id)` for exact ID lookup and `findMonster(query)` for
case-insensitive ID/name lookup with partial matching.

## Adding spells, abilities, and equipment

- Damage sources may declare an `Element` from `src/data/elements.ts`.
- Player abilities may apply `selfEffect` or `targetEffect` IDs defined by
  `src/systems/statusEffects.ts`.
- Monster abilities use `statusEffect` for effects applied to the player.
- Cure consumables declare matching cure data and must be wired through
  `useItem()` without consuming the item when no matching ailment exists.
- Preserve action economy: normal actions end the player turn; bonus-action
  abilities and the first item use do not.

Combat calculation order is:

1. Roll and resolve the attack or save.
2. Apply active-status accuracy, disadvantage, AC, and damage modifiers.
3. Apply elemental immunity, weakness, or resistance to the modified damage.
4. Apply damage and status effects.
5. Report discoveries and combat feedback.

Magic Missile remains auto-hit and does not roll disadvantage.

## Status effects

All definitions and lifecycle helpers live in
`src/systems/statusEffects.ts`. Do not duplicate status logic in data files or
scenes.

- Start of actor turn: tick damage, saving throws, and skip-turn decision.
- End of actor turn: decrement durations and expire effects.
- Apply or refresh through `applyStatusEffect()`.
- Normalize loaded effects through `normalizeActiveEffects()`.
- Clear player and monster effects when leaving Battle; durations are measured
  in combat turns, not overworld steps.

## Elements

Supported elements are Fire, Ice, Lightning, Poison, Necrotic, Radiant,
Thunder, Force, and Psychic.

- Immunity: zero damage
- Weakness: double damage
- Resistance: floor of half damage
- Neutral: unchanged

Record observed non-neutral interactions with `discoverElement()` so the Codex
can persist and display them.

## World features

- Cities may contain connected districts. Always use city chunk helpers rather
  than indexing `city.chunks` directly.
- Dungeons may contain multiple levels. Always use dungeon level and
  connection helpers.
- Use `FogOfWar.exploredKey()` for exploration keys.
- Use `isWalkable()` and `ENCOUNTER_RATES`; do not hardcode terrain behavior.

## Non-combat skill checks

- Checks use d20 + Dexterity, Wisdom, or Charisma modifier against a DC.
- Natural 1 and 20 are not automatic outcomes for ability checks.
- Persist fixed NPC, shop, chest, and treasure results in
  `player.progression.skillChecks`.
- Use stable NPC identities and shop type/coordinate keys rather than array
  indexes.
- Shop negotiation is one attempt per shop; successful discounts restore from
  the saved result.
- Exploration hazard damage is nonlethal and must clamp the player to at least
  1 HP.
- Test roll math, invalid inputs, stable data references, save normalization,
  reward bounds, and nonlethal damage deterministically.

## Scene changes

State-bearing transitions commonly pass:

```typescript
{
  player,
  defeatedBosses,
  codex,
  timeStep,
  weatherState,
  savedSpecialNpcs,
}
```

Battle also receives a monster and biome; Shop receives town/shop context.
Keep target `init()` contracts and every caller synchronized.

## Validation

```bash
npm run typecheck
npm test
npm run build
```

For UI changes, run the Vite app and verify the relevant flow with headless
Chromium.

## Common pitfalls

- Do not mutate shared monster, item, map, city, or dungeon definitions.
- Do not use stale Phaser 3 APIs or default imports; current code uses
  `import * as Phaser from "phaser"`.
- Do not create a second status or elemental calculation path.
- Do not omit unique dungeon pools or bosses from aggregate lookups.
- Do not use geometry masks for the Battle log; render the bounded visible
  message window.
- Do not add a persistent field without save normalization and tests.

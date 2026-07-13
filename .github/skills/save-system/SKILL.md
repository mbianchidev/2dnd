---
name: save-system
description: Manage 2D&D save schema v2, migration, normalization, and location recovery
license: MIT
---

# Save System

Game state is stored in `localStorage` by `src/systems/save.ts`. Audio
preferences are stored separately by `src/systems/audio.ts`.

## Storage keys

- `2dnd_save`: game state
- `2dnd_audio_prefs`: channel volumes and mute state

## Current schema

`SAVE_VERSION` is 2.

```typescript
interface SaveData {
  version: number;
  player: PlayerState;
  defeatedBosses: string[];
  codex: CodexData;
  appearanceId: string;
  timestamp: number;
  timeStep?: number;
  weatherState?: WeatherState;
}
```

`Set<string>` values are serialized as arrays and reconstructed by the scene
loading path.

## Player persistence

Important composed fields:

```typescript
interface PlayerPosition {
  x: number;
  y: number;
  chunkX: number;
  chunkY: number;
  inDungeon: boolean;
  dungeonId: string;
  dungeonLevel: number;
  inCity: boolean;
  cityId: string;
  cityChunkIndex: number;
}

interface PlayerProgression {
  openedChests: string[];
  collectedTreasures: string[];
  exploredTiles: Record<string, boolean>;
  discoveredCities: string[];
}
```

`PlayerState.activeEffects` persists normalized `ActiveStatusEffect` values.
Codex entries persist `discoveredElements`.

## Loading and migration

Treat parsed JSON as `unknown`. Use typed record guards and normalization
helpers; do not cast unvalidated nested values directly.

`loadGame()` currently handles:

- Legacy `bestiary` to `codex`
- Legacy flat player position fields to `player.position`
- Legacy flat progression fields to `player.progression`
- Missing equipment, talents, abilities, rests, bank, mount, and appearance
  fields
- Missing/invalid active status effects
- Missing/invalid Codex elemental discoveries
- Missing time and weather data
- Invalid string arrays and explored-tile records

## Location recovery

After migration, normalize location state:

1. Dungeon and city flags are mutually exclusive.
2. Unknown dungeon/city IDs are cleared.
3. Dungeon levels and city district indexes are clamped.
4. Coordinates must be in bounds and walkable on the resolved level/chunk.
5. Invalid interior coordinates move to that level/district spawn.
6. Invalid overworld chunks/tiles fall back to the Willowdale start at chunk
   `(4, 2)`, tile `(3, 3)`.

Always resolve maps through `getDungeonLevelMap()` and `getCityChunk()` during
validation.

## Adding or changing persistent data

1. Update the TypeScript interface.
2. Set the creation default.
3. Normalize the loaded value from `unknown`.
4. Validate cross-field invariants.
5. Increment `SAVE_VERSION` for a schema change.
6. Add tests for valid persistence, missing values, malformed values, and
   corrupt-location recovery.
7. Update README and repository instructions when the stored shape changes.

Do not silently retain malformed data. Use a safe default or reject the save
when the top-level payload is unusable.

## Status and element rules

- Normalize status IDs, integer durations, and sources with
  `normalizeActiveEffects()`.
- Filter Codex element values with `isElement()`.
- Unknown values are discarded rather than asserted into the target type.

## API

```typescript
saveGame(player, defeatedBosses, codex, appearanceId, timeStep, weatherState);
const save = loadGame();
hasSave();
deleteSave();
getSaveSummary();
```

Save failures are reported with `debugLog()`. Loading returns `null` when the
top-level save is absent or corrupt.

## Tests

`tests/save.test.ts` covers:

- Save/load round trips
- Legacy flat-state migration
- Schema-v2 position and progression data
- Dungeon-level and city-district clamping
- Invalid IDs and coordinates
- Conflicting location flags
- Status-effect persistence and normalization
- Codex elemental-discovery normalization

## Common pitfalls

- Parsing directly into `SaveData` without runtime validation
- Forgetting the level or district when validating coordinates
- Reusing city/dungeon fog keys across interiors
- Keeping unknown status or element strings
- Storing Phaser objects or other non-serializable state
- Mutating shared game-data definitions while repairing a save

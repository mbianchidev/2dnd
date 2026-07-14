---
name: save-system
description: Manage 2D&D save schema v6, migration, normalization, and location recovery
license: MIT
---

# Save System

Game state is stored in `localStorage` by `src/systems/save.ts`. Audio
preferences are stored separately by `src/systems/audio.ts`.

## Storage keys

- `2dnd_save`: game state
- `2dnd_audio_prefs`: channel volumes and mute state

## Current schema

`SAVE_VERSION` is 6.

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
  quests: QuestLogState;
  skillChecks: Record<string, SkillCheckRecord>;
  trapSeed: number;
  trapStates: Record<string, TrapState>;
  trapGuidance: boolean;
}

interface QuestProgress {
  status: "locked" | "active" | "completed";
  stage: number;
  objectives: Record<string, number>;
  claimedRewards: string[];
}

interface QuestLogState {
  quests: Record<QuestId, QuestProgress>;
  seenWarnings: string[];
}
```

`PlayerState.activeEffects` persists normalized `ActiveStatusEffect` values.
Codex entries persist `discoveredElements`. `PlayerState.party` persists unique
companion states, active order, independent progression/inventories/equipment,
control modes, dialogue state, and gambits. Quest progress stores status, stage,
objective counters, claimed reward IDs, and acknowledged danger warnings.
Fixed non-combat checks persist the
ability, natural roll, modifier, repaired total, DC, outcome, and optional
choice ID.

## Loading and migration

Treat parsed JSON as `unknown`. Use typed record guards and normalization
helpers; do not cast unvalidated nested values directly.

`loadGame()` currently handles:

- Legacy `bestiary` to `codex`
- Legacy flat player position fields to `player.position`
- Legacy flat progression fields to `player.progression`
- Schema-v3 skill-check progression to default quest + skill-check state
- Flat Ashen Road/Warden's Dispatch and recruitment progress to nested
  Twelvefold Covenant state without replaying completed rewards
- Schema-v3/v4 progression to schema-v5 explicit trap state
- Missing equipment, talents, abilities, rests, bank, mount, and appearance
  fields
- Missing/invalid active status effects
- Missing/invalid party state and gambit rules
- Missing/invalid Codex elemental discoveries
- Missing, malformed, or unknown quest entries through `normalizeQuestLog()`
- Missing/invalid non-combat skill-check records
- Missing/invalid trap seed, state, and guidance fields
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

For party data, normalize after quests, skill checks, and trap fields. Then
replay completed `recruitCompanion` quest actions so v5 saves and debug-completed
quests converge idempotently.

Do not silently retain malformed data. Use a safe default or reject the save
when the top-level payload is unusable.

## Status and element rules

- Normalize status IDs, integer durations, and sources with
  `normalizeActiveEffects()`.
- Filter Codex element values with `isElement()`.
- Unknown values are discarded rather than asserted into the target type.

## Skill-check rules

- Normalize with `normalizeSkillCheckRecords()`.
- Accept only Dexterity, Intelligence, Wisdom, or Charisma records with integer
  d20 rolls, modifiers, and positive DCs.
- Recompute `total` and `success` from the saved natural roll, modifier, and DC.
- Trim optional choice IDs and discard malformed records.
- Shop, NPC, chest, and treasure IDs must remain stable across content changes.

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
- Schema-v6 position, objective/reward/warning quest state, skill checks,
  traps, and party state
- Flat schema-v4 quest migration and completed-reward preservation
- Schema-v3 skill-check saves gaining default normalized quest state
- Schema-v4 quest saves gaining default trap state
- Schema-v5 party defaults plus all-three completed recruitment replay after
  malformed duplicate/unknown party entries are normalized
- Quest reward and skill-check record normalization
- Trap seed/state/guidance normalization and seed-state cross-field repair
- Dungeon-level and city-district clamping
- Invalid IDs and coordinates
- Conflicting location flags
- Status-effect persistence and normalization
- Codex elemental-discovery normalization
- Missing and malformed skill-check normalization

## Common pitfalls

- Parsing directly into `SaveData` without runtime validation
- Forgetting the level or district when validating coordinates
- Reusing city/dungeon fog keys across interiors
- Keeping unknown status or element strings
- Resetting valid quest progress while filling missing quest defaults
- Retaining trap states after replacing a malformed trap seed
- Storing Phaser objects or other non-serializable state
- Mutating shared game-data definitions while repairing a save

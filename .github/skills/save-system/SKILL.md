---
name: save-system
description: Manage save/load persistence and backward compatibility in 2D&D
license: MIT
---

# Save System

Game state is persisted to `localStorage` via `src/systems/save.ts`.
Audio preferences are stored separately in `src/systems/audio.ts`.

## Save Data Structure

```typescript
interface SaveData {
  version: number;           // Schema version for migrations
  player: PlayerState;       // Full player state
  defeatedBosses: string[];  // Boss IDs (serialized from Set<string>)
  bestiary: BestiaryData;    // Monster discovery data
  appearanceId: string;      // Character class/appearance
  timestamp: number;         // Date.now() at save time
  timeStep?: number;         // Day/night cycle position (added v1)
  weatherState?: WeatherState; // Current weather (added v1)
}
```

## API

```typescript
import { saveGame, loadGame, hasSave, deleteSave, getSaveSummary } from "../systems/save";

// Save (called after every player step via autoSave)
saveGame(player, defeatedBosses, bestiary, player.appearanceId, timeStep, weatherState);

// Load (returns null if no save or corrupt)
const save = loadGame();
if (save) {
  // save.player, save.defeatedBosses, save.bestiary, etc.
}

// Utilities
hasSave();        // boolean — quick check
deleteSave();     // Clear save (new game)
getSaveSummary(); // "Hero Lv.5 | HP 45/45 | Gold 250 | 2/11 22:30"
```

## Backward Compatibility Pattern

When adding new fields to `PlayerState` or `SaveData`, you MUST add a fallback
in `loadGame()` so old saves don't break:

```typescript
// In loadGame(), after parsing:
if (data.player.newField === undefined) data.player.newField = defaultValue;
if (!data.newTopLevelField) data.newTopLevelField = createDefault();
```

### Current Backward-Compat Fields
These are all handled in `loadGame()`:
- `knownAbilities` → `[]`
- `knownTalents` → `[]`
- `chunkX/chunkY` → `1/1`
- `inDungeon/dungeonId` → `false/""`
- `inCity/cityId` → `false/""`
- `openedChests` → `[]`
- `collectedTreasures` → `[]`
- `exploredTiles` → `{}`
- `equippedShield` → `null`
- `timeStep` → `0`
- `weatherState` → `createWeatherState()`
- `lastTownX/Y/ChunkX/ChunkY` → Willowdale defaults

## Adding a New Persistent Field

1. Add the field to `PlayerState` in `src/systems/player.ts`
2. Set its default in `createPlayer()`
3. Add backward-compat fallback in `loadGame()` in `src/systems/save.ts`
4. Pass it through scene transitions if needed
5. Update `SaveData` interface if it's a top-level field

## Audio Preferences (Separate Storage)

Audio settings use their own `localStorage` key (`2dnd_audio_prefs`):

```typescript
interface AudioPrefs {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  dialogVolume: number;
  muted: boolean;
}
```

Loaded on `AudioEngine` construction, saved on every volume/mute setter call.

## Storage Keys
- `2dnd_save` — game save data
- `2dnd_audio_prefs` — audio volume preferences

## Common Pitfalls
- ❌ Never add a new PlayerState field without a backward-compat fallback in `loadGame()`
- ❌ Never assume optional fields exist on loaded data — always check with `??` or `if`
- ❌ Don't store Phaser objects in save data — only plain serializable values
- ❌ Don't forget to convert `Set<string>` to array for JSON serialization

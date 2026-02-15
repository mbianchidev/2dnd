# 2D&D Project - GitHub Copilot Instructions

KEEP THIS FILE AND SKILLS UPDATED IF ANYTHING CHANGES IN THE GAME DESIGN, CODE STYLE, OR PROJECT STRUCTURE. THIS FILE SERVES AS THE SINGLE SOURCE OF TRUTH FOR ALL CODING STANDARDS AND GAME MECHANICS. COPILOT RELIES ON THIS DOCUMENT TO PROVIDE ACCURATE AND CONSISTENT SUGGESTIONS THROUGHOUT THE CODEBASE.

If you create Python or other utilities scripts (e.g. sed) save them in a hacks folder in the root directory, and add a corresponding instruction file (e.g. `hacks/instructions.md`) describing the script's purpose, usage, and coding standards for that file.

Keep the README.md updated as well.

Do not care about backwards compatibility, we are in early development and can refactor as needed. However, if you do make breaking changes to function signatures or data structures, update the instructions accordingly so that Copilot suggestions remain accurate.

No file should be longer than 1000 lines. If a file exceeds this, consider refactoring into smaller modules and updating the instructions accordingly.

## Project Overview
2D&D is a browser-based JRPG that combines Dragon Quest-style gameplay with Dungeons & Dragons 5E mechanics. The game features turn-based combat, a D&D point-buy stat system, procedural audio, weather, day/night cycles, multi-chunk world exploration, cities, dungeons, and boss fights — all rendered with procedurally-generated graphics and synthesized audio.

## Tech Stack
- **Frontend Framework:** Phaser 3 (game engine)
- **Language:** TypeScript (strict mode enabled)
- **Build Tool:** Vite
- **Testing:** Vitest
- **Target Environment:** Modern browsers (ES2020)

## Project Structure
```
src/
├── main.ts              # Entry point & Phaser config
├── config.ts            # Game constants, debug system, HTML debug panel API
├── scenes/              # Phaser game scenes (file names drop "Scene" suffix)
│   ├── Boot.ts          # Asset generation, title screen, character creation
│   ├── Overworld.ts     # Multi-chunk map, movement, encounters — delegates to subsystems
│   ├── Battle.ts        # Turn-based combat with scrollable log, weather, day/night
│   ├── Shop.ts          # Item shops & inn
│   └── Codex.ts         # Monster encyclopedia (formerly Bestiary)
├── systems/             # Core game logic & mechanics
│   ├── combat.ts        # D&D combat mechanics (attack, spell, ability, flee)
│   ├── player.ts        # Player state, leveling, inventory, Point Buy system
│   ├── save.ts          # Save/load functionality (localStorage)
│   ├── classes.ts       # Class definitions (stats, spells, abilities, hit die, default visuals)
│   ├── appearance.ts    # Cosmetic customization (skin color, hair style, hair color options)
│   ├── codex.ts         # Monster tracking & AC discovery (formerly bestiary.ts)
│   ├── daynight.ts      # Day/night cycle (360-step: Dawn/Day/Dusk/Night)
│   ├── weather.ts       # Weather system (Clear/Rain/Snow/Sandstorm/Storm/Fog)
│   ├── audio.ts         # Procedural Web Audio API engine (biome/battle/boss/city music, SFX)
│   ├── debug.ts         # Shared debug hotkeys & slash commands
│   ├── debugCommands.ts # Overworld-specific debug hotkeys & slash commands
│   ├── dice.ts          # D&D dice rolling utilities (d20, 4d6-drop-lowest, ability modifiers)
│   └── movement.ts      # Grid movement logic & chunk transitions
├── renderers/           # Visual rendering subsystems (extracted from Overworld)
│   ├── map.ts           # Tile map rendering, weather particles, day/night tint
│   ├── city.ts          # City animals, NPCs, shop roofs, NPC textures
│   ├── player.ts        # Player sprite creation, equipment rendering
│   └── hud.ts           # HUD message display
├── managers/            # State management subsystems (extracted from Overworld)
│   ├── overlay.ts       # All UI overlays (equip, menu, settings, world map, inn, bank, teleport)
│   ├── specialNpc.ts    # Rare overworld NPCs (traveler, adventurer, merchant, hermit)
│   ├── npc.ts           # City NPC & animal adjacency detection helpers
│   ├── dialogue.ts      # NPC/animal/special dialogue display
│   ├── fogOfWar.ts      # Explored tile tracking & fog visibility
│   └── encounter.ts     # Random encounter enabled/disabled state
├── data/                # Game data definitions
│   ├── map.ts           # 10×9 chunk world, 20×15 tile chunks, terrain, cities, dungeons, chests
│   ├── monsters.ts      # Monster definitions, encounter tables, boss encounters
│   ├── spells.ts        # Spell definitions & level requirements
│   ├── items.ts         # Item definitions & shop inventory
│   ├── abilities.ts     # Martial ability definitions
│   ├── mounts.ts        # Mount definitions & speed data
│   ├── npcs.ts          # NPC templates, city NPC data, special NPC definitions
│   └── talents.ts       # Talent/perk definitions
tests/
├── audio.test.ts        # Audio system API surface & state tests
├── combat.test.ts       # Combat calculations & attack rolls
├── config.test.ts       # Debug system tests
├── data.test.ts         # Game data integrity tests
├── daynight.test.ts     # Day/night cycle tests
├── dice.test.ts         # Dice utility tests
├── mounts.test.ts       # Mount system tests
├── movement.test.ts     # Grid movement tests
├── npcs.test.ts         # NPC data tests
├── player.test.ts       # Player system, Point Buy, leveling tests
├── save.test.ts         # Save/load tests
└── weather.test.ts      # Weather system tests
```

## Coding Standards

### TypeScript
- **Always use strict TypeScript** - all type-safety features are enabled
- **Explicit types required** for function parameters and return values
- **Use interfaces** for data structures, not type aliases (unless union/intersection needed)
- **Import types explicitly** with `import type { ... }` when importing only types
- **Prefer const over let** when variables won't be reassigned
- **Use optional chaining** (`?.`) and nullish coalescing (`??`) where appropriate

### Naming Conventions
- **Files:** camelCase for systems/data, PascalCase for scenes (e.g., `Boot.ts`, `player.ts`)
- **Variables/Functions:** camelCase (e.g., `maxHp`, `rollDice`)
- **Types/Interfaces:** PascalCase (e.g., `PlayerState`, `MonsterData`)
- **Constants:** UPPER_SNAKE_CASE (e.g., `TILE_SIZE`, `GAME_WIDTH`)
- **Entity IDs:** camelCase (e.g., `nightWolf`, `vampireBat`, `stoneGolem`)

### Code Style
- **JSDoc comments** for public functions and complex logic
- **No unnecessary comments** - code should be self-documenting
- **Indentation:** 2 spaces (enforced by TypeScript config)
- **Line length:** Keep reasonable (no hard limit, but ~100 chars preferred)
- **Imports:** Group by external → internal → types

### Phaser-Specific Patterns
- **Scene data passing:** All scene transitions pass data object with `player`, `defeatedBosses`, `codex`, `timeStep`, and `weatherState`
- **Scene init method:** Always accept and store scene data in `init(data: SceneData)`
- **Asset generation:** All graphics are procedurally generated in `Boot.ts` - never use external image files
- **Audio:** All sound is procedurally synthesized via Web Audio API in `audio.ts` - never use external audio files
- **Game objects:** Store references to Phaser objects as class properties for later access
- **UI positioning:** Always calculate actual pixel bounds (including scale) to prevent text overlap
- **Zoom level:** Default game zoom is 2x for better visibility

### PlayerState Architecture
- **Composition pattern:** PlayerState uses nested sub-interfaces for better organization
- **PlayerPosition:** Contains location fields (x, y, chunkX, chunkY, inDungeon, dungeonId, inCity, cityId)
  - Access: `player.position.x`, `player.position.chunkX`, etc.
- **PlayerProgression:** Contains tracking fields (openedChests, collectedTreasures, exploredTiles)
  - Access: `player.progression.openedChests`, `player.progression.exploredTiles`, etc.
- **Backward compatibility:** `loadGame()` in `save.ts` automatically migrates old flat saves to nested structure
- **Core stats:** Remain flat on PlayerState (hp, maxHp, mp, maxMp, stats, gold, inventory, etc.)

## D&D Game Mechanics

### Character Creation Flow
**Name → Class Selection → Stat Allocation → Appearance Customization → Start Adventure**

### Stat Allocation (Point Buy)
- D&D 5E Point Buy: 27 points, scores range 8–15
- Cost table: 8→0, 9→1, 10→2, 11→3, 12→4, 13→5, 14→7, 15→9
- Alternative: Random mode (4d6-drop-lowest, unlimited re-rolls)
- Class boosts applied on top of base stats (can push above 15)
- `createPlayer(name, baseStats, appearanceId, customAppearance)` — stats are NOT rolled internally

### Classes & Primary Stats
Each class has a `primaryStat` used for to-hit calculations:
- **Knight** (STR+2, CON+1) → primary: STR
- **Ranger** (DEX+2, WIS+1) → primary: DEX
- **Mage** (INT+2, WIS+1) → primary: INT
- **Rogue** (DEX+2, CHA+1) → primary: DEX
- **Paladin** (STR+1, CHA+2) → primary: CHA
- **Warlock** (CHA+2, INT+1) → primary: CHA
- **Cleric** (WIS+2, CON+1) → primary: WIS
- **Barbarian** (STR+2, CON+1) → primary: STR

### Combat System
- **D20 system:** Attack rolls, skill checks, saving throws use d20
- **Critical hits:** Natural 20 on attack roll = critical hit (double damage)
- **Critical misses:** Natural 1 on attack roll = automatic miss
- **Initiative:** Roll d20 + dexterity modifier to determine turn order
- **Spell slots:** MP (mana points) system instead of traditional spell slots
- **Ability modifiers:** Used for attack/damage bonuses (see `dice.ts`)
- **Distinct SFX:** Hit, miss, and critical hit each have unique sounds
- **Action buttons:** Visually disabled (dimmed) when not the player's turn

### Monster System
- **Monster IDs:** Use camelCase (e.g., `nightWolf`, `vampireBat`)
- **Encounter tables:** Defined per terrain type with spawn weights
- **Boss monsters:** Fixed map positions, each with unique battle music profile
- **Night monsters:** Separate spawn table for nighttime encounters
- **Codex:** Track discovered monsters, AC discovery via combat rolls

### Day/Night Cycle
- **360-step cycle:** Dawn (0-44), Day (45-219), Dusk (220-264), Night (265-359)
- **Time advances:** One step per player movement
- **Visual effects:** Tint applied to overworld tiles AND battle backgrounds
- **Battle sky:** Sun/moon drawn at different positions per time period
- **Night encounters:** Different monster table during night hours
- **Persistence:** `timeStep` stored in save data

### Weather System
- **Six types:** Clear, Rain, Snow, Sandstorm, Storm, Fog
- **Biome-weighted:** Each biome has different weather probabilities
- **Combat effects:** Weather applies accuracy penalties and monster boosts
- **Audio:** Weather ambient SFX overlay (rain patter, thunder, wind, etc.)
- **Particles:** Visual weather effects in both overworld and battle scenes

### Audio System
- **Procedural synthesis:** All music and SFX generated via Web Audio API at runtime
- **Biome music:** Each biome has unique scale, tempo, and instrument combination
- **Orchestral layers:** Strings (vibrato sine), brass (sawtooth stabs), kick drum, hihat on all tracks
- **Boss music:** Each boss has a unique musical profile (scale, BPM, wave types)
- **City music:** Each city has distinct vibe (pastoral, industrial, mystical, exotic, etc.)
- **SFX:** Attack (swoosh+impact+clang), miss (airy whiff), critical hit (slam+sting+bell), chest open, dungeon enter, potion drink, terrain footsteps
- **Volume settings:** Per-channel sliders (Master, Music, SFX, Dialog) with localStorage persistence
- **Settings UI:** Available on both title screen and in-game menu (M → Settings)

### Equipment System
- **Unequip:** Click equipped items to unequip
- **Stats display:** Shows ability modifiers and to-hit value in equip overlay
- **Stacked items:** Battle inventory groups consumables by type (e.g., "Potion x3")

## Development Commands
```bash
npm run dev        # Start dev server (localhost:3000)
npm run build      # Production build (includes typecheck)
npm test           # Run all tests
npm run test:watch # Run tests in watch mode
npm run typecheck  # TypeScript type checking only
```

## Testing Guidelines
- **Test framework:** Vitest
- **Test file naming:** `*.test.ts` in `tests/` directory
- **What to test:**
  - Dice rolling utilities (probability distributions, edge cases)
  - Combat calculations (attack rolls, damage, modifiers)
  - Player leveling, XP progression, Point Buy validation
  - Data integrity (monsters, spells, items)
  - Day/night cycle transitions
  - Weather system state changes
  - Audio engine API surface and state
  - Debug system configuration
- **What NOT to test:**
  - Phaser rendering (visual/UI elements)
  - Scene transitions (integration tests)
  - User interactions (E2E tests)

## Debug System
- **Debug mode:** Toggled via checkbox above game canvas
- **Debug features:**
  - Scrollable debug panel with action logs, live state, and trailing spacer
  - Console logging with `debugLog()` function
  - Cheat keys in battle (K=kill, H=heal, P=restore MP, G=gold, L=level up, X=max XP)
  - Overworld cheats: R=reveal map, V=toggle fog, F=toggle encounters
- **Debug commands:** Text input with `/command` syntax (gold, exp, hp, mp, heal, reveal, teleport, spawn, weather, time, audio, item, level)
- **Usage:** Use `isDebug()` to check state, `debugLog()` for conditional logging

## Common Patterns

### Scene Transitions
```typescript
this.scene.start("NextScene", {
  player: this.player,
  defeatedBosses: this.defeatedBosses,
  codex: this.codex,
  timeStep: this.timeStep,
  weatherState: this.weatherState,
});
```

### Player Creation (Point Buy)
```typescript
const baseStats: PlayerStats = {
  strength: 15, dexterity: 14, constitution: 13,
  intelligence: 12, wisdom: 10, charisma: 8,
};
const player = createPlayer("Hero", baseStats, "knight", customAppearance);
// Class boosts applied on top: Knight gets STR+2, CON+1
```

### Audio Engine Usage
```typescript
audioEngine.init(); // Must be called from user gesture
audioEngine.playBiomeMusic(chunkName, timePeriod);
audioEngine.playBattleMusic();
audioEngine.playAttackSFX();        // Normal hit
audioEngine.playMissSFX();          // Whiff
audioEngine.playCriticalHitSFX();   // Critical hit
audioEngine.playFootstepSFX(terrainType);
audioEngine.setMasterVolume(0.8);   // Persisted to localStorage
```

### Dice Rolling
```typescript
import { rollDice, rollD20, abilityModifier } from "../systems/dice";
const damage = rollDice(2, 6) + abilityModifier(strength);
const attackRoll = rollD20() + proficiencyBonus + abilityModifier(dexterity);
```

## Security & Best Practices
- **No external assets:** All graphics generated procedurally, all audio synthesized
- **No network calls:** Pure client-side game
- **LocalStorage only:** Save data and audio preferences stored locally
- **Input validation:** Validate all user input before processing
- **Type safety:** Leverage TypeScript to prevent runtime errors

## Prohibited Practices
- ❌ Don't use `any` type - use `unknown` or proper types
- ❌ Don't add external image/audio assets - generate procedurally
- ❌ Don't use console.log in production code - use `debugLog()`
- ❌ Don't hardcode magic numbers - use constants from `config.ts`
- ❌ Don't overlap UI elements - always calculate bounds
- ❌ Don't use force push - git history must be preserved
- ❌ Don't modify game data during runtime - keep data immutable

## Resources
- Phaser 3 API: https://newdocs.phaser.io/docs/3.90.0
- TypeScript Handbook: https://www.typescriptlang.org/docs/
- D&D 5E SRD: https://www.dndbeyond.com/sources/basic-rules
- Vite Documentation: https://vitejs.dev/guide/

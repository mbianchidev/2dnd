# 2D&D Project - GitHub Copilot Instructions

## Project Overview
2D&D is a browser-based JRPG that combines Dragon Quest-style gameplay with Dungeons & Dragons mechanics. The game features turn-based combat, spell system, leveling, shops, and random encounters, all rendered with procedurally-generated graphics.

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
├── config.ts            # Game constants and debug system
├── scenes/              # Phaser game scenes
│   ├── BootScene.ts     # Asset generation & title screen
│   ├── OverworldScene.ts # Tile map, movement, encounters
│   ├── BattleScene.ts   # Turn-based combat
│   ├── ShopScene.ts     # Item shops & inn
│   └── BestiaryScene.ts # Monster encyclopedia
├── systems/             # Core game systems
│   ├── combat.ts        # D&D combat mechanics
│   ├── player.ts        # Player state, leveling, inventory
│   ├── save.ts          # Save/load functionality
│   ├── appearance.ts    # Character customization
│   ├── bestiary.ts      # Monster tracking
│   └── daynight.ts      # Day/night cycle
├── data/                # Game data definitions
│   ├── map.ts           # Overworld map grid & terrain
│   ├── monsters.ts      # Monster definitions & encounters
│   ├── spells.ts        # Spell definitions & requirements
│   ├── items.ts         # Item definitions & shop inventory
│   ├── abilities.ts     # Character abilities
│   └── talents.ts       # Character talents/perks
└── utils/
    └── dice.ts          # D&D dice rolling utilities
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
- **Files:** camelCase (e.g., `BootScene.ts`, `player.ts`)
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
- **Scene data passing:** All scene transitions pass data object with `player`, `defeatedBosses`, `bestiary`, and `timeStep`
- **Scene init method:** Always accept and store scene data in `init(data: SceneData)`
- **Asset generation:** All graphics are procedurally generated in `BootScene.ts` - never use external image files
- **Game objects:** Store references to Phaser objects as class properties for later access
- **UI positioning:** Always calculate actual pixel bounds (including scale) to prevent text overlap
- **Zoom level:** Default game zoom is 2x for better visibility

## D&D Game Mechanics

### Combat System
- **D20 system:** Attack rolls, skill checks, saving throws use d20
- **Critical hits:** Natural 20 on attack roll = critical hit (double damage)
- **Critical misses:** Natural 1 on attack roll = automatic miss
- **Initiative:** Roll d20 + dexterity modifier to determine turn order
- **Spell slots:** MP (mana points) system instead of traditional spell slots
- **Ability modifiers:** Used for attack/damage bonuses (see `dice.ts`)

### Monster System
- **Monster IDs:** Use camelCase (e.g., `nightWolf`, `vampireBat`)
- **Encounter tables:** Defined per terrain type with spawn weights
- **Boss monsters:** Fixed positions on map, tracked in `defeatedBosses` array
- **Night monsters:** Separate spawn table for nighttime encounters (90-119 in cycle)
- **Bestiary:** Track discovered monsters with `foundAt` timestamp

### Day/Night Cycle
- **120-step cycle:** Dawn (0-14), Day (15-74), Dusk (75-89), Night (90-119)
- **Time advances:** One step per player movement
- **Night encounters:** Different monster table during night hours
- **Persistence:** `timeStep` stored in save data

### Character System
- **Classes:** Multiple character classes with unique abilities and spells
- **Appearance:** Optional `customAppearance` with `skinColor`, `hairStyle`, `hairColor`
- **Stats:** Six D&D ability scores (STR, DEX, CON, INT, WIS, CHA)
- **Leveling:** XP-based with stat increases and spell unlocks
- **Inventory:** Items, weapons, armor with D&D-style bonuses

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
  - Player leveling and XP progression
  - Data integrity (monsters, spells, items)
- **What NOT to test:**
  - Phaser rendering (visual/UI elements)
  - Scene transitions (integration tests)
  - User interactions (E2E tests)

## Debug System
- **Debug mode:** Toggled via checkbox above game canvas
- **Debug features:**
  - Debug panel below game with action logs and live state
  - Console logging with `debugLog()` function
  - Cheat keys in battle (K=kill, H=heal, P=restore MP, G=gold, L=level up, X=max XP)
- **Debug commands:** Text input with `/command` syntax
- **Usage:** Use `isDebug()` to check state, `debugLog()` for conditional logging

## Common Patterns

### Scene Transitions
```typescript
// Correct way to transition scenes
this.scene.start("NextScene", {
  player: this.player,
  defeatedBosses: this.defeatedBosses,
  bestiary: this.bestiary,
  timeStep: this.timeStep,
});
```

### Dice Rolling
```typescript
// Use utility functions from dice.ts
import { rollDice, rollD20, abilityModifier } from "../utils/dice";

const damage = rollDice(2, 6) + abilityModifier(strength);
const attackRoll = rollD20() + proficiencyBonus + abilityModifier(dexterity);
```

### Entity IDs
```typescript
// Correct: camelCase for all entity IDs
const monster = getMonster("nightWolf");
const spell = getSpell("fireBolt");

// Incorrect: kebab-case or snake_case
const monster = getMonster("night-wolf");  // ❌
const spell = getSpell("fire_bolt");       // ❌
```

### UI Positioning
```typescript
// Always calculate bounds to prevent overlap
const title = this.add.text(x, y, "Title", { fontSize: "32px" });
title.setOrigin(0.5);
const titleHeight = title.height * title.scaleY;

const subtitle = this.add.text(x, y + titleHeight + 20, "Subtitle", { fontSize: "16px" });
// Add proper gap (20px here) between elements
```

## Security & Best Practices
- **No external assets:** All graphics generated procedurally
- **No network calls:** Pure client-side game
- **LocalStorage only:** Save data stored locally, not on server
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

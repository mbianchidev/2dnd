---
name: 2dnd-game-development
description: Develop game features for 2D&D with Phaser 3, TypeScript, and D&D mechanics
license: MIT
---

# 2D&D Game Development Skill

This skill helps you develop new features and systems for the 2D&D browser-based JRPG game using Phaser 3, TypeScript, and D&D mechanics.

## Core Principles

1. **Type Safety First** - Use strict TypeScript with explicit types
2. **Procedural Graphics** - All visuals generated at runtime, no external assets
3. **D&D Mechanics** - Follow D&D 5E rules for combat, abilities, and progression
4. **Scene Data Flow** - Always pass complete game state between scenes
5. **Debug-Friendly** - Use debug system for logging and development tools

## When to Use This Skill

- Adding new game features (spells, items, monsters, abilities)
- Creating new game systems (talents, quests, achievements)
- Implementing game mechanics (combat, leveling, crafting)
- Extending existing systems (appearance, bestiary, day/night)

## Instructions

### Adding New Monsters

1. **Define monster data** in `src/data/monsters.ts`:
```typescript
export const NEW_MONSTER: MonsterData = {
  id: "newMonster",  // camelCase ID
  name: "New Monster",
  level: 3,
  hp: 22,
  ac: 13,
  attack: 4,
  damage: "1d8+2",
  xp: 100,
  gold: 15,
};
```

2. **Add to encounter table** for appropriate terrain:
```typescript
{ monster: "newMonster", weight: 10, minLevel: 2 }
```

3. **Generate sprite** in `BootScene.ts` if custom appearance needed
4. **Test encounter** in game with appropriate level character

### Adding New Spells

1. **Define spell** in `src/data/spells.ts`:
```typescript
export const NEW_SPELL: Spell = {
  id: "newSpell",
  name: "New Spell",
  mpCost: 5,
  levelRequired: 5,
  damage: "3d6",      // for damage spells
  healing: "2d8+3",   // for healing spells
  description: "Does something magical",
};
```

2. **Add to class spell list** in `src/systems/appearance.ts`
3. **Implement effect** in `src/systems/combat.ts` if needed
4. **Test spell** at required level

### Adding New Items

1. **Define item** in `src/data/items.ts`:
```typescript
export const NEW_ITEM: Item = {
  id: "newItem",
  name: "New Item",
  type: "weapon",  // or "armor", "consumable"
  price: 100,
  damage: "1d8",   // for weapons
  ac: 2,           // for armor
  effect: "...",   // for consumables
};
```

2. **Add to shop inventory** if purchasable
3. **Implement use logic** if consumable
4. **Test purchase and use** in game

### Creating New Scenes

1. **Extend Phaser Scene**:
```typescript
export class NewScene extends Phaser.Scene {
  private player!: PlayerState;
  private defeatedBosses!: string[];
  private bestiary!: Bestiary;
  private timeStep!: number;

  constructor() {
    super({ key: "NewScene" });
  }

  init(data: {
    player: PlayerState;
    defeatedBosses: string[];
    bestiary: Bestiary;
    timeStep: number;
  }) {
    this.player = data.player;
    this.defeatedBosses = data.defeatedBosses;
    this.bestiary = data.bestiary;
    this.timeStep = data.timeStep;
  }

  create() {
    // Scene implementation
  }
}
```

2. **Register scene** in `src/main.ts`
3. **Add navigation** from other scenes
4. **Test scene transitions**

## Examples

### Adding a Multi-Target Spell
```typescript
// In spells.ts
export const CHAIN_LIGHTNING: Spell = {
  id: "chainLightning",
  name: "Chain Lightning",
  mpCost: 8,
  levelRequired: 9,
  damage: "3d10",
  description: "Lightning that chains between enemies",
};

// In combat.ts
function castChainLightning(caster: PlayerState, targets: MonsterInstance[]) {
  const baseDamage = rollDice(3, 10);
  targets.forEach((target, i) => {
    const damage = Math.floor(baseDamage * (1 - i * 0.2)); // 20% reduction per chain
    target.hp -= damage;
  });
}
```

### Adding a Status Effect System
```typescript
// In player.ts or combat.ts
export interface StatusEffect {
  type: "poisoned" | "blessed" | "hasted" | "stunned";
  duration: number;  // turns remaining
  value: number;     // damage per turn or bonus
}

export interface PlayerState {
  // ... existing fields
  statusEffects: StatusEffect[];
}

function applyStatusEffects(entity: PlayerState | MonsterInstance) {
  entity.statusEffects.forEach(effect => {
    if (effect.type === "poisoned") {
      entity.hp -= effect.value;
    }
    effect.duration--;
  });
  entity.statusEffects = entity.statusEffects.filter(e => e.duration > 0);
}
```

## Best Practices

- **Data-driven design** - Keep game content in data files, not hardcoded
- **Immutable data** - Don't modify original data objects, create copies
- **Consistent naming** - Use camelCase for IDs, PascalCase for types
- **Error handling** - Validate data and handle edge cases gracefully
- **Performance** - Cache calculations, reuse objects, minimize allocations
- **Testability** - Write unit tests for game logic, not UI

## Audio System

All audio is procedurally synthesized — no external audio files.

```typescript
import { audioEngine } from "../systems/audio";

// Initialize from user gesture
audioEngine.init();

// Music (auto-crossfade between tracks)
audioEngine.playBiomeMusic(chunkName, timePeriod);  // Overworld
audioEngine.playBattleMusic();                       // Non-boss battles
audioEngine.playBossMusic(bossId);                   // Boss-specific music
audioEngine.playCityMusic(cityName);                 // City-specific vibe
audioEngine.playTitleMusic();                        // Title screen

// SFX (distinct sounds for combat outcomes)
audioEngine.playAttackSFX();        // Normal hit: swoosh + impact + clang
audioEngine.playMissSFX();          // Miss: airy whiff + descending pitch
audioEngine.playCriticalHitSFX();   // Critical: slam + rising sting + bell
audioEngine.playChestOpenSFX();     // Chest: ascending twinkle
audioEngine.playDungeonEnterSFX();  // Dungeon: deep boom + eerie tone
audioEngine.playPotionSFX();        // Potion: glug bubbles + shimmer
audioEngine.playFootstepSFX(terrain); // Terrain-specific footstep noise

// Volume (persisted to localStorage)
audioEngine.setMasterVolume(0.8);
audioEngine.setMusicVolume(0.6);
audioEngine.setSFXVolume(0.4);
audioEngine.setDialogVolume(0.5);
```

## Weather & Day/Night

```typescript
import { WeatherType, advanceWeather, getWeatherAccuracyPenalty } from "../systems/weather";
import { getTimePeriod, TimePeriod, PERIOD_TINT } from "../systems/daynight";

// 360-step cycle: Dawn(0-44), Day(45-219), Dusk(220-264), Night(265-359)
const period = getTimePeriod(timeStep);

// 6 weather types with biome-weighted probabilities
// Clear, Rain, Snow, Sandstorm, Storm, Fog
const penalty = getWeatherAccuracyPenalty(weather); // Combat effect
```

## Common Pitfalls to Avoid

- ❌ Forgetting to pass scene data during transitions (include weatherState)
- ❌ Using inconsistent ID naming conventions
- ❌ Hardcoding values instead of using config constants
- ❌ Modifying shared data objects directly
- ❌ Overlapping UI elements without bound checking
- ❌ Adding external asset/audio files (use procedural generation)
- ❌ Calling createPlayer without baseStats parameter

## Testing Your Changes

1. **Type check**: `npm run typecheck`
2. **Run tests**: `npm test`
3. **Manual testing**: `npm run dev`
4. **Debug mode**: Enable debug checkbox for detailed logs
5. **Edge cases**: Test at level 1, max level, with/without items

## Related Files

- Game data: `src/data/*.ts`
- Game systems: `src/systems/*.ts`
- Scenes: `src/scenes/*.ts`
- Utilities: `src/utils/*.ts`
- Tests: `tests/*.test.ts`

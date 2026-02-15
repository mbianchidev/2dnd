---
name: dnd-mechanics
description: Implement D&D 5E mechanics correctly in the 2D&D game system
license: MIT
---

# D&D 5E Mechanics Implementation

Guide for implementing authentic D&D 5th Edition mechanics in the 2D&D browser game.

## Ability Score System

### Core Ability Scores
The game uses six standard D&D abilities:
- **Strength (STR)** - Melee attacks, carrying capacity
- **Dexterity (DEX)** - Initiative, AC, ranged attacks
- **Constitution (CON)** - Hit points, endurance
- **Intelligence (INT)** - Spell attack (wizards)
- **Wisdom (WIS)** - Spell attack (clerics), perception
- **Charisma (CHA)** - Spell attack (sorcerers, warlocks)

### Modifier Calculation
```typescript
// From systems/dice.ts
// Ability score of 10-11 = +0 modifier
// Each 2 points above/below 10 changes modifier by 1
// Formula: floor((score - 10) / 2)

const strModifier = abilityModifier(playerStats.strength);
// STR 16 → +3, STR 8 → -1
```

### Rolling Ability Scores
```typescript
// 4d6 drop lowest - standard D&D character generation (Random mode)
const strength = rollAbilityScore();  // Returns 3-18, average ~12
```

### Point Buy System (default in character creation)
```typescript
import { POINT_BUY_COSTS, POINT_BUY_TOTAL, calculatePointsSpent, isValidPointBuy } from "../systems/player";

// 27 points total, scores range 8-15
// Cost: 8→0, 9→1, 10→2, 11→3, 12→4, 13→5, 14→7, 15→9
const baseStats: PlayerStats = { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 };
calculatePointsSpent(baseStats); // → 27
isValidPointBuy(baseStats);      // → true

// Class boosts applied on top (can push above 15):
const player = createPlayer("Hero", baseStats, "knight"); // STR becomes 17 (15+2)
```

### Classes & Primary Stats
Each class has a `primaryStat` for to-hit calculations:
- Knight (STR+2, CON+1) → STR | Ranger (DEX+2, WIS+1) → DEX
- Mage (INT+2, WIS+1) → INT | Rogue (DEX+2, CHA+1) → DEX
- Paladin (STR+1, CHA+2) → CHA | Warlock (CHA+2, INT+1) → CHA
- Cleric (WIS+2, CON+1) → WIS | Barbarian (STR+2, CON+1) → STR

## Combat Mechanics

### Attack Roll Formula
```
d20 + ability modifier + proficiency bonus + weapon bonus
```

Compare to target's AC (Armor Class):
- **Hit**: Roll >= AC
- **Critical Hit**: Natural 20 (automatic hit, double damage)
- **Critical Miss**: Natural 1 (automatic miss)

### Damage Calculation
```
weapon dice + ability modifier + weapon bonus
```

Example implementations:
```typescript
// Melee weapon attack
const attackRoll = rollD20() + abilityModifier(player.stats.strength) + player.proficiencyBonus;
if (attackRoll >= monster.ac) {
  const damageRoll = rollDice(1, 8);  // longsword = 1d8
  const totalDamage = damageRoll + abilityModifier(player.stats.strength);
  monster.hp -= totalDamage;
}

// Spell attack
const spellAttackRoll = rollD20() + abilityModifier(player.stats.intelligence) + player.proficiencyBonus;
```

### Initiative System
```typescript
// Both player and monster roll initiative
const playerInit = rollD20() + abilityModifier(player.stats.dexterity);
const monsterInit = rollD20() + abilityModifier(monster.dexterity);

// Higher roll goes first
const playerFirst = playerInit >= monsterInit;
```

## Spell System

### Spell Slots vs Mana Points
2D&D uses MP (Mana Points) instead of spell slots for simplicity:
- Each spell has an MP cost
- Player has maxMp that increases with level
- MP regenerates at inns or with potions

### Spell Attack Types

**Attack Spells** (require attack roll):
```typescript
const spellAttack = rollD20() + 
  abilityModifier(player.stats.intelligence) + 
  player.proficiencyBonus;

if (spellAttack >= target.ac) {
  const damage = rollDice(spellDice, spellSides);
  target.hp -= damage;
}
```

**Saving Throw Spells** (target rolls to resist):
```typescript
const saveDC = 8 + 
  player.proficiencyBonus + 
  abilityModifier(player.stats.intelligence);

const saveRoll = rollD20() + abilityModifier(target.wisdom);

if (saveRoll < saveDC) {
  // Failed save, full damage
  const damage = rollDice(spellDice, spellSides);
  target.hp -= damage;
} else {
  // Successful save, half damage
  const damage = Math.floor(rollDice(spellDice, spellSides) / 2);
  target.hp -= damage;
}
```

**Healing Spells** (no attack roll):
```typescript
const healing = rollDice(2, 8) + abilityModifier(player.stats.wisdom);
player.hp = Math.min(player.hp + healing, player.maxHp);
```

## Leveling and Experience

### XP Requirements
Each level requires progressively more XP. Check `src/systems/player.ts` for the XP table.

### Level-Up Benefits
When leveling up:
1. **Hit Points**: Roll hit die + CON modifier (minimum 1)
2. **Spell Unlocks**: New spells at specific levels
3. **Ability Score Increases**: Every 4 levels (4, 8, 12, 16, 20)
4. **Proficiency Bonus**: Increases at levels 5, 9, 13, 17

### XP Award Calculation
```typescript
// Monster XP is predefined in monster data
const xpGained = monster.xp;

// Optional: Scale XP based on level difference
const levelDiff = monster.level - player.level;
if (levelDiff < -3) {
  // Lower level monsters give reduced XP
  xpGained = Math.floor(xpGained * 0.5);
}
```

## Armor Class (AC)

### AC Calculation
```
10 + DEX modifier + armor bonus + shield bonus + magical bonuses
```

### Armor Types
- **No Armor**: 10 + full DEX modifier
- **Light Armor**: base AC + full DEX modifier
- **Medium Armor**: base AC + DEX modifier (max +2)
- **Heavy Armor**: base AC only (no DEX)

Implementation in 2D&D:
```typescript
const baseAC = 10;
const armorBonus = player.equipment.armor?.ac || 0;
const dexMod = abilityModifier(player.stats.dexterity);

// Simplified: full DEX modifier always applies
const totalAC = baseAC + armorBonus + dexMod;
```

## Dice Notation

### Standard Format: XdY+Z
- **X**: Number of dice
- **Y**: Die type (4, 6, 8, 10, 12, 20, 100)
- **Z**: Modifier (optional)

Examples:
- `1d20` - Single 20-sided die
- `2d6` - Two 6-sided dice
- `3d8+5` - Three 8-sided dice plus 5

### Parsing Dice Strings
```typescript
// "2d6+3" → roll 2d6, add 3
function parseDiceString(notation: string): number {
  const match = notation.match(/(\d+)d(\d+)(?:\+(\d+))?/);
  if (!match) return 0;
  
  const numDice = parseInt(match[1]);
  const dieSides = parseInt(match[2]);
  const modifier = parseInt(match[3] || "0");
  
  return rollDice(numDice, dieSides) + modifier;
}
```

## Critical Hits

### Critical Hit Rules
On natural 20:
1. Automatic hit (regardless of AC)
2. Roll damage dice twice
3. Add modifiers once

```typescript
const attackRoll = rollD20();

if (attackRoll === 20) {
  // Critical hit!
  const damage1 = rollDice(weaponDice, weaponSides);
  const damage2 = rollDice(weaponDice, weaponSides);
  const modifier = abilityModifier(player.stats.strength);
  const totalDamage = damage1 + damage2 + modifier;
  
  target.hp -= totalDamage;
}
```

## Advantage/Disadvantage

### Standard D&D Rule
- **Advantage**: Roll 2d20, take higher
- **Disadvantage**: Roll 2d20, take lower

### Implementation
```typescript
function rollWithAdvantage(): number {
  const roll1 = rollD20();
  const roll2 = rollD20();
  return Math.max(roll1, roll2);
}

function rollWithDisadvantage(): number {
  const roll1 = rollD20();
  const roll2 = rollD20();
  return Math.min(roll1, roll2);
}
```

### When to Apply
- Advantage: Hidden attacker, prone target, helpful conditions
- Disadvantage: Blinded, prone attacker, restrained, difficult terrain

## Proficiency Bonus

Increases with level:
- Levels 1-4: +2
- Levels 5-8: +3
- Levels 9-12: +4
- Levels 13-16: +5
- Levels 17-20: +6

```typescript
function calculateProficiencyBonus(level: number): number {
  return Math.floor((level - 1) / 4) + 2;
}
```

Applied to:
- Attack rolls with proficient weapons
- Spell attack rolls
- Saving throw DCs
- Skill checks (if implemented)

## Rest and Recovery

### Short Rest
- Restore some HP (spend hit dice)
- Brief rest after battle

### Long Rest (Inn in 2D&D)
- Restore all HP
- Restore all MP
- Costs gold

```typescript
function restAtInn(player: PlayerState, innCost: number): boolean {
  if (player.gold >= innCost) {
    player.gold -= innCost;
    player.hp = player.maxHp;
    player.mp = player.maxMp;
    return true;
  }
  return false;
}
```

## Encounter Balance

### Challenge Rating
Monsters should be balanced for player level:
- Easy: CR = Player Level - 2
- Medium: CR = Player Level
- Hard: CR = Player Level + 2
- Deadly: CR = Player Level + 4

### Encounter Tables
Define spawn weights based on player level:
```typescript
{
  monster: "goblin",
  weight: 20,
  minLevel: 1,  // Only spawns when player is level 1+
}
```

## Testing D&D Mechanics

Verify correctness:
1. **Ability modifiers**: Test edge cases (10, 11, odd/even scores)
2. **Critical hits**: Ensure double dice, not double total
3. **Level progression**: Verify XP thresholds and benefits
4. **Spell costs**: Check MP costs are balanced
5. **Combat math**: Attack rolls, damage, AC calculations

## References

All mechanics based on D&D 5E SRD (Systems Reference Document), simplified for browser gameplay.

## Related Files

- `src/systems/dice.ts` - Dice rolling utilities
- `src/systems/combat.ts` - Combat implementation
- `src/systems/player.ts` - Player stats and leveling
- `src/data/spells.ts` - Spell definitions
- `src/data/monsters.ts` - Monster stats

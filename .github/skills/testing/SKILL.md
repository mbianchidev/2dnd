---
name: testing
description: Write effective tests for 2D&D game logic using Vitest
license: MIT
---

# Testing Guide for 2D&D

Write comprehensive tests for game mechanics using Vitest while avoiding UI/integration tests.

## Testing Philosophy

### What TO Test
✅ Dice probability distributions
✅ Combat calculation accuracy  
✅ Player stat progression
✅ XP and leveling formulas
✅ Data integrity (monsters, spells, items)
✅ Game logic functions

### What NOT to Test  
❌ Phaser rendering/graphics
❌ Scene transitions
❌ User input handling
❌ Visual appearance
❌ Animation timing

## Test File Organization

```
tests/
├── dice.test.ts      # Dice rolling utilities
├── combat.test.ts    # Combat mechanics
├── player.test.ts    # Player systems
└── data.test.ts      # Data validation
```

## Dice Testing Patterns

### Statistical Distribution Testing
```typescript
import { describe, it, expect } from "vitest";
import { rollD20, rollDice, abilityModifier } from "../src/systems/dice";

describe("rollD20 distribution", () => {
  it("returns values between 1 and 20", () => {
    const rolls = Array.from({ length: 200 }, () => rollD20());
    
    expect(Math.min(...rolls)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...rolls)).toBeLessThanOrEqual(20);
  });

  it("produces roughly uniform distribution", () => {
    const rolls = Array.from({ length: 10000 }, () => rollD20());
    const counts = rolls.reduce((acc, roll) => {
      acc[roll] = (acc[roll] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    // Each face should appear ~500 times (10000/20)
    // Allow 20% variance (400-600)
    Object.values(counts).forEach(count => {
      expect(count).toBeGreaterThan(400);
      expect(count).toBeLessThan(600);
    });
  });
});
```

### Modifier Calculation Testing
```typescript
describe("abilityModifier", () => {
  it("calculates correct modifiers for standard scores", () => {
    expect(abilityModifier(8)).toBe(-1);
    expect(abilityModifier(10)).toBe(0);
    expect(abilityModifier(11)).toBe(0);
    expect(abilityModifier(12)).toBe(1);
    expect(abilityModifier(16)).toBe(3);
    expect(abilityModifier(20)).toBe(5);
  });

  it("handles edge cases", () => {
    expect(abilityModifier(1)).toBe(-5);
    expect(abilityModifier(3)).toBe(-4);
    expect(abilityModifier(30)).toBe(10);
  });
});
```

## Combat Testing Patterns

### Attack Roll Validation
```typescript
import { calculateAttackRoll, resolveAttack } from "../src/systems/combat";

describe("attack mechanics", () => {
  it("hits when roll meets or exceeds AC", () => {
    const attacker = createTestPlayer({ strength: 16 });  // +3 mod
    const target = createTestMonster({ ac: 13 });
    
    // Mock d20 roll of 10
    const mockRoll = 10;
    const attackBonus = abilityModifier(attacker.stats.strength);
    const total = mockRoll + attackBonus;  // 13
    
    expect(total).toBeGreaterThanOrEqual(target.ac);
  });

  it("applies critical hit on natural 20", () => {
    const attacker = createTestPlayer();
    const target = createTestMonster({ hp: 50 });
    
    const normalDamage = resolveDamage(attacker, false);
    const criticalDamage = resolveDamage(attacker, true);
    
    // Critical should deal more damage
    expect(criticalDamage).toBeGreaterThan(normalDamage);
  });
});
```

### Damage Calculation Testing
```typescript
describe("damage calculation", () => {
  it("adds ability modifier to weapon damage", () => {
    const attacker = createTestPlayer({ 
      strength: 18,  // +4 modifier
      equipment: { weapon: { damage: "1d8" } }
    });
    
    // Test multiple rolls
    const damages = Array.from({ length: 100 }, () => 
      calculateDamage(attacker)
    );
    
    // Minimum: 1 (min roll) + 4 (modifier) = 5
    // Maximum: 8 (max roll) + 4 (modifier) = 12
    expect(Math.min(...damages)).toBe(5);
    expect(Math.max(...damages)).toBe(12);
  });
});
```

## Player System Testing

### Leveling Logic
```typescript
import { gainXP, levelUp, calculateMaxHP } from "../src/systems/player";

describe("player leveling", () => {
  it("levels up when reaching XP threshold", () => {
    const player = createTestPlayer({ level: 1, xp: 0 });
    const xpNeeded = getXPForLevel(2);
    
    gainXP(player, xpNeeded);
    
    expect(player.level).toBe(2);
    expect(player.xp).toBe(0);  // XP resets after level
  });

  it("increases max HP on level up", () => {
    const player = createTestPlayer({ 
      level: 1, 
      maxHp: 10,
      stats: { constitution: 14 }  // +2 modifier
    });
    
    const oldMaxHP = player.maxHp;
    levelUp(player);
    
    expect(player.maxHp).toBeGreaterThan(oldMaxHP);
    // Should increase by at least 1 (minimum HP gain)
    expect(player.maxHp - oldMaxHP).toBeGreaterThanOrEqual(1);
  });

  it("unlocks spells at correct levels", () => {
    const player = createTestPlayer({ level: 1, class: "wizard" });
    
    expect(player.knownSpells).not.toContain("fireball");
    
    // Level up to spell unlock level
    player.level = 5;
    updateKnownSpells(player);
    
    expect(player.knownSpells).toContain("fireball");
  });
});
```

### Inventory Management
```typescript
describe("player inventory", () => {
  it("equips weapon and updates attack damage", () => {
    const player = createTestPlayer();
    const sword = { id: "longsword", damage: "1d8", bonus: 1 };
    
    equipWeapon(player, sword);
    
    expect(player.equipment.weapon).toBe(sword);
    expect(player.attackDamage).toContain("1d8");
  });

  it("prevents purchasing when insufficient gold", () => {
    const player = createTestPlayer({ gold: 10 });
    const expensiveItem = { id: "plate", price: 1500 };
    
    const result = purchaseItem(player, expensiveItem);
    
    expect(result).toBe(false);
    expect(player.gold).toBe(10);  // Unchanged
  });
});
```

## Data Integrity Testing

### Monster Data Validation
```typescript
import { MONSTERS, ENCOUNTER_TABLES } from "../src/data/monsters";

describe("monster data integrity", () => {
  it("all monsters have required fields", () => {
    Object.values(MONSTERS).forEach(monster => {
      expect(monster.id).toBeDefined();
      expect(monster.name).toBeDefined();
      expect(monster.level).toBeGreaterThan(0);
      expect(monster.hp).toBeGreaterThan(0);
      expect(monster.ac).toBeGreaterThan(0);
      expect(monster.xp).toBeGreaterThan(0);
    });
  });

  it("all encounter tables reference valid monsters", () => {
    Object.values(ENCOUNTER_TABLES).forEach(table => {
      table.forEach(entry => {
        expect(MONSTERS[entry.monster]).toBeDefined();
      });
    });
  });

  it("monster IDs use camelCase", () => {
    Object.keys(MONSTERS).forEach(id => {
      expect(id).toMatch(/^[a-z][a-zA-Z0-9]*$/);
      expect(id).not.toContain("-");
      expect(id).not.toContain("_");
    });
  });
});
```

### Spell Data Validation
```typescript
import { SPELLS } from "../src/data/spells";

describe("spell data integrity", () => {
  it("healing spells have healing field", () => {
    Object.values(SPELLS).forEach(spell => {
      if (spell.damage) {
        expect(spell.healing).toBeUndefined();
      }
      if (spell.healing) {
        expect(spell.damage).toBeUndefined();
      }
    });
  });

  it("all spells have valid MP costs", () => {
    Object.values(SPELLS).forEach(spell => {
      expect(spell.mpCost).toBeGreaterThan(0);
      expect(spell.mpCost).toBeLessThan(50);
    });
  });

  it("spell unlock levels are reasonable", () => {
    Object.values(SPELLS).forEach(spell => {
      expect(spell.levelRequired).toBeGreaterThanOrEqual(1);
      expect(spell.levelRequired).toBeLessThanOrEqual(20);
    });
  });
});
```

## Test Utilities

### Helper Functions
```typescript
// createPlayer now requires baseStats — never called without them
const defaultStats: PlayerStats = {
  strength: 10, dexterity: 10, constitution: 10,
  intelligence: 10, wisdom: 10, charisma: 10,
};

function createTestPlayer(overrides?: Partial<PlayerState>): PlayerState {
  const player = createPlayer("Test", {
    strength: 10, dexterity: 8, constitution: 12,
    intelligence: 8, wisdom: 8, charisma: 8,
  });
  // Pin stats for deterministic tests
  player.stats = {
    strength: 12, dexterity: 10, constitution: 14,
    intelligence: 10, wisdom: 10, charisma: 8,
  };
  player.maxHp = 30; player.hp = 30;
  player.maxMp = 10; player.mp = 10;
  if (overrides) Object.assign(player, overrides);
  return player;
}
```

### Point Buy Tests
```typescript
import { calculatePointsSpent, isValidPointBuy, POINT_BUY_TOTAL } from "../src/systems/player";

// Standard array costs exactly 27
expect(calculatePointsSpent({ strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 })).toBe(27);

// All 8s costs 0
expect(calculatePointsSpent({ strength: 8, dexterity: 8, constitution: 8, intelligence: 8, wisdom: 8, charisma: 8 })).toBe(0);

// Validates correctly
expect(isValidPointBuy({ strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 })).toBe(true);
expect(isValidPointBuy({ strength: 16, dexterity: 8, constitution: 8, intelligence: 8, wisdom: 8, charisma: 8 })).toBe(false); // >15
```

export function createTestMonster(overrides?: Partial<MonsterInstance>): MonsterInstance {
  return {
    id: "testMonster",
    name: "Test Monster",
    level: 1,
    hp: 10,
    maxHp: 10,
    ac: 10,
    attack: 2,
    damage: "1d6",
    xp: 50,
    gold: 10,
    ...overrides,
  };
}
```

## Running Tests

### Command Line
```bash
# Run all tests once
npm test

# Watch mode (re-run on changes)
npm run test:watch

# Type checking
npm run typecheck

# Run specific test file
npx vitest run tests/dice.test.ts
```

### Test Coverage
```bash
# Generate coverage report
npx vitest run --coverage
```

## Best Practices

1. **Test behavior, not implementation** - Focus on inputs/outputs
2. **Use descriptive test names** - "it calculates X when Y"
3. **Arrange-Act-Assert pattern** - Setup, execute, verify
4. **Avoid magic numbers** - Use named constants
5. **Test edge cases** - Zero, negative, maximum values
6. **Mock randomness when needed** - Make tests deterministic
7. **Keep tests fast** - Avoid delays, network calls
8. **One assertion per test (when possible)** - Makes failures clear

## Common Pitfalls

❌ Testing Phaser objects directly (use pure functions)
❌ Relying on random values without bounds checking
❌ Not testing edge cases (0, negative, null)
❌ Tests that depend on execution order
❌ Overly complex test setup
❌ Not cleaning up state between tests

## Related Files

- Test files: `tests/*.test.ts`
- Vitest config: `vitest.config.ts`
- TypeScript config: `tsconfig.json`

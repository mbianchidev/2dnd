---
name: testing
description: Test 2D&D logic with Vitest and browser flows with Playwright
license: MIT
---

# Testing Guide for 2D&D

Write comprehensive game-mechanics tests with Vitest. Use the committed
Playwright suite only for high-value Phaser browser flows that cannot be proven
through pure logic tests.

## Testing Philosophy

### What TO Test
✅ Dice probability distributions
✅ Combat calculation accuracy  
✅ Group initiative, formation, targeting, synergies, rewards, and encounter budgets
✅ Player stat progression
✅ XP and leveling formulas
✅ Quest objective counters, prerequisites, rewards, gates, danger rules, and
save normalization
✅ Companion definitions, party progression, transfers, KO/reward rules, and
ranked gambit selection/normalization
✅ Data integrity (monsters, spells, items)
✅ Monster family references, membership, variant differentiation, palette
uniqueness, encounter weights, Codex family completion, and texture-key coverage
✅ Codex knowledge IDs, canonical references, every unlock signal, idempotency,
normalization/migration, search/sort/group behavior, and future-hook isolation
✅ Game logic functions
✅ Seeded layouts and persistent state machines
✅ Non-combat skill-check math, outcomes, and save normalization
✅ Scene-transition event ordering, duplicate guards, and watchdog recovery with
mocked camera/time adapters
✅ Cutscene data integrity, trigger priority, queue recovery, replay immutability,
shared preference normalization/migration, and director cleanup
✅ Tutorial content integrity, semantic control references, completion
normalization, progression-aware tip unlocks, and save migration
✅ Defeat penalty receipts, once-only Battle resolution, recovered save
round-trips, result-scene continuation, and random/boss parity
✅ Animation state selection, reduced-motion timing, stable actor/target mapping,
once-only completion and cleanup, and family-frame fallback resolution
✅ Semantic mappings, context priority, analog dead zones, repeats, source
switching, duplicate suppression, disconnect/blur cleanup, and control
preference migration
✅ Alignment boundaries, reputation tiers, clamping, stable-source
idempotency, quest/dialogue/event/trap/combat hooks, shop composition, Codex
milestones, schema-v12 migration, bounded history, and debug commands
✅ Achievement definition integrity, deterministic progress, hidden entries,
idempotent battle/event/social hooks, reconciliation, schema-v13 migration,
one-hit/no-defeat rules, cosmetic titles, debug exclusion, notices, and
authority isolation
✅ Gathering terrain safety, seeded tables, all three state machines,
reduced-motion equivalence, cooldowns, environmental weights, economy, guarded
Battle handoffs, recipe-input isolation, schema-v14 migration, and pending reload
✅ Crafting recipe integrity, alternative material matching, protected/equipped
items, atomic batches, repeated-input suppression, equipment-link upgrades,
ownership, discovery, acquisition tables, anti-arbitrage, achievements, debug
exclusion, authority isolation, schema-v15 migration, and corruption repair

### What NOT to Test  
❌ Phaser rendering/graphics
❌ Scene transitions
❌ User input handling
❌ Visual appearance
❌ Animation timing

These exclusions apply to Vitest. The focused `e2e/` suite owns the real-browser
campaign golden path and scene/input integration.

Animation browser coverage should assert debug-state evidence from real action
menus and combat turns for hero, companion, monster, and boss presentation;
spell/ability particles; world/follower/mount gait; boss cutscenes; fainting;
reduced-motion immediate states; and page/console cleanliness.

Accessibility browser coverage should change settings from both title and
in-game surfaces, assert immediate canvas state, exercise core overlays at every
supported text scale, verify reload persistence, and prove `2dnd_save` is
unchanged by preference updates.

Semantic-controls browser coverage uses mobile/touch emulation and deterministic
standard-gamepad stubs. It covers onboarding and mobile text entry, movement,
overlays, prompt/source switching, Battle action/target confirmation, defeat
recovery, gamepad cursor visibility, portrait/landscape layout, and page/console
cleanliness.

Codex browser coverage follows real exploration, quest, cutscene, item, NPC, and
readable paths; verifies non-blocking feedback, reload persistence, schema-v9
migration, keyboard/touch/gamepad search and filters, 150% text, reduced motion,
and page/console cleanliness.

## Test File Organization

```
tests/
├── dice.test.ts      # Dice rolling utilities
├── combat.test.ts    # Combat mechanics
├── groupCombat.test.ts # Multi-monster combat rules
├── battleActions.test.ts # Pure gambit planning and validation
├── monsterGroups.test.ts # Group templates and generation
├── monsterFamilies.test.ts # Families, variants, Codex derivation, texture keys
├── codexKnowledge.test.ts # World knowledge data, triggers, queries, and hooks
├── partyCombat.test.ts # Stable actor IDs, ally scopes, AI, and result hooks
├── party.test.ts     # Recruitment, progression, transfers, rests, KO/rewards
├── companions.test.ts # Immutable companion definitions and loadouts
├── gambits.test.ts   # Ranked conditions/actions/targets and normalization
├── followers.test.ts # Pure non-blocking follower trail updates
├── player.test.ts    # Player systems
├── traps.test.ts     # Dungeon trap placement, checks, and effects
├── quests.test.ts    # Quest progression and integrity
├── skillChecks.test.ts # Exploration/dialogue checks
├── reputation.test.ts # Alignment, reputation, integrations, and migration policy
├── achievements.test.ts # Definitions, progress, hooks, titles, and migration policy
├── cutscenes.test.ts # Cutscene data, triggers, queue, and director lifecycle
├── accessibility.test.ts # Shared preference normalization, migration, and persistence
├── input.test.ts # Semantic mappings, contexts, repeats, cleanup, and suppression
├── tutorial.test.ts # Tutorial content, completion, and unlocked Tips
├── gathering.test.ts # Gathering data, state machines, rewards, and save rules
├── crafting.test.ts # Recipes, transactions, discovery, economy, and save rules
├── cutsceneSceneTransition.test.ts # Generic Cutscene scene contracts
├── defeatSceneTransition.test.ts # Defeat result continuation contract
├── save.test.ts      # Persistence and migration
└── data.test.ts      # Data validation
```

Quest tests must cover duplicate matching monsters in one group victory,
durable boss reconciliation, optional-objective reward cutoffs, hard-gate
softlock safety, reward idempotency, and flat schema-v4 to nested schema-v5
migration. Map main-quest NPC objectives to live city IDs and require exact
coverage of all 12 cities with stable stage/objective identities.

Tutorial tests must keep Phaser out of pure logic. Assert stable unique IDs,
valid semantic control references, idempotent completion, safe malformed-state
normalization, and exact progression-aware tip unlock sets. The committed
Playwright flow owns automatic presentation, pointer navigation, persisted
completion, `F1`, and Esc-menu access.

## Skill Check Testing

- Pass explicit natural d20 values to `resolveSkillCheck()`; do not depend on
  randomness.
- Verify total-vs-DC behavior, including that natural 1/20 are not automatic.
- Test shop discounts for both successful and failed saved choices.
- Validate NPC identities and chest metadata against live city/map data.
- Test terrain event selection with explicit random values.
- Cover reward bounds, nonlethal damage, save round trips, missing fields, and
  malformed record repair.

## Cutscene Testing

- Validate every stable ID, trigger reference, boss mapping, and completion
  metadata without rendering Phaser.
- Compare immutable before/after snapshots and assert exact simultaneous-trigger
  priority.
- Test that queueing precedes presentation, completion/skip moves pending to
  seen, reload resumes pending, and replay leaves both collections unchanged.
- Cover malformed pending IDs, already-seen pending entries, and completed
  legacy epilogue recovery.
- Keep generic `CutsceneScene` transition payload tests separate from the
  Playwright visual/input flow.

## Companion Testing

- Use deterministic companion creation at explicit hero levels; verify
  independent inventory objects and level-tier loadouts.
- Test quest completion replay, reload, debug completion, and repeated replay
  against the same unique recruited-ID guard.
- Parameterize those paths across Guardian, Scout, and Mystic; one companion
  path is not representative coverage.
- Construct `BattleActionSource`/`PartyCombatant` adapters and verify HP/MP
  writes reach the underlying companion state.
- Test gambits as pure rank/condition/target selection. Invalid rules must not
  mutate action economy, MP, inventory, or effects.
- Cover living-vs-KO XP distribution, level-1 XP floor, party wipe recovery,
  exact defeat receipts, and party-wide inn rest.
- Keep a focused Battle transition regression that asserts fade-complete
  ordering, one-shot scene start, transient cleanup, the full Overworld payload,
  and once-only DefeatScene routing for random and boss encounters without
  rendering Phaser UI.
- Keep Phaser visuals in headless Chromium flows; pure trail positioning and UI
  mutation helpers belong in Vitest.

## Inventory Testing

- Test type/value/rarity/recent/name selectors without mutating canonical order
  or equipment links.
- Cover equipment, consumable, quest, and future crafting filters plus search.
- Normalize and persist `2dnd_inventory_prefs` separately from `2dnd_save`.
- Assert equipped, key-item, mount, and duplicate-item transfer restrictions.
- Use focused Playwright coverage for large-bag keyboard/pointer paging,
  selection stability, search, and menu access.

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

# Install Chromium once, then run the campaign browser suite
npm run test:browser:install
npm run test:browser

# Watch mode (re-run on changes)
npm run test:watch

# Type checking
npm run typecheck

# Run specific test file
npx vitest run tests/dice.test.ts
```

## Browser Golden Path

- `playwright.config.ts` starts Vite on an unused strict localhost port.
- Browser tests default to `/2dnd/`; set `PLAYWRIGHT_BASE_PATH=/` to reproduce
  the root-base development path.
- Pull request CI installs Chromium and runs the browser suite as a release
  gate.
- Keep trace action logs, DOM snapshots, sources, and failure screenshots, but
  disable trace screenshots and video. Phaser repaints every frame, so the
  filmstrip creates thousands of canvas captures that stall context teardown.
- Use `#debug-state`, `#debug-log`, and persisted save state as authoritative
  synchronization surfaces. Canvas text is not DOM text.
- Hold frame-polled keys with `keyboard.down()`, wait across frames, then
  `keyboard.up()`. Do not use instantaneous presses for Overworld or Ending
  actions.
- Seed randomness before the game loads and assert both `pageerror` and
  `console.error` remain empty.
- Cover random and boss defeat results, exact displayed penalties, clean
  continuation, and recovered save/reload state through the production
  `/defeat` debug path.
- Debug commands may accelerate setup, but the final Elowen interaction and
  other behavior under test must still run through their production paths.
- Cover interrupted opening recovery, dungeon reveals, skipped boss
  introductions, aftermath chaining, Chronicle replay immutability, interrupted
  and legacy ending recovery, durable post-game reload, and corrupt-save
  fallback to a usable New Game path.

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
9. **Inject group RNG** - Initiative, weighted generation, and random-two
   targeting helpers accept deterministic random functions

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

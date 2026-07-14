---
name: dnd-mechanics
description: Implement 2D&D's D&D 5E-inspired stats, combat, elements, and statuses correctly
license: MIT
---

# D&D-Inspired Mechanics

2D&D adapts D&D 5E concepts to a single-player JRPG. Follow the implemented
rules in `src/systems/` when they intentionally differ from tabletop rules.

## Ability scores

The six scores are Strength, Dexterity, Constitution, Intelligence, Wisdom,
and Charisma.

```typescript
abilityModifier(score) === Math.floor((score - 10) / 2);
```

Character creation supports:

- 27-point buy
- Base score range 8-15
- Costs: 8/0, 9/1, 10/2, 11/3, 12/4, 13/5, 14/7, 15/9
- Optional 4d6-drop-lowest generation
- Class boosts applied after base scores

## Classes

| Class | Boosts | Primary stat |
| --- | --- | --- |
| Knight | STR +2, CON +1 | STR |
| Ranger | DEX +2, WIS +1 | DEX |
| Wizard | INT +2, WIS +1 | INT |
| Sorcerer | CHA +2, CON +1 | CHA |
| Rogue | DEX +2, CHA +1 | DEX |
| Paladin | STR +1, CHA +2 | CHA |
| Warlock | CHA +2, INT +1 | CHA |
| Cleric | WIS +2, CON +1 | WIS |
| Druid | WIS +2, CON +1 | WIS |
| Barbarian | STR +2, CON +1 | STR |
| Monk | DEX +2, WIS +1 | DEX |
| Bard | CHA +2, DEX +1 | CHA |

The class `primaryStat` is used for attack/to-hit calculations where the
specific action does not override the stat.

## Non-combat ability checks

Use `src/systems/skillChecks.ts` for exploration and dialogue checks:

```typescript
total = naturalD20 + abilityModifier(player.stats[ability]);
success = total >= dc;
```

- Dexterity: lockpicking, trap disarming, and escaping hazards
- Wisdom: hidden loot, paths, passages, and exploration events
- Charisma: Persuade/Bluff NPC outcomes and shop negotiation
- Natural 1 and 20 do not automatically fail or succeed on these checks
- Fixed outcomes are one-time and persist in
  `player.progression.skillChecks`
- Exploration damage is nonlethal and cannot reduce the player below 1 HP

## Core combat

- Attack rolls use d20 + ability modifier + proficiency/bonuses.
- Natural 20 automatically hits and is critical.
- Natural 1 automatically misses.
- Initiative uses d20 + Dexterity modifier.
- Spells consume MP rather than spell slots.
- Armor Class comes from base AC, Dexterity, equipment, talents, active
  statuses, and temporary defense bonuses.
- Group initiative rolls once for the player and once per monster, then
  interleaves all actors by total using stable combatant IDs. Companion actors
  use the same initiative contract.
- Melee must clear the front row before attacking the back row. Once exposed,
  back-row melee targets impose -2 to the attack roll; ranged attacks and
  spells ignore this formation penalty.

Use the combat functions in `src/systems/combat.ts`; do not reimplement formulas
inside scenes.

## Advantage and disadvantage

Roll two d20s and select the higher/lower natural roll before adding modifiers.
Natural 1 and natural 20 behavior must be based on the selected die, not the
first die rolled.

Poisoned, Frightened, and Prone currently impose attack disadvantage. Magic
Missile is auto-hit and bypasses attack-roll disadvantage.
AoE spells pay MP once and share one attack/damage roll, while elemental
resistance, weakness, and immunity resolve independently per target.
Healing target scopes are explicit: self, one ally, all allies, or the whole
party. A single-ally action falls back to self when no ally is present.

## Elements

`src/data/elements.ts` defines:

- Fire
- Ice
- Lightning
- Poison
- Necrotic
- Radiant
- Thunder
- Force
- Psychic

Elemental profile order is:

1. Immunity: damage becomes 0.
2. Weakness: damage is doubled.
3. Resistance: damage is floored after halving.
4. Otherwise unchanged.

Status damage modifiers are applied before the elemental modifier. Record
observed non-neutral interactions in the Codex.

## Status effects

`src/systems/statusEffects.ts` is the single source of truth.

Debuffs:

- Poisoned: turn damage and attack disadvantage
- Burning: fire damage each turn
- Frozen: reduced accuracy and AC
- Paralyzed: skipped turns and reduced AC
- Stunned: one skipped turn
- Frightened: attack disadvantage and reduced damage
- Slowed: reduced accuracy and damage
- Prone: attack disadvantage and reduced AC
- Asleep: skipped turns until save/expiration
- Confused: reduced accuracy

Buffs:

- Enraged: increased damage and reduced AC
- Hasted: increased accuracy and AC
- Raging: increased damage
- Sneak Stance: increased AC

Lifecycle for each actor:

1. Start turn: resolve tick damage, allowed saving throws, and skip-turn state.
2. Perform or skip the action.
3. End turn: decrement duration and expire effects.

A one-turn stun therefore skips exactly one actor turn. Cure items remove only
matching effects. Combat effects are cleared when leaving Battle.

## Dungeon trap checks

- Detection and disarming use d20 + the configured Dexterity or Intelligence
  modifier through `resolveSkillCheck()` / `rollSkillCheck()` with a validated
  situational modifier.
- Trap Kits, Natural Explorer, Cunning Action, and persistent Adventurer
  guidance add their defined bonuses; Danger Sense detects automatically.
- Failed detection persists in authoritative `trapStates`, so checks cannot be
  farmed by stepping away or reloading.
- Successful disarming awards XP through `awardXP()`.
- Trigger damage and MP loss apply immediately and cannot reduce HP below 1.
  Trap-applied statuses seed the next battle and then follow the existing
  combat-turn lifecycle.
- Alarm traps replace the normal encounter roll with a forced dungeon
  encounter. Hidden floors use the next level's validated spawn.

## Action economy

- Attack, spell, defend, flee, and normal abilities consume the action.
- Bonus-action abilities do not schedule the monster turn.
- The first item use in a turn is a bonus action.
- Invalid spell/ability/item choices must not consume MP, inventory, or turn
  state.
- Gambit and UI actions pass through `validateBattleAction()` before execution;
  validated plans bind stable actor/target IDs and declare action or bonus
  action cost.
- `BattleActionEconomyState` tracks one action and one bonus action per actor;
  consuming a bonus action leaves the main action available for lower-ranked
  gambits.
- Generic outbound actors execute validated plans through the same d20, AC,
  element, status, healing, MP, inventory, and defend paths as the hero.
- Battle consumables use item-declared target scopes. Ally items fall back to
  self when solo, self-only items remain self, and inventory ownership stays
  separate from the effect target.
- Flee DC is 10 for one monster and increases by 2 for each additional living
  monster. Boss encounters cannot be fled.

## Leveling

- Proficiency increases at levels 5, 9, 13, and 17.
- Ability score improvements occur at levels 4, 8, 12, 16, and 19.
- Pending level gains are applied by the existing rest/level processing logic.
- Class hit dice and unlock tables are defined in `src/systems/classes.ts`.

## Testing

Use deterministic dice mocks for:

- Natural 1/20 and two-d20 selection
- Status saving throws, ticks, skips, and expiration
- Elemental immunity/weakness/resistance
- Status plus elemental damage ordering
- Bonus-action scheduling
- MP and inventory consumption on invalid actions
- Seeded trap placement, one-shot checks, modifiers, nonlethal consequences,
 alarm suppression, and hidden-floor destinations
- Ability modifiers, DC boundaries, persistent negotiation choices, and
 nonlethal exploration damage

Relevant suites include `combat.test.ts`, `dice.test.ts`, `elements.test.ts`,
`statusEffects.test.ts`, `skillChecks.test.ts`, `player.test.ts`, and
`traps.test.ts`.

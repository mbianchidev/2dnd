# 2D&D Project Instructions

Keep this file, the repository skills, and `README.md` synchronized with game
design, architecture, tooling, and persistent data changes.

If a utility script is required, place it in `hacks/`, document it in
`hacks/instructions.md`, and remove temporary utilities when the task is done.
Do not add planning or summary Markdown files to the repository.

No source file should exceed 1,000 lines without considering extraction into a
focused module.

## Project

2D&D is a browser JRPG combining Dragon Quest-style exploration with
D&D 5E-inspired combat. It has turn-based battles, point-buy characters,
procedural graphics/audio, weather, day/night, a 90-chunk world, connected city
districts, multi-level dungeons, non-combat skill checks, elemental
interactions, status effects, and boss fights.

## Stack

- Phaser 4.2.1
- TypeScript 7.0.2 in strict mode
- Vite 8.1.4
- Vitest 4.1.10
- happy-dom 20.10.6
- Modern browsers, ES2020 target

## Structure

```text
src/
├── main.ts
├── config.ts
├── scenes/
│   ├── Boot.ts
│   ├── Overworld.ts
│   ├── Battle.ts
│   ├── Shop.ts
│   └── Codex.ts
├── systems/
│   ├── combat.ts
│   ├── groupCombat.ts
│   ├── battleActions.ts
│   ├── statusEffects.ts
│   ├── player.ts
│   ├── save.ts
│   ├── classes.ts
│   ├── codex.ts
│   ├── movement.ts
│   ├── dice.ts
│   ├── skillChecks.ts
│   ├── daynight.ts
│   ├── weather.ts
│   ├── audio.ts
│   └── debug.ts
├── data/
│   ├── map.ts
│   ├── mapTypes.ts
│   ├── chunks.ts
│   ├── cities.ts
│   ├── dungeons.ts
│   ├── monsters.ts
│   ├── monsterGroups.ts
│   ├── elements.ts
│   ├── spells.ts
│   ├── abilities.ts
│   ├── items.ts
│   ├── mounts.ts
│   ├── npcs.ts
│   ├── skillChecks.ts
│   └── talents.ts
├── managers/
├── renderers/
└── utils/

tests/
├── combat.test.ts
├── groupCombat.test.ts
├── battleActions.test.ts
├── partyCombat.test.ts
├── monsterGroups.test.ts
├── encounter.test.ts
├── targeting.test.ts
├── elements.test.ts
├── statusEffects.test.ts
├── save.test.ts
├── data.test.ts
├── fogOfWar.test.ts
└── ...
```

`src/data/map.ts` is the map hub. Shared map types/dimensions, world chunks,
cities, and dungeons are split into their own modules. Overworld delegates
rendering and scene-owned state to `renderers/` and `managers/`.

## TypeScript and style

- Use strict TypeScript and explicit parameter/return types.
- Prefer interfaces for object shapes; use type aliases for unions and
  intersections.
- Use `import type` for type-only imports.
- Prefer `const`, optional chaining, and nullish coalescing.
- Do not use `any`; use proper types, guards, or `unknown`.
- Use 2-space indentation and reasonable line lengths.
- Use camelCase for files in systems/data and PascalCase for scene files.
- Use camelCase for values/functions/entity IDs, PascalCase for types, and
  UPPER_SNAKE_CASE for constants.
- Add JSDoc for public APIs or non-obvious mechanics; avoid redundant comments.
- Keep imports ordered external, internal, then type-only where practical.
- Reuse existing helpers before adding parallel logic.

## Phaser 4 patterns

- Import Phaser with `import * as Phaser from "phaser"`.
- Scene keys are `BootScene`, `OverworldScene`, `BattleScene`, `ShopScene`, and
  `CodexScene`.
- Store scene input in `init()` and reset scene-specific transient state there.
- State-bearing transitions preserve:

```typescript
{
  player,
  defeatedBosses,
  codex,
  timeStep,
  weatherState,
  savedSpecialNpcs,
}
```

- Battle also receives a `MonsterEncounter` and `biome`; Shop receives
  shop/city context.
- Battle may also receive accessor-backed `partyCombatants` and runtime-only
  `battleHooks`; these are scene contracts, not persisted save fields.
- Generate textures in `src/renderers/textures.ts`, invoked by Boot.
- Synthesize all audio in `src/systems/audio.ts`.
- Store Phaser object references needed for later update/cleanup.
- Calculate actual scaled UI bounds to prevent overlap.
- Default game zoom is 6.
- Do not use geometry masks for the Battle log. Render the bounded visible
  message window and scroll by message offset.

## Player state

Core stats remain flat. Location and progression use composition:

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
}
```

Access fields through `player.position` and `player.progression`.
`player.activeEffects` stores normalized combat effects.

## Quests

- Definitions, stages, rewards, named NPC IDs, and gated entrances live in
  `src/data/quests.ts`.
- Runtime progression, normalization, rewards, NPC resolution, journal data,
  and gate checks live in `src/systems/quests.ts`.
- `player.progression.quests` is required persistent state. Mutate it through
  quest-system APIs so completion rewards remain idempotent.
- Downstream systems such as companion recruitment query `isQuestCompleted()`
  and persist their own unlock state.
- Generic completion actions use stable `{ id, type, targetId }` definitions.
  Replay them with `getQuestCompletionActions()` or
  `replayQuestCompletionActions()`; consumers own idempotency.
- Quest stages have stable camelCase `id` values. Resolve them through
  `getQuestStageIndex()` or `setQuestStageById()` rather than titles.
- Boss objectives derive from `defeatedBosses`; do not rely only on a new battle
  event because existing saves may already contain the required defeat.
- Quest NPCs remain available at night. `Q` opens the quest journal.
- Ashfall and the Volcanic Forge use quest-controlled entrance barricades;
  Sandport and the Heartlands Crypt must remain reachable to avoid softlocks.

## Character creation

Flow:

**Name -> Class -> Stats -> Appearance -> Adventure**

- Point buy: 27 points, scores 8-15
- Costs: 8/0, 9/1, 10/2, 11/3, 12/4, 13/5, 14/7, 15/9
- Random mode: 4d6 drop lowest with rerolls
- Class boosts apply after base stats
- `createPlayer(name, baseStats, appearanceId, customAppearance)` does not roll
  stats internally

### Classes

| Class | Boosts | Primary |
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

## Combat

- Attack rolls, saves, and checks use d20.
- Natural 20 on an attack is a critical hit; natural 1 automatically misses.
- Initiative is d20 + Dexterity modifier.
- Spells use MP.
- Disabled actions are visibly dimmed outside the player turn.
- Items and designated bonus-action abilities do not end the player turn when
  the bonus action is still available.
- Validate actions before consuming MP, inventory, or turn state.
- Random battles contain 1-4 combatants. Each monster owns HP, effects, defend
  state, AC discovery, drops, and elemental discoveries.
- `BattleCombatantState` is the shared actor contract: stable ID, party/enemy
  side, hero/companion/monster kind, formation, HP, alive/KO, defend, and
  effects. Hero state must remain accessor-backed by `PlayerState`.
- Initiative interleaves the player with every living monster. Player Defend
  lasts until the next player turn and protects against all intervening turns.
- Initiative entries store `combatantId`, never player/monster array indices.
- Target scopes include enemy single/all/rows, self, single/all allies, and the
  whole party. Healing entries declare scope explicitly; do not infer every
  heal as self-only.
- Monsters choose among living, conscious party combatants. Generic monster
  attack/ability APIs accept `MonsterAttackTarget`; PlayerState wrappers remain
  only for compatibility.
- `BattleResolutionHooks` exposes reward adjustment, enemy-defeat,
  companion-turn, and once-only battle-result callbacks.
- Ranked AI/gambits use `src/systems/battleActions.ts`: enumerate living actors,
  resolve a scope with an optional preferred/matched ID, validate resources and
  per-actor action economy, then execute and consume one frozen
  `BattleActionPlan`. A bonus action may be followed by one main action. KO
  actors are omitted before initiative. Do not duplicate these rules inside
  scenes or companion AI.
- Outbound actors bind a generic `CombatActorState` to a `PartyCombatant`
  through `BattleActionSource`. Execute validated attack/spell/ability/item/
  defend plans with `executeValidatedBattleAction()`; do not bypass combat,
  item, elemental-discovery, or target-state helpers.
- Consumable descriptors use canonical item target metadata with preferred
  stable target IDs and solo self fallback; self-only items remain self.
  Consume the acting source's inventory, but apply HP/MP/cure effects through
  the selected target's action source.
  `BattleActionExecutionContext.sources` is required in every execution
  context. Equipment remains self-only.
- Melee attacks must clear living front-row monsters before targeting the back
  row; exposed back-row melee targets impose a -2 attack penalty. Ranged
  attacks and spells bypass formation protection.
- Spells and abilities use `TargetType`. AoE spells consume MP once, roll once,
  and apply elemental modifiers independently to each living target.
- Group flee DC is `10 + (aliveCount - 1) * 2`. Group XP and gold are the
  floored member totals multiplied by 0.85; drops and Codex defeats resolve per
  monster.

For disadvantage, roll two d20s and select the lower natural roll before
checking natural 1/20 and adding modifiers. Magic Missile remains auto-hit.

### Non-combat skill checks

- Resolve checks through `src/systems/skillChecks.ts`; definitions belong in
  `src/data/skillChecks.ts`, and Overworld orchestration belongs in
  `src/managers/skillChecks.ts`.
- Checks use d20 + the selected Dexterity, Wisdom, or Charisma modifier against
  a DC. Natural 1 and 20 do not automatically fail or succeed.
- Charisma drives Persuade/Bluff NPC outcomes and one-attempt-per-shop
  negotiations. Shop IDs use city/district/type/coordinates, not array indexes.
- Wisdom drives hidden loot, secret passages, and exploration discoveries.
- Dexterity drives hazards, lockpicking, and trap disarming. Exploration damage
  is nonlethal and must leave the player at 1 HP or more.
- Persist fixed outcomes in `player.progression.skillChecks`; repeatable terrain
  events are not stored as one-time checks.

### Elements

Nine supported elements:

Fire, Ice, Lightning, Poison, Necrotic, Radiant, Thunder, Force, Psychic.

- Immunity: 0 damage
- Weakness: double damage
- Resistance: floor of half damage

Apply status damage modifiers before elemental modifiers. Record observed
non-neutral interactions through `discoverElement()` for Codex persistence.

### Status effects

Definitions and lifecycle live only in `src/systems/statusEffects.ts`.

Effects:

Poison, Burn, Freeze, Paralysis, Stunned, Frightened, Slow, Prone, Asleep,
Confused, Enraged, Haste, Rage, and Sneak Stance.

Actor lifecycle:

1. Start turn: tick damage, saving throws, skip-turn decision.
2. Perform or skip the action.
3. End turn: decrement duration and expire effects.

A one-turn stun skips exactly one turn. Cure items remove matching effects.
Player and monster effects are cleared when leaving Battle because durations
use combat turns rather than overworld time.

## World and map

- World grid: 10x9 chunks
- Chunk/interior dimensions: 20x15
- Tile size: 32x32
- Map access is row-major: `[y][x]`
- Terrain additions:
  - `CityGate = 41`
  - `DungeonStairs = 42`
  - `DungeonBoss = 43`

Always use `isWalkable()`, encounter rates, and map helpers.
Stack terrain, day/night, weather, and mount encounter modifiers through
`getEffectiveEncounterRate()` so random encounters never exceed 15%.

### Cities

There are 12 cities. Logical city chunk 0 uses `CityData.mapData`; optional
`city.chunks` stores additional districts beginning at logical index 1.
Use `getCityChunk*()` and `getCityConnectionAt()` helpers. Connections update
`player.position.cityChunkIndex` and destination coordinates.

### Dungeons

There are three multi-level dungeons. Level 0 uses `DungeonData.mapData`;
`levels[0]` is logical level 1. Use `getDungeonLevel*()` and
`getDungeonConnectionAt()` helpers. Model ascent and descent explicitly.
Deepest floors contain a `DungeonBoss` tile and unique boss.

### Fog keys

- Overworld: `chunkX,chunkY,x,y`
- Dungeon level 0: `d:id,x,y`
- Deeper dungeon: `d:id,level,x,y`
- City chunk 0: `c:id,x,y`
- Other district: `c:id,chunk,x,y`

Use `FogOfWar.exploredKey()`; level/chunk zero formats preserve existing saves.

## Save system

Save schema version is 4.

`loadGame()` treats parsed data as `unknown`, migrates legacy flat position and
progression fields, normalizes active effects, Codex elements, and skill-check
records, validates city/dungeon IDs and quest state, clamps levels/districts,
repairs invalid coordinates to the correct spawn, and falls back to Willowdale
for unusable overworld locations. Schema-v3 skill-check saves migrate to v4 by
adding normalized quest state without changing existing check records.

When persistent data changes:

1. Update its interface and creation default.
2. Add runtime normalization and cross-field validation.
3. Increment the schema version when the shape changes.
4. Add migration/corruption tests.
5. Update README, instructions, and relevant skills.

## Day/night and weather

- 360-step cycle
- Dawn: 0-44
- Day: 45-219
- Dusk: 220-264
- Night: 265-359
- One step per player movement
- Six weather types: Clear, Rain, Snow, Sandstorm, Storm, Fog
- Weather affects encounters, accuracy, monsters, particles, and audio
- Dungeons force clear weather

## Audio

All music and SFX use Web Audio synthesis. Initialize from a user gesture.
Volume preferences for Master, Music, SFX, and Dialog persist separately.
Do not add external audio.

## Debug

- Use `isDebug()`, `debugLog()`, and debug panel APIs.
- Never add production `console.log`.
- `/spawn` resolves every entry in `ALL_MONSTERS`, including dungeon-specific
  monsters and bosses.
- `/quest` lists, advances, or sets exact quest stages/statuses.
- Shared debug commands and Overworld-specific commands live in
  `src/systems/debug.ts`.

## Commands

```bash
npm run dev
npm run typecheck
npm test
npm run test:watch
npm run build
```

## Testing

- Framework: Vitest
- Files: `tests/*.test.ts`
- Add deterministic tests for mechanics and migrations.
- Use headless Chromium for changed frontend flows.
- Run typecheck, full tests, and build before completion.

## Prohibited

- External image or audio assets
- Network calls
- `any`
- Production `console.log`
- Runtime mutation of shared game data
- Hardcoded terrain behavior that bypasses helpers
- Incomplete scene-state transitions
- Silent failure paths
- Force-pushing or rewriting Git history

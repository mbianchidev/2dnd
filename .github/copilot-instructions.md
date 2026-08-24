# 2D&D Project Instructions

Read `AGENTS.md` for the operational workflow and `docs/README.md` for detailed
topic ownership. Keep this file, `AGENTS.md`, the repository skills, and the
relevant docs synchronized with game design, architecture, tooling, and
persistent data changes.

If a utility script is required, place it in `hacks/`, document it in
`hacks/instructions.md`, and remove temporary utilities when the task is done.
Do not add planning or summary Markdown files to the repository.

No source file should exceed 1,000 lines without considering extraction into a
focused module.

## Project

2D&D is a browser and Electron JRPG combining Dragon Quest-style exploration
with D&D 5E-inspired combat. It has turn-based battles, point-buy characters,
procedural graphics/audio, weather, day/night, a 90-chunk world, connected city
districts, multi-level dungeons, procedural traps, non-combat skill checks,
quest-recruited companions, ranked gambits, elemental interactions, status
effects, boss fights, and a replayable campaign epilogue with post-game
continuation, plus deterministic fishing, mining, and foraging minigames.

## Stack

- Phaser 4.2.1
- TypeScript 7.0.2 in strict mode
- Vite 8.2.1
- Vitest 4.1.10
- Playwright 1.62.1
- happy-dom 20.11.1
- Electron 43.4.0
- electron-builder 26.15.7
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
│   ├── Codex.ts
│   ├── Cutscene.ts
│   ├── Ending.ts
│   └── Defeat.ts
├── systems/
│   ├── combat.ts
│   ├── groupCombat.ts
│   ├── battleActions.ts
│   ├── animation.ts
│   ├── party.ts
│   ├── gambits.ts
│   ├── statusEffects.ts
│   ├── player.ts
│   ├── save.ts
│   ├── classes.ts
│   ├── codex.ts
│   ├── movement.ts
│   ├── traps.ts
│   ├── trapAudio.ts
│   ├── dice.ts
│   ├── skillChecks.ts
│   ├── daynight.ts
│   ├── weather.ts
│   ├── audio.ts
│   ├── quests.ts
│   ├── questState.ts
│   ├── questDebug.ts
│   ├── worldEvents.ts
│   ├── gathering.ts
│   ├── gatheringState.ts
│   ├── crafting.ts
│   ├── craftingState.ts
│   ├── accessibility.ts
│   ├── input.ts
│   ├── tutorial.ts
│   ├── sceneState.ts
│   ├── cutscenes.ts
│   └── debug.ts
├── data/
│   ├── map.ts
│   ├── mapTypes.ts
│   ├── chunks.ts
│   ├── cities.ts
│   ├── dungeons.ts
│   ├── traps.ts
│   ├── trapTypes.ts
│   ├── monsters.ts
│   ├── monsterFamilies.ts
│   ├── monsterVariants.ts
│   ├── nightMonsters.ts
│   ├── monsterGroups.ts
│   ├── codexKnowledge.ts
│   ├── elements.ts
│   ├── spells.ts
│   ├── abilities.ts
│   ├── items.ts
│   ├── companions.ts
│   ├── mounts.ts
│   ├── npcs.ts
│   ├── quests.ts
│   ├── cutsceneTypes.ts
│   ├── cutsceneCampaign.ts
│   ├── cutsceneBosses.ts
│   ├── cutscenes.ts
│   ├── skillChecks.ts
│   ├── worldEvents.ts
│   ├── gathering.ts
│   ├── crafting.ts
│   ├── tutorial.ts
│   └── talents.ts
├── managers/
│   ├── actorAnimation.ts
│   ├── input.ts
│   ├── codexDiscovery.ts
│   ├── battlePresentation.ts
│   ├── worldPresentation.ts
│   ├── questJournal.ts
│   ├── questFlow.ts
│   ├── chronicle.ts
│   ├── worldEvents.ts
│   ├── gathering.ts
│   ├── crafting.ts
│   ├── tutorial.ts
│   └── cutscene.ts
├── renderers/
│   ├── actorTextures.ts
│   ├── cutscene.ts
│   ├── settings.ts
│   └── result.ts
└── utils/

tests/
├── combat.test.ts
├── groupCombat.test.ts
├── battleActions.test.ts
├── animation.test.ts
├── actorTextures.test.ts
├── partyCombat.test.ts
├── party.test.ts
├── companions.test.ts
├── gambits.test.ts
├── followers.test.ts
├── monsterGroups.test.ts
├── encounter.test.ts
├── targeting.test.ts
├── elements.test.ts
├── statusEffects.test.ts
├── save.test.ts
├── cutscenes.test.ts
├── data.test.ts
├── fogOfWar.test.ts
└── ...
```

`src/data/map.ts` is the map hub. Shared map types/dimensions, world chunks,
cities, and dungeons are split into their own modules. Overworld delegates
rendering and scene-owned state to `renderers/` and `managers/`.
The secure desktop boundary lives in `electron/`, with production-like
Playwright coverage in `electron-tests/`. The renderer remains browser-safe and
loads from `app://2dnd` in packaged builds.

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
- Scene keys are `BootScene`, `OverworldScene`, `BattleScene`, `ShopScene`,
  `CodexScene`, `CutsceneScene`, `EndingScene`, and `DefeatScene`.
- Store scene input in `init()` and reset scene-specific transient state there.
- Build state-bearing transition payloads with `createSharedSceneState()` so
  they preserve:

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
- Cutscene receives the full shared state plus a stable `CutsceneId`, replay
  mode, return scene, and optional runtime-only quest updates. Ending receives
  the full shared state plus the epilogue ID. Continue Post-game returns that
  state to Overworld, while Return to Title saves before starting Boot.
- Defeat receives the full shared state plus the encounter name/type and an
  exact runtime-only `PartyDefeatResult`. It never reapplies the penalty and
  only offers continuation through the existing town recovery state.
- Battle may also receive accessor-backed `partyCombatants` and runtime-only
  `battleHooks`; these are scene contracts, not persisted save fields.
- Persistent companions live inside `player.party`, so every existing
  state-bearing transition carries them through the same `player` object.
- Route fades and scene `start()`/`restart()` handoffs through
  `SceneTransitionManager`. Restore the outgoing camera before queueing the
  next scene, reject duplicate queued handoffs, and call `prepare()` at the
  start of every scene `create()`.
- Fade-complete events are authoritative. The manager's duration-plus-grace
  watchdog is recovery-only; never use an equal-duration timer as the primary
  handoff trigger. Remove completed listeners and watchdog timers explicitly.
- Phaser scene operations are queued until the next Scene Manager update.
  Block state-changing input while a handoff is pending, and keep Overworld
  restarts on the shared full-state payload including `savedSpecialNpcs`.
- Generate textures through `src/renderers/textures.ts`, invoked by Boot.
  Monster silhouettes live in the focused `monsterTextures.ts` renderer.
- Resolve hero visuals from live `PlayerState` through
  `src/systems/heroVisuals.ts` and lease generated textures through
  `src/renderers/heroTextures.ts`. Overworld, Battle, Cutscene, and hero-bearing
  Ending steps share this pipeline. Cutscene data stores stable hero roles and
  staging only; never store generic hero colors or appearance snapshots.
- Battle backdrop geometry is scene-sized procedural rendering owned by
  `src/renderers/battleBackdrop.ts`. Use the typed bands in `battleDepth.ts`;
  never bake sky and scenery into one opaque layer or introduce scene-local
  magic depths.
- Keep actor animation contracts in `src/systems/animation.ts`, generic Phaser
  pose/tween ownership in `src/managers/actorAnimation.ts`, and scene-specific
  orchestration in focused battle/world directors. Presentation reads stable
  actor IDs and resolved outcomes; it never mutates combat or quest state.
- Build `ActorTextureFamily` metadata with explicit frame keys. Optional
  monster-family art supplies stable `monster-<id>-<normal|boss>-<state>` frames;
  existing idle textures retain a transform-based fallback without hardcoded
  monster IDs.
- Synthesize all audio in `src/systems/audio.ts`.
- Store Phaser object references needed for later update/cleanup.
- Calculate actual scaled UI bounds to prevent overlap.
- Default game zoom is 6.
- Do not use geometry masks for the Battle log. Render the bounded visible
  message window and scroll by message offset.
- Keep Battle ordering as sky/stars/celestial/clouds, distant scenery, ground
  and props, actor shadows, back/front actors, action particles, front weather,
  UI, then debug/transition overlays. Backdrop cleanup owns its emitters,
  lightning timers, inspection labels, and containers.

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
  seenCutsceneIds: CutsceneId[];
  pendingCutsceneIds: CutsceneId[];
  skillChecks: Record<string, SkillCheckRecord>;
  trapSeed: number;
  trapStates: Record<string, TrapState>;
  trapGuidance: boolean;
  tutorial: TutorialProgress;
  worldEvents: WorldEventState;
  social: SocialState;
  achievements: AchievementState;
  gathering: GatheringState;
  crafting: CraftingState;
  nautical: NauticalState;
  discoveredFeatureIds: FeatureId[];
  pendingFeatureRevealIds: FeatureId[];
  debugDiscoveredFeatureIds: FeatureId[];
  debugSuppressedFeatureIds: FeatureId[];
}
```

Access fields through `player.position` and `player.progression`.
`player.activeEffects` stores normalized combat effects.
`player.party` stores unique recruited companion states and up to three active
companion IDs. Companion state composes `CombatActorState` plus independent XP,
level-up/stat state, control mode, dialogue cursor, and normalized gambits.
`player.progression.tutorial.completed` records whether the new-player tutorial
was completed or skipped.

## Feature discovery

- Stable feature IDs, display metadata, ownership, prerequisites, and test IDs
  live in `src/data/featureDiscovery.ts`; reconciliation, filtering, reveal
  queues, action gating, and debug commands live in
  `src/systems/featureDiscovery.ts`.
- Resume/cancel, Inventory, Map, Equipment, Tips, Settings/accessibility, and
  save/title controls remain available for safety.
- Quest, Chronicle, Codex/category, natural Achievement, Crafting/category,
  Gathering/discipline, World Event, social, Party/gambit, mount, harbor, route,
  and boat surfaces reveal only after authoritative gameplay evidence.
- Build menus and tabs from filtered definitions. Hidden entries must leave no
  blank row, stale index, invisible hit area, separator, shortcut, touch action,
  or gamepad gap. Inventory remains independent from Party discovery.
- Persist discovery only to preserve irreversible visibility and one-time
  feedback. It never controls quests, companions, rewards, Codex, achievements,
  recipes, social state, navigation, or endings.
- Reconcile mature saves silently. Natural reveals queue accessible,
  non-blocking Overworld feedback; explicit debug reveals are marked and debug
  mutations are excluded from natural discovery.

## Tutorial and tips

- Immutable tutorial steps, semantic control actions, Tips content, categories,
  and progression unlock requirements live in `src/data/tutorial.ts`.
- Pure completion normalization and tip filtering live in
  `src/systems/tutorial.ts`; Phaser presentation and keyboard/pointer navigation
  live in `src/managers/tutorial.ts`.
- New saves open the five-step tutorial after pending opening cutscenes.
  Completing or skipping it persists completion and prevents automatic replay.
- `F1` opens Tips directly. The Esc menu also opens Tips and can replay the
  tutorial without changing completion state.
- Advanced tips unlock from level, companion, mount, dungeon, skill-check, and
  trap progression. Do not duplicate those conditions in UI code.
- The external HTML control rail remains keyboard accessible but starts
  collapsed; do not restore persistent control clutter when equivalent guidance
  is available through Tips.

## Companions and gambits

- Stable companion IDs are `guardian`, `scout`, and `mystic`.
- Recruitment quests are canonical quest definitions with stable stage IDs and
  `recruitCompanion` completion actions. Replay them idempotently after load,
  Overworld init, NPC changes, and debug quest mutations.
- When a debug mutation recruits a companion, refresh the live follower
  presentation in the same mutation path.
- Active conscious companions follow visually but never block movement or
  independently trigger traps, encounters, gates, or world interactions.
- Press `P` for party order, gear, separate inventories, transfers, targeted
  healing/items, control mode, stat allocation, and gambit editing.
- Each companion has at most 12 ranked gambits. Evaluate against a fresh
  per-turn snapshot, skip invalid rules without mutation, execute at most one
  bonus and one main action through `battleActions.ts`, then fall back to attack
  or defend.
- Manual companion turns and gambits share the validated action planner and
  concrete executor; do not duplicate d20, target, item, status, or economy
  rules in UI/AI code.
- Key items, mounts, and equipped items cannot transfer. Gold, shop purchases,
  and battle drops remain hero-owned until eligible items are transferred.
- Inventory presentation goes through `src/systems/inventory.ts`. Sort and
  filter derived entries by their original inventory indexes; never reorder the
  owning array or replace equipment object links.
- Inventory sort/filter/search preferences use `2dnd_inventory_prefs`, separate
  from the campaign save schema. Recent acquisition is reverse canonical append
  order.
- The party Items page and `Esc` menu share semantic keyboard, pointer, gamepad,
  and touch actions. `T` remains mount
  control. Item visuals are generated procedurally in `itemVisuals.ts`.
- Living actors receive victory XP. KO actors receive no victory XP and reset
  to the current-level XP floor. Full defeat requires every active party actor
  to be KO. Apply the gold/XP/location recovery once, return its exact receipt,
  autosave the recovered state, and present it in `DefeatScene`.

## Quests

- Definitions, stages, rewards, named NPC IDs, and gated entrances live in
  `src/data/quests.ts`.
- Runtime progression, normalization, rewards, NPC resolution, journal data,
  and gate checks are exposed through `src/systems/quests.ts`; focused save
  normalization and debug mutation helpers live in `questState.ts` and
  `questDebug.ts`.
- `player.progression.quests` is required persistent state. Mutate it through
  quest-system APIs so completion rewards remain idempotent.
- The main campaign is the seven-chapter **Twelvefold Covenant**, spanning all
  12 cities and three keystones guarded by the Crypt Lich, Frost Warden, and
  Inferno Forgemaster. Its sidequests are **Ironbound Dispatch** and
  **Silk Against the Cold**.
- Quest progress stores per-objective counters and per-reward claimed IDs.
  Preserve duplicate monster IDs when recording group victories so defeat
  counters advance once per combatant.
- Downstream systems such as companion recruitment query `isQuestCompleted()`
  and persist their own unlock state.
- Generic completion actions use stable `{ id, type, targetId }` definitions.
  Replay them with `getQuestCompletionActions()` or
  `replayQuestCompletionActions()`; consumers own idempotency.
- Quest stages have stable camelCase `id` values. Resolve them through
  `getQuestStageIndex()` or the debug-only `setQuestStageById()` rather than
  titles.
- Boss objectives derive from `defeatedBosses`; do not rely only on a new battle
  event because existing saves may already contain the required defeat.
- Quest NPCs remain available at night. `Q` opens the quest journal.
- The campaign ending is derived from `isQuestCompleted(MAIN_QUEST_ID)`. The
  Inferno Forgemaster victory alone does not end the game; the real
  `returnToElowen` interaction launches the unseen epilogue after rewards are
  applied. Completed older saves recover the unseen epilogue on Overworld
  creation, and replay never mutates quests or rewards.
- Immutable cutscene contracts belong in `cutsceneTypes.ts`, focused campaign
  and boss content in `cutsceneCampaign.ts`/`cutsceneBosses.ts`, and the stable
  ID hub in `cutscenes.ts`. Trigger snapshots, priority order, queue lifecycle,
  normalization, recovery, and Chronicle selection belong in
  `src/systems/cutscenes.ts`; step progression belongs in
  `src/managers/cutscene.ts`; Phaser presentation belongs in `CutsceneScene`
  and its renderer.
- Persist a cutscene ID before presentation. Completion or skip marks it seen
  and removes it from the pending queue; reload resumes the first pending ID.
  Chronicle replay mutates neither list. Compare immutable before/after trigger
  snapshots, and capture Battle's snapshot before adding a defeated boss.
- Trigger order is opening, boss aftermath, keystone/story/recruitment
  milestones, route openings, stage introductions, then epilogue.
- Canyonwatch, Ashfall, and the Volcanic Forge use quest-controlled entrance
  barricades; Sandport and the Heartlands Crypt remain reachable to avoid
  softlocks. Premature northern, marsh, and ashen travel uses persisted soft
  danger warnings plus capped encounter-rate and effective-level modifiers.

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
- Every monster references a typed family from `monsterFamilies.ts`. Deliberate
  palette/stat variants use a valid same-family `variantOf`, distinct colors and
  abilities, positive encounter weights, and the canonical nine-element system.
- Monster visuals use stable `monster-<id>-<normal|boss>-idle` keys. Boot
  generates each palette procedurally from a family silhouette; bosses add
  richer family-specific forms. Battle and Codex must both use
  `getMonsterTextureKey()` and must not mutate shared definitions.
- Codex family grouping, filters, sorting, traits, affinities, and completion
  derive from immutable monster data plus existing Codex entries. Do not add a
  save field for derivable family progress.
- World knowledge definitions and source metadata live in
  `src/data/codexKnowledge.ts`; normalization, idempotent unlock signals,
  replay/recovery, search, sorting, and grouping live in `src/systems/codex.ts`.
  Persist only stable unlocked knowledge IDs. Lore is never authoritative for
  quests, companions, rewards, gates, reputation, alignment, or event outcomes.
- Existing systems may emit location, quest-stage/completion, cutscene, item,
  NPC-dialogue, readable, or World Event signals. The World Event system owns
  `worldEvent`; reputation owns `reputationMilestone`. Neither may read
  Codex state back into gameplay decisions.
- `CodexDiscoveryManager` owns short non-interactive notices. Notices never
  change input context, delay transitions, or outlive scene shutdown.
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
- Battle exits are guarded and delegate to `SceneTransitionManager`, which
  starts Overworld or `DefeatScene` after fade completion or the delayed
  recovery watchdog and restores the outgoing camera before Phaser queues the
  handoff.
- Random and boss defeats use the same `applyPartyDefeat()` mechanics. Battle
  clears menus, input listeners, effects, particles, and weather timers before
  the result scene; continuing carries the full shared state to Overworld.
- Debug instant victory routes through the same battle-end check even during
  the pre-turn `init` phase.
- Battle presentation registers hero, companions, enemies, and bosses by stable
  combatant ID. Resolve mechanics first, then animate the immutable result;
  never consume resources twice or make turn/result transitions depend on a
  tween callback.
- Idle, attack, cast, ability, item, defend, damage, victory, faint, and flee
  states must have once-only completion, a duration-plus-grace visual recovery
  path, and explicit cleanup on battle handoff or scene shutdown.
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
- Buff spells use the same target model. Mass Haste and Inspiring Chorus apply
  party statuses once per resolved target; status definitions remain only in
  `statusEffects.ts`.
- Group flee DC is `10 + (aliveCount - 1) * 2`. Group XP and gold are the
  floored member totals multiplied by 0.85; drops and Codex defeats resolve per
  monster.

For disadvantage, roll two d20s and select the lower natural roll before
checking natural 1/20 and adding modifiers. Magic Missile remains auto-hit.

### Non-combat skill checks

- Resolve checks through `src/systems/skillChecks.ts`; definitions belong in
  `src/data/skillChecks.ts`, and Overworld orchestration belongs in
  `src/managers/skillChecks.ts`.
- Checks use d20 + the selected Dexterity, Intelligence, Wisdom, or Charisma
  modifier plus typed bonuses against a DC. Natural 1 and 20 do not
  automatically fail or succeed.
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

There are 12 campaign cities plus the optional island port Tidehaven. Logical city chunk 0 uses `CityData.mapData`; optional
`city.chunks` stores additional districts beginning at logical index 1.
Use `getCityChunk*()` and `getCityConnectionAt()` helpers. Connections update
`player.position.cityChunkIndex` and destination coordinates.

### Dungeons

There are three multi-level dungeons. Level 0 uses `DungeonData.mapData`;
`levels[0]` is logical level 1. Use `getDungeonLevel*()` and
`getDungeonConnectionAt()` helpers. Model ascent and descent explicitly.
Deepest floors contain a `DungeonBoss` tile and unique boss.

Dungeon traps use metadata rather than terrain mutation. `DungeonData.trapProfile`
selects the allowed and thematic trap types; `generateDungeonTraps()` derives a
stable layout from `player.progression.trapSeed`, prioritizes chest approaches,
and keeps spawn/transition tiles safe. Detection and disarming use the shared
resolver for roll math through `src/systems/traps.ts`; Phaser orchestration lives
in `src/managers/dungeonTraps.ts`.

Detected traps block movement until disarmed with Space. Unseen or missed traps
trigger on entry. Trap Kits, trap-aware talents, and persistent Adventurer
guidance modify checks. Authoritative lifecycle state lives only in
`player.progression.trapStates`. Immediate HP/MP losses are nonlethal; applied
statuses use the existing combat-turn lifecycle.

### Fog keys

- Overworld: `chunkX,chunkY,x,y`
- Dungeon level 0: `d:id,x,y`
- Deeper dungeon: `d:id,level,x,y`
- City chunk 0: `c:id,x,y`
- Other district: `c:id,chunk,x,y`

Use `FogOfWar.exploredKey()`; level/chunk zero formats preserve existing saves.

## World Events

- Immutable definitions live in `src/data/worldEvents.ts`, deterministic
  eligibility/selection/outcomes/normalization in `src/systems/worldEvents.ts`,
  and Phaser choice presentation in `src/managers/worldEvents.ts`.
- Events run only after a completed ordinary overworld step and before treasure,
  exploration skill checks, or random monster encounters. Transitions, chunk
  changes, cities/dungeons, traps, NPC/special interactions, and queued
  cutscenes take priority.
- Event chance is independently capped at 8%. It never modifies the existing
  15% random-encounter calculation; an ambush selected as an event replaces the
  normal encounter roll for that step.
- Eligibility may use terrain, area prefix, time period, weather, level, quest
  state, defeated bosses, prior resolutions, repeat limits, and cooldowns.
- Choices reuse `rollSkillCheck()`, `startQuestById()`, `awardXP()`, canonical
  items, and `unlockCodexFromFutureSignal({ type: "worldEvent" })`.
- Special event combats remain pending while Battle runs and use normal
  encounter, action, reward, defeat, save, and return paths. Victory, flee, or
  defeat resolves the pending event exactly once before Battle saves.
- Persist only mechanics-owned event state and a bounded 40-entry record.
  Chronicle presentation is consultable evidence, never authority for quests,
  rewards, access, Codex decisions, alignment, or reputation.
- World Event outcomes emit typed alignment/reputation hooks that
  `src/systems/worldEvents.ts` consumes through the centralized social mutation
  API before autosave. Never add parallel event-owned social persistence.
- `/event list|trigger <id>|reset` is debug-only.

## Gathering

- Immutable discipline, resource, rarity, table, outcome, and recipe-input
  contracts live in `src/data/gathering.ts`; deterministic mechanics live in
  `src/systems/gathering.ts`, save normalization in `gatheringState.ts`, and
  Phaser presentation in `src/managers/gathering.ts`.
- Fishing targets adjacent Water/River terrain, mining targets adjacent
  mountain/canyon/volcanic/dungeon-wall terrain, and foraging targets current or
  adjacent forest/vegetation terrain. Resolve maps through existing city,
  dungeon, and chunk helpers and keep the hero on a safe walkable approach.
- Select and persist the exact outcome, quantity, pattern, and pending phase
  before presentation. Reload resumes that state and never rerolls a reward.
- Reduced motion replaces bite/reveal timers with explicit confirm steps while
  keeping the same sequence, score threshold, outcome, and reward.
- Nodes use stable location-derived IDs, per-node cooldown/depletion, bounded
  history, and deterministic time/weather/biome modifiers. Active gathering
  blocks movement, World Events, encounters, traps, and other interactions.
- Canonical resources are `crafting` inventory items with `material.resourceId`,
  discipline, rarity, and a stable `RecipeInputContract` containing
  `materialId`, categories, tier, and tags. Crafting consumes those exact
  contracts; gathering must not duplicate recipe or material identity.
- Rare guarded finds use normal Battle hooks and rewards. Codex item acquisition
  and derived gathering achievements are consumers, never gameplay authority.
- `K` opens the Gathering record. `/gather
  list|near|trigger|resolve|reset|status` is debug-only.

## Crafting

- Immutable recipe IDs, categories, ingredients, unlock sources, outputs,
  stations, upgrades, and preview metadata live in `src/data/crafting.ts`.
  Atomic validation/execution, discovery reconciliation, queries, ownership,
  economy checks, and debug commands live in `src/systems/crafting.ts`;
  schema-v15 normalization lives in `craftingState.ts`; accessible Phaser
  presentation lives in `src/managers/crafting.ts`.
- Match materials only through canonical `Item.material.resourceId` and
  `recipeInput` material ID/category/tier/tag metadata. Never create parallel
  material identity or mutate item definitions at runtime.
- A craft validates recipe knowledge, selected hero/companion ownership,
  protected/equipped restrictions, batch, gold, station, output, and all
  ingredient indexes before consuming anything. Transactions are deterministic,
  atomic, once-only, and have no random failure.
- Equipment upgrades consume exactly one declared canonical base item, produce a
  canonical variant, and replace every equipped reference to that exact object
  with the output. Other equipped, key, mount, and quest items remain protected.
- Recipe discovery is stable and idempotent across cities, quest completion
  actions, gathering milestones, shops, NPCs, readable lore, Codex evidence,
  acquired items, and World Event outcomes. Recipes and achievements never
  become authority for quests, Codex, rewards, access, or endings.
- `V`, Party & Inventory, and the Esc menu open Crafting in safe Overworld,
  city, or dungeon states. Search, filters, sorting, batches, ownership,
  ingredient counts, output comparison, source hints, and history must remain
  usable with keyboard, pointer, touch, gamepad cursor, 150% text, high contrast,
  reduced motion, and mobile safe areas.
- `/craft list|unlock|lock|craft|material|status|reset` is debug-only. Debug
  crafting and discovery do not advance natural crafting achievements.

## Alignment and reputation

- Canonical definitions and thresholds live in `src/data/reputation.ts`; pure
  normalization, classification, mutations, shop composition, reactions, and
  future achievement hooks live in `src/systems/reputation.ts`.
- Alignment has bounded `lawChaos` and `goodEvil` axes. New players start at
  `{ lawChaos: -50, goodEvil: 0 }`, exactly Chaotic Neutral. Named alignments
  are always derived.
- Town and faction reputation use stable existing IDs, bounded scores, and
  derived tiers. Alignment and reputation never overwrite each other.
- Every mutation requires one stable source/action ID. Persist scores, applied
  IDs, and at most 40 recent cause entries; never persist derived names, tiers,
  thresholds, price modifiers, Codex milestones, or achievement hooks.
- Apply only morally meaningful quest/dialogue/event/trap/combat outcomes.
  Routine movement, unavoidable combat, and repeat farming never shift scores.
- Shop reputation adjustments add to saved Charisma negotiation outcomes and
  clamp the combined adjustment from a 25% surcharge to a 35% discount.
- Social conditions may vary optional dialogue, approaches, World Events, and
  epilogue presentation, but canonical quest completion and rewards remain
  authoritative and reachable for every alignment.
- `reputationMilestone` Codex signals are idempotent. Runtime-only typed
  `SocialAchievementHook` results are consumed by `src/systems/achievements.ts`;
  the social system never persists achievement state.

## Achievements

- Immutable definitions, stable camelCase IDs, categories, hidden rules, points,
  source metadata, criteria, and cosmetic titles live in
  `src/data/achievements.ts`. Mechanics, normalization, progress, reconciliation,
  event counters, debug exclusion, notifications, and title equip rules live in
  `src/systems/achievements.ts`.
- Achievements are never authoritative for quests, rewards, access, alignment,
  reputation, Codex, combat, or endings. Reconcile from those authoritative
  domains after load and autosave. Persist counters only for event history that
  cannot be reconstructed safely.
- Battle results use stable once-only source IDs. A one-hit defeat requires one
  damaging action to reduce a full-health enemy to zero. No-defeat completion
  requires schema-v13 defeat tracking from character creation; never infer it
  for older saves.
- Achievement title rewards are presentation-only. Normalize unlocked IDs,
  require the equipped title to be unlocked, and never apply title-based stats.
- `AchievementOverlayManager` owns filters, search, sorting, progress text/bars,
  hidden presentation, completion order/timestamps, summary points, and title
  selection. `AchievementNotificationManager` shows persisted notices only
  during safe Overworld states and leaves interrupted notices queued.
- Debug unlocks are marked and grant no points or titles. Debug mutations must
  suppress newly satisfied natural criteria, and debug-spawned battles/events
  must not advance event counters.

## Save system

Save schema version is 18.

Schema v18 adds non-negative campaign playtime and a resilient local slot
layout: the legacy-compatible `2dnd_save` autosave, three stable manual slots,
verified staging and prior-primary backups, per-slot names, and a one-time
migration marker. Migrate a valid legacy autosave atomically without deleting
it, isolate corruption per slot, recover staging/backup copies before failure,
and validate all deterministic JSON imports through the existing campaign
normalizer. Loading a manual snapshot must not mutate that source slot.

Schema v17 adds normalized feature-discovery IDs, pending one-time reveal IDs,
explicit debug reveals, and debug-suppressed evidence. Schema-v16 and older
saves start with empty discovery metadata and silently reconcile all durable
authoritative evidence, so mature saves regain earned menus without replaying
rewards or showing reveal storms.

Electron persists the same documents through the stable `app://2dnd` origin.
The native shell never owns or mutates campaign state, and browser/desktop
origins never silently merge.
Desktop lifecycle and failures append to bounded rotating logs below Electron
user data without recording save payloads. Save & Return to Title autosaves
before Boot; application quit is exposed only on the desktop title screen
through trusted zero-argument IPC.
The renderer owns slot import/export through browser file APIs; do not expose
broad filesystem access through preload.

Schema v16 adds `player.progression.nautical`: typed boat ownership, condition,
upgrades and cosmetics; discovered ports, routes, islands, continents, and sea
fog keys; bounded navigation statistics; and recoverable pending merchant
routes, hazards, and encounters. Canonical continent/zone/port/island metadata
is derived and never persisted. Invalid sailing locations recover to a safe
known port or Willowdale without renumbering legacy chunks or changing
level-zero/chunk-zero fog formats.

`loadGame()` treats parsed data as `unknown`, migrates legacy flat position and
progression fields, normalizes active effects, Codex elements, and skill-check
records, validates city/dungeon IDs and quest state, clamps levels/districts,
repairs invalid coordinates to the correct spawn, and falls back to Willowdale
for unusable overworld locations. Schema-v3 skill-check saves gain default
quest state. Flat schema-v4 Ashen Road saves migrate to nested Covenant
objective/reward/warning state without replaying completed rewards.
Schema-v3 skill-check and schema-v4 quest saves gain explicit trap defaults.
If a malformed trap seed is replaced,
`trapStates` is cleared so stale IDs cannot resolve against a different layout.
Schema-v5 saves gain an empty `player.party`; party normalization validates
companion IDs, active order, resources, known actions, canonical inventory,
equipment links, effects, control mode, dialogue state, and gambits before
replaying completed recruitment actions.
Schema-v6 and older saves gain an empty `seenCutsceneIds` list. Cutscene
normalization keeps only known stable IDs and removes malformed or duplicate
entries. Schema-v7 and older saves gain an empty `pendingCutsceneIds` list;
normalization removes unknown, duplicate, malformed, or already-seen IDs.
Legacy recovery queues only a completed-but-unseen epilogue. Pre-v9 saves gain
`{ completed: true }` tutorial progress so established campaigns are not
interrupted; malformed v9 completion values normalize to false.
Schema-v9 and older monster-only Codex data gains normalized
`unlockedEntryIds`; unknown, malformed, and duplicate IDs are removed, valid
monster discovery is preserved, and durable player evidence is replayed
idempotently to recover world knowledge.
Schema-v10 and older saves gain default World Event state. Event normalization
validates the seed, counters, known event/choice IDs, pending phase/location,
repeat counters, claimed/resolved IDs, and bounded record. Replacing a malformed
seed clears the pending event so it cannot resolve against corrupt state.
Schema-v11 and older saves gain the exact Chaotic Neutral baseline and neutral
reputation. Do not replay historical social outcomes; mark deterministic quest
social sources consumed while preserving existing quest/reward/Codex/event state.
Schema-v12 and older saves gain normalized achievement state and silently
reconcile reconstructable milestones. Their defeat history remains explicitly
unknown, preventing retroactive no-defeat credit. Unknown/duplicate achievement
or title IDs are removed, counters are clamped, completion order is repaired,
pending notices must reference earned achievements, and equipped titles must be
unlocked.
Schema-v13 and older saves gain default deterministic gathering state. Schema-v14
normalization validates discipline/resource/outcome IDs, patterns, locations,
statistics, cooldowns, claimed IDs, and bounded history. Replacing a malformed
gathering seed clears node state, discovered generated nodes, and pending play.
Schema-v14 and older saves gain default crafting state. Schema-v15 normalization
keeps known canonical recipes, deduplicates discovery and transaction IDs,
clamps natural statistics and per-recipe counts, bounds/repairs recent history,
preserves prior gathering/inventory/equipment/achievement state, and replays
durable recipe discovery idempotently.

Inventory presentation preferences are not save ownership data and do not
increment the schema. Store them under `2dnd_inventory_prefs`.
Audio and accessibility preferences are not campaign save fields. The versioned
`2dnd_preferences` document is normalized by `src/systems/accessibility.ts`,
migrates the legacy audio and cutscene-accessibility keys, and notifies live
title/in-game settings consumers immediately.

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
Master, Music, SFX, Dialog, and mute use the shared preference store rather than
campaign saves. Keep title and in-game controls backed by the same setters.
The campaign epilogue uses `audioEngine.playEndingMusic()` and the procedural
ending profile.
The defeat result sequence uses `audioEngine.playDefeatMusic()` and the slow
natural-minor defeat profile. Stop the active weather audio overlay before
starting it without changing the persisted weather state.
Data-driven campaign scenes route short typed cues through
`audioEngine.playCutsceneCue()`. Disconnect ended cue oscillators and gain nodes.
Battle presentation routes spell, ability, defend, flee, and faint cues through
the synthesized SFX graph; do not duplicate cues in scene-local action code.
Trap trigger profiles live in `src/systems/trapAudio.ts` and route through
`audioEngine.playTrapSFX()`. Do not add external audio.

## Accessibility

- Install `installSceneAccessibility()` in every Phaser scene.
- Supported text scales are 100%, 125%, and 150%; core overlays must remain
  usable at each scale.
- High contrast updates live through the shared scene adapter.
- Important state must pair color with text, symbols, borders, patterns, or
  numeric values.
- Query reduced motion through `isReducedMotionEnabled()` or
  `getMotionDuration()`; cutscenes, transitions, ambient movement, and visual
  effects must not create motion when it is enabled.
- Reduced-motion actor presentation applies readable state/labels immediately,
  still completes callbacks exactly once, and never leaves input or scene
  handoffs waiting on animation time.
- Preferences persist under `2dnd_preferences`, separately from `2dnd_save`.
- Control presentation preferences in the same versioned document cover touch
  visibility, handedness, and prompt source only; they never enter schema-v18
  campaign saves.
- Codex search uses the shared accessible mobile text input, pointer-first
  category/filter/sort controls work with touch and the gamepad cursor, and the
  Esc menu exposes the Codex for touch users. In Codex context, the semantic
  gamepad interact action opens search and confirm submits it.
- Put pure stack, grid, wrapping, pagination, safe-area, focus restoration, and
  overlap math in `src/systems/layout.ts`. Phaser scaled-bounds, reflow,
  hit-area synchronization, group registration, and debug/test reporting belong
  in `src/managers/layout.ts`.
- Register modal content with `createOverlayContainer()` and a bounded viewport.
  Filter hidden/disabled entries before layout, keep stable item IDs for focus
  restoration, and never leave blank interactive rows after feature filtering.
- `#layout-report` and `data-layout-overlap-count` /
  `data-layout-clipping-count` are local debug/test selectors. Registered groups
  must report zero unintended intersections and zero visible-content clipping.

## Semantic controls

- Stable typed actions, contexts, mappings, dead zones, repeat/debounce,
  source switching, priority, and duplicate suppression live in
  `src/systems/input.ts`.
- `src/managers/input.ts` is the only browser adapter for keyboard, pointer,
  standard gamepads, and touch. Do not add parallel scene-specific gamepad or
  mobile mappings.
- Standard gamepads use digital fallback plus analog dead zones. The right
  stick owns a visible virtual cursor for pointer-first surfaces, and pressing
  it clicks without replacing the normal A/confirm action.
- Touch controls are procedural DOM controls with safe-area/orientation CSS,
  pointer capture for held directions, pointer-release pulses with a click
  fallback for discrete actions, and simultaneous movement/action support.
- Match D-pad navigation to visual grid rows and columns. Character creation
  must support directional selection plus A/confirm and B/cancel. Show MENU and
  TIPS touch actions only during safe exploration.
- Clear held input and synthetic keys on blur, visibility loss, gamepad
  disconnect, scene changes, and runtime destruction.
- Resolve key conflicts by semantic context/priority. Never map production
  controls to debug cheat actions.
- Prompts and focus state must adapt to the selected/active source using text or
  symbols, not color alone.
- Progression actions must consult feature discovery before dispatch. Untaught
  shortcuts and touch actions stay hidden/inert; dynamic menu focus clamps to
  the filtered entry list.
- Stable mappings are deliberately not user-remappable. Do not add a partial
  remapper unless every release flow, conflict, text-entry case, and
  accessibility requirement can be validated.

## Debug

- Use `isDebug()`, `debugLog()`, and debug panel APIs.
- Never add production `console.log`.
- `/spawn` resolves every entry in `ALL_MONSTERS`, including dungeon-specific
  monsters and bosses.
- Battle-only `/defeat` knocks out the active party through the production
  defeat/result/recovery path.
- `/quest` lists, advances, or sets exact quest stages/statuses.
- `/near <questNpcId>` positions the hero on a valid adjacent tile in the
  current city's primary district; it never completes the interaction.
- `/companion` lists, recruits, changes control mode, heals, or explains stored
  gambits. Recruitment mutations refresh follower presentation immediately.
- `/achievement` lists, debug-unlocks, resets, reports progress, or explains
  authoritative criteria. Debug unlocks never grant natural points or titles.
- `/feature` lists, explicitly debug-reveals, hides, resets, or explains stable
  feature IDs. Only explicit feature commands create marked debug reveals.
- `P` opens party management; the debug MP hotkey is `O`.
- Shared debug commands and Overworld-specific commands live in
  `src/systems/debug.ts`.

## Commands

```bash
npm run dev
npm run typecheck
npm test
npm run test:browser
npm run test:browser:install
npm run test:desktop
npm run test:watch
npm run build
npm run build:desktop
npm run package:desktop
npm run benchmark:baseline
```

## Testing

- Frameworks: Vitest for logic and Playwright for browser/Electron flows.
- Files: `tests/*.test.ts`, `e2e/*.spec.ts`, and `electron-tests/*.spec.ts`.
- Add deterministic tests for mechanics and migrations.
- Add deterministic layout tests for measured stacks/grids, long wrapping,
  pagination/scroll ranges, safe areas, focus/hit-area alignment, and overlap
  detection. Browser coverage should assert registered groups remain clean at
  100%/125%/150% text and representative desktop/mobile viewports.
- The browser suites use a fresh strict port, default to the deployed `/2dnd/`
  base path, test the showcase at its root, open Phaser flows through
  `game.html`, and assert opening recovery, boss cutscenes, Chronicle replay
  immutability, tutorial completion, direct and menu Tips access, interrupted and
  legacy ending recovery, durable post-game reload, corrupt-save fallback,
  random/boss defeat recovery, recovery save/reload, and page/console errors.
- Animation browser coverage includes hero/companion/monster/boss actions and
  fainting, spell/ability particles, world/follower/mount gait, boss cutscenes,
  and reduced-motion immediate states.
- Pull request CI installs Chromium and runs the browser suites.
- Desktop CI audits, smoke-tests `app://2dnd/game.html`, and creates unsigned
  macOS, Windows, and Linux artifacts. Matching version tags rerun the full gate
  and attach those packages to a GitHub release without signing credentials.
- Hold frame-polled Phaser keys across animation frames and synchronize on
  debug-state transitions rather than fixed sleeps alone.
- Run `npm run benchmark:baseline` on the current base commit before
  performance-affecting work and record the environment and output in the
  owning issue or pull request.
- Run typecheck, full Vitest, browser tests, and build before completion.

## Prohibited

- External image or audio assets; showcase screenshots must be generated from
  the running game
- Network calls
- `any`
- Production `console.log`
- Runtime mutation of shared game data
- Hardcoded terrain behavior that bypasses helpers
- Incomplete scene-state transitions
- Silent failure paths
- Force-pushing or rewriting Git history

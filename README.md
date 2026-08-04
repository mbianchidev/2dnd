# 2D&D

A browser-based JRPG that combines Dragon Quest-style exploration with
Dungeons & Dragons 5E-inspired combat. The game runs entirely in the browser:
graphics are procedurally generated, audio is synthesized with the Web Audio
API, and saves use `localStorage`.

## Features

### Character creation and progression

- 12 classes: Knight, Ranger, Wizard, Sorcerer, Rogue, Paladin, Warlock,
  Cleric, Druid, Barbarian, Monk, and Bard
- D&D 5E point buy: 27 points, base scores from 8 to 15
- Optional 4d6-drop-lowest random stat generation
- Class ability boosts, class-specific primary stats, spells, martial
  abilities, talents, equipment, shields, mounts, and banking
- Leveling to 20 with hit-die HP growth, proficiency bonuses, and ability score
  improvements
- Three quest-recruited companions (Guardian, Scout, Mystic) with independent
  levels, stats, HP/MP, spells, abilities, equipment, inventories, and ASI
  progression
- Hero plus three active companions, reserve/active ordering, item transfers,
  party-wide inn recovery, and persistent manual or gambit control
- Ranked 12-rule gambits use structured subjects, conditions, actions, and
  targets; invalid rules safely fall through without consuming resources

### Combat

- Turn-based d20 combat with initiative, natural 1/20 outcomes, critical hits,
  defending, fleeing, off-hand attacks, spells, abilities, consumables, and
  boss abilities
- Balanced encounters with 1-4 monsters, individual initiative turns,
  front/back formations, keyboard or pointer target selection, and group
  synergies such as Pack Tactics, Shield Wall, War Cry, healer support, and
  elemental combos
- Party battles use stable combatant IDs, explicit party/enemy allegiance,
  individual initiative, ally/enemy target scopes, living-party monster target
  selection, manual companion turns, automated gambits, and shared result hooks
- `battleActions.ts` provides a Phaser-free gambit pipeline to enumerate living
  actors, bind matched and item-declared ally/self targets, validate
  MP/inventory/action economy, freeze an action plan, consume one action plus
  one bonus action per actor, and dispatch one attack, defend, spell, ability,
  or item action
- Generic `BattleActionSource` and `executeValidatedBattleAction()` reuse the
  game's d20, AC, elements, statuses, MP, inventory, healing, and defend rules
  for player or future companion actors
- Battle consumables use item-declared target scopes: ally items fall back to
  self when solo, self-only items remain self, and the acting actor consumes
  the item while HP, MP, or cures apply to the selected target
- Single-target, row-targeted, random-two, and all-enemy spell targeting; AoE
  spells pay MP and roll damage once, then resolve each monster independently
- Single/all-party healing, Mass Haste, and Inspiring Chorus apply one shared
  roll/cost across the resolved party targets
- Nine damage elements: Fire, Ice, Lightning, Poison, Necrotic, Radiant,
  Thunder, Force, and Psychic
- Monster weaknesses deal double damage, resistances halve damage, and
  immunities prevent damage
- Elemental interactions are discovered through combat and recorded per
  monster in the Codex
- 15 status effects shared by players and monsters:
  Poisoned, Burning, Frozen, Paralyzed, Stunned, Frightened, Slowed, Prone,
  Asleep, Confused, Enraged, Hasted, Inspired, Raging, and Sneak Stance
- Start-of-turn damage and saving throws, skipped turns, attack disadvantage,
  accuracy/AC/damage modifiers, duration expiration, and cure items
- Combat effects are cleared when Battle ends because their durations use the
  combat turn clock

### Non-combat skill checks

- D20 ability checks use the player's Dexterity, Intelligence, Wisdom, or
  Charisma modifier;
  natural 1 and 20 are not automatic outcomes outside attack rolls
- Charisma supports persistent Persuade/Bluff NPC outcomes and one-attempt shop
  negotiations with 10% or 20% discounts
- Wisdom uncovers hidden trails, dungeon passages, secret chest compartments,
  and better rewards from overworld treasure
- Dexterity avoids exploration hazards and resolves locked or trapped chests;
  failed hazards can cost HP but cannot defeat the player outside combat
- Fixed checks use stable save IDs, while repeatable terrain events remain
  data-driven by environment and terrain

### World exploration

- A 10x9 world grid containing 90 chunks, each 20x15 tiles
- Distinct terrain, biome encounter tables, night encounters, weather,
  day/night lighting, fog of war, treasure, NPCs, animals, and special NPCs
- Random encounter modifiers stack but the effective chance is capped at 15%;
  group encounters begin at level 2 and use level budgets and biome filters
- 12 cities with connected districts, district-specific shops, gates,
  discovery, fast travel, inns, banks, stables, and city music
- Three multi-level dungeons with bidirectional stairs, floor-specific
  encounters, chests, fog, procedural traps, and a unique deepest-floor boss
- Seeded trap layouts with spike pits, poison darts, falling rocks, alarms,
  hidden floors, and dungeon-specific runes; nearby checks use Dexterity or
  Intelligence, detected traps can be disarmed for XP, and unresolved traps can
  deal HP/MP damage, inflict combat statuses, summon encounters, or drop the
  player to a deeper floor
- Trap Kits, class talents, and Adventurer guidance improve detection and
  disarming; seeded layouts and four-state trap outcomes persist explicitly
- The seven-chapter **Twelvefold Covenant** main quest spans all 12 cities and
  restores three keystones guarded by dungeon bosses, with two campaign
  sidequests, optional boss objectives, named story NPCs, dynamic markers, a
  `Q` journal, unique rewards, gated roads, and soft danger zones
- Data-driven campaign cutscenes cover the opening, quest stages, city oaths,
  companions, dungeon reveals, route openings, keystones, and every boss
  introduction and aftermath; queued scenes survive reloads until completed or
  skipped, and the Chronicle replays seen scenes without changing game state
- The final Elowen turn-in launches a skippable campaign epilogue with rewards,
  party and exploration summaries, credits, post-game continuation, and
  presentation-only replay from the in-game menu
- Three additional recruitment quest lines use stable stage IDs and replayable
  completion actions; active conscious companions follow the hero and can be
  spoken to during overworld, city, and dungeon exploration
- Fog keys separate every dungeon level and city district while preserving
  legacy level-zero/chunk-zero save keys

### Presentation

- Phaser 4 pixel-art rendering with procedural textures
- Procedural biome, city, battle, boss, title, cutscene, and campaign-ending
  music and cues
- Synthesized combat, weather, movement, item, and interaction sound effects
- Cutscene settings for reduced motion, 100%/125%/150% text, and manual or
  automatic advance
- A five-step new-player tutorial plus an in-game Tips library with
  progression-aware combat, exploration, party, mount, dungeon, skill-check,
  and trap guidance
- Scrollable overlays and a bounded battle log
- Local-development debug panel, hotkeys, and slash commands

## Tech stack

| Component | Version |
| --- | --- |
| Phaser | 4.2.1 |
| TypeScript | 7.0.2 |
| Vite | 8.2.0 |
| Vitest | 4.1.10 |
| Playwright | 1.62.1 |
| happy-dom | 20.11.1 |

## Project structure

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
│   └── Ending.ts
├── systems/
│   ├── combat.ts
│   ├── groupCombat.ts
│   ├── battleActions.ts
│   ├── party.ts
│   ├── gambits.ts
│   ├── statusEffects.ts
│   ├── player.ts
│   ├── save.ts
│   ├── codex.ts
│   ├── movement.ts
│   ├── traps.ts
│   ├── trapAudio.ts
│   ├── skillChecks.ts
│   ├── weather.ts
│   ├── daynight.ts
│   ├── audio.ts
│   ├── quests.ts
│   ├── questState.ts
│   ├── questDebug.ts
│   ├── accessibility.ts
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
│   ├── companions.ts
│   ├── monsters.ts
│   ├── monsterGroups.ts
│   ├── elements.ts
│   ├── spells.ts
│   ├── abilities.ts
│   ├── quests.ts
│   ├── cutsceneTypes.ts
│   ├── cutsceneCampaign.ts
│   ├── cutsceneBosses.ts
│   ├── cutscenes.ts
│   ├── skillChecks.ts
│   ├── tutorial.ts
│   └── items.ts
├── managers/
│   ├── dungeonTraps.ts
│   ├── companionFollowers.ts
│   ├── partyOverlay.ts
│   ├── battleParty.ts
│   ├── questJournal.ts
│   ├── questFlow.ts
│   ├── cutscene.ts
│   ├── chronicle.ts
│   ├── tutorial.ts
│   ├── skillChecks.ts
│   └── sceneTransition.ts
└── renderers/
    ├── traps.ts
    ├── trapTextures.ts
    ├── characterTextures.ts
    ├── cutscene.ts
    ├── settings.ts
    ├── ending.ts
    └── battleParty.ts
```

`map.ts` is the map hub. Core types and dimensions live in `mapTypes.ts`;
world chunks, cities, and dungeons live in their own data modules. Overworld
delegates rendering and stateful subsystems to `renderers/` and `managers/`.

Tutorial steps, semantic control guidance, tips, categories, and unlock
requirements live in `src/data/tutorial.ts`. `src/systems/tutorial.ts` owns
Phaser-free completion normalization and progression-aware filtering, while
`src/managers/tutorial.ts` owns the keyboard/pointer overlay. Completion
persists at `player.progression.tutorial`; the compact HTML control rail starts
collapsed now that equivalent guidance is available from the game.

Quest content lives in `src/data/quests.ts`; runtime progression, rewards, NPC
interactions, journal entries, access rules, danger states, and completion
actions go through `src/systems/quests.ts`. Save normalization is isolated in
`src/systems/questState.ts`, debug-only mutation in
`src/systems/questDebug.ts`, and Overworld presentation flow in
`src/managers/questFlow.ts`. Add content through these APIs rather than
mutating `player.progression.quests` directly. Systems such as companion
recruitment should query `isQuestCompleted()` and persist their own state.
Completed quests may also declare stable `{ id, type, targetId }` actions.
Consumers call `getQuestCompletionActions()` or
`replayQuestCompletionActions()` after load and quest mutations, then apply
those actions idempotently in their own state. Every stage also has a stable
data ID; use `getQuestStageIndex()` or the debug-only
`setQuestStageById()` helper instead of coupling systems to display text.

Cutscene contracts live in `src/data/cutsceneTypes.ts`; campaign and boss content
live in focused modules, and `src/data/cutscenes.ts` remains the stable-ID hub.
`src/systems/cutscenes.ts` owns trigger snapshots, deterministic queue order,
normalization, lifecycle, Chronicle selection, and legacy epilogue recovery.
`src/managers/cutscene.ts` advances or skips immutable steps.
`CutsceneScene` and `src/renderers/cutscene.ts` provide generic procedural
presentation, while `EndingScene` remains the campaign-summary and credits
surface. IDs are queued and saved before presentation, then removed from
`pendingCutsceneIds` and added to `seenCutsceneIds` only after completion or
skip. Chronicle replay changes neither list.

For companion recruitment, define three distinct quest IDs and one action per
path using `type: "recruitCompanion"` and the companion ID as `targetId`.
`recruitCompanion()` must keep recruited IDs unique, so reloads, debug quest
completion, and replay cannot duplicate a companion. Debug quest and companion
mutations also refresh live followers immediately.

`SceneTransitionManager` owns camera fades and scene handoffs. It resets stale
effects on scene entry, waits for Phaser's fade-complete event, restores the
outgoing camera before queueing the next scene, rejects duplicate handoffs, and
uses a delayed watchdog only to recover a missing event. Overworld restarts
share one complete player, party, world, quest, trap, weather, and NPC payload
and block state-changing input until Phaser processes the queued handoff.

See [`docs/companions.md`](docs/companions.md) for party state, recruitment,
inventories, gambit syntax, combat control, KO/reward rules, and debug commands.

## Getting started

```bash
git clone https://github.com/mbianchidev/2dnd.git
cd 2dnd
npm install
npm run test:browser:install
npm run dev
```

Vite serves the game at `http://localhost:3000`.

## Commands

```bash
npm run dev        # Start the Vite development server
npm run typecheck  # Run strict TypeScript checks
npm test           # Run the Vitest suite once
npm run test:browser # Run the headless Chromium campaign golden path
npm run test:watch # Run Vitest in watch mode
npm run build      # Type-check and create a production build
```

## Controls

| Input | Action |
| --- | --- |
| `WASD` / arrow keys | Move, navigate, and cycle valid Battle targets |
| `Space` / `Enter` | Confirm, interact, or disarm a detected adjacent trap |
| `M` | Open the world or city map |
| `E` | Open hero equipment |
| `P` | Open party management, inventories, and gambits |
| `C` | Open the Codex |
| `Q` | Open the quest journal |
| `T` | Mount or dismount |
| `F1` | Open or close Tips |
| `Esc` | Close the active overlay or skip an active cutscene |
| Mouse / touch | Select buttons and scroll lists |

The `Esc` menu includes Tips, tutorial replay, the Chronicle, and cutscene
accessibility settings. Advanced Tips unlock automatically as relevant
progression is reached.

## Debug mode

On local development hosts, enable the debug checkbox above the canvas.
Available tools include:

- Battle hotkeys for instant victory, healing, MP, gold, XP, and levels;
  instant victory uses the normal one-shot resolution path even before the
  first initiative turn begins
- Overworld hotkeys for revealing the map, toggling fog, and disabling random
  encounters
- Slash commands for gold, XP, HP, MP, items, weather, time, teleportation,
  classes, mounts, audio, Codex discovery, quest state, and companions
- `/spawn <name-or-id>` for every monster in `ALL_MONSTERS`, including unique
  dungeon bosses, plus special overworld NPC aliases
- `/quest list`, `/quest advance <id>`, and
  `/quest set <id> <stage-number|stage-id|locked|active|completed>`
- `/near <questNpcId>` to stand beside a quest NPC in the current city's
  primary district without completing the interaction
- `/companion list`, `/companion recruit <id|all>`,
  `/companion mode <id> <manual|gambit>`, `/companion heal`, and
  `/companion gambits <id>`
- Local browser checks can force the next random encounter with
  `?forceGroup=<templateId>` (for example, `?forceGroup=slimeSwarm`)

Use `debugLog()` and the debug panel APIs instead of `console.log`.

## Save data

Game state is stored under `2dnd_save`; audio preferences use
`2dnd_audio_prefs`; cutscene accessibility preferences use
`2dnd_cutscene_accessibility`.

Save schema version 8 persists:

- Composed player position and progression data
- Dungeon ID and level
- City ID and district index
- Explored tiles, opened chests, collected treasure, and discovered cities
- Quest status, stages, objective counters, claimed reward IDs, and acknowledged
  danger warnings
- Stable completed-or-skipped cutscene IDs plus queued IDs awaiting completion
  or skip
- Per-playthrough trap seed, authoritative detected/missed/disarmed/triggered
  trap states, and Adventurer guidance
- Defeated bosses, Codex entries, and discovered elemental interactions
- Active status effects, time step, and weather state
- Normalized non-combat skill-check rolls, choices, and outcomes
- Recruited and active companion IDs; independent progression, resources,
  inventories, equipment, status effects, dialogue state, control modes, and
  normalized ranked gambit rules

`loadGame()` migrates older flat player saves, normalizes new fields, and
recovers invalid or conflicting world, city, and dungeon locations. Malformed
skill-check records are discarded, while valid totals and outcomes are repaired.
Schema-v3 skill-check saves gain default quest progress, and flat schema-v4
Ashen Road saves migrate to the nested Covenant state without replaying rewards.
Flat recruitment quest progress is migrated into the same nested log.
Schema-v3 skill-check saves gain default trap progress, and schema-v4 quest
saves gain default trap progress. Malformed trap seeds reset trap states
so stale IDs cannot resolve against a different layout. Schema-v5 saves gain an
empty party, and completed recruitment actions replay idempotently after party
normalization. Older saves gain empty seen and pending cutscene lists; unknown,
duplicate, malformed, or already-seen pending IDs are discarded. Migration
queues only a completed-but-unseen campaign epilogue rather than replaying every
historically eligible scene.

## Testing

The Vitest suite covers combat, elements, statuses, saves, map and city data,
dungeon traversal and traps, fog keys, movement, player progression, dice,
quest and skill-check progression, dice, weather, day/night, mounts, NPCs,
audio, configuration, group encounter generation, formation targeting,
synergies, rewards, cutscene data, triggers, queue recovery, accessibility,
director lifecycle, scene transitions, ending summaries, multi-target actions,
and party-ready combat/action-planning
contracts, companion definitions, party state, gambits, follower trails, and
recruitment replay.

Important integration suites:

- `tests/elements.test.ts`
- `tests/statusEffects.test.ts`
- `tests/save.test.ts`
- `tests/quests.test.ts`
- `tests/skillChecks.test.ts`
- `tests/data.test.ts`
- `tests/traps.test.ts`
- `tests/companions.test.ts`
- `tests/party.test.ts`
- `tests/gambits.test.ts`
- `tests/followers.test.ts`
- `tests/tutorial.test.ts`
- `tests/fogOfWar.test.ts`

The committed Playwright suite in `e2e/` runs a real Chromium campaign golden
path through character creation, interrupted opening recovery, quest
interaction, new-player tutorial completion, keyboard and menu Tips access,
dungeon reveals, skipped boss introductions, boss aftermath chains, Chronicle
replay immutability, final Elowen completion, credits, post-game continuation,
and completed-but-unseen ending recovery. It starts
Vite on an available strict port and defaults to the deployed `/2dnd/` base
path:

```bash
npm run test:browser:install # One-time Chromium install
npm run test:browser
PLAYWRIGHT_BASE_PATH=/ npm run test:browser # Optional root-base check
```

## Design constraints

- No external image or audio assets
- No network calls
- Strict TypeScript; avoid `any`
- Keep game data immutable at runtime
- Use explicit map helpers instead of hardcoding terrain behavior
- Preserve complete scene state across transitions

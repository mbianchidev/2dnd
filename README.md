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

### Combat

- Turn-based d20 combat with initiative, natural 1/20 outcomes, critical hits,
  defending, fleeing, off-hand attacks, spells, abilities, consumables, and
  boss abilities
- Nine damage elements: Fire, Ice, Lightning, Poison, Necrotic, Radiant,
  Thunder, Force, and Psychic
- Monster weaknesses deal double damage, resistances halve damage, and
  immunities prevent damage
- Elemental interactions are discovered through combat and recorded per
  monster in the Codex
- 14 status effects shared by players and monsters:
  Poisoned, Burning, Frozen, Paralyzed, Stunned, Frightened, Slowed, Prone,
  Asleep, Confused, Enraged, Hasted, Raging, and Sneak Stance
- Start-of-turn damage and saving throws, skipped turns, attack disadvantage,
  accuracy/AC/damage modifiers, duration expiration, and cure items
- Combat effects are cleared when Battle ends because their durations use the
  combat turn clock

### World exploration

- A 10x9 world grid containing 90 chunks, each 20x15 tiles
- Distinct terrain, biome encounter tables, night encounters, weather,
  day/night lighting, fog of war, treasure, NPCs, animals, and special NPCs
- 12 cities with connected districts, district-specific shops, gates,
  discovery, fast travel, inns, banks, stables, and city music
- Three multi-level dungeons with bidirectional stairs, floor-specific
  encounters, chests, fog, and a unique deepest-floor boss
- A multi-stage main quest, optional sidequest, named story NPCs, a `Q` quest
  journal, persistent outcomes, unique rewards, and progression-gated roads
- Fog keys separate every dungeon level and city district while preserving
  legacy level-zero/chunk-zero save keys

### Presentation

- Phaser 4 pixel-art rendering with procedural textures
- Procedural biome, city, battle, boss, and title music
- Synthesized combat, weather, movement, item, and interaction sound effects
- Scrollable overlays and a bounded battle log
- Local-development debug panel, hotkeys, and slash commands

## Tech stack

| Component | Version |
| --- | --- |
| Phaser | 4.2.1 |
| TypeScript | 7.0.2 |
| Vite | 8.1.4 |
| Vitest | 4.1.10 |
| happy-dom | 20.10.6 |

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
│   └── Codex.ts
├── systems/
│   ├── combat.ts
│   ├── statusEffects.ts
│   ├── player.ts
│   ├── save.ts
│   ├── codex.ts
│   ├── movement.ts
│   ├── weather.ts
│   ├── daynight.ts
│   ├── audio.ts
│   ├── quests.ts
│   └── debug.ts
├── data/
│   ├── map.ts
│   ├── mapTypes.ts
│   ├── chunks.ts
│   ├── cities.ts
│   ├── dungeons.ts
│   ├── monsters.ts
│   ├── elements.ts
│   ├── spells.ts
│   ├── abilities.ts
│   ├── quests.ts
│   └── items.ts
├── managers/
│   └── questJournal.ts
└── renderers/
```

`map.ts` is the map hub. Core types and dimensions live in `mapTypes.ts`;
world chunks, cities, and dungeons live in their own data modules. Overworld
delegates rendering and stateful subsystems to `renderers/` and `managers/`.

Quest content lives in `src/data/quests.ts`; all runtime progression,
normalization, rewards, NPC interactions, journal entries, and entrance-gate
checks go through `src/systems/quests.ts`. Add follow-up quest content by
extending those definitions and APIs rather than mutating
`player.progression.quests` directly. Systems such as companion recruitment
should query `isQuestCompleted()` and persist their own unlocked state.
Completed quests may also declare stable `{ id, type, targetId }` actions.
Consumers call `getQuestCompletionActions()` or
`replayQuestCompletionActions()` after load and quest mutations, then apply
those actions idempotently in their own state.

For companion recruitment, define three distinct quest IDs and one action per
path using `type: "recruitCompanion"` and the companion ID as `targetId`.
`recruitCompanion()` must keep recruited IDs unique, so reloads, debug quest
completion, and replay cannot duplicate a companion.

## Getting started

```bash
git clone https://github.com/mbianchidev/2dnd.git
cd 2dnd
npm install
npm run dev
```

Vite serves the game at `http://localhost:3000`.

## Commands

```bash
npm run dev        # Start the Vite development server
npm run typecheck  # Run strict TypeScript checks
npm test           # Run the Vitest suite once
npm run test:watch # Run Vitest in watch mode
npm run build      # Type-check and create a production build
```

## Controls

| Input | Action |
| --- | --- |
| `WASD` / arrow keys | Move and navigate |
| `Space` / `Enter` | Confirm or interact |
| `M` | Open the world or city map |
| `C` | Open the Codex |
| `Q` | Open the quest journal |
| `Esc` | Close the active overlay |
| Mouse / touch | Select buttons and scroll lists |

## Debug mode

On local development hosts, enable the debug checkbox above the canvas.
Available tools include:

- Battle hotkeys for instant victory, healing, MP, gold, XP, and levels
- Overworld hotkeys for revealing the map, toggling fog, and disabling random
  encounters
- Slash commands for gold, XP, HP, MP, items, weather, time, teleportation,
  classes, mounts, audio, Codex discovery, and quest state
- `/spawn <name-or-id>` for every monster in `ALL_MONSTERS`, including unique
  dungeon bosses, plus special overworld NPC aliases
- `/quest list`, `/quest advance <id>`, and
  `/quest set <id> <stage|locked|active|completed>`

Use `debugLog()` and the debug panel APIs instead of `console.log`.

## Save data

Game state is stored under `2dnd_save`; audio preferences use
`2dnd_audio_prefs`.

Save schema version 3 persists:

- Composed player position and progression data
- Dungeon ID and level
- City ID and district index
- Explored tiles, opened chests, collected treasure, and discovered cities
- Main/side quest status, stage, and idempotent reward state
- Defeated bosses, Codex entries, and discovered elemental interactions
- Active status effects, time step, and weather state

`loadGame()` migrates older flat player saves, normalizes new fields, and
recovers invalid or conflicting world, city, and dungeon locations.

## Testing

The Vitest suite covers combat, elements, statuses, saves, map and city data,
dungeon traversal, fog keys, movement, player and quest progression, dice,
weather, day/night, mounts, NPCs, audio, and configuration.

Important integration suites:

- `tests/elements.test.ts`
- `tests/statusEffects.test.ts`
- `tests/save.test.ts`
- `tests/quests.test.ts`
- `tests/data.test.ts`
- `tests/fogOfWar.test.ts`

## Design constraints

- No external image or audio assets
- No network calls
- Strict TypeScript; avoid `any`
- Keep game data immutable at runtime
- Use explicit map helpers instead of hardcoding terrain behavior
- Preserve complete scene state across transitions

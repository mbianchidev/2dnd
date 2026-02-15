# 2D&D

An epic tale of magic and dice, in 2d!

A browser-based JRPG combining Dragon Quest-style gameplay with Dungeons & Dragons 5E mechanics — featuring procedurally generated graphics, synthesized audio, and a massive explorable world.

## Features

### World & Exploration
- **Multi-chunk world** — 10×9 grid of 20×15 tile chunks with diverse biomes (grass, forest, tundra, swamp, desert, volcanic, canyon)
- **12 explorable cities** — each with unique shops, inns, banks, and distinct procedural music
- **Dungeons** — locked areas with tougher monsters and treasure chests
- **Fog of war** — tiles reveal as you explore (cities auto-reveal on entry)
- **World map** — zoomable/pannable overview with chunk details

### Combat
- **D&D 5E dice mechanics** — d20 attack rolls, critical hits on nat 20, critical misses on nat 1
- **Turn-based battles** — initiative rolls, defend stance, flee attempts
- **8 character classes** — Knight, Ranger, Mage, Rogue, Paladin, Warlock, Cleric, Barbarian
- **Spells & abilities** — class-specific spell trees and martial abilities unlocked by level
- **6 boss fights** — Cave Troll, Young Red Dragon, Frost Giant, Swamp Hydra, Volcanic Wyrm, Canyon Drake
- **Scrollable battle log** — full combat history with mouse wheel scroll
- **Distinct attack sounds** — normal hit, miss (whiff), and critical hit each have unique SFX

### Character System
- **D&D 5E Point Buy** — 27 points to allocate across 6 stats (8–15 range), or random 4d6-drop-lowest
- **Class stat boosts** — applied on top of base allocation
- **Primary stat per class** — determines to-hit modifier (STR for Knight, INT for Mage, CHA for Warlock, etc.)
- **ASI levels** — gain stat points at levels 4, 8, 12, 16, 19
- **Equipment** — weapons, armor, shields with click-to-equip and click-to-unequip
- **Appearance customization** — skin color, hair style, hair color

### Audio
- **Fully procedural** — all music and sound effects synthesized via Web Audio API at runtime
- **Orchestral layers** — strings (vibrato), brass stabs, kick drum, hihat on every track
- **Biome music** — unique scale, tempo, and instruments per biome (9 biome profiles)
- **Boss music** — each boss has a distinct musical profile
- **City music** — 12 unique city vibes (pastoral, industrial, mystical, exotic, ominous, etc.)
- **Battle SFX** — attack swoosh+impact, miss whiff, critical hit slam+sting+bell
- **Interaction SFX** — chest open, dungeon enter, potion drink, terrain-specific footsteps
- **Weather ambient** — rain patter, thunder, wind, snow, sandstorm, fog drone
- **Per-channel volume** — Master, Music, SFX, Dialog sliders with localStorage persistence

### Day/Night & Weather
- **360-step day/night cycle** — Dawn, Day, Dusk, Night with visual tints on overworld and battle
- **Celestial bodies** — sun/moon in battle sky positioned by time of day
- **6 weather types** — Clear, Rain, Snow, Sandstorm, Storm, Fog
- **Biome-weighted weather** — each biome has different probabilities
- **Combat effects** — weather applies accuracy penalties and monster boosts
- **Particle effects** — rain, snow, sand, storm, fog in both overworld and battle

### Quality of Life
- **Auto-save** — saves after every step
- **Settings overlay** — accessible from title screen and in-game menu (M → Settings)
- **Stacked items** — battle inventory groups consumables (e.g., "Potion x3")
- **Codex** — track discovered monsters with AC discovery via combat

## Controls

| Key | Action |
|-----|--------|
| W/A/S/D | Move on the overworld |
| SPACE | Interact (enter town/dungeon, challenge boss) |
| E | Equipment overlay |
| M | Menu (Resume / Settings / Quit) |
| N | World map |
| B | Bestiary |
| Mouse | Click battle actions, shop items, UI elements |

## Tech Stack

- **Phaser 3** — game engine (rendering, input, scenes)
- **TypeScript** — type-safe game logic (strict mode)
- **Vite** — fast dev server and bundler
- **Vitest** — unit testing
- **Web Audio API** — procedural audio synthesis

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:3000)
npm run dev

# Run tests
npm test

# Type check
npm run typecheck

# Production build
npm run build
```

## Project Structure

```
src/
├── main.ts              # Entry point & Phaser config
├── config.ts            # Game constants, debug system, HTML debug panel
├── scenes/
│   ├── Boot.ts          # Asset gen, title screen, character creation
│   ├── Overworld.ts     # World map, movement, encounters, overlays
│   ├── Battle.ts        # Turn-based combat, scrollable log, sky/weather
│   ├── Shop.ts          # Item shops & inn
│   └── Bestiary.ts      # Monster encyclopedia
├── systems/
│   ├── audio.ts         # Procedural audio engine (music, SFX, footsteps)
│   ├── combat.ts        # D&D combat mechanics
│   ├── player.ts        # Player state, leveling, Point Buy, inventory
│   ├── classes.ts       # Class definitions (stats, spells, abilities, hit die)
│   ├── appearance.ts    # Cosmetic customization (skin color, hair style/color)
│   ├── daynight.ts      # Day/night cycle (360-step)
│   ├── weather.ts       # Weather system (6 types, biome-weighted)
│   ├── codex.ts         # Monster tracking & AC discovery
│   ├── debug.ts         # Shared debug hotkeys & slash commands
│   ├── dice.ts          # D&D dice rolling utilities
│   ├── encounter.ts     # Encounter state management
│   ├── movement.ts      # Grid movement logic
│   └── save.ts          # Save/load (localStorage)
├── managers/
│   ├── fog.ts           # Fog of war management
│   └── overlay.ts       # UI overlay management
├── renderers/
│   ├── hud.ts           # HUD rendering (HP/MP/XP bars, location)
│   └── map.ts           # Map rendering state & tile sprites
├── data/
│   ├── map.ts           # 10×9 chunk world, cities, dungeons, chests
│   ├── monsters.ts      # Monster definitions & encounter tables
│   ├── spells.ts        # Spell definitions & level requirements
│   ├── items.ts         # Item definitions & shop inventory
│   ├── abilities.ts     # Martial ability definitions
│   ├── npcs.ts          # NPC definitions & dialogue
│   ├── mounts.ts        # Mount definitions
│   └── talents.ts       # Talent/perk definitions
tests/
├── audio.test.ts        # Audio engine tests
├── combat.test.ts       # Combat calculation tests
├── config.test.ts       # Debug system tests
├── data.test.ts         # Game data integrity tests
├── daynight.test.ts     # Day/night cycle tests
├── dice.test.ts         # Dice utility tests
├── mounts.test.ts       # Mount system tests
├── movement.test.ts     # Movement system tests
├── npcs.test.ts         # NPC system tests
├── player.test.ts       # Player system & Point Buy tests
├── save.test.ts         # Save/load tests
└── weather.test.ts      # Weather system tests
```

## Debug Mode

Toggle the debug checkbox above the game canvas to enable:
- Scrollable debug panel with live state and action logs
- Cheat hotkeys (K=kill, H=heal, P=MP, G=gold, L=level, R=reveal map, V=fog, F=encounters)
- Slash commands (`/gold`, `/exp`, `/teleport`, `/spawn`, `/weather`, `/time`, `/audio`, etc.)

## License

ISC

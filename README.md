# 2D&D

A browser-based JRPG combining Dragon Quest-style gameplay with Dungeons & Dragons mechanics.

![Title Screen](https://github.com/user-attachments/assets/023c3b54-a6ed-4748-9e7a-15628abbc2d1)

## Features

- **WASD Movement** – Explore a tile-based overworld with forests, mountains, deserts, towns, and dungeons
- **Turn-based Combat** – D&D-style dice rolls for initiative, attack, and spells (d20 attack rolls, critical hits on nat 20, etc.)
- **Spell System** – Unlock spells as you level up (Fire Bolt, Cure Wounds, Magic Missile, Fireball, and more)
- **Leveling & XP** – Gain experience from battles, level up to increase stats and learn new abilities
- **Item Shops** – Visit towns to buy potions, weapons, armor, and rest at the inn
- **Random Encounters** – Encounter monsters in the wild, scaled to your level
- **Boss Fights** – Fixed boss locations on the map (Cave Troll, Young Red Dragon)
- **Procedural Graphics** – All sprites and tiles generated at runtime — no external assets needed

## Controls

| Key | Action |
|-----|--------|
| W/A/S/D | Move on the overworld |
| SPACE | Start game / Interact (enter shops, challenge bosses) |
| ESC | Leave shop |
| Mouse | Click battle actions, shop items |

## Tech Stack

- **Phaser 3** – Game engine (rendering, input, scenes)
- **TypeScript** – Type-safe game logic
- **Vite** – Fast dev server and bundler
- **Vitest** – Unit testing

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
├── config.ts            # Game constants
├── scenes/
│   ├── BootScene.ts     # Asset generation & title screen
│   ├── OverworldScene.ts # Tile map, movement, encounters
│   ├── BattleScene.ts   # Turn-based combat
│   └── ShopScene.ts     # Item shops & inn
├── systems/
│   ├── combat.ts        # D&D combat mechanics
│   └── player.ts        # Player state, leveling, inventory
├── data/
│   ├── map.ts           # Overworld map grid & terrain
│   ├── monsters.ts      # Monster definitions & encounter logic
│   ├── spells.ts        # Spell definitions & level requirements
│   └── items.ts         # Item definitions & shop inventory
└── utils/
    └── dice.ts          # D&D dice rolling utilities
tests/
├── dice.test.ts         # Dice utility tests
├── player.test.ts       # Player system tests
├── combat.test.ts       # Combat system tests
└── data.test.ts         # Game data integrity tests
```

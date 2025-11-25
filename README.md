# 2D&D - Browser JRPG

A browser-based JRPG game inspired by Dragon Quest (gameplay/aesthetic) and Dungeons & Dragons (lore/mechanics).

## Features

- **Player Movement**: WASD controls, Space for interactions
- **Overworld Map**: Explore different biomes (grasslands, forests, mountains)
- **Random Encounters**: Fight monsters as you explore
- **Turn-Based Combat**: D&D-style dice rolls for attacks and damage
- **Leveling System**: Gain experience, level up, and unlock spells
- **Locations**: Visit cities with shops and inns, explore dungeons, face boss encounters
- **Item System**: Buy potions, weapons, and armor from merchants
- **Rest System**: Recover HP and MP at inns

## Technology Stack

- **TypeScript**: Type-safe game code
- **React**: UI components
- **Phaser**: 2D game engine for map and movement
- **Vite**: Fast build tool and dev server

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open your browser to `http://localhost:3000`

### Build

```bash
npm run build
```

The production build will be in the `dist/` directory.

## How to Play

1. **Movement**: Use WASD keys to move your character around the map
2. **Interact**: Press SPACE when near locations (cities, dungeons) to interact
3. **Combat**: When you encounter monsters, choose to Attack, Cast Spells, or Flee
4. **Shopping**: Visit cities to buy health/mana potions, weapons, and armor
5. **Rest**: Stay at inns to restore full HP and MP (costs 10 gold)
6. **Progression**: Defeat monsters to gain XP and gold, level up to learn new spells

## Game Mechanics

### D&D-Inspired Combat
- Attack rolls use d20 + modifiers vs. enemy AC
- Damage rolls use various dice (d6, d8, d10, etc.)
- Initiative determines turn order
- Ability scores affect combat effectiveness

### Character Progression
- Level up by gaining experience
- Health increases by 1d8 per level
- Ability scores increase every 4 levels
- New spells unlock at higher levels

### Biomes
- **Grassland**: Low encounter rate, weaker enemies
- **Forest**: Medium encounter rate, mixed enemies
- **Mountain**: Higher encounter rate, tougher enemies

## License

ISC


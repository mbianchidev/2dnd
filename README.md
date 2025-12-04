# 2D&D

A 2D browser-based JRPG inspired by Dragon Quest and D&D lore.

## Overview

2D&D is a turn-based role-playing game that combines classic JRPG gameplay mechanics with D&D-inspired stat systems and combat. Built entirely with web technologies (HTML5, Canvas, JavaScript), it runs directly in the browser with no additional dependencies.

## Features

- **Turn-based Combat System**: D&D-inspired combat with attack rolls, armor class, and critical hits
- **Character Stats**: Six core attributes (Strength, Dexterity, Constitution, Intelligence, Wisdom, Charisma)
- **Party Management**: Build a party of up to 4 characters
- **Tile-based World**: Explore a procedurally rendered world with different terrain types
- **Random Encounters**: Battle enemies as you explore forests and grasslands
- **Experience and Leveling**: Gain experience and level up to become stronger
- **Multiple Character Classes**: Warriors, Mages, and Rogues with different stat distributions

## Architecture

### Core Components

#### Game Engine (`src/core/GameEngine.js`)
The main game loop using `requestAnimationFrame` for smooth 60 FPS gameplay. Handles state management, frame timing, and rendering.

#### Input Manager (`src/core/InputManager.js`)
Centralized keyboard input handling with support for key press, hold, and release detection.

### Entity System

#### Entity (`src/entities/Entity.js`)
Base class for all game objects with position and collision detection.

#### Character (`src/entities/Character.js`)
RPG character with D&D-style attributes, HP/MP management, and combat stats calculations.

#### Player (`src/entities/Player.js`)
Player-controlled character with movement capabilities.

#### Enemy (`src/entities/Enemy.js`)
Enemy characters with experience and gold drops.

### Game Systems

#### Combat System (`src/systems/CombatSystem.js`)
Turn-based battle system with:
- Initiative/turn order based on speed
- D20 attack rolls
- Critical hits and misses
- Battle log

#### Party System (`src/systems/PartySystem.js`)
Manages the player's party of characters, gold, and party-wide operations.

#### Map System (`src/systems/MapSystem.js`)
Tile-based map rendering with:
- Multiple terrain types
- Collision detection
- Random encounter generation
- Camera viewport

### Game States

#### Menu State (`src/states/MenuState.js`)
Main menu with game start options.

#### Exploration State (`src/states/ExplorationState.js`)
Main gameplay state for world exploration with:
- Player movement
- Camera following
- Random encounter triggers
- UI overlay

#### Battle State (`src/states/BattleState.js`)
Turn-based combat interface with:
- Action menu (Attack, Defend, Item, Run)
- Target selection
- Battle animations
- Victory/defeat handling

## Getting Started

### Installation

```bash
npm install
```

### Development

Run the development server:

```bash
npm run dev
```

Then open your browser to the URL shown (typically `http://localhost:5173`).

### Build

Build for production:

```bash
npm run build
```

## Controls

- **Arrow Keys**: Move character / Navigate menus
- **Enter**: Select / Confirm action
- **Escape**: Open menu

## Game Structure

```
src/
├── core/           # Core engine components
├── entities/       # Game entities (Player, Enemies)
├── systems/        # Game systems (Combat, Party, Map)
├── states/         # Game states (Menu, Exploration, Battle)
├── config/         # Game configuration and data
└── main.js         # Entry point
```

## Technical Details

- **Renderer**: HTML5 Canvas 2D API
- **Game Loop**: RequestAnimationFrame
- **State Management**: State pattern
- **Input**: Event-driven keyboard input
- **Build Tool**: Vite
- **Module System**: ES6 Modules

## Future Enhancements

- Inventory and item system
- Magic/spell system
- Save/load game functionality
- More character classes
- Equipment system
- Shops and NPCs
- Multiple maps and dungeons
- Story and quests
- Sound effects and music

## License

MIT

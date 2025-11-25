# 2DND - A Browser JRPG

A web-native JRPG built with Phaser 3 and TypeScript, featuring Dragon Quest-style turn-based combat with D&D dice mechanics.

## 🎮 Features

- **Classic JRPG Combat**: Turn-based battles inspired by Dragon Quest, with speed-based turn order
- **D&D Dice Mechanics**: Attack rolls, damage dice, critical hits, and saving throws
- **Overworld Exploration**: Tile-based world with random encounters
- **Quest System**: Track objectives, earn rewards, unlock storylines
- **Dialog System**: NPC conversations with branching choices
- **Save/Load System**: Persist progress with localStorage

## 🛠️ Tech Stack

- **Game Engine**: [Phaser 3](https://phaser.io/) - Fast 2D game framework
- **Language**: TypeScript
- **Build Tool**: [Vite](https://vitejs.dev/) - Lightning fast HMR
- **Testing**: [Vitest](https://vitest.dev/) (unit) + [Playwright](https://playwright.dev/) (E2E)
- **Code Quality**: ESLint, Prettier

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:3000
```

## 📁 Project Structure

```
src/
├── main.ts              # Game entry point, Phaser config
├── types/               # TypeScript type definitions
├── data/                # Game data (actors, monsters, items, skills, quests)
├── scenes/              # Phaser scenes (Boot, Preload, Title, Overworld, Battle)
├── systems/             # Core systems (Battle, Dialog, Quest, Save)
└── utils/               # Utility functions (dice rolling, etc.)

assets/
├── maps/                # Tiled map exports (.json)
├── sprites/             # Sprite sheets and images
├── audio/               # Music and sound effects
├── fonts/               # Custom fonts
└── attribution.md       # Asset credits and licenses

e2e/                     # Playwright E2E tests
```

## 📜 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run test` | Run unit tests in watch mode |
| `npm run test:run` | Run unit tests once |
| `npm run test:coverage` | Run tests with coverage |
| `npm run e2e` | Run E2E tests |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript type checking |

## 🎲 Combat System

Combat uses a simplified D&D-inspired system:

### Attack Rolls
- Roll d20 + attack modifier vs target AC
- Natural 20 = Critical hit (double damage dice)
- Natural 1 = Automatic miss

### Damage Calculation
- Base: Weapon die (d6) + strength modifier
- Defense reduces damage
- Defending doubles defense for the turn

### Turn Order
- Sorted by Speed stat (highest first)
- Ties broken randomly

## 🗺️ Map System

Maps are created with [Tiled](https://www.mapeditor.org/) and exported as JSON:

1. Create tilemap in Tiled
2. Set up layers: Ground, Collision, Objects
3. Export as JSON to `assets/maps/`
4. Define encounter zones as object layer

## 🎨 Adding Assets

1. Place assets in appropriate `assets/` subdirectory
2. Add attribution to `assets/attribution.md`
3. Load in `PreloadScene.ts`
4. Use in game scenes

## 📊 Data-Driven Design

All game content is defined in `src/data/`:

- **actors.ts** - Player characters
- **monsters.ts** - Enemies with stats, drops, AI
- **items.ts** - Consumables, equipment, key items
- **skills.ts** - Abilities and spells
- **quests.ts** - Quest definitions and objectives

The `ContentRegistry` validates all data references on startup.

## 🧪 Testing

### Unit Tests (Vitest)
```bash
npm run test           # Watch mode
npm run test:coverage  # With coverage report
```

### E2E Tests (Playwright)
```bash
npm run e2e     # Run all E2E tests
npm run e2e:ui  # Interactive UI mode
```

## 🚢 Deployment

Build and deploy to any static hosting:

```bash
npm run build
# Deploy contents of dist/ folder
```

Works with:
- GitHub Pages
- Netlify
- Vercel
- Cloudflare Pages

## 🎯 Roadmap

- [ ] Tiled map integration with collision layers
- [ ] Party system (multiple characters)
- [ ] Equipment and inventory management
- [ ] Shop/merchant system
- [ ] Status effects (poison, paralysis, etc.)
- [ ] Boss battles with scripted phases
- [ ] Audio (BGM and SFX)
- [ ] React overlay for complex menus (optional)

## 📄 License

MIT License - See [LICENSE](LICENSE) for details.

## 🙏 Credits

See [assets/attribution.md](assets/attribution.md) for asset credits.

# 2D&D

Browser-based mini JRPG inspired by Dragon Quest exploration and D&D dice-driven combat.

## Getting started

```bash
npm install
npm run dev
# open http://localhost:5173
```

## Controls

- **WASD**: move on the overworld
- **Space**: interact (enter shop on blue city tile, trigger dungeon events)
- **Battle**: click buttons to attack, cast spells, use items, or attempt to run

## Gameplay loop

- Explore biomes (plains, forest, desert) plus a dungeon and a fixed boss lair.
- Random encounters roll initiative (d20) and resolve attacks/spells with dice.
- Gain XP and gold; level-ups boost stats and automatically unlock spells.
- Visit the harbor shop to buy/sell healing potions, bombs, and escape tools.
- A smoke bomb guarantees escape from non-boss fights; potions heal; bombs damage foes.
- Beat the Cinder Drake boss tile to win the run.

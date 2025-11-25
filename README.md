# 2DND (Browser JRPG)

A 2D, turn-based JRPG inspired by Dragon Quest gameplay and Dungeons & Dragons lore. Built with **Vite + TypeScript + Phaser 3**.

## Quickstart

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev` – start dev server
- `npm run build` – production build
- `npm run preview` – preview build
- `npm run lint` – ESLint (flat config)
- `npm run test` – Vitest unit tests

## Structure

- `src/main.ts` – Phaser bootstrap
- `src/scenes/` – game scenes (Boot, Preload, Overworld, Battle)
- `src/core/` – battle engine and game state
- `src/data/` – data-driven content (actors, monsters, skills, items)
- `public/assets/` – game assets + `attribution.md`

## Notes

- Press **B** in overworld to start a test battle vs a slime.
- Press **A** in battle to attack; after victory/defeat, press **Space** to return.

## TODO
- Maps & collisions (Tiled integration)
- Dialog/quests
- Inventory/equipment
- Save/load (localStorage/IndexedDB)
- E2E tests (Playwright)

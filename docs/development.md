# Development guide

[Documentation index](README.md) | [Architecture](architecture.md) |
[Testing](testing.md) | [AGENTS.md](../AGENTS.md)

## Working principles

- Use strict TypeScript with explicit parameter and return types.
- Do not use `any`; validate `unknown` with guards.
- Prefer interfaces for object shapes and type aliases for unions/intersections.
- Use `import type` for type-only imports.
- Keep immutable content in `src/data/` and reusable Phaser-free logic in
  `src/systems/`.
- Keep scene orchestration in `src/scenes/`, stateful helpers in
  `src/managers/`, and procedural presentation in `src/renderers/`.
- Reuse existing helpers before adding a parallel implementation.
- Use `debugLog()` and debug-panel APIs; do not add production `console.log`.
- Do not mutate shared monster, item, map, city, dungeon, quest, or recipe data.
- No external image/audio assets and no gameplay network calls.
- When a source file exceeds 1,000 lines, consider extracting a focused module
  before adding another responsibility.

## Where to add common work

| Change | Primary files |
| --- | --- |
| Combat formula or status | `src/systems/combat.ts`, `statusEffects.ts`, `groupCombat.ts` |
| Player/companion action | `src/systems/battleActions.ts`, data action definition, focused tests |
| Monster or encounter | `src/data/monsters.ts`, `monsterVariants.ts`, `nightMonsters.ts`, `seaMonsters.ts`, `monsterGroups.ts` |
| Quest | `src/data/quests.ts`, `src/systems/quests.ts`, quest tests |
| Cutscene | focused `src/data/cutscene*.ts`, `src/systems/cutscenes.ts`, cutscene tests |
| World/city/dungeon | `src/data/map*.ts`, `chunks.ts`, `cities.ts`, `dungeons.ts`, map helpers |
| Sea navigation | `src/data/nautical.ts`, `src/systems/nautical*.ts`, `src/data/islands.ts` |
| Gathering/crafting | matching `src/data/`, `src/systems/`, and `src/managers/` modules |
| Save field | owning interface/default, normalization module, `src/systems/save.ts`, migration tests |
| Input/control | `src/systems/input.ts`, `src/managers/input.ts`; never a scene-local gamepad map |
| UI layout | `src/systems/layout.ts`, `src/managers/layout.ts`, owning manager/renderer |
| Texture | focused renderer aggregated by `src/renderers/textures.ts` |
| Audio | `src/systems/audio.ts` and typed domain profile helpers |
| Desktop shell or packaging | `electron/`, `electron-tests/`, `package.json`, desktop workflow |

Read the matching `.github/skills/*/SKILL.md` before implementing domain work.

## Dependency and build workflow

CI uses Node.js 24.

```bash
npm ci
npm audit
npm run typecheck
npm test
npm run test:browser
npm run build
npm run test:desktop
npm run build:desktop
```

Do not add a new linter, test runner, formatter, or build system for a one-off
task. Change dependencies only when the feature requires it, keep
`package-lock.json` synchronized, and verify the audit result.
Review install scripts with `npm install-scripts ls`. Keep approvals pinned to
the exact reviewed versions, omit unused packaging peers, and do not suppress
deprecation warnings with incompatible major-version overrides.

Electron development uses `npm run dev:desktop`. Keep preload single-file for
Chromium sandbox compatibility, expose only narrow typed IPC, and preserve the
browser build as the authoritative renderer. Packaging commands and security
rules are documented in [Desktop application](desktop.md).

## Debug tools

Debug mode is available only on local hosts through the checkbox above the
canvas. Shared commands live in `src/systems/debug.ts`; scene-specific adapters
provide validated callbacks.

Useful command families include:

```text
/spawn
/battleview
/backdrop
/quest
/near
/cutsceneview
/companion
/event
/alignment
/reputation
/achievement
/feature
/gather
/craft
```

Use `?forceGroup=<templateId>` on a local game URL to force the next random
encounter to a known group, for example `?forceGroup=slimeSwarm`.

Use debug commands to create deterministic browser states, then synchronize
Playwright on debug-state transitions or stable layout IDs instead of arbitrary
sleep durations and coordinates.

## Utility scripts

Repository utilities belong in `hacks/` and must be documented in
`hacks/instructions.md`. Temporary scripts must be removed when the task is
finished. Do not add planning or summary Markdown files to the repository.

The permanent `hacks/run-browser-tests.mjs` wrapper allocates a fresh local port
for the Playwright suite.

## Documentation ownership

Update documentation in the same change when behavior, commands, architecture,
versions, controls, or persistent data change:

- public discovery and quick start: root `README.md`
- detailed topic guidance: `docs/`
- agent workflow and ownership routing: root `AGENTS.md`
- repository-wide constraints: `.github/copilot-instructions.md`
- domain implementation rules: `.github/skills/*/SKILL.md`

Do not describe issue proposals or open pull requests as shipped behavior.
Verify claims against current `main`.

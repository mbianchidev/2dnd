# Architecture

[Documentation index](README.md) | [Development](development.md) |
[Save system](save-system.md)

## Stack and runtime

| Component | Current version or contract |
| --- | --- |
| Phaser | 4.2.1 |
| TypeScript | 7.0.2, strict, ES2020 target |
| Vite | 8.2.1 |
| Vitest | 4.1.10 |
| Playwright | 1.62.1 |
| happy-dom | 20.11.1 |
| Electron | 43.4.0 |
| electron-builder | 26.15.7 |
| Campaign save schema | 18 |

The web build is a static Vite multi-page application with an optional Electron
shell. `index.html` is the public showcase, while `game.html` starts the Phaser
runtime. Showcase screenshots are captures from that runtime, not external art.
The game loads no external image or audio assets and makes no gameplay network
calls. Textures are generated procedurally; music and sound effects use Web
Audio synthesis.

## Responsibility boundaries

| Area | Ownership |
| --- | --- |
| Immutable definitions | `src/data/` |
| Phaser-free mechanics, normalization, contracts | `src/systems/` |
| Stateful scene helpers and overlays | `src/managers/` |
| Procedural textures and focused presentation | `src/renderers/` |
| Scene orchestration and lifecycle | `src/scenes/` |
| Public showcase | `index.html`, `src/landing.css`, `public/screenshots/` |
| Logic and contract tests | `tests/` |
| Real-browser release flows | `e2e/` |
| Desktop main/preload/security boundary | `electron/` |
| Production-like desktop flows | `electron-tests/` |

`src/data/map.ts` is the map hub. World chunks, cities, dungeons, islands,
nautical metadata, monsters, quests, cutscenes, crafting, gathering, and other
large domains live in focused modules rather than one monolithic data file.

## Scenes and shared state

`game.html` loads `src/main.ts`, which registers:

| File | Scene key |
| --- | --- |
| `src/scenes/Boot.ts` | `BootScene` |
| `src/scenes/Overworld.ts` | `OverworldScene` |
| `src/scenes/Battle.ts` | `BattleScene` |
| `src/scenes/Shop.ts` | `ShopScene` |
| `src/scenes/Codex.ts` | `CodexScene` |
| `src/scenes/Cutscene.ts` | `CutsceneScene` |
| `src/scenes/Ending.ts` | `EndingScene` |
| `src/scenes/Defeat.ts` | `DefeatScene` |

State-bearing transitions use `createSharedSceneState()` from
`src/systems/sceneState.ts` and preserve:

```typescript
{
  player,
  defeatedBosses,
  codex,
  timeStep,
  weatherState,
  savedSpecialNpcs,
}
```

Scene-specific contracts add only runtime context: Battle receives the encounter
and biome plus optional party adapters/hooks; Shop receives shop/city context;
Cutscene receives a stable cutscene ID and replay/return context; Ending receives
the epilogue ID; Defeat receives the exact already-applied recovery receipt.
Persistent companions remain nested in `player.party`.

When a scene input contract changes, update every caller and every transition
test in the same change.

## Transition lifecycle

`src/managers/sceneTransition.ts` is the only owner of camera fades and queued
scene handoffs.

1. Call `prepare()` at the start of scene `create()`.
2. Guard duplicate transitions.
3. Wait for Phaser's fade-complete event.
4. Use the duration-plus-grace watchdog only as recovery.
5. Remove listeners and timers.
6. Restore the outgoing camera before queueing the next scene.
7. Block state-changing input while a handoff is pending.

Phaser scene starts and restarts are queued until the next Scene Manager update.
Equal-duration timers are therefore not authoritative and can produce black
screens or duplicate state changes.

## Input, discovery, and accessible UI

`src/systems/input.ts` defines typed semantic actions, contexts, mappings,
dead zones, repeats, source switching, and duplicate suppression.
`src/managers/input.ts` is the only browser adapter for keyboard, pointer,
gamepad, and touch.

Feature visibility and action gating live in
`src/data/featureDiscovery.ts` and `src/systems/featureDiscovery.ts`. Hidden
entries must be filtered before layout so they leave no blank row, stale index,
invisible hit target, shortcut, touch action, or gamepad gap.

Pure layout math lives in `src/systems/layout.ts`. Phaser scaled bounds, reflow,
hit-area synchronization, group registration, and audit reporting live in
`src/managers/layout.ts`. Modal content uses `createOverlayContainer()` and
stable layout IDs. Tests should select those IDs rather than canvas coordinates.

Every scene installs shared accessibility. New motion must use the reduced-motion
accessors and complete callbacks exactly once even when animation duration is
zero.

## Desktop shell

Electron production builds load `dist/game.html` from the standard, secure
`app://2dnd` origin, bypassing the public showcase without creating a separate
game renderer. `electron/main.ts` owns BrowserWindow lifecycle, protocol
resolution, permissions, remote-request denial, navigation, crash reporting,
and IPC validation. The sandboxed single-file `electron/preload.cts` exposes
only typed window/log state, fullscreen control, bounded renderer-error
reporting, and application quit.

The renderer remains the same Vite/Phaser application. `window.desktop` is
optional, so browser builds never depend on Electron. Native code must not
mutate game state, read arbitrary files, execute commands, or create a second
persistence implementation. The main process owns bounded rotating diagnostic
logs and trusted quit/fullscreen IPC; the in-game return-to-title path remains a
save-first Phaser transition. See [Desktop application](desktop.md).

## Combat authority

Combat formulas live in `src/systems/combat.ts`,
`src/systems/groupCombat.ts`, `src/systems/statusEffects.ts`, and
`src/data/elements.ts`.

`src/systems/battleActions.ts` is the shared action planner and executor for
manual party turns and gambits. It owns target resolution, resource validation,
one-action/one-bonus-action economy, immutable plans, and dispatch through
`executeValidatedBattleAction()`. Scenes and AI must not duplicate MP, item,
target, formation, status, element, or economy rules.

Mechanics resolve before presentation. Actor animation receives stable IDs and
immutable outcomes; tweens never apply damage, spend resources, or control
authoritative turn/result transitions.

## Content and campaign flow

- Quest definitions: `src/data/quests.ts`
- Quest runtime APIs: `src/systems/quests.ts`
- Quest normalization/debug: `src/systems/questState.ts`,
  `src/systems/questDebug.ts`
- Cutscene contracts/content: `src/data/cutsceneTypes.ts`,
  `src/data/cutsceneCampaign.ts`, `src/data/cutsceneBosses.ts`
- Cutscene trigger/queue/recovery: `src/systems/cutscenes.ts`
- Cutscene progression/presentation: `src/managers/cutscene.ts`,
  `src/scenes/Cutscene.ts`, `src/renderers/cutscene.ts`

Stable IDs, objective counters, reward IDs, completion actions, and cutscene
queues make reload and replay idempotent. Chronicle replay is presentation-only.

## Procedural presentation

Boot invokes `src/renderers/textures.ts`. Focused renderers own monster
silhouettes, hero textures, items, traps, maps, cities, result screens, and
Battle scenery. `src/renderers/battleDepth.ts` defines the shared depth order;
`src/renderers/battleBackdrop.ts` owns scene-sized backdrop layers and cleanup.

Current hero visuals resolve from live `PlayerState` through
`src/systems/heroVisuals.ts` and cleanup-safe leases from
`src/renderers/heroTextures.ts`. Overworld, Battle, Cutscene, and Ending share
that pipeline.

All audio synthesis lives in `src/systems/audio.ts`. Do not add external media
or scene-local parallel audio engines.

## Persistence boundaries

Only authoritative, non-reconstructable state belongs in the campaign save.
Definitions, names, thresholds, categories, totals, derived unlocks, and
presentation preferences stay canonical or derived. See
[Save system](save-system.md).

`src/systems/saveStorage.ts` owns the typed localStorage adapter, stable
autosave/manual IDs, verified staging, and per-slot backup recovery.
`src/systems/save.ts` keeps campaign normalization authoritative,
`src/systems/saveSlots.ts` owns metadata and management operations, and
`src/managers/saveSlots.ts` provides the shared title and Overworld interface.
Electron uses the same renderer-owned storage path and exposes no native
filesystem API for slot import/export.

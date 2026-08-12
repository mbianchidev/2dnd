---
name: phaser-scene-management
description: Manage Phaser 4 scenes in 2D&D with correct state flow, cleanup, and transitions
license: MIT
---

# Phaser 4 Scene Management

## Scenes and keys

| File | Class | Scene key |
| --- | --- | --- |
| `Boot.ts` | `BootScene` | `BootScene` |
| `Overworld.ts` | `OverworldScene` | `OverworldScene` |
| `Battle.ts` | `BattleScene` | `BattleScene` |
| `Shop.ts` | `ShopScene` | `ShopScene` |
| `Codex.ts` | `CodexScene` | `CodexScene` |
| `Cutscene.ts` | `CutsceneScene` | `CutsceneScene` |
| `Ending.ts` | `EndingScene` | `EndingScene` |
| `Defeat.ts` | `DefeatScene` | `DefeatScene` |

Register scenes in `src/main.ts`. The Phaser 4 configuration uses FIT scaling,
centered pixel art, and zoom 6.

## Imports and class shape

```typescript
import * as Phaser from "phaser";

export class ExampleScene extends Phaser.Scene {
  constructor() {
    super({ key: "ExampleScene" });
  }

  init(data: ExampleSceneData): void {
    // Store and normalize scene input.
  }

  create(): void {
    // Build display objects, input, audio, and scene-owned helpers.
  }
}
```

Use explicit types and return values. Store Phaser objects that need later
updates or cleanup as class properties.

## Semantic input

`src/systems/input.ts` owns stable action/context contracts and pure state.
`src/managers/input.ts` is the single browser adapter for keyboard, pointer,
standard gamepads, and touch. Scenes must use the shared actions or existing
keyboard/pointer behavior reached by that adapter rather than adding independent
gamepad/mobile mappings. The adapter clears held input on scene changes, blur,
visibility loss, disconnect, and shutdown.

Touch controls use safe-area-aware responsive DOM buttons outside the canvas.
Held D-pad directions use pointer capture; discrete buttons use click pulses so
scene transitions cannot strand a press. Standard gamepads use left-stick/D-pad
navigation and a visible right-stick cursor, clicked by pressing the stick, for
pointer-first surfaces.

Feature-gated semantic actions use `src/systems/featureDiscovery.ts`. Dynamic
menus and tabs rebuild from filtered entries, clamp selection, remove hidden
hit areas, and update procedural touch controls. Untaught shortcuts stay inert,
while always-safe cancel, Tips, Settings, Inventory, Map, Equipment, and
save/title paths remain available.

`CodexScene` keeps category, filter, sort, and search controls pointer-first so
touch and the gamepad cursor share the keyboard surface. Search uses
`openMobileTextInput()`. `CodexDiscoveryManager` owns non-interactive,
scene-local notices and must be cleared on shutdown; it never changes input
context or delays scene transitions.

`AchievementOverlayManager` owns the accessible Achievements/profile surface and
presentation-only title selection. `AchievementNotificationManager` reads
persisted pending IDs but displays them only in safe Overworld states; scene
shutdown clears visuals without acknowledging an interrupted notice. Both must
support keyboard, pointer, touch-menu access, gamepad cursor, text scaling,
high contrast, and reduced motion.

`GatheringManager` owns the in-place fishing/mining/foraging overlay, input,
timers, pointer controls, status record, and cleanup. Overworld resumes pending
gathering before World Events, blocks movement and other interactions while it
is open, and routes guarded rare finds through Battle with resolution hooks.

## Shared state flow

State-bearing transitions use `createSharedSceneState()` and preserve:

```typescript
interface SharedSceneState {
  player: PlayerState;
  defeatedBosses: Set<string>;
  codex: CodexData;
  timeStep: number;
  weatherState: WeatherState;
  savedSpecialNpcs: SavedSpecialNpc[];
}
```

Scene-specific additions:

- Battle: `encounter: MonsterEncounter`, `biome`, optional accessor-backed
  `partyCombatants`, optional runtime-only `battleHooks`; Battle may return
  transient `questUpdates` to Overworld after victory
- Shop: `townName`, optional item IDs, city context, discount, and optional
  stable `shopSkillCheckId`
- Overworld: fields are optional only because Boot can create or load the
  initial state
- Cutscene: full shared state, stable `CutsceneId`, replay mode, return scene,
  and optional runtime-only `questUpdates`
- Ending: full shared state plus the campaign-epilogue `CutsceneId`
- Defeat: full shared state plus encounter name/type and an exact runtime-only
  `PartyDefeatResult`

When a scene contract changes, update every `scene.start()` caller in the same
change.

`player.party` is persistent nested state and travels automatically with
`player`. Battle may additionally receive runtime-only accessor-backed
`partyCombatants`; never serialize those wrappers.

## Transition pattern

```typescript
this.sceneTransitions.startWithFade(() => {
  this.scene.start("OverworldScene", {
    player: this.player,
    defeatedBosses: this.defeatedBosses,
    codex: this.codex,
    timeStep: this.timeStep,
    weatherState: this.weatherState,
    savedSpecialNpcs: this.savedSpecialNpcs,
  });
}, {
  duration: 500,
  label: "return to overworld",
});
```

Do not serialize `Set<string>` during scene transitions. Conversion to arrays
belongs in the save system.

`SceneTransitionManager` is the single owner of camera fades and queued scene
handoffs. Instantiate it once per scene, call `prepare()` at the start of
`create()`, and use its guarded start/restart methods instead of direct
fade-plus-timer pairs. Fade-complete events are primary; the duration-plus-grace
watchdog only recovers missing events. The manager must remove completed
listeners/timers, restore the outgoing camera before queueing the next scene,
and suppress duplicate handoffs during Phaser's one-update queue delay.
It resolves fade durations through the shared reduced-motion accessor and uses
an immediate guarded handoff when motion is disabled.

Call `installSceneAccessibility(this)` in every scene `create()`. The adapter
applies live text scale and high contrast, exposes preference state on the
canvas for browser assertions, and suppresses residual tweens in reduced-motion
mode. New scene animations must also branch through
`isReducedMotionEnabled()` or `getMotionDuration()`.

Use `ActorAnimationDirector` for reusable actor poses and cleanup. Specialized
battle/world directors register sprites by stable actor ID, use explicit
`ActorTextureFamily` frame keys with fallback textures, and expose deterministic
debug state for browser synchronization. Kill owned tweens/timers on shutdown;
never wait for actor animation before an authoritative fade-complete handoff.

Overworld restarts use one shared payload that includes a fresh
`savedSpecialNpcs` snapshot. Block movement and other state-changing actions
while a handoff is pending.

Queue and save cutscene IDs before presentation. `CutsceneScene` and
`EndingScene` mark an ID seen and dequeue it only after completion or skip, then
chain the next pending ID. Reload resumes the first pending scene. Chronicle
replay never mutates progression. A skipped pre-boss scene still executes its
completion metadata and starts the selected fight. Add an input grace period
when a dialogue keypress can cross a scene boundary.

## Procedural assets

`BootScene.preload()` calls texture generation from
`src/renderers/textures.ts`. Add new procedural texture generation there and
invoke it through the existing aggregate generator. Do not load image, sprite,
or audio files.

Player-specific runtime textures are the exception to Boot-time aggregation:
resolve their typed descriptor from live `PlayerState` with `heroVisuals.ts`,
acquire them through `heroTextures.ts`, and release the lease only after the
owning sprite/container is destroyed or has switched textures. This keeps
cutscene recovery and Chronicle replay current without generic-frame flashes or
texture leaks.

## Scene-owned subsystems

Overworld delegates to renderers and managers. Instantiate these in `init()` so
a restarted scene receives fresh helpers, then load persisted data into them:

- `FogOfWar`
- `EncounterSystem`
- `MapRenderer`
- `CityRenderer`
- `PlayerRenderer`
- `HUDRenderer`
- `OverlayManager`
- NPC and dialogue managers
- `QuestJournalManager`
- `QuestFlowManager`
- `ChronicleManager`
- `SkillCheckManager`
- `DebugCommandSystem`
- `CompanionFollowerManager`
- `PartyOverlayManager`

Battle delegates companion manual/gambit turn UI to `BattlePartyManager` and
companion presentation to `BattlePartyRenderer`. Destroy their transient
containers on scene exit/restart.

`BattleBackdropRenderer` owns all scene-sized environment containers, actor
shadows, split rear/front weather, lightning timers, inspection labels, and
cleanup. Use `BATTLE_DEPTH` for backdrop, actor, presentation, weather, and UI
objects; opaque sky geometry must remain below celestial bodies and scenery.

Before replacing `FogOfWar` or `EncounterSystem`, preserve their debug toggle
state so Battle, Shop, and Codex round trips do not re-enable fog or encounters.

## UI layout

- Use `src/systems/layout.ts` for pure measured stacks, grids, wrapping,
  pagination, safe-area clamping, and focus restoration.
- Use `src/managers/layout.ts` for actual scaled Phaser bounds, text-stack
  reflow, hit-area synchronization, and debug/test overlap audits.
- Register modal containers with `createOverlayContainer()` and their final
  content viewport. Give interactive rows stable `layoutId` values.
- Filter hidden or disabled entries before layout; variable-length menus must
  not retain fixed indexes, blank rows, or invisible hit targets.
- Keep action buttons visibly disabled outside the player turn.
- Destroy or replace transient menus before opening another.
- For scrollable text, bound what is rendered to the visible area.

Phaser 4 geometry masks do not reliably clip the Battle log in this project.
The Battle scene renders only messages that fit and changes the message offset
on mouse-wheel input.

## Battle lifecycle

- Reinitialize phase, menus, turn flags, discoveries, and monster effects in
  `init()`.
- Build fresh per-monster combatants, sprites, text, status arrays, defend
  flags, discovery state, and initiative order in `init()`.
- Create the hero through `createHeroCombatant()` so HP/effects stay backed by
  PlayerState; companion wrappers use the same `PartyCombatant` contract.
- Process player and each monster's statuses at that actor's turn boundaries.
- Dispatch initiative by `combatantId`. Companion turns route through
  `onCompanionTurn`, which receives all actors plus execution/log adapters and
  must call `completeTurn()`.
- Companion turn context also supplies weather penalty, synergy defense, and
  elemental-discovery adapters for `executeValidatedBattleAction()`.
- Companion hooks use the pure `battleActions.ts` planner for gambit matching,
  target validation, and action dispatch rather than scene-local rules.
- BattleScene's hero action flags are backed by the same
  `BattleActionEconomyState`; reset it at the start of each hero turn.
- Skip defeated initiative entries and keep Player Defend active until the
  next player turn.
- Target mode supports pointer selection, arrows/WASD cycling, Enter/Space
  confirmation, Esc cancellation, gamepad selection/confirmation, and touch.
- Battle action buttons expose a non-color `▶` selection marker for keyboard and
  gamepad focus before targeting.
- Keep bonus-action abilities and the first item use on the player turn.
- Validate actions before consuming MP, items, or the turn.
- Clear player and every monster's combat effects before leaving Battle.
- Guard every Battle exit through `SceneTransitionManager`. Start Overworld or
  `DefeatScene` from `FADE_OUT_COMPLETE` or the delayed recovery watchdog, and
  restore the outgoing camera before Phaser queues the handoff.
- Report victory, defeat, or flee once through `onBattleResolved`; reward
  adjustment happens before XP/gold are granted.
- On defeat, apply the party penalty once, autosave the recovered state, pass
  the exact receipt to `DefeatScene`, and never recalculate it there. Random and
  boss encounters use the same recovery mechanics.
- After group victory, record every defeated combatant ID for quest counters
  without deduplicating repeated monster types, then pass transient updates to
  Overworld for notification and autosave.
- Destroy `BattleBackdropRenderer` so its weather emitters, lightning timers,
  labels, shadows, and containers are released together.
- Also remove Battle input listeners and transient menus before result or
  Overworld handoff.
- Clean up the battle presentation director before destroying party sprites.
  Debug instant victory must still produce faint/victory presentation through
  the normal battle-end path.
- Route debug instant victory through the normal end check even during the
  pre-turn `init` phase.

## Debug and errors

Use `debugLog()`, `debugPanelLog()`, and `debugPanelState()`. Do not add
`console.log`. Invalid user actions should produce visible feedback and leave
the scene in a usable phase.

## Validation

1. Type-check every changed scene contract.
2. Test pure logic in Vitest.
3. Run the affected browser flow with headless Chromium.
4. Confirm keyboard, pointer, scrolling, transitions, and cleanup.

## Common pitfalls

- Stale scene keys such as `Overworld` instead of `OverworldScene`
- Passing arrays where `Set<string>` is expected
- Dropping weather or special-NPC state during transitions
- Reusing orphaned tween/input state after a scene restart
- Resetting scene-local debug toggles during a round trip
- Depending on Phaser 3-only behavior
- Hardcoded UI positions that overlap after scaling

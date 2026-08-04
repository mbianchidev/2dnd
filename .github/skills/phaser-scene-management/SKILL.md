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

Before replacing `FogOfWar` or `EncounterSystem`, preserve their debug toggle
state so Battle, Shop, and Codex round trips do not re-enable fog or encounters.

## UI layout

- Calculate actual text and container bounds, including scale.
- Use shared panel/dimmer helpers where available.
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
  confirmation, and Esc cancellation.
- Keep bonus-action abilities and the first item use on the player turn.
- Validate actions before consuming MP, items, or the turn.
- Clear player and every monster's combat effects before returning to
  Overworld.
- Guard Battle return through `SceneTransitionManager`. Start Overworld from
  `FADE_OUT_COMPLETE` or the delayed recovery watchdog, and restore the
  outgoing camera before Phaser queues the handoff.
- Report victory, defeat, or flee once through `onBattleResolved`; reward
  adjustment happens before XP/gold are granted.
- After group victory, record every defeated combatant ID for quest counters
  without deduplicating repeated monster types, then pass transient updates to
  Overworld for notification and autosave.
- Clean up weather emitters and timers owned by Battle.
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

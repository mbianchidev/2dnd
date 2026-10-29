# Architecture

[Documentation index](README.md) | [Development](development.md) |
[Save system](save-system.md)

## Stack and runtime

| Component | Current version or contract |
| --- | --- |
| Development/CI Node.js | 26.12.1, pinned in `.nvmrc` |
| Phaser | 4.2.1 |
| TypeScript | 7.0.2, strict, ES2020 target |
| Vite | 8.3.5 |
| Vitest | 5.0.5 |
| Playwright | 1.64.1 |
| happy-dom | 21.0.4 |
| Electron | 45.0.0 |
| electron-builder | 26.18.0 |
| Campaign save schema | 27 |

The development/build Node.js pin is separate from Electron's embedded Node.js,
which follows the Electron dependency rather than `.nvmrc`.

The web build is a static Vite multi-page application with an optional Electron
shell. `index.html` is the public showcase, while `game.html` starts the Phaser
runtime. Showcase screenshots are captures from that runtime, not external art.
The game loads no external image or audio assets and makes no gameplay network
calls. Textures are generated procedurally; music and sound effects use Web
Audio synthesis.

Immutable area scores, motifs and phrase rhythms live in `data/music.ts`;
`systems/music.ts` resolves deterministic arrangements and read-only battle
pressure. `systems/musicPlayback.ts` owns audio-clock scheduling, bounded
voices and independent track crossfades; `systems/audio.ts` routes synthesis
through shared channels and isolated audio randomness. Overworld selects city, dungeon,
sailing or region music from live location state, and shops retain the canonical
city score rather than using their decorated display title. See [Area music](audio.md).

Production builds use Phaser's supported modular `phaser-no-physics.js` entry:
2D&D uses neither Arcade nor Matter. Both Canvas/WebGL renderers and Phaser's
normal sound API remain available; GPU inspection is disabled. The game disables
Phaser's unused sound manager to avoid a second AudioContext; the existing
procedural Web Audio engine still owns every cue and live volume setting. Rolldown splits
engine and game modules into bounded, entry-aware chunks without increasing the
default 500 kB warning limit. Strict execution order preserves existing data
initialization cycles. Emitted JS/CSS keep the `game-` asset namespace accepted
by the unchanged Steam allowlist. The showcase does not preload the game graph.
Development retains Phaser's published ESM entry.

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

`FogOfWar.revealCity()` reveals every district of only the entered city using
the existing legacy-compatible keys. Overworld applies it before rendering,
including loaded/returned city states. Overworld and dungeon fog remain
exploration-based. Archery targets and seated dice players are non-blocking
world props with the same canonical activity IDs and interaction transactions.

City and cutscene NPCs share `systems/npcVisuals.ts` and
`renderers/npcTextures.ts`: canonical named NPC IDs resolve their actual template,
skin, hair and clothes without whole-body tinting. Cutscene bosses use their
existing monster-family textures. Actor cues retain stable staging IDs, with
typed NPC references rather than presentation-only placeholder colors.

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
Pure input policy suppresses mobile rails on native desktop even with saved
Touch On and maps native canvas touch to pointer-first prompts. The adapter
does not create mobile DOM controls there; mobile-only Settings rows are
filtered without hidden targets. WASD remains gameplay input outside text
fields; the shared dialog isolates physical typing and forwards key releases
so a previously held game key cannot stick.
`src/managers/titleMenu.ts` owns title selection and large direct-pointer hit
targets so touch D-pad/A input and visible buttons activate the same actions.
The new-game overwrite confirmation uses a compact centered layout that remains
fully usable in mobile landscape.
Spatial button grids use shared layout navigation so all four directions match
their visual rows and columns. Character creation supports D-pad navigation plus
confirm/cancel throughout. MENU and TIPS touch buttons appear only in the safe
exploration context.

`src/systems/textEntry.ts` owns the controller keyboard's immutable key rows
and selection/edit rules. `src/managers/textEntry.ts` owns the shared HTML
dialog, modal isolation, live accessibility, once-only commit/cancel and focus
restoration. The input adapter re-exports `openMobileTextInput()` and routes
semantic actions to this dialog before emitting game keys. The right-stick
cursor also reaches existing desktop DOM controls.
Controller face-position hints share arrow/circle icons rather than compass
words. Switching to physical typing retains the first character and hides the
controller key grid; native gamepad text entry remains available.
Discrete touch pulses release at the complete Phaser poststep boundary, not a
zero-delay timer that can erase `JustDown` before scene polling. The shared
adapter owns pulse tokens and scene listeners, preserves other held owners,
and clears pending releases on blur, visibility, disconnect, context/scene
change and destruction.

Feature visibility and action gating live in
`src/data/featureDiscovery.ts` and `src/systems/featureDiscovery.ts`. Hidden
entries must be filtered before layout so they leave no blank row, stale index,
invisible hit target, shortcut, touch action, or gamepad gap.

Pure layout math lives in `src/systems/layout.ts`. Phaser scaled bounds, reflow,
hit-area synchronization, group registration, and audit reporting live in
`src/managers/layout.ts`. Modal content uses `createOverlayContainer()` and
stable layout IDs. Tests should select those IDs rather than canvas coordinates.
The audit includes natural glyph/padding bounds inside fixed text surfaces,
nested containers, and explicitly registered graphic bounds such as progress
bars, swatches, and hero previews. A clean outer rectangle alone does not prove
that its text is readable.

Scenes inject `installSceneLayoutAudit` into `installSceneAccessibility`; pure
preferences never dynamically import the Phaser adapter. Unchanged preferences,
text styles and debug/layout reports do not rewrite DOM properties every frame.
Group registration, replacement, destruction and viewport changes coalesce into
a next-frame audit, including in-place overlay reflow; the 200-ms audit remains
for other animated/in-place changes.
Captured callbacks are invalidated on shutdown, and an old container cannot
unregister its replacement.

`subscribeOverlayReflow()` coalesces preference/source/resize changes at a frame
boundary and defers replacement while a pointer is held. Disposal also
invalidates callbacks already captured by the current event emission, preventing
reflow against text destroyed by a menu or scene handoff. Character creation
keeps cosmetic choices and rolled/allocated scores in the owner while the
appearance manager and stat renderer rebuild only presentation. Save and
achievement renderers measure wrapped sections and paginate available space;
equipment/status/inventory pages retain their existing source-owned actions and
values. Inventory page navigation uses measured pages and original inventory
indexes, never reorders ownership. Tips/tutorial controls wrap and separate
their measured headers, body, cards and footer; longer Tips content is paged.
Map labels are bounded near their anchors, and simultaneous bottom messages
and location prompts occupy separate measured rows.
The Escape menu also measures every caption, including Save & Return to Title,
and reveals all available actions across pages when the full discovered menu
cannot fit. Hidden page controls are inert; keyboard selection follows the same
stable action IDs and brings its page into view.

Achievement and Codex notices share the measured, non-interactive
`renderers/notification.ts` panel. Overworld reconciles their visibility after
each scene update: opening any menu, dialogue or activity removes an active
notice and its timers without acknowledging unseen feedback. Achievement IDs
remain in their existing persisted queue; the latest Codex batch stays
runtime-only. Notices resume when safe, with stale completion callbacks rejected.
Shop defers acquired-item lore IDs through the full shared return payload,
rather than covering its buy/sell or confirmation menus. Notice reflow and
live regions never take input focus or delay a scene handoff.

The input adapter reads Phaser's current parent bounds before refreshing FIT
scaling when the canvas host changes. `refresh()` alone uses cached parent
dimensions and can let the canvas extend past the window. Dice overlays track
the canvas without changing its host dimensions.

Every scene installs shared accessibility. New motion must use the reduced-motion
accessors and complete callbacks exactly once even when animation duration is
zero.

World actor presentation never restores externally owned movement coordinates
or replaces live facing/equipment textures. Idle breathing uses scale rather
than competing with travel tweens. Unbinding removes idle motion; live reduced
motion settles active actor presentations immediately.
`systems/battleEffects.ts` supplies deterministic pixel-impact geometry;
`renderers/battleEffects.ts` owns one Graphics object/tween per affected actor,
at most eight concurrent impacts, recovery timers and stale-callback guards.
Strike, critical, spell, healing and guard silhouettes consume resolved outcomes
only. Reduced motion retains the existing readable result cues without impacts.

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

Steam delivery is tooling, not a gameplay dependency. `steam/config.ts`,
placeholder VDFs and the emulation recipe define native Linux x64, Windows x64
and macOS universal depots. `hacks/prepare-steam.mjs` inspects source/ASAR/
architecture/licenses and emits hash receipts without account credentials.
SDK, native Steam Input API, Steam achievements and Cloud are disabled.
Protected manual upload never sets a branch live; Steam client, physical Deck,
signing and store operations remain human gates in [Steam preparation](steam.md).

## Combat authority

Physical types and common affinity precedence live in `data/damageTypes.ts`;
size, anatomy and part anchors in `data/anatomy.ts`; legacy weapon resolution in
`data/itemCombat.ts`. `systems/physicalCombat.ts` owns aim validation, physical
adjustments and status application at the existing combat resolver.
`managers/battleBodyTarget.ts` shares measured, accessible hero/companion aiming.
Armor resistance is canonical item metadata resolved through live party
accessors, independently of AC. Typed monster attacks and physical ability
components use the same physical modifier and exact dice/HP receipt pipeline.
Pure elemental abilities retain their original damage path.
Parts use one monster HP pool and the existing status clock, never a parallel
action/limb engine. See [Physical combat](physical-combat.md).

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

## Difficulty composition

`src/data/difficulty.ts` owns immutable profiles and constrained Custom bounds.
`src/systems/difficulty.ts` derives rules, previews, scaling and eligibility;
`difficultyState.ts` normalizes canonical selection/continuity, and
`enemyTactics.ts` owns bounded enemy targeting and chance policy. The focused
`src/managers/difficulty.ts` owns measured, accessible creation/settings
presentation without spending resources or replaying outcomes.
Confirmed mid-campaign changes use the Phaser-free safe-state transaction,
which owns cause append, no-op detection, pending-domain validation and exact
metadata rollback when autosave fails. Scene callbacks provide accepted-input
and transition state, never their own rule composition.

Standard is exact baseline. Enemy HP uses an isolated runtime copy, while base
definitions remain authoritative for Codex persistence. Accuracy does not leak
into initiative or saves. Group rewards scale after the existing group
adjustment; party distribution never scales twice. Timed-round suggestions are
optional typed hooks, not countdowns or permission to enable timing. See
[Difficulty and Custom rules](difficulty.md).

## Timing and resolved dice

Optional timing uses `systems/battleTiming.ts` for active decision time and
once-only validated Defend, `battleTimingSettings.ts` for configuration repair,
and `managers/battleTiming.ts` for accessible scene-owned cues and cleanup.
Shared input availability reports focus, visibility, text entry, and controller
recovery. Standard creates no timer; timed menus retain existing hero mechanics
and manual companion action validation. Configuration alone is persisted;
runtime duration suggestions cannot enable timing. See
[Timed battle decisions](battle-timing.md).
`rollResults.ts` captures exact immutable natural-die/effect receipts;
`effectRolls.ts` retains canonical damage/healing faces, signed modifiers,
recorded adjustments, resolved amounts and the HP delta at its owning write.
It preserves existing RNG order, shared area pools, finite fractional custom
item effects, resource use and result-hook timing; scene adapters only capture
their existing shield/healing writes. `dicePresentation.ts`
projects only permitted information and owns scene-local evidence. The
scene-owned dice manager and pointer-transparent procedural SVG game
throw layer consume those results without
RNG, resource mutations, input-block reasons, or gameplay completion callbacks.
Battle routes redacted detail only into its existing lower bounded log and accessible
counterpart; its pixel-dice layer adds no duplicate caption strip. Non-battle results expire after three seconds with an optional
250-ms fade. No history or latest result crosses a scene handoff; event reset,
blur and shutdown cancel visuals, cues and owned timers.
See [Dice presentation](dice-presentation.md).
`diceMotion.ts` owns measured deterministic travel, multi-axis tumble, bounce
and settled layout, not physics that determines faces. Normal/Fast take
900/300 ms; Instant/reduced motion stay static. Ordinary rolls default enabled
and may be Off, while canonical attack crit/fumble feedback always shows without
reclassifying checks/saves/initiative. Skip, replacement, window
visibility/resize and scene cleanup cancel owned visual work without delaying
mechanics or stealing focus. Motion evidence files/video are test artifacts,
not gameplay/save data or a portable performance budget.

## Hero progression authority

`data/classProgression.ts` registers twelve immutable base profiles, six prestige
profiles, and one NG+-epic profile. Original path, action and lore content lives in focused
`data/prestige.ts`, `prestigeActions.ts` and `prestigeLore.ts`.
`systems/classProgression.ts` owns qualification, rank/
total queries, grant provenance, frozen previews, rest-ready queues and atomic
one-level commits. `classProgressionState.ts` normalizes unknown ownership,
knowledge, resources, pending receipts and equipment links.

Hero ownership lives in `player.classProgression`, independently of visual
appearance; the existing `level` mirrors total owned ranks. Companions do not
own hero progression. Proficiency/ASIs/common talents use total level,
restricted grants use source rank, and shared IDs/bonuses apply once.
`managers/heroProgression.ts` owns measured, accessible presentation rather
than another leveling or action engine. Normal total level remains 20.
Validated NG+ metadata authorizes total 30 through the ten-rank Epic Roadwarden
profile; base/prestige ownership still totals at most 20. Runtime companion
policy binds to the owning campaign rather than serializing another cap.
`classProgressionContext.ts` binds completed quest stages, discovered cities and
inclusive social ranges to the live owner for preview and fresh commit. Grouped
requirements fail closed; earned ranks never recheck mutable joining evidence.
`systems/prestige.ts` derives readable qualification and complete rank tables.

`systems/heroItemState.ts` owns typed serialized hero-item validation and
complete duplicate-equipment matching. Well-formed custom hero ownership stays
intact; companion-only canonical loadout restrictions do not cross this boundary.
`saveActor.ts` validates the required campaign core and reuses that item guard
before the progression normalizer relinks equipment; it never reapplies grants.

See [Hero progression](hero-progression.md).

`newGamePlus.ts`, `newGamePlusState.ts`, `newGamePlusSlots.ts`, and
`newGamePlusScaling.ts` own detached carry/reset, strict cycle authority,
protected manual-source transactions, and once-composed difficulty scaling.
The canonical decoder inspects fresh detached candidates without source
restoration/migration/name/playtime writes. Existing Autosave becomes active.
See [New Game+](new-game-plus.md).

Starfall Atoll reuses the existing city-interior contract. Immutable island
metadata lives in `data/nautical.ts` and its procedural map in `data/islands.ts`;
`islandAccess.ts` owns validated cycle eligibility and `systems/islands.ts`
shares exact dock/boat entry and exit with Tidehaven. Normal terrain remains
Water. Renderers show eligible explored markers only; merchant routes and
fast travel do not enter the secret island. Save recovery removes ineligible
location/discovery rather than trusting lore or achievement evidence.

## Content and campaign flow

- Quest definitions: `src/data/quests.ts`
- Quest runtime APIs: `src/systems/quests.ts`
- Quest normalization/debug: `src/systems/questState.ts`,
  `src/systems/questDebug.ts`
- Cutscene contracts/content: `src/data/cutsceneTypes.ts`,
  `src/data/cutsceneCampaign.ts`, `src/data/cutsceneBosses.ts`
- Per-story scenery definitions: `src/data/cutsceneScenery.ts`
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

Every stable cutscene ID has an explicit, distinct scenery definition, including
boss challenges/aftermaths and the epilogue. `systems/cutsceneScenery.ts` builds
a deterministic five-layer paint plan with sky, distant setting, ground,
story landmark and foreground. Color gradients, architecture, harbor water,
cavern walls, vegetation, firelight and celestial motifs replace flat
backgrounds. Aftermaths change geometry as well as light; the Kraken uses an
open sea, not a marsh.

`renderers/cutsceneBackdrop.ts` draws the bounded plan into one existing
Graphics buffer. Cutscene and Ending share it; unchanged backdrops do not
rebuild per frame. Overscan covers the existing camera framing, and ending
copy has a measured contrast-preserving dim layer. Scenery uses an isolated
seeded stream, never gameplay RNG, actors, location ownership or save fields.
Replay reconstructs the same setting without changing story progress.
Cutscene reset/shutdown also clears actor animation subscriptions, sprites
and texture leases.

Current hero visuals resolve from live `PlayerState` through
`src/systems/heroVisuals.ts` and cleanup-safe leases from
`src/renderers/heroTextures.ts`. Overworld, Battle, Cutscene, and Ending share
that pipeline.

All audio synthesis lives in `src/systems/audio.ts`. Do not add external media
or scene-local parallel audio engines.

## Optional devotion

Original definitions live in `src/data/devotion.ts` and focused
`devotionQuests.ts`, `devotionEvents.ts`, and `devotionCodex.ts` content modules.
`src/systems/devotion.ts` owns canonical source idempotency, tiers, affiliation
and pure prerequisite queries; `devotionState.ts` owns normalization.
`devotionTemples.ts` validates live approaches and reuses status and short-rest
authority. `devotionProfile.ts` derives presentation, and the devotion manager
owns measured paginated UI, semantic input and its native accessibility bridge.

Devotion is independent of social scores. Legacy heroes remain unaffiliated;
historical sources cannot award guessed points. Blessings use only normal
`activeEffects` turn durations. Codex, achievements, discovery and ending text
are consumers, never authority for this or the campaign. See
[Fictional devotion](devotion.md).

## Persistence boundaries

Only authoritative, non-reconstructable state belongs in the campaign save.
Definitions, names, thresholds, categories, totals, derived unlocks, and
presentation preferences stay canonical or derived. See
[Save system](save-system.md).

`src/systems/saveStorage.ts` owns the typed localStorage adapter, stable
autosave/manual IDs, verified staging, and per-slot backup recovery.
`src/systems/save.ts` keeps campaign normalization authoritative,
`src/systems/saveActor.ts` validates required hero authority, preserves usable
serialized hero items, and shares equipment repair with companion normalization,
`src/systems/saveSlots.ts` owns metadata and management operations, and
`src/managers/saveSlots.ts` provides the shared title and Overworld interface.
Electron uses the same renderer-owned storage path and exposes no native
filesystem API for slot import/export.

## Optional city activities

`src/data/minigames.ts` owns stable activities, venues, rulesets, difficulties,
scores, rewards, and records. Focused `src/systems/minigame*.ts` modules own
seeded dice/precision/course mechanics, compact once-only ledgers, transactional
save rollback, unknown normalization, and pure presentation/layout models.
`MinigameManager` owns in-place Overworld input, accessible rules/boards, preview
updates, and cleanup; focused renderers own procedural panels and venue signs.

Archery's moving meter is a runtime input preview, not a save clock. Accepted
positions and exact challenges save before results. Regatta reuses
`nauticalNavigation.ts`, canonical boat upgrade multipliers, and seeded
`rollWeather()` selection without moving the campaign or changing global
weather. The manager restores its scene-owned semantic context on close.
Minigame histories and consumer achievements/lore never authorize payments or
quests. See [Tavern and festival activities](minigames.md).

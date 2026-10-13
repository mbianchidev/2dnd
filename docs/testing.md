# Testing

[Documentation index](README.md) | [Development](development.md) |
[Release](release.md)

2D&D uses Vitest for deterministic logic/contracts and Playwright for
high-value browser integration. Documentation-only changes still run the release
gate before delivery because stale commands, paths, and integration assumptions
can break the public workflow.

## Commands

```bash
npm run typecheck
npm test
npm run test:browser:install
npm run test:browser
npm run test:desktop
npm run build
npm run build:desktop
npm run benchmark:baseline
```

`npm run build` already performs a TypeScript check before Vite builds `dist/`,
but the standalone typecheck remains a separate release gate and gives faster
diagnostics.

Local checks are headless only. `playwright.config.ts` explicitly selects
headless Chromium; never run visible native windows or take control of the
developer's desktop. Native release checks run on isolated CI/virtual displays.

## Vitest responsibilities

Tests in `tests/*.test.ts` own Phaser-free behavior:

- combat, physical/elemental profiles, sizes/anatomy, aimed parts, statuses,
  target scopes, action economy, rewards
- the full armor/physical-type matrix, live hero/companion equipment, magic
  bypass, status/critical/shield ordering, exact HP/RNG receipts and v23/custom
  armor migration with rejected-import byte preservation
- player and companion progression, gambits, inventories, transfers
- complete NG+ carry/reset and source-sidecar isolation, schema-v27 corruption,
  repeated creation/99 cycles, paid-pending retirement, all epic thresholds and
  shared multiclass/prestige/frozen/rest/legacy ownership, plus secret-island
  access, boat/dock validation, ordinary/legacy location repair and cycle reset
- quests, cutscene triggers/queues, Codex, events, social state, achievements
- gathering, crafting, nautical state, world/map/trap/fog helpers
- all three tavern/festival activities, every ordered 2d6 outcome and optimal
  stopping state, neutral precision scoring, reachable courses, atomic economy,
  finite claims, rollback, debug exclusion, and exact/corrupt pending recovery
- original devotion content, source idempotency, qualification isolation,
  temple transactions, affiliation choices and canonical blessing lifecycle
- save round trips, migrations, corruption repair, and cross-field validation
- unusable hero-core/import rejection, legacy hero-item preservation and actor item repair,
  exact-byte slot isolation, and denied `localStorage` getter recovery
- semantic input mappings, context priority, repeats, cleanup, and suppression
- active decision-time boundaries, overlapping pauses, stale/once-only timeouts,
  hero/manual/gambit economy, configuration migration, and checkpoint recovery
- pure layout, wrapping, pagination, safe-area, and focus math
- original Standard golden mechanics, every Custom bound, once-only scale
  composition, and per-mode campaign/boss/economy/sea/defeat/save/eligibility
- transition contracts with mocked camera/time adapters
- Electron URL/protocol, CSP, IPC, BrowserWindow, and icon contracts

Random mechanics must accept deterministic values or seeded state. Test the
authoritative helper rather than reproducing formulas in assertions.

Vitest uses isolated threads, capped at four workers or the host's available
parallelism, with `fsModuleCache` enabled. The content-aware transform cache
accelerates reruns without sharing test globals, mocks or campaign state.
Steam fixtures reuse one immutable, genuinely generated source notice;
subprocess assertions and all platform/archive/security cases remain intact.

## Playwright responsibilities

The `e2e/*.spec.ts` suites own real browser behavior:

- landing-page content, responsive layout, screenshots, and browser/download links
- new game through campaign completion, ending, post-game, and reload
- protected-manual NG+ selection and explicit Autosave snapshot-first creation,
  all control sources, paginated 150% carry policy, epic rest/reload, and a
  complete actual-NPC/three-keystone/final-Elowen NG+ journey
- ordinary-versus-NG+ Starfall visibility, actual sailing/landing, interior
  reload and touch departure at 150% text with protected-source bytes unchanged
- interrupted opening/ending/cutscene recovery and corrupt-save fallback
- random and boss defeat recovery
- tutorial, Tips, Codex, inventory, achievements, events, gathering, crafting,
  nautical, feature discovery, save-slot management/recovery, and accessibility
- tavern dice, archery, and regatta through real keyboard, touch, and gamepad
  controls, fixed challenges/forecasts, reduced motion, paid/practice/debug
  records, quota rejection, input cleanup, and pending/result reload
- keyboard, pointer, touch, gamepad, mobile text entry, title actions, landscape
  confirmations, and active-source prompts
- optional timed decisions, blocking log/visibility/controller recovery, manual
  companions, safe timeout, configuration reload, and pending-encounter recovery
- actor animation, current-player cutscene visuals, Battle backdrops, cleanup,
  screenshots, and page/console errors
- area music on actual region crossings with unchanged weather, city/dungeon
  entry, canonical named-shop music, day/night and battle/interior return
- exact resolved dice, hidden-information redaction, disadvantage/auto-hit,
  combined hit/damage and saving-throw evidence, actual healing/trap HP caps,
  one shared area pool with per-target results,
  keyboard/touch/gamepad skip/log controls, event/trap/gathering/flee results,
  preference reload, and runtime-log scene handoffs
- layout audits at supported text scales and representative desktop/mobile
  viewports
- optional physical aiming, whole-target compatibility, shared HP, body-scoped
  discoveries/reload, boss anatomies and manual-companion parity
- devotion temple/profile, unaffiliated and affiliated routes, keeper/event/
  optional-quest consequences, blessing reload/cleanup and ending presentation

`e2e/ui-boundaries.spec.ts` captures real character/class/stat/appearance,
equipment, save/rename, achievement/title, city-entry and party-status flows.
It checks glyph content as well as outer bounds at 100%/125%/150%, 1280x800,
932x430 and 390x844, including live resize/preferences, nested controller text
entry, all achievement pages, all five tutorial steps, core Tips/settings/
inventory, and unchanged manual snapshots. Keep existing
creation fixtures on stable layout IDs; never restore fixed click coordinates
when a measured layout moves.

Combined-menu cases additionally start a real earned notification, cast Cure
Wounds through Equipment to show transient in-scene dice, and open menus with
keyboard, touch and gamepad controls. They verify the popup is absent while the
menu owns the screen, survives beyond its normal dismissal deadline, and
returns and acknowledges exactly once without replaying points or titles.
All menu pages remain reachable across text scales and viewport changes.
`electron-tests/menus.spec.ts` exercises the same interruption/recovery and
measured bounds in source and actual packaged desktops. Lifecycle unit tests
reject removed-timer and stale-fade callbacks and preserve Shop purchases and
full-state lore handoffs without rendering Phaser graphics.
Desktop control coverage loads saved Touch On, requires absent mobile rails,
types physical WASD into a focused name field, and moves through all four
keyboard directions after text closes. Native activity touch fixtures use real
canvas venue/action/meter/sailing targets, never an invisible or test-only pad.
Advertise the native emulated touch device before game boot and retain its CDP
session across reloads; enabling it only during a gesture can leave Phaser
without touch listeners. Verify moved positions in saves after a real
Save & Return to Title action, not by assuming every city step autosaves.

`playwright.config.ts` defaults to `/2dnd/`, uses one local worker, allows
individual tests to be sharded, and starts Vite on a strict port.
`e2e/landing.spec.ts` exercises the showcase root; Phaser flows
open `game.html`. `hacks/run-browser-tests.mjs` allocates a free port and
disables server reuse so tests cannot silently attach to stale code.

The shared input/layout helpers observe actual scene readiness and complete
pressed/released browser frames rather than adding sleeps after every action.
Minigame fixture inputs also honor the unchanged canonical 90-ms action gate;
waiting only for frames can dispatch too early on a fast renderer.
Cutscene/result diagnostics expose their existing input gates; no deadline,
animation or game clock is accelerated. Use `domcontentloaded` plus the
authoritative title/scene assertion for game navigation, not an unrelated
500-ms network-idle interval. Keep explicit waits that test real timed behavior.

`e2e/runtime-performance.spec.ts` records 120-frame work samples before asserting
that settled title/exploration/reflowed scenes perform no redundant canvas,
debug-state or layout-report writes. It checks live preferences, clean layout
and unchanged campaign bytes. Frame/JS timings are evidence, not flaky FPS gates.
Observe the real startup reveal/achievement queues and transient HUD messages finishing
before the idle sample; their legitimate presentation changes are not redundant
work. Persistent location hints may remain visible. Live-preference samples
require a fresh changed layout report first.

## Electron responsibilities

`playwright.desktop.config.ts` launches the compiled production shell against
the relative `game.html` renderer. The smoke flow verifies:

- the stable `app://2dnd` origin and typed sandboxed preload bridge
- fullscreen button and F11 behavior
- real character creation, current-schema autosave/manual-slot persistence,
  relaunch, and continue
- independent desktop copy/import, exact source-slot bytes, interrupted
  staging/core-corruption recovery, and loading a second campaign after relaunch
- a real browser JSON download imported through Electron's file picker, with
  equivalent normalized campaign/metadata and no cross-origin preference merge
- keyboard Save & Return to Title plus pointer Quit Desktop
- lifecycle/quit log creation without campaign-content leakage
- renderer/page error cleanliness
- all three optional activities with keyboard, emulated touch, and gamepad,
  including exact pending/result recovery and once-only payouts
- completed JSON import through the native file picker, independent NG+ source
  protection, all canonical chapter dialogue/bosses, real ending and relaunch

NG+ journey fixtures use synthetic completed campaigns and canonical owners
for every saved rank/reward. They accelerate **travel only** by relocating a
validated checkpoint beside each canonical NPC or onto the actual dungeon boss
tile; quest counters, boss HP, actor resources, rewards and ending state are
never edited during the journey. Actual city-oath and boss-interaction receipts
prove coverage rather than treating checkpoint relocation as natural city
discovery. Compiled Electron journeys use no development-module imports and
do not broaden preload/security.
The native island flow imports a canonical voyage, sails to the actual dock,
lands through Interact, and relaunches into the same interior with unchanged
source bytes and hull condition. Local runs remain headless Chromium only;
the compiled shell flow runs on the isolated native CI matrix.
The island fixture keeps both keyboard edges in the renderer's consecutive
animation frames and asserts the exact dock/exit tile before interacting.
Host-time sleeps and separate CDP round trips can keep a direction held through
repeated movement on a loaded runner.

`electron-tests/deck.spec.ts` adds a production-like 1280x800 controller
equivalent: hero naming/creation, exploration/Battle, Codex search, manual
save/rename/relaunch/recovery, title exit, right-stick fullscreen, reconnect,
focus loss, resizing, 100/125/150% text, high contrast and reduced motion.
It attaches startup/frame/JS/native-memory/actual-atomic-slot-write samples and
post-GC DOM/listener counts after repeated menu/Tips cycles. These are synthetic
gamepad and short cleanup checks, not Steam Input, real Deck suspend/dock,
hours-long endurance or portable performance-budget evidence.

`ELECTRON_TEST_EXECUTABLE` optionally selects an explicitly supplied packaged
binary for the same suite. It does not alter production preload/security.
Packaged smoke runs use `electron-test-results/packaged` so a later invocation
cannot erase native first-attempt traces. Save-parity artifacts include ordered
phase timings to distinguish gameplay/import waits from browser/server cleanup.

`.github/workflows/desktop.yml` repeats the smoke test on macOS, Windows, and
Linux, then builds unsigned platform artifacts. Linux runs under Xvfb.
Native onboarding holds pointer/semantic confirmation across frames and observes each
screen/mode through debug state before the next action; fixed sleeps and rapid
pointer/keyboard source switches are not transition evidence.
Quit is a pointer-down action: observe application closure without sending a
release to a destroyed page.

## Performance baseline

Run `npm run benchmark:baseline` on the current base commit before
performance-affecting work. The command rebuilds the production `/2dnd/`
target, launches it on an unused local port, and samples cache-disabled
headless Chromium startup with both empty storage and a fresh current-schema save.
The harness validates that save against the canonical `SAVE_VERSION` declaration
in `src/systems/save.ts`, rather than a separate hardcoded benchmark version.
It reports:

- deployed and JavaScript raw/gzip sizes plus source-map size
- title readiness and the named `2dnd:boot-textures` generation measure
- JavaScript heap, DOM-node, and event-listener counts at the title screen
- fresh-save size plus stringify and localStorage write latency
- largest JavaScript chunk, raw per-navigation samples and median absolute deviation
- before/after host load averages and three 120-frame title workload samples

`hacks/lib/frameWorkload.ts` observes mutations and browser performance metrics
without changing RNG, clocks, input, animation or campaign state. Failed browser
work-budget assertions retain their JSON evidence.

Record the command output in the owning issue or pull request together with the
commit and environment. Compare regressions against a like-for-like machine and
browser baseline; these local measurements are evidence for budgets, not a
portable timing threshold by themselves.

PR CI runs the same head-owned harness against exact clean base/head revisions
on one runner in **base/head/head/base** order. `PERFORMANCE_ROOT` selects the
checkout being measured; source and harness commits are recorded independently.
The comparison pools every sample and rejects mismatched environments, revisions
or harnesses. Its artifacts retain all four receipts, including noisy or slower
runs. This avoids comparing unrelated busy developer-host runs, but does not
claim that wall-clock timing is universally deterministic.

To exercise the local root base explicitly:

```bash
PLAYWRIGHT_BASE_PATH=/ npm run test:browser
```

## Stable browser synchronization

- Prefer stable debug-state transitions, layout IDs, and semantic actions.
- Hold frame-polled Phaser keys and pointer activation across animation frames;
  instantaneous presses can be missed. The measured-layout browser helper and
  desktop pointer helper keep down/up separated by browser frames. Terminal
  native Quit holds its pointer press until the authoritative application-close
  event; it cannot await renderer frames or release input on a destroyed page.
- Release controller test presses inside browser animation frames; host sleeps
  can exceed semantic repeat thresholds under load.
- Release single-step movement after the expected position appears, rather
  than holding through the next movement-repeat interval.
- In Electron, wait for the Boot title before fixture writes or reloads;
  the correct origin alone does not mean initial navigation has finished.
- After native fullscreen restoration, settle a complete input/layout frame and
  remeasure canvas pointer targets after hover before pressing them.
- Do not target fixed canvas coordinates when a registered layout ID exists.
- Do not depend on fixed sleeps alone.
- Wait for fade-complete-driven scene state, not the nominal fade duration.
- Use `pressGameKey()` for ordinary discrete controls; it observes Cutscene,
  Ending and Defeat readiness and preserves both input edges across game frames.
  A readiness wait is bound to its original scene/step and cancels if that owner
  changes, so a cutscene handoff cannot consume the next scene's first action.
  Explicit long holds remain available for tests of held input.
- Setup commands that queue a scene restart must let the new input handlers
  mount across rendered frames and confirm the saved location/handoff state
  before sending the gameplay action.
- Await persisted tutorial completion before leaving opening/controller drains
  or testing pending-mechanic reloads; the first Overworld frame can precede the
  deferred tutorial handoff.
- Keep screenshot tolerance focused on genuine cross-platform raster variance;
  functional assertions remain primary.
- Treat page errors, unexpected console errors, overlaps, and clipping as test
  failures.
- Send visual skip controls while the result is still animating, before slower
  receipt/text assertions; exact-result evidence remains available afterward.
- Dice integration asserts source-aware multiclass modifiers without extra RNG
  or resource use, and controller text-entry ownership before native dice-skip
  actions.
- Effect-receipt tests retain exact dice sequence, signed/fractional custom
  bonuses, critical pools, status-before-element adjustments and separately
  captured applied HP. Fixed/derived amounts cannot gain fabricated faces.
  Browser checks compare canonical diagnostics with the visible text/pools and
  assert in-scene text/dice bounds at 100%/125%/150%, unchanged canvas geometry,
  shared pools, fade expiry and no history or animation remaining after Battle.
- `diceManager.test.ts` verifies cue/timer cleanup, event reset, rejection of
  late receipts after shutdown and clean explicit scene restart.
- `diceMotion.test.ts` checks deterministic measured travel, multi-axis tumble,
  bounce-to-rest, finite viewport/count validation and no RNG/outcome callbacks.
  The real physical-roll flow samples successive browser-frame transforms,
  validates exact faces and pointer transparency, then checks natural finish,
  skip and visibility cleanup. It writes `physical-roll-frame-evidence.json`
  under the test output path and attaches that file; PR CI retains the result
  tree on success or failure. Passed thresholds are not inferred FPS/budgets.
- Discrete touch pulses remain pressed through Phaser poststep. Deterministic
  input tests cover once-only press/keyup delivery, successive pulses,
  held-source survival and pending-release cleanup before the next frame.
  Fishing asserts persisted wait ticks and bite/tension transitions rather
  than hiding a lost confirm behind timing retries.
- Optional real-game motion recording uses
  `DICE_CAPTURE_MOTION=1 npm run test:browser -- e2e/dice-presentation.spec.ts --grep "physical dice game-viewport demo"`.
  Default CI video remains off. Capture viewport screenshots rather than
  full-page snapshots: full-page resizing must still cancel a live throw.
- Select Battle spells by registered stable action/spell layout IDs after
  normalization; earned-spell additions must not shift fixture hit targets.
- Native slot navigation observes both pressed and released frames and the
  exact selected slot and shared same-key debounce interval, rather than
  assuming an initial row or pulse count.
- Install legacy-save fixtures at the next document's initialization, not into
  a live scene whose pending autosaves can replace them. Assert migrated
  evidence before exercising the UI that depends on it.

The local `#layout-report` and canvas
`data-layout-overlap-count`/`data-layout-clipping-count` attributes are
read-only debug/test surfaces on loopback and the local `app://2dnd` desktop
origin. This does not enable desktop cheats or change production security.
Registered groups should report zero unintended
intersections and zero visible-content clipping.

## Targeted validation

Prestige coverage belongs to `tests/prestige*.test.ts`, `e2e/prestige.spec.ts`
and the focused Electron prestige flow. It covers every path/rank, grouped
entry boundaries, fresh owner/clone contexts, frozen rest credits, gear and
action rejection, scoped/legacy/deferred grants, debug exclusion, schema-v19
migration and schema-v20 corruption, measured input/layout, battle, reload and
campaign authority. Preserve the separate twelve-class compatibility tests.

Hero progression coverage includes all base-class pairings and prerequisite
boundaries, frozen resources, once-only overlaps, total-level ASIs, legacy
levels 1-20 for every class, corrupt records, deferred historical unlocks,
lossless 53-item custom hero fixtures, complete duplicate-equipment metadata,
legacy orphan gear, independent companion actions and shared economy. The
`multiclass.spec.ts` flow covers rest/choice/reload, exact previews, ASIs,
mobile/gamepad, measured layouts and campaign completion.
Seed browser randomness with a varying generator: constant global rolls collide
with Phaser Text UUID textures. Compare exact prepared resolver receipts rather
than assuming a global constant roll.

During implementation, run the smallest related Vitest files first. Run focused
Playwright specs for changed UI/scene flows. Before a pull request, run:

1. `npm ci`
2. `npm audit`
3. `npm run typecheck`
4. `npm test`
5. `npm run test:browser`
6. `npm run test:desktop`
7. `npm run build`
8. `npm run build:desktop`
9. `git diff --check`

If a dependency install reports vulnerabilities, resolve or explicitly account
for them before release.

## CI

`.github/workflows/pr.yml` runs Node 24, `npm ci`, audit, typecheck, full Vitest
and the production build, then the complete Playwright suite across five
single-worker shards and the paired production benchmark. No tests or slow-test
warnings are disabled. Shard artifacts have unique names; the existing `build`
check aggregates every required job, including failures/skips. Manual dispatch
runs the full release gate without the PR-only comparison.
CI uses `--balanced-shard=N/5`: native contiguous sharding put all five long
NG+ journeys in one job. The browser wrapper interleaves individually discovered
cases, uses Playwright's native `--test-list`, and rechecks the exact selection
before execution. It preserves every case once across the five shards and
retains the complete shard plan and JSON results even for clean passing shards.
Each of the five adjacent campaign journeys gets its own single-worker runner,
instead of accumulating two journeys into one slow-file warning.
The browser matrix fails fast on a failed shard as requested; its aggregate gate
still requires every shard to pass. Workflow/ref concurrency remains non-cancelling.
Its `pr-${{ github.ref }}` concurrency group is scoped to
the Git ref, matching the desktop workflow: independent pull requests and
manually dispatched branches cannot replace one another's pending checks.
Runs for the same ref remain serialized; `cancel-in-progress` remains false.

Desktop uses `desktop-${{ github.ref }}` with the same serialization policy.
Preserve all release-gate steps, existing permissions, and triggers.

Official checkout/setup/artifact actions are pinned to verified Node-24-compatible
releases. Do not suppress `punycode`, `url.parse()` or obsolete action-runtime
warnings with environment flags; update the owning action.

`.github/workflows/codeql.yml` analyzes Actions and JavaScript/TypeScript.
GitHub Pages deployment separately runs `npm ci`, Vitest, and the multi-page
production build from `main`. `.github/workflows/desktop.yml` audits, builds,
smoke-tests, and packages each desktop platform without publishing.
`.github/workflows/release.yml` accepts matching `v*` tags on `main`, reruns the
full browser gate, smoke-tests and packages all desktop targets, then attaches
the unsigned installers to the generated GitHub release.
Desktop artifact CI also installs Chromium so its browser-to-Electron save
parity test does not depend on a pre-populated browser cache.

`tests/steamConfig.test.ts` and `tests/steamPreparation.test.ts` check approved
placeholders, IDs, architecture headers, emulation/catalog completeness,
runtime exclusions, symlinks, ASAR contents, source/hash receipts and private
preview rendering with mock IDs. PR desktop CI stages and inspects actual
platform payloads; no partner SDK/account is involved. Protected upload,
real-client install/update/offline behavior and physical Deck tests remain
separate human gates in [Steam preparation](steam.md).

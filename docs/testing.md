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

## Vitest responsibilities

Tests in `tests/*.test.ts` own Phaser-free behavior:

- combat, elements, statuses, target scopes, action economy, rewards
- player and companion progression, gambits, inventories, transfers
- quests, cutscene triggers/queues, Codex, events, social state, achievements
- gathering, crafting, nautical state, world/map/trap/fog helpers
- save round trips, migrations, corruption repair, and cross-field validation
- unusable hero-core/import rejection, legacy hero-item preservation and actor item repair,
  exact-byte slot isolation, and denied `localStorage` getter recovery
- semantic input mappings, context priority, repeats, cleanup, and suppression
- pure layout, wrapping, pagination, safe-area, and focus math
- transition contracts with mocked camera/time adapters
- Electron URL/protocol, CSP, IPC, BrowserWindow, and icon contracts

Random mechanics must accept deterministic values or seeded state. Test the
authoritative helper rather than reproducing formulas in assertions.

## Playwright responsibilities

The `e2e/*.spec.ts` suites own real browser behavior:

- landing-page content, responsive layout, screenshots, and browser/download links
- new game through campaign completion, ending, post-game, and reload
- interrupted opening/ending/cutscene recovery and corrupt-save fallback
- random and boss defeat recovery
- tutorial, Tips, Codex, inventory, achievements, events, gathering, crafting,
  nautical, feature discovery, save-slot management/recovery, and accessibility
- keyboard, pointer, touch, gamepad, mobile text entry, title actions, landscape
  confirmations, and active-source prompts
- actor animation, current-player cutscene visuals, Battle backdrops, cleanup,
  screenshots, and page/console errors
- exact resolved dice, hidden-information redaction, disadvantage/auto-hit,
  keyboard/touch/gamepad skip/log controls, event/trap/gathering/flee results,
  preference reload, and runtime-log scene handoffs
- layout audits at supported text scales and representative desktop/mobile
  viewports

`playwright.config.ts` defaults to `/2dnd/`, uses one worker, and starts Vite on
a strict port. `e2e/landing.spec.ts` exercises the showcase root; Phaser flows
open `game.html`. `hacks/run-browser-tests.mjs` allocates a free port and
disables server reuse so tests cannot silently attach to stale code.

## Electron responsibilities

`playwright.desktop.config.ts` launches the compiled production shell against
the relative `game.html` renderer. The smoke flow verifies:

- the stable `app://2dnd` origin and typed sandboxed preload bridge
- fullscreen button and F11 behavior
- real character creation, schema-v19 autosave/manual-slot persistence,
  relaunch, and continue
- independent desktop copy/import, exact source-slot bytes, interrupted
  staging/core-corruption recovery, and loading a second campaign after relaunch
- a real browser JSON download imported through Electron's file picker, with
  equivalent normalized campaign/metadata and no cross-origin preference merge
- keyboard Save & Return to Title plus pointer Quit Desktop
- lifecycle/quit log creation without campaign-content leakage
- renderer/page error cleanliness

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
It reports:

- deployed and JavaScript raw/gzip sizes plus source-map size
- title readiness and the named `2dnd:boot-textures` generation measure
- JavaScript heap, DOM-node, and event-listener counts at the title screen
- fresh-save size plus stringify and localStorage write latency

Record the command output in the owning issue or pull request together with the
commit and environment. Compare regressions against a like-for-like machine and
browser baseline; these local measurements are evidence for budgets, not a
portable timing threshold by themselves.

To exercise the local root base explicitly:

```bash
PLAYWRIGHT_BASE_PATH=/ npm run test:browser
```

## Stable browser synchronization

- Prefer stable debug-state transitions, layout IDs, and semantic actions.
- Hold frame-polled Phaser keys across animation frames; instantaneous presses
  can be missed.
- Do not target fixed canvas coordinates when a registered layout ID exists.
- Do not depend on fixed sleeps alone.
- Wait for fade-complete-driven scene state, not the nominal fade duration.
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
  or resource use, and controller text-entry ownership before native roll-log
  actions.
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

`.github/workflows/pr.yml` runs Node 24, `npm ci`, typecheck, full Vitest,
Chromium installation, full Playwright, and the production build for pull
requests to `main`. Its `pr-${{ github.ref }}` concurrency group is scoped to
the Git ref, matching the desktop workflow: independent pull requests and
manually dispatched branches cannot replace one another's pending checks.
Runs for the same ref remain serialized; `cancel-in-progress` remains false.

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

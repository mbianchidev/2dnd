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
- semantic input mappings, context priority, repeats, cleanup, and suppression
- pure layout, wrapping, pagination, safe-area, and focus math
- transition contracts with mocked camera/time adapters
- Electron URL/protocol, CSP, IPC, BrowserWindow, and icon contracts

Random mechanics must accept deterministic values or seeded state. Test the
authoritative helper rather than reproducing formulas in assertions.

## Playwright responsibilities

The `e2e/*.spec.ts` suites own real browser behavior:

- new game through campaign completion, ending, post-game, and reload
- interrupted opening/ending/cutscene recovery and corrupt-save fallback
- random and boss defeat recovery
- tutorial, Tips, Codex, inventory, achievements, events, gathering, crafting,
  nautical, feature discovery, and accessibility
- keyboard, pointer, touch, gamepad, mobile text entry, and active-source prompts
- actor animation, current-player cutscene visuals, Battle backdrops, cleanup,
  screenshots, and page/console errors
- layout audits at supported text scales and representative desktop/mobile
  viewports

`playwright.config.ts` defaults to `/2dnd/`, uses one worker, and starts Vite on
a strict port. `hacks/run-browser-tests.mjs` allocates a free port and disables
server reuse so tests cannot silently attach to stale code.

## Electron responsibilities

`playwright.desktop.config.ts` launches the compiled production shell against
the relative desktop renderer. The smoke flow verifies:

- the stable `app://2dnd` origin and typed sandboxed preload bridge
- fullscreen button and F11 behavior
- real character creation, schema-v17 save persistence, relaunch, and continue
- renderer/page error cleanliness

`.github/workflows/desktop.yml` repeats the smoke test on macOS, Windows, and
Linux, then builds unsigned platform artifacts. Linux runs under Xvfb.

## Performance baseline

Run `npm run benchmark:baseline` on the current base commit before
performance-affecting work. The command rebuilds the production `/2dnd/`
target, launches it on an unused local port, and samples cache-disabled
headless Chromium startup with both empty storage and a fresh schema-v17 save.
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
- Keep screenshot tolerance focused on genuine cross-platform raster variance;
  functional assertions remain primary.
- Treat page errors, unexpected console errors, overlaps, and clipping as test
  failures.

The local `#layout-report` and canvas
`data-layout-overlap-count`/`data-layout-clipping-count` attributes are
debug/test surfaces. Registered groups should report zero unintended
intersections and zero visible-content clipping.

## Targeted validation

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
requests to `main`.

`.github/workflows/codeql.yml` analyzes Actions and JavaScript/TypeScript.
GitHub Pages deployment separately runs `npm ci`, Vitest, and the production
build from `main`. `.github/workflows/desktop.yml` audits, builds, smoke-tests,
and packages each desktop platform without signing or publishing.

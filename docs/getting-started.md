# Getting started

[Documentation index](README.md) | [Development](development.md) |
[Testing](testing.md)

## Play in a browser

The current public showcase is hosted at:

<https://mbianchidev.github.io/2dnd/>

Its **Play in browser** action opens
<https://mbianchidev.github.io/2dnd/game.html>. GitHub Pages serves both pages
from the `/2dnd/` base path. No account is required.

## Local prerequisites

- A current desktop operating system supported by Node.js
- Node.js 24 and npm, matching the CI baseline
- A current browser; Chromium is the automated release target
- A supported macOS, Windows, or Linux desktop for Electron packaging

## Install and run

```bash
git clone https://github.com/mbianchidev/2dnd.git
cd 2dnd
npm ci
npm run dev
```

Vite serves the showcase at <http://localhost:3000/> and the game at
<http://localhost:3000/game.html> with the root base path.

Use `npm install` only when intentionally changing dependencies or refreshing
the lockfile. For reproducible setup and CI parity, prefer `npm ci`.

## Run the desktop shell

```bash
npm run dev:desktop
```

The command builds the strict Electron main/preload process, starts Vite on an
unused loopback port, and closes both processes together. For a production-like
desktop build and smoke test:

```bash
npm run build:desktop
npm run test:desktop:built
```

Create unsigned artifacts for the current operating system with
`npm run package:desktop`. See [Desktop application](desktop.md) before changing
the native security boundary or preparing distribution artifacts.

## Browser tests

Install the Playwright Chromium build once:

```bash
npm run test:browser:install
```

Then run:

```bash
npm run test:browser
```

The wrapper in `hacks/run-browser-tests.mjs` allocates a fresh strict local port
and the Playwright configuration defaults to the deployed `/2dnd/` base path.
The landing-page flow starts at that root; game flows open `game.html`. See
[Testing](testing.md) for the complete browser-test contract.

## Local save data

2D&D stores data in the browser or Electron profile for the active origin:

| Key | Purpose |
| --- | --- |
| `2dnd_save` | Dedicated autosave campaign, currently schema v18 |
| `2dnd_save_slot_manual-1` through `manual-3` | Named manual campaign slots |
| slot `:backup` / `:staging` keys | Automatic recovery from interrupted or corrupt writes |
| `2dnd_preferences` | Versioned audio, accessibility, and control presentation settings |
| `2dnd_inventory_prefs` | Inventory sort, filter, and search preferences |

`http://localhost:3000` and `https://mbianchidev.github.io` are different
origins, and packaged desktop builds use `app://2dnd`, so none silently share
saves. Clearing site data, using private browsing, deleting Electron user data,
or switching profiles can remove or hide local saves. Use **Load / Manage
Saves** on the title screen to rename, copy, delete, export, or import one
validated campaign slot. There is no cloud sync.

## Basic troubleshooting

- **Blank or stale local page:** stop any old Vite process and rerun
  `npm run dev`; browser tests never reuse an existing server.
- **Browser tests cannot launch Chromium:** run
  `npm run test:browser:install`.
- **Desktop shell does not start:** rerun `npm run build:electron`, confirm the
  Vite loopback port is not blocked, inspect main-process stderr, then check
  `logs/2dnd.log` beneath the platform user-data root documented in
  [Desktop application](desktop.md#diagnostic-logs).
- **Packaging cannot sign an artifact:** local and CI artifacts are intentionally
  unsigned; see [Release](release.md) for signing prerequisites.
- **The deployed route loads locally but fails under Pages:** run the browser
  suite, which exercises the `/2dnd/` base path, and check `vite.config.ts`.
- **Old dependencies or inexplicable type errors:** remove only the local
  dependency installation if appropriate, then rerun `npm ci`; do not edit the
  lockfile unless dependencies are changing.
- **A save no longer loads:** open **Load / Manage Saves** first; the game
  automatically tries interrupted staging and the prior verified backup for
  that slot. Export any recovered campaign. Do not patch stored JSON manually;
  reproduce persistent failures in the save suites and follow
  [Save system](save-system.md).

## Next steps

- Players: [Gameplay](gameplay.md)
- Contributors: [Development](development.md)
- Coding agents: [AGENTS.md](../AGENTS.md)

# Getting started

[Documentation index](README.md) | [Development](development.md) |
[Testing](testing.md)

## Play in a browser

The current public release is hosted at:

<https://mbianchidev.github.io/2dnd/>

GitHub Pages serves the production build from the `/2dnd/` base path. No
download or account is required.

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

Vite serves the game at <http://localhost:3000/> with the root base path.

Use `npm install` only when intentionally changing dependencies or refreshing
the lockfile. For reproducible setup and CI parity, prefer `npm ci`.

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
See [Testing](testing.md) for the complete browser-test contract.

## Local save data

2D&D stores data in the browser or Electron profile for the active origin:

| Key | Purpose |
| --- | --- |
| `2dnd_save` | Campaign save, currently schema v17 |
| `2dnd_preferences` | Versioned audio, accessibility, and control presentation settings |
| `2dnd_inventory_prefs` | Inventory sort, filter, and search preferences |

`http://localhost:3000` and `https://mbianchidev.github.io` are different
origins, and packaged desktop builds use `app://2dnd`, so none silently share
saves. Clearing site data, using private browsing, deleting Electron user data,
or switching profiles can remove or hide local saves. There is no cloud sync.

## Basic troubleshooting

- **Blank or stale local page:** stop any old Vite process and rerun
  `npm run dev`; browser tests never reuse an existing server.
- **Browser tests cannot launch Chromium:** run
  `npm run test:browser:install`.
- **Desktop shell does not start:** rerun `npm run build:electron`, confirm the
  Vite loopback port is not blocked, and inspect main-process stderr.
- **Packaging cannot sign an artifact:** local and CI artifacts are intentionally
  unsigned; see [Release](release.md) for signing prerequisites.
- **The deployed route loads locally but fails under Pages:** run the browser
  suite, which exercises the `/2dnd/` base path, and check `vite.config.ts`.
- **Old dependencies or inexplicable type errors:** remove only the local
  dependency installation if appropriate, then rerun `npm ci`; do not edit the
  lockfile unless dependencies are changing.

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
- **A save no longer loads:** do not patch the stored JSON manually. Reproduce
  it in `tests/save.test.ts` and fix normalization or recovery as described in
  [Save system](save-system.md).

## Next steps

- Players: [Gameplay](gameplay.md)
- Contributors: [Development](development.md)
- Coding agents: [AGENTS.md](../AGENTS.md)

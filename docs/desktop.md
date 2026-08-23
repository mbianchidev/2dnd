# Desktop application

[Documentation index](README.md) | [Getting started](getting-started.md) |
[Release](release.md)

2D&D can run in a secure Electron shell on macOS, Windows, and Linux. The Pages
root is a public showcase, while both the browser Play action and Electron shell
load the same `game.html` Phaser renderer. The current v1.0.0 public release
predates tagged desktop publishing; pull requests still produce short-lived
unsigned artifacts for review.

## Commands

```bash
npm run dev:desktop       # Vite renderer plus Electron shell
npm run build:desktop     # Type-check and build dist/ + dist-electron/
npm run test:desktop      # Production-like Electron Playwright smoke test
npm run package:desktop   # Unsigned artifacts for the current host
```

Desktop development binds Vite to a dynamically allocated loopback port.
Production packages load `dist/game.html` from the relative Vite build at the
stable `app://2dnd` origin.

## Security boundary

`electron/main.ts` owns the native process and `electron/preload.cts` exposes
only narrow typed operations: read window/log state, toggle or observe
fullscreen, report bounded renderer failures, and request application quit.

- `contextIsolation` and Chromium sandboxing are enabled.
- Renderer Node.js, worker Node.js, webviews, insecure content, permissions,
  unexpected navigation, popups, and production developer tools are disabled.
- Production renderer requests cannot reach HTTP, HTTPS, WebSocket, or other
  remote origins.
- External navigation is denied in-app. Only repository-owned HTTPS pages are
  eligible to open in the operating-system browser.
- The custom protocol resolves files only inside packaged `dist/`, with
  traversal rejection and a restrictive Content Security Policy.
- IPC handlers reject arguments and untrusted renderer senders.
- The renderer can request application quit but cannot terminate arbitrary
  processes or invoke generic native commands.

Do not expose filesystem, process, shell, command execution, arbitrary URL, or
generic IPC APIs through preload.

## Persistence

The desktop shell uses the same schema-v17 `localStorage` documents as the web
game. The stable `app://2dnd` origin keeps them available across launches and
upgrades:

| Platform | Electron user-data root |
| --- | --- |
| macOS | `~/Library/Application Support/2D&D` |
| Windows | `%APPDATA%\2D&D` |
| Linux | `$XDG_CONFIG_HOME/2D&D`, normally `~/.config/2D&D` |

Chromium stores the documents beneath that root. Browser and desktop origins
remain isolated; they do not silently copy or merge saves.

## Diagnostic logs

Electron writes lifecycle, startup, renderer/preload failure, blocked
navigation, process-crash, and quit diagnostics to:

| Platform | Active log |
| --- | --- |
| macOS | `~/Library/Application Support/2D&D/logs/2dnd.log` |
| Windows | `%APPDATA%\2D&D\logs\2dnd.log` |
| Linux | `$XDG_CONFIG_HOME/2D&D/logs/2dnd.log`, normally `~/.config/2D&D/logs/2dnd.log` |

The active log rotates at 1 MiB to `2dnd.previous.log`; only one previous file
is retained. Entries are timestamped, single-line, and written with
owner-restricted permissions where the operating system supports them. The
logger records diagnostics, not campaign save contents. Main-process messages
are also mirrored to the terminal during `npm run dev:desktop`.

## Exit behavior

The in-game Esc menu exposes **Save & Return to Title**. It completes the
existing autosave before the guarded scene transition to the title. Packaged
desktop builds then expose **Quit Desktop** on the title screen; `Q` is its
keyboard shortcut. Browser builds do not display an application-quit action.

## Packaging

`electron-builder` reads the `build` configuration in `package.json`.
`npm run generate:desktop-icons` creates repository-owned PNG, ICO, ICNS, and
Linux icons from procedural pixel art without external assets.

Pinned `allowScripts` entries approve only Electron's requested `fsevents`
versions and the reviewed `electron-winstaller` setup script. `.npmrc` omits
the unused Squirrel peer from installation, while exact ASAR/proxy overrides
remove deprecated transitives from the stable builder graph. Keep these
policies version-pinned and rerun `npm install-scripts ls`, `npm audit`, and
the complete platform matrix after dependency changes.

| Platform | Unsigned outputs |
| --- | --- |
| macOS | x64/arm64 DMG and ZIP |
| Windows | x64 NSIS installer and portable executable |
| Linux | x64 AppImage and tarball |

`.github/workflows/desktop.yml` builds and smoke-tests each platform before
uploading versioned review artifacts. `.github/workflows/release.yml` repeats
the release gate for a `v*` tag that matches `package.json`, builds every
platform, and attaches the unsigned packages to a generated GitHub release.
macOS and Windows builds remain unsigned until protected signing credentials
are configured; operating systems may warn before opening them. Apple Developer
ID/notarization and Authenticode credentials must stay in a protected release
environment, never in source or pull-request workflows.

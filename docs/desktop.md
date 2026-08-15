# Desktop application

[Documentation index](README.md) | [Getting started](getting-started.md) |
[Release](release.md)

2D&D can run in a secure Electron shell on macOS, Windows, and Linux while the
GitHub Pages browser build remains unchanged. The current v1.0.0 public release
does not include signed installers; pull requests produce short-lived unsigned
artifacts for review.

## Commands

```bash
npm run dev:desktop       # Vite renderer plus Electron shell
npm run build:desktop     # Type-check and build dist/ + dist-electron/
npm run test:desktop      # Production-like Electron Playwright smoke test
npm run package:desktop   # Unsigned artifacts for the current host
```

Desktop development binds Vite to a dynamically allocated loopback port.
Production packages load the relative Vite build from the stable
`app://2dnd` origin.

## Security boundary

`electron/main.ts` owns the native process and `electron/preload.cts` exposes
only three typed operations: read window state, toggle fullscreen, and observe
fullscreen changes.

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

## Packaging

`electron-builder` reads the `build` configuration in `package.json`.
`npm run generate:desktop-icons` creates repository-owned PNG, ICO, ICNS, and
Linux icons from procedural pixel art without external assets.

| Platform | Unsigned outputs |
| --- | --- |
| macOS | x64/arm64 DMG and ZIP |
| Windows | x64 NSIS installer and portable executable |
| Linux | x64 AppImage and tarball |

`.github/workflows/desktop.yml` builds and smoke-tests each platform before
uploading versioned review artifacts. Public distribution still requires human
code-signing credentials: Apple Developer ID plus notarization for macOS and an
appropriate Authenticode certificate for Windows. Credentials must stay in the
release environment, never in source or pull-request workflows.

# Utility scripts

- `run-browser-tests.mjs` allocates an unused localhost port, passes it to the
  Playwright config, and runs the browser suite without reusing stale Vite
  servers. Invoke it through `npm run test:browser`.
- `run-desktop-dev.mjs` allocates a loopback-only Vite port, waits for it to
  become responsive, launches the Electron shell, and stops both child
  processes together. Invoke it through `npm run dev:desktop`.
- `generate-desktop-icons.mjs` creates the original pixel-d20 PNG, ICO, ICNS,
  and Linux icon set without external assets or image dependencies. Invoke it
  through `npm run generate:desktop-icons`; packaging runs it automatically.
- `measure-performance-baseline.mjs` builds the production `/2dnd/` target,
  launches it on an unused local port, and prints reproducible bundle, startup,
  Boot texture, memory, DOM/listener, and fresh-save metrics. Run
  `npm run test:browser:install` once, then invoke it through
  `npm run benchmark:baseline`.
- `lib/git-provenance.mjs` shares commit/clean-tree/diff-hash collection between
  the performance harness and Steam receipts without following untracked
  symlinks outside the worktree.
- `generate-desktop-notice.mjs` generates the exact source notice into the
  ignored `build/SOURCE.2dnd.txt` before packaging/signing. Both package commands
  call it and restore the pinned Electron binary if required for its bundled
  Chromium notices; staging never edits a signed bundle. Explicit `--output`
  writes only a notice, so synthetic unit fixtures need no binary or network.
- `prepare-steam.mjs` inspects unpacked platform architecture, game ASAR,
  licenses/source notice, exclusions, symlinks, hashes and permissions. It
  creates credential-free previews by default, verifies complete preview sets
  and renders private VDFs only from validated environment IDs. Run
  `npm run steam:prepare` for syntax and read `docs/steam.md`.
- `upload-steam.mjs` is only for an explicitly authorized main-branch dispatch
  on a protected, preauthenticated ephemeral upload runner. It emits no
  account/partner details or raw SteamCMD output, fails closed and never sets
  a branch live. Do not run it for PR or local preview validation.

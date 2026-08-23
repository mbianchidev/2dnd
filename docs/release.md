# Release guide

[Documentation index](README.md) | [Testing](testing.md) |
[Getting started](getting-started.md)

## Current distribution

2D&D is released as a static showcase and browser game through GitHub Pages:

<https://mbianchidev.github.io/2dnd/>

The custom-domain target is <https://2dnd.mbianchi.dev/>. Keep public links on
the current GitHub Pages URL until the custom domain, certificate, and root-path
deployment have been verified.

The root URL presents the showcase; **Play in browser** opens `game.html`. The
repository also builds an Electron desktop target for macOS, Windows, and Linux.
Pull requests produce unsigned review artifacts. Matching version tags publish
unsigned desktop packages to GitHub Releases after all release gates pass. The
current v1.0.0 release predates that publishing workflow.

## GitHub Pages

`.github/workflows/deploy.yml` runs on pushes to `main`:

1. Check out the repository.
2. Use Node.js 24.
3. Run `npm ci`.
4. Run full Vitest.
5. Read the active Pages URL and base path with `actions/configure-pages`.
6. Run `npm run build` with
   `VITE_BASE_PATH=${{ steps.pages.outputs.base_path }}/`.
7. Upload the multi-page `dist/` containing the showcase and game.
8. Deploy with GitHub Pages.

The workflow does not hardcode a project or root base. GitHub Pages metadata
supplies `/2dnd` for the project site and an empty base path for the custom
domain, so the Vite build receives `/2dnd/` or `/` respectively.

Outside Pages deployment, `vite.config.ts` keeps `/` for normal local
development. Playwright checks the `/2dnd/` showcase and opens
`/2dnd/game.html` for Phaser flows. Electron builds use Vite's `desktop` mode,
keep the relative `./` base, and open `dist/game.html` directly regardless of
`VITE_BASE_PATH`.

### Custom-domain rollout

After the workflow change is merged:

1. A maintainer sets the Pages custom domain to `2dnd.mbianchi.dev`.
2. A maintainer adds the DNS record `CNAME 2dnd -> mbianchidev.github.io`.
3. Rerun the Pages workflow so `actions/configure-pages` reports an empty base
   path and Vite rebuilds with `/`.
4. Wait for GitHub Pages to issue the certificate, then enable **Enforce HTTPS**.
5. Verify HTTPS, root-relative asset paths, gameplay startup, and save behavior.

Browser `localStorage` is scoped to an origin. Moving from
`https://mbianchidev.github.io/2dnd/` to `https://2dnd.mbianchi.dev/` changes the
origin, so existing campaign saves and preferences do not transfer
automatically to the custom domain.

## Desktop artifacts

`.github/workflows/desktop.yml` runs on pull requests and manual dispatch:

1. Install with Node.js 24 and run `npm audit`.
2. Generate procedural repository-owned icons.
3. Type-check and build the Electron main/preload process and relative Vite
   renderer.
4. Run the production-like Electron save/fullscreen/relaunch/quit/log smoke test.
5. Build unsigned macOS, Windows, or Linux artifacts.
6. Upload versioned review artifacts for 14 days without publishing them.

macOS public releases require Developer ID signing and notarization. Windows
public releases require Authenticode signing. Keep certificates and credentials
in protected release environments; never commit them or expose them to pull
requests. Linux artifacts remain unsigned unless a future release process adds
documented package signing.

## Tagged desktop releases

`.github/workflows/release.yml` runs only when a `v*` tag is pushed. It rejects
the release unless the tag is exactly `v<package.json version>` and its commit
is contained in `main`.

1. Run `npm ci`, `npm audit`, typecheck, full Vitest, Chromium Playwright, and
   the production web build.
2. Generate the procedural desktop icons.
3. Build and smoke-test the secure Electron shell on macOS, Windows, and Linux.
4. Package the configured DMG/ZIP, NSIS/portable EXE, and AppImage/tarball
   outputs.
5. Download the matrix artifacts into one release job.
6. Create the matching GitHub release with generated notes and attach every
   desktop package. A rerun repairs an existing release with `--clobber`.

The workflow publishes unsigned packages. Signing and notarization remain a
separate protected release concern; the landing page warns players that their
operating system may challenge these builds.

## Release checklist

1. Confirm all claimed features are merged into current `main`; do not use open
   issue or pull-request behavior in release notes.
2. Update the version in `package.json` and lockfile when publishing a new
   release.
3. Synchronize `README.md`, `docs/`, `AGENTS.md`,
   `.github/copilot-instructions.md`, and relevant skills.
4. Verify Phaser, TypeScript, Vite, Vitest, Playwright, happy-dom, and save-schema
   versions against source and manifests.
5. Run `npm ci`.
6. Run `npm audit` and resolve vulnerabilities.
7. Run `npm run typecheck`.
8. Run full `npm test`.
9. Run full `npm run test:browser`.
10. Run full `npm run test:desktop`.
11. Run `npm run build` and `npm run build:desktop`.
12. Run `npm run package:desktop` on the current host.
13. Run `git diff --check` and verify Markdown links/anchors.
14. Open a pull request and wait for browser, desktop, and both CodeQL analyses.
15. Resolve every failure and review comment before merge.
16. After merge, verify the Pages workflow, showcase, Play action, and deployed
    `game.html`.
17. For a desktop release, create and push the version tag from the verified
    `main` commit.
18. Wait for the release workflow and verify every expected desktop package is
    attached to the generated GitHub release.
19. When signing credentials exist, sign/notarize in the protected release
    environment and verify installation before presenting those builds as
    trusted by the operating system.

## Release gates

Pull requests to `main` use `.github/workflows/pr.yml`:

- Node.js 24 and reproducible `npm ci`
- strict TypeScript
- full Vitest
- Playwright Chromium installation
- full Playwright suite
- production build

`.github/workflows/codeql.yml` analyzes GitHub Actions and
JavaScript/TypeScript. The release is not ready while any required PR, browser,
desktop, build, audit, deployment, packaging, signing, or CodeQL check is
unresolved.

## Documentation audit

Before release, verify:

- the active Pages URL and its matching dynamic base path
- badge workflow names and links
- relative Markdown links and heading anchors
- current controls and feature-discovery behavior
- local-storage keys and schema number
- scene names and ownership paths
- supported browser wording
- license metadata
- absence of temporary scripts or generated test artifacts

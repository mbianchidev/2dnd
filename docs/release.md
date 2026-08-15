# Release guide

[Documentation index](README.md) | [Testing](testing.md) |
[Getting started](getting-started.md)

## Current distribution

2D&D is released as a static browser game through GitHub Pages:

<https://mbianchidev.github.io/2dnd/>

The repository also builds an Electron desktop target for macOS, Windows, and
Linux. Pull requests produce unsigned review artifacts. The current v1.0.0
release has no signed public installer; do not describe unsigned CI artifacts
as an endorsed desktop release.

## GitHub Pages

`.github/workflows/deploy.yml` runs on pushes to `main`:

1. Check out the repository.
2. Use Node.js 24.
3. Run `npm ci`.
4. Run full Vitest.
5. Run `npm run build`.
6. Upload `dist/`.
7. Deploy with GitHub Pages.

`vite.config.ts` uses `/2dnd/` under GitHub Actions and `/` for normal local
development. Playwright defaults to `/2dnd/` so release paths are tested before
deployment.

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
16. After merge, verify the Pages workflow and deployed URL.
17. For a desktop release, sign/notarize in the protected release environment
    and verify installation before publishing.
18. Create the GitHub release/tag and verify the public README reports the same
    version.

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

- the Pages URL and `/2dnd/` base path
- badge workflow names and links
- relative Markdown links and heading anchors
- current controls and feature-discovery behavior
- local-storage keys and schema number
- scene names and ownership paths
- supported browser wording
- license metadata
- absence of temporary scripts or generated test artifacts

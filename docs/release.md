# Release guide

[Documentation index](README.md) | [Testing](testing.md) |
[Getting started](getting-started.md)

## Current distribution

2D&D is released as a static browser game through GitHub Pages:

<https://mbianchidev.github.io/2dnd/>

The repository currently has no Electron, Tauri, native desktop, or signed
installer target. Do not publish desktop download instructions unless such a
target is implemented and validated.

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
10. Run `npm run build`.
11. Run `git diff --check` and verify Markdown links/anchors.
12. Open a pull request and wait for PR CI and both CodeQL analyses.
13. Resolve every failure and review comment before merge.
14. After merge, verify the Pages workflow and deployed URL.
15. Create the GitHub release/tag and verify the public README reports the same
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
build, audit, deployment, or CodeQL check is unresolved.

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

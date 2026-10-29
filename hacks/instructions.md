# Utility scripts

- `release.mjs`, exposed by the executable `scripts/release.sh`, validates the
  clean, up-to-date main checkout and release preflight, runs npm patch by
  default or prepares an explicit higher SemVer version, updates manifest/lock
  and README/AGENTS release references, commits with
  `--no-gpg-sign`, pushes that exact commit to main, then creates/pushes one
  unsigned annotated tag and waits for the exact new release workflow.
  An explicit current version retries without another version update or main
  push.
  Confirmed CI failure rolls back only its unchanged local/remote tags; the
  version commit stays. Unknown CI status or changed ownership preserves refs
  and reports an actionable failure. It never force-pushes, rewrites main, or
  deletes releases/assets. See `docs/release.md`; tests mock npm, Git and GitHub.
- `run-browser-tests.mjs` allocates an unused localhost port, passes it to the
  Playwright config, and runs the browser suite without reusing stale Vite
  servers. Invoke it through `npm run test:browser`.
  `--balanced-shard=N/5` interleaves adjacent cases using native Playwright
  test-list selection, verifies the exact case set before running, and retains
  the plan in `test-results/shard-plan.json`. This distributes long campaign
  and multi-input activity files without hiding slow-test warnings or dropping
  tests. Ordinary arguments, including native `--shard`, remain supported.
- `lib/browserShards.ts` validates discovered test identities and creates the
  complete deterministic interleaved shard plan. Duplicate, ambiguous, empty or
  failed discovery rejects the run rather than producing a partial passing gate.
- `run-desktop-dev.mjs` allocates a loopback-only Vite port, waits for it to
  become responsive, launches the Electron shell, and stops both child
  processes together. Invoke it through `npm run dev:desktop`.
- `generate-desktop-icons.mjs` creates the original pixel-d20 PNG, ICO, ICNS,
  and Linux icon set without external assets or image dependencies. Invoke it
  through `npm run generate:desktop-icons`; packaging runs it automatically.
  Generated icon PNG/ICO/ICNS resources are ignored build products, not source
  inputs. Tests execute the generator in an owned temporary directory;
  Node/zlib compression differences must not dirty a reviewed checkout.
- `measure-performance-baseline.mjs` builds the production `/2dnd/` target,
  launches it on an unused local port, and prints reproducible bundle, startup,
  Boot texture, memory, DOM/listener, and fresh-save metrics. Run
  `npm run test:browser:install` once, then invoke it through
  `npm run benchmark:baseline`. The harness reads canonical `SAVE_VERSION`
  from the campaign owner and asserts the generated save matches it; schema
  updates must never bypass or hardcode this measurement guard.
  Character-creation actions reuse the browser suite's measured pointer helper,
  registered layout IDs and complete input frames, not stale coordinates or
  instantaneous key pulses. Reflow after changing stat mode must settle before
  the next target is measured; the receipt still exercises the current real UI.
  Receipts include raw samples, deviations, host load and 120-frame work counts.
  `PERFORMANCE_ROOT=/absolute/checkout npm run benchmark:baseline` measures that
  checkout with the current harness and records both commits; PR CI uses this
  for balanced base/head/head/base comparisons on one runner.
- `lib/frameWorkload.ts` supplies the read-only 120-frame DOM/JS/frame sampler
  shared by the production harness and browser work-budget regression. It never
  alters input, RNG, clocks or campaign state.
- `compare-performance.mjs` reads four complete harness logs in
  base/head/head/base order, validates provenance/environment parity and prints
  the pooled comparison. It preserves slower samples and applies no portable
  wall-clock threshold. PR CI publishes its output in the job summary and retains
  every original log.
- `lib/git-provenance.mjs` shares commit/clean-tree/diff-hash collection between
  the performance harness and Steam receipts without following untracked
  symlinks outside the worktree.
- `generate-desktop-notice.mjs` generates the exact source notice into the
  ignored `build/SOURCE.2dnd.txt` before packaging/signing. Both package commands
  call it and restore the pinned Electron binary if required for its bundled
  Chromium notices; staging never edits a signed bundle. Explicit `--output`
  writes only a notice, so synthetic unit fixtures need no binary or network.
- `prepare-steam.mjs` inspects unpacked platform architecture, game ASAR,
  current package version, licenses/source notice, exclusions, symlinks, hashes
  and permissions. Format-v2 receipts bind distinct platform-qualified
  corresponding-source archives, included inside each clean depot archive. It
  normalizes archive API paths for the host OS and rejects ASAR links without
  following them; manifest paths remain portable forward-slash paths. It
  creates credential-free previews by default, verifies complete preview sets
  and renders private VDFs only from validated environment IDs. Run
  `npm run steam:prepare` for syntax and read `docs/steam.md`.
- `lib/steam-payload.mjs` shares payload/source inspection, complete-set
  verification and exact private-template checks between preparation and
  upload. It validates source archive commit headers and hashes, and never
  treats a self-consistent receipt as authority for the current version or
  source notice.
  Mode comparison preserves POSIX permissions and Windows read/write flags;
  Windows archive-synthesized execute bits are not native permissions. Git
  attributes pin the license/source template's LF encoding before packaging.
- `upload-steam.mjs` is only for an explicitly authorized main-branch dispatch
  on a protected, preauthenticated ephemeral upload runner. It emits no
  account/partner details or raw SteamCMD output, fails closed and never sets
  a branch live. It revalidates the private depot copies, source receipts and
  all canonical VDFs, and binds them to the approved workflow commit before
  invoking SteamCMD. Do not run it for PR or local preview validation.

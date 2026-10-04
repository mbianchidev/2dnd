# Steam distribution preparation

[Documentation index](README.md) | [Desktop](desktop.md) |
[Release](release.md) | [Testing](testing.md)

This is a preparation and human release guide, **not a Steam release, a Deck
Verified claim, or evidence of a successful partner upload**. Steam SDK,
Steam achievements, Steam Cloud and the native Steam Input API are disabled.
The game remains a local, offline-capable Electron application with the
existing sandboxed bridge and schema-v18 slots.

## Platform and depot contract

[`steam/config.ts`](../steam/config.ts) is authoritative. Create one app with
three OS-filtered depots; associate every depot with the developer-comp and
intended store packages. Use all languages for these depots: the game interface
currently supports English only. Do not commit assigned partner app, depot or
package IDs.

| Depot | Architecture | Steam executable, relative to install root | Builder directory |
| --- | --- | --- | --- |
| Windows | x64 | `2D-and-D.exe` | `win-unpacked` |
| macOS | universal x64 + arm64 | `2D-and-D.app` | `mac-universal` |
| Linux | native x64 | `2D-and-D` | `linux-unpacked` |

Launch the macOS **app bundle**, not a hardcoded inner binary: Steam's own
architecture and Rosetta can otherwise influence the selected architecture.
No command-line arguments or separate launcher are required. Map each depot's
root into the install directory; do not install all three OS payloads together.
Steam launch-option and depot OS filters are human Steamworks configuration,
not settings that uploading a VDF automatically creates.

**The selected Deck path is native Linux x64, not Proton.** It uses the actual
unpacked Linux Electron runtime, not the Windows portable installer or the
AppImage. SteamOS/Linux compatibility, library requirements and selection of a
Steam Linux Runtime container must be tested on the private branch before
advertising Linux/Deck support. A Windows build under Proton is not a second
supported path unless it gets its own testing and release decision.

Players do not install Node, npm, a browser, an SDK, a mod loader or a separate
game launcher. Electron and Chromium are included. Native OS/runtime libraries
remain prerequisites; do not work around unsupported configurations by
disabling Electron's sandbox or adding privileged installation scripts.

## Local, credential-free preparation

Use Node 24 and the committed lockfile. Build on the matching OS, selecting the
explicit architecture. Example for Linux:

```bash
npm ci
npm audit
npm run generate:desktop-icons
npm run build:desktop
npm run test:desktop:built
npm run package:steam:ci -- --linux --x64
npm run steam:prepare -- prepare \
  --platform linux-x64 \
  --input release/steam-build/linux-unpacked \
  --output release/steam-preview/linux-x64
```

On Windows substitute `--win --x64`, `windows-x64` and `win-unpacked`. On macOS
substitute `--mac --universal`, `macos-universal` and `mac-universal`. The
universal executable must contain **both** architectures; an arm64-only or
x64-only bundle is rejected rather than relabeled.

Output directories must be new and must not overlap the input. Choose another
explicit directory for a rerun; the utility never deletes an existing payload.
Preparation requires no Steam client, SDK, account, network login or real IDs.
It produces:

| Output | Meaning |
| --- | --- |
| `content/<platform>/` | Inspected unpacked runtime, ready for that depot's file mapping |
| `<platform>.tar.gz` | Payload and receipt with executable modes and relative bundle symlinks preserved |
| `manifest-<platform>.json` | Source commit/dirty hash, version, launch path, architectures, ASAR entries and SHA-256 file/mode receipt |
| `scripts/*.vdf.in` | Public templates with unresolved, approved placeholder names |
| `source-<commit>.tar.gz` | Matching committed source, emitted only for a clean worktree |

Dirty-worktree previews are explicitly marked and cannot be uploaded through
the authorized path. Source and dependency provenance make composition and
integrity reproducible; signing timestamps, toolchain updates and archive
metadata are **not** promised to be byte-identical across machines.

Preparation checks ELF/PE/Mach-O architecture, required licenses, binary
permissions, traversal-safe relative symlinks, exact game ASAR contents and
staged hashes. The runtime excludes source maps, screenshots/showcase assets,
tests, source trees, development dependencies, credentials, SDK files, logs,
saves and Chromium profile databases. Unknown native runtime files fail the
gate rather than being silently copied or silently removed.

The package includes AGPL, Phaser/EventEmitter3 MIT and Electron/Chromium
notices. `SOURCE.2dnd.txt` identifies its source commit and is generated
**before packaging/signing**. Staging never modifies a signed app bundle.
Keep the exact corresponding source, lockfile and build scripts publicly
available when distributing a binary. Review third-party notices and
trademark/AGPL obligations with the human publisher; no legal approval is
implied by passing a packaging test.

## CI and protected SteamPipe delivery

`Desktop artifacts` runs on PRs. Alongside the existing unsigned installers,
it builds and inspects the three unpacked Steam payloads and uploads
credential-free previews. **No PR job receives partner IDs, account tokens,
signing credentials or publishing rights.**

`Steam depot preparation` is manual and main-only. Its default `preview`
operation runs the browser/unit/audit gate, Electron platform matrix and
depot inspection. Selecting `upload` also requires the explicit confirmation
input and the protected `steam-upload` environment.

Before enabling that environment, a human must:

1. Require independent reviewers, restrict deployment to reviewed `main`, and
   deny unreviewed refs. No PR/fork can run the upload job.
2. Provision a dedicated **ephemeral**, trusted Linux x64 runner carrying the
   `steam-upload` label. Do not attach that label to a developer laptop or a
   general-purpose/public PR runner.
3. Install Valve's SteamPipe tools outside the checkout and configure the
   environment variable `STEAMCMD_PATH`. Bootstrap a least-privilege build
   account and Steam Guard interactively outside Actions. Preserve its login
   token only in the protected SDK configuration; never pass passwords or
   Steam Guard codes through command arguments, source, artifacts or logs.
4. Configure environment secrets named `STEAM_APP_ID`,
   `STEAM_DEPOT_WINDOWS_ID`, `STEAM_DEPOT_MACOS_ID`, `STEAM_DEPOT_LINUX_ID` and
   `STEAM_BUILD_ACCOUNT`. Do not paste their values in issues or PRs. IDs must
   be distinct positive uint32 decimal strings, without leading zeroes.
5. Define restricted host-log handling and verified runner teardown. Private
   VDFs, SteamCMD logs, output caches and tokens must never become Actions
   artifacts; destroy ephemeral private work areas after diagnosis. Persistent
   authentication, if used, needs a separately secured lifecycle.

The upload job downloads only its own reviewed build's archives, rechecks
every receipt, privately renders the VDFs and runs preauthenticated SteamCMD.
It does not print IDs/account details or relay SteamCMD output into Actions.
Private files use owner-restricted permissions; failure reports point the
operator to restricted host logs. Missing authorization, incomplete platform
sets, mismatched receipts or dirty source fail closed.

`Preview` defaults to `1` when rendering privately. `--upload` is accepted only
under explicit protected authorization. **`SetLive` is always empty.** The
workflow cannot promote a beta/default branch, publish a store page or release
the game. A successful upload is only an uploaded build awaiting human review.
The SDK/login runner and actual SteamCMD success response still require a
partner dry run; mock configuration tests do not prove a real upload.

The preview builds are unsigned. Signing/notarization must be performed and
verified in a separately protected process before a public distribution claim.
Uploading an unsigned build for private QA is not signing approval. Never add
signing secrets to the preview matrix.

## Local saves, updates and optional integrations

Steam/direct launches use the same application name, user-data root and
`app://2dnd` origin. Saves are **per OS profile**, not per Steam account; two
Steam accounts using the same OS profile currently share that local profile.
There is no automatic browser-to-desktop or cross-device transfer.

The install directory contains no saves. Updates replace only runtime files.
Local autosave, three manual slots, preferences, staging/backup recovery and
diagnostic logs remain under the existing user-data directory. A normal
uninstall/reinstall should preserve that directory, but real Steam and OS
uninstaller behavior must be checked before promising preservation.

Before update/rollback/reinstall QA, export validated manual slots and preserve
a recoverable local copy. Do not downgrade to a version unable to read the
newer campaign schema. An older binary that starts is not proof that its save
normalizer can preserve newer progress. Neither the workflow nor Steam
promotion silently merges, rewrites or deletes campaign profiles.

| Integration | Current declaration | Future review required before enabling |
| --- | --- | --- |
| Steam achievements | Disabled; in-game achievements only | Explicit stable ID map, natural/debug-earned distinction, idempotent earned-state mirroring, offline retry/reconnect, validated narrow IPC; never Steam-to-game authority |
| Steam Cloud / Auto-Cloud | Disabled; leave its Steamworks flags and paths unset | Validated document export/import through the existing slot/preference owners, atomic backups, schema/size validation, explicit conflict UI, bounded quotas, offline queue, cross-device/account policy and corruption isolation |
| Native Steam Input API / SDK | Disabled | A separately reviewed optional adapter, supported glyph metadata and SDK/license validation; no generic Steamworks/command/filesystem access |
| Overlay | External client behavior, unverified | Real Steam launch, shortcut, focus and rendering tests; no campaign dependence |

**Never sync `Local Storage`, LevelDB, IndexedDB, session storage, cache,
cookies, Crashpad, logs or an entire Electron user-data directory.** Those
files are not portable campaign documents. Cloud conflict/quota tests are not
claimed for a feature that is deliberately absent.

## Controller and Deck-equivalent coverage

[`steam/controller-layout.json`](../steam/controller-layout.json) is a complete
semantic-action catalog and **legacy standard-gamepad emulation recipe**, not
an uploaded Steam layout or a native Steam Input VDF. It is checked against
`INPUT_ACTIONS` and `STANDARD_GAMEPAD_BINDINGS`; the renderer remains the sole
input authority.

Start from a Steam gamepad-emulation template: D-pad/left stick navigate, south
confirms, east cancels, west interacts/edits names, north/Menu opens menus,
View opens Tips, bumpers change Battle targets/Codex categories and triggers
scroll the Battle log. Right stick moves the existing virtual cursor and R3
clicks it, including the native fullscreen DOM control. An optional right
trackpad may emulate the right stick; avoid duplicate mouse/gamepad outputs.
All other unlocked actions are reached through their menus/pointer-first
controls. Keep Steam, Quick Access and Shift+Tab reserved to the client.

The shared controller keyboard covers hero names, slot labels and search:
D-pad selects, south types, west deletes, Menu submits and east cancels.
`Aa` switches letter case. Focus is visible, tab stays within the dialog, and
closing restores focus without committing a canceled edit. The English game
uses an English letter/digit keyboard; do not claim multilingual text entry.
Keyboard/touch native text entry remains available.

Prompts use positional text rather than guessed hardware brands:

| Position | Xbox | PlayStation | Nintendo-style | Generic |
| --- | --- | --- | --- | --- |
| South | A | Cross | B | Bottom face button |
| East | B | Circle | A | Right face button |
| West | X | Square | Y | Left face button |
| North | Y | Triangle | X | Top face button |

These are physical-position references, not detected Steam glyphs. Device
remapping, Steam Input emulation and every named controller still need client
QA. Do not advertise exact device glyph detection or Deck Verified.

`electron-tests/deck.spec.ts` uses the real production-like Electron renderer
with deterministic standard-gamepad stubs. It covers 1280x800, text
100%/125%/150%, high contrast/reduced motion, named character creation,
exploration and a normal random battle, Codex search, manual save/rename,
relaunch/recovery, controller-only title exit, cursor fullscreen, reconnect,
focus loss and 1920x1080-to-1280x800 resizing. No test cheats are enabled in the
packaged renderer. Preference/RNG/corruption fixtures are test setup, not
proof of a physical controller or a Steam service.

The test attaches startup, **actual validated atomic slot-write** duration,
180-frame interval samples, JS/native memory and post-GC DOM/listener counts
after repeated menu/Tips cycles. `2dnd:save-slot-write` retains only the latest
measure, never campaign content. This is a short deterministic cleanup stress
sample, not an hours-long endurance test, battery/power measurement or a
portable performance budget.

Focus-loss events and window resizing are **equivalents**, not hardware
suspend/resume or dock/undock. The Steam-client install path, Gamescope,
overlay, Steam Input, physical keyboard invocation, OS resume, dock hotplug,
Deck LCD/OLED performance and long-session thermal behavior remain manual
device gates. Use a physical Deck at 1280x800 and record device, OS/Steam
versions, power/refresh settings, runtime selection and build receipt.

The Electron suite uses a fixed emulated renderer viewport as well as native
window sizing, so a hosted runner's smaller display work area cannot silently
turn 1280x800 into 1280x645. It applies the viewport after controller-fixture
reloads and checks the exact dimensions. DOM/GC snapshots leave scripts and
Phaser's frame loop running; the read-only layout report reuses its text node
instead of allocating transient replacements. Assertions still require exact
node/listener equality. No production security settings or campaign state are
changed by these test-only sampling controls.

## Store metadata draft

Do not publish until the human publisher approves every field.

| Field | Draft / decision |
| --- | --- |
| Title | 2D&D; trademark/name review required, no D&D/Dragon Quest branding or implied affiliation |
| Description | Single-player retro JRPG: create one of 12 hero classes, recruit companions and complete the Twelvefold Covenant through exploration and turn-based combat |
| Platforms | Proposed Windows x64, macOS x64/arm64 universal and native Linux x64; advertise only after that platform's install/client gate |
| Languages / voice | English interface; no recorded spoken voice |
| Network | No game accounts, telemetry, analytics, DRM check or gameplay network calls; Steam's download/client/overlay uses Valve's services independently |
| Saves | OS-profile local autosave + three manual slots and validated JSON export/import; no Steam Cloud or account-based syncing |
| Features | Single player; in-game achievements only; no Steam achievements, multiplayer, Workshop, Cloud or native Steam Input API claim |
| Controller/accessibility | Built-in gamepad navigation/cursor/text keyboard, adjustable text, high contrast, reduced motion and audio; full controller/Deck claims remain pending client/device/OS file-dialog QA |
| Requirements | Exact supported OS floors, GPU/CPU/RAM minimums and recommended specs are **pending measured minimum-spec tests**; CI runner specs are not minimum requirements |
| Storage | Derive installed bytes and update headroom from the inspected platform manifest; do not quote compressed download size as installed disk use |
| Support | <https://github.com/mbianchidev/2dnd/issues>; review/redact any voluntarily supplied saves/logs before posting |
| Legal/privacy | AGPL-3.0-only plus included dependency notices; publisher legal entity, privacy contact, terms, effective date and jurisdiction-specific review are human prerequisites |

Privacy disclosure draft: campaign names/progress and preferences remain on the
device until the player explicitly exports/shares them. Local rotating
diagnostic logs record lifecycle/errors rather than intentional save-payload
collection; inspect/redact error text before sharing. No automatic upload,
support inbox, account service, payment handling or tracking is implemented by
the game. Store/client processing is governed independently by
[Valve's privacy agreement](https://store.steampowered.com/privacy_agreement/).
This is a factual product disclosure, not a fabricated GDPR-compliance policy.
The publisher must identify the controller/contact and define any support-data
retention, rights requests and privacy notices before receiving such data.

Artwork must use original repository-owned procedural art and actual game
captures. The current low-resolution showcase PNGs are **not** Steam-ready
screenshots. Recapture the running game at the required resolution with its
natural letterboxing; do not add third-party characters, music, logos, awards
or fabricated gameplay.

| Asset | Current Valve requirement |
| --- | --- |
| Header capsule | 920x430 |
| Small capsule | 462x174, title readable at generated small sizes |
| Main capsule | 1232x706 |
| Vertical capsule | 748x896 |
| Screenshots | At least five actual gameplay captures, 1920x1080 minimum, 16:9 |
| Optional page background | 1438x810 |
| Library capsule/hero/logo and icons | Use Valve's current library templates and asset rules; human artwork review required |

Recheck [store assets](https://partner.steamgames.com/doc/store/assets/standard)
and [graphical rules](https://partner.steamgames.com/doc/store/assets/rules)
when uploading; requirements can change. Only game title/logotype belongs on
standard capsules, not review quotes or feature/discount marketing text.

## Human release checklist and evidence

Record source commit, platform/depot/build IDs **privately**, device/runtime,
case, actual result and recovery outcome. Do not check a case off from a
different artifact or from mock/equivalent evidence.

| Case | Required actual evidence |
| --- | --- |
| Fresh install / first launch | Private Steam branch and direct payload on every supported OS; correct executable/architecture, no extra runtimes/launcher, usable local New Game |
| Offline / no Steam | Restart Steam offline and direct-launch with Steam closed; character creation, normal Battle, save/reload and local quit remain usable |
| Update | Install older supported build, create autosave/manual/preferences, promote private update and compare validated documents and independent source slots |
| Rollback | Supported schema-compatible rollback, preserved exports/backups, no lost fields/rewards; block unsupported schema downgrade claims |
| Uninstall/reinstall | Actual Steam/client and native package uninstall behavior; local documents remain valid unless the player explicitly removes profile data |
| Corruption / quota | Isolated slot recovery from staging/backup; visible failure, other slots preserved; full-disk and interrupted write cases |
| Overlay / Input | Shift+Tab, Steam/Quick Access, default published layout, real brand prompts, reconnect and no stuck held input |
| Deck display / text | 1280x800, 100/125/150%, physical legibility (Valve minimum character height), high contrast, reduced motion and complete controller-only flow |
| Suspend / dock | Actual sleep/resume during exploration/Battle/save, repeated dock/undock and display/controller changes without state loss |
| Performance / endurance | Cold/warm startup, 30fps-or-better default Deck configuration, frame pacing, process memory, atomic-save latency, hours-long cleanup/thermal/power evidence |

Partner onboarding, Steam Direct app fee, tax/banking completion, permissions,
content survey/ratings, store and build review, supported languages, territory
rules, pricing and release date are **human Steamworks operations**. Never
request or expose their private details in repository work.

| State | Distinct approval required |
| --- | --- |
| Code/preparation complete | Source/test/audit/CI/CodeQL/review gate and inspected previews |
| Depot uploaded | Explicit protected authorization and real SDK/account success; not yet visible to customers |
| Store/build approved | Valve and human review, accurate metadata/artwork/legal/source availability |
| Signed/notarized | Verified Developer ID/notarization and Authenticode outputs where required |
| Device-ready | Real supported-OS and Deck/client checklist, published controller layout and measured requirements |
| Publicly released | Explicit human Steamworks promotion/release approval; never inferred from upload or CI |

Issue [#183](https://github.com/mbianchidev/2dnd/issues/183) remains incomplete
while required client/hardware/partner/signing/human evidence is missing.

References: [SteamPipe](https://partner.steamgames.com/doc/sdk/uploading),
[Steam testing](https://partner.steamgames.com/doc/store/testing),
[updates](https://partner.steamgames.com/doc/store/updates),
[Deck compatibility](https://partner.steamgames.com/doc/steamdeck/compat).

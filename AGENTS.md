# Agent guide

High-signal operating guide for changes to 2D&D. Read the relevant detailed
page in [`docs/`](docs/README.md) and matching
`.github/skills/*/SKILL.md` before editing. Repository-wide constraints remain
authoritative in [`.github/copilot-instructions.md`](.github/copilot-instructions.md).

## Snapshot

| Contract | Current value |
| --- | --- |
| Product | Browser JRPG, release v1.0.0 |
| Runtime | Phaser 4.2.1 |
| Language | TypeScript 7.0.2, strict, ES2020 |
| Build/test | Vite 8.2.1, Vitest 4.1.10, Playwright 1.62.1 |
| DOM tests | happy-dom 20.11.1 |
| Save schema | 17 |
| Deployment | GitHub Pages at `/2dnd/` |
| Assets | Procedural graphics and Web Audio only |

Only current `main` is shipped behavior. Treat issues and open pull requests as
future work until merged.

## Task routing

| Domain | Data/contracts | Mechanics/state | Phaser/presentation | Tests |
| --- | --- | --- | --- | --- |
| Combat/status/elements | `src/data/{abilities,spells,elements}.ts` | `src/systems/{combat,groupCombat,battleActions,statusEffects}.ts` | `Battle.ts`, battle managers/renderers | `combat`, `groupCombat`, `battleActions`, `statusEffects`, Battle E2E |
| Party/gambits/inventory | `src/data/companions.ts` | `party.ts`, `gambits.ts`, `inventory.ts` | `partyOverlay.ts`, `battleParty.ts`, followers/renderers | party/companion/gambit/inventory suites |
| Quests/cutscenes | `quests.ts`, focused `cutscene*.ts` | `quests.ts`, `questState.ts`, `cutscenes.ts` | quest/cutscene managers, `Cutscene.ts`, `Ending.ts` | quest/cutscene/campaign E2E |
| World/map/traps | `map*.ts`, `chunks.ts`, `cities.ts`, `dungeons.ts`, `traps.ts` | `movement.ts`, `traps.ts` | map/city/trap/fog managers/renderers | map, city, trap, fog, movement |
| Sea navigation | `nautical.ts`, `islands.ts`, `seaMonsters.ts` | `nautical*.ts` | Overworld/map/audio | nautical unit and E2E |
| Events/social/achievements | matching `src/data/` modules | matching `src/systems/` modules | managers/overlays/social renderer | matching unit and E2E |
| Gathering/crafting | matching `src/data/` modules | matching systems + state normalizers | matching managers | matching unit and E2E |
| Saves | owning interfaces/defaults | `save.ts` plus focused state normalizers | Boot/load/recovery callers | `save.test.ts` + domain migration tests |
| Accessibility/input | tutorial/feature definitions | `accessibility.ts`, `input.ts`, `featureDiscovery.ts` | input/tutorial/layout managers | accessibility/input/layout/feature E2E |
| Audio | typed data cues | `audio.ts`, `trapAudio.ts` | callers only | audio + representative browser flows |
| UI/layout | stable IDs/content definitions | `systems/layout.ts` | `managers/layout.ts`, owning manager/renderer | layout unit + clean-layout E2E |

## Required workflow

1. **Inspect:** check current branch/base, related data/system/manager/renderer,
   callers, tests, docs, skills, and merged history. Search for an existing
   helper before creating one.
2. **Implement:** change the authoritative layer first, then adapters and
   presentation. Keep IDs stable and edits focused.
3. **Targeted validate:** run the smallest related Vitest files and focused
   Playwright specs.
4. **Full gate:** run install/audit, typecheck, full Vitest, full Playwright,
   build, and `git diff --check`.
5. **PR/CI:** push a review branch, open a PR, wait for PR CI and CodeQL, and
   resolve every failure and review comment. Do not merge without explicit
   instruction.

```bash
npm ci
npm audit
npm run typecheck
npm test
npm run test:browser
npm run build
git diff --check
```

Run `npm run test:browser:install` once when Chromium is absent.
Run `npm run benchmark:baseline` on the current base commit before
performance-affecting work and record its commit, environment, and output in the
owning issue or pull request.

## Non-negotiable invariants

- Strict TypeScript, explicit types, no `any`, no unsafe nested save casts.
- No external image/audio assets, gameplay network calls, or runtime mutation
  of shared definitions.
- Build scene payloads with `createSharedSceneState()`; preserve player, bosses,
  Codex, time, weather, and special NPCs.
- `SceneTransitionManager` owns fades. Fade-complete is authoritative; the
  duration-plus-grace timer is recovery only.
- `battleActions.ts` owns party action validation, targets, resources, and
  one-action/one-bonus-action economy.
- Resolve mechanics before animation; presentation never spends resources or
  controls authoritative outcomes.
- Use stable IDs for combatants, quests/stages/objectives/rewards, cutscenes,
  shops, traps, events, recipes, transactions, features, and layout items.
- Persist authority, not derived presentation. Every schema change requires
  defaults, normalization, cross-field validation, migration, and corruption
  tests.
- Route all release input through semantic contexts; do not add scene-local
  gamepad/touch mappings or conflicting production/debug keys.
- Own and clean up listeners, timers, tweens, emitters, DOM controls, texture
  leases, and transient containers.
- Install accessibility in every scene; support text scales, high contrast,
  reduced motion, non-color cues, touch, and gamepad cursor flows.
- Use `debugLog()`/debug panels, never production `console.log`.
- At 1,000 source lines, consider extraction before adding responsibility.

## Frequent regressions and the correct pattern

| Pitfall | Correct pattern |
| --- | --- |
| Fixed UI coordinates or raw menu indexes | Stable layout IDs, measured bounds, filtered entries, focus restoration |
| Timer-driven scene start | Fade-complete listener plus delayed recovery watchdog |
| Partial scene payload | `createSharedSceneState()` and update every caller/test |
| New field without migration | Interface + default + unknown normalization + cross-field repair + schema bump + tests |
| Duplicate combat logic in scene/AI | Plan and execute through `battleActions.ts` and existing combat/status/element helpers |
| Keyboard fix that breaks touch/gamepad | Semantic action/context in system layer, browser adapter in `managers/input.ts` |
| Browser test on stale server/root path | `npm run test:browser`; fresh strict port and `/2dnd/` default |
| Docs copied from an issue or branch | Verify current `main`, source constants, package manifest, and merged PR |
| Parallel features merged in arbitrary order | Identify shared files, choose dependency order, rebase after prerequisite, preserve both contracts |
| Targeted tests only | Full typecheck, Vitest, Playwright, build, audit, CI, and CodeQL before completion |
| Growing scenes/overlays | Extract focused system, manager, renderer, or data module |

## Change checklists

### Persistence

- [ ] Owning interface and creation default updated
- [ ] Parsed value treated as `unknown`
- [ ] IDs, ranges, duplicates, and cross-fields normalized
- [ ] `SAVE_VERSION` incremented for shape changes
- [ ] Deterministic pending state cannot reroll or double-apply
- [ ] Legacy and corrupt data tests added
- [ ] README/docs/instructions/save skill synchronized

### Scene

- [ ] `init()` stores input and resets transient state
- [ ] `create()` calls transition preparation and accessibility installation
- [ ] Every caller passes the complete typed contract
- [ ] Input is blocked while handoff is pending
- [ ] Listeners/timers/tweens/emitters/DOM/textures cleaned on shutdown
- [ ] Reduced motion completes immediately and exactly once
- [ ] Transition contract and browser flow covered

### UI/layout

- [ ] Hidden/disabled entries filtered before layout
- [ ] Stable item/layout IDs used
- [ ] Actual scaled bounds and safe areas measured
- [ ] Hit areas synchronized after reflow
- [ ] Focus restored by ID and clamped
- [ ] Keyboard, pointer, touch, gamepad, 150% text, high contrast, and reduced motion checked
- [ ] Layout audit reports no unintended overlap or clipping

### Combat

- [ ] Stable combatant/target IDs used
- [ ] Existing target/resource/action-economy validator reused
- [ ] MP/items/actions consumed only after validation
- [ ] Status then element ordering preserved
- [ ] Duplicate monsters retain independent state and defeat records
- [ ] Mechanics resolve before animation
- [ ] Victory/flee/defeat report once and share guarded cleanup

### Integration and conflicts

- [ ] Confirm prerequisite merge order before combining cross-cutting work
- [ ] Rebase onto current `main` after prerequisites
- [ ] Preserve newer layout, discovery, accessibility, and semantic-input contracts
- [ ] Resolve by ownership layer, not by choosing an entire side blindly
- [ ] Rerun all affected focused suites after conflict resolution
- [ ] Run the complete release gate after integration

## Detailed references

- [Architecture](docs/architecture.md)
- [Development](docs/development.md)
- [Testing](docs/testing.md)
- [Save system](docs/save-system.md)
- [Companions and gambits](docs/companions.md)
- [Inventory presentation](docs/inventory.md)

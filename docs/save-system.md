# Save system

[Documentation index](README.md) | [Architecture](architecture.md) |
[Testing](testing.md)

## Storage documents

| Key | Ownership |
| --- | --- |
| `2dnd_save` | Dedicated autosave campaign, schema v18; also the legacy-compatible default-slot key |
| `2dnd_save_slot_manual-1` through `manual-3` | Independent manual campaign slots |
| slot `:staging`, `:backup`, and `:name` keys | Atomic-write recovery copies and manual display names |
| `2dnd_save_slots_migrated_v1` | Verified one-time legacy autosave migration marker |
| `2dnd_preferences` | Versioned audio, accessibility, cutscene, touch, and prompt settings |
| `2dnd_inventory_prefs` | Inventory sort, filter, and search presentation |

Legacy `2dnd_audio_prefs` and `2dnd_cutscene_accessibility` values migrate into
`2dnd_preferences`. Presentation preferences do not increment the campaign
schema.

Browser deployments store these documents under their HTTP/HTTPS origin.
Packaged Electron builds use the stable secure `app://2dnd` origin and the same
schema and normalization code. Browser and desktop stores are intentionally
isolated and never silently merged.

Campaign normalization and autosave compatibility live in `src/systems/save.ts`;
manual-slot metadata and management live in `src/systems/saveSlots.ts`, the
typed atomic adapter lives in `src/systems/saveStorage.ts`, and the shared
title/Overworld interface lives in `src/managers/saveSlots.ts`. Focused
normalization remains beside its domain where appropriate, including
`questState.ts`, `gatheringState.ts`, `craftingState.ts`, and
`nauticalState.ts`.

## Current schema

`SAVE_VERSION` is **18**. Schema v18 adds normalized non-negative
`playtimeSeconds` to each campaign document. Slot names, backup state, and
migration bookkeeping remain storage metadata rather than campaign authority.

The campaign save contains the authoritative player, location, progression,
party, quest, cutscene queue, trap, Codex, skill-check, event, social,
achievement, gathering, crafting, nautical, feature-discovery, time, weather,
boss, and playtime state needed to resume play.

Important composed fields live under:

```typescript
player.position
player.progression
player.party
player.activeEffects
```

`defeatedBosses` is serialized as an array and restored to a `Set<string>` for
runtime scene state.

## Slot and recovery model

- `autosave`, `manual-1`, `manual-2`, and `manual-3` are the only stable slot
  IDs.
- Gameplay autosaves only to `autosave`; manual saves are independent snapshots.
- Loading a manual slot makes that campaign the next autosave without rewriting
  the source manual slot.
- The first valid legacy `2dnd_save` is staged, verified, and backed up in place
  before the migration marker is written. The original document is never
  deleted during migration.
- Writes verify a staging copy before replacing the primary. The prior valid
  primary becomes the backup, and failed writes roll back to it.
- Reads try primary, interrupted staging, then backup. Recovery affects only the
  selected slot, so one malformed campaign cannot hide valid campaigns.
- Title and Esc-menu surfaces require confirmation before overwrite or delete.
  Manual slots can be renamed or copied. Validated deterministic JSON
  import/export never uses network or cloud services.
- Storage, quota, verification, and import failures remain recoverable, are
  logged, and publish a visible `role="alert"` message.

## Authoritative versus derived data

Persist data only when it is authoritative and cannot be reconstructed safely.

Persist:

- stable IDs and explicit completion/claimed/applied transaction IDs
- selected pending outcomes that must survive reload without rerolling
- non-reconstructable counters and bounded histories
- mutable ownership, resources, equipment links, location, and progression
- irreversible discovery needed for visibility or one-time feedback

Derive:

- definitions, display names, categories, thresholds, and totals
- monster-family or Codex completion
- alignment names and reputation tiers
- recipe definitions and material meaning
- feature availability from authoritative evidence
- achievement progress that can be reconciled safely
- runtime scene adapters, hooks, and presentation state

Codex, achievements, discovery, Chronicle records, and presentation preferences
must never become authority for quests, access, rewards, combat, or endings.

## Load and recovery policy

Treat parsed JSON as `unknown`. Validate top-level and nested records with typed
guards, normalize known values, discard malformed optional records, and return
`null` when the top-level payload is unusable.

Location recovery:

1. Make city and dungeon flags mutually exclusive.
2. Reject unknown IDs.
3. Clamp dungeon levels and city district indexes.
4. Resolve the correct map through helpers.
5. Repair invalid interior coordinates to that level/district spawn.
6. Recover unusable overworld positions to Willowdale.
7. Recover invalid sailing positions to a safe known port or Willowdale.

Replacing a malformed deterministic seed must clear state derived from that
seed, such as trap layouts or gathering nodes/pending play.

## Migration history

Current loading preserves and repairs earlier releases, including:

- flat player position/progression composition
- quest, skill-check, trap, party, and recruitment defaults/replay
- stable seen/pending cutscene queues and completed-but-unseen epilogue recovery
- Codex world-knowledge IDs and durable-evidence reconciliation
- tutorial completion defaults for established campaigns
- World Event, social, achievement, gathering, crafting, nautical, and feature
  discovery defaults and corruption repair
- schema-v17 and older playtime defaulting to zero

Migrations must not replay completed rewards, reroll pending outcomes, infer
unknown defeat history, create duplicate companions, or emit mature-save
notification storms.

## Persistence-change checklist

When a persistent shape changes:

1. Update the owning TypeScript interface.
2. Add the creation default.
3. Normalize from `unknown`.
4. Validate cross-field invariants and canonical IDs.
5. Increment `SAVE_VERSION`.
6. Preserve legacy behavior or add explicit recovery.
7. Add round-trip, missing-field, malformed-field, duplicate/unknown-ID, and
   corruption tests.
8. Test invalid locations and deterministic-seed replacement when relevant.
9. Reconcile authoritative evidence idempotently after normalization.
10. Update `README.md`, this guide, `AGENTS.md`,
    `.github/copilot-instructions.md`, and the save skill.

Run `tests/save.test.ts`, `tests/saveSlots.test.ts`,
`tests/saveStorage.test.ts`, and every domain-specific migration test before the
full release gate.

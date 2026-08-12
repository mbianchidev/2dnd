# Save system

[Documentation index](README.md) | [Architecture](architecture.md) |
[Testing](testing.md)

## Storage documents

| Key | Ownership |
| --- | --- |
| `2dnd_save` | Campaign state, schema v17 |
| `2dnd_preferences` | Versioned audio, accessibility, cutscene, touch, and prompt settings |
| `2dnd_inventory_prefs` | Inventory sort, filter, and search presentation |

Legacy `2dnd_audio_prefs` and `2dnd_cutscene_accessibility` values migrate into
`2dnd_preferences`. Presentation preferences do not increment the campaign
schema.

The save implementation is `src/systems/save.ts`. Focused normalization lives
beside its domain where appropriate, including `questState.ts`,
`gatheringState.ts`, `craftingState.ts`, and `nauticalState.ts`.

## Current schema

`SAVE_VERSION` is **17**.

The campaign save contains the authoritative player, location, progression,
party, quest, cutscene queue, trap, Codex, skill-check, event, social,
achievement, gathering, crafting, nautical, feature-discovery, time, weather,
and boss state needed to resume play.

Important composed fields live under:

```typescript
player.position
player.progression
player.party
player.activeEffects
```

`defeatedBosses` is serialized as an array and restored to a `Set<string>` for
runtime scene state.

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

Run `tests/save.test.ts` plus every domain-specific migration test before the
full release gate.

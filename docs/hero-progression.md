# Hero multiclass progression

[Documentation index](README.md) | [Gameplay](gameplay.md) |
[Save system](save-system.md)

## Choosing the next class

Character creation still selects one starting class and applies its boosts,
starting weapon and gold exactly once. The hero can later add levels from any
qualified existing class; the starting identity and appearance do not change.
There is no respec, class-level removal, or stat-point refund.

XP earns pending **total character levels**. A short rest or either inn surface
authorizes those levels for selection. Choose one class, inspect its exact
HP/MP, spells, abilities, talents and ASI preview, then confirm. The result page
requires another confirmation before the next choice. Normal total level stops
at **20**, even when many classes are owned.

The rest-ready queue survives cancellation and save/reload. Later XP does not
inherit an earlier rest's authorization. A KO clears uncommitted XP levels and
rest credits but never removes already earned class levels or known actions.

`E`, then `Tab`, opens the character sheet; its visible Class progression link
does the same. The sheet can resume rested choices or allocate saved stat
points. Within it, arrows/WASD select, left/right change list pages, Enter/Space
confirms, Page Up/Down changes detail pages, Tab opens pending stats, and Esc
closes. Pointer/touch buttons and the shared gamepad D-pad/A/B/cursor use the
same controls. Measured pagination supports 100%, 125%, 150% text, high contrast,
small viewports and reduced motion.

## Entry prerequisites

Continuing an owned class never rechecks entry prerequisites. Entering a new
class requires both its requirements and those of the starting class. All
requirements use actual ability scores, not equipment/status bonuses.

| Class | Entry requirement |
| --- | --- |
| Knight | STR 13 **or** DEX 13 |
| Ranger | DEX 13 **and** WIS 13 |
| Wizard | INT 13 |
| Sorcerer | CHA 13 |
| Rogue | DEX 13 |
| Paladin | STR 13 **and** CHA 13 |
| Warlock | CHA 13 |
| Cleric | WIS 13 |
| Druid | WIS 13 |
| Barbarian | STR 13 |
| Monk | DEX 13 **and** WIS 13 |
| Bard | CHA 13 |

Unmet requirements remain inspectable rather than hiding a class. Save
normalization preserves recognized earned ranks without rechecking mutable
scores.

## Resource and feature rules

- HP grows by the selected class hit die plus Constitution modifier, minimum
  one. Entering another class uses incremental growth, not another starting HP
  grant. Knight/Ranger/Paladin use d10, Wizard/Sorcerer d6,
  Rogue/Warlock/Cleric/Druid/Monk/Bard d8, and Barbarian d12.
- MP remains one shared pool for every class, growing by
  `max(1, 2 + Intelligence modifier)` per level. Rage, ki, inspiration and Wild
  Shape retain their existing MP-backed abilities; no new charge/slot pools or
  additional action slots are introduced.
- A prepared receipt freezes one resource roll and its Constitution and
  Intelligence scores. Switching class, allocating an older ASI, cancelling or
  reloading cannot reroll that receipt. The selected hit die determines the
  exact preview from the same frozen roll.
- Proficiency uses total level: +2 initially, increasing at totals 5, 9, 13 and
  17. ASIs grant two points once at totals 4, 8, 12, 16 and 19.
- Unrestricted talents use total level. Class-restricted talents, spells and
  abilities use their owning class rank and canonical grant levels. A
  Knight 6/Wizard 1 does not learn Wizard-rank-six Fireball.
  Only talents explicitly marked `progressionScope: "totalLevel"` participate
  in the common scan; all other talents require an owning profile. Future
  track-only HP/MP grants cannot leak to unrelated heroes or companions.
- Shared spell/ability/talent IDs are deduplicated within their respective
  namespaces. Shared talent HP/MP bonuses apply once, not once per class.
  Hunter's Mark's spell and ability remain distinct actions.
- Spells use the highest eligible source ability score; equal scores prefer the
  starting class, then static registry order. Abilities retain their explicit
  stat keys. Normal weapon attacks retain STR/finesse rules; the compatible
  off-hand fallback uses the stable starting primary stat.
- Existing permissive weapon/armor/shield rules are preserved. Multiclass entry
  neither replaces equipment nor grants starter equipment. Two-handed,
  shield/off-hand, inventory ownership, protected transfer and shop total-level
  requirements remain unchanged.
- Stat allocation retains the existing per-score-point retroactive HP/MP
  behavior for CON/INT, uses total level and stops at score 30.

Companions remain independently leveling, single-class actors. Hero/companion
manual turns and gambits still validate targets, known actions, MP, inventories
and economy through `battleActions.ts`. Each actor retains one main action and
one bonus action.

## Authority and APIs

Immutable profiles live in `src/data/classProgression.ts`. The authoritative
engine is `src/systems/classProgression.ts`; unknown/save normalization lives
in `classProgressionState.ts`, with serialized hero item validation and exact
duplicate equipment matching in `heroItemState.ts`. Presentation is owned by
`src/managers/heroProgression.ts`, with pure measured pagination in
`src/systems/progressionPresentation.ts`.

`PlayerState.classProgression` stores starting identity, base-class ownership,
an empty reserved external-track map, rest-ready credits, one frozen receipt,
and exceptional canonical legacy grants. `level` is a compatibility mirror of
the owned-rank sum, not another progression engine.

Public APIs include `getTotalLevel`, `getClassLevel`, `getTrackLevel`,
`getProgressionTracks`, `getFeatureSources`, `getSpellCastingStat`,
`qualifyNextClass`, `prepareHeroLevelUp`, `prepareNextHeroLevelUp`,
`previewHeroLevelUp`, `commitHeroLevelUp`, `canActorEquip`,
`canActorUseSpell`, `canActorUseAbility`, and `normalizeHeroClassProgression`.
Commit binds the expected current total level and consumes exactly one earned,
rest-ready level; stale or repeated input does nothing.

`createHeroProgressionContext(getPlayer: () => PlayerState, profiles?)` binds
typed quest, location, alignment and reputation requirements to the live
authoritative owner. Preview and commit both evaluate it; a changed world can
reject entry atomically at commit. Missing/mismatched owner contexts fail
closed. Earned ranks never recheck entry evidence during load.

Detached character cloning can preserve cumulative XP, pending/rest-ready
counts and the exact frozen receipt through equipment relink, full HP/MP
restoration and world/cycle reset. Rebind the context to the new owner; an old
owner's context cannot authorize the clone. Resetting character XP/totals is a
different progression mutation and normalization revokes incompatible credits
rather than granting new rest authority. No separate NG+ XP/rest engine is added.

Quests, access, dialogue, shops, Codex, achievements and endings keep their
existing authoritative state. Class choices update combat/progression and
derived character/slot/Ending labels; they do not complete quests, recruit
companions, claim rewards or grant campaign access.

The typed external-profile registry is an extension hook only. **No prestige,
epic or NG+ content is installed**, and there is no arbitrary runtime cap
override. Those future domains must consume the same engine after its merge.

## Saves and debug

Schema v19 migrates legacy single-class ownership from the old identity/level,
preserving stats, rolled HP/MP, canonical known actions/talents and equipment
links without rerolling or applying bonuses on load.

Well-formed serialized custom hero items retain their IDs, names, metadata and
inventory order. Equipment relinks to the complete matching item, not the first
same-ID duplicate. Valid legacy orphan gear is recovered without replacing its
metadata. Companion loadouts retain their separate canonical-item restrictions.

Old saves can legitimately lack historical unlocks. Optional
`deferredLegacyGrants` preserves those gaps across later saves until the next
applied level grants them once, matching the former level processor. Canonical
legacy exceptions remain explicitly retained. Modern corrupt/missing knowledge
is repaired without replaying already applied HP/MP bonuses. Ownership,
duplicates, limits, frozen receipts and rest/XP cross-fields are normalized
independently from world/campaign progress.

Debug-only commands:

```text
/class list
/class status
/class qualify <classId>
/class level <classId>
/class sheet
```

`level` is a bounded canonical transaction available only during safe
exploration. It grants no starting boosts/equipment and suppresses newly met
natural achievement criteria through the existing debug path. Inspection does
not mutate state. There is no debug respec command.

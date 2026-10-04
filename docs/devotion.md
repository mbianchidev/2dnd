# Fictional devotion

[Documentation index](README.md) | [Gameplay](gameplay.md) |
[Save system](save-system.md)

## The Unfinished Constellation

The pantheon is original fictional worldbuilding. It does not represent
real-world religions, scripture, rituals, or living beliefs.

| Figure | Domains | Tenets |
| --- | --- | --- |
| Orivane, the Unfinished Span | Making, Shelter | Mend before discarding; leave an empty place for another arrival |
| Selquor, the Kept Echo | Testimony, Memory | Keep the unwelcome account; return borrowed echoes |
| Tessune, the Turning Shoal | Passage, Possibility | Share the safe crossing; leave room to turn back |

New and legacy heroes remain **unaffiliated** unless they explicitly choose a
figure. There is no class or alignment restriction. Each figure and an
unaffiliated hero can complete the Twelvefold Covenant with the same canonical
quests, gates, rewards, companions, and ending.

## Finding a temple

Approach an adjacent walkable tile and interact with the marked temple or model
site, or select the contextual **Visit** button with pointer, touch, or the
gamepad cursor. Sites reuse existing statues or temples, except for Tidehaven's new
blueglass model. They do not replace the Founding Volume, First Choice
inscription, or Marsh Ledger.

| Stable site ID | Location |
| --- | --- |
| `willowdaleSpan` | Willowdale Riverside district, statue at `(9,8)` |
| `ironholdSpan` | Ironhold primary district, statue at `(9,8)` |
| `sandportShoal` | Sandport primary district, temple at `(9,1)` |
| `frostheimEcho` | Frostheim primary district, temple at `(9,1)` |
| `dunerestEcho` | Dunerest Oasis Gardens, statue at `(5,6)` |
| `ashfallSpan` | Ashfall primary district, temple at `(9,1)` |
| `shadowfenShoal` | Shadowfen primary district, temple at `(9,1)` |
| `tidehavenShoal` | Tidehaven primary district, model at `(9,6)` |

The first actual visit reveals **Devotion Profile** in the Escape menu.
Browsing lore or using a debug relocation does not count as a visit.

The temple and hero profile show affiliation, domains, tenets, bounded score,
tier and next-tier progress, the active blessing, recent causes, and available
rites. Long content is paginated from measured text rather than clipped.
Keyboard arrows/WASD and Tab, pointer, touch, and the standard gamepad share the
same actions. Focus has a `>` marker; disabled choices explain their reason.
The native accessibility bridge supplies named controls and polite feedback.
Text scale, high contrast, and prompt-source preferences update live. No
animation or extra timer is required for any choice.

## Explicit choices and separate authority

Only one figure can be followed at a time. Choosing, switching, or renouncing
requires a temple confirmation that names the score and blessing consequences.
Cancelling changes nothing. A change never resets visited sites, consumed
devotion sources, completed quests, or claimed rewards, and never changes
alignment or reputation.

Devotion is an integer from **0 to 100**. Named tiers are derived:

| Tier ID | Display name | Minimum |
| --- | --- | --- |
| `listening` | Listening | 0 |
| `attuned` | Attuned | 25 |
| `steadfast` | Steadfast | 50 |
| `resonant` | Resonant | 75 |

An unaffiliated hero has no devotion tier and a score of zero. Source IDs are
consumed even while unaffiliated, so choosing a figure later never replays
historical points.

Keeper choices, optional quests, and selected World Event outcomes declare
explicit causes. For example, selling another speaker's echo glass conflicts
with Selquor's tenets. These devotion deltas and any alignment/reputation
effects are separate transactions in their owning systems. Alignment and town
standing can change greetings but never lock affiliation or rites.

Routine movement, inevitable combat, rereading lore, repeated conversation,
quest replay, and repeated event instances do not farm devotion.

## Optional rites and blessings

Every visitor, including an unaffiliated hero or a follower of a different
figure, can perform the same two rites at each site once per campaign:

- **Set a traveling thread:** connect hovering model pieces. A thread grants
  **+1 AC for three hero turns** in the next battle. The figure changes its
  name, not its mechanics.
- **Leave a resting place:** use one existing short rest for the normal HP/MP
  recovery. It does not refill rest charges or improve the healing amount.

A failed or unavailable rite spends nothing. Threads cannot stack or refresh,
and an active thread blocks another site's thread until it is cleared.
Performing a used rite again cannot grant another blessing or devotion.

`templeWard` is a normal status effect. Its `remainingTurns` is the only
blessing clock: it persists before Battle, expires at hero-turn boundaries, and
is cleared by normal Battle exit, inn rest, and affiliation cleanup. Walking,
animation, and other actors' turns do not decrement it. Loading never
reconstructs a lost or expired thread from the rite ledger.

Ignoring every rite retains the existing combat and rest baseline. There are
no permanent stat, reward, price, or action-economy benefits from affiliation.

## Optional stories

**Mend the Unfinished Span**, **Keep the Unwelcome Echo**, and **Share the
Turning Shoal** are canonical sidequests offered by temple keepers. Their
completion uses the existing objective/reward ledger and never changes main
quest requirements. Each offers the same 90 XP and 40 gold.

The Shoal quest reaches Glasskeeper Ossa in Tidehaven; merchant passage is
available without boat ownership or affiliation. Roadside sky-span and echo
glass events, and the sea-only Turning Shoal Beacon, have explicit choices and
independent consequences.

Codex lore consumes visits, affiliation, quests, and World Event evidence.
Achievements consume visited sites and natural devotion; Threadkeeper is a
cosmetic title. The epilogue reads the hero's current affiliation for an
additional presentation-only page. Neither lore, achievements, discovery, nor
ending text can grant devotion, blessings, quest progress, rewards, or access.

## Implementation contracts

| Responsibility | Module |
| --- | --- |
| Stable pantheon/domain/tenet/temple/rite/blessing/dialogue/source definitions | `src/data/devotion.ts` |
| Focused original quest, event and Codex content | `src/data/devotionQuests.ts`, `devotionEvents.ts`, `devotionCodex.ts` |
| Creation defaults and unknown-input normalization | `src/systems/devotionState.ts` |
| Canonical source mutations, tiers, qualification and ending queries | `src/systems/devotion.ts` |
| Temple location validation, atomic rites, conversation and status cross-fields | `src/systems/devotionTemples.ts` |
| Derived profile, tenet, cause and rite presentation | `src/systems/devotionProfile.ts` |
| Measured Phaser overlay, contextual visit control and native accessibility semantics | `src/managers/devotion.ts`, `devotionAccessibility.ts`, `src/renderers/devotionPrompt.ts` |
| Debug-only inspection, relocation and source consumption | `src/systems/devotionDebug.ts` |

`player.progression.devotion` owns affiliation, score, source and visit ledgers,
debug-consumed sources, a monotonic affiliation-change sequence, and at most 40
recent causes. Names, tiers, thresholds, domains, tenets, and active-blessing
descriptions are derived. The blessing itself remains in `player.activeEffects`;
there is no parallel buff state.

`applyDevotionSource(player, sourceId, { debug? })` accepts only a canonical
source. Debug sources are consumed but award no natural points.
`getDevotionQualification(player, requirement)` and
`meetsDevotionRequirement(player, requirement)` are read-only extension points:

```typescript
interface DevotionRequirement {
  deityId?: DeityId;
  domainId?: DevotionDomainId;
  minimumScore?: number;
  minimumTier?: DevotionTierId;
  requireAffiliation?: boolean;
}
```

An empty requirement permits unaffiliated heroes. Future optional consumers
must declare their own requirement and cannot use Codex, social labels,
achievements, or presentation as a substitute. Prestige classes are not
implemented by this feature.

Schema v19 defaults older or missing state to unaffiliated/zero. Exact known
historical completion/outcome sources may be marked consumed, but scores and
blessings are never guessed or awarded from them. Normalization validates IDs,
duplicates, bounds, source/history links, and blessing source/affiliation/turn
cross-fields while preserving every other progression domain.

## Debug and validation

`/devotion list|status|near <templeId>|source <sourceId>` is debug-only.
Relocation grants no visit or affiliation; source commands grant no points or
blessing. There is deliberately no ledger-reset/farming command.

The devotion, temple, integration, save, and accessibility Vitest suites cover
canonical references, all tier boundaries, source idempotency, domain isolation,
legacy/corrupt documents, optional campaign paths, and the normal status/rest
lifecycle. Browser coverage exercises actual temple/profile choices, reload,
event/dialogue/quest routes, ending presentation, measured layout and semantic
input. Full browser/Electron, typecheck, build and audit gates remain required.

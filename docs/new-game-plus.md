# New Game+ and epic progression

[Documentation index](README.md) | [Save system](save-system.md) |
[Hero progression](hero-progression.md) | [Difficulty](difficulty.md)

## Starting another covenant

New Game+ unlocks only after the **real final Elowen interaction** completes
the Twelvefold Covenant. Defeating the Inferno Forgemaster alone is insufficient.
Choose **New Game+** on the title screen or in title-screen save management.

Select a completed **manual snapshot**, then a different manual destination.
If the completed campaign exists only in Autosave, explicitly save it to a
manual snapshot first. Occupied destinations require confirmation; slots are
never silently evicted. Review the paginated carry/reset policy and choose
**Create & Play**.
Title rows measure the button and wrapped save caption together, so Continue
and NG+ remain inside their actual bounds at enlarged text sizes.

The selected completed manual source remains byte-for-byte unchanged during
inspection, creation, activation, normal play, and reload. **Autosave becomes
the active NG+ run**, using the existing global autosave behavior. The new manual
destination is an independent starting checkpoint, not a campaign-specific
autosave target. Normal manual-slot management still allows explicit human
overwrite/delete/load operations and ordinary corruption recovery; NG+ does
not add a permanent slot lock.

NG+ repeats the original seven chapters, twelve city oaths, three keystone
guardians, and final Elowen interaction. Carried knowledge, boats, titles,
levels, or prestige ranks never substitute for quest completion. Each completed
cycle may create another independent cycle, up to **99**.
Ending recaps keep the full party and cycle label on measured pages. Use
left/right or the shared A/D navigation, pointer/touch page buttons, or the
gamepad cursor, then explicitly confirm **Continue**. Empty space cannot skip
a recap page.

## Carry/reset policy

| Domain | New cycle policy |
| --- | --- |
| Identity and appearance | Carry name, fixed starting class, current appearance and custom cosmetics. Creation boosts, starter gold and starter equipment never replay. |
| Hero progression | Carry base/prestige/epic ranks, total level, cumulative XP, permanent scores, pending ability points, exact frozen receipt, existing rest-ready credits, canonical legacy/deferred grants and debug provenance. Recompute XP-eligible pending levels for the new cap, without creating rest authorization. |
| Hero resources | Restore current HP/MP to the carried maxima, clear all temporary combat effects, replenish two short rests. No resource growth or boon is applied by creation. |
| Companions | Carry unique recruited actors, levels/XP/scores, pending points, owned inventories, equipment, active order, control modes, gambits and cosmetics. Restore HP/MP; clear effects and dialogue cursors. Recruitment quests reset, but replay cannot add a second copy or starter loadout. Carried joining scenes remain seen. |
| Equipment, bags and materials | Carry canonical append order, custom hero item content, exact equipped-object links and materials. Remove only the declared campaign key IDs: Covenant Sigil, Sealed Dispatch, Frost Silk Bundle and Dungeon Key. Permanent tools remain. |
| Currency and bank | Carry gold and bank balance. Reset the bank-day clock with world time; creation grants no interest, refund or payout. |
| Mounts | Carry owned mount items; start on foot. |
| Codex | Carry observed monster/physical/element/drop evidence and unlocked knowledge. Lore remains non-authoritative. Ordinary family completion excludes NG+-only monsters until an eligible cycle. |
| Achievements and titles | Carry earned records, points, cosmetic titles, counters, permanent event IDs, defeat-history validity and debug suppression. Clear pending notices and runtime debug markers; reconcile without a reveal storm. Debug-derived sources cannot earn natural NG+ cosmetics. |
| Recipes and crafting | Carry known recipes, discovery/transaction IDs, statistics, sequence and bounded history. No craft or equipment upgrade replays. |
| Gathering | Carry learned resources, sequence, claimed outcomes, discipline statistics and history. Reset generated-node discovery, node depletion/cooldowns and pending play; use a deterministic new seed. |
| Boats and navigation | Carry owned boats, **current hull condition**, upgrades, cosmetics and active selection. Reset sailing, heading, sea/port/route/island/continent discovery, navigation statistics, pending travel/hazards/encounters and their cycle ledgers. Never repair hull or refund a paid crossing. |
| Tavern/festival games | Carry seed, monotonic sequence, paid/practice bests, statistics, venues, finite milestone claims and bounded history. Clear pending sessions and advance the settlement watermark to the sequence, without refund, payout, reroll or hull restoration. |
| Alignment and reputation | Carry character alignment. Reset town/faction standing, social cause IDs and recent causes for meaningful choices in the new world. |
| Fictional devotion | Carry affiliation, score, consumed/debug source IDs, temple visits, affiliation sequence and history. Temporary blessings clear with combat effects; consumed rites and quest sources cannot award again. |
| Quests and bosses | Reset every quest, objective, warning and per-cycle claim, and all defeated-boss IDs. The main quest starts at its first stage. |
| Unique permanent quest rewards | Preserve the finite lineage-owned reward ledger, including grants later sold, transferred or upgraded. Each new quest ledger marks already-earned unique grants claimed without creating another item. Story keys and ordinary XP/gold remain per-cycle rewards. |
| World discovery and loot | Reset position to Willowdale's safe start, last-town recovery, city discovery/fast-travel destinations, fog, chests, treasure, fixed skill checks and trap state. Retain Adventurer guidance; generate a new deterministic trap layout. |
| Cutscenes and World Events | Reset campaign/boss scenes and all event seeds, counters, cooldowns, outcomes, claims, records and pending choices/battles. Queue the real opening/stage introduction. Canonical final-return and ending triggers still apply. |
| Tutorial and feature menus | Carry tutorial completion and irreversible/debug/suppressed menu discovery. Clear pending reveal feedback; visibility never grants gameplay rewards or access. |
| Save-level data | Carry normalized Codex/appearance; reset playtime, world time and weather, set the creation timestamp, and clear defeated bosses. |
| Preferences | Audio, accessibility, controls, dice and inventory presentation remain in their existing separate documents. Difficulty selection/history and battle-timing configuration carry unchanged; NG+ cannot restore lost difficulty continuity or enable timing. |

Pending activities are retired, not settled. The protected source retains its
exact pending state if the player later explicitly loads that snapshot.

## Levels 21–30

Ordinary campaigns and ordinary post-game stop at total **20**. NG+ derives a
cap of **30** from validated campaign metadata. Base and prestige ownership
still totals at most 20; after that, the hero advances the registered ten-rank
**Epic Roadwarden** track through the existing rest/preview/commit engine.
There is no separate XP, rest-credit, resource or grant processor.

| Rule | Epic behavior |
| --- | --- |
| XP floors | Existing cumulative `level² × 100` curve: 21 = 44,100; 30 = 90,000. Stockpiled XP carries, but newly eligible levels require a fresh rest. |
| HP | One frozen d8 + frozen CON modifier per applied level, minimum 1. |
| MP | Existing shared `max(1, 2 + frozen INT modifier)` growth. |
| Proficiency | Existing total-level formula continues: +7 at 21, +8 at 25, +9 at 29. |
| Ability points | Two once-only points at 22, 26 and 30; scores remain capped at 30. |
| Boons | Resolve at 21: +10 maximum HP; Focus at 25: +5 maximum MP; Edge at 29: +2 damage. Grants are track-scoped and apply once. |
| Companions | Remain single-class; their owning campaign authorizes the same bounded epic growth. Runtime owner binding is restored after load/clone, never serialized as duplicate cycle/cap metadata. |
| Caps and economy | No level 31, extra action, bonus action, starting boost, equipment permission or campaign access. Invalid/stale commits consume nothing. |

Earned prestige ranks do not requalify after resetting world standing. New
entries below total 20 still use the new actor's live world owner. All eligible
spell sources, fixed casting stats, equipment checks and validated battle
execution remain engine-owned.

## Scaling and optional echoes

NG+ supplies one immutable layer to the canonical difficulty resolver. Each
enemy starts from its original definition; rewards scale after canonical group
aggregation and before party distribution. Shops, crafting, inns, routes,
hazards and events use the same existing difficulty owners. Previously committed
amounts and receipts are never rerated.

| Cycle | HP | Damage | Encounter pressure | XP | Gold | Prices |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 2.0 | 1.5 | 1.10 | 1.500 | 1.2500 | 1.1 |
| 2 | 2.5 | 1.7 | 1.15 | 1.625 | 1.3125 | 1.2 |
| 3 | 3.0 | 1.9 | 1.20 | 1.750 | 1.3750 | 1.3 |
| 4 | 3.5 | 2.1 | 1.25 | 1.875 | 1.4375 | 1.4 |
| 5–99 | 4.0 | 2.3 | 1.30 | 2.000 | 1.5000 | 1.5 |

Multiply these by the selected difficulty once. Final limits remain 15% random
encounters, independently 8% World Events, 50% group replacement and 1–4
enemies. Prices round up only when adjusted; rewards/resale round down.
Damage receipts retain real dice and the existing status/scaling/physical/
element/shield ordering. Codex keeps original monster definitions.

Echo Slimes may replace eligible ordinary Slimes in NG+, never a required boss.
Echo Crystals feed a canonical optional Force-blade upgrade. A Road Remembered
adds original lore; the voluntary Covenant Echo trial becomes eligible only
after that cycle's real main-quest completion and uses normal battle/recovery
hooks. NG+ achievements and the Echo Roadwarden title are cosmetic.

## The secret island

**Starfall Atoll** appears only in a validated NG+ campaign, starting at cycle
1. Its dock is in the Covenant Strait at chunk `(4, 2)`, tile `(12, 1)`. Sail
there with a serviceable boat and use the normal **Interact** action to land.
The shallow approach works with a Reed Skiff.

Ordinary campaigns and ordinary completed post-game see only the original
water tile. Fog, lore, achievements, difficulty, debug discovery, or a forged
visited-city ID cannot authorize entry. There is no merchant route or
fast-travel destination for the atoll; initial and repeat visits use its dock.
The normal ninety-chunk terrain definitions are never changed.

The optional island has a fallen-star chart, original Codex lore, a small
community, fishing/foraging approaches, and **The Remembered Lantern**, which
uses the normal paid inn/rest and progression owners. It contains no campaign
keystone or required objective and grants no entry bonus, hull repair, or
duplicate carried reward. Its exit returns to the same dock in the owned boat.

Eligible saves preserve the interior, owned boat, and discovered island.
Ordinary/legacy saves with a forged island location recover to Willowdale and
drop inaccessible island/city/fog discovery. An imported interior without a
serviceable boat also recovers safely, without repairing the hull or restoring
resources. Another NG+ cycle resets island/world discovery while preserving
boat ownership, exact hull condition, and earned lore under the existing policy.

## Persistence and transactions

Schema **27** adds nullable `player.newGamePlus`: bounded cycle/parent, stable
cycle/request ID, source fingerprint, creation timestamp, policy version,
finite lifetime reward IDs and debug provenance. Campaigns through v26 gain
`null`, without epic ranks or invented history. Missing/malformed modern
authority rejects the candidate for isolated slot recovery rather than
silently removing NG+ scaling. Base/prestige/epic ownership and resource/rest
cross-fields remain validated by the existing progression normalizer.

`inspectCampaignSlot()` snapshots primary/staging/backup/name bytes and decodes
through the canonical unknown normalizer on a fresh detached parse. It uses the
adapter's existing candidate order, but never restores, migrates, names, deletes
or activates playtime. Source and destination tokens are rechecked at commit.
`copyCompletedSnapshot()` is the explicit Autosave protection step;
`prepareNewGamePlus()` and `createNewGamePlusSlot()` own independent creation.

Writes use the existing verified staging/backup adapter. A failed write leaves
the source unchanged. Repeating a matching creation request returns the existing
child rather than rewinding an already-played run. Activation must successfully
autosave before leaving title; a failed activation leaves the created manual
checkpoint available for retry.
If only the optional slot name cannot be written, the preview keeps the
warning visible. Confirm again to play the already-created child; its creation
receipt prevents another reset or reward.

Seeds and fingerprints are deterministic gameplay identities, not security
credentials. No parent slot reference, runtime callback, deadline, Phaser
object, derived multiplier or duplicate companion cap is serialized.

# Optional prestige paths

[Hero progression](hero-progression.md) | [Gameplay](gameplay.md) |
[Save system](save-system.md)

Prestige is optional hero progression, not a new starting class. At **applied
total level 6**, `E`, then `Tab`, opens a sheet with six original traditions.
Inspect the full rank table, current entry values, missing requirements, gear
rules and the ordinary progression you delay. Rest authorizes earned XP; each
confirmed rank spends exactly one rested level. All base and prestige ranks
share **total cap 20**, one MP pool, proficiency, ASIs and action economy.

Each path has five ranks. Rank 4 deliberately adds normal growth only. Starting
boosts, identity, appearance, equipment and gold are never granted again.
Companions remain single-class. Multiple independently qualified paths can
coexist within the same cap; there is no respec.

## Joining requirements

Every row additionally requires applied total 6 or more, a rested earned level,
a legal next rank and next total at most 20. Scores are permanent allocated
ability scores, not equipment or temporary effects. Alternatives are explicit
**or**; other requirements are **and**.

| Stable path ID | Class and score requirements | World and social alternatives |
| --- | --- | --- |
| `roadglassBulwark` | Knight, Barbarian or Paladin rank 4; STR 13 and CON 13 | Complete Ironbound Dispatch, or Heartlands Wardens reputation at least 15 |
| `prismScribe` | Wizard, Sorcerer or Warlock rank 4; INT 13 | Complete Stone and Root, or Winter Witnesses reputation at least 15 |
| `hearthlightCustodian` | Cleric or Paladin rank 4; WIS 13; Good/Evil at least 0 | Complete Mystic recruitment, or Twelvefold Covenant faction reputation at least 15 |
| `rootwakeKeeper` | Druid, Ranger or Barbarian rank 4; WIS 13 | Discover Deeproot, or Rootspeakers reputation at least 15 |
| `duskthreadCourier` | Rogue, Ranger or Monk rank 4; DEX 13; Law/Chaos at most 24 | Complete Silk Against the Cold, or discover Shadowfen |
| `chordsteelEnvoy` | Two distinct martial/caster classes at rank 2; CHA 13 and the martial score 13 | Complete Stone and Root, or Roadwardens reputation at least 15 |

Chordsteel's martial classes are Knight, Ranger, Rogue, Paladin, Barbarian and
Monk; its caster classes are Wizard, Sorcerer, Warlock, Cleric, Druid, Bard,
Paladin and Ranger. One Paladin or Ranger cannot fill both roles. The martial
score is STR for Knight/Paladin/Barbarian and DEX for Ranger/Rogue/Monk. Ordinary
starting-class multiclass requirements still apply on new entry.

Stone and Root must be **completed**, not merely the current stage. Discovered
cities use mechanics-owned discovery, not the current location or Codex flag.
Preview and fresh confirmation evaluate the same live owner context.
Missing, malformed or stale-owner evidence cannot authorize a level.

These are **joining-only** conditions. Once rank 1 is earned, later score or
social changes do not remove it, its actions or its resource bonuses.
Advancement still requires valid rest credits and rank/total limits. There is
no suspension mechanic. All six launch paths work without affiliation; devotion
and difficulty systems are not dependencies.

## Complete feature tables

`Action` uses the normal main action; `Bonus` uses the same single bonus action
shared with other abilities and items. Damage, saves, criticals, statuses,
formation and affinities use the existing combat rules. Spells use each path's
fixed casting score; Steel Cadence explicitly uses CHA.

Every rank adds one normal HP/MP growth step. Roadglass uses d10, Prism d6, and
the other paths d8, plus the existing Constitution modifier/minimum. Shared MP
grows by `max(1, 2 + Intelligence modifier)` once. Rest freezes the resource
roll and CON/INT scores; changing path, cancelling or reloading cannot reroll.
Rank-2 HP/MP talents apply once, not on every rank or load.

### Roadglass Bulwark — martial

Iron-road shield keepers catch glancing blows between roadglass layers.
The path delays base attack/defense talents; its brace needs a shield and a
bonus action. It grants no general attack or AC talent.

| Rank | Feature | Effect |
| --- | --- | --- |
| 1 | Roadglass Brace | Bonus, 4 MP, self: Sneak Stance (+2 AC, 2 turns); shield required |
| 2 | Wayline Study | +1 trap detection |
| 3 | Wayline Strike | Action, 6 MP, 2d8 physical, STR, one enemy; melee weapon |
| 4 | Consolidation | Normal growth only |
| 5 | Roadglass Crash | Action, 9 MP, 3d8 Thunder, STR, one enemy; melee weapon |

### Prism Scribe — arcane

Keystone scholars stitch broken refractions into narrow spells. INT is required
even for Sorcerer/Warlock entrants. The path delays stronger base spells and
offers limited front-row coverage rather than a universally stronger arsenal.

| Rank | Feature | Effect |
| --- | --- | --- |
| 1 | Prism Needle | Action, 5 MP, 2d6 Force, INT, one enemy; normal attack roll |
| 2 | Reserve Lattice | +3 maximum MP once |
| 3 | Prism Fan | Action, 7 MP, 3d6 Lightning, INT, enemy front row |
| 4 | Consolidation | Normal growth only |
| 5 | Prism Veil | Action, 8 MP, self: Haste (+2 accuracy/+2 AC, 3 turns); no extra action |

### Hearthlight Custodian — divine

Shelter guardians preserve warmth without demanding worship. The path delays
base divine features; it cannot revive, cure or heal for free.

| Rank | Feature | Effect |
| --- | --- | --- |
| 1 | Hearth Mend | Action, 4 MP, 2d6 healing, WIS, one conscious ally |
| 2 | Warmth Keeper | +5 maximum HP once |
| 3 | Hearth Lantern | Action, 6 MP, 2d6 Radiant, WIS, all enemies |
| 4 | Consolidation | Normal growth only |
| 5 | Common Hearth | Action, 9 MP, 3d6 healing, WIS, conscious party |

### Rootwake Keeper — primal

Deeproot listeners follow living routes and return borrowed vitality. The path
delays primal/martial base progression; poison can be resisted and its thunder
spell affects only the front row.

| Rank | Feature | Effect |
| --- | --- | --- |
| 1 | Rootwake Lash | Action, 5 MP, 2d6 Poison, WIS, ranged; Slow on hit with normal save/lifecycle |
| 2 | Rootline Sense | +1 trap detection and +1 trap disarm |
| 3 | Sap Return | Action, 5 MP, 2d6 healing, WIS, one conscious ally |
| 4 | Consolidation | Normal growth only |
| 5 | Rootwake Rumble | Action, 9 MP, 4d6 Thunder, WIS, enemy front row |

### Duskthread Courier — stealth

Marsh couriers protect messages with feints and folded shade. The path delays
base precision/defense talents; fear retains its normal saves.

| Rank | Feature | Effect |
| --- | --- | --- |
| 1 | Duskthread Feint | Action, 5 MP, 1d6 Psychic, DEX, ranged; Frightened on hit; light one-handed weapon or bow |
| 2 | Threadwise Hands | +2 trap disarm |
| 3 | Folded Shade | Bonus, 4 MP, self: Sneak Stance (+2 AC, 2 turns); light one-handed weapon |
| 4 | Consolidation | Normal growth only |
| 5 | Threadcut | Action, 9 MP, 4d6 physical, DEX, ranged; light one-handed weapon or bow |

### Chordsteel Envoy — hybrid

Road envoys bind spoken rhythm to weapon discipline. The path delays both
base progressions, needs two distinct classes and adds no action slots.

| Rank | Feature | Effect |
| --- | --- | --- |
| 1 | Chordsteel Note | Action, 5 MP, 2d6 Thunder, CHA, one enemy |
| 2 | Tempered Measure | +2 maximum HP and +2 maximum MP once |
| 3 | Measured Refrain | Action, 6 MP, self: Inspired (+1 accuracy/+2 damage, 3 turns) |
| 4 | Consolidation | Normal growth only |
| 5 | Steel Cadence | Action, 9 MP, 3d8 physical, CHA, one enemy; melee weapon |

## Gear, discovery and saves

Paths grant no new weapon, armor or shield permission. Existing ownership,
shield/two-handed/off-hand and custom item rules stay intact. Missing or changed
gear makes a restricted action unavailable before MP or action slots are spent;
it never deletes the path or the item. Stale plans recheck gear on execution.
Identical status IDs refresh normally instead of stacking duplicate AC bonuses.

The character sheet, Tips, original Codex lore, Ending and slot summaries
derive from the same progression state. Natural first entry and rank-5 mastery
grant cosmetic achievements; Pathkeeper is a title only. Cosmetic/discovery
flags never authorize entry or affect combat, quests, rewards or endings.

Schema v20 recognizes only registered `prestige:<pathId>` ranks and preserves
rest-ready/frozen/legacy/deferred authority. Schema-v19 and older campaigns gain
no prestige ranks or path-only knowledge. Debug-marked paths cannot grant natural
prestige points/titles, including after later normal ranks. Invalid authoritative
path ownership falls through existing isolated slot recovery.

Read-only inspection uses `/prestige list|status|explain <pathId>|preview
<pathId>`. Debug advancement uses `/class level prestige:<pathId>` in safe
exploration through the same bounded transaction and records debug provenance.
There is no debug respec, cap override or legacy-bonus replay.

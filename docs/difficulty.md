# Campaign difficulty and Custom rules

[Documentation index](README.md) | [Gameplay](gameplay.md) |
[Save system](save-system.md)

Choose **Campaign Rules** on the appearance screen before starting an adventure.
Standard is the default and preserves the original mechanics exactly. Story,
Veteran, Legendary, and bounded Custom profiles use the same combat, exploration,
reward, recovery, and campaign systems.

Settings and the character sheet open a complete effect preview. Keyboard,
pointer, touch, and standard gamepad controls share that interface. Up/Down moves
focus; Left/Right changes the focused profile or Custom value. Pointer/touch users
can use the left and right halves of a value. Effects are paged so all supported
text scales, high contrast, and reduced motion remain usable.

## Preset effects

Percentages are relative to the original values unless the row describes a
penalty or recovery.

| Rule | Story | Standard | Veteran | Legendary |
| --- | --- | --- | --- | --- |
| Enemy HP | 75% | 100% | 120% | 140% |
| Enemy damage | 75% | 100% | 115% | 130% |
| Enemy attack accuracy | -2 | 0 | +1 | +2 |
| Enemy tactics | Gentle | Original | Tactical | Relentless |
| Random encounter pressure | 70% | 100% | 110% | 120% |
| Flee DC adjustment | -2 | 0 | +1 | +2 |
| Non-combat check assistance | +2 | 0 | 0 | 0 |
| Carried-gold loss on defeat | 0% | 30% | 35% | 40% |
| Knockout XP loss | None | Current-level progress | Current-level progress | Current-level progress |
| Defeat HP/MP recovery | 100% | 50% | 50% | 50% |
| Prices, fees, and resale | 90% | 100% | 110% | 120% |
| XP and gold rewards | 120% | 100% | 110% | 120% |
| Optional timer suggestion | 60 seconds | No adjustment | 30 seconds | 15 seconds |

Enemy damage covers attacks, damaging abilities, and incoming combat-turn status
ticks. Hero/companion outgoing actions and enemy status ticks retain their original
rules. Accuracy does not change initiative, derived saving-throw stats, or Armor
Class. Natural attack 1/20 behavior, status lifetimes, elemental ordering,
formation, MP, inventories, and action economy are unchanged.

Gentle foes choose healthier conscious targets. Tactical foes prefer the lowest
HP percentage; relentless foes prefer the lowest absolute HP. Their ability and
defense chances are bounded, and non-Standard tactics avoid full-health healing.
Existing healer-support formations remain authoritative.

Random land/sea encounter chance clamps **after** environment, profile, and scale
composition at 15%. World Events keep their independent 8% cap and are not made
more frequent by difficulty. Boss fleeing remains prohibited. Quest gates,
required interactions, social outcomes, crafting success, gathering patterns,
and the real final Elowen interaction never depend on a profile.

## Custom bounds

Custom starts from Standard, not from a secretly modified preset. Neutral values
are omitted from its saved overrides.

| Rule | Allowed values |
| --- | --- |
| Enemy HP | 50-200%, in 5-point steps |
| Enemy damage | 50-175%, in 5-point steps |
| Enemy accuracy / flee DC | -3 to +3, integer |
| Encounter pressure | 50-150%, in 5-point steps; final 15% chance cap |
| Non-combat assistance | 0-4, integer |
| Defeat carried-gold loss | 0-50%, in 5-point steps |
| Defeat HP/MP recovery | 50-100%, in 10-point steps |
| Prices / XP rewards / gold rewards | 75-150%, in 5-point steps |
| Knockout XP loss | Current-level progress or none |
| Enemy tactics | Gentle, original, tactical, or relentless |
| Optional timer suggestion | No adjustment, 15, 30, 45, 60, or 90 seconds |

Fixed skill-check results remain fixed even when later rules differ. Assistance
is included in the stored modifier rather than rerolling or recomputing a saved
outcome. Non-combat hazards remain nonlethal.

## Mid-campaign policy

Every preset and bounded Custom setting may change during **safe exploration
only**. The effect preview is a draft: choosing or editing values does not alter
the campaign. Review Change shows the exact changes and the permanent
preset-challenge consequence, then Confirm Change performs one autosave
transaction.

Battle, queued cutscenes, scene handoffs, movement, active dialogue, and pending
World Event, gathering, merchant-route, sea-hazard, or sea-encounter outcomes
block the transaction. Finish the authoritative outcome first. Existing checks,
resources, rewards, recruitment, quests, social state, and recovery receipts are
not replayed or rerated.

A failed autosave restores the exact prior live selection/history and reports
the storage error. Applying an unchanged canonical selection is a no-op: it
does not increment history or change eligibility. Actual profile or Custom edits
append one canonical from/to/movement-step cause, preserve the initial profile,
and irreversibly remove future preset-challenge continuity. General and prior
earned achievements remain available. The preview includes the bounded history;
manual snapshots retain their original bytes and rules.

## Economy and recovery

Exactly neutral prices keep the original floor rounding, including social
discounts/surcharges. Adjusted purchase, crafting, inn, route, boat, and repair
costs round up. Rewards and resale round down. This preserves the canonical
strict buy/craft/sell margin at every allowed Custom price; gold-reward bonuses
never increase resale prices.

Group rewards are aggregated and given their existing 0.85 group adjustment
before difficulty scaling. Reward hooks receive that adjusted result, and party
XP is not scaled again. Quest/event/trap/treasure rewards retain their existing
stable claimed IDs. Items, materials, drops, alignment, reputation, and quantities
are not duplicated or multiplied.

Only conscious actors receive victory XP. Story or a Custom no-loss rule does
not grant victory XP to a KO actor. Full defeat applies one exact receipt, clears
effects, restores the configured fraction, recovers to the existing town state,
and autosaves before the result scene. Reload never reapplies a penalty. Pending
merchant routes preserve the actual `feePaid` receipt instead of rerating it.

## Eligibility and independent preferences

General and previously earned achievements remain available on every profile.
Veteran Covenant requires an unchanged Veteran or Legendary campaign; Legendary
Covenant requires unchanged Legendary. Custom never claims preset challenge
credit, even if its values equal a preset.

Any recorded selection change or repaired continuity removes future preset
challenge credit. Lifetime `changeCount` survives the bounded cause history;
Custom/preset round trips and history truncation cannot restore continuity.
Debug mutations suppress new preset campaign challenges through the existing
achievement debug-exclusion state, without revoking prior achievements.

Text scale, high contrast, reduced motion, audio, input/prompt preferences, and
dice presentation do not enter difficulty classification or campaign metadata.
A timer suggestion never enables timing or supplies a countdown. Its optional
consumer may apply a supported duration only after timed rounds were explicitly
enabled.

## Ownership and extension APIs

- Immutable definitions and bounds: `src/data/difficulty.ts`.
- Normalization and continuity: `src/systems/difficultyState.ts`.
- Composition, scaling, previews, and eligibility: `src/systems/difficulty.ts`.
- Pure editor and measured focus: `difficultyEditor.ts` and `layout.ts`.
- Phaser/accessibility presentation: `src/managers/difficulty.ts`.
- Enemy targeting/ability policy: `src/systems/enemyTactics.ts`.

`resolveDifficultyRules(selection, scale?)` composes the profile and one optional
`DifficultyScaleLayer`. HP, damage, pressure, XP, gold, and price layer multipliers
must be finite from 0.25 to 4. Consumers apply the resulting rules once through
`scaleEnemy`, `scaleEnemyDamage`, `scaleReward`, `scaleCost`, `scaleSaleValue`,
and `getDifficultyEncounterRate`.

Runtime combatants keep both a scaled HP copy and their immutable base definition.
Codex persistence stores canonical base stats, not adjusted enemy HP. Save slots
derive their profile label, continuity count, and current eligibility.

These APIs are extension points for future New Game+ work. They do not implement
cycles, carry/reset policy, epic progression, or timed-round execution.

## Persistence and coverage

Schema 19 adds `player.difficulty`: canonical selection, bounded Custom overrides,
initial profile ID, lifetime change count, and the latest 20 canonical causes.
Legacy schema 18 and older normalize to Standard. Malformed modern selections,
bounds, or continuity recover conservatively; unrelated campaign state and claimed
rewards remain intact.

`difficultyBaseline.test.ts` contains a matrix captured from main `183954b`
before the feature: all 58 enemies/abilities, group/solo rewards, natural
attack outcomes, exact odd-value defeat/companion recovery, economy, flee,
encounters, and checks. It is not regenerated to accommodate altered mechanics.
Focused mode suites exercise all seven chapters/twelve cities, keystone bosses,
companions/gambits, events, social bounds, crafting margins, gathering, sea,
defeat, migration, independent slots, and honest eligibility.

`e2e/difficulty.spec.ts` covers actual preset/Custom creation, keyboard, touch,
gamepad, supported text scales, preference independence, save metadata/reload,
and real Story/Legendary final interaction with post-game continuation.

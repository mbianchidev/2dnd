# Physical damage and aimed strikes

[Gameplay](gameplay.md) | [Architecture](architecture.md) |
[Save system](save-system.md)

2D&D takes inspiration from Vagrant Story's blunt/edged/piercing weapons and
location-specific defenses, adapted to the existing d20 and turn-based combat.
It does not add Risk, attack chains, limb HP, severing, or permanent injuries.
All parts share the monster's existing HP, rewards, formation and initiative.

## Weapons and defenses

| Physical type | Sources |
| --- | --- |
| Bludgeoning | Unarmed attacks, staves, maces, Warhammer, shield and unarmed abilities |
| Slashing | Longswords, greatswords, axes and weapon-derived slashing strikes |
| Piercing | Daggers, rapiers, short swords, bows, arrows and Thorn Whip |

Starting equipment already covers the three types. Willowdale's Blade & Bow
and legacy general-store inventory also offer a Warhammer and Hunting Bow,
each costing 30 gold with +2 weapon damage. Inventory, equipment descriptions,
shops, search and item Codex records display the weapon's physical type.

Skeletons are vulnerable to bludgeoning and resist piercing; stone constructs
are vulnerable to bludgeoning and resist slashing/piercing. Scaled creatures
resist slashing, soft oozes resist bludgeoning and are vulnerable to slashing,
and woody creatures favor slashing over piercing. Individual monster metadata,
not family art or IDs in the resolver, owns these profiles.

Damage follows the existing roll/status modifiers, then physical immunity,
weakness or resistance, then the independent elemental profile, then the HP
write. Immunity gives zero, weakness doubles, and resistance halves with a
floor. Magical spells and elemental-only abilities stay outside physical
resistance; an enchanted weapon retains its physical and elemental stages.
No extra damage dice, attack rolls or random status rolls are invented.

## Armor defenses

Body armor keeps its existing AC bonus and additionally halves matching
physical damage, rounding down. Resistance depends on the equipped armor,
not the class or appearance. Heroes and companions use the same live resolver.

| Armor | Resists |
| --- | --- |
| Leather Armor | Bludgeoning |
| Chain Mail | Slashing |
| Plate Armor | Slashing, Piercing |
| Frost Ward Mail | Bludgeoning, Slashing |
| Shadow Cloak | Piercing |
| Tundra Pelt | Bludgeoning |
| Swamp Mantle | Slashing |

Padded hides soften impacts, fitted mail counters cuts, and rigid plate also
stops piercing strikes. No listed armor resists all three types. Shields retain
their original AC and Defend rules rather than receiving a second body-armor
profile. Defense descriptions appear in equipment, inventory, shops, search
and known item Codex records; known monsters show their basic attack type.

Basic monster attacks declare their physical source. Bites and arrows pierce,
blades and claws slash, and fists, slams and tail sweeps bludgeon. Physical
special abilities can override that type; a Burning Cleave or Molten Slam can
declare both a physical component and an element. Pure breath, psychic,
elemental and healing abilities remain outside physical armor resistance.

Incoming damage uses the actual rolled pool plus status/synergy modifiers,
then armor resistance, then the owning HP write. Shield Defend applies its
existing one-point reduction to final damage using pre-hit HP, so overkill
cannot accidentally revive a defeated actor. Critical pools, natural 1/20,
AC, MP, inventory, status clocks and damage/healing RNG stay unchanged.
Armor adjustments and actual HP loss remain separate in exact receipts;
normal enemy displays still redact bonuses and intermediate arithmetic.
Explicitly physical dungeon traps use the same armor protection: spikes/darts
pierce and rocks/falls bludgeon. Apply it before their existing 1-HP nonlethal
cap. Magical trap damage, MP loss, statuses and the once-only trap lifecycle
retain their original rules; numeric legacy rollers never gain invented dice.

## Aiming

Select Attack or a physical damaging ability, then choose an enemy.
**Confirm still attacks the whole target**, preserving the existing flow.
**Aim parts**, or Up/Down on the keyboard/D-pad/touch controls, opens the
optional part picker. Left/Right continues to select enemies. The picker
supports arrows/WASD, native keyboard focus, pointer, touch and the gamepad
cursor. Confirm activates on release; Cancel first returns to enemy selection
without spending resources, and a second Cancel leaves targeting.
The part picker sits left of the enemies so its reticle remains visible.

Manual companions have a separate **Aim parts** row beside each eligible
target. Gambits continue to choose whole targets through the same validator.
Normal off-hand follow-ups use their own weapon type and the selected part if
the original target survives; a replacement target receives a whole attack.

Humanoid anatomy can be aimed at regardless of size, including skeletal and
fey humanoid forms. Other anatomical creatures require D&D size Large, Huge
or Gargantuan. Small beasts, oozes and incorporeal creatures without stable
anatomy remain whole targets. Boss status alone does not grant fake limbs.

| Part | Attack modifier | Local weakness | Temporary effect |
| --- | --- | --- | --- |
| Head / individual Hydra heads | -3 | Piercing | Confused |
| Body / trunk / mantle | 0 | Inherits whole target | None |
| Arms / claws / branches | -2 | Slashing | Weakened (-2 damage) |
| Legs / roots | -2 | Bludgeoning | Slowed |
| Wings | -2 | Slashing | Prone |
| Tail / tentacles | -2 | Slashing | Weakened |
| Elemental / tree core | -3 | Piercing | Confused |
| Armored shell | 0 | Bludgeoning; resists slashing/piercing | None |

Local affinities replace a matching whole-body weakness/resistance rather than
stacking it twice. Neutral local types inherit the whole-body profile.
Whole-body immunity cannot be bypassed by choosing a part.

Effects require a successful hit with positive final damage. They last up to
two target turns through the existing status lifecycle; effects with saves can
end sooner. They never disable boss abilities permanently or add another action.
Natural 1/20 and disadvantage still use the selected d20, before modifiers.
Formation protection, weather, defend and synergy protection still apply.

## Discovery and persistence

The picker shows public aim penalties and possible effects, but keeps defenses
unknown until that physical type has been observed at that exact scope.
Discovering a head's piercing weakness does not reveal whole-body piercing
resistance or another monster's anatomy knowledge.

Schema v23 adds `CodexEntry.discoveredPhysical` with stable damage-type and
optional part IDs. Duplicate, unknown, neutral and impossible observations are
removed during normalization. Pre-v22 saves gain an empty observation list
without invented combat history. Shipped schema-v22 activity campaigns missing
physical observations gain empty lists, while valid v22 physical-combat previews
retain their records. Both retain exact minigame challenges, pending/settled
authority, resource receipts and custom equipment when migrating to v23.
The Codex's Info pages keep long defenses and
part lists readable; Page Up/Down or the visible Info controls change pages.
First records still require a defeat; a known record can retain new observations
after fleeing. The existing scouting Tip explains physical and elemental types.

Canonical weapons declare optional `physicalDamageType`. Old item copies keep
their exact serialized metadata and equipment links; resolution falls back to
the canonical item or, for a custom weapon, its procedural weapon shape.
Part selection and enemy limb effects are runtime-only. Battle cleanup clears
the picker, reticle, listeners, native controls and normal status effects.
The picker uses shared deferred overlay reflow so source, preference and resize
updates cannot replace a held pointer target or reach a disposed panel.

Schema v24 adds optional armor-only `physicalResistances` with unique supported
types. Old canonical armor copies resolve their protection at use time without
rewriting metadata or equipment links. Well-formed custom lists and explicit
empty lists retain their authority; malformed unknown ownership rejects imports
before writing, and malformed known gear uses the standard repair path.
Existing physical discoveries, exact activities and progression/rest resources
remain unchanged. Armor resistance is not another status or duration clock.

## Ownership and coverage

Physical types and shared affinity precedence live in `data/damageTypes.ts`;
shared monster contracts in `data/monsterTypes.ts`; anatomy, public size and
anchors in `data/anatomy.ts`; item compatibility in
`data/itemCombat.ts`; aimed-hit mechanics and safe previews in
`systems/physicalCombat.ts`. The existing `combat.ts` and `battleActions.ts`
own rolls, validation, HP, resources and action economy.
`managers/battleBodyTarget.ts` is the shared measured hero/companion picker.
Codex normalization/discovery remains in `systems/codex.ts`.

`physicalCombat.test.ts` covers affinities, anatomy, selected naturals,
off-hand typing, status duration, shared HP, duplicate monsters and invalid/
stale plans. `physicalCombatSave.test.ts` covers observations, corruption,
schema-v21 migration and exact custom equipment. `physical-combat.spec.ts`
exercises real aiming, cancellation, save/reload, boss parts, manual companions,
multiple input sources and 100%/125%/150% text.
`armorCombat.test.ts` and `armorSave.test.ts` cover the complete armor/type
matrix, live hero/companion equipment, physical ability overrides, magic bypass,
exact critical/status/HP/RNG ordering, redaction, v23 recovery, custom equipment
links and rejected-import isolation.

Design references: [Vagrant Story weapon types](https://vagrantstory.fandom.com/wiki/Type)
and the [published combat-mechanics guide](https://gamefaqs.gamespot.com/ps/914326-vagrant-story/faqs/56772).
The rules, content and implementation above are original 2D&D adaptations.

# Companions and Gambits

## Party model

The persistent party lives at `player.party` in save schema v6:

- `companions`: unique recruited `CompanionState` records
- `activeCompanionIds`: up to three recruited IDs in battle/follower order

The hero remains the owner of gold, bank balance, world position, mounts, and
world progression. Each companion owns independent XP, level, HP/MP, stats,
spells, abilities, talents, inventory, equipment, active effects, dialogue
cursor, control mode, and gambits.

The three stable companion IDs are:

| ID | Role | Class |
| --- | --- | --- |
| `guardian` | Defensive frontline | Paladin |
| `scout` | Mobile ranged damage | Ranger |
| `mystic` | Healing and party support | Cleric |

New recruits match the hero's current level using deterministic historical HP
and MP growth. Later XP and level-ups are independent.

## Recruitment

Recruitment uses the canonical quest system:

- `recruitGuardian`
- `recruitScout`
- `recruitMystic`

Each quest has stable `meet*`, `*Trial`, and `*Oath` stage IDs and emits one
completion action:

```text
companion.recruit.guardian
companion.recruit.scout
companion.recruit.mystic
```

`replayQuestCompletionActions(..., "recruitCompanion")` runs after load,
Overworld initialization, NPC quest changes, and debug quest mutations.
`recruitCompanion()` is idempotent, so reloads, rewinds, and repeated debug
completion cannot duplicate a companion or starter inventory.

## Party management

Press `P` during exploration to open the party overlay.

The overlay supports:

- active/reserve membership and active order
- manual or gambit combat control
- member stats, HP/MP/XP, and equipment
- independent inventories and item transfer
- targeted consumables and healing outside combat
- pending companion stat allocation
- ranked gambit editing

Key items, mounts, and equipped items cannot be transferred. Gold remains with
the hero; shop purchases and battle drops enter the hero bag and can then be
transferred.

## Gambit rules

Each companion can store up to 12 enabled or disabled rules. Rank 1 has highest
priority.

The structured rule format is:

```text
if [subject] has/is [condition] do [action] on [target]
```

Supported subjects include self, hero, any party member, a specific companion,
and any enemy. Conditions cover HP/MP values or percentages, statuses,
alive/KO state, and ability-score comparisons. Actions cover attack, defend,
known spells, known abilities, and owned items. Targets include the matched
subject, named party members, lowest/highest HP allies or enemies, and
automatic area targets.

At the start of a gambit-controlled turn:

1. Status start-of-turn processing resolves.
2. Rules are evaluated by ascending rank against a fresh battle snapshot.
3. Invalid targets, missing items, insufficient MP, consumed action slots, and
   inapplicable heals/buffs fall through without mutation.
4. A valid bonus action may execute first.
5. Lower-ranked rules continue until one main action executes.
6. If no rule executes, the companion attacks; if no enemy is valid, it
   defends.

Manual companion turns and gambits both use `validateBattleAction()` and
`executeValidatedBattleAction()`.

## Battle, KO, and rewards

Every conscious party member rolls initiative. Monsters select only living
party actors. Battle ends in defeat only when the whole active party is KO.

Living members receive victory XP. A member knocked out during the battle
receives no victory XP and loses progress earned toward the next level, down to
the current-level XP floor. A partially victorious KO member remains at 0 HP
until an inn.

On a full wipe:

- every active member receives the KO XP penalty
- the existing 30% hero-gold penalty applies once
- the party returns to the last town
- active members recover half HP/MP

Inn rest revives and fully restores every recruited companion and processes
their pending level-ups.

## Followers and world integration

Active conscious companions follow the hero using prior valid hero tiles. They
do not block movement or independently trigger traps, encounters, gates, or
world interactions. Pointer interaction talks directly to a follower; Space
uses companion dialogue only after higher-priority world interactions.

Dungeon movement preserves `DungeonTrapManager` ordering:

```text
trap move/arrival handling -> exploration event -> random encounter
```

Companions travel inside the existing `player` scene payload, so Battle, Shop,
Codex, fast travel, alarm encounters, and scene restarts preserve one party
state without a parallel transition field.

## Debug commands

```text
/companion list
/companion recruit <guardian|scout|mystic|all>
/companion mode <id> <manual|gambit>
/companion heal
/companion gambits <id>
```

The debug MP hotkey is `O`; `P` is reserved for party management.

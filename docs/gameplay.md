# Gameplay guide

[Documentation index](README.md) | [Getting started](getting-started.md)

## The adventure

2D&D is a browser JRPG built around exploration, party growth, turn-based
combat, and a complete campaign. Create a hero from 12 classes, travel through
the 90-chunk world, recruit up to three active companions, restore three
keystones, and return to Elowen to complete the Twelvefold Covenant.

The campaign includes seven chapters, 12 mainland cities, connected districts,
three campaign dungeons, story and boss cutscenes, optional objectives, an
epilogue, credits, Chronicle replay, and post-game continuation. Tidehaven and
the Deepwake Kraken form an optional island and sea-navigation arc.

## Core controls

Feature-specific shortcuts become available only after the corresponding
system has been discovered. The Escape menu remains the reliable entry point.

| Keyboard | Action |
| --- | --- |
| `WASD` / arrows | Move, navigate menus, cycle valid Battle targets |
| `Space` / `Enter` | Confirm, interact, or disarm a detected adjacent trap |
| `Esc` | Cancel, close the active overlay, or skip an active cutscene |
| `F1` | Open Tips |
| `M` | Open the map |
| `E` | Open equipment |
| `Q` | Open the quest journal after discovery |
| `P` | Open party management after recruiting a companion |
| `C` | Open the Codex after discovery |
| `Y` | Open Achievements after the first natural unlock |
| `K` | Open Gathering after discovering a discipline |
| `V` | Open Crafting after learning a non-starting recipe |
| `T` | Mount or dismount after acquiring a mount |

Pointer and touch users can select visible buttons directly. Touch layouts use
safe-area-aware movement and action controls. Standard gamepads use the left
stick or D-pad for movement/navigation, `A` to confirm, `B` to cancel, `X` to
interact, Menu/`Y` for the menu, View for Tips, bumpers for targets/pages, and
triggers for Battle-log scrolling. The right stick moves a visible cursor;
press the stick to click pointer-first controls.

Mappings are stable rather than user-remappable. Settings can control touch
visibility, handedness, and automatic or fixed prompt sources.

## Character creation and progression

Character creation follows:

**Name -> Class -> Stats -> Appearance -> Adventure**

- Choose Knight, Ranger, Wizard, Sorcerer, Rogue, Paladin, Warlock, Cleric,
  Druid, Barbarian, Monk, or Bard.
- Spend 27 points on base scores from 8 to 15, or use 4d6-drop-lowest random
  generation.
- Class boosts apply after base stats.
- Level progression reaches 20 with class actions, spells, talents, equipment,
  hit-point growth, proficiency increases, and ability-score improvements.

## Party, inventory, and gambits

Guardian, Scout, and Mystic join through their own quests. Recruited companions
have independent levels, stats, HP/MP, equipment, inventories, abilities,
spells, status effects, and control settings. Up to three active companions
follow the hero without blocking movement or triggering world interactions.

Party members can be controlled manually or by up to 12 ranked gambit rules.
Gambits evaluate a fresh turn snapshot, skip invalid rules without spending
resources, and can use one bonus action plus one main action.

See [Companions and gambits](companions.md) and
[Inventory presentation](inventory.md).

## Combat

Battles use d20 attacks, Dexterity initiative, natural 1/20 attack outcomes,
critical hits, Armor Class, defending, fleeing, spells, abilities, items, and
boss actions. Encounters contain one to four independent enemies with stable
initiative identities and front/back formations.

Nine elements are supported: Fire, Ice, Lightning, Poison, Necrotic, Radiant,
Thunder, Force, and Psychic. Immunities prevent damage, weaknesses double it,
and resistances halve it. Observed interactions become Codex knowledge.

Combat statuses include Poisoned, Burning, Frozen, Paralyzed, Stunned,
Frightened, Slowed, Prone, Asleep, Confused, Enraged, Hasted, Inspired, Raging,
and Sneak Stance. Effects resolve on actor turn boundaries and are cleared when
Battle ends.

A full party wipe applies one recovery result, autosaves it, reports exact gold
and XP losses, clears Battle effects, and returns the party to the last town at
half HP/MP.

## Exploration

The world contains 90 legacy-compatible chunks, 13 cities including optional
Tidehaven, and four multi-level dungeons including Tideglass Grotto. Exploration
includes:

- connected city districts, shops, inns, banks, stables, and fast travel
- day/night lighting, six weather types, biome encounters, and fog of war
- hidden paths, treasure, dialogue, negotiation, and non-combat d20 checks
- seeded dungeon traps with persistent detected, missed, disarmed, or triggered
  outcomes
- data-driven World Events with choices, skill checks, rewards, special
  battles, cooldowns, and reload recovery
- alignment, town/faction reputation, optional reactions, and bounded shop
  modifiers
- monster and world-lore Codex entries, achievements, cosmetic titles, and the
  Chronicle

## Gathering, crafting, and sailing

Fishing, mining, and foraging use deterministic location-based nodes and
discipline-specific minigames. The selected pattern and reward are saved before
play, so reloading cannot reroll the outcome. Rare guarded finds use the normal
Battle flow.

Crafting consumes canonical materials in atomic transactions. Recipes cover
healing, cures, travel supplies, trap tools, equipment upgrades, and elemental
gear. Upgrades preserve exact equipment ownership links.

Merchant routes work before boat ownership. Later, the Tideglass Charter grants
a Reed Skiff for free sailing, hazards, sea encounters, open-water fishing,
boat upgrades, island discovery, Tideglass Grotto, and the optional Kraken.

## Tutorial, discovery, and accessibility

New campaigns open a five-step tutorial after the opening cutscene queue.
Completing or skipping it prevents automatic replay; it can still be replayed
from Tips.

Menus, shortcuts, tabs, prompts, touch actions, and advanced Tips reveal from
authoritative gameplay evidence. Safety-critical surfaces such as Inventory,
Map, Equipment, Tips, Settings, save, and title controls remain available.

Accessibility and presentation settings include:

- 100%, 125%, and 150% text
- high contrast and non-color-only state cues
- reduced motion with immediate completion semantics
- master, music, SFX, dialog, and mute controls
- manual or automatic cutscene advance
- touch visibility, handedness, and prompt-source controls

Settings are stored separately from campaign progress. See
[Getting started](getting-started.md#local-save-data) for storage details.

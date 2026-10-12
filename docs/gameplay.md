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
| `Esc` | Open the in-game menu, cancel/close an overlay, or skip a cutscene |
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
| `Z` | Skip resolved-dice animation without changing the result |

Pointer and touch users can select visible buttons directly. Touch layouts use
safe-area-aware movement and action controls. Standard gamepads use the left
stick or `↑ ↓ ← →` for movement/navigation, `◉↓` to confirm, `◉→` to
cancel, `◉←` to interact, Menu/`◉↑` for the menu, View for Tips, bumpers for targets/pages, and
triggers for Battle-log scrolling. The right stick moves a visible cursor;
press the stick to click pointer-first controls and the desktop fullscreen
button. Xbox positions are A/B/X/Y; prompts use positions so they do not guess
PlayStation or Nintendo labels.

During hero creation, `◉←` or unmodified `Tab` edits the name. Names, manual
slot labels and searches share a controller keyboard: arrows select, `◉↓`
types, `◉←` deletes, Menu submits and `◉→` cancels. `Aa` switches letter case.
Keyboard/touch text input remains available; cancel never commits a draft.

Mappings are stable rather than user-remappable. Settings can control touch
visibility, handedness, and automatic or fixed prompt sources.
Native desktop builds hide mobile touch rails and their mobile-only settings.
Use WASD for movement; focused text fields use normal physical keyboard typing.
Circle-arrow icons show controller face-button position, not compass headings.

The in-game menu includes **Save Game** for three named manual slots and
**Save & Return to Title** for the dedicated autosave. The title screen exposes
**Load / Manage Saves** for loading, renaming, copying, deleting, exporting, and
importing campaigns. Overwrite and deletion require confirmation. Desktop
builds also show **Quit Desktop** on the title screen, with `Q` as a
title-screen shortcut. Browser builds rely on the browser tab/window controls
instead.

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

At applied level 6, the character sheet also previews six optional
[prestige paths](prestige.md). Each has five ranks with explicit class, score
and world joining conditions. A rank spends one rested level within the same
total cap of 20. Preview the table and the normal-class features you delay;
later social changes never remove earned ranks. No affiliation or prestige
path is required to finish the campaign.
- At rest, keep advancing the starting class or select a qualified additional
  class. Preview exact frozen gains before each one-level commit. The total
  remains capped at 20, companions remain single-class, and there is no respec.
- `E`, then `Tab`, opens the progression sheet, including pending stat
  allocation and recovery of interrupted rest choices.

See [Hero progression](hero-progression.md) for prerequisites and source-aware
spell, feature, resource and save rules.

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
Frightened, Slowed, Prone, Asleep, Confused, Weakened, Enraged, Hasted, Inspired, Raging,
and Sneak Stance. Effects resolve on actor turn boundaries and are cleared when
Battle ends.

Weapons also deal Bludgeoning, Slashing or Piercing damage. Match observed
monster defenses, or choose **Aim parts** (Up/Down while selecting a physical
target) for harder-to-hit local weaknesses and temporary effects. Eligible
humanoids and Large+ anatomical monsters share one HP pool across all parts.
Normal Confirm still attacks the whole target. Canceling aim spends nothing.
See [Physical combat](physical-combat.md) for controls, weapon access, anatomy
and defense rules. Long Codex records use the Info buttons or Page Up/Down.
Body armor also has type-specific resistances independent of AC: leather and
thick pelts soften bludgeoning, mail resists slashing, and plate counters
slashing and piercing. Matching physical damage is halved with a floor.
Heroes and companions share the rule; pure magical abilities and healing bypass
it. Equipment and inventory descriptions show the exact protection.

Resolved rolls appear directly over the game scene, with both advantage/disadvantage
faces and the selected die identified. Enemy bonuses and undiscovered AC/DC
remain hidden. Damage and healing show their actual die types/faces, signed
modifiers, resolved amounts, and effective HP changes. Resistance, immunity,
defending, overkill, nonlethal limits, and maximum-HP caps stay distinct from
the original roll. Area effects show one shared pool with separate target
results. Magic Missile shows damage dice but no attack die; fixed items and
derived life-drain healing remain aggregate text without invented faces.
Use Z, L3, or the visible skip button. Details join the normal Battle log,
which resets when the battle ends; there is no separate roll log.
With animation enabled, dice travel and tumble across the game with bouncing
shadows, then settle on those exact faces. They never intercept controls or
hold a turn; skip, Instant and reduced motion retain static readable results.
Roll displays start enabled. Settings can turn ordinary displays Off; natural20
attack crits and natural1 fumbles always appear. Instant/reduced motion still
keep mandatory critical feedback static, and Off retains detail in the current
Battle log. Outside combat, results remain for three seconds after settling
and then fade; changing scenes or entering another event clears them.
See [Dice presentation](dice-presentation.md).

A full party wipe applies one recovery result, autosaves it, reports exact gold
and XP losses, clears Battle effects, and returns the party to the last town at
half HP/MP.

Standard battles remain unlimited. **Esc menu > Settings > Battle Timing**
opts only the current campaign into 15/30/45/60/90-second hero and manual
companion decisions. Bonus actions keep the remaining budget; timeout validates
Defend or ends an already-spent main-action turn. Action presentation, blocking
overlays/log reading, transitions, backgrounding, and controller recovery pause
time. Esc/B or Pause reads the log; Enter/A or Resume continues without acting.
See [Timed battle decisions](battle-timing.md) for reload and control details.

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

## Optional tavern and festival games

Marked city venues offer **Crown & Bones**, a capped in-game-only push-your-luck
dice game; **Archery Challenge**, five class-neutral precision targets; and
**Harbor Regatta**, an owned-boat buoy course with a fixed forecast and bounded
hull wear. None is required for a quest, route, campaign ending, or post-game.

Stand on a D/A/R venue marker and interact. After discovery, the Esc menu opens
instructions and personal boards. Setup selects difficulty, capped stakes, or
free archery/regatta practice. Reduced-motion archery uses explicit aiming with
the same targets and scores. Leaving first opens a pause/abandon confirmation;
abandoning forfeits the entry but never repeats charges or undoes committed wear.

See [Tavern and festival activities](minigames.md) for all venues, controls,
transparent dice odds, capped payouts, records, and reload recovery.

## Optional fictional devotion

The original **Unfinished Constellation** consists of Orivane (Making and
Shelter), Selquor (Testimony and Memory), and Tessune (Passage and Possibility).
New and legacy heroes remain unaffiliated unless they explicitly choose a
figure at a temple. All affiliations and an unaffiliated hero can complete the
same canonical campaign.

Start at the model statue in Willowdale's Riverside district. The first visit
reveals **Devotion Profile** in the Escape menu. Temples show domains, tenets,
independent devotion and cause history, optional keeper quests, and available
rites. A traveling thread grants the same +1 AC for three hero turns to every
visitor; a resting-place rite uses one normal short rest. Each rite and cause
is once per site/source, never a farming loop. See [Fictional devotion](devotion.md)
for sites, explicit-choice consequences, and lifecycle details.

## Tutorial, discovery, and accessibility

New campaigns open a five-step tutorial after the opening cutscene queue.
Completing or skipping it prevents automatic replay; it can still be replayed
from Tips.

Menus, shortcuts, tabs, prompts, touch actions, and advanced Tips reveal from
authoritative gameplay evidence. Safety-critical surfaces such as Inventory,
Map, Equipment, Tips, Settings, save, and title controls remain available.
On touch devices, the MENU and TIPS buttons appear only during exploration,
when those overlays can safely open.

Accessibility and presentation settings include:

- 100%, 125%, and 150% text
- high contrast and non-color-only state cues
- reduced motion with immediate completion semantics
- master, music, SFX, dialog, and mute controls
- manual or automatic cutscene advance
- touch visibility, handedness, and prompt-source controls
- All/Important/Off dice visibility/frequency and Normal/Fast/Instant speed;
  canonical attack crits/fumbles always show, even with Off

Within Settings, `[` cycles dice frequency and `]` cycles speed. Reduced motion
keeps immediate static feedback; Off hides ordinary notices but retains critical
feedback and the consultable redacted log.

Audio, accessibility, and control preferences are stored separately from campaign
progress; Battle Timing is per-campaign configuration. See
[Getting started](getting-started.md#local-save-data) for storage details.

Larger text and longer labels wrap or page in character creation, equipment,
stat profiles, achievements and save slots. Use the visible page buttons;
equipment also supports Page Up/Down and achievement lists support Left/Right.
Changing window size or text preferences preserves current cosmetic choices,
rolled/allocated scores and selected records rather than rerolling them.

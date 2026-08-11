---
name: game-development
description: Develop 2D&D features with Phaser 4, strict TypeScript, and D&D-inspired mechanics
license: MIT
---

# 2D&D Game Development

Use this skill for cross-cutting game features, new content, combat behavior,
and changes spanning scenes, systems, data, renderers, or managers.

## Core rules

1. Use strict TypeScript with explicit parameter and return types.
2. Keep content data-driven in `src/data/`; keep reusable logic in
   `src/systems/`.
3. Generate reusable textures in `src/renderers/textures.ts`; scene-sized
   procedural Battle scenery belongs in `battleBackdrop.ts`. Synthesize audio
   in `src/systems/audio.ts`; do not add external assets.
4. Preserve shared scene state across transitions.
5. Use `debugLog()` and debug-panel APIs instead of `console.log`.
6. Add deterministic Vitest coverage for game logic.

## Current architecture

- Phaser 4 scenes: `Boot`, `Overworld`, `Battle`, `Shop`, `Codex`, `Cutscene`,
  `Ending`, and `Defeat`
- Overworld orchestration: `src/scenes/Overworld.ts`
- Battle orchestration: `src/scenes/Battle.ts`
- Core mechanics: `src/systems/`
- Immutable definitions: `src/data/`
- Extracted presentation: `src/renderers/`
- Battle environment composition: `src/renderers/battleBackdrop.ts`
- Shared Battle depth contract: `src/renderers/battleDepth.ts`
- Stateful scene helpers: `src/managers/`
- Shared audio/accessibility preferences: `src/systems/accessibility.ts`
- Typed semantic actions and state: `src/systems/input.ts`
- Keyboard/pointer/gamepad/touch adapter: `src/managers/input.ts`

The versioned `2dnd_preferences` document is separate from campaign saves and
backs both title and in-game settings. Install the scene accessibility adapter
in every scene, use its shared reduced-motion accessors, preserve
100%/125%/150% text usability, and pair important color states with a textual or
symbolic cue. Control presentation preferences cover touch visibility,
handedness, and prompt source without changing campaign saves. Stable mappings
are intentionally not remappable.

All release input routes through the semantic action layer. Standard gamepads
use dead zones, digital fallback, repeat/debounce, source switching, and a
visible right-stick cursor clicked by pressing the stick. Responsive touch controls use safe areas, pointer
capture for held directions, click pulses for discrete actions, and mobile text
entry. Clear held state on blur, visibility loss, disconnect, scene changes,
and shutdown.

Cutscene contracts live in `src/data/cutsceneTypes.ts`, focused campaign and
boss definitions live in `cutsceneCampaign.ts` and `cutsceneBosses.ts`, and
`src/data/cutscenes.ts` is the stable-ID hub. Pure trigger snapshots, priority
ordering, queue lifecycle, recovery, Chronicle selection, and summary logic live
in `src/systems/cutscenes.ts`; `src/managers/cutscene.ts` owns step progression;
scenes and renderers own input and presentation.
`EndingScene` and `DefeatScene` share `src/renderers/result.ts`; defeat receives
an exact runtime-only `PartyDefeatResult`, while the recovered player state is
autosaved before presentation.

The map hub is `src/data/map.ts`; terrain/types, chunks, cities, and dungeons
are split into dedicated modules. Dungeon trap definitions live in
`src/data/traps.ts`, mechanics in `src/systems/traps.ts`, and scene orchestration
in `src/managers/dungeonTraps.ts`.
Group templates live in `src/data/monsterGroups.ts`; reusable initiative,
formation, synergy, reward, and per-combatant rules live in
`src/systems/groupCombat.ts`.
That module also owns party-ready `BattleCombatantState`, stable actor IDs,
actor-ID initiative, ally/enemy targeting, monster party-target selection, and
battle resolution hooks.
`src/systems/battleActions.ts` is the Phaser-free action planner for player
input and ranked gambits: actor enumeration, target binding, validation,
immutable plans, per-actor action/bonus consumption, and one-action dispatch.
`executeValidatedBattleAction()` binds a generic `CombatActorState` to a party
combatant and reuses existing attack, spell, ability, item, defend, element,
status, MP, and inventory mechanics.
Consumables consume the acting source's inventory while applying HP/MP/cures
to a selected ally source; execution contexts must include all party action
sources. Equipment actions remain self-targeted.

`src/systems/animation.ts` is the Phaser-free presentation contract for actor
states, deterministic timing, stable-ID target mapping, once-only lifecycle,
and explicit family/frame texture metadata. `src/managers/actorAnimation.ts`
owns reusable Phaser poses and cleanup; battle/world directors consume resolved
state without changing mechanics. `src/renderers/actorTextures.ts` supports
optional family frames from #49 and a generic existing-texture fallback.

Tutorial and Tips content lives in `src/data/tutorial.ts` as immutable steps,
semantic control actions, categories, and unlock requirements.
`src/systems/tutorial.ts` owns completion normalization and progression-aware
filtering. `src/managers/tutorial.ts` owns the Overworld overlay and renders prompts for
the active keyboard, pointer, gamepad, or touch source. New saves persist
`player.progression.tutorial.completed`; replay never resets it.

Progressive feature discovery is data-driven through
`src/data/featureDiscovery.ts` and `src/systems/featureDiscovery.ts`. Filter
menus, tabs, shortcuts, prompts, touch actions, and Codex/crafting/gathering
categories through the shared registry. Preserve always-safe Inventory, Map,
Equipment, Tips, Settings, and save/title controls, and never use discovery as
authority for gameplay state.

World Event content lives in `src/data/worldEvents.ts`, its deterministic
Phaser-free state machine in `src/systems/worldEvents.ts`, and accessible choice
presentation in `src/managers/worldEvents.ts`. Events short-circuit treasure,
exploration checks, and random encounters for their movement step, while
transitions, entrances, traps, interactions, and queued cutscenes retain
priority. Special event combats use normal Battle hooks and saves.

## Quests

- Put quest definitions, stage objectives, NPC IDs, rewards, and gated
  entrances in `src/data/quests.ts`.
- Put progression, normalization, idempotent rewards, NPC interaction
  resolution, journal entries, and entrance checks behind
  `src/systems/quests.ts`; `questState.ts` and `questDebug.ts` contain focused
  normalization and debug-only mutation helpers.
- Persist state only through `player.progression.quests`; use quest-system APIs
  instead of direct mutation.
- The shipped campaign is the seven-chapter Twelvefold Covenant across all 12
  cities and three keystones, with Ironbound Dispatch, Silk Against the Cold,
  and optional Hydra and Dragon objectives.
- Persist objective counters and claimed reward IDs. Batch group defeats with
  duplicate monster IDs intact so three matching combatants count as three.
- Downstream unlocks such as companions should call `isQuestCompleted()` and
  keep their own persistent state separate from quest reward bookkeeping.
- Cross-system outcomes use stable quest completion actions with
  `{ id, type, targetId }`. Replay them after load/mutations and make the
  consumer idempotent rather than adding duplicate quest state.
- Give every stage a stable camelCase `id`; downstream systems use
  `getQuestStageIndex()` or the debug-only `setQuestStageById()`, never display
  titles.
- Derive boss objectives from `defeatedBosses` so older saves can report
  already-completed objectives.
- Keep quest NPCs available at night and test every referenced NPC, boss,
  reward item, and entrance.
- Campaign completion remains derived from the main quest. Launch the epilogue
  after the final Elowen dialogue applies rewards, recover completed-but-unseen
  saves from Overworld creation, and keep replay presentation-only.
- Queue stable cutscene IDs and save before presentation. Completion or skip
  moves an ID from `pendingCutsceneIds` to `seenCutsceneIds`; reload resumes the
  first pending entry, while Chronicle replay changes neither collection.
- Detect newly satisfied cutscenes by comparing immutable before/after snapshots.
  Battle must capture its snapshot before recording the defeated boss. Sort
  simultaneous triggers by explicit numeric priority rather than discovery
  order.
- Map main-quest talk objectives through `QUEST_NPCS` and assert exact coverage
  of all 12 live city IDs; do not accept name-only references.
- Canyonwatch, Ashfall, and the Volcanic Forge are hard gates. Sandport and
  Heartlands Crypt remain open; other premature travel uses one-time soft
  danger warnings and capped encounter modifiers.

## Non-combat skill checks

Non-combat checks are split across:

- `src/data/skillChecks.ts`: NPC challenges, negotiation choices, and terrain
  event definitions
- `src/systems/skillChecks.ts`: pure d20 resolution, normalization, and helpers
- `src/managers/skillChecks.ts`: Overworld rewards, hazards, chest checks, and
  dialogue orchestration

## Adding monsters

1. Define the monster in the appropriate focused pool (`monsters.ts`,
   `nightMonsters.ts`, or `monsterVariants.ts`).
2. Use a camelCase ID and set a valid typed `family`, stats, rewards, drops,
   abilities, and `isBoss`.
3. For a palette/stat variant, set `variantOf` to a valid same-family monster,
   use a distinct color and ability set, and assign a positive
   `encounterWeight`.
4. Add an `affinity` and `elementalProfile` when the monster has a dominant
   element, resistances, weaknesses, or
   immunities.
5. Add `element` and `statusEffect` to monster abilities when applicable.
6. Ensure the definition is included in `ALL_MONSTERS`; debug spawning, Codex
   browsing, and ID lookup depend on the master list.
7. Reuse `getMonsterTextureKey()` and the family silhouette renderer rather than
   adding scene-local textures or tints.
8. Add encounter-pool, family, palette, texture-key, and data-integrity tests.

Use `getMonster(id)` for exact ID lookup and `findMonster(query)` for
case-insensitive ID/name lookup with partial matching.

## Adding monster groups

1. Add a 2-4 member template to `MONSTER_GROUP_TEMPLATES`.
2. Reference valid monster IDs and assign every member to `front` or `back`.
3. Keep `minPlayerLevel` high enough that total difficulty does not exceed
   `playerLevel * 3`.
4. Add biome/dungeon tags, encounter weight, and an optional synergy with a
   valid break threshold.
5. Add deterministic generation and data-integrity coverage.

Random groups start at level 2, cap at 50% of triggered encounters, and never
replace bosses or explicit debug monster spawns.

Codex family completion is derived from the current `CodexData.entries`; family
metadata, affinity, and sort/filter presentation are not save fields.

World knowledge definitions live in `src/data/codexKnowledge.ts`. Persist only
stable unlocked knowledge IDs in `CodexData`; derive category counts, source
hints, search results, sorting, and grouping from canonical entries. Emit
idempotent location, quest, cutscene, item, NPC, readable, or `worldEvent`
signals without letting Codex state control gameplay. `reputationMilestone`
is owned by the schema-v12 reputation system and must remain idempotent.

## World Events

- Filter immutable definitions by terrain, area, time, weather, level, quest
  state, boss state, prior outcomes, repeat limits, and cooldowns.
- Keep event chance independently capped at 8%; never feed it into or multiply
  the 15% random-encounter calculation.
- Persist the selected pending event before presenting choices or starting a
  special battle. Reload resumes the same choice or encounter.
- Apply skill outcomes through `rollSkillCheck()`, quest starts through
  `startQuestById()`, rewards through canonical item/XP helpers, and lore through
  `unlockCodexFromFutureSignal()`.
- Resolve stable outcome/reward IDs once, append at most 40 chronological
  records, and expose those records through Chronicle without revealing future
  choices.
- Alignment/reputation hooks are consumed by the centralized social mutation
  API with stable source IDs. World Event state never persists duplicate social
  scores or applied IDs.

## Alignment and reputation

- Keep canonical axes, faction IDs, reputation tiers, and thresholds in
  `src/data/reputation.ts`; reusable mechanics belong in
  `src/systems/reputation.ts`.
- New players begin exactly Chaotic Neutral (`lawChaos: -50`, `goodEvil: 0`).
- Persist only bounded scores, stable applied source IDs, and the bounded
  recent-cause history. Derive names, tiers, pricing, milestones, and ending
  variants.
- Apply social outcomes only for meaningful choices. Never reward routine
  movement, unavoidable combat, or farming.
- Return runtime-only `SocialAchievementHook` values for the achievement
  consumer; do not persist achievements inside the social system.

## Achievements

- Put immutable definitions and cosmetic titles in `src/data/achievements.ts`;
  put normalization, deterministic progress, reconciliation, stable event
  counters, debug exclusion, and title equip rules in
  `src/systems/achievements.ts`.
- Prefer reconciliation from authoritative quest, boss, Codex, exploration,
  trap, skill-check, event, social, party, and inventory state. Add persisted
  counters only for non-reconstructable event history such as battle wins,
  one-hit defeats, and explicit defeat count.
- Achievement state never controls gameplay authority. Titles are
  presentation-only and notices are queued for safe Overworld presentation.

## Adding spells, abilities, and equipment

- Damage sources may declare an `Element` from `src/data/elements.ts`.
- Player abilities may apply `selfEffect` or `targetEffect` IDs defined by
  `src/systems/statusEffects.ts`.
- Monster abilities use `statusEffect` for effects applied to the player.
- Cure consumables declare matching cure data and must be wired through
  `useItem()` without consuming the item when no matching ailment exists.
- Ally-target consumables declare `targetType`; resolve it through
  `getItemTargetType()` so older inventory copies use canonical item metadata.
- Preserve action economy: normal actions end the player turn; bonus-action
  abilities and the first item use do not.

Combat calculation order is:

1. Roll and resolve the attack or save.
2. Apply active-status accuracy, disadvantage, AC, and damage modifiers.
3. Apply elemental immunity, weakness, or resistance to the modified damage.
4. Apply damage and status effects.
5. Report discoveries and combat feedback.

Magic Missile remains auto-hit and does not roll disadvantage.

## Status effects

All definitions and lifecycle helpers live in
`src/systems/statusEffects.ts`. Do not duplicate status logic in data files or
scenes.

- Start of actor turn: tick damage, saving throws, and skip-turn decision.
- End of actor turn: decrement durations and expire effects.
- Apply or refresh through `applyStatusEffect()`.
- Normalize loaded effects through `normalizeActiveEffects()`.
- Clear player and monster effects when leaving Battle; durations are measured
  in combat turns, not overworld steps.

## Elements

Supported elements are Fire, Ice, Lightning, Poison, Necrotic, Radiant,
Thunder, Force, and Psychic.

- Immunity: zero damage
- Weakness: double damage
- Resistance: floor of half damage
- Neutral: unchanged

Record observed non-neutral interactions with `discoverElement()` so the Codex
can persist and display them.

## World features

- Cities may contain connected districts. Always use city chunk helpers rather
  than indexing `city.chunks` directly.
- Dungeons may contain multiple levels. Always use dungeon level and
  connection helpers.
- Dungeon trap layouts are derived from persisted `trapSeed`; never mutate
  dungeon maps or randomize layouts independently in scenes.
- Detected traps block movement until disarmed. Trap triggers must short-circuit
  the normal random-encounter check for that step.
- Use `FogOfWar.exploredKey()` for exploration keys.
- Use `isWalkable()` and `ENCOUNTER_RATES`; do not hardcode terrain behavior.
- Nautical metadata lives in `src/data/nautical.ts`; state normalization,
  ownership, and mechanics live in the focused `nauticalState.ts`,
  `nauticalOwnership.ts`, and `nautical.ts` modules. Preserve all 90 legacy
  chunk IDs and use `s:zoneId,chunkX,chunkY,x,y` for sea fog.
- Merchant routes work before boat ownership. Free sailing requires a
  serviceable active boat, uses canonical Water eligibility, and runs hazards
  before World Events, gathering, and random sea encounters.

## Non-combat skill checks

- Checks use d20 + Dexterity, Intelligence, Wisdom, or Charisma modifier plus
  typed bonuses against a DC.
- Natural 1 and 20 are not automatic outcomes for ability checks.
- Persist fixed NPC, shop, chest, and treasure results in
  `player.progression.skillChecks`.
- Use stable NPC identities and shop type/coordinate keys rather than array
  indexes.
- Shop negotiation is one attempt per shop; successful discounts restore from
  the saved result.
- Exploration hazard damage is nonlethal and must clamp the player to at least
  1 HP.
- Test roll math, invalid inputs, stable data references, save normalization,
  reward bounds, and nonlethal damage deterministically.

## Scene changes

State-bearing transitions commonly pass:

```typescript
{
  player,
  defeatedBosses,
  codex,
  timeStep,
  weatherState,
  savedSpecialNpcs,
}
```

Battle also receives a `MonsterEncounter` and biome; Shop receives shop/city
context.
Defeat receives the full shared state plus encounter name/type and the exact
applied party defeat receipt. It must not recalculate or reapply penalties.
Future party systems pass accessor-backed `partyCombatants` plus runtime-only
`battleHooks`; do not persist those wrapper objects.
Keep target `init()` contracts and every caller synchronized.

The new-player tutorial opens only after pending opening cutscenes have drained.
`F1` and the Esc menu open the consultable Tips surface. Keep the external HTML
control rail collapsed by default and retain only contextual action prompts in
the game HUD.

Route camera fades and scene handoffs through
`src/managers/sceneTransition.ts`. Call `prepare()` when each scene creates,
wait for fade-complete events, and keep the duration-plus-grace watchdog as a
recovery path only. Restore the outgoing camera before queueing the next scene,
reject duplicate handoffs, and block state-changing Overworld input until the
queued start/restart is processed. Every Overworld restart must include a fresh
`savedSpecialNpcs` snapshot in the shared state payload.
Use the same guarded Battle exit cleanup for victory, flee, and defeat. Defeat
clears transient menus, input, effects, particles, and weather timers before
starting `DefeatScene`, which continues only to Overworld.
- Resolve an action before presenting it. Actor animation may read stable IDs,
  targets, hit/damage/healing, and outcome, but must not spend MP/items/actions,
  apply damage, report results, or control fade-complete scene handoffs.

## Companions and gambits

- Persistent party state lives at `player.party`; do not add a parallel scene
  payload or companion combat model.
- Stable companion IDs are `guardian`, `scout`, and `mystic`.
- Build runtime actors with `createPartyCombatant()` and
  `createBattleActionSource()`.
- Manual turns and ranked gambits both validate/execute through
  `battleActions.ts`; one bonus action may precede or follow one main action.
- Recruitment consumes replayable quest completion actions idempotently.
- Debug quest or companion recruitment must refresh live follower presentation
  immediately after replay.
- Active conscious companions may render as non-blocking followers, but only
  hero movement invokes trap, encounter, gate, and world-interaction logic.
- Keep party UI/followers/battle presentation in focused managers/renderers
  rather than growing the existing oversized scene/overlay files.

## Inventory presentation

- Build immutable views with `src/systems/inventory.ts`; every view entry keeps
  its original inventory index for actions and transfers.
- Never sort the owning inventory array or replace equipment object references.
- Keep sort/filter/search preferences in `2dnd_inventory_prefs`, outside the
  campaign save schema. Recent acquisition is reverse append order.
- Use semantic inventory actions for keyboard, pointer, gamepad, and touch
  controls. `T` remains mount control.
- Generate item visuals procedurally through `src/renderers/itemVisuals.ts`.

## Gathering

Gathering content lives in `src/data/gathering.ts`, deterministic node/table/
minigame logic in `src/systems/gathering.ts`, schema normalization in
`gatheringState.ts`, and accessible Phaser presentation in
`src/managers/gathering.ts`. Persist selected outcomes before play, use safe
location-derived nodes, route guarded finds through normal Battle hooks, and
keep material identity limited to stable `Item.material` recipe-input metadata.

## Crafting

Crafting recipes live in `src/data/crafting.ts`, atomic mechanics and discovery
in `src/systems/crafting.ts`, persistence normalization in `craftingState.ts`,
and accessible Overworld presentation in `src/managers/crafting.ts`. Validate
the selected actor inventory, protected/equipped restrictions, batch, gold,
station, output, and transaction ID before mutation. Equipment upgrades replace
exact equipped object links with canonical outputs. Never pull companion
materials implicitly, reroll a craft, duplicate material identity, or let
recipes/achievements control quests, Codex, access, or rewards.

## Validation

```bash
npm run typecheck
npm test
npm run test:browser
npm run build
```

For UI changes, run the committed Playwright flow in headless Chromium. Keep
browser actions synchronized through debug-state transitions, and hold
frame-polled Phaser keys across frames rather than using instantaneous presses.

## Common pitfalls

- Do not mutate shared monster, item, map, city, or dungeon definitions.
- Do not share HP, status, defend, discovery, or drop state between group
  combatants, including duplicate monsters.
- Do not introduce index-based turn entries or duplicate hero HP/effect state;
  use stable combatant IDs and `createHeroCombatant()`.
- Do not reimplement MP, inventory, target, formation, or action-economy checks
  in companion AI; use `validateBattleAction()`.
- Do not use stale Phaser 3 APIs or default imports; current code uses
  `import * as Phaser from "phaser"`.
- Do not create a second status or elemental calculation path.
- Do not omit unique dungeon pools or bosses from aggregate lookups.
- Do not use geometry masks for the Battle log; render the bounded visible
  message window.
- Do not add a persistent field without save normalization and tests.
- Do not reroll a failed trap detection; persist the `missed` state.

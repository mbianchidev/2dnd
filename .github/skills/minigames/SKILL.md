---
name: minigames
description: Implement and validate 2D&D tavern dice, neutral archery, harbor regatta, atomic recovery, and accessible records
license: MIT
---

# Tavern and festival minigames

Read [`AGENTS.md`](../../../AGENTS.md),
[`docs/minigames.md`](../../../docs/minigames.md), and the save, world/map,
scene-management, weather, and testing skills before changing these contracts.

## Ownership

- `src/data/minigames.ts`: stable activities/venues/rulesets/difficulties,
  score/reward/record/milestone IDs, instructions, caps, and progression
- `src/data/minigameEvents.ts`, `codexMinigames.ts`: optional source-owned
  invitation and lore content
- `src/systems/minigames.ts`, `minigameRules.ts`, `minigameResults.ts`,
  `minigameRegatta.ts`: validated entry/input, exact dice/precision/course
  mechanics, scoring, wear, and settlement
- `minigameTypes.ts`, `minigameState.ts`: persisted authority and unknown
  normalization with location/owned-boat cross-field recovery
- `minigameTransactions.ts`: save-before-reveal rollback across wallet,
  progression, Codex, discovery availability, and reconciled consumers
- `minigamePresentation.ts`, `minigameLayout.ts`: truthful view models,
  runtime-only meter preview, duplicate suppression, measured geometry/pages
- `src/managers/minigames.ts`: scene-owned accessible input/records/recovery
- `src/renderers/minigame*.ts`: procedural panels, boards, and fog-aware flags

## Mechanics and balance

Ship all three activities; never replace them with a partial generic framework.

Crown & Bones uses two exact d6s. Seven is Bones (6/36), doubles are Crown
(6/36), and other non-seven pairs are safe (24/36). Bank pays
`floor(stake * safeThrows / 2)`, including the stake, with four-throw auto-bank,
5/10/20g stake caps, and zero Crown medal currency bonuses. Crowns add score,
not payout. Prove optimal expected return against all 36 ordered outcomes at
every reachable stopping state; include floors, doubles, bank/continue, and
first-claim eligibility. Do not substitute only the four-success path.

Archery borrows the same bow for every class and accepts five fixed precision
positions. Only target distance and difficulty affect scoring. The moving
meter is a runtime input preview; accepted positions, not animation frames,
save atomically. Reduced motion uses explicit aiming with identical targets,
formula, thresholds, and payouts.

Regatta reuses shared nautical cardinal destinations, Water/depth/boat checks,
canonical upgrades, and injected seeded `rollWeather()` selection. Persist
course, forecast, and the starting boat snapshot. Never move campaign
position/sailing/fog, trigger encounters, mutate maps, or change world weather.
Require an active owned boat at 20+ condition, cap paid wear at 4/8/12, and
leave at least one condition. Practice causes no wear.

Paid 80+ skill runs can return at most their 5/10/20g fee plus a first-only
activity/difficulty bonus (archery 8/16/24g, regatta 10/20/30g). Venue switching
does not reset a claim. Legitimate practice has separate bests and can teach
difficulty, but grants no currency, reputation, paid statistics, or achievements.

## Recovery and authority

Schema v19 `player.progression.minigames` stores seed, permanent
session/settlement watermarks, one exact pending session or settled receipt,
finite known milestone claims, discovered venues, paid/practice bests, natural
statistics, and at most 40 recent receipts.

History is never a payment ledger. Use stable gameplay `runId` plus expected revision
for every accepted action. Commit entry, wear, input, settlement, and abandonment
before presenting success. A failed write restores all touched domains.
Run references use `mg:<seed>:<sequence>`, never security/authentication tokens.
Normalize pre-review v19 `sessionId` aliases without changing IDs or challenges;
reject conflicting aliases conservatively.
Invalid pending repair cannot refund, recharge, reroll, replay a reward, or
restore wear. Old campaigns gain deterministic empty defaults without historic
rewards; manual snapshots remain isolated from later autosaves.

Only first paid medals emit bounded canonical town/faction reputation. Never
shift alignment for routine wins/losses. Codex and cosmetic achievements
consume paid natural evidence and never control quests, gates, combat, or ending.
Persist debug marks through recovery; debug play grants no resources, wear,
natural bests/counters, milestone claims, social credit, or lore.

## Presentation and controls

- Lease and restore the scene-owned `semanticInputContext` override.
- Use shared semantic keyboard/pointer/touch/gamepad routing, not new adapters.
- Confirm on release; preserve stable intent across held/delayed input.
- Debounce with monotonic input time, never a stalled render-frame clock.
  Keep animation time separate from accepted controls and authoritative score.
- Defer source/viewport relayout until post-input; never destroy pressed targets
  while their gesture is still being dispatched or held. Cancel queued reflow
  on close.
- Block movement, traps, events, encounters, and other mutations while open.
- Use actual scaled text bounds, stable IDs, filtered grids, paging, safe areas,
  synchronized hit areas, non-color state, and all three text scales.
- Announce instructions, selections, and results through an owned live region.
- Clear key/focus/update/pref/source listeners, containers, and held input on
  close and shutdown. Hidden fog flags have no active pointer target.
- Expose only already-resolved dice; `ResolvedCrownRoll` carries sides 6,
  natural values, modifier 0, total, outcome, and stable roll ID.
- Integrate a shared component presenter only after its owning code is merged.
  Never fabricate a d20 receipt, reroll, recalculate an outcome in animation, or
  make resource/scene transitions depend on a presentation callback.

## Validation

Run `tests/minigame*.test.ts` plus affected save, nautical, weather, input,
feature, achievement, and lore suites. Cover all outcomes/scoring, exact
strategy and caps, seeded reachability, repeated inputs, finite claims,
abandonment/timeouts, rejected writes, source-slot isolation, malformed IDs/
fields/cross-state, debug recovery, and measured layout.

Use `e2e/minigames.spec.ts` and `electron-tests/minigames.spec.ts` for actual
keyboard/touch/gamepad controls, reduced motion, text/contrast, paid/practice/
debug flows, exact pending/result reload, and cleanup. Never force success or
weaken a failing supported flow. Run the full release gates before delivery.

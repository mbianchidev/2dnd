# Tavern and festival activities

[Documentation index](README.md) | [Gameplay](gameplay.md) |
[Save system](save-system.md)

These three original, optional activities use only local in-game state and
gold. They never require an account, network leaderboard, gambling service,
real-world money, or campaign quest completion.

## Finding a venue

City markers show **D** for dice, **A** for archery, and **R** for a regatta.
Explore nearby to discover the venue; stand on its marker and interact to open
its entry panel. A nearby marker can also be selected directly. After
discovery, **Esc -> Tavern & Festival Games** keeps instructions and personal
boards available from safe exploration. Hidden activities leave no empty tab
or menu row.

| Activity | Venue | District and marker |
| --- | --- | --- |
| Crown & Bones | Willow Inn Dice Table | Willowdale primary district, `(13,12)` |
| Crown & Bones | Desert Rose Dice Table | Sandport primary district, `(13,8)` |
| Archery Challenge | Willowdale Practice Range | Willowdale primary district, `(5,12)` |
| Archery Challenge | Thornvale Arrow Fair | Thornvale primary district, `(7,12)`; Day/Dusk |
| Harbor Regatta | Sandport Buoy Circuit | Sandport Docks, `(10,12)` |
| Harbor Regatta | Tidehaven Reef Regatta | Tidehaven Harbor Quarter, `(10,10)` |

A rare grassland festival courier can provide directions to the first dice
table, range, and regatta. Accepting or declining the invitation charges
nothing, changes no alignment, starts no quest, and never forces entry.

## Entry, setup, and personal boards

**Play** reserves the displayed entry and exact challenge. **Setup** selects
difficulty, a capped dice stake, or free practice for archery/regatta.
**Help / board** opens paginated rules and personal records.

Friendly starts available. Seasoned requires a 60+ Friendly personal score;
Expert requires a 70+ Seasoned score in the same activity. Legitimate practice
can teach those difficulties, but its records remain separate from paid bests
and grant no currency, reputation, natural achievements, or titles.

Boards compare only the current campaign's own records against fixed
benchmarks. They show paid/practice bests per venue, ruleset, and difficulty,
plus a bounded recent history. There are no real-person fixtures, remote
scores, or online ranking services.

| Difficulty | Dice stake cap | Archery/regatta paid entry | Regatta wear cap |
| --- | ---: | ---: | ---: |
| Friendly | 5g | 5g | 4 |
| Seasoned | 10g | 10g | 8 |
| Expert | 20g | 20g | 12 |

## Crown & Bones

Each throw resolves two ordinary d6s. A total of seven is **Bones** and loses
the hand. Doubles are **Crowns**; every other non-seven pair is safe. Each safe
throw scores 20, with another five for a Crown.

| Ordered 2d6 outcomes | Count | Probability |
| --- | ---: | ---: |
| Bones: total seven | 6 | 6/36 |
| Crown: doubles | 6 | 6/36 |
| Other safe pair | 24 | 24/36 |

Choose **Roll** to push or **Bank** to stop. Banking after one, two, three, or
four safe throws returns `floor(stake * safeThrows / 2)` gold. That is the
**total payout including the entry**, not an additional profit bonus. Four
safe throws bank automatically. Banking before the first throw or abandoning
forfeits the entry. The maximum payout is twice the capped stake.

Crowns change the score, not the monetary multiplier. The exact optimal
stopping proof enumerates all 36 ordered pairs at every reachable
safe-throw/Crown-count state, includes floors and first-medal eligibility, and
compares banking with continuing. Every allowed pre-entry optimal expected
return is below its stake; even the largest unfloored four-throw return is
`2 * (30/36)^4 = 0.964506...` times the stake. Crown medal bonuses are zero.
There is no risk-free positive payout or guaranteed repeat arbitrage.

The board presents only the already-resolved pair and total. Unrolled dice are
never exposed by presentation. The authoritative `ResolvedCrownRoll` includes
its stable roll ID, `sides: 6`, two natural values, `modifier: 0`, total, and
Crown/Bones/Safe outcome. A shared component-dice presenter can consume that
receipt after integration; it must not reroll or treat it as a d20 result.

## Archery Challenge

Five seeded targets use one borrowed bow. Aim at the numbered position and
release confirm to fire. Each arrow scores
`max(0, 100 - abs(aim - target) * difficultyPenalty)`; the final score is the
floored five-arrow average. Friendly/Seasoned/Expert penalties are 4/5/6.
Class, ability scores, equipment, spells, and input source never add bonuses.

The normal meter moves as a runtime-only input preview. Its animation does not
write saves, mutate a shot, advance a turn, or own a reward. Accepted aim
changes and the observed position of each fired arrow are committed atomically.
Reload keeps the same targets, accepted arrows, last committed aim, and score;
it does not reroll a challenge.

Reduced motion stops the meter. Left/right changes aim by one, up/down changes
it by five, and pointer/touch can select a position on the visible meter.
Confirm uses the same scoring formula, targets, thresholds, and rewards.

A paid 80+ refunds the entry. The first paid 80+ per activity/difficulty earns
an additional **8/16/24g** laurel bonus. That finite claim is shared across
venues. Repeating a perfect run can return at most its entry, not print gold.

## Harbor Regatta

An active owned boat at **20+ condition** is required, including for practice.
Follow numbered buoys in order and then reach **F**. **B** marks the boat and
**#** a reef; text also reports current coordinates, the next buoy, effort,
forecast, wind, hull condition, and move limit.

Each course has a clear cardinal route. Sailing uses the same nautical
destination, Water eligibility, sea-zone/depth, and boat capability helpers as
ordinary navigation. This is a local harbor course: the party's campaign
position, sailing flag, sea fog, encounters, routes, and quest state do not
move or resolve.

The forecast is fixed before entry. Calm city weather uses canonical
`rollWeather()` biome/time weights with a salted seeded RNG for the existing
port chunk; a supplied non-Clear local forecast is preserved. This neither
consumes the campaign RNG nor changes city/global weather. Omitted RNG in
`rollWeather()` retains its original call order and behavior.

Weather changes effort against the saved wind and periodic wear. A worn initial
hull also affects effort; canonical installed upgrades reduce condition loss.
Collision/weather wear is committed per accepted move, capped by difficulty,
and can never take the boat below one condition. Abandonment keeps wear already
sustained. Free practice causes no wear. A move-limit timeout loses the entry
but leaves campaign navigation and resources intact.

The score is capped at 100, subtracting two points per effort above the
weather/boat-specific clear-route par and eight per collision. A paid 80+
refunds the entry. Its first activity/difficulty medal adds a finite
**10/20/30g** pennant bonus, shared across venues.

## Controls and accessibility

| Surface | Keyboard | Standard gamepad | Pointer/touch |
| --- | --- | --- | --- |
| Panels | Arrows/WASD, release Enter/Space, Esc | D-pad, A, B | Visible buttons; A/B also available |
| Dice | Select Roll/Bank, confirm | D-pad selects, A confirms | Roll/Bank buttons |
| Archery | Left/right 1, up/down 5; release confirm fires | Same D-pad aim; release A fires | Meter/aim buttons, Fire or A |
| Regatta | Arrows/WASD sail; confirm pauses | D-pad/left stick sails; A pauses | Sailing buttons or shared directional pad |
| Pause/leave | Esc; choose Resume/Rules/Abandon | B; choose an action | Pause/outside, then visible action |

Cancel first opens a pause/abandon confirmation rather than spending or
refunding resources. Confirm is handled on release; held or delayed input
cannot act twice or leak into world interactions after close.

Panels use measured wrapping, pagination, filtered grids, stable focus IDs,
scaled hit areas, and safe-area-aware shared touch controls. They support all
three text scales, live high contrast, non-color-only state, and reduced motion.
A scene-owned polite live region announces instructions, selections, and
results. Closing or shutdown releases listeners, focus callbacks, preview
updates, containers, and the semantic input override.

## Authority, saves, and integration

Immutable definitions belong to `src/data/minigames.ts`, invitation content to
`minigameEvents.ts`, and lore to `codexMinigames.ts`. Focused Phaser-free
mechanics, score/result mapping, recovery, transactions, and presentation models
live in `src/systems/minigame*.ts`; the scene-owned manager and procedural
renderers live in `src/managers/minigames.ts` and `src/renderers/minigame*.ts`.

Schema v19 adds `player.progression.minigames`: a stable seed, session and
settled-session watermarks, discovered venue IDs, paid/practice bests, paid
statistics, finite claimed milestone IDs, a 40-entry history, and one exact
pending session/receipt. Definitions, named tiers, UI state, animation time,
DOM/Phaser objects, and preview clocks are not persisted.

The history is **not a payment ledger**. Exact session IDs and expected action
revisions gate input; permanent watermarks and finite known milestone claims
gate settlement. Buy-in, accepted input, wear, payout, and abandonment save
before results are exposed. A rejected write restores wallet, progression,
Codex, discovery availability, and all reconciled consumers.

Unknown normalization validates IDs, rulesets, fixed challenge components,
scores, caps, phases, revisions, boat snapshots, and cross-domain location/boat
state. Invalid pending data is retired conservatively: no second charge,
refund, reroll, reward replay, boat restoration, or quest mutation. Valid old
schema-v18 campaigns gain deterministic empty minigame state without historical
rewards. Manual snapshots remain isolated from subsequent autosave progress.

Only first paid difficulty medals emit bounded canonical town/faction
reputation; routine wins/losses never change alignment. Activity completion
signals unlock lore, and paid natural statistics derive cosmetic achievements.
None of those consumers controls quests, access, combat, or endings.

Debug commands are local-only:

```text
/minigame list
/minigame status
/minigame near <venueId>
/minigame play <venueId> [friendly|seasoned|expert]
```

Debug play is persistently marked, charges/pays nothing, causes no hull wear,
and never advances natural bests, counters, milestone claims, reputation, lore,
or achievements. The marker remains after reload.

## Coverage

`tests/minigame*.test.ts` covers all activities, all 36 dice outcomes and the
optimal strategy, scoring, deterministic reachable layouts, payout caps,
repeated/late input, finite claims, abandonment/timeouts, save-write rollback,
debug isolation, legacy/corrupt snapshots, and measured layout.

`e2e/minigames.spec.ts` and `electron-tests/minigames.spec.ts` exercise actual
keyboard, emulated touch, and standard-gamepad controls, paid/practice/debug
flows, reduced motion, text scaling, high contrast, saved pending/result
recovery, and input cleanup. Tests use synthetic campaign fixtures only.

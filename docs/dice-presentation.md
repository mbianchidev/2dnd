# Resolved dice presentation

[Documentation index](README.md) | [Architecture](architecture.md) |
[Gameplay](gameplay.md)

## Player controls

Pixel-art dice appear directly over the active game's measured viewport, showing the actual numbered faces, the selected
advantage/disadvantage die, permitted modifiers/totals, known AC/DC, and the
canonical outcome. Results are readable from the first frame; the short settling
motion never delays an action, resource update, turn, or scene transition.
Dice are visibly thrown across the game viewport, tumble on multiple axes,
bounce with floor shadows, and settle on their exact resolved faces. The
pointer-transparent animation layer never covers input with a hit area; the
settled numbered faces remain readable without a separate dock.
Stepped 32-pixel silhouettes, bitmap numerals, indigo faces and gold borders
match the game's procedural art. Selected dice keep their visible `*` marker;
high contrast uses black/white faces without changing the rolled number.

Attack and damage evidence appear together: the natural d20 plus its permitted
signed modifier/total, then the real damage pool and named additive modifiers.
Healing shows its real pool separately from HP restored. Recorded adjustments
explain elemental changes, minimums and shield defense; the final HP change
identifies overkill, nonlethal and maximum-HP limits without changing the
original roll. Area effects render the shared pool once and retain each
target's own result. Spell/ability menus describe base pools rather than adding
a casting-stat damage/healing bonus the resolver never applied.

Use **Z**, **L3** (left-stick press), or the pointer/touch **Skip animation**
button to fast-forward motion. Roll details belong to the existing **Battle
log**, alongside attacks and other combat messages; use its normal wheel or
controller scrolling. Its accessible counterpart mirrors those same messages.
Battle has only that lower visible log: the dice layer contains faces and the
skip control, not another result-caption strip. Screen-reader roll announcements
remain available. There is no second roll-log panel or history carried into another scene.
The skip button appears only while motion is active, supports native keyboard,
touch and the gamepad cursor, and never activates the game underneath.

Outside Battle, results remain readable for three seconds after settling,
then fade over 250 ms and clear their faces, text and announcement. Reduced
motion removes the fade. Starting or closing another event clears its previous
view. Leaving Battle or changing scenes immediately removes the view and its
scene-owned evidence; title, Codex, cutscenes and result screens never restore
the last roll. These visual lifetimes never delay gameplay.

Title and in-game Settings share **Dice** and **Speed** controls. While Settings
is open, **[** cycles frequency and **]** cycles speed:

| Setting | Values |
| --- | --- |
| Dice visibility/frequency | All (default), Important, Off (crits still show) |
| Dice animation speed | Normal (900 ms), Fast (300 ms), Instant |

Important animates checks, saves, flee, and critical/fumble feedback rather than
routine attacks or initiative. Off hides ordinary roll notices, announcements
and animations; the current Battle log still receives redacted details. **Canonical attack
critical hits (selected natural20) and fumbles (selected natural1) always show,
even with Off.** Instant and reduced motion still make those results static;
they never force motion or a gameplay wait. Checks, saves and initiative keep
their actual outcomes and are not reclassified as attack crits.
Reduced motion and Instant show exact static results without
animation timers. Text scale and high contrast update live.

The Battle log resets when the battle ends. Neither it nor transient
non-combat results are campaign history or gameplay authority.

## Authority and hidden information

- `src/systems/dice.ts` captures `ResolvedD20Roll` receipts at the same calls
  that resolve the mechanics. Each immutable receipt holds `naturalRolls`,
  `selectedIndex`, `selection`, `naturalRoll`, `modifier`, and `total`.
- Combat results add `rollResult` and canonical critical/fumble flags. Group
  initiative exposes per-actor `rollResults`; status-start results expose exact
  `savingThrows`, including failures; flee returns its resolved die and DC.
- Skill, trap, event, shop, and nautical presentation consumes the existing
  resolved records. Repeated or automatic trap checks do not fabricate a die.
- Monster attack, initiative, and saving-throw modifiers/totals remain hidden.
  Enemy AC is shown only after normal combatant discovery. Failed trap detection
  uses generic awareness text without the trap name, position, or DC.
- Natural 1/20 skill checks and saves retain their canonical success/failure;
  presentation does not turn them into attack fumbles/criticals.
- Magic Missile remains auto-hit, shows no attack die or AC, and does not roll
  disadvantage. Its actual damage dice remain visible. Shared AoE rolls remain
  shared, including independent elemental adjustments and HP limits.
- `ResolvedEffectRoll` retains exact damage/healing components at their existing
  canonical dice calls. It separates signed named `modifiers`, recorded
  `adjustments`, the resolved `amount`, and the applied HP `application`.
  `criticalDice` marks actual doubled dice, not merely a spell's natural-20 hit
  flag. `shared` marks one pool used by multiple targets.
- HP application is captured at the owning mutation in combat, the validated
  executor, trap/exploration mechanics, or the existing scene-owned write. Scene
  adapters capture final shield refunds and monster-healing caps; they never
  introduce a second damage/healing calculator or change hook timing.
- Faces/counts remain integers. Arithmetic preserves finite fractional legacy
  item effects and HP changes without rounding; NaN/Infinity are rejected.
  Snapshots copy scalar values and stable actor/action metadata, not mutable
  players/combatants. Enemy modifiers and intermediate arithmetic are removed
  before notices and the Battle log.
- Multiple status ticks retain their own rolled components and existing RNG
  order before saves. Their one capped aggregate HP write is shown separately,
  without inventing per-tick overkill allocations.
- Misses show no applied damage pool. Spells retain their original pre-outcome
  dice consumption without presenting unused damage as applied. Monster breath
  abilities and on-hit statuses never gain a fabricated attack/save die.
- Fixed item/restoration effects and healing derived from life drain remain
  honest aggregate text when no independent dice rolled. Legacy numeric trap
  rollers likewise remain aggregate. Gathering uses its real score/required-score
  outcome and explicitly reports that it is not a d20.

`ResolvedDiceComponents` also supports consumers that already expose exact
non-d20 faces, die size, modifier, and total. `snapshotDiceComponents()` and
`createComponentDicePresentation()` copy those values; callers supply the
already-resolved outcome and a stable action ID. They must not cast custom dice
to d20 receipts or derive outcomes inside presentation.

## Ownership and integration

`src/systems/rollResults.ts` owns immutable receipt contracts.
`src/systems/effectRolls.ts` captures the same damage/healing dice calls,
recorded adjustments and mechanics-owned HP deltas.
`src/systems/diceMotion.ts` builds deterministic throw/rotation/bounce geometry
from only the visible die count and measured viewport. It receives no rolls,
actors, resources or outcome callbacks and consumes no RNG.
`src/systems/dicePresentation.ts` owns redacted snapshots, exact text formatting,
visual timing, presentation deduplication, bounded scene-local evidence, and the
Phaser-free lifecycle controller.

`installDicePresentation(scene)` installs a scene-owned manager.
`presentDiceResult(scene, presentation, source?)` is synchronous, returns no
promise, and has no gameplay callback. `presentSkillDiceResult()` is the
existing-record adapter. `BattleDicePresenter` binds stable actor/target IDs and
reads current discovery flags without changing them.
`createEffectDicePresentation()` redacts exact effect receipts;
`createCombatDicePresentation()` combines attack and damage evidence.
`combineDicePresentations()` preserves per-target results within one immediate
notice/log entry; it neither combines mechanics nor derives another outcome.

The procedural SVG renderer lives in `src/renderers/dice.ts`. Its overlay
tracks the actual canvas bounds without changing the canvas size, pointer
geometry or touch-control positions. The exact same numbered dice animate and
remain at rest, including Instant/reduced-motion results; no dock copies are
rendered. Outside Battle, long result captions wrap in a bounded in-scene reading
area; Battle sends that text exclusively to its existing lower log.
`src/managers/input.ts` routes the existing skip action and native skip control
without adding a blocking input context.

Managers never restore another scene's latest result or history. Battle routes
redacted detail through its normal log owner. Other scenes use a cancellable
reading/expiry timer, fade and cleanup watchdog; event starts/closes explicitly
reset prior results. Skip settles the numbered faces without rerolling. Blur
and visibility loss clear the view, and resize settles/repositions it.

Shutdown/explicit Battle cleanup cancels timers, Web Animations, synthesized
cues, subscriptions, and keyboard listeners exactly once. Stale completion
callbacks cannot revive the view. `audioEngine.playDiceCue()` routes short,
deterministic oscillator cues through the SFX graph and returns a cancellation
function; it uses no shared RNG or external media.

Discrete shared touch actions hold their synthetic key through Phaser's
poststep boundary so `JustDown` polling observes the press before release.
Owned pulse tokens cannot release another held source. Blur, visibility loss,
disconnect, context/scene changes and destruction cancel pending releases and
listeners, including when no further frame runs; stale callbacks cannot enter
a replacement scene. Text-entry/log priority and existing mappings/debounce
remain authoritative.

## Persistence and validation

Preference version **3** adds:

```typescript
dice: {
  frequency: "all" | "important" | "off";
  speed: "normal" | "fast" | "instant";
}
```

Missing, legacy v1/v2, and malformed fields normalize to All/Normal while
preserving audio, accessibility, and control preferences. This is stored only
under `2dnd_preferences`, independently of the campaign schema.
Neither receipts nor Battle log entries enter saves, and dice preferences do
not increment the campaign schema.

`dicePresentation`, `diceManager`, `effectRollReceipts`, `rollReceipts`, `diceRenderer`,
`accessibility`, `input`, and `inputRuntime`
Vitest suites cover redaction, both dice, critical/fumble/auto-hit semantics,
exact component mapping, fractional legacy compatibility, RNG/MP/HP parity,
per-target caps, observer-hook timing, preferences, cancellation, scoped
expiry and rejection of stale fade/scene callbacks.
`e2e/dice-presentation.spec.ts` exercises production battle, event, trap,
gathering, flee, skip, log, reload, and transition controls, real exploration/
battle healing, and a shared area pool at all text scales and desktop/mobile
viewports. Headless Chromium asserts measured in-scene dice/text bounds,
unchanged canvas geometry, immediate reduced-motion/instant numbered faces,
normal event fading, Battle log reset and the actual fishing tick/bite/tension
input sequence. Native gates run only in isolated CI environments, never by
taking control of the developer's desktop.

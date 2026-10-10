# Resolved dice presentation

[Documentation index](README.md) | [Architecture](architecture.md) |
[Gameplay](gameplay.md)

## Player controls

The resolved-dice dock shows the actual natural faces, the selected
advantage/disadvantage die, permitted modifiers/totals, known AC/DC, and the
canonical outcome. Results are readable from the first frame; the short settling
motion never delays an action, resource update, turn, or scene transition.

Use **Z**, **L3** (left-stick press), or the pointer/touch **Skip animation**
button to fast-forward motion. The **Roll log** retains the last 40 results
across scene changes. It is keyboard accessible with Tab, Enter/Space, and
Escape, and reachable with the gamepad cursor; focused log controls consume
their own input rather than activating the game underneath.

Title and in-game Settings share **Dice** and **Speed** controls. While Settings
is open, **[** cycles frequency and **]** cycles speed:

| Setting | Values |
| --- | --- |
| Dice animation frequency | All, Important, Off |
| Dice animation speed | Normal (450 ms), Fast (150 ms), Instant |

Important animates checks, saves, flee, and critical/fumble feedback rather than
routine attacks or initiative. Off keeps immediate text and logs without die
graphics or cues. Reduced motion and Instant show exact static results without
animation timers. Text scale and high contrast update live.

The runtime log resets on returning to title or reloading. It is consultable
evidence, not campaign history or gameplay authority.

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
  disadvantage. Shared AoE rolls remain shared.
- Existing damage and healing APIs expose aggregate amounts, so their feedback
  says aggregate rather than inventing component faces. Gathering uses its real
  score/required-score outcome and explicitly reports that it is not a d20.

`ResolvedDiceComponents` supports future consumers that already expose exact
non-d20 faces, die size, modifier, and total. `snapshotDiceComponents()` and
`createComponentDicePresentation()` copy those values; callers supply the
already-resolved outcome and a stable action ID. They must not cast custom dice
to d20 receipts or derive outcomes inside presentation.

## Ownership and integration

`src/systems/rollResults.ts` owns immutable receipt contracts.
`src/systems/dicePresentation.ts` owns redacted snapshots, exact text formatting,
visual timing, presentation deduplication, bounded runtime history, and the
Phaser-free lifecycle controller.

`installDicePresentation(scene)` installs a scene-owned manager.
`presentDiceResult(scene, presentation, source?)` is synchronous, returns no
promise, and has no gameplay callback. `presentSkillDiceResult()` is the
existing-record adapter. `BattleDicePresenter` binds stable actor/target IDs and
reads current discovery flags without changing them.

The procedural SVG renderer lives in `src/renderers/dice.ts`; its responsive
DOM dock is outside the Phaser canvas, so it does not obscure game content.
`src/managers/input.ts` keeps touch controls below the dock and extends its
existing gamepad cursor to native log controls without adding a blocking input
context. All Phaser scenes install the manager so the log survives immediate
battle, trap, gathering, cutscene, result, and exploration handoffs.
The dock keeps the same bounded height across animation modes and refreshes
Phaser's scale/pointer geometry when its host changes size.

Shutdown/explicit Battle cleanup cancels timers, Web Animations, synthesized
cues, subscriptions, and keyboard listeners exactly once. Stale completion
callbacks cannot revive the view. `audioEngine.playDiceCue()` routes short,
deterministic oscillator cues through the SFX graph and returns a cancellation
function; it uses no shared RNG or external media.

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
under `2dnd_preferences`; campaign schema remains **18**, and neither receipts
nor runtime log entries enter saves.

`dicePresentation`, `rollReceipts`, `diceRenderer`, `accessibility`, and `input`
Vitest suites cover redaction, both dice, critical/fumble/auto-hit semantics,
exact component mapping, RNG parity, preferences, cancellation, and history.
`e2e/dice-presentation.spec.ts` exercises production battle, event, trap,
gathering, flee, skip, log, reload, and transition controls at all text scales
and desktop/mobile viewports.

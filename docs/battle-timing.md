# Timed battle decisions

[Gameplay](gameplay.md) | [Architecture](architecture.md) |
[Save system](save-system.md)

## Configuration and controls

**Standard is the default and has no time limit.** Timed decisions are an
optional campaign rule, not an accessibility requirement. During exploration,
open **Esc menu > Settings > Battle Timing**. Keyboard, touch, and gamepad
confirm can open the focused Battle Timing entry; its controls use
WASD/arrows/D-pad to choose and Enter/Space/A to change. Pointer users can select
the same controls directly.

Each campaign stores `player.battleTiming`:

| Field | Supported values | Default |
| --- | --- | --- |
| `mode` | `standard`, `timed` | `standard` |
| `durationSeconds` | 15, 30, 45, 60, 90 | 30 |
| `timeoutAction` | `defend` | `defend` |

Changes autosave that campaign. They do not change other manual snapshots or
the separate audio, accessibility, and control preferences.

## Decision budget and timeout

A conscious hero or manual companion receives one budget after start-of-turn
statuses finish. Action menus and enemy/ally target selection use that same
budget. A bonus action does **not** reset it. Monsters, gambits, skipped turns,
KO actors, and battle results never receive a decision timer.

At zero, the system claims the current stable turn/actor once and validates a
fresh self-Defend through `battleActions.ts`. It never confirms a highlighted
spell, item, ability, or target. Defend spends only an available main action,
does not roll dice, and consumes no MP or inventory. If the main action was
already spent, the timeout only ends the turn. Invalid or superseded actors
cannot execute a stale timeout. Status expiration, rewards, result hooks, and
scene handoffs use their existing guarded paths.

## Pausing and accessible cues

Countdown time advances only while decision input is accepted. It pauses for
real action presentation, blocked input, blocking system/text-entry overlays,
scene fades/handoffs, paused scenes, hidden pages, window focus loss, and active
controller recovery. Normal log append operations and independent non-blocking
notices do not create a permanent pause.

**Esc/B**, **Pause / read log**, or log scrolling opens a deliberate log-reading
pause. **Enter/Space/A/B** or the visible **Resume** control resumes without
also executing the selected action. Disconnecting the active gamepad pauses the
budget until that same acknowledgment; a keyboard, pointer, touch device, or
reconnected gamepad can resume it. Visibility/focus restoration continues the
remaining budget without charging the background interval or boundary frame.

The countdown shows remaining seconds, **TIME LOW**, and a textual **PAUSED**
reason on a high-contrast background. A screen-reader timer exposes the current
value; a polite status region announces new turns, pauses, and the last five
seconds without per-frame announcements. It has no flashing, shaking, or
countdown tweens. Reduced motion changes presentation, not the decision duration.
The timing controls and menus support 100%, 125%, and 150% text.

## Reload and integration boundaries

Schema v19 persists configuration only. Reload during an ordinary Battle
returns to the existing autosaved Overworld checkpoint; a pending special
encounter resumes the same selected event/gathering/navigation contract.
Unsaved Battle damage/resources are not a partial-turn checkpoint. Loading
does not execute a timeout or replay a result, reward, or selected action.
A restarted encounter receives a fresh budget after its normal status/input
setup. No deadline, initiative adapter, or timer callback is serialized.

Immutable contracts live in `src/data/battleTiming.ts`; configuration
normalization is in `systems/battleTimingSettings.ts`; active-time accounting
and validated timeout execution are in `systems/battleTiming.ts`.
`BattleTimingManager` owns scene lifecycle, accessible cues, and shared input
availability, while the existing action director exposes real presentation
activity. Timed hero/manual menus use `BattleDecisionMenu`; Standard retains
its existing combat and menu paths.

The optional runtime `BattleTimingAdjustment` can suggest a supported
`durationSeconds` through `BattleSceneData.battleTimingAdjustment`. It cannot
enable timed mode, change the timeout policy, or mutate saved configuration.
Difficulty and non-blocking dice presentation must not own another countdown
or execute timing callbacks.

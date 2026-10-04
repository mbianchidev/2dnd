import { MINIGAME_DIFFICULTIES, getMinigameActivity } from "../data/minigames";
import { classifyCrownDice, getCrownPayout } from "./minigameRules";
import { getMinigameScore } from "./minigameResults";
import { getRegattaProgress, getRegattaWind } from "./minigameRegatta";
import type { MinigameDifficultyId } from "../data/minigames";
import type { InputSource } from "./input";
import type { MinigamePoint, MinigameSession, ResolvedCrownRoll } from "./minigameTypes";

export type MinigameBoard =
  | { readonly kind: "dice"; readonly roll?: ResolvedCrownRoll }
  | { readonly kind: "archery"; readonly aim: number; readonly target: number }
  | {
    readonly kind: "regatta";
    readonly width: number;
    readonly height: number;
    readonly buoys: readonly MinigamePoint[];
    readonly obstacles: readonly MinigamePoint[];
    readonly finish: MinigamePoint;
    readonly position: MinigamePoint;
    readonly buoyIndex: number;
  };

export interface MinigameGamePresentation {
  readonly title: string;
  readonly status: string;
  readonly prompt: string;
  readonly board: MinigameBoard;
}

/** The moving cursor is an input preview, never a pending reward or a save-write clock. */
export function getArcheryMeterAim(
  initialAim: number,
  elapsedMs: number,
  difficultyId: MinigameDifficultyId,
): number {
  const steps = Math.floor(Math.max(0, elapsedMs) / 180);
  const distance = (initialAim + steps * MINIGAME_DIFFICULTIES[difficultyId].archeryMeterStep) % 200;
  return distance <= 100 ? distance : 200 - distance;
}

export function getMinigameControlPrompt(
  activity: MinigameSession["activityId"] | "menu",
  source: InputSource,
): string {
  if (activity === "archery") {
    if (source === "keyboard") return "Left/right: 1; up/down: 5; release Enter/Space fires; Esc pauses.";
    if (source === "gamepad") return "D-pad: left/right 1, up/down 5; release A fires; B pauses.";
    if (source === "touch") return "D-pad or meter aims; tap Fire; B pauses.";
    return "Aim with buttons or the meter; Fire on release; outside pauses.";
  }
  if (activity === "regatta") {
    if (source === "keyboard") return "Arrows/WASD sail; Enter/Space pauses; Esc opens leave.";
    if (source === "gamepad") return "D-pad/left stick sails; A pauses; B opens leave.";
    if (source === "touch") return "Directional pad sails; A pauses; B opens leave.";
    return "Use the sailing buttons; outside opens pause and leave.";
  }
  if (source === "keyboard") return "Arrows/WASD choose; release Enter/Space; Esc goes back.";
  if (source === "gamepad") return "D-pad chooses; A confirms; B goes back.";
  if (source === "touch") return "Tap a button or use D-pad/A; B goes back.";
  return "Choose a visible button; click outside to go back.";
}

/** Truthful view data excludes every unrolled Crown & Bones die. */
export function getMinigameGamePresentation(
  session: MinigameSession,
  source: InputSource,
  reducedMotion: boolean,
  visibleAim?: number,
): MinigameGamePresentation {
  const activity = getMinigameActivity(session.activityId);
  const label = session.debug ? " [DEBUG]" : session.practice ? " [PRACTICE]" : "";
  const title = `${activity.name}${label}`;
  const score = getMinigameScore(session);
  const prompt = getMinigameControlPrompt(session.activityId, source);
  if (session.activityId === "crownAndBones") {
    const dice = session.challenge.rolls[session.game.rollCount - 1];
    const roll = dice
      ? { ...classifyCrownDice(dice), rollId: `${session.runId}:roll:${session.game.rollCount}` }
      : undefined;
    const bank = getCrownPayout(session.feePaid, session.game.rollCount, roll?.outcome === "bones");
    return {
      title, prompt,
      status: `Roll ${session.game.rollCount}/4 | Score ${score}/100 | Stake ${session.feePaid}g\n`
        + `Bank returns ${bank}g | Bones 6/36, Crown 6/36\n`
        + (roll ? `${roll.naturalRolls.join(" + ")} = ${roll.total} [${roll.outcome.toUpperCase()}]` : "No dice rolled yet."),
      board: { kind: "dice", roll },
    };
  }
  if (session.activityId === "archery") {
    const aim = visibleAim ?? session.game.aim;
    const target = session.challenge.targets[Math.min(session.game.shots.length, 4)]!;
    return {
      title, prompt,
      status: `Arrow ${Math.min(5, session.game.shots.length + 1)}/5 | Score ${score}/100\n`
        + `Aim ${aim} | Target ${target}\n`
        + (reducedMotion ? "Steady aim: no moving meter." : "Timed meter: fire at the visible position."),
      board: { kind: "archery", aim, target },
    };
  }
  const progress = getRegattaProgress(session);
  const next = session.challenge.buoys[progress.buoyIndex] ?? session.challenge.finish;
  const wind = getRegattaWind(session) ?? "calm";
  return {
    title, prompt,
    status: `Boat (${progress.position.x},${progress.position.y}) | Next ${progress.buoyIndex < session.challenge.buoys.length ? `buoy ${progress.buoyIndex + 1}` : "F"} (${next.x},${next.y})\n`
      + `Effort ${progress.effort} / par ${progress.parEffort} | Hull ${session.boat.condition - progress.conditionLost}\n`
      + `${session.weather} | Next wind ${wind} | Moves ${progress.moves}/${MINIGAME_DIFFICULTIES[session.difficultyId].regattaMoveLimit}`,
    board: {
      kind: "regatta", width: session.challenge.width, height: session.challenge.height,
      buoys: session.challenge.buoys, obstacles: session.challenge.obstacles,
      finish: session.challenge.finish, position: progress.position, buoyIndex: progress.buoyIndex,
    },
  };
}

export class MinigameInputGate {
  private readonly acceptedAt = new Map<string, number>();

  accept(actionId: string, timestamp: number, gapMs = 90): boolean {
    const previous = this.acceptedAt.get(actionId);
    if (previous !== undefined && timestamp - previous < gapMs) return false;
    this.acceptedAt.set(actionId, timestamp);
    return true;
  }

  clear(): void {
    this.acceptedAt.clear();
  }
}

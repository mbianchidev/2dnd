import { MINIGAME_GOLD_SCORE } from "../data/minigames";
import { classifyCrownDice, getArcheryScore, getCrownPayout, getCrownScore } from "./minigameRules";
import { getRegattaProgress } from "./minigameRegatta";
import type { MinigameOutcome, MinigameReceipt, MinigameSession } from "./minigameTypes";

export function getMinigameScore(session: MinigameSession): number {
  if (session.game.abandoned) return 0;
  if (session.activityId === "crownAndBones") {
    return getCrownScore(session.challenge.rolls, session.game.rollCount);
  }
  if (session.activityId === "archery") {
    return getArcheryScore(session.challenge, session.game.shots, session.difficultyId);
  }
  return getRegattaProgress(session).score;
}

export function getMinigameOutcome(session: MinigameSession): MinigameOutcome | undefined {
  if (session.game.abandoned) return "abandoned";
  if (session.activityId === "crownAndBones") {
    const last = session.challenge.rolls[session.game.rollCount - 1];
    if (last && classifyCrownDice(last).outcome === "bones") return "bones";
    return session.game.banked || session.game.rollCount === 4 ? "banked" : undefined;
  }
  if (session.activityId === "archery") {
    return session.game.shots.length === session.challenge.targets.length ? "completed" : undefined;
  }
  const progress = getRegattaProgress(session);
  return progress.complete ? "completed" : progress.timeout ? "timeout" : undefined;
}

export function getMinigameBasePayout(
  session: Pick<MinigameReceipt, "activityId" | "feePaid" | "score" | "outcome" | "practice" | "debug">,
  crownRolls = 0,
): number {
  if (session.practice || session.debug || session.outcome === "abandoned" || session.outcome === "timeout") return 0;
  if (session.activityId === "crownAndBones") {
    return getCrownPayout(session.feePaid, crownRolls, session.outcome === "bones");
  }
  return session.score >= MINIGAME_GOLD_SCORE ? session.feePaid : 0;
}

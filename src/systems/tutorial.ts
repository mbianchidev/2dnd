import type { PlayerState } from "./player";
import type { TipCategory, TipDefinition, TipUnlock } from "../data/tutorial";
import { TIPS } from "../data/tutorial";

export interface TutorialProgress {
  completed: boolean;
}

export interface TutorialTipContext {
  level: number;
  companionCount: number;
  hasMount: boolean;
  hasEnteredDungeon: boolean;
  hasSkillCheck: boolean;
  hasTrapExperience: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function createTutorialProgress(): TutorialProgress {
  return { completed: false };
}

export function normalizeTutorialProgress(value: unknown): TutorialProgress {
  if (!isRecord(value)) return createTutorialProgress();
  return {
    completed: value.completed === true,
  };
}

export function completeTutorial(progress: TutorialProgress): boolean {
  if (progress.completed) return false;
  progress.completed = true;
  return true;
}

export function createTutorialTipContext(
  player: PlayerState,
): TutorialTipContext {
  return {
    level: player.level,
    companionCount: player.party.companions.length,
    hasMount: player.mountId.length > 0,
    hasEnteredDungeon: player.position.inDungeon
      || Object.keys(player.progression.exploredTiles).some((key) =>
        key.startsWith("d:")
      ),
    hasSkillCheck: Object.keys(player.progression.skillChecks).length > 0,
    hasTrapExperience: player.progression.trapGuidance
      || Object.keys(player.progression.trapStates).length > 0,
  };
}

export function isTipUnlocked(
  unlock: TipUnlock,
  context: TutorialTipContext,
): boolean {
  switch (unlock.type) {
    case "always":
      return true;
    case "level":
      return context.level >= unlock.minimum;
    case "companion":
      return context.companionCount > 0;
    case "mount":
      return context.hasMount;
    case "dungeon":
      return context.hasEnteredDungeon;
    case "skillCheck":
      return context.hasSkillCheck;
    case "trap":
      return context.hasTrapExperience;
  }
}

export function getUnlockedTips(
  context: TutorialTipContext,
  category?: TipCategory,
): TipDefinition[] {
  return TIPS.filter((tip) =>
    (category === undefined || tip.category === category)
    && isTipUnlocked(tip.unlock, context)
  );
}

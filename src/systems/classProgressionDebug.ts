import {
  PROGRESSION_PROFILES,
  getProgressionProfile,
} from "../data/classProgression";
import {
  commitHeroLevelUp,
  getProgressionSummary,
  prepareHeroLevelUp,
  qualifyNextClass,
} from "./classProgression";
import { awardXP, xpForLevel, type PlayerState } from "./player";

export interface ProgressionDebugResult {
  changed: boolean;
  messages: string[];
  openSheet: boolean;
  asiGained: number;
}

/** Debug adapters use the same bounded progression transaction as production rest choices. */
export function executeProgressionDebugCommand(
  player: PlayerState,
  args: string,
  allowAdvance = false,
): ProgressionDebugResult {
  const [rawCommand = "status", input = "", ...extra] = args.trim().split(/\s+/).filter(Boolean);
  const command = rawCommand.toLowerCase();
  const result: ProgressionDebugResult = {
    changed: false, messages: [], openSheet: false, asiGained: 0,
  };
  if (extra.length > 0) {
    result.messages.push("Usage: /class list|status|qualify <id>|level <id>|sheet");
    return result;
  }
  if (command === "list") {
    result.messages = PROGRESSION_PROFILES.map((profile) =>
      `${profile.id}: ${qualifyNextClass(player, profile.id).message}`
    );
  } else if (command === "status") {
    result.messages.push(`${getProgressionSummary(player)}; total ${player.level}/20;`
      + ` ${player.pendingLevelUps} earned / ${player.classProgression.readyLevelUps} rested levels.`);
  } else if (command === "sheet") {
    result.openSheet = true;
  } else if (command === "qualify" || command === "level") {
    const profile = PROGRESSION_PROFILES.find((entry) => entry.id.toLowerCase() === input.toLowerCase());
    const id = profile?.id ?? input;
    const qualification = qualifyNextClass(player, id);
    if (command === "qualify" || !qualification.qualified) {
      result.messages.push(qualification.message);
    } else if (!allowAdvance) {
      result.messages.push("Class advancement is only available during safe exploration.");
    } else if (getProgressionProfile(id)) {
      if (!Number.isFinite(player.xp) || player.xp < 0) {
        result.messages.push("Invalid XP; reload a normalized campaign.");
        return result;
      }
      const expectedTotalLevel = player.level;
      const previous = {
        xp: player.xp,
        pendingLevelUps: player.pendingLevelUps,
        readyLevelUps: player.classProgression.readyLevelUps,
        pendingLevel: player.classProgression.pendingLevel,
      };
      const restore = (): void => {
        player.xp = previous.xp;
        player.pendingLevelUps = previous.pendingLevelUps;
        player.classProgression.readyLevelUps = previous.readyLevelUps;
        player.classProgression.pendingLevel = previous.pendingLevel;
      };
      awardXP(player, Math.max(0, xpForLevel(expectedTotalLevel + 1) - player.xp));
      const prepared = prepareHeroLevelUp(player);
      if (!prepared.ok) {
        restore();
        result.messages.push(prepared.message);
        return result;
      }
      const committed = commitHeroLevelUp(player, { trackId: id, expectedTotalLevel });
      result.messages.push(committed.message);
      if (committed.ok) {
        result.changed = true;
        result.asiGained = committed.receipt.asiGained;
      } else restore();
    }
  } else {
    result.messages.push("Usage: /class list|status|qualify <id>|level <id>|sheet");
  }
  return result;
}

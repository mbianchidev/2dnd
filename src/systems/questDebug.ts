import {
  QUEST_IDS,
  getQuestDefinition,
} from "../data/quests";
import type { QuestId, QuestStatus } from "../data/quests";
import type { PlayerState } from "./player";
import {
  advanceQuestForDebug,
  buildQuestJournal,
  completeQuestForDebug,
  formatQuestStates,
  resetQuestForDebug,
  setQuestStageForDebug,
  setQuestStatusForDebug,
  startQuestForDebug,
} from "./quests";
import type { QuestProcessResult } from "./quests";

export interface QuestDebugResult {
  success: boolean;
  changed: boolean;
  messages: string[];
}

function parseQuestId(value: string): QuestId | null {
  const normalized = value.trim().toLowerCase();
  return QUEST_IDS.find((questId) => questId.toLowerCase() === normalized) ?? null;
}

function questDebugUsage(): QuestDebugResult {
  return {
    success: false,
    changed: false,
    messages: [
      "Usage: /quest <list|show|start|advance|set|reset|complete> [questId] [stage|status] [value]",
    ],
  };
}

/** Parse and execute a quest debug subcommand without UI dependencies. */
export function runQuestDebugCommand(
  player: PlayerState,
  defeatedBosses: Set<string>,
  args: string,
): QuestDebugResult {
  const parts = args.trim().split(/\s+/).filter(Boolean);
  const subcommand = (parts.shift() ?? "list").toLowerCase();

  if (subcommand === "list") {
    return {
      success: true,
      changed: false,
      messages: formatQuestStates(player),
    };
  }

  const questId = parseQuestId(parts.shift() ?? "");
  if (!questId) {
    return {
      success: false,
      changed: false,
      messages: [`Unknown quest ID. Available: ${QUEST_IDS.join(", ")}`],
    };
  }

  if (subcommand === "show") {
    const entry = buildQuestJournal(player).find((quest) => quest.id === questId);
    const progress = player.progression.quests.quests[questId];
    const definition = getQuestDefinition(questId);
    const messages = [
      `${questId}: ${progress.status}, stage ${progress.stage} (${definition.stages[progress.stage].title})`,
    ];
    if (entry) {
      messages.push(
        ...entry.objectives.map((objective) =>
          `${objective.complete ? "[x]" : "[ ]"} ${objective.description} ${objective.current}/${objective.required}`
        ),
      );
    }
    return { success: true, changed: false, messages };
  }

  let result: QuestProcessResult;
  if (subcommand === "start") {
    result = startQuestForDebug(player, defeatedBosses, questId);
  } else if (subcommand === "advance") {
    result = advanceQuestForDebug(player, defeatedBosses, questId);
  } else if (subcommand === "reset") {
    result = resetQuestForDebug(player, questId);
  } else if (subcommand === "complete") {
    result = completeQuestForDebug(player, defeatedBosses, questId);
  } else if (subcommand === "set") {
    const field = (parts.shift() ?? "").toLowerCase();
    const value = parts.shift() ?? "";
    if (field === "stage") {
      const stage = Number(value);
      const stageCount = getQuestDefinition(questId).stages.length;
      if (!Number.isInteger(stage) || stage < 0 || stage >= stageCount) {
        return {
          success: false,
          changed: false,
          messages: [`Stage must be an integer from 0 to ${stageCount - 1}.`],
        };
      }
      result = setQuestStageForDebug(player, defeatedBosses, questId, stage);
    } else if (field === "status") {
      const statuses: QuestStatus[] = ["inactive", "active", "completed"];
      if (!statuses.includes(value as QuestStatus)) {
        return {
          success: false,
          changed: false,
          messages: ["Status must be inactive, active, or completed."],
        };
      }
      result = setQuestStatusForDebug(
        player,
        defeatedBosses,
        questId,
        value as QuestStatus,
      );
    } else {
      return questDebugUsage();
    }
  } else {
    return questDebugUsage();
  }

  return {
    success: true,
    changed: result.changed,
    messages: result.updates.length > 0
      ? result.updates.map((update) => update.message)
      : [`No quest state changed for ${questId}.`],
  };
}

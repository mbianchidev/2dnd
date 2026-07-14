// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import {
  MAIN_QUEST_ID,
  QUEST_ITEM_IDS,
} from "../src/data/quests";
import { runQuestDebugCommand } from "../src/systems/questDebug";
import { createPlayer, type PlayerState } from "../src/systems/player";

function createTestPlayer(): PlayerState {
  return createPlayer("DebugHero", {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
  });
}

describe("quest debug commands", () => {
  it("lists every quest state", () => {
    const result = runQuestDebugCommand(
      createTestPlayer(),
      new Set(),
      "list",
    );

    expect(result.success).toBe(true);
    expect(result.changed).toBe(false);
    expect(result.messages.some((message) => message.startsWith(`${MAIN_QUEST_ID}:`))).toBe(true);
  });

  it("rejects unknown quest IDs and invalid stages", () => {
    const player = createTestPlayer();

    expect(runQuestDebugCommand(player, new Set(), "advance missingQuest").success).toBe(false);
    expect(runQuestDebugCommand(
      player,
      new Set(),
      `set ${MAIN_QUEST_ID} stage 99`,
    ).success).toBe(false);
  });

  it("sets and advances quest stages through production APIs", () => {
    const player = createTestPlayer();
    const defeatedBosses = new Set<string>();

    const setResult = runQuestDebugCommand(
      player,
      defeatedBosses,
      `set ${MAIN_QUEST_ID} stage 3`,
    );
    expect(setResult.success).toBe(true);
    expect(setResult.changed).toBe(true);
    expect(player.progression.quests.quests[MAIN_QUEST_ID].stage).toBe(3);

    const advanceResult = runQuestDebugCommand(
      player,
      defeatedBosses,
      `advance ${MAIN_QUEST_ID}`,
    );
    expect(advanceResult.success).toBe(true);
    expect(player.progression.quests.quests[MAIN_QUEST_ID].stage).toBe(4);
  });

  it("completes quests without duplicating durable rewards", () => {
    const player = createTestPlayer();
    const defeatedBosses = new Set<string>();

    runQuestDebugCommand(player, defeatedBosses, `complete ${MAIN_QUEST_ID}`);
    runQuestDebugCommand(player, defeatedBosses, `complete ${MAIN_QUEST_ID}`);

    expect(player.progression.quests.quests[MAIN_QUEST_ID].status).toBe("completed");
    expect(player.inventory.filter((item) => item.id === QUEST_ITEM_IDS.shadowSteed)).toHaveLength(1);
  });
});

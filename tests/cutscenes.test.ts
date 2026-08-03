import { describe, expect, it, vi } from "vitest";
import {
  CAMPAIGN_EPILOGUE_CUTSCENE,
  CAMPAIGN_EPILOGUE_CUTSCENE_ID,
} from "../src/data/cutscenes";
import { CutsceneDirector } from "../src/managers/cutscene";
import {
  buildCampaignEndingSummary,
  canReplayCampaignEpilogue,
  hasSeenCutscene,
  markCutsceneSeen,
  normalizeSeenCutsceneIds,
  shouldLaunchCampaignEpilogueAfterQuestUpdate,
  shouldShowCampaignEpilogue,
} from "../src/systems/cutscenes";
import { createCodex } from "../src/systems/codex";
import { recruitCompanion } from "../src/systems/party";
import { createPlayer } from "../src/systems/player";
import { setQuestState } from "../src/systems/questDebug";
import { MAIN_QUEST_ID } from "../src/data/quests";

function createTestPlayer() {
  return createPlayer("Ari", {
    strength: 10,
    dexterity: 12,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 12,
  }, "ranger");
}

describe("cutscene progression", () => {
  it("normalizes known IDs, removes duplicates, and rejects malformed entries", () => {
    expect(normalizeSeenCutsceneIds([
      CAMPAIGN_EPILOGUE_CUTSCENE_ID,
      "unknown.cutscene",
      CAMPAIGN_EPILOGUE_CUTSCENE_ID,
      42,
      null,
    ])).toEqual([CAMPAIGN_EPILOGUE_CUTSCENE_ID]);
    expect(normalizeSeenCutsceneIds("not-an-array")).toEqual([]);
  });

  it("marks a cutscene seen idempotently", () => {
    const player = createTestPlayer();

    expect(hasSeenCutscene(
      player.progression,
      CAMPAIGN_EPILOGUE_CUTSCENE_ID,
    )).toBe(false);
    expect(markCutsceneSeen(
      player.progression,
      CAMPAIGN_EPILOGUE_CUTSCENE_ID,
    )).toBe(true);
    expect(markCutsceneSeen(
      player.progression,
      CAMPAIGN_EPILOGUE_CUTSCENE_ID,
    )).toBe(false);
    expect(player.progression.seenCutsceneIds).toEqual([
      CAMPAIGN_EPILOGUE_CUTSCENE_ID,
    ]);
  });

  it("shows the automatic epilogue only for a completed unseen campaign", () => {
    const player = createTestPlayer();

    expect(shouldShowCampaignEpilogue(player)).toBe(false);
    setQuestState(player, MAIN_QUEST_ID, "completed");
    expect(shouldShowCampaignEpilogue(player)).toBe(true);
    expect(shouldLaunchCampaignEpilogueAfterQuestUpdate(false, player)).toBe(true);
    expect(shouldLaunchCampaignEpilogueAfterQuestUpdate(true, player)).toBe(false);
    expect(canReplayCampaignEpilogue(player)).toBe(false);

    markCutsceneSeen(player.progression, CAMPAIGN_EPILOGUE_CUTSCENE_ID);
    expect(shouldShowCampaignEpilogue(player)).toBe(false);
    expect(canReplayCampaignEpilogue(player)).toBe(true);
  });

  it("builds a presentation-only summary from existing campaign state", () => {
    const player = createTestPlayer();
    recruitCompanion(player, "guardian");
    player.progression.discoveredCities.push(
      "willowdale_city",
      "ironhold_city",
      "frostheim_city",
    );
    const defeatedBosses = new Set([
      "cryptLich",
      "frostWarden",
      "infernoForgemaster",
      "swampHydra",
      "dragon",
    ]);
    setQuestState(player, MAIN_QUEST_ID, 6, defeatedBosses);
    setQuestState(player, MAIN_QUEST_ID, "completed", defeatedBosses);
    const codex = createCodex();
    codex.entries.slime = {
      monsterId: "slime",
      name: "Slime",
      color: 0x44cc44,
      isBoss: false,
      timesDefeated: 1,
      acDiscovered: false,
      ac: 8,
      hp: 6,
      xpReward: 10,
      goldReward: 5,
      itemsDropped: [],
      discoveredElements: [],
    };
    const before = JSON.stringify(player);

    const summary = buildCampaignEndingSummary(player, defeatedBosses, codex);

    expect(summary.hero).toContain("Ari");
    expect(summary.hero).toContain("Ranger");
    expect(summary.party).toEqual([
      expect.stringContaining("Ari"),
      expect.stringContaining("Bram"),
    ]);
    expect(summary.rewards).toContain(
      "Gained 2000 XP for restoring the covenant.",
    );
    expect(summary.optionalBonuses).toEqual([
      "The marsh cities add 300 gold for ending the hydra threat.",
      "Gained 500 bonus XP for defeating the Young Red Dragon.",
    ]);
    expect(summary.campaignBosses).toEqual([
      "Crypt Lich",
      "Frost Warden",
      "Inferno Forgemaster",
    ]);
    expect(summary.discoveredCities).toEqual({ current: 3, total: 12 });
    expect(summary.codexEntries).toBe(1);
    expect(JSON.stringify(player)).toBe(before);
  });
});

describe("CutsceneDirector", () => {
  it("advances in order and completes once", () => {
    const onComplete = vi.fn();
    const director = new CutsceneDirector(
      CAMPAIGN_EPILOGUE_CUTSCENE,
      onComplete,
    );

    expect(director.currentStep).toBe(CAMPAIGN_EPILOGUE_CUTSCENE.steps[0]);
    for (let index = 1; index < CAMPAIGN_EPILOGUE_CUTSCENE.steps.length; index++) {
      expect(director.advance()).toBe(false);
      expect(director.currentStep).toBe(
        CAMPAIGN_EPILOGUE_CUTSCENE.steps[index],
      );
    }
    expect(director.advance()).toBe(true);
    expect(director.completed).toBe(true);
    expect(director.advance()).toBe(false);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("skips and resets without duplicating completion", () => {
    const onComplete = vi.fn();
    const director = new CutsceneDirector(
      CAMPAIGN_EPILOGUE_CUTSCENE,
      onComplete,
    );

    expect(director.skip()).toBe(true);
    expect(director.skip()).toBe(false);
    expect(onComplete).toHaveBeenCalledTimes(1);

    director.reset();
    expect(director.completed).toBe(false);
    expect(director.currentStep).toBe(CAMPAIGN_EPILOGUE_CUTSCENE.steps[0]);
    expect(director.skip()).toBe(true);
    expect(onComplete).toHaveBeenCalledTimes(2);
  });
});

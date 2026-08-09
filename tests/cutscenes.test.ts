import { describe, expect, it, vi } from "vitest";
import {
  BOSS_CUTSCENES,
  CAMPAIGN_EPILOGUE_CUTSCENE,
  CAMPAIGN_EPILOGUE_CUTSCENE_ID,
  CUTSCENE_IDS,
  MAIN_QUEST_STAGE_CUTSCENES,
  getCutsceneDefinition,
} from "../src/data/cutscenes";
import { ALL_MONSTERS } from "../src/data/monsters";
import { CutsceneDirector } from "../src/managers/cutscene";
import {
  buildCampaignEndingSummary,
  canReplayCampaignEpilogue,
  captureCutsceneTriggerSnapshot,
  collectNewlyTriggeredCutsceneIds,
  completeCutscene,
  getChronicleCutscenes,
  getEventCutsceneIds,
  getNewGameCutsceneIds,
  getNextPendingCutscene,
  hasSeenCutscene,
  markCutsceneSeen,
  normalizePendingCutsceneIds,
  normalizeSeenCutsceneIds,
  queueCutscenes,
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
    expect(normalizePendingCutsceneIds([
      "campaign.opening",
      "unknown.cutscene",
      "campaign.opening",
      CAMPAIGN_EPILOGUE_CUTSCENE_ID,
    ], ["campaign.opening"])).toEqual([
      CAMPAIGN_EPILOGUE_CUTSCENE_ID,
    ]);
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

  it("queues, resumes, and completes cutscenes idempotently", () => {
    const player = createTestPlayer();

    expect(queueCutscenes(player.progression, [
      "campaign.opening",
      "campaign.opening",
      MAIN_QUEST_STAGE_CUTSCENES.firstSeal,
    ])).toEqual([
      "campaign.opening",
      MAIN_QUEST_STAGE_CUTSCENES.firstSeal,
    ]);
    expect(getNextPendingCutscene(player.progression)).toBe("campaign.opening");
    expect(completeCutscene(player.progression, "campaign.opening")).toBe(true);
    expect(player.progression.pendingCutsceneIds).toEqual([
      MAIN_QUEST_STAGE_CUTSCENES.firstSeal,
    ]);
    expect(player.progression.seenCutsceneIds).toEqual(["campaign.opening"]);
    expect(queueCutscenes(player.progression, ["campaign.opening"])).toEqual([]);
  });

  it("orders new-game and simultaneous campaign triggers deterministically", () => {
    const player = createTestPlayer();
    const defeatedBosses = new Set<string>();

    expect(getNewGameCutsceneIds(player, defeatedBosses)).toEqual([
      "campaign.opening",
      MAIN_QUEST_STAGE_CUTSCENES.firstSeal,
    ]);

    const before = captureCutsceneTriggerSnapshot(player, defeatedBosses);
    defeatedBosses.add("infernoForgemaster");
    setQuestState(player, MAIN_QUEST_ID, "completed", defeatedBosses);
    const triggered = collectNewlyTriggeredCutsceneIds(
      before,
      captureCutsceneTriggerSnapshot(player, defeatedBosses),
    );

    expect(triggered.indexOf(BOSS_CUTSCENES.infernoForgemaster.post))
      .toBeLessThan(triggered.indexOf("campaign.keystone.forge"));
    expect(triggered.indexOf("campaign.keystone.forge"))
      .toBeLessThan(triggered.indexOf("campaign.route.volcanicForge"));
    expect(triggered.indexOf("campaign.route.volcanicForge"))
      .toBeLessThan(triggered.indexOf(MAIN_QUEST_STAGE_CUTSCENES.lastForge));
    expect(triggered.indexOf(MAIN_QUEST_STAGE_CUTSCENES.lastForge))
      .toBeLessThan(triggered.indexOf(CAMPAIGN_EPILOGUE_CUTSCENE_ID));
  });

  it("defines pre/post scenes for every boss and starts pre-scenes from events", () => {
    const bossIds = ALL_MONSTERS
      .filter((monster) => monster.isBoss)
      .map((monster) => monster.id)
      .sort();

    expect(Object.keys(BOSS_CUTSCENES).sort()).toEqual(bossIds);
    for (const bossId of bossIds) {
      const mapping = BOSS_CUTSCENES[bossId]!;
      const pre = getCutsceneDefinition(mapping.pre);
      const post = getCutsceneDefinition(mapping.post);
      expect(pre.completion).toMatchObject({
        type: "bossBattle",
        bossId,
      });
      expect(post.category).toBe("bossPost");
      expect(getEventCutsceneIds({ type: "bossPre", bossId })).toEqual([
        mapping.pre,
      ]);
    }
  });

  it("exposes exactly one validated definition for every stable ID", () => {
    expect(new Set(CUTSCENE_IDS).size).toBe(CUTSCENE_IDS.length);
    expect(CUTSCENE_IDS).toHaveLength(54);
    for (const cutsceneId of CUTSCENE_IDS) {
      const definition = getCutsceneDefinition(cutsceneId);
      expect(definition.id).toBe(cutsceneId);
      expect(definition.steps.length).toBeGreaterThan(0);
    }
  });

  it("lists only seen Chronicle entries without mutating progression", () => {
    const player = createTestPlayer();
    player.progression.seenCutsceneIds.push(
      "campaign.opening",
      BOSS_CUTSCENES.dragon.pre,
    );
    player.progression.pendingCutsceneIds.push(
      MAIN_QUEST_STAGE_CUTSCENES.firstSeal,
    );
    const before = JSON.stringify(player.progression);

    expect(getChronicleCutscenes(player.progression).map(({ id }) => id))
      .toEqual([
        "campaign.opening",
        BOSS_CUTSCENES.dragon.pre,
      ]);
    expect(JSON.stringify(player.progression)).toBe(before);
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
    expect(summary.discoveredCities).toEqual({ current: 3, total: 13 });
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

  it("locks input until presentation completes and ignores stale callbacks", () => {
    const readyCallbacks: Array<() => void> = [];
    const adapter = {
      present: vi.fn((_step, _index, onReady: () => void) => {
        readyCallbacks.push(onReady);
      }),
      reset: vi.fn(),
      cleanup: vi.fn(),
    };
    const director = new CutsceneDirector(
      getCutsceneDefinition("campaign.opening"),
      vi.fn(),
      adapter,
    );

    expect(director.inputLocked).toBe(true);
    expect(director.advance()).toBe(false);
    readyCallbacks[0]!();
    expect(director.inputLocked).toBe(false);
    expect(director.advance()).toBe(false);
    expect(director.inputLocked).toBe(true);
    readyCallbacks[0]!();
    expect(director.inputLocked).toBe(true);
    readyCallbacks[1]!();
    expect(director.inputLocked).toBe(false);

    director.destroy();
    expect(adapter.cleanup).toHaveBeenCalledTimes(1);
    expect(director.advance()).toBe(false);
  });
});

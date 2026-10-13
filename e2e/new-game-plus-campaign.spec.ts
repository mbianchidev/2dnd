import { expect, test } from "@playwright/test";
import { CAMPAIGN_EPILOGUE_CUTSCENE_ID } from "../src/data/cutscenes";
import { QUEST_NPCS } from "../src/data/quests";
import { clickLayoutItem } from "./helpers/layout";
import { createJourneySource, holdJourneyKey, playCanonicalNgCampaign, readJourneySave } from "./helpers/ngJourney";
import type { DifficultySelection } from "../src/systems/difficulty";

const journeys: Array<{ selection: DifficultySelection; parentCycle: number }> = [
  { selection: { profileId: "standard" }, parentCycle: 0 },
  { selection: { profileId: "story" }, parentCycle: 4 },
  { selection: { profileId: "veteran" }, parentCycle: 1 },
  { selection: { profileId: "legendary" }, parentCycle: 98 },
  { selection: { profileId: "custom", overrides: {
    enemyHpPercent: 115, enemyDamagePercent: 120, enemyAiPolicy: "tactical",
    encounterPressurePercent: 110, pricePercent: 110, xpRewardPercent: 125, goldRewardPercent: 90,
  } }, parentCycle: 2 },
];

for (const journeyCase of journeys) {
test(`${journeyCase.selection.profileId} NG+ ${journeyCase.parentCycle + 1} plays every chapter, actual keystone and final Elowen`, async ({ page }) => {
  test.setTimeout(480_000);
  const source = JSON.stringify(createJourneySource(journeyCase.selection, journeyCase.parentCycle));
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.addInitScript((raw) => {
    let seed = 0x172ca;
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x1_0000_0000;
    };
    if (!sessionStorage.getItem("ng-journey-initialized")) {
      localStorage.clear();
      localStorage.setItem("2dnd_save_slot_manual-1", raw);
      localStorage.setItem("2dnd_save_slots_migrated_v1", "verified");
      localStorage.setItem("2dnd_preferences", JSON.stringify({
        version: 3, accessibility: { reducedMotion: true },
      }));
      sessionStorage.setItem("ng-journey-initialized", "true");
    }
  }, source);
  await page.goto("game.html", { waitUntil: "networkidle" });
  await clickLayoutItem(page, "title-new-game-plus");
  await clickLayoutItem(page, "save-slot-row-manual-1");
  await clickLayoutItem(page, "save-slot-action-confirm");
  await clickLayoutItem(page, "save-slot-action-confirm");
  await expect(page.locator("#debug-state")).toContainText("[NG_PLUS:preview]");
  await clickLayoutItem(page, "save-slot-action-confirm");
  const journey = await playCanonicalNgCampaign(page);
  const completed = await readJourneySave(page);
  expect(completed.player.progression.quests.quests.twelvefoldCovenant.status).toBe("completed");
  expect(completed.defeatedBosses).toEqual(expect.arrayContaining(["cryptLich", "frostWarden", "infernoForgemaster"]));
  expect(new Set(journey.talkNpcIds.map((id) =>
    Object.values(QUEST_NPCS).find((npc) => npc.id === id)?.cityId,
  )).size).toBe(12);
  expect(journey.defeatedBossIds).toEqual(["cryptLich", "frostWarden", "infernoForgemaster"]);
  expect(completed.player.progression.pendingCutsceneIds).toContain(CAMPAIGN_EPILOGUE_CUTSCENE_ID);
  expect(await page.evaluate(() => localStorage.getItem("2dnd_save_slot_manual-1"))).toBe(source);
  await page.waitForTimeout(400);
  await holdJourneyKey(page, "Escape");
  await expect(page.locator("#debug-state")).toContainText("ENDING | Choices");
  await holdJourneyKey(page, "Enter");
  await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
  expect((await readJourneySave(page)).player.progression.seenCutsceneIds).toContain(CAMPAIGN_EPILOGUE_CUTSCENE_ID);
  await page.reload({ waitUntil: "networkidle" });
  await clickLayoutItem(page, "title-continue");
  await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
  expect((await readJourneySave(page)).player.newGamePlus?.cycle).toBe(journeyCase.parentCycle + 1);
  expect(await page.evaluate(() => localStorage.getItem("2dnd_save_slot_manual-1"))).toBe(source);
  expect(errors).toEqual([]);
});
}

import { expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CAMPAIGN_EPILOGUE_CUTSCENE_ID } from "../src/data/cutscenes";
import { QUEST_NPCS } from "../src/data/quests";
import { clickLayoutItem, expectCleanLayout } from "../e2e/helpers/layout";
import { createJourneySource, drainJourneyScenes, holdJourneyKey, playCanonicalNgCampaign, readJourneySave, stepJourneySouth } from "../e2e/helpers/ngJourney";
import { createIslandVoyage } from "../tests/helpers/campaign";
import { closeDesktop, launchDesktop, monitorRendererErrors, waitForState } from "./helpers/desktop";
import type { SaveData } from "../src/systems/save";

async function selectNativeFixtureSlot(page: Page, slotId: "manual-1" | "manual-2"): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt++) {
    if ((await page.locator("#debug-state").textContent())?.includes(`[SAVE_SLOT:${slotId}]`)) return;
    await holdJourneyKey(page, "ArrowDown");
  }
  throw new Error(`Could not select ${slotId} through the measured slot pager`);
}

async function importNativeFixture(
  page: Page,
  slotId: "manual-1" | "manual-2",
  name: string,
  save: SaveData,
): Promise<void> {
  await selectNativeFixtureSlot(page, slotId);
  const chooser = page.waitForEvent("filechooser");
  await clickLayoutItem(page, "save-slot-action-import");
  await (await chooser).setFiles({
    name: "mock-covenant.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ format: "2dnd-save-slot", formatVersion: 1, name, save })),
  });
  await expect(page.locator("#save-slot-live-region")).toContainText(name);
}

test("compiled app imports a completed source and plays the full independent NG+ covenant to its ending", async () => {
  test.setTimeout(480_000);
  const directory = await mkdtemp(join(tmpdir(), "2dnd-ng-plus-test-"));
  let desktop: ElectronApplication | undefined;
  try {
    const save = createJourneySource({ profileId: "standard" });
    desktop = await launchDesktop(directory);
    const page = await desktop.firstWindow();
    const errors = monitorRendererErrors(page);
    await waitForState(page, "BOOT | Screen: title");
    expect(await page.evaluate(() => location.origin)).toBe("app://2dnd");
    await clickLayoutItem(page, "title-save-slots");
    await importNativeFixture(page, "manual-1", "Mock completed covenant", save);
    const source = await page.evaluate(() => localStorage.getItem("2dnd_save_slot_manual-1"));
    if (!source) throw new Error("Native import did not create the protected fixture");
    await page.evaluate(() => {
      localStorage.setItem("2dnd_preferences", JSON.stringify({
        version: 3, accessibility: { reducedMotion: true },
      }));
    });

    await page.reload({ waitUntil: "networkidle" });
    await clickLayoutItem(page, "title-new-game-plus");
    await clickLayoutItem(page, "save-slot-row-manual-1");
    await clickLayoutItem(page, "save-slot-action-confirm");
    await clickLayoutItem(page, "save-slot-action-confirm");
    await waitForState(page, "[NG_PLUS:preview]");
    await clickLayoutItem(page, "save-slot-action-confirm");
    const journey = await playCanonicalNgCampaign(page);
    expect(new Set(journey.talkNpcIds.map((id) =>
      Object.values(QUEST_NPCS).find((npc) => npc.id === id)?.cityId,
    )).size).toBe(12);
    expect(journey.defeatedBossIds).toEqual(["cryptLich", "frostWarden", "infernoForgemaster"]);
    const completed = await readJourneySave(page);
    expect(completed.player.progression.quests.quests.twelvefoldCovenant.status).toBe("completed");
    expect(completed.player.newGamePlus?.cycle).toBe(1);
    expect(await page.evaluate(() => localStorage.getItem("2dnd_save_slot_manual-1"))).toBe(source);
    await page.waitForTimeout(400);
    await holdJourneyKey(page, "Escape");
    await waitForState(page, "ENDING | Choices");
    await holdJourneyKey(page, "Enter");
    await waitForState(page, "OVERWORLD");
    expect((await readJourneySave(page)).player.progression.seenCutsceneIds).toContain(CAMPAIGN_EPILOGUE_CUTSCENE_ID);
    expect(errors).toEqual([]);
    await closeDesktop(desktop);
    desktop = await launchDesktop(directory);
    const continued = await desktop.firstWindow();
    const reloadErrors = monitorRendererErrors(continued);
    await waitForState(continued, "BOOT | Screen: title");
    await expectCleanLayout(continued);
    await clickLayoutItem(continued, "title-continue");
    await waitForState(continued, "OVERWORLD");
    expect((await readJourneySave(continued)).player.newGamePlus?.cycle).toBe(1);
    expect(await continued.evaluate(() => localStorage.getItem("2dnd_save_slot_manual-1"))).toBe(source);
    expect(reloadErrors).toEqual([]);
  } finally {
    try {
      if (desktop) await closeDesktop(desktop);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
});

test("compiled app lands on the NG+ secret island and preserves its interior and source across relaunch", async () => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(join(tmpdir(), "2dnd-ng-island-test-"));
  let desktop: ElectronApplication | undefined;
  try {
    const fixture = createIslandVoyage();
    desktop = await launchDesktop(directory);
    const page = await desktop.firstWindow();
    const errors = monitorRendererErrors(page);
    await waitForState(page, "BOOT | Screen: title");
    expect(await page.evaluate(() => location.origin)).toBe("app://2dnd");
    await clickLayoutItem(page, "title-save-slots");
    await importNativeFixture(page, "manual-1", "Mock protected source", fixture.source);
    const source = await page.evaluate(() => localStorage.getItem("2dnd_save_slot_manual-1"));
    await importNativeFixture(page, "manual-2", "Mock NG island voyage", fixture.voyage);
    await page.addInitScript(() => {
      let seed = 0x172a;
      Math.random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return 0.8 + seed / 0x1_0000_0000 * 0.19;
      };
    });
    await page.evaluate(() => localStorage.setItem("2dnd_preferences", JSON.stringify({
      version: 3, accessibility: { textScale: 1.5, highContrast: true, reducedMotion: true },
    })));
    await page.reload({ waitUntil: "networkidle" });
    await clickLayoutItem(page, "title-save-slots");
    await selectNativeFixtureSlot(page, "manual-2");
    await clickLayoutItem(page, "save-slot-action-load");
    await drainJourneyScenes(page);
    await stepJourneySouth(page, "Pos: (12,1)");
    await holdJourneyKey(page, "Space");
    await waitForState(page, "[CITY:starfall_atoll:0]");
    const landed = await readJourneySave(page);
    expect(landed.player.progression.nautical.discoveredIslandIds).toContain("starfallAtoll");
    expect(landed.codex.unlockedEntryIds).toContain("locationStarfallAtoll");
    expect(landed.player.progression.nautical.ownedBoats[0]?.condition).toBe(47);
    expect(await page.evaluate(() => localStorage.getItem("2dnd_save_slot_manual-1"))).toBe(source);
    await expectCleanLayout(page);
    expect(errors).toEqual([]);
    await closeDesktop(desktop);
    desktop = await launchDesktop(directory);
    const continued = await desktop.firstWindow();
    const reloadErrors = monitorRendererErrors(continued);
    await waitForState(continued, "BOOT | Screen: title");
    await expectCleanLayout(continued);
    await clickLayoutItem(continued, "title-continue");
    await waitForState(continued, "[CITY:starfall_atoll:0]");
    expect((await readJourneySave(continued)).player.progression.nautical.ownedBoats[0]?.condition).toBe(47);
    expect(await continued.evaluate(() => localStorage.getItem("2dnd_save_slot_manual-1"))).toBe(source);
    expect(reloadErrors).toEqual([]);
  } finally {
    try {
      if (desktop) await closeDesktop(desktop);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
});

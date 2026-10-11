import { expect, test, type ElectronApplication } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPlayer, awardXP, processPendingLevelUps, xpForLevel } from "../src/systems/player";
import { prepareHeroLevelUp } from "../src/systems/classProgression";
import { createCurrentSaveData, SAVE_VERSION } from "../src/systems/save";
import { createCodex } from "../src/systems/codex";
import { CUTSCENE_IDS, CAMPAIGN_EPILOGUE_CUTSCENE_ID } from "../src/data/cutscenes";
import { createWeatherState } from "../src/systems/weather";
import { closeDesktop, holdKey, launchDesktop, monitorRendererErrors, waitForState } from "./helpers/desktop";
import type { SaveData } from "../src/systems/save";

test("Electron imports a rested hero, commits a prestige rank and preserves the source on relaunch", async () => {
  const directory = await mkdtemp(join(tmpdir(), "2dnd-prestige-test-"));
  let desktop: ElectronApplication | undefined;
  try {
    const hero = createPlayer("Prestige desktop fixture", {
      strength: 10, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 15, charisma: 8,
    }, "druid");
    awardXP(hero, xpForLevel(6));
    processPendingLevelUps(hero);
    hero.progression.tutorial.completed = true;
    hero.progression.seenCutsceneIds = CUTSCENE_IDS.filter((id) => id !== CAMPAIGN_EPILOGUE_CUTSCENE_ID);
    hero.progression.pendingCutsceneIds = [];
    hero.progression.discoveredCities = ["deeproot_city"];
    awardXP(hero, xpForLevel(7) - hero.xp);
    const prepared = prepareHeroLevelUp(hero, () => 0.5);
    if (!prepared.ok) throw new Error(prepared.message);
    const save = createCurrentSaveData(hero, new Set(), createCodex(), hero.appearanceId, 0, createWeatherState());
    desktop = await launchDesktop(directory);
    const page = await desktop.firstWindow();
    const errors = monitorRendererErrors(page);
    await waitForState(page, "BOOT | Screen: title");
    expect(await page.evaluate(() => location.origin)).toBe("app://2dnd");
    await holdKey(page, "l");
    await holdKey(page, "ArrowDown");
    await waitForState(page, "[SAVE_SLOT:manual-1]");
    const chooser = page.waitForEvent("filechooser");
    await holdKey(page, "Enter");
    await (await chooser).setFiles({
      name: "mock-prestige-campaign.json", mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ format: "2dnd-save-slot", formatVersion: 1, name: "Mock prestige", save })),
    });
    await expect(page.locator("#save-slot-live-region")).toContainText("Mock prestige");
    const source = await page.evaluate(() => localStorage.getItem("2dnd_save_slot_manual-1"));
    for (let attempt = 0; attempt < 8; attempt++) {
      if ((await page.locator("#debug-state").textContent())?.includes("[SAVE_ACTION:load]")) break;
      await holdKey(page, "ArrowRight", 80);
    }
    await waitForState(page, "[SAVE_ACTION:load]");
    await holdKey(page, "Enter");
    await waitForState(page, "[PROGRESSION:level");
    for (let index = 0; index < 18; index++) {
      const state = await page.locator("#debug-state").textContent() ?? "";
      if (state.includes("Track:prestige:rootwakeKeeper ")) break;
      await holdKey(page, "ArrowDown", 80);
    }
    await waitForState(page, "Track:prestige:rootwakeKeeper");
    await holdKey(page, "Enter");
    await waitForState(page, "[PROGRESSION:result");
    const committed = await page.evaluate(() => {
      const raw = localStorage.getItem("2dnd_save");
      if (!raw) throw new Error("Missing desktop prestige autosave");
      return JSON.parse(raw) as SaveData;
    });
    expect(committed.version).toBe(SAVE_VERSION);
    expect(committed.player.level).toBe(7);
    expect(committed.player.classProgression.trackLevels).toEqual({ "prestige:rootwakeKeeper": 1 });
    expect(committed.player.classProgression.pendingLevel).toBeNull();
    expect(committed.player.classProgression.readyLevelUps).toBe(0);
    expect(committed.player.stats).toEqual(hero.stats);
    expect(await page.evaluate(() => localStorage.getItem("2dnd_save_slot_manual-1"))).toBe(source);
    expect(errors).toEqual([]);
    await closeDesktop(desktop);
    desktop = await launchDesktop(directory);
    const reloaded = await desktop.firstWindow();
    const reloadErrors = monitorRendererErrors(reloaded);
    await waitForState(reloaded, "BOOT | Screen: title");
    await holdKey(reloaded, "Enter");
    await waitForState(reloaded, "OVERWORLD");
    const continued = await reloaded.evaluate(() => {
      const raw = localStorage.getItem("2dnd_save");
      if (!raw) throw new Error("Missing relaunched prestige campaign");
      return JSON.parse(raw) as SaveData;
    });
    expect(continued.player.classProgression).toEqual(committed.player.classProgression);
    expect(continued.player.maxHp).toBe(committed.player.maxHp);
    expect(continued.player.maxMp).toBe(committed.player.maxMp);
    expect(await reloaded.evaluate(() => localStorage.getItem("2dnd_save_slot_manual-1"))).toBe(source);
    expect(reloadErrors).toEqual([]);
  } finally {
    try {
      if (desktop) await closeDesktop(desktop);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
});

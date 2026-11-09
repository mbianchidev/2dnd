import { expect, test } from "@playwright/test";
import { SAVE_VERSION } from "../src/systems/save";
import { getCity, getCityChunk, getCityConnectionAt } from "../src/data/map";
import { CUTSCENE_IDS } from "../src/data/cutscenes";
import { FEATURE_IDS } from "../src/data/featureDiscovery";
import { pressGameKey, stepGameTile } from "./helpers/input";
import { clickLayoutItem, expectCleanLayout, waitForGameInputFrame } from "./helpers/layout";
import { minigameBrowserErrors, minigameFixture, seedMinigamePage } from "./helpers/minigames";

for (const textScale of [1, 1.25, 1.5] as const) {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 844, height: 390 }]) {
    test(`customize every cosmetic category at ${textScale * 100}% in ${viewport.width}x${viewport.height}`, async ({ page }) => {
      const errors = minigameBrowserErrors(page);
      await page.setViewportSize(viewport);
      await page.addInitScript((scale) => {
        localStorage.setItem("2dnd_preferences", JSON.stringify({
          version: 3, accessibility: { textScale: scale, highContrast: false, reducedMotion: true },
        }));
      }, textScale);
      await page.goto("game.html", { waitUntil: "domcontentloaded" });
      await page.locator("#debug-checkbox").check();
      await clickLayoutItem(page, "title-new-game");
      await clickLayoutItem(page, "creation-class-wizard");
      await expectCleanLayout(page);
      await clickLayoutItem(page, "creation-class-next");
      await clickLayoutItem(page, "creation-stat-mode-random");
      await expectCleanLayout(page);
      await clickLayoutItem(page, "creation-stats-next");
      await expect(page.locator("#debug-state")).toContainText("Screen: appearance");
      const rows = [
        ["skin", "hair-style", "hair-color"], ["eyes", "facial-hair", "build"],
        ["outfit", "trousers", "accent"], ["accessory", "headwear", "facing"],
      ];
      for (const [index, category] of rows.entries()) {
        if (index > 0) await pressGameKey(page, "Tab");
        await expect(page.locator("#debug-state")).toContainText(`[APPEARANCE_PAGE:${index}]`);
        for (const row of category) {
          await clickLayoutItem(page, `appearance-${row}-next`);
          await waitForGameInputFrame(page);
          await expectCleanLayout(page);
        }
        const path = test.info().outputPath(`appearance-${index}.png`);
        await page.locator("#game-container").screenshot({ path });
        await test.info().attach(`appearance-${index}`, { path, contentType: "image/png" });
      }
      await clickLayoutItem(page, "appearance-start");
      await expect(page.locator("#debug-state")).toContainText("CUTSCENE");
      const save = await page.evaluate(() => JSON.parse(localStorage.getItem("2dnd_save")!));
      expect(save.version).toBe(SAVE_VERSION);
      expect(save.player.classProgression.startingClassId).toBe("wizard");
      expect(save.player.customAppearance).toMatchObject({
        hairStyle: 1, facialHair: 1, bodyBuild: "broad", accessory: "spectacles", headwear: false,
      });
      expect(save.player.customAppearance).not.toHaveProperty("facing");
      await expectCleanLayout(page);
      expect(errors).toEqual([]);
    });
  }
}

test("full-size street facades have real doors, while boarded residences cannot be entered", async ({ page }) => {
  const errors = minigameBrowserErrors(page);
  const city = getCity("willowdale_city")!;
  const street = getCityChunk(city, 1)!;
  const library = street.buildings!.find((building) => building.kind === "library")!;
  const closed = street.buildings!.find((building) => building.kind === "residence")!;
  const fixture = minigameFixture("willowdaleRange");
  fixture.player.progression.seenCutsceneIds = [...CUTSCENE_IDS];
  fixture.player.progression.pendingCutsceneIds = [];
  Object.assign(fixture.player.position, {
    cityId: city.id, inCity: true, cityChunkIndex: 1, x: library.door!.x, y: library.door!.y + 1,
  });
  await page.goto("game.html", { waitUntil: "domcontentloaded" });
  await seedMinigamePage(page, fixture, "keyboard", { textScale: 1.5, reducedMotion: true });
  await expectCleanLayout(page);
  const streetPath = test.info().outputPath("city-facades-150.png");
  await page.locator("#game-container").screenshot({ path: streetPath });
  await test.info().attach("City facades", { path: streetPath, contentType: "image/png" });
  await stepGameTile(page, "W", library.door!.x, library.door!.y);
  await pressGameKey(page, "Space");
  const connection = getCityConnectionAt(city, 1, library.door!.x, library.door!.y)!;
  await expect(page.locator("#debug-state")).toContainText(`[CITY:${city.id}:${connection.toChunkIndex}]`);
  await expectCleanLayout(page);
  await stepGameTile(page, "S", 10, 13);
  await pressGameKey(page, "Space");
  await expect(page.locator("#debug-state")).toContainText(`[CITY:${city.id}:1]`);
  Object.assign(fixture.player.position, { x: closed.x + 1, y: closed.y + closed.height });
  await seedMinigamePage(page, fixture, "keyboard", { textScale: 1.5, reducedMotion: true });
  await pressGameKey(page, "W");
  await expect(page.locator("#debug-state")).toContainText(`Pos: (${closed.x + 1},${closed.y + closed.height})`);
  await pressGameKey(page, "Space");
  await expect(page.locator("#debug-state")).toContainText(`[CITY:${city.id}:1]`);
  expect(errors).toEqual([]);
});

for (const textScale of [1, 1.25, 1.5] as const) {
  test(`menu icons, spatial navigation and inventory use clean ${textScale * 100}% panels`, async ({ page }) => {
    const errors = minigameBrowserErrors(page);
    const fixture = minigameFixture("willowdaleRange");
    fixture.player.progression.seenCutsceneIds = [...CUTSCENE_IDS];
    fixture.player.progression.pendingCutsceneIds = [];
    fixture.player.progression.debugDiscoveredFeatureIds = [...FEATURE_IDS];
    await page.goto("game.html", { waitUntil: "domcontentloaded" });
    await seedMinigamePage(page, fixture, "keyboard", { textScale, reducedMotion: true });
    await pressGameKey(page, "Escape");
    await expect(page.locator("#layout-report")).toContainText("escape-menu-icon-inventory");
    await expectCleanLayout(page);
    const path = test.info().outputPath(`adventure-menu-${textScale * 100}.png`);
    await page.locator("#game-container").screenshot({ path });
    await test.info().attach("Adventure menu", { path, contentType: "image/png" });
    await pressGameKey(page, "ArrowRight");
    await pressGameKey(page, "Enter");
    await expect(page.locator("#debug-state")).toContainText("[PARTY:items");
    await expectCleanLayout(page);
    await pressGameKey(page, "Escape");
    await pressGameKey(page, "Escape");
    await clickLayoutItem(page, "escape-menu-resume");
    await pressGameKey(page, "Escape");
    await pressGameKey(page, "ArrowDown");
    await pressGameKey(page, "Enter");
    await expect(page.locator("#debug-state")).toContainText("[PARTY:status]");
    await expectCleanLayout(page);
    expect(errors).toEqual([]);
  });
}

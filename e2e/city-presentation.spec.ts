import { expect, test, type Page } from "@playwright/test";
import { CUTSCENE_IDS } from "../src/data/cutscenes";
import { getCity, getCityChunkCount, getCityChunkMap, isWalkable, MAP_HEIGHT, MAP_WIDTH } from "../src/data/map";
import { getMinigameVenue } from "../src/data/minigames";
import { getMonster } from "../src/data/monsters";
import { getMonsterTextureKey } from "../src/data/monsterFamilies";
import { reconcileFeatureDiscovery } from "../src/systems/featureDiscovery";
import { expectCleanLayout, tapLayoutItem, waitForGameInputFrame } from "./helpers/layout";
import { pressGameKey } from "./helpers/input";
import {
  continueMinigameFixture, minigameBrowserErrors, minigameFixture,
  readMinigameSave, seedMinigamePage,
} from "./helpers/minigames";

test.use({ hasTouch: true });

async function debugCommand(page: Page, command: string): Promise<void> {
  const checkbox = page.locator("#debug-checkbox");
  if (!await checkbox.isChecked()) await checkbox.check();
  const input = page.locator("#debug-cmd");
  if (await input.isVisible()) {
    await input.fill(command);
    await input.press("Enter");
    await input.blur();
  } else {
    await input.evaluate((element, value) => {
      if (!(element instanceof HTMLInputElement)) throw new Error("Missing debug input.");
      element.value = value;
      element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
      element.blur();
    }, command);
  }
  await waitForGameInputFrame(page);
}

async function capture(page: Page, name: string): Promise<void> {
  const path = test.info().outputPath(`${name}.png`);
  await page.screenshot({ path });
  await test.info().attach(name, { path, contentType: "image/png" });
}

test("entering and reloading a city reveals all districts without changing other location fog", async ({ page }) => {
  const errors = minigameBrowserErrors(page);
  await page.goto("game.html", { waitUntil: "domcontentloaded" });
  const fixture = minigameFixture("willowdaleRange");
  const city = getCity("willowdale_city")!;
  fixture.player.progression.seenCutsceneIds = [...CUTSCENE_IDS];
  fixture.player.progression.exploredTiles = {
    "d:heartlands_dungeon,1,3,4": true,
    "c:ironhold_city,2,2": true,
  };
  Object.assign(fixture.player.position, {
    inCity: false, cityId: "", cityChunkIndex: 0, x: city.tileX, y: city.tileY,
  });
  await seedMinigamePage(page, fixture, "keyboard");
  await pressGameKey(page, "Space");
  await expect(page.locator("#debug-state")).toContainText("[CITY:willowdale_city:0]");
  const saved = await readMinigameSave(page);
  for (let district = 0; district < getCityChunkCount(city); district++) {
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const key = district === 0 ? `c:${city.id},${x},${y}` : `c:${city.id},${district},${x},${y}`;
        expect(saved.player.progression.exploredTiles[key], key).toBe(true);
      }
    }
  }
  expect(Object.keys(saved.player.progression.exploredTiles)
    .filter((key) => key.startsWith("c:ironhold_city"))).toEqual(["c:ironhold_city,2,2"]);
  expect(saved.player.progression.exploredTiles["d:heartlands_dungeon,1,3,4"]).toBe(true);
  await expectCleanLayout(page);
  await capture(page, "fully-revealed-city-and-activity-props");
  await page.reload({ waitUntil: "domcontentloaded" });
  await continueMinigameFixture(page);
  await expect(page.locator("#debug-state")).toContainText("[CITY:willowdale_city:0]");
  expect((await readMinigameSave(page)).player.progression.exploredTiles)
    .toEqual(saved.player.progression.exploredTiles);
  expect(errors).toEqual([]);
});

for (const venueId of ["willowdaleRange", "willowInnTable"] as const) {
  test(`${venueId} opens directly from its world prop at 150% touch text`, async ({ page }) => {
    const errors = minigameBrowserErrors(page);
    await page.goto("game.html", { waitUntil: "domcontentloaded" });
    const fixture = minigameFixture(venueId);
    const venue = getMinigameVenue(venueId);
    const map = getCityChunkMap(getCity(venue.cityId)!, venue.cityChunkIndex);
    const approach = [
      { x: venue.x - 1, y: venue.y }, { x: venue.x + 1, y: venue.y },
      { x: venue.x, y: venue.y - 1 }, { x: venue.x, y: venue.y + 1 },
    ].find(({ x, y }) => {
      const terrain = map[y]?.[x];
      return terrain !== undefined && isWalkable(terrain);
    });
    if (!approach) throw new Error("No walkable activity-prop approach.");
    Object.assign(fixture.player.position, approach);
    fixture.player.progression.seenCutsceneIds = [...CUTSCENE_IDS];
    fixture.player.progression.exploredTiles = {};
    fixture.player.progression.minigames.discoveredVenueIds = [venueId];
    reconcileFeatureDiscovery(fixture.player, fixture.codex, { silent: true });
    await seedMinigamePage(page, fixture, "touch", { textScale: 1.5 });
    await page.setViewportSize({ width: 932, height: 430 });
    await expectCleanLayout(page);
    await capture(page, `${venueId}-world-prop`);
    await tapLayoutItem(page, `minigame-venue-${venueId}`);
    await expect(page.locator("#debug-state")).toContainText(`[MINIGAME_VENUE:${venueId}]`);
    await expect(page.locator("#debug-state")).toContainText("[MINIGAME_VIEW:lobby]");
    expect((await readMinigameSave(page)).player.gold).toBe(fixture.player.gold);
    await expectCleanLayout(page);
    await pressGameKey(page, "Escape");
    await expect(page.locator("#debug-state")).not.toContainText("[MINIGAME:");
    expect(errors).toEqual([]);
  });
}

test("cutscenes show canonical multicolor NPCs and real boss silhouettes", async ({ page }) => {
  const errors = minigameBrowserErrors(page);
  await page.goto("game.html", { waitUntil: "domcontentloaded" });
  const fixture = minigameFixture("willowdaleRange");
  fixture.player.progression.seenCutsceneIds = [...CUTSCENE_IDS];
  reconcileFeatureDiscovery(fixture.player, fixture.codex, { silent: true });
  await seedMinigamePage(page, fixture, "keyboard");
  const cases = [
    { id: "campaign.oath.willowdale", visual: "elowen=npc_female_young_" },
    { id: "campaign.oath.ironhold", visual: "brann=npc_guard_male_" },
    { id: "campaign.oath.deeproot", visual: "neris=npc_female_elder_" },
    { id: "campaign.companion.guardian", visual: "guardian=npc_guard_male_" },
    { id: "boss.dragon.pre", visual: `dragon=${getMonsterTextureKey(getMonster("dragon")!)}` },
  ];
  for (const entry of cases) {
    await debugCommand(page, `/cutsceneview ${entry.id} knightLight unarmored`);
    await expect(page.locator("#debug-state")).toContainText(`CUTSCENE | ${entry.id}`);
    await expect(page.locator("#debug-state")).toContainText(entry.visual);
    await expect(page.locator("#debug-state")).not.toContainText("cutscene.actor.");
    if (entry.id === "campaign.oath.willowdale" || entry.id === "boss.dragon.pre") {
      await capture(page, `${entry.id}-recognizable-actors`);
    }
    await pressGameKey(page, "Escape");
    await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
  }
  expect(errors).toEqual([]);
});

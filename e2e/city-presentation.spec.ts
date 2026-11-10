import { expect, test, type Page } from "@playwright/test";
import { CUTSCENE_IDS } from "../src/data/cutscenes";
import {
  getCity, getCityChunk, getCityChunkCount, getCityChunkMap, getCityConnectionAt,
  getInnCost, isWalkable, MAP_HEIGHT, MAP_WIDTH,
} from "../src/data/map";
import { getMinigameVenue } from "../src/data/minigames";
import { getMonster } from "../src/data/monsters";
import { getMonsterTextureKey } from "../src/data/monsterFamilies";
import { auditLayout } from "../src/systems/layout";
import { acquireBoat } from "../src/systems/nauticalOwnership";
import { getItem } from "../src/data/items";
import { reconcileFeatureDiscovery } from "../src/systems/featureDiscovery";
import { clickPointerAt, expectCleanLayout, readLayoutReport, tapLayoutItem, waitForGameInputFrame } from "./helpers/layout";
import { pressGameKey, stepGameTile } from "./helpers/input";
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

for (const textScale of [1, 1.25, 1.5] as const) {
  test(`all shop banners remain visible from across the district at ${textScale * 100}% text`, async ({ page }) => {
    const errors = minigameBrowserErrors(page);
    await page.goto("game.html", { waitUntil: "domcontentloaded" });
    const fixture = minigameFixture("willowdaleRange");
    const city = getCity("willowdale_city")!;
    fixture.player.progression.seenCutsceneIds = [...CUTSCENE_IDS];
    Object.assign(fixture.player.position, { x: 10, y: 13 });
    await seedMinigamePage(page, fixture, "keyboard", { textScale, highContrast: textScale === 1.5 });
    await expect(page.locator("#layout-report")).toContainText("city-shop-3-4");
    const report = await readLayoutReport(page);
    const ids = report.groups["map-labels"]!.items.map(({ id }) => id);
    for (const shop of city.shops) {
      expect(ids).toContain(`city-shop-${shop.x}-${shop.y}`);
      expect(ids).toContain(`city-shop-${shop.x}-${shop.y}-banner`);
    }
    const minimap = report.groups["exploration-minimap"]!.items.find(({ id }) => id === "minimap-panel");
    if (!minimap) throw new Error("Missing actual minimap bounds.");
    const signs = report.groups["map-labels"]!.items
      .filter(({ id }) => id.startsWith("city-shop-") && !id.endsWith("-banner"));
    expect(auditLayout([...signs, minimap], { x: 0, y: 0, width: 640, height: 480 }))
      .toEqual({ overlaps: [], clipping: [] });
    await expectCleanLayout(page);
    await capture(page, `all-service-banners-${textScale * 100}`);
    if (textScale === 1.5) {
      await stepGameTile(page, "D", 11, 13);
      for (let y = 12; y >= 5; y--) await stepGameTile(page, "W", 11, y);
      for (let x = 12; x <= 16; x++) await stepGameTile(page, "D", x, 5);
      await stepGameTile(page, "W", 16, 4);
      await expect.poll(async () => (await readLayoutReport(page))
        .groups["exploration-minimap"]!.items.find(({ id }) => id === "minimap-panel")?.bounds.x).toBe(8);
      const moved = await readLayoutReport(page);
      const movedMinimap = moved.groups["exploration-minimap"]!.items.find(({ id }) => id === "minimap-panel")!;
      expect(movedMinimap.bounds.x).toBe(8);
      const movedSigns = moved.groups["map-labels"]!.items
        .filter(({ id }) => id.startsWith("city-shop-") && !id.endsWith("-banner"));
      expect(auditLayout([...movedSigns, movedMinimap], { x: 0, y: 0, width: 640, height: 480 }))
        .toEqual({ overlaps: [], clipping: [] });
      await capture(page, "service-banners-clear-relocated-minimap-150");
    }
    expect(errors).toEqual([]);
  });
}

for (const [cityId, shopName] of [
  ["willowdale_city", "General Store"], ["tidehaven_city", "Tidehaven Shipwright"],
] as const) {
  test(`${shopName} blocks night entry and leaves its existing room safely escapable`, async ({ page }) => {
    const errors = minigameBrowserErrors(page);
    const city = getCity(cityId)!;
    const shop = city.shops.find((entry) => entry.name === shopName)!;
    const door = getCityConnectionAt(city, 0, shop.x, shop.y)!;
    const room = getCityChunk(city, door.toChunkIndex)!;
    await page.goto("game.html", { waitUntil: "domcontentloaded" });
    const fixture = minigameFixture("willowdaleRange");
    fixture.player.progression.seenCutsceneIds = [...CUTSCENE_IDS];
    fixture.timeStep = 300;
    if (shopName === "Tidehaven Shipwright") {
      acquireBoat(fixture.player.progression.nautical, "merchantSloop").boat.condition = 60;
      fixture.player.inventory.push({ ...getItem("reinforcedHullKit")! });
    }
    Object.assign(fixture.player.position, {
      cityId, cityChunkIndex: 0, x: shop.x, y: shop.y,
    });
    await seedMinigamePage(page, fixture, "keyboard");
    await pressGameKey(page, "Space");
    await expect(page.locator("#debug-state")).toContainText(`[CITY:${cityId}:0]`);
    expect((await readMinigameSave(page)).player.gold).toBe(fixture.player.gold);

    await page.goto("game.html", { waitUntil: "domcontentloaded" });
    Object.assign(fixture.player.position, { cityChunkIndex: door.toChunkIndex, x: 10, y: 6 });
    await seedMinigamePage(page, fixture, "touch");
    await expect(page.locator("#layout-report")).toContainText("city-shopkeeper");
    await tapLayoutItem(page, "city-shopkeeper");
    await expect(page.locator("#debug-state")).toContainText(`[CITY:${cityId}:${door.toChunkIndex}]`);
    await expect(page.locator("#debug-state")).not.toContainText("SHOP |");
    expect((await readMinigameSave(page)).player.gold).toBe(fixture.player.gold);
    if (shopName === "Tidehaven Shipwright") {
      const saved = await readMinigameSave(page);
      expect(saved.player.progression.nautical.ownedBoats[0]!.condition).toBe(60);
      expect(saved.player.progression.nautical.ownedBoats[0]!.upgradeIds).toEqual([]);
      expect(saved.player.inventory.some((item) => item.id === "reinforcedHullKit")).toBe(true);
    }
    await stepGameTile(page, "A", 9, 6);
    for (let y = 7; y <= 12; y++) await stepGameTile(page, "S", 9, y);
    await stepGameTile(page, "D", 10, 12);
    await stepGameTile(page, "S", 10, 13);
    await pressGameKey(page, "Space");
    await expect(page.locator("#debug-state")).toContainText(`[CITY:${cityId}:0]`);
    expect(room.interior?.kind).toBe("shop");
    expect(errors).toEqual([]);
  });
}

for (const [cityId, district] of [["willowdale_city", 0], ["tidehaven_city", 1]] as const) {
  test(`${cityId} district ${district} inn admits night visitors and retains its clerk after resting`, async ({ page }) => {
    const errors = minigameBrowserErrors(page);
    const city = getCity(cityId)!;
    const street = getCityChunk(city, district)!;
    const inn = street.shops.find((shop) => shop.type === "inn")!;
    const door = getCityConnectionAt(city, district, inn.x, inn.y)!;
    const fixture = minigameFixture("willowdaleRange");
    fixture.player.progression.seenCutsceneIds = [...CUTSCENE_IDS];
    fixture.player.hp = 1;
    fixture.player.mp = 0;
    fixture.timeStep = 300;
    Object.assign(fixture.player.position, {
      cityId, cityChunkIndex: district, x: inn.x, y: inn.y,
    });
    await page.goto("game.html", { waitUntil: "domcontentloaded" });
    await seedMinigamePage(page, fixture, "touch", { textScale: 1 });
    await pressGameKey(page, "Space");
    await expect(page.locator("#debug-state")).toContainText(`[CITY:${cityId}:${door.toChunkIndex}]`);
    await expect(page.locator("#debug-state")).toContainText("Fade: ready");
    await stepGameTile(page, "A", 9, 12);
    for (let y = 11; y >= 6; y--) await stepGameTile(page, "W", 9, y);
    await stepGameTile(page, "D", 10, 6);
    await tapLayoutItem(page, "city-shopkeeper");
    await waitForGameInputFrame(page);
    const canvas = await page.locator("#game-container canvas").boundingBox();
    if (!canvas) throw new Error("Missing inn canvas.");
    await clickPointerAt(page, canvas.x + 320 / 640 * canvas.width, canvas.y + 224 / 528 * canvas.height);
    await expect.poll(async () => (await readMinigameSave(page)).player.gold).toBe(fixture.player.gold - getInnCost(cityId));
    await expect(page.locator("#debug-state")).toContainText("Fade: ready");
    await expect(page.locator("#layout-report")).toContainText("city-shopkeeper");
    const saved = await readMinigameSave(page);
    expect(saved.player.hp).toBe(saved.player.maxHp);
    expect(saved.player.mp).toBe(saved.player.maxMp);
    await expectCleanLayout(page);
    await capture(page, `${cityId}-${district}-clerk-after-rest`);
    await tapLayoutItem(page, "city-shopkeeper");
    await expect(page.locator("#exploration-minimap-summary")).toHaveAttribute("hidden", "");
    expect(errors).toEqual([]);
  });
}

test("optional room discoveries have no minimap marker or automatic search hint", async ({ page }) => {
  const errors = minigameBrowserErrors(page);
  const city = getCity("willowdale_city")!;
  const index = Array.from({ length: getCityChunkCount(city) }, (_, i) => i)
    .find((i) => getCityChunk(city, i)?.interior?.kind === "home")!;
  const room = getCityChunk(city, index)!;
  const coins = room.interior!.props.find((prop) => prop.reward?.gold)!;
  const fixture = minigameFixture("willowdaleRange");
  fixture.player.progression.seenCutsceneIds = [...CUTSCENE_IDS];
  Object.assign(fixture.player.position, { cityChunkIndex: index, x: coins.x - 1, y: coins.y });
  await page.goto("game.html", { waitUntil: "domcontentloaded" });
  await seedMinigamePage(page, fixture, "touch", { textScale: 1.5 });
  await expect(page.locator("#exploration-minimap-summary")).not.toHaveAttribute("aria-label", /book|supplies|treasure/);
  await expect(page.locator("#debug-state")).not.toContainText(coins.label);
  await expectCleanLayout(page);
  await capture(page, "unmarked-interior-discoveries");
  await tapLayoutItem(page, coins.id);
  await expect.poll(async () => (await readMinigameSave(page)).player.gold).toBe(fixture.player.gold + coins.reward!.gold!);
  expect(errors).toEqual([]);
});

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
    const building = !!getCityChunk(city, district)?.interior;
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const key = district === 0 ? `c:${city.id},${x},${y}` : `c:${city.id},${district},${x},${y}`;
        expect(saved.player.progression.exploredTiles[key], key).toBe(building ? undefined : true);
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

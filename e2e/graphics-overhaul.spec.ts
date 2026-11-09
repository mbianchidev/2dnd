import { expect, test, type Page } from "@playwright/test";
import { CUTSCENE_IDS } from "../src/data/cutscenes";
import {
  getChunk, getCity, getCityChunk, getCityChunkCount, getCityConnectionAt,
  getDungeon, getDungeonLevelMap, getDungeonLevelSpawn, isWalkable,
} from "../src/data/map";
import { ALL_MONSTERS } from "../src/data/monsters";
import { MONSTER_FAMILY_IDS } from "../src/data/monsterFamilies";
import { createHeroClassProgression, getAvailableProgressionGrants } from "../src/systems/classProgression";
import { xpForLevel } from "../src/systems/player";
import type { SaveData } from "../src/systems/save";
import { pressGameKey, stepGameTile as step } from "./helpers/input";
import { clickLayoutItem, expectCleanLayout, tapLayoutItem, waitForGameInputFrame } from "./helpers/layout";
import { continueMinigameFixture, minigameBrowserErrors, minigameFixture, readMinigameSave, seedMinigamePage } from "./helpers/minigames";

test.use({ hasTouch: true });

function campaign(): SaveData {
  const fixture = minigameFixture("willowdaleRange");
  fixture.player.progression.seenCutsceneIds = [...CUTSCENE_IDS];
  fixture.player.progression.pendingCutsceneIds = [];
  fixture.player.progression.exploredTiles = {};
  fixture.player.hp = fixture.player.maxHp = 500;
  return fixture;
}

async function capture(page: Page, name: string): Promise<void> {
  const path = test.info().outputPath(`${name}.png`);
  await page.locator("#game-inner").screenshot({ path });
  await test.info().attach(name, { path, contentType: "image/png" });
}

async function debugCommand(page: Page, command: string): Promise<void> {
  if (!await page.locator("#debug-checkbox").isChecked()) await page.locator("#debug-checkbox").check();
  await page.locator("#debug-cmd").evaluate((element, value) => {
    if (!(element instanceof HTMLInputElement)) throw new Error("Missing debug command input.");
    element.value = value;
    element.dispatchEvent(new KeyboardEvent("keydown", { code: "Enter", key: "Enter", bubbles: true }));
    element.blur();
  }, command);
  await waitForGameInputFrame(page);
}

for (const textScale of [1, 1.25, 1.5] as const) {
  test(`original world, city, library and dungeon art with a clean ${textScale * 100}% minimap`, async ({ browser, baseURL }) => {
    const errors: string[] = [];
    const city = getCity("willowdale_city")!;
    const libraryIndex = Array.from({ length: getCityChunkCount(city) }, (_, index) => index)
      .find((index) => getCityChunk(city, index)?.interior?.kind === "library")!;
    const dungeon = getDungeon("heartlands_dungeon")!;
    const spawn = getDungeonLevelSpawn(dungeon, 1);
    const scenes = [
      { name: "heartlands", position: { inCity: false, cityId: "", inDungeon: false, dungeonId: "",
        chunkX: 4, chunkY: 2, x: 3, y: 3 }, map: getChunk(4, 2)!.mapData, key: (x: number, y: number) => `4,2,${x},${y}` },
      { name: "willowdale", position: { inCity: true, cityId: city.id, cityChunkIndex: 0,
        inDungeon: false, dungeonId: "", x: 10, y: 13 }, map: city.mapData, key: (x: number, y: number) => `c:${city.id},${x},${y}` },
      { name: "library", position: { inCity: true, cityId: city.id, cityChunkIndex: libraryIndex,
        inDungeon: false, dungeonId: "", x: 10, y: 12 }, map: getCityChunk(city, libraryIndex)!.mapData, key: () => "" },
      { name: "crypt", position: { inCity: false, cityId: "", inDungeon: true,
        dungeonId: dungeon.id, dungeonLevel: 1, ...spawn }, map: getDungeonLevelMap(dungeon, 1),
        key: (x: number, y: number) => `d:${dungeon.id},1,${x},${y}` },
    ];
    for (const scene of scenes) {
      const context = await browser.newContext({ baseURL, hasTouch: true, viewport: { width: 1280, height: 900 } });
      try {
        const page = await context.newPage();
        const sceneErrors = minigameBrowserErrors(page);
        await page.goto("game.html", { waitUntil: "domcontentloaded" });
        const fixture = campaign();
        Object.assign(fixture.player.position, scene.position);
        scene.map.forEach((row, y) => row.forEach((_terrain, x) => {
          const key = scene.key(x, y);
          if (key) fixture.player.progression.exploredTiles[key] = true;
        }));
        await seedMinigamePage(page, fixture, "keyboard", { reducedMotion: false, textScale, highContrast: false });
        await expect(page.locator("#debug-state")).toContainText(`Pos: (${scene.position.x},${scene.position.y})`);
        if (scene.position.inCity) {
          await expect(page.locator("#debug-state")).toContainText(`[CITY:${scene.position.cityId}:${scene.position.cityChunkIndex}]`);
        }
        if (scene.position.inDungeon) await expect(page.locator("#debug-state")).toContainText(`[DUNGEON:${scene.position.dungeonId}]`);
        await expect(page.locator("#debug-state")).toContainText("Fade: ready");
        await expect(page.locator("#exploration-minimap-summary")).toHaveAttribute("aria-label", /North-up exploration minimap/);
        await expect(page.locator("#exploration-minimap-summary")).not.toHaveAttribute("hidden", "");
        await expect(page.locator("#layout-report")).toContainText("minimap-panel");
        await expectCleanLayout(page);
        await capture(page, `${scene.name}-${textScale * 100}`);
        errors.push(...sceneErrors);
      } finally {
        await context.close();
      }
    }
    expect(errors).toEqual([]);
  });
}

test("walk through a real shop door, claim offered supplies once, reload and browse its counter", async ({ page }) => {
  const errors = minigameBrowserErrors(page);
  await page.goto("game.html", { waitUntil: "domcontentloaded" });
  const city = getCity("willowdale_city")!;
  const shop = city.shops.find((entry) => entry.type === "general")!;
  const connection = getCityConnectionAt(city, 0, shop.x, shop.y)!;
  const room = getCityChunk(city, connection.toChunkIndex)!;
  const fixture = campaign();
  Object.assign(fixture.player.position, { inCity: true, cityId: city.id, cityChunkIndex: 0, x: shop.x, y: shop.y });
  await seedMinigamePage(page, fixture, "touch", { reducedMotion: false, textScale: 1.5, highContrast: false });
  await pressGameKey(page, "Space");
  await expect(page.locator("#debug-state")).toContainText(`[CITY:${city.id}:${connection.toChunkIndex}]`);
  await expect(page.locator("#debug-state")).toContainText("Fade: ready");
  await expectCleanLayout(page);
  await capture(page, "explorable-general-store");
  for (let x = 9; x >= 5; x--) await step(page, "A", x, 12);
  for (let y = 11; y >= 10; y--) await step(page, "W", 5, y);
  const coins = room.interior!.props.find((prop) => prop.reward?.gold)!;
  await expect(page.locator("#layout-report")).toContainText(coins.id);
  await tapLayoutItem(page, coins.id);
  await expect.poll(async () => (await readMinigameSave(page)).player.gold).toBe(fixture.player.gold + 3);
  await pressGameKey(page, "Space");
  expect((await readMinigameSave(page)).player.gold).toBe(fixture.player.gold + 3);
  await page.reload({ waitUntil: "domcontentloaded" });
  await continueMinigameFixture(page);
  await pressGameKey(page, "Space");
  const saved = await readMinigameSave(page);
  expect(saved.player.gold).toBe(fixture.player.gold + 3);
  expect(saved.player.progression.collectedTreasures.filter((id) => id === coins.id)).toHaveLength(1);
  for (let x = 6; x <= 10; x++) await step(page, "D", x, 10);
  for (let y = 9; y >= 6; y--) await step(page, "W", 10, y);
  await pressGameKey(page, "Space");
  await expect(page.locator("#debug-state")).toContainText("SHOP");
  await pressGameKey(page, "Escape");
  await expect(page.locator("#debug-state")).toContainText(`[CITY:${city.id}:${connection.toChunkIndex}]`);
  await expect(page.locator("#debug-state")).toContainText("Fade: ready");
  await expectCleanLayout(page);
  await step(page, "A", 9, 6);
  for (let y = 7; y <= 12; y++) await step(page, "S", 9, y);
  await step(page, "D", 10, 12);
  await pressGameKey(page, "S");
  await expect(page.locator("#debug-state")).toContainText("Pos: (10,13)");
  await pressGameKey(page, "Space");
  await expect(page.locator("#debug-state")).toContainText(`[CITY:${city.id}:0]`);
  await expect(page.locator("#debug-state")).toContainText(`Pos: (${shop.x},${shop.y})`);
  await expect(page.locator("#debug-state")).toContainText("Fade: ready");
  await expectCleanLayout(page);
  expect(errors).toEqual([]);
});

test("read a library at 150% text and learn a qualified manuscript once through real input", async ({ page }) => {
  const errors = minigameBrowserErrors(page);
  const city = getCity("frostheim_city")!;
  const index = Array.from({ length: getCityChunkCount(city) }, (_, i) => i)
    .find((i) => getCityChunk(city, i)?.interior?.kind === "library")!;
  const room = getCityChunk(city, index)!;
  const journal = room.interior!.props.find((prop) => prop.reward?.knowledgeId)!;
  const manuscript = room.interior!.props.find((prop) => prop.reward?.studyId)!;
  const fixture = campaign();
  fixture.player.classProgression = createHeroClassProgression("warlock", 4);
  fixture.player.level = 4;
  fixture.player.xp = xpForLevel(4);
  fixture.player.stats.charisma = 15;
  fixture.player.knownSpells = [...getAvailableProgressionGrants(fixture.player).spells];
  Object.assign(fixture.player.position, {
    inCity: true, cityId: city.id, cityChunkIndex: index, x: 6, y: 8,
  });
  await page.goto("game.html", { waitUntil: "domcontentloaded" });
  await seedMinigamePage(page, fixture, "keyboard", { reducedMotion: true, textScale: 1.5, highContrast: false });
  await tapLayoutItem(page, journal.id);
  await expect(page.locator("#layout-report")).toContainText("dialogue-body");
  await expectCleanLayout(page);
  await capture(page, "reading-library-at-150");
  expect((await readMinigameSave(page)).player.progression.collectedTreasures).not.toContain(journal.id);
  for (const _page of journal.text!) {
    await pressGameKey(page, "Space");
    await expectCleanLayout(page);
  }
  await expect.poll(async () => (await readMinigameSave(page)).codex.unlockedEntryIds).toContain("historyRoadsAndRest");
  for (let x = 7; x <= 9; x++) await step(page, "D", x, 8);
  await step(page, "W", 9, 7);
  for (let x = 10; x <= 13; x++) await step(page, "D", x, 7);
  await tapLayoutItem(page, manuscript.id);
  await expect(page.locator("#layout-report")).toContainText("dialogue-body");
  await expectCleanLayout(page);
  for (const _page of manuscript.text!) await pressGameKey(page, "Space");
  await expect.poll(async () => (await readMinigameSave(page)).player.knownSpells).toContain("rayOfFrost");
  await page.reload({ waitUntil: "domcontentloaded" });
  await continueMinigameFixture(page);
  const saved = await readMinigameSave(page);
  expect(saved.player.knownSpells.filter((id) => id === "rayOfFrost")).toHaveLength(1);
  expect(saved.player.progression.collectedTreasures.filter((id) => id === "study:winterPrimer")).toHaveLength(1);
  expect(saved.codex.unlockedEntryIds).toContain("historyRoadsAndRest");
  await pressGameKey(page, "M");
  await expect(page.locator("#layout-report")).toContainText("city-map");
  await expectCleanLayout(page);
  await capture(page, "library-district-map-at-150");
  await clickLayoutItem(page, "city-map-0");
  await expect(page.locator("#debug-state")).toContainText(`[CITY:${city.id}:0]`);
  expect(errors).toEqual([]);
});

test("animated dice conceal exact faces until stopping and keep the same result when skipped", async ({ page }) => {
  const errors = minigameBrowserErrors(page);
  await page.goto("game.html", { waitUntil: "domcontentloaded" });
  await seedMinigamePage(page, campaign(), "keyboard", { reducedMotion: false, highContrast: false });
  await debugCommand(page, "/spawn troll");
  await expect(page.locator("#debug-state")).toContainText("Phase: playerTurn");
  await clickLayoutItem(page, "battle-action-attack");
  await pressGameKey(page, "Enter");
  const dice = page.locator("#dice-presentation");
  await expect(dice).toHaveAttribute("data-category", "attack");
  await expect(dice).toHaveAttribute("data-phase", "animating");
  await expect(dice).toHaveAttribute("data-results-revealed", "false");
  expect(await dice.locator(".die-number").evaluateAll((faces) =>
    faces.every((face) => face.getAttribute("visibility") === "hidden"))).toBe(true);
  await capture(page, "attack-and-unsettled-dice");
  const stopped = await page.locator("#dice-fast-forward").evaluate((button) => {
    if (!(button instanceof HTMLButtonElement)) throw new Error("Missing native skip button.");
    const root = document.getElementById("dice-presentation")!;
    const naturals = [...root.querySelectorAll<HTMLElement>(".resolved-die")].map((die) => die.dataset.natural);
    button.click();
    return {
      phase: root.dataset.phase, revealed: root.dataset.resultsRevealed,
      before: naturals, after: [...root.querySelectorAll<HTMLElement>(".resolved-die")].map((die) => die.dataset.natural),
      faces: [...root.querySelectorAll(".die-number")].map((face) => face.getAttribute("visibility")),
    };
  });
  expect(stopped.phase).toBe("ready");
  expect(stopped.revealed).toBe("true");
  expect(stopped.after).toEqual(stopped.before);
  expect(stopped.faces.every((visibility) => visibility === "visible")).toBe(true);
  await capture(page, "settled-exact-dice");
  await debugCommand(page, "/kill");
  await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
  await expect(page.locator("#dice-roll-stage")).toHaveAttribute("hidden", "");
  expect(errors).toEqual([]);
});

test("every monster family uses its defined in-game silhouette and action texture family", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = minigameBrowserErrors(page);
  await page.goto("game.html", { waitUntil: "domcontentloaded" });
  const fixture = campaign();
  const map = getCity("willowdale_city")!.mapData;
  const approach = [{ x: 10, y: 13 }, { x: 11, y: 13 }].find(({ x, y }) => isWalkable(map[y]![x]!))!;
  Object.assign(fixture.player.position, approach);
  await seedMinigamePage(page, fixture, "keyboard", { highContrast: false });
  for (const family of MONSTER_FAMILY_IDS) {
    const monster = ALL_MONSTERS.find((entry) => entry.family === family && !entry.isBoss)
      ?? ALL_MONSTERS.find((entry) => entry.family === family)!;
    await debugCommand(page, `/spawn ${monster.id}`);
    await expect(page.locator("#debug-state")).toContainText("BATTLE");
    await capture(page, `family-${family}`);
    await debugCommand(page, "/kill");
    await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
  }
  expect(errors).toEqual([]);
});

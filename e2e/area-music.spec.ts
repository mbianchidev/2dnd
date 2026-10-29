import { expect, test, type Page } from "@playwright/test";
import { CUTSCENE_IDS } from "../src/data/cutscenes";
import { getChunk, getCity, getDungeon, isWalkable, Terrain } from "../src/data/map";
import { createCodex } from "../src/systems/codex";
import { createPlayer, type PlayerPosition } from "../src/systems/player";
import { createCurrentSaveData, normalizeSaveData } from "../src/systems/save";
import { normalizeGamePreferences } from "../src/systems/accessibility";
import { createWeatherState, WeatherType } from "../src/systems/weather";
import type { AudioState } from "../src/systems/audio";
import type { MusicPlaybackSnapshot } from "../src/systems/musicPlayback";
import { clickLayoutItem, waitForGameInputFrame } from "./helpers/layout";
import { pressGameKey } from "./helpers/input";

const pageErrors = new WeakMap<Page, string[]>();

async function seedCampaign(
  page: Page,
  position: Partial<PlayerPosition> = {},
  health?: { hp: number; maxHp: number },
): Promise<void> {
  const player = createPlayer("Music Tester", {
    strength: 12, dexterity: 12, constitution: 12, intelligence: 10, wisdom: 10, charisma: 10,
  }, "knight");
  Object.assign(player.position, position);
  if (health) {
    player.hp = health.hp;
    player.maxHp = health.maxHp;
  }
  player.progression.tutorial.completed = true;
  player.progression.seenCutsceneIds = [...CUTSCENE_IDS];
  player.progression.worldEvents.cooldownRemaining = 100;
  const save = createCurrentSaveData(
    player, new Set(), createCodex(), player.appearanceId, 90, createWeatherState(),
  );
  if (!normalizeSaveData(structuredClone(save))) throw new Error("Invalid area-music fixture.");
  const preferences = normalizeGamePreferences({
    audio: { muted: true },
    accessibility: { reducedMotion: true },
    dice: { speed: "instant" },
  });
  await page.addInitScript(({ save, preferences }) => {
    localStorage.clear();
    localStorage.setItem("2dnd_save", JSON.stringify(save));
    localStorage.setItem("2dnd_preferences", JSON.stringify(preferences));
    localStorage.setItem("2dnd_debug", "true");
    // Vary texture UUIDs while keeping weather clear and land encounters absent.
    let seed = 24680;
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return 0.8 + seed / 0x100000000 * 0.199;
    };
  }, { save, preferences });
  await page.goto("game.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#debug-state")).toContainText("BOOT | Screen: title");
  await clickLayoutItem(page, "title-continue");
  await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
}

async function readAudio(page: Page): Promise<Pick<AudioState, "trackKind" | "trackId" | "nightMode">> {
  return page.evaluate(async () => {
    const { audioEngine }: typeof import("../src/systems/audio") =
      await import(new URL("src/systems/audio.ts", document.baseURI).href);
    const { trackKind, trackId, nightMode } = audioEngine.state;
    return { trackKind, trackId, nightMode };
  });
}

async function readPlayback(page: Page): Promise<MusicPlaybackSnapshot> {
  return page.evaluate(async () => {
    const { audioEngine }: typeof import("../src/systems/audio") =
      await import(new URL("src/systems/audio.ts", document.baseURI).href);
    const snapshot = audioEngine.musicPlaybackState;
    if (!snapshot) throw new Error("Music playback was not initialized by the title gesture.");
    return snapshot;
  });
}

async function debugCommand(page: Page, command: string): Promise<void> {
  const checkbox = page.locator("#debug-checkbox");
  if (!await checkbox.isChecked()) await checkbox.check();
  const input = page.locator("#debug-cmd");
  await input.fill(command);
  await input.press("Enter");
  await input.blur();
  await waitForGameInputFrame(page);
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
});

test.afterEach(async ({ page }) => expect(pageErrors.get(page)).toEqual([]));

test("a real chunk crossing changes the regional melody even when the weather stays clear", async ({ page }) => {
  const heartlands = getChunk(4, 2)!;
  const desert = getChunk(5, 2)!;
  const y = heartlands.mapData.findIndex((row, index) =>
    isWalkable(row[19]) && isWalkable(desert.mapData[index][0])
  );
  expect(y).toBeGreaterThanOrEqual(0);
  await seedCampaign(page, { chunkX: 4, chunkY: 2, x: 19, y });
  await expect.poll(() => readAudio(page)).toEqual({
    trackKind: "biome", trackId: "Rolling_day", nightMode: false,
  });
  await pressGameKey(page, "d");
  await expect(page.locator("#debug-state")).toContainText("Chunk: (5,2)");
  await expect.poll(() => readAudio(page)).toEqual({
    trackKind: "biome", trackId: "Arid_day", nightMode: false,
  });
  await expect(page.locator("#debug-state")).toContainText("Weather: Clear");
  await pressGameKey(page, "Escape");
  await clickLayoutItem(page, "escape-menu-quit");
  await expect(page.locator("#debug-state")).toContainText("BOOT | Screen: title");
  const raw: unknown = await page.evaluate(() => JSON.parse(localStorage.getItem("2dnd_save")!));
  const saved = normalizeSaveData(raw);
  expect(saved?.weatherState?.current).toBe(WeatherType.Clear);
  expect(saved?.player.position.chunkX).toBe(5);
});

test("city, night, dungeon, battle and real dungeon exit select their own music", async ({ page }) => {
  await seedCampaign(page);
  await debugCommand(page, "/tp Willowdale");
  await pressGameKey(page, "Space");
  await expect(page.locator("#debug-state")).toContainText("[CITY:willowdale_city");
  await expect.poll(() => readAudio(page)).toEqual({
    trackKind: "city", trackId: "Willowdale_day", nightMode: false,
  });
  await debugCommand(page, "/time night");
  await expect.poll(() => readAudio(page)).toEqual({
    trackKind: "city", trackId: "Willowdale_night", nightMode: true,
  });
  await debugCommand(page, "/tp Heartlands Crypt");
  await pressGameKey(page, "Space");
  await expect(page.locator("#debug-state")).toContainText("[DUNGEON:heartlands_dungeon]");
  await expect.poll(() => readAudio(page)).toEqual({
    trackKind: "dungeon", trackId: "heartlands_dungeon", nightMode: false,
  });
  await debugCommand(page, "/spawn slime");
  await expect(page.locator("#debug-state")).toContainText("BATTLE");
  await expect.poll(() => readAudio(page)).toMatchObject({ trackKind: "battle" });
  await debugCommand(page, "/kill");
  await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
  await expect.poll(() => readAudio(page)).toMatchObject({
    trackKind: "dungeon", trackId: "heartlands_dungeon",
  });
  const crypt = getDungeon("heartlands_dungeon")!;
  expect(crypt.mapData[crypt.spawnY][crypt.spawnX]).toBe(Terrain.DungeonExit);
  await pressGameKey(page, "Space");
  await expect(page.locator("#debug-state")).not.toContainText("[DUNGEON:");
  await expect.poll(() => readAudio(page)).toEqual({
    trackKind: "biome", trackId: "Rolling_night", nightMode: true,
  });
});

test("a named city shop retains its canonical city score and restores it on return", async ({ page }) => {
  const city = getCity("willowdale_city")!;
  const shop = city.shops.find((candidate) => candidate.type === "general")!;
  const approach = [
    { x: shop.x + 1, y: shop.y }, { x: shop.x - 1, y: shop.y },
    { x: shop.x, y: shop.y + 1 }, { x: shop.x, y: shop.y - 1 },
  ].find(({ x, y }) => isWalkable(city.mapData[y][x]));
  if (!approach) throw new Error("No walkable shop approach.");
  await seedCampaign(page, {
    inCity: true, cityId: city.id, cityChunkIndex: 0,
    chunkX: city.chunkX, chunkY: city.chunkY, ...approach,
  });
  await expect.poll(() => readAudio(page)).toMatchObject({ trackId: "Willowdale_day" });
  await pressGameKey(page, "Space");
  await expect(page.locator("#game-container canvas")).toHaveAttribute("data-layout-scene", "ShopScene");
  await expect.poll(() => readAudio(page)).toEqual({
    trackKind: "city", trackId: "Willowdale_day", nightMode: false,
  });
  await pressGameKey(page, "Escape");
  await expect(page.locator("#game-container canvas")).toHaveAttribute("data-layout-scene", "OverworldScene");
  await expect.poll(() => readAudio(page)).toMatchObject({ trackId: "Willowdale_day" });
});

test("the area motif develops while weather changes without restarting or leaking voices", async ({ page }) => {
  await seedCampaign(page);
  await expect.poll(async () => (await readPlayback(page)).bar).toBeGreaterThanOrEqual(1);
  const before = await readPlayback(page);
  await debugCommand(page, "/weather storm");
  await expect.poll(() => readAudio(page)).toMatchObject({ trackId: "Rolling_day" });
  const storm = await readPlayback(page);
  expect(storm.weather).toBe(WeatherType.Storm);
  expect(storm.bar).toBeGreaterThanOrEqual(before.bar);
  await expect.poll(async () => (await readPlayback(page)).section, { timeout: 20_000 })
    .toBe("answer");
  for (let sample = 0; sample < 8; sample++) {
    const playback = await readPlayback(page);
    expect(playback.activeTracks).toBe(1);
    expect(playback.activeVoices).toBeLessThanOrEqual(24);
    expect(playback.scheduling).toBe(true);
    await waitForGameInputFrame(page);
  }
  await debugCommand(page, "/audio stop");
  await expect.poll(() => readPlayback(page)).toMatchObject({
    activeVoices: 0, activeTracks: 0, scheduling: false,
  });
  await waitForGameInputFrame(page);
  expect((await readPlayback(page)).activeVoices).toBe(0);
});

test("battle orchestration follows actual party damage and resets on exploration return", async ({ page }) => {
  await seedCampaign(page, {}, { hp: 25, maxHp: 100 });
  await debugCommand(page, "/spawn slime");
  await expect(page.locator("#debug-state")).toContainText("Phase: playerTurn");
  const before = await readPlayback(page);
  expect(before.pressure).toBeGreaterThanOrEqual(0.75);
  await clickLayoutItem(page, "battle-action-defend");
  await expect.poll(async () => (await readPlayback(page)).pressure)
    .toBeGreaterThan(before.pressure);
  await debugCommand(page, "/kill");
  await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
  await expect.poll(() => readAudio(page)).toMatchObject({ trackId: "Rolling_day" });
  await expect.poll(() => readPlayback(page)).toMatchObject({ pressure: 0, activeTracks: 1 });
});

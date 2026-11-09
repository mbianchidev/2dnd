import { expect, test, type Page } from "@playwright/test";
import { CITIES } from "../src/data/cities";
import { MERCHANT_ROUTES, PORTS } from "../src/data/nautical";
import { CUTSCENE_IDS } from "../src/data/cutscenes";
import { normalizeGamePreferences } from "../src/systems/accessibility";
import { createCustomAppearance } from "../src/systems/appearance";
import { getPlayerClass } from "../src/systems/classes";
import { revealFeature } from "../src/systems/featureDiscovery";
import { getHeroVisualTextureKey, resolveHeroVisualDescriptor } from "../src/systems/heroVisuals";
import { resolveNamedNpcVisual } from "../src/systems/npcVisuals";
import { getWorldCityArtProfile } from "../src/systems/worldCityArt";
import { pressGameKey } from "./helpers/input";
import { clickLayoutItem, expectCleanLayout, readLayoutReport, waitForGameInputFrame } from "./helpers/layout";
import { minigameBrowserErrors, minigameFixture, seedMinigamePage } from "./helpers/minigames";

async function command(page: Page, value: string): Promise<void> {
  if (!await page.locator("#debug-checkbox").isChecked()) await page.locator("#debug-checkbox").check();
  await page.locator("#debug-cmd").evaluate((element, text) => {
    if (!(element instanceof HTMLInputElement)) throw new Error("Missing debug setup.");
    element.value = text;
    element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
    element.blur();
  }, value);
  await waitForGameInputFrame(page);
}

function fixture(): ReturnType<typeof minigameFixture> {
  const save = minigameFixture("willowdaleRange");
  save.player.progression.seenCutsceneIds = [...CUTSCENE_IDS];
  save.player.progression.pendingCutsceneIds = [];
  return save;
}

test("the live initiative chain removes a monster after an actual killing attack", async ({ page }) => {
  const errors = minigameBrowserErrors(page);
  const save = fixture();
  save.player.stats.strength = 30;
  save.player.stats.dexterity = 30;
  save.player.hp = save.player.maxHp = 500;
  await page.addInitScript(() => {
    let seed = 0x5ce0e;
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
  });
  await page.goto("game.html", { waitUntil: "domcontentloaded" });
  await seedMinigamePage(page, save, "keyboard", { reducedMotion: true, textScale: 1.5 });
  await command(page, "/battleview goblinRaidingParty forest day clear");
  await expect(page.locator("#debug-state")).toContainText("Phase: playerTurn");
  const order = page.getByRole("list", { name: "Turn order" });
  await expect(order.locator("li")).toHaveCount(4);
  await expect(order.locator("[aria-current='step']")).toHaveText(`Now: ${save.player.name}`);
  const goblin = order.locator("li").filter({ hasText: "Goblin A" });
  const id = await goblin.getAttribute("data-combatant-id");
  expect(id).toBeTruthy();
  for (let attempt = 0; attempt < 4 && await goblin.count() > 0; attempt++) {
    await expect(page.locator("#debug-state")).toContainText("Phase: playerTurn");
    await clickLayoutItem(page, "battle-action-attack");
    await pressGameKey(page, "Enter");
    await expect.poll(async () => (await page.locator("#debug-state").textContent() ?? "").includes("Phase: playerTurn")
      || await goblin.count() === 0).toBe(true);
  }
  await expect(order.locator(`[data-combatant-id='${id}']`)).toHaveCount(0);
  await expect(order.locator("li")).toHaveCount(3);
  await expectCleanLayout(page);
  const path = test.info().outputPath("turn-order-after-defeat.png");
  await page.locator("#game-inner").screenshot({ path });
  await test.info().attach("Live turn order", { path, contentType: "image/png" });
  await command(page, "/kill");
  await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
  await expect(order).toHaveCount(0);
  expect(errors).toEqual([]);
});

for (const textScale of [1, 1.25, 1.5] as const) {
  test(`live hero and canonical speaker portraits survive recovery and replay at ${textScale * 100}%`, async ({ page }) => {
    const errors = minigameBrowserErrors(page);
    if (textScale === 1.5) await page.setViewportSize({ width: 844, height: 390 });
    const save = fixture();
    const id = "campaign.oath.willowdale";
    save.player.name = "Portrait Fixture";
    save.player.customAppearance = {
      ...createCustomAppearance(getPlayerClass(save.player.appearanceId)), hairStyle: 7, eyeColor: 0x78a799, facialHair: 3,
      accessory: "spectacles", headwear: false, outfitColor: 0x546d8c,
    };
    save.player.progression.seenCutsceneIds = CUTSCENE_IDS.filter((entry) => entry !== id);
    save.player.progression.pendingCutsceneIds = [id];
    const expectedHeroKey = `portrait-${getHeroVisualTextureKey(resolveHeroVisualDescriptor(save.player), "front")}`;
    const npc = resolveNamedNpcVisual("willowdaleArchivist");
    const expectedNpcKey = `portrait-npc-${npc.template.id}-${npc.skinColor}-${npc.hairColor}-${npc.dressColor}`;
    await page.goto("game.html", { waitUntil: "domcontentloaded" });
    const preferences = normalizeGamePreferences({
      accessibility: { reducedMotion: true, textScale, highContrast: textScale === 1.5, advanceMode: "manual" },
      audio: { muted: true },
    });
    await page.evaluate(({ campaign, preferences }) => {
      localStorage.clear();
      localStorage.setItem("2dnd_save", JSON.stringify(campaign));
      localStorage.setItem("2dnd_preferences", JSON.stringify(preferences));
    }, { campaign: save, preferences });
    await page.reload({ waitUntil: "domcontentloaded" });
    await clickLayoutItem(page, "title-continue");
    await expect(page.locator("#debug-state")).toContainText(`CUTSCENE | ${id}`);
    await expect(page.locator("#debug-state")).toContainText("Input: ready");
    const canvas = page.locator("#game-container canvas");
    const portraits = async (): Promise<unknown> => JSON.parse(await canvas.getAttribute("data-cutscene-portraits") ?? "null");
    expect(await portraits()).toEqual([
      expect.objectContaining({ actorId: "elowen", kind: "npc", speaking: true, textureKey: expectedNpcKey }),
      expect.objectContaining({ actorId: "hero", kind: "hero", speaking: false, textureKey: expectedHeroKey }),
    ]);
    await expect(page.locator("#cutscene-dialogue-status")).toContainText("Archivist Elowen:");
    await expectCleanLayout(page);
    const path = test.info().outputPath(`portraits-${textScale * 100}.png`);
    await page.locator("#game-inner").screenshot({ path });
    await test.info().attach("Cutscene portraits", { path, contentType: "image/png" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await clickLayoutItem(page, "title-continue");
    await expect(page.locator("#debug-state")).toContainText(`CUTSCENE | ${id}`);
    await expect(page.locator("#debug-state")).toContainText("Input: ready");
    expect(await portraits()).toEqual([
      expect.objectContaining({ actorId: "elowen", textureKey: expectedNpcKey }),
      expect.objectContaining({ actorId: "hero", textureKey: expectedHeroKey }),
    ]);
    await pressGameKey(page, "Escape");
    await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem("2dnd_save")!).player.progression);
    await command(page, `/cutsceneview ${id} bardBlue lateGame`);
    await expect(page.locator("#debug-state")).toContainText("Input: ready");
    expect(await portraits()).toEqual([
      expect.objectContaining({ actorId: "elowen", textureKey: expectedNpcKey }),
      expect.objectContaining({ actorId: "hero", textureKey: expect.not.stringMatching(expectedHeroKey) }),
    ]);
    await expect(page.locator("#debug-state")).toContainText("Input: ready");
    await expectCleanLayout(page);
    await pressGameKey(page, "Escape");
    await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem("2dnd_save")!).player.progression);
    expect(after.quests).toEqual(before.quests);
    expect(after.seenCutsceneIds).toEqual(before.seenCutsceneIds);
    expect(after.pendingCutsceneIds).toEqual(before.pendingCutsceneIds);
    await expect(page.locator("#cutscene-dialogue-status")).toHaveCount(0);
    await expect(canvas).not.toHaveAttribute("data-cutscene-portraits");
    if (textScale === 1.5) {
      await command(page, "/cutsceneview boss.kraken.pre bardBlue lateGame");
      await expect(page.locator("#debug-state")).toContainText("Input: ready");
      await pressGameKey(page, "Space");
      await expect.poll(portraits).toEqual([
        expect.objectContaining({ kind: "monster", actorId: "kraken", speaking: true }),
        expect.objectContaining({ kind: "hero", actorId: "hero", speaking: false }),
      ]);
      await expect(page.locator("#debug-state")).toContainText("Input: ready");
      await expectCleanLayout(page);
      await pressGameKey(page, "Escape");
      await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
      await command(page, "/cutsceneview campaign.twelvefoldCovenant.epilogue bardBlue lateGame");
      await expect(page.locator("#debug-state")).toContainText("ENDING | Step:");
      await expect(page.locator("#debug-state")).toContainText("Input: ready");
      await pressGameKey(page, "Space");
      await expect(page.locator("#debug-state")).toContainText("Type: dialogue");
      await expect(page.locator("#debug-state")).toContainText("Input: ready");
      await expect.poll(portraits).toEqual([
        expect.objectContaining({ kind: "npc", actorId: "elowen", speaking: true }),
        expect.objectContaining({ kind: "hero", actorId: "hero", speaking: false }),
      ]);
      await expectCleanLayout(page);
      const ending = test.info().outputPath("ending-dialogue-portraits-150.png");
      await page.locator("#game-inner").screenshot({ path: ending });
      await test.info().attach("Epilogue portraits", { path: ending, contentType: "image/png" });
      await pressGameKey(page, "Escape");
      await expect(page.locator("#debug-state")).toContainText("ENDING | Choices");
      await pressGameKey(page, "Enter");
      await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
      await expect(page.locator("#cutscene-dialogue-status")).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  });
}

test("world cities use distinct multi-tile landmarks on movement and atlas views without exposing Starfall", async ({ page }) => {
  const errors = minigameBrowserErrors(page);
  const save = fixture();
  save.player.progression.nautical.discoveredPortIds = PORTS.map(({ id }) => id);
  save.player.progression.nautical.discoveredRouteIds = MERCHANT_ROUTES.map(({ id }) => id);
  for (const id of ["nauticalBoat", "nauticalHarbors", "nauticalRoutes"] as const) {
    revealFeature(save.player, id, { debug: true, notify: false });
  }
  Object.assign(save.player.position, {
    inCity: false, cityId: "", cityChunkIndex: 0, inDungeon: false,
    chunkX: 4, chunkY: 2, x: 2, y: 3,
  });
  await page.goto("game.html", { waitUntil: "domcontentloaded" });
  await seedMinigamePage(page, save, "keyboard", { reducedMotion: true, textScale: 1.5 });
  await command(page, "/reveal");
  const canvas = page.locator("#game-container canvas");
  for (const city of CITIES.filter(({ id }) => id !== "starfall_atoll")) {
    await command(page, `/tp ${city.chunkX} ${city.chunkY}`);
    await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
    const report = JSON.parse(await canvas.getAttribute("data-world-city-landmarks") ?? "[]") as Array<{
      cityId: string; cells: Array<{ x: number; y: number }>;
    }>;
    const actual = report.find(({ cityId }) => cityId === city.id);
    const profile = getWorldCityArtProfile(city.id);
    expect(actual?.cells).toHaveLength(profile.columns * profile.rows);
    expect(report.some(({ cityId }) => cityId === "starfall_atoll")).toBe(false);
    await expectCleanLayout(page);
    if (["willowdale_city", "sandport_city", "deeproot_city", "ashfall_city"].includes(city.id)) {
      const path = test.info().outputPath(`${city.id}-world.png`);
      await page.locator("#game-inner").screenshot({ path });
      await test.info().attach(city.name, { path, contentType: "image/png" });
    }
  }
  await pressGameKey(page, "M");
  await expect.poll(async () => Object.keys((await readLayoutReport(page)).groups)).toContain("world-map");
  await expectCleanLayout(page);
  const overview = test.info().outputPath("city-atlas-overview.png");
  await page.locator("#game-inner").screenshot({ path: overview });
  await test.info().attach("World atlas", { path: overview, contentType: "image/png" });
  await clickLayoutItem(page, "world-map-chunk-4-2");
  await expect(page.locator("#layout-report")).toContainText("world-map-back");
  await expectCleanLayout(page);
  const detail = test.info().outputPath("city-atlas-heartlands.png");
  await page.locator("#game-inner").screenshot({ path: detail });
  await test.info().attach("City landmarks in the atlas", { path: detail, contentType: "image/png" });
  await pressGameKey(page, "Escape");
  expect(errors).toEqual([]);
});

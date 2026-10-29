import { mkdir, writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { CUTSCENE_IDS, CAMPAIGN_EPILOGUE_CUTSCENE_ID, type CutsceneId } from "../src/data/cutscenes";
import { CUTSCENE_SCENERY } from "../src/data/cutsceneScenery";
import { createPlayer } from "../src/systems/player";
import { createCodex } from "../src/systems/codex";
import { createCurrentSaveData, normalizeSaveData } from "../src/systems/save";
import { createWeatherState } from "../src/systems/weather";
import { normalizeGamePreferences } from "../src/systems/accessibility";
import { clickLayoutItem, waitForGameInputFrame } from "./helpers/layout";
import { pressGameKey } from "./helpers/input";
import { measureFrameWorkload } from "../hacks/lib/frameWorkload";

async function seedCampaign(page: Page): Promise<void> {
  const player = createPlayer("Scenery Fixture", {
    strength: 12, dexterity: 12, constitution: 12,
    intelligence: 10, wisdom: 10, charisma: 10,
  }, "ranger");
  player.progression.tutorial.completed = true;
  player.progression.seenCutsceneIds = [...CUTSCENE_IDS];
  const save = createCurrentSaveData(player, new Set(), createCodex(), player.appearanceId, 90, createWeatherState());
  if (!normalizeSaveData(structuredClone(save))) throw new Error("Invalid cutscene scenery fixture.");
  const preferences = normalizeGamePreferences({
    audio: { muted: true },
    accessibility: { reducedMotion: true },
    dice: { speed: "instant" },
  });
  await page.addInitScript(({ save, preferences }) => {
    localStorage.clear();
    localStorage.setItem("2dnd_save", JSON.stringify(save));
    localStorage.setItem("2dnd_preferences", JSON.stringify(preferences));
    let seed = 0x5ce0e;
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
  }, { save, preferences });
  await page.goto("game.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#debug-state")).toContainText("BOOT | Screen: title");
  await clickLayoutItem(page, "title-continue");
  await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
  await page.locator("#debug-checkbox").check();
  await waitForGameInputFrame(page);
}

async function launch(page: Page, id: CutsceneId): Promise<void> {
  const input = page.locator("#debug-cmd");
  await input.fill(`/cutsceneview ${id} knightLight unarmored`);
  await input.press("Enter");
  await input.blur();
  await expect(page.locator("#debug-state")).toContainText(
    id === CAMPAIGN_EPILOGUE_CUTSCENE_ID ? "ENDING | Step:" : `CUTSCENE | ${id}`,
  );
  await expect(page.locator("#debug-state")).toContainText(`Scenery: ${CUTSCENE_SCENERY[id].landmark}/`);
  await expect(page.locator("#debug-state")).toContainText("Input: ready");
}

async function leave(page: Page, id: CutsceneId): Promise<void> {
  await pressGameKey(page, "Escape");
  if (id === CAMPAIGN_EPILOGUE_CUTSCENE_ID) {
    await expect(page.locator("#debug-state")).toContainText("ENDING | Choices");
    await pressGameKey(page, "Enter");
  }
  await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
}

async function inspectBackground(page: Page, image: Buffer): Promise<{ colors: number; hash: string }> {
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 528;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0, 640, 528);
    // At reduced motion these first-frame actors start to the right of this scenery-only strip.
    const pixels = context.getImageData(0, 12, 112, 248).data;
    const colors = new Set<number>();
    for (let index = 0; index < pixels.length; index += 4) {
      colors.add(((pixels[index] >> 3) << 10) | ((pixels[index + 1] >> 3) << 5) | (pixels[index + 2] >> 3));
    }
    const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(pixels));
    const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return { colors: colors.size, hash };
  }, image.toString("base64"));
}

async function storyState(page: Page): Promise<unknown> {
  return page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem("2dnd_save")!);
    const { quests, seenCutsceneIds, pendingCutsceneIds } = save.player.progression;
    return { quests, seenCutsceneIds, pendingCutsceneIds };
  });
}

test("every cutscene has distinct colored scenery and replay never changes the story", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await seedCampaign(page);
  const before = await storyState(page);
  const directory = test.info().outputPath("scenery");
  await mkdir(directory, { recursive: true });
  const catalog: Array<{ id: CutsceneId; landmark: string; colors: number; hash: string }> = [];
  for (const id of CUTSCENE_IDS) {
    await launch(page, id);
    const image = await page.locator("#game-container canvas").screenshot({
      path: `${directory}/${id.replace(/\./g, "-")}.png`,
    });
    const pixels = await inspectBackground(page, image);
    expect(pixels.colors, id).toBeGreaterThanOrEqual(8);
    catalog.push({ id, landmark: CUTSCENE_SCENERY[id].landmark, ...pixels });
    if ([
      "campaign.opening", "boss.cryptLich.pre", "boss.kraken.pre", CAMPAIGN_EPILOGUE_CUTSCENE_ID,
    ].includes(id)) {
      const sample = await measureFrameWorkload(page);
      const metricsPath = `${directory}/${id.replace(/\./g, "-")}.frames.json`;
      await writeFile(metricsPath, JSON.stringify(sample, null, 2));
      await test.info().attach(`cutscene-frame-workload-${id}`, { path: metricsPath, contentType: "application/json" });
      expect(sample.canvasAttributeWrites, id).toBe(0);
      expect(sample.debugStateWrites, id).toBe(0);
      expect(sample.layoutReportWrites, id).toBe(0);
    }
    await leave(page, id);
  }
  const catalogPath = test.info().outputPath("scenery-catalog.json");
  await writeFile(catalogPath, JSON.stringify(catalog, null, 2));
  await test.info().attach("scenery-catalog", { path: catalogPath, contentType: "application/json" });
  expect(new Set(catalog.map((scene) => scene.hash)).size).toBe(CUTSCENE_IDS.length);
  expect(await storyState(page)).toEqual(before);
  expect(errors).toEqual([]);
});

import { expect, test, type Page } from "@playwright/test";
import { awardXP, createPlayer, processPendingLevelUps, xpForLevel } from "../src/systems/player";
import { createCodex } from "../src/systems/codex";
import { createCurrentSaveData } from "../src/systems/save";
import { createWeatherState } from "../src/systems/weather";
import { recruitCompanion } from "../src/systems/party";
import { reconcileAchievements } from "../src/systems/achievements";
import { executeFeatureDiscoveryDebugCommand, getEscapeMenuEntries, reconcileFeatureDiscovery } from "../src/systems/featureDiscovery";
import { FEATURE_IDS } from "../src/data/featureDiscovery";
import { CUTSCENE_IDS } from "../src/data/cutscenes";
import { CITIES } from "../src/data/cities";
import { ACHIEVEMENTS } from "../src/data/achievements";
import { clickLayoutItem, expectCleanLayout, tapLayoutItem } from "./helpers/layout";
import { installMinigameGamepad, minigameKey, minigamePad, seedMinigamePage, waitMinigameState } from "./helpers/minigames";
import type { SaveData } from "../src/systems/save";
import type { LayoutAuditItem, LayoutAuditResult } from "../src/systems/layout";

test.use({ hasTouch: true });
const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "landscape", width: 932, height: 430 },
  { name: "portrait", width: 390, height: 844 },
] as const;

type GroupLayout = LayoutAuditResult & { items: LayoutAuditItem[] };

function boundaryCampaign(): SaveData {
  const player = createPlayer("Mock Keeper", {
    strength: 15, dexterity: 15, constitution: 15,
    intelligence: 15, wisdom: 15, charisma: 15,
  }, "cleric");
  Object.assign(player.position, {
    inCity: true, cityId: "willowdale_city", cityChunkIndex: 0, x: 13, y: 12,
  });
  player.hp = Math.max(1, player.maxHp - 12);
  player.progression.tutorial.completed = true;
  player.progression.seenCutsceneIds = [...CUTSCENE_IDS];
  player.progression.discoveredCities = CITIES.map((city) => city.id);
  const codex = createCodex();
  reconcileAchievements({ player, codex, defeatedBosses: new Set() }, { notify: false });
  reconcileFeatureDiscovery(player, codex, { silent: true });
  return createCurrentSaveData(player, new Set(), codex, player.appearanceId, 45, createWeatherState());
}

test("city entry, location prompts and party characteristics remain bounded", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  const campaign = boundaryCampaign();
  const city = CITIES.find((entry) => entry.id === "willowdale_city");
  if (!city) throw new Error("Missing canonical city fixture");
  Object.assign(campaign.player.position, {
    inCity: false, cityId: "", chunkX: city.chunkX, chunkY: city.chunkY,
    x: city.tileX, y: city.tileY,
  });
  awardXP(campaign.player, xpForLevel(4));
  processPendingLevelUps(campaign.player);
  for (const companion of ["guardian", "scout", "mystic"]) recruitCompanion(campaign.player, companion);
  expect(campaign.player.pendingStatPoints).toBe(2);
  reconcileFeatureDiscovery(campaign.player, campaign.codex, { silent: true });
  await page.goto("game.html", { waitUntil: "networkidle" });
  await seedMinigamePage(page, campaign, "keyboard", { textScale: 1.5, touchControls: "on" });
  await waitMinigameState(page, "[PROGRESSION:stats");
  await clickLayoutItem(page, "progression-control-close");
  await expect(page.locator("#debug-state")).not.toContainText("[PROGRESSION:");
  await minigameKey(page, "Space");
  await waitMinigameState(page, `[CITY:${city.id}:0]`);
  await waitMinigameState(page, "[PROGRESSION:stats");
  await expect(page.locator("#debug-state")).toContainText("Points:2");
  await clickLayoutItem(page, "progression-control-close");
  await expect(page.locator("#debug-state")).not.toContainText("[PROGRESSION:");
  await expectGroupClean(page, "map-labels");
  await expectGroupClean(page, "world-hud");
  await capture(page, "city-entry");
  await minigameKey(page, "p");
  await waitMinigameState(page, "[PARTY:status]");
  await capture(page, "party-characteristics");
  await expectGroupClean(page, "party-status");
  await clickLayoutItem(page, "party-stat-strength-increase");
  await expectGroupClean(page, "party-status");
  await expect.poll(async () => {
    const raw = await page.evaluate(() => localStorage.getItem("2dnd_save"));
    const saved = raw ? JSON.parse(raw) as SaveData : undefined;
    return { strength: saved?.player.stats.strength, points: saved?.player.pendingStatPoints };
  }).toEqual({ strength: campaign.player.stats.strength + 1, points: 1 });
  await clickLayoutItem(page, "party-status-page-next");
  await expectGroupClean(page, "party-status");
  await capture(page, "party-attributes");
  await clickLayoutItem(page, "party-close");
  await expect(page.locator("#debug-state")).not.toContainText("[PARTY:");
  await expectVisibleCanvas(page);
  expect(errors).toEqual([]);
});

test("gamepad achievement paging and search retain visible focus through resize", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await installMinigameGamepad(page);
  await page.goto("game.html", { waitUntil: "networkidle" });
  await seedMinigamePage(page, boundaryCampaign(), "gamepad", { textScale: 1.5 });
  await minigameKey(page, "Escape");
  await clickLayoutItem(page, "escape-menu-achievements");
  await waitMinigameState(page, "[ACHIEVEMENTS");
  const before = await page.locator("#debug-state").textContent() ?? "";
  await minigamePad(page, 13);
  expect(await page.locator("#debug-state").textContent()).not.toBe(before);
  await minigamePad(page, 15);
  await expectGroupClean(page, "achievements");
  const selection = (await page.locator("#debug-state").textContent() ?? "").match(/Selected:[a-zA-Z0-9]+/)?.[0];
  expect(selection).toBeDefined();
  await page.setViewportSize({ width: 932, height: 430 });
  await expectVisibleCanvas(page);
  await expectGroupClean(page, "achievements");
  await expect(page.locator("#debug-state")).toContainText(selection!);
  await minigamePad(page, 2);
  await expect(page.locator("#controller-keyboard")).toBeVisible();
  await expectTextDialogFits(page);
  await minigamePad(page, 1);
  await expect(page.locator("#mobile-text-input")).toHaveCount(0);
  await expectGroupClean(page, "achievements");
  await minigamePad(page, 1);
  await expect(page.locator("#debug-state")).not.toContainText("[ACHIEVEMENTS");
  expect(errors).toEqual([]);
});

test("fully discovered menu keeps every enlarged action caption and page accessible", async ({ page }) => {
  const campaign = boundaryCampaign();
  for (const id of FEATURE_IDS) executeFeatureDiscoveryDebugCommand(campaign.player, `reveal ${id}`);
  const expected = getEscapeMenuEntries(campaign.player).map((entry) => `escape-menu-${entry.action}`);
  await page.goto("game.html", { waitUntil: "networkidle" });
  await seedMinigamePage(page, campaign, "touch", { textScale: 1.5, touchControls: "on" });
  await minigameKey(page, "Escape");
  await waitMinigameState(page, "[MENU]");
  const seen = new Set<string>();
  for (let index = 0; index < expected.length; index += 1) {
    const state = await page.locator("#debug-state").textContent() ?? "";
    const selected = state.match(/\[MENU_SELECTION:([a-zA-Z]+)/)?.[1];
    expect(selected).toBeDefined();
    await expect.poll(async () => (await readGroupLayout(page, "escape-menu"))?.items.map((item) => item.id))
      .toContain(`escape-menu-${selected}`);
    await expectGroupClean(page, "escape-menu");
    const report = await readGroupLayout(page, "escape-menu");
    report?.items.filter((item) => expected.includes(item.id)).forEach((item) => seen.add(item.id));
    if (seen.size === expected.length) break;
    await tapLayoutItem(page, "escape-menu-page-next");
  }
  expect(seen).toEqual(new Set(expected));
  await capture(page, "fully-discovered-menu");
  await expectVisibleCanvas(page);
  await minigameKey(page, "Escape");
});

async function capture(page: Page, name: string): Promise<void> {
  const path = test.info().outputPath(`${name}.png`);
  await page.screenshot({ path });
  await test.info().attach(name, { path, contentType: "image/png" });
}

async function expectVisibleCanvas(page: Page): Promise<void> {
  await expect.poll(async () => page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("#game-container canvas");
    const host = document.getElementById("game-container");
    if (!canvas || !host) return { fits: false };
    const bounds = canvas.getBoundingClientRect();
    const viewport = host.getBoundingClientRect();
    const fits = bounds.left >= viewport.left - 1 && bounds.right <= viewport.right + 1
      && bounds.top >= viewport.top - 1 && bounds.bottom <= viewport.bottom + 1
      && bounds.bottom <= innerHeight + 1;
    return { fits, canvas: bounds.toJSON(), host: viewport.toJSON(), viewportHeight: innerHeight };
  })).toMatchObject({ fits: true });
}

async function readGroupLayout(page: Page, id: string): Promise<GroupLayout | null> {
  return page.locator("#layout-report").evaluate((element, groupId) => {
    const report = JSON.parse(element.textContent ?? "{}") as {
      groups?: Record<string, GroupLayout>;
    };
    return report.groups?.[groupId] ?? null;
  }, id);
}

async function changePreferences(page: Page, cycleScale = false): Promise<void> {
  await page.evaluate(async (cycle) => {
    const path = "/2dnd/src/systems/accessibility.ts";
    const module: typeof import("../src/systems/accessibility") = await import(path);
    for (let step = 0; step < 3 && module.gamePreferences.getControls().touchControls !== "on"; step += 1) {
      module.gamePreferences.cycleTouchControls();
    }
    if (cycle) module.gamePreferences.cycleTextScale();
  }, cycleScale);
}

async function expectTextDialogFits(page: Page): Promise<void> {
  await expect.poll(() => page.locator("#mobile-text-input").evaluate((dialog) => {
    const bounds = dialog.getBoundingClientRect();
    const fields = Array.from(dialog.querySelectorAll("input, button[type=submit]"));
    return bounds.left >= 0 && bounds.right <= innerWidth + 1 && bounds.top >= 0 && bounds.bottom <= innerHeight + 1
      && fields.every((field) => {
        const rect = field.getBoundingClientRect();
        return rect.left >= bounds.left && rect.right <= bounds.right + 1
          && rect.top >= bounds.top && rect.bottom <= bounds.bottom + 1;
      });
  })).toBe(true);
}

async function expectGroupClean(page: Page, id: string): Promise<void> {
  await expect.poll(() => readGroupLayout(page, id)).toMatchObject({ overlaps: [], clipping: [] });
}

for (const textScale of [1, 1.25, 1.5] as const) {
  test(`character choices, stats and appearance fit at ${textScale * 100}% text`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto("game.html", { waitUntil: "networkidle" });
    await page.evaluate((scale) => {
      localStorage.clear();
      localStorage.setItem("2dnd_preferences", JSON.stringify({
        version: 3,
        audio: { muted: true },
        accessibility: { textScale: scale, highContrast: true, reducedMotion: true },
        controls: { touchControls: "on" },
      }));
    }, textScale);
    await page.reload({ waitUntil: "networkidle" });
    await clickLayoutItem(page, "title-new-game");
    await waitMinigameState(page, "BOOT | Screen: character");
    await capture(page, "character-classes");
    await expectGroupClean(page, "character-class");
    await clickLayoutItem(page, "creation-class-ranger");
    await clickLayoutItem(page, "creation-class-next");
    await waitMinigameState(page, "BOOT | Screen: stats");
    await capture(page, "character-stats-pointbuy");
    await expectGroupClean(page, "character-stats");
    await minigameKey(page, "ArrowRight");
    await waitMinigameState(page, "[STAT_VALUE:9]");
    await waitMinigameState(page, "[POINTS_REMAINING:26]");
    await expectGroupClean(page, "character-stats");
    await clickLayoutItem(page, "creation-stat-mode-random");
    await waitMinigameState(page, "[MODE:random]");
    const stats = await page.locator("#debug-state").textContent();
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await expectVisibleCanvas(page);
      await expectGroupClean(page, "character-stats");
    }
    expect(await page.locator("#debug-state").textContent()).toBe(stats);
    await clickLayoutItem(page, "creation-stats-next");
    await waitMinigameState(page, "BOOT | Screen: appearance");
    await capture(page, "character-appearance");
    await expectGroupClean(page, "character-appearance");
    await minigameKey(page, "ArrowRight");
    const appearance = await page.locator("#debug-state").textContent();
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await expectVisibleCanvas(page);
      await expectGroupClean(page, "character-appearance");
      await capture(page, `appearance-${viewport.name}`);
    }
    expect(await page.locator("#debug-state").textContent()).toBe(appearance);
    await expectCleanLayout(page);
    expect(errors).toEqual([]);
  });

  test(`save rows, nested text entry and achievements stay within bounds at ${textScale * 100}% text`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto("game.html", { waitUntil: "networkidle" });
    await seedMinigamePage(page, boundaryCampaign(), "keyboard", { textScale });
    await minigameKey(page, "e");
    await capture(page, "equipment-stats");
    await expectGroupClean(page, "equipment");
    await clickLayoutItem(page, "equip-skills-tab");
    await expectCleanLayout(page);
    await clickLayoutItem(page, "equip-spell-cureWounds");
    await expect(page.locator("#dice-presentation")).toBeVisible();
    await minigameKey(page, "e");
    await minigameKey(page, "Escape");
    await clickLayoutItem(page, "escape-menu-save");
    await waitMinigameState(page, "[SAVE_SLOTS:save]");
    await clickLayoutItem(page, "save-slot-action-save");
    await capture(page, "save-slots");
    await clickLayoutItem(page, "save-slot-action-rename");
    await expect(page.locator("#mobile-text-input")).toBeVisible();
    await capture(page, "save-name-modal");
    await page.locator("#mobile-text-input input").fill("Mock checkpoint boundary");
    await page.locator("#mobile-text-input button[type=submit]").click();
    await expect(page.locator("#mobile-text-input")).toHaveCount(0);
    await capture(page, "save-slots-long-name");
    await expectGroupClean(page, "save-slots");
    await changePreferences(page);
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await expectVisibleCanvas(page);
      await expectGroupClean(page, "save-slots");
      await capture(page, `save-slots-${viewport.name}`);
    }
    await tapLayoutItem(page, "save-slot-action-rename");
    await expect(page.locator("#mobile-text-input")).toBeVisible();
    await expectTextDialogFits(page);
    await capture(page, "save-name-portrait");
    await page.locator("#mobile-text-input").getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.locator("#mobile-text-input")).toHaveCount(0);
    await expectGroupClean(page, "save-slots");
    await waitMinigameState(page, "[SAVE_SLOT:manual-1]");
    const manualSnapshot = await page.evaluate(() => localStorage.getItem("2dnd_save_slot_manual-1"));
    await changePreferences(page, true);
    await expectGroupClean(page, "save-slots");
    await waitMinigameState(page, "[SAVE_SLOT:manual-1]");
    for (let index = 0; index < 2; index += 1) {
      await changePreferences(page, true);
      await expectGroupClean(page, "save-slots");
    }
    await expect(page.locator("#game-container canvas")).toHaveAttribute("data-text-scale", String(textScale));
    expect(await page.evaluate(() => localStorage.getItem("2dnd_save_slot_manual-1"))).toBe(manualSnapshot);
    await clickLayoutItem(page, "save-slot-action-close");
    await minigameKey(page, "Escape");
    await clickLayoutItem(page, "escape-menu-achievements");
    await waitMinigameState(page, "[ACHIEVEMENTS");
    await capture(page, "achievements");
    await expectGroupClean(page, "achievements");
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await expectVisibleCanvas(page);
      await expectGroupClean(page, "achievements");
      await capture(page, `achievements-${viewport.name}`);
    }
    if (textScale === 1.5) {
      const seen = new Set<string>();
      for (let index = 0; index < ACHIEVEMENTS.length; index += 1) {
        const state = await page.locator("#debug-state").textContent() ?? "";
        const selectedId = state.match(/Selected:([a-zA-Z0-9]+)/)?.[1];
        expect(selectedId).toBeDefined();
        await expect.poll(async () => (await readGroupLayout(page, "achievements"))?.items.map((item) => item.id))
          .toContain(`achievement-row-${selectedId}`);
        await expectGroupClean(page, "achievements");
        const group = await readGroupLayout(page, "achievements");
        group?.items.filter((item) => item.id.startsWith("achievement-row-"))
          .forEach((item) => seen.add(item.id.slice("achievement-row-".length)));
        const pageNumber = state.match(/Page:(\d+)\/(\d+)/);
        expect(pageNumber).not.toBeNull();
        if (pageNumber?.[1] === pageNumber?.[2]) break;
        await clickLayoutItem(page, "achievement-page-next");
      }
      expect(seen).toEqual(new Set(ACHIEVEMENTS.map((entry) => entry.id)));
      await capture(page, "achievements-last-page");
    }
    await clickLayoutItem(page, "achievement-page-next");
    await expectGroupClean(page, "achievements");
    await minigameKey(page, "ArrowLeft");
    await expectGroupClean(page, "achievements");
    await tapLayoutItem(page, "achievement-search");
    await expect(page.locator("#mobile-text-input")).toBeVisible();
    await expectTextDialogFits(page);
    await page.locator("#mobile-text-input input").fill("twelve roads");
    await page.locator("#mobile-text-input button[type=submit]").click();
    await waitMinigameState(page, "Selected:twelveCities");
    await expectGroupClean(page, "achievements");
    await clickLayoutItem(page, "achievement-equip-title");
    await expectGroupClean(page, "achievements");
    await expect(page.locator("#achievement-live-region")).toContainText("Twelve Roads");
    await expectCleanLayout(page);
    await clickLayoutItem(page, "achievement-close");
    await page.setViewportSize({ width: 1280, height: 800 });
    for (const { action, group } of [
      { action: "inventory", group: "party-items" },
      { action: "tips", group: "tips" },
      { action: "settings", group: "settings" },
    ]) {
      await minigameKey(page, "Escape");
      await clickLayoutItem(page, `escape-menu-${action}`);
      await expectGroupClean(page, group);
      await expectVisibleCanvas(page);
      await capture(page, `core-${action}`);
      if (action === "tips" && textScale === 1.5) {
        await clickLayoutItem(page, "tips-replay");
        for (let step = 0; step < 5; step += 1) {
          await expectGroupClean(page, "tutorial");
          await capture(page, `tutorial-${step}`);
          await clickLayoutItem(page, "tutorial-next");
        }
        await expectGroupClean(page, "tips");
      }
      await minigameKey(page, "Escape");
    }
    expect(errors).toEqual([]);
  });
}

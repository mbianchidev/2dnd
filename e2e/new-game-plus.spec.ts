import { expect, test, type Page } from "@playwright/test";
import { createCompletedCampaign } from "../tests/helpers/campaign";
import { allocateStatPoint, xpForLevel } from "../src/systems/player";
import type { SaveData } from "../src/systems/save";
import { clickLayoutItem, expectCleanLayout, tapLayoutItem } from "./helpers/layout";

async function holdKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(100);
  await page.keyboard.up(key);
  await page.waitForTimeout(100);
}

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  return errors;
}

async function readCampaign(page: Page, key = "2dnd_save"): Promise<SaveData> {
  return page.evaluate((storageKey) => {
    const raw = localStorage.getItem(storageKey);
    if (!raw) throw new Error(`Missing synthetic campaign ${storageKey}`);
    return JSON.parse(raw) as SaveData;
  }, key);
}

async function seedCompletedSource(page: Page, autosave = false, largeText = false): Promise<string> {
  const source = createCompletedCampaign("knight", 20);
  while (source.player.pendingStatPoints > 0) {
    if (!allocateStatPoint(source.player, "strength")) throw new Error("Cannot allocate fixture ASI");
  }
  source.player.xp = xpForLevel(21);
  source.player.progression.tutorial.completed = true;
  const raw = JSON.stringify(source);
  await page.addInitScript(({ bytes, automatic, large }) => {
    let seed = 0x172;
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x1_0000_0000;
    };
    if (!sessionStorage.getItem("ng-fixture-seeded")) {
      localStorage.clear();
      localStorage.setItem(automatic ? "2dnd_save" : "2dnd_save_slot_manual-1", bytes);
      localStorage.setItem("2dnd_save_slots_migrated_v1", "verified");
      localStorage.setItem("2dnd_preferences", JSON.stringify({
        version: 3, accessibility: { textScale: large ? 1.5 : 1, highContrast: large, reducedMotion: true },
      }));
      sessionStorage.setItem("ng-fixture-seeded", "true");
    }
  }, { bytes: raw, automatic: autosave, large: largeText });
  await page.goto("game.html", { waitUntil: "networkidle" });
  await expect(page.locator("#debug-state")).toContainText("BOOT | Screen: title");
  return raw;
}

async function skipOpening(page: Page): Promise<void> {
  for (let step = 0; step < 12; step++) {
    const state = await page.locator("#debug-state").textContent() ?? "";
    if (state.includes("OVERWORLD")) return;
    if (state.includes("CUTSCENE")) await holdKey(page, "Escape");
    else await page.waitForTimeout(100);
  }
  throw new Error("NG+ opening did not reach exploration");
}

async function chooseIndependentCycle(page: Page): Promise<void> {
  await clickLayoutItem(page, "save-slot-row-manual-1");
  await clickLayoutItem(page, "save-slot-action-confirm");
  await expect(page.locator("#debug-state")).toContainText("[NG_PLUS:destination]");
  await clickLayoutItem(page, "save-slot-row-manual-2");
  await clickLayoutItem(page, "save-slot-action-confirm");
  await expect(page.locator("#debug-state")).toContainText("[NG_PLUS:preview]");
}

test("NG+ preview/cancel is read-only, creation protects the manual source and epic rest survives reload", async ({ page }) => {
  const errors = watchErrors(page);
  const source = await seedCompletedSource(page);
  await clickLayoutItem(page, "title-new-game-plus");
  await chooseIndependentCycle(page);
  await expectCleanLayout(page);
  await holdKey(page, "Escape");
  await holdKey(page, "Escape");
  expect(await page.evaluate(() => localStorage.getItem("2dnd_save_slot_manual-1"))).toBe(source);
  expect(await page.evaluate(() => localStorage.getItem("2dnd_save_slot_manual-2"))).toBeNull();
  await clickLayoutItem(page, "title-new-game-plus");
  await chooseIndependentCycle(page);
  await page.keyboard.down("Enter");
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => localStorage.getItem("2dnd_save_slot_manual-2"))).toBeNull();
  await page.keyboard.up("Enter");
  await skipOpening(page);
  expect(await page.evaluate(() => localStorage.getItem("2dnd_save_slot_manual-1"))).toBe(source);
  const created = await readCampaign(page);
  expect(created.player.newGamePlus?.cycle).toBe(1);
  expect(created.player.level).toBe(20);
  expect(created.player.classProgression.readyLevelUps).toBe(0);
  expect(created.player.pendingLevelUps).toBe(1);
  await holdKey(page, "e");
  await clickLayoutItem(page, "equip-skills-tab");
  await clickLayoutItem(page, "hero-short-rest");
  await expect(page.locator("#debug-state")).toContainText("Track:epic:roadwarden");
  const prepared = await readCampaign(page);
  const receipt = prepared.player.classProgression.pendingLevel;
  expect(receipt).not.toBeNull();
  await holdKey(page, "Escape");
  await page.reload({ waitUntil: "networkidle" });
  await clickLayoutItem(page, "title-continue");
  await expect(page.locator("#debug-state")).toContainText("[PROGRESSION:level");
  expect((await readCampaign(page)).player.classProgression.pendingLevel).toEqual(receipt);
  await clickLayoutItem(page, "progression-primary");
  const advanced = await readCampaign(page);
  expect(advanced.player.level).toBe(21);
  expect(advanced.player.classProgression.classLevels).toEqual(created.player.classProgression.classLevels);
  expect(advanced.player.classProgression.trackLevels["epic:roadwarden"]).toBe(1);
  expect(advanced.player.knownTalents).toContain("roadwardenResolve");
  expect(await page.evaluate(() => localStorage.getItem("2dnd_save_slot_manual-1"))).toBe(source);
  expect(errors).toEqual([]);
});

test("touch snapshot-first selection and carry pages remain clean at 150% text", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  const errors = watchErrors(page);
  const source = await seedCompletedSource(page, true, true);
  await tapLayoutItem(page, "title-new-game-plus");
  await expectCleanLayout(page);
  await tapLayoutItem(page, "save-slot-action-confirm");
  await expect(page.locator("#debug-state")).toContainText("[NG_PLUS:snapshotTarget]");
  await tapLayoutItem(page, "save-slot-action-confirm");
  await expect(page.locator("#debug-state")).toContainText("[NG_PLUS:snapshotConfirm]");
  await expectCleanLayout(page);
  await tapLayoutItem(page, "save-slot-action-confirm");
  await expect(page.locator("#debug-state")).toContainText("[NG_PLUS:source]");
  const protectedSource = await page.evaluate(() => localStorage.getItem("2dnd_save_slot_manual-1"));
  expect(protectedSource).not.toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("2dnd_save"))).toBe(source);
  await tapLayoutItem(page, "save-slot-action-confirm");
  await expect(page.locator("#debug-state")).toContainText("[NG_PLUS:destination]");
  await tapLayoutItem(page, "save-slot-action-confirm");
  await expect(page.locator("#debug-state")).toContainText("[NG_PLUS:preview]");
  for (let row = 0; row < 12; row++) {
    await expect(page.locator("#debug-state")).toContainText(`[NG_ROW:${row}]`);
    await expectCleanLayout(page);
    await holdKey(page, "ArrowDown");
  }
  await tapLayoutItem(page, "save-slot-action-confirm");
  await skipOpening(page);
  expect(await page.evaluate(() => localStorage.getItem("2dnd_save_slot_manual-1"))).toBe(protectedSource);
  expect((await readCampaign(page)).player.newGamePlus?.cycle).toBe(1);
  expect(errors).toEqual([]);
});

test("native Tab focus selects Cancel rather than committing the focused source", async ({ page }) => {
  const source = await seedCompletedSource(page);
  await clickLayoutItem(page, "title-new-game-plus");
  const cancel = page.locator('[data-new-game-plus-action="cancel"]');
  for (let index = 0; index < 5; index++) await holdKey(page, "Tab");
  await expect(cancel).toBeFocused();
  await holdKey(page, "Enter");
  await expect(page.locator("#debug-state")).not.toContainText("[NG_PLUS:");
  expect(await page.evaluate(() => localStorage.getItem("2dnd_save_slot_manual-1"))).toBe(source);
  expect(await page.evaluate(() => localStorage.getItem("2dnd_save_slot_manual-2"))).toBeNull();
  expect(await page.locator("#new-game-plus-accessibility").count()).toBe(0);
});

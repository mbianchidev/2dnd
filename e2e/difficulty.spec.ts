import { expect, test, type Page } from "@playwright/test";
import type { DifficultyProfileId } from "../src/data/difficulty";
import { normalizeSaveData, SAVE_VERSION, type SaveData } from "../src/systems/save";
import { clickLayoutItem, expectCleanLayout, tapLayoutItem } from "./helpers/layout";

async function key(page: Page, name: string): Promise<void> {
  await page.keyboard.down(name);
  await page.waitForTimeout(90);
  await page.keyboard.up(name);
  await page.waitForTimeout(120);
}

async function gamePoint(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  const bounds = await page.locator("#game-container canvas").boundingBox();
  if (!bounds) throw new Error("Missing game canvas bounds");
  return { x: bounds.x + x / 640 * bounds.width, y: bounds.y + y / 528 * bounds.height };
}

async function clickGame(page: Page, x: number, y: number): Promise<void> {
  const point = await gamePoint(page, x, y);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(120);
}

async function state(page: Page, value: string): Promise<void> {
  await expect(page.locator("#debug-state")).toContainText(value);
}

async function readCampaign(page: Page): Promise<SaveData> {
  const serialized = await page.evaluate(() => localStorage.getItem("2dnd_save"));
  if (!serialized) throw new Error("Missing campaign document");
  const parsed: unknown = JSON.parse(serialized);
  const save = normalizeSaveData(parsed);
  if (!save) throw new Error("Campaign failed authoritative normalization");
  return save;
}

async function setup(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.addInitScript(() => {
    let seed = 171;
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x1_0000_0000;
    };
    if (!sessionStorage.getItem("difficulty-initialized")) {
      localStorage.clear();
      sessionStorage.setItem("difficulty-initialized", "true");
    }
  });
  await page.goto("game.html", { waitUntil: "networkidle" });
  await state(page, "BOOT | Screen: title");
  await clickLayoutItem(page, "title-settings");
  await clickLayoutItem(page, "settings-reduced-motion");
  await key(page, "Escape");
  return errors;
}

async function appearance(page: Page): Promise<void> {
  await clickLayoutItem(page, "title-new-game");
  await state(page, "Screen: character");
  await key(page, "Enter");
  await state(page, "Screen: stats");
  await clickGame(page, 390, 64);
  await clickGame(page, 400, 460);
  await state(page, "Screen: appearance");
}

async function chooseProfile(page: Page, profileId: DifficultyProfileId): Promise<void> {
  const offsets: Record<DifficultyProfileId, number> = {
    story: -1, standard: 0, veteran: 1, legendary: 2, custom: 3,
  };
  for (let index = 0; index < Math.abs(offsets[profileId]); index += 1) {
    await key(page, offsets[profileId] < 0 ? "ArrowLeft" : "ArrowRight");
  }
  await state(page, `[RULE_PROFILE:${profileId}]`);
}

async function opening(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const current = await page.locator("#debug-state").textContent() ?? "";
    if (current.includes("OVERWORLD")) {
      if (current.includes("[TUTORIAL]")) await key(page, "Escape");
      return;
    }
    await key(page, "Escape");
  }
  throw new Error("Opening did not reach safe exploration");
}

async function debug(page: Page, command: string): Promise<void> {
  await page.locator("#debug-checkbox").check();
  const input = page.locator("#debug-cmd");
  await input.fill(command);
  await input.press("Enter");
  await input.blur();
}

for (const profileId of ["story", "standard", "veteran", "legendary", "custom"] as const) {
  test(`${profileId} new-game selection survives save, title and reload`, async ({ page }) => {
    const errors = await setup(page);
    await appearance(page);
    await clickLayoutItem(page, "character-difficulty");
    await chooseProfile(page, profileId);
    await expectCleanLayout(page);
    if (profileId === "custom") {
      await key(page, "ArrowDown");
      await state(page, "[RULE_FOCUS:difficulty-rule-enemyHpPercent]");
      await key(page, "ArrowRight");
    }
    await clickLayoutItem(page, "difficulty-apply");
    await state(page, "Screen: appearance");
    await clickGame(page, 420, 312);
    await state(page, "CUTSCENE");
    const saved = await readCampaign(page);
    expect(saved.version).toBe(SAVE_VERSION);
    expect(saved.player.difficulty.selection.profileId).toBe(profileId);
    expect(saved.player.difficulty.initialProfileId).toBe(profileId);
    expect(saved.player.difficulty.changeCount).toBe(0);
    if (profileId === "custom") {
      expect(saved.player.difficulty.selection).toEqual({
        profileId: "custom", overrides: { enemyHpPercent: 105 },
      });
    }
    await page.reload({ waitUntil: "networkidle" });
    await state(page, "BOOT | Screen: title");
    await clickLayoutItem(page, "title-save-slots");
    await expect(page.locator("#save-slot-live-region")).toContainText(
      profileId[0]!.toUpperCase() + profileId.slice(1),
    );
    await expectCleanLayout(page);
    await key(page, "Escape");
    await clickLayoutItem(page, "title-continue");
    await state(page, "CUTSCENE");
    expect((await readCampaign(page)).player.difficulty).toEqual(saved.player.difficulty);
    expect(errors).toEqual([]);
  });
}

test("Custom previews remain clean at every text scale, contrast and reduced-motion setting", async ({ page }) => {
  const errors = await setup(page);
  await appearance(page);
  await clickLayoutItem(page, "character-difficulty");
  await chooseProfile(page, "custom");
  for (const scale of [1, 1.25, 1.5]) {
    await page.evaluate(async (value) => {
      const path = new URL("src/systems/accessibility.ts", location.href).pathname;
      const module: typeof import("../src/systems/accessibility") = await import(path);
      while (module.gamePreferences.getAccessibility().textScale !== value) {
        module.gamePreferences.cycleTextScale();
      }
      module.gamePreferences.setHighContrast(true);
      module.gamePreferences.setReducedMotion(true);
    }, scale);
    await expect(page.locator("#game-container canvas")).toHaveAttribute("data-text-scale", String(scale));
    for (let index = 0; index < 5; index += 1) {
      await expectCleanLayout(page);
      await clickLayoutItem(page, "difficulty-page-next");
    }
    await expect(page.getByRole("dialog", { name: "Campaign rules" })).toBeAttached();
  }
  await clickLayoutItem(page, "difficulty-close");
  await state(page, "Screen: appearance");
  expect(await page.evaluate(() => localStorage.getItem("2dnd_save"))).toBeNull();
  expect(errors).toEqual([]);
});

test("settings inspect live campaign rules without rewriting a manual source or classifying preferences", async ({ page }) => {
  const errors = await setup(page);
  await appearance(page);
  await clickLayoutItem(page, "character-difficulty");
  await chooseProfile(page, "veteran");
  await clickLayoutItem(page, "difficulty-apply");
  await clickGame(page, 420, 312);
  await opening(page);
  await key(page, "Escape");
  await clickLayoutItem(page, "escape-menu-settings");
  await state(page, "[SETTINGS]");
  const before = (await readCampaign(page)).player.difficulty;
  await clickLayoutItem(page, "settings-text-scale");
  await clickLayoutItem(page, "settings-high-contrast");
  await key(page, "Enter");
  await state(page, "[DIFFICULTY]");
  await state(page, "[RULE_PROFILE:veteran]");
  await expectCleanLayout(page);
  await key(page, "ArrowLeft");
  await state(page, "[RULE_PROFILE:standard]");
  await key(page, "Escape");
  await state(page, "[SETTINGS]");
  expect((await readCampaign(page)).player.difficulty).toEqual(before);
  expect(errors).toEqual([]);
});

test("safe mid-run changes require confirmation, persist causes and never replay outcomes or restore challenge credit", async ({ page }) => {
  const errors = await setup(page);
  await appearance(page);
  await clickLayoutItem(page, "character-difficulty");
  await chooseProfile(page, "veteran");
  await clickLayoutItem(page, "difficulty-apply");
  await clickGame(page, 420, 312);
  await opening(page);
  const before = await readCampaign(page);
  await page.evaluate(async () => {
    const path = new URL("src/systems/saveSlots.ts", location.href).pathname;
    const module: typeof import("../src/systems/saveSlots") = await import(path);
    const savePath = new URL("src/systems/save.ts", location.href).pathname;
    const saves: typeof import("../src/systems/save") = await import(savePath);
    const save = saves.loadGame();
    if (!save) throw new Error("Missing snapshot source");
    const result = module.saveGameToSlot("manual-1", save.player,
      new Set(save.defeatedBosses), save.codex, save.appearanceId,
      save.timeStep, save.weatherState);
    if (!result.ok) throw new Error(result.message);
  });
  const manualBytes = await page.evaluate(() => localStorage.getItem("2dnd_save_slot_manual-1"));
  const openRules = async (): Promise<void> => {
    await key(page, "Escape");
    await clickLayoutItem(page, "escape-menu-settings");
    await clickLayoutItem(page, "settings-difficulty");
    await state(page, "[DIFFICULTY]");
  };
  await openRules();
  await key(page, "ArrowLeft");
  await key(page, "ArrowLeft");
  await state(page, "[RULE_PROFILE:story]");
  await clickLayoutItem(page, "difficulty-apply");
  await state(page, "[RULE_PHASE:confirm]");
  expect((await readCampaign(page)).player.difficulty).toEqual(before.player.difficulty);
  await expectCleanLayout(page);
  await clickLayoutItem(page, "difficulty-close");
  await state(page, "[RULE_PHASE:edit]");
  expect((await readCampaign(page)).player.difficulty.changeCount).toBe(0);
  await clickLayoutItem(page, "difficulty-apply");
  await state(page, "[RULE_PHASE:confirm]");
  await clickLayoutItem(page, "difficulty-apply");
  await state(page, "[SETTINGS]");
  const changed = await readCampaign(page);
  expect(changed.player.difficulty).toMatchObject({
    selection: { profileId: "story" }, initialProfileId: "veteran", changeCount: 1,
    history: [{ sequence: 1, cause: "playerConfirmed", from: { profileId: "veteran" }, to: { profileId: "story" } }],
  });
  expect({
    gold: changed.player.gold, xp: changed.player.xp, hp: changed.player.hp, mp: changed.player.mp,
    quests: changed.player.progression.quests, inventory: changed.player.inventory,
    party: changed.player.party, social: changed.player.progression.social,
  }).toEqual({
    gold: before.player.gold, xp: before.player.xp, hp: before.player.hp, mp: before.player.mp,
    quests: before.player.progression.quests, inventory: before.player.inventory,
    party: before.player.party, social: before.player.progression.social,
  });
  expect(await page.evaluate(() => localStorage.getItem("2dnd_save_slot_manual-1"))).toBe(manualBytes);
  await clickLayoutItem(page, "settings-difficulty");
  await clickLayoutItem(page, "difficulty-apply");
  await state(page, "[SETTINGS]");
  expect((await readCampaign(page)).player.difficulty.changeCount).toBe(1);
  await clickLayoutItem(page, "settings-difficulty");
  await key(page, "ArrowRight");
  await key(page, "ArrowRight");
  await state(page, "[RULE_PROFILE:veteran]");
  await clickLayoutItem(page, "difficulty-apply");
  await clickLayoutItem(page, "difficulty-apply");
  expect((await readCampaign(page)).player.difficulty.changeCount).toBe(2);
  await page.reload({ waitUntil: "networkidle" });
  await clickLayoutItem(page, "title-save-slots");
  await expect(page.locator("#save-slot-live-region")).toContainText("changed");
  await key(page, "Escape");
  await clickLayoutItem(page, "title-continue");
  await state(page, "OVERWORLD");
  expect((await readCampaign(page)).player.difficulty).toMatchObject({
    selection: { profileId: "veteran" }, changeCount: 2,
  });
  expect(await page.evaluate(() => localStorage.getItem("2dnd_save_slot_manual-1"))).toBe(manualBytes);
  expect(errors).toEqual([]);
});

test("Custom mid-run edits preview exact values and failed autosaves roll back the campaign", async ({ page }) => {
  const errors = await setup(page);
  await appearance(page);
  await clickLayoutItem(page, "character-difficulty");
  await chooseProfile(page, "custom");
  await clickLayoutItem(page, "difficulty-apply");
  await clickGame(page, 420, 312);
  await opening(page);
  await key(page, "Escape");
  await clickLayoutItem(page, "escape-menu-settings");
  await clickLayoutItem(page, "settings-difficulty");
  await key(page, "ArrowDown");
  await key(page, "ArrowRight");
  await clickLayoutItem(page, "difficulty-apply");
  await state(page, "[RULE_PHASE:confirm]");
  const summary = await page.locator("#layout-report").textContent();
  expect(summary).toContain("difficulty-confirm-summary");
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Object.defineProperty(window, "__restoreDifficultyStorage", {
      configurable: true, value: () => { Storage.prototype.setItem = original; },
    });
    Storage.prototype.setItem = function(name: string, value: string): void {
      if (name.startsWith("2dnd_save")) throw new DOMException("Test quota exhausted", "QuotaExceededError");
      original.call(this, name, value);
    };
  });
  await clickLayoutItem(page, "difficulty-apply");
  await state(page, "[RULE_PHASE:confirm]");
  await expect(page.locator("#save-storage-alert")).toContainText("Save error");
  expect((await readCampaign(page)).player.difficulty).toMatchObject({
    selection: { profileId: "custom", overrides: {} }, changeCount: 0,
  });
  await page.evaluate(() => {
    (window as typeof window & { __restoreDifficultyStorage(): void }).__restoreDifficultyStorage();
  });
  await clickLayoutItem(page, "difficulty-apply");
  await state(page, "[SETTINGS]");
  expect((await readCampaign(page)).player.difficulty).toMatchObject({
    selection: { profileId: "custom", overrides: { enemyHpPercent: 105 } }, changeCount: 1,
  });
  expect(errors).toEqual([]);
});

test.describe("touch difficulty selection", () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  test("selects a bounded Custom profile through direct touch and semantic actions", async ({ page }) => {
    const errors = await setup(page);
    await appearance(page);
    await tapLayoutItem(page, "character-difficulty");
    await page.locator('[data-action="navigateRight"]').tap();
    await state(page, "[RULE_PROFILE:veteran]");
    await page.locator('[data-action="navigateRight"]').tap();
    await state(page, "[RULE_PROFILE:legendary]");
    await page.locator('[data-action="navigateRight"]').tap();
    await state(page, "[RULE_PROFILE:custom]");
    await page.locator('[data-action="navigateDown"]').tap();
    await state(page, "[RULE_FOCUS:difficulty-rule-enemyHpPercent]");
    await page.locator('[data-action="navigateRight"]').tap();
    await expectCleanLayout(page);
    await tapLayoutItem(page, "difficulty-apply");
    const point = await gamePoint(page, 420, 312);
    await page.touchscreen.tap(point.x, point.y);
    await state(page, "CUTSCENE");
    expect((await readCampaign(page)).player.difficulty.selection).toEqual({
      profileId: "custom", overrides: { enemyHpPercent: 105 },
    });
    await opening(page);
    await page.locator('[data-action="openMenu"]').tap();
    await tapLayoutItem(page, "escape-menu-settings");
    await tapLayoutItem(page, "settings-difficulty");
    await page.locator('[data-action="navigateDown"]').tap();
    await page.locator('[data-action="navigateRight"]').tap();
    await tapLayoutItem(page, "difficulty-apply");
    await state(page, "[RULE_PHASE:confirm]");
    await tapLayoutItem(page, "difficulty-apply");
    await state(page, "[SETTINGS]");
    expect((await readCampaign(page)).player.difficulty).toMatchObject({
      selection: { profileId: "custom", overrides: { enemyHpPercent: 110 } }, changeCount: 1,
    });
    expect(errors).toEqual([]);
  });
});

test("standard gamepad navigates the profile, measured controls and confirmation", async ({ page }) => {
  await page.addInitScript(() => {
    const pad = {
      id: "Difficulty test controller", index: 0, connected: true, mapping: "standard",
      timestamp: 0, axes: [0, 0, 0, 0], vibrationActuator: null,
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
    };
    Object.defineProperty(navigator, "getGamepads", { configurable: true, value: () => [pad] });
    Object.defineProperty(window, "__difficultyGamepad", {
      value: (index: number, pressed: boolean) => {
        pad.buttons[index] = { pressed, touched: pressed, value: pressed ? 1 : 0 };
        pad.timestamp += 1;
      },
    });
  });
  const press = async (button: number): Promise<void> => {
    await page.evaluate(async (index) => {
      const controls = window as typeof window & {
        __difficultyGamepad(index: number, pressed: boolean): void;
      };
      controls.__difficultyGamepad(index, true);
      try {
        await new Promise<void>((resolve) => requestAnimationFrame(() =>
          requestAnimationFrame(() => resolve())));
      } finally {
        controls.__difficultyGamepad(index, false);
      }
    }, button);
    await page.waitForTimeout(120);
  };
  const errors = await setup(page);
  await appearance(page);
  await clickLayoutItem(page, "character-difficulty");
  await press(15);
  await state(page, "[RULE_PROFILE:veteran]");
  await press(15);
  await state(page, "[RULE_PROFILE:legendary]");
  await press(13);
  await press(13);
  await state(page, "[RULE_FOCUS:difficulty-apply]");
  await press(0);
  await state(page, "Screen: appearance");
  await expect(page.locator("#game-container canvas")).toHaveAttribute("data-input-source", "gamepad");
  await press(0);
  await state(page, "CUTSCENE");
  expect((await readCampaign(page)).player.difficulty.selection.profileId).toBe("legendary");
  expect(errors).toEqual([]);
});

for (const profileId of ["story", "legendary"] as const) {
  test(`${profileId} reaches the real ending and retains rules in post-game`, async ({ page }) => {
    test.setTimeout(120000);
    const errors = await setup(page);
    await appearance(page);
    await clickLayoutItem(page, "character-difficulty");
    await chooseProfile(page, profileId);
    await clickLayoutItem(page, "difficulty-apply");
    await clickGame(page, 420, 312);
    await opening(page);
    await debug(page, "/quest set main lastForge");
    await debug(page, "/max_hp 999");
    await debug(page, "/heal");
    await debug(page, "/spawn infernoForgemaster");
    await state(page, "boss.infernoForgemaster.pre");
    await key(page, "Escape");
    await state(page, "BATTLE");
    await debug(page, "/kill");
    await state(page, "Phase: victory");
    await opening(page);
    await debug(page, "/tp Willowdale");
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if ((await page.locator("#debug-state").textContent())?.includes("[CITY:willowdale_city:0]")) break;
      await key(page, "Space");
    }
    await state(page, "[CITY:willowdale_city:0]");
    await debug(page, "/near willowdaleArchivist");
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const current = await page.locator("#debug-state").textContent() ?? "";
      if (current.includes("ENDING | Choices")) break;
      await key(page, current.includes("OVERWORLD") ? "Space" : "Escape");
    }
    await state(page, "ENDING | Choices");
    const ended = await readCampaign(page);
    expect(ended.player.progression.quests.quests.twelvefoldCovenant.status).toBe("completed");
    expect(ended.player.difficulty.selection.profileId).toBe(profileId);
    await key(page, "Enter");
    await state(page, "OVERWORLD");
    await page.reload({ waitUntil: "networkidle" });
    await clickLayoutItem(page, "title-continue");
    await state(page, "OVERWORLD");
    expect((await readCampaign(page)).player.difficulty.selection.profileId).toBe(profileId);
    expect(errors).toEqual([]);
  });
}

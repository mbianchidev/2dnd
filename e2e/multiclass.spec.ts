import { expect, test, type Page } from "@playwright/test";
import { clickLayoutItem, expectCleanLayout, layoutItemCenter, tapLayoutItem } from "./helpers/layout";
import type { BaseClassId } from "../src/data/classProgression";
import type { PlayerState, PlayerStats } from "../src/systems/player";

interface Campaign {
  version: number;
  player: PlayerState;
  defeatedBosses: string[];
}

const hybridStats: PlayerStats = {
  strength: 15, dexterity: 8, constitution: 13,
  intelligence: 15, wisdom: 10, charisma: 10,
};

async function readSave(page: Page): Promise<Campaign> {
  return page.evaluate(() => {
    const raw = localStorage.getItem("2dnd_save");
    if (!raw) throw new Error("Missing campaign save");
    return JSON.parse(raw) as Campaign;
  });
}

async function holdKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(90);
  await page.keyboard.up(key);
  await page.waitForTimeout(90);
}

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

async function seedCampaign(
  page: Page,
  starting: BaseClassId,
  stats: PlayerStats,
  totalEarned = 2,
  prepared = false,
  largeText = false,
): Promise<void> {
  await page.addInitScript(() => {
    Math.random = () => Number(sessionStorage.getItem("multiclass-roll") ?? "0.5");
    if (!sessionStorage.getItem("multiclass-initialized")) {
      localStorage.clear();
      sessionStorage.setItem("multiclass-initialized", "true");
    }
  });
  await page.goto("game.html", { waitUntil: "networkidle" });
  await expect(page.locator("#debug-state")).toContainText("BOOT | Screen: title");
  await page.evaluate(async (options) => {
    const prefix = location.pathname.slice(0, location.pathname.lastIndexOf("/") + 1);
    const playerPath = `${prefix}src/systems/player.ts`;
    const progressionPath = `${prefix}src/systems/classProgression.ts`;
    const savePath = `${prefix}src/systems/save.ts`;
    const codexPath = `${prefix}src/systems/codex.ts`;
    const cutscenePath = `${prefix}src/data/cutscenes.ts`;
    const itemPath = `${prefix}src/data/items.ts`;
    const preferencesPath = `${prefix}src/systems/accessibility.ts`;
    const players: typeof import("../src/systems/player") = await import(playerPath);
    const progression: typeof import("../src/systems/classProgression") = await import(progressionPath);
    const saves: typeof import("../src/systems/save") = await import(savePath);
    const codex: typeof import("../src/systems/codex") = await import(codexPath);
    const cutscenes: typeof import("../src/data/cutscenes") = await import(cutscenePath);
    const items: typeof import("../src/data/items") = await import(itemPath);
    const preferences: typeof import("../src/systems/accessibility") = await import(preferencesPath);
    const hero = players.createPlayer("Multiclass fixture", options.stats, options.starting);
    hero.progression.tutorial.completed = true;
    hero.progression.seenCutsceneIds = cutscenes.CUTSCENE_IDS
      .filter((id) => id !== cutscenes.CAMPAIGN_EPILOGUE_CUTSCENE_ID);
    hero.progression.pendingCutsceneIds = [];
    hero.progression.pendingFeatureRevealIds = [];
    const definition = items.getItem("leatherArmor");
    if (!definition) throw new Error("Missing armor fixture");
    const armor = { ...definition };
    hero.inventory.push(armor);
    hero.equippedArmor = armor;
    players.awardXP(hero, players.xpForLevel(options.totalEarned));
    hero.hp = 1;
    hero.mp = 0;
    if (options.prepared) progression.prepareHeroLevelUp(hero, () => 0.5);
    preferences.gamePreferences.setReducedMotion(true);
    if (options.largeText) {
      preferences.gamePreferences.cycleTextScale();
      preferences.gamePreferences.cycleTextScale();
      preferences.gamePreferences.setHighContrast(true);
    }
    const result = saves.saveGame(hero, new Set(), codex.createCodex(), hero.appearanceId);
    if (!result.ok) throw new Error(result.message);
  }, { starting, stats, totalEarned, prepared, largeText });
  await page.reload({ waitUntil: "networkidle" });
  await clickLayoutItem(page, "title-continue");
  await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
}

async function beginShortRest(page: Page): Promise<void> {
  await holdKey(page, "e");
  await clickLayoutItem(page, "equip-skills-tab");
  await clickLayoutItem(page, "hero-short-rest");
  await expect(page.locator("#debug-state")).toContainText("[PROGRESSION:level");
}

async function selectClass(page: Page, id: BaseClassId): Promise<void> {
  for (let index = 0; index < 12; index++) {
    const state = await page.locator("#debug-state").textContent() ?? "";
    if (state.includes(`Track:${id} `)) return;
    await holdKey(page, "ArrowDown");
  }
  throw new Error(`Cannot focus class ${id}`);
}

async function submitDebug(page: Page, command: string): Promise<void> {
  await page.locator("#debug-checkbox").check();
  const input = page.locator("#debug-cmd");
  await input.fill(command);
  await input.press("Enter");
  await input.blur();
}

const combinations: Array<{ starting: BaseClassId; next: BaseClassId; stats: PlayerStats }> = [
  { starting: "knight", next: "wizard", stats: hybridStats },
  { starting: "knight", next: "rogue", stats: {
    strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8,
  } },
  { starting: "wizard", next: "sorcerer", stats: {
    strength: 8, dexterity: 10, constitution: 12, intelligence: 15, wisdom: 13, charisma: 14,
  } },
];

for (const combination of combinations) {
  test(`${combination.starting}/${combination.next} previews, commits and reloads without bonus replay`, async ({ page }) => {
    const errors = watchErrors(page);
    await seedCampaign(page, combination.starting, combination.stats);
    const before = await readSave(page);
    await beginShortRest(page);
    await selectClass(page, combination.next);
    await expectCleanLayout(page);
    const prepared = await readSave(page);
    expect(prepared.player.classProgression.pendingLevel?.resourceRoll).toBe(0.5);
    const state = await page.locator("#debug-state").textContent() ?? "";
    const growth = / HP:(\d+) MP:(\d+)/.exec(state);
    if (!growth) throw new Error(`Missing exact growth preview: ${state}`);
    await holdKey(page, "Space");
    await expect(page.locator("#debug-state")).toContainText("[PROGRESSION:result");
    const committed = await readSave(page);
    expect(committed.version).toBe(19);
    expect(committed.player.level).toBe(2);
    expect(committed.player.classProgression.classLevels).toEqual({
      [combination.starting]: 1, [combination.next]: 1,
    });
    expect(committed.player.maxHp).toBe(before.player.maxHp + Number(growth[1]));
    expect(committed.player.maxMp).toBe(before.player.maxMp + Number(growth[2]));
    expect(committed.player.stats).toEqual(before.player.stats);
    expect(committed.player.position).toEqual(before.player.position);
    expect(committed.player.inventory).toEqual(before.player.inventory);
    expect(committed.player.appearanceId).toBe(combination.starting);
    expect(new Set(committed.player.knownSpells).size).toBe(committed.player.knownSpells.length);
    await holdKey(page, "Escape");
    await page.reload({ waitUntil: "networkidle" });
    await clickLayoutItem(page, "title-continue");
    await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
    const reloaded = await readSave(page);
    expect(reloaded.player.classProgression).toEqual(committed.player.classProgression);
    expect(reloaded.player.maxHp).toBe(committed.player.maxHp);
    expect(reloaded.player.maxMp).toBe(committed.player.maxMp);
    expect(reloaded.player.equippedArmor?.id).toBe("leatherArmor");
    expect(errors).toEqual([]);
  });
}

test("rested queues, frozen previews, ASIs and qualification survive interrupted choices", async ({ page }) => {
  const errors = watchErrors(page);
  await seedCampaign(page, "knight", hybridStats, 4);
  await beginShortRest(page);
  await selectClass(page, "wizard");
  await clickLayoutItem(page, "progression-primary");
  await expect(page.locator("#debug-state")).toContainText("[PROGRESSION:result");
  await holdKey(page, "Escape");
  await page.reload({ waitUntil: "networkidle" });
  await clickLayoutItem(page, "title-continue");
  await expect(page.locator("#debug-state")).toContainText("[PROGRESSION:level");
  await selectClass(page, "wizard");
  const prepared = (await readSave(page)).player.classProgression.pendingLevel;
  const forecast = await page.locator("#debug-state").textContent() ?? "";
  expect(prepared?.expectedTotalLevel).toBe(2);
  await page.evaluate(() => sessionStorage.setItem("multiclass-roll", "0.05"));
  await page.reload({ waitUntil: "networkidle" });
  await clickLayoutItem(page, "title-continue");
  await expect(page.locator("#debug-state")).toContainText("[PROGRESSION:level");
  await selectClass(page, "wizard");
  expect((await readSave(page)).player.classProgression.pendingLevel).toEqual(prepared);
  const repeatedForecast = await page.locator("#debug-state").textContent() ?? "";
  expect(repeatedForecast.match(/ HP:\d+ MP:\d+/)?.[0]).toBe(forecast.match(/ HP:\d+ MP:\d+/)?.[0]);
  await clickLayoutItem(page, "progression-primary");
  await clickLayoutItem(page, "progression-primary");
  await expect(page.locator("#debug-state")).toContainText("[PROGRESSION:level");
  await selectClass(page, "paladin");
  await expect(page.locator("#hero-progression-live-region")).toContainText("Requires");
  const locked = await readSave(page);
  await holdKey(page, "Enter");
  expect((await readSave(page)).player.classProgression).toEqual(locked.player.classProgression);
  await selectClass(page, "wizard");
  await clickLayoutItem(page, "progression-primary");
  await expect(page.locator("#debug-state")).toContainText("Total:4");
  await clickLayoutItem(page, "progression-primary");
  await expect(page.locator("#debug-state")).toContainText("[PROGRESSION:stats");
  for (let index = 0; index < 3; index++) await holdKey(page, "ArrowDown");
  const mp = (await readSave(page)).player.maxMp;
  await holdKey(page, "Enter");
  expect((await readSave(page)).player.maxMp).toBe(mp + 4);
  expect((await readSave(page)).player.pendingStatPoints).toBe(1);
  await expectCleanLayout(page);
  await holdKey(page, "Enter");
  expect((await readSave(page)).player.pendingStatPoints).toBe(0);
  expect((await readSave(page)).player.knownTalents.filter((id) => id === "toughness")).toHaveLength(1);
  await holdKey(page, "Escape");
  expect(errors).toEqual([]);
});

test.describe("mobile class selection", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  test("touch paging, 150% text and high contrast retain exact prepared gains", async ({ page }) => {
    const errors = watchErrors(page);
    await seedCampaign(page, "knight", hybridStats, 2, true, true);
    await expect(page.locator("#debug-state")).toContainText("[PROGRESSION:level");
    await expectCleanLayout(page);
    for (let index = 0; index < 12; index++) {
      const state = await page.locator("#debug-state").textContent() ?? "";
      const focused = /Track:([a-z]+)/.exec(state)?.[1];
      if (!focused) throw new Error("Missing mobile class focus");
      await layoutItemCenter(page, `progression-track-${focused}`);
      const report = await page.locator("#layout-report").textContent() ?? "";
      if (report.includes("progression-track-wizard")) break;
      await tapLayoutItem(page, "progression-control-next");
      await expect(page.locator("#debug-state")).not.toContainText(`Track:${focused} `);
    }
    await tapLayoutItem(page, "progression-track-wizard");
    await expect(page.locator("#debug-state")).toContainText("Track:wizard");
    await expectCleanLayout(page);
    await tapLayoutItem(page, "progression-primary");
    await expect(page.locator("#debug-state")).toContainText("[PROGRESSION:result");
    expect((await readSave(page)).player.level).toBe(2);
    await tapLayoutItem(page, "progression-control-close");
    await expect(page.locator("#debug-state")).not.toContainText("[PROGRESSION:");
    expect(errors).toEqual([]);
  });
});

test("gamepad D-pad/A/B navigate and confirm one class level without exploration input", async ({ page }) => {
  const errors = watchErrors(page);
  await page.addInitScript(() => {
    const pad = {
      id: "Multiclass fixture pad", index: 0, connected: true, mapping: "standard",
      timestamp: 1, axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
    };
    Object.defineProperty(navigator, "getGamepads", { configurable: true, value: () => [pad] });
    Object.defineProperty(window, "__multiclassButton", {
      value: (index: number, pressed: boolean) => {
        pad.buttons[index] = { pressed, touched: pressed, value: pressed ? 1 : 0 };
        pad.timestamp++;
      },
    });
  });
  const press = async (index: number): Promise<void> => {
    await page.evaluate((button) => {
      (window as typeof window & { __multiclassButton(index: number, pressed: boolean): void })
        .__multiclassButton(button, true);
    }, index);
    await page.waitForTimeout(120);
    await page.evaluate((button) => {
      (window as typeof window & { __multiclassButton(index: number, pressed: boolean): void })
        .__multiclassButton(button, false);
    }, index);
    await page.waitForTimeout(120);
  };
  await seedCampaign(page, "knight", hybridStats, 2, true);
  await expect(page.locator("#debug-state")).toContainText("[PROGRESSION:level");
  const position = (await readSave(page)).player.position;
  await press(13);
  await press(13);
  await expect(page.locator("#debug-state")).toContainText("Track:wizard");
  await press(0);
  await expect(page.locator("#debug-state")).toContainText("[PROGRESSION:result");
  expect((await readSave(page)).player.level).toBe(2);
  expect((await readSave(page)).player.position).toEqual(position);
  await press(1);
  await expect(page.locator("#debug-state")).not.toContainText("[PROGRESSION:");
  await expectCleanLayout(page);
  expect(errors).toEqual([]);
});

test("multiclass hero preserves campaign authority through the real final turn-in", async ({ page }) => {
  const errors = watchErrors(page);
  await seedCampaign(page, "knight", hybridStats);
  await beginShortRest(page);
  await selectClass(page, "wizard");
  await clickLayoutItem(page, "progression-primary");
  await holdKey(page, "Escape");
  await submitDebug(page, "/quest set main lastForge");
  await submitDebug(page, "/spawn infernoForgemaster");
  await expect(page.locator("#debug-state")).toContainText("BATTLE");
  await submitDebug(page, "/kill");
  await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
  await submitDebug(page, "/tp Willowdale");
  await holdKey(page, "Space");
  await expect(page.locator("#debug-state")).toContainText("[CITY:willowdale_city:0]");
  await submitDebug(page, "/near willowdaleArchivist");
  for (let index = 0; index < 4; index++) await holdKey(page, "Space");
  await expect.poll(async () => (await readSave(page)).player.progression.quests.quests.twelvefoldCovenant?.status)
    .toBe("completed");
  const save = await readSave(page);
  expect(save.player.classProgression.classLevels).toEqual({ knight: 1, wizard: 1 });
  expect(save.player.inventory.some((item) => item.id === "dawnforgedBlade")).toBe(true);
  expect(save.player.progression.quests.quests.twelvefoldCovenant.claimedRewards)
    .toContain("main.completionGold");
  await expect(page.locator("#debug-state")).toContainText("ENDING");
  expect(errors).toEqual([]);
});

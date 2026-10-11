import { expect, test, type Page } from "@playwright/test";
import { clickLayoutItem, expectCleanLayout, tapLayoutItem } from "./helpers/layout";
import type { PrestigePathId } from "../src/data/prestige";
import type { BaseClassId } from "../src/data/classProgression";
import type { PlayerState, PlayerStats } from "../src/systems/player";
import type { SaveData } from "../src/systems/save";

const cases: Array<{ id: PrestigePathId; starting: BaseClassId; stats: PlayerStats }> = [
  { id: "roadglassBulwark", starting: "knight", stats: {
    strength: 15, dexterity: 12, constitution: 13, intelligence: 10, wisdom: 8, charisma: 14,
  } },
  { id: "prismScribe", starting: "wizard", stats: {
    strength: 10, dexterity: 12, constitution: 14, intelligence: 15, wisdom: 13, charisma: 8,
  } },
  { id: "hearthlightCustodian", starting: "cleric", stats: {
    strength: 12, dexterity: 8, constitution: 14, intelligence: 10, wisdom: 15, charisma: 13,
  } },
  { id: "rootwakeKeeper", starting: "druid", stats: {
    strength: 10, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 15, charisma: 8,
  } },
  { id: "duskthreadCourier", starting: "rogue", stats: {
    strength: 10, dexterity: 15, constitution: 13, intelligence: 12, wisdom: 8, charisma: 14,
  } },
  { id: "chordsteelEnvoy", starting: "knight", stats: {
    strength: 15, dexterity: 10, constitution: 12, intelligence: 13, wisdom: 8, charisma: 14,
  } },
];

async function readSave(page: Page): Promise<SaveData> {
  return page.evaluate(() => {
    const raw = localStorage.getItem("2dnd_save");
    if (!raw) throw new Error("Missing prestige campaign");
    return JSON.parse(raw) as SaveData;
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
  id: PrestigePathId,
  options: { prepared?: boolean; naturalSource?: boolean; largeText?: boolean } = {},
): Promise<void> {
  const fixture = cases.find((entry) => entry.id === id);
  if (!fixture) throw new Error("Unknown fixture path");
  await page.addInitScript(() => {
    let seed = 0x170;
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x1_0000_0000;
    };
    if (!sessionStorage.getItem("prestige-initialized")) {
      localStorage.clear();
      sessionStorage.setItem("prestige-initialized", "true");
    }
  });
  await page.goto("game.html", { waitUntil: "networkidle" });
  await expect(page.locator("#debug-state")).toContainText("BOOT | Screen: title");
  await page.evaluate(async (input) => {
    const prefix = location.pathname.slice(0, location.pathname.lastIndexOf("/") + 1);
    const players: typeof import("../src/systems/player") = await import(`${prefix}src/systems/player.ts`);
    const progression: typeof import("../src/systems/classProgression") = await import(`${prefix}src/systems/classProgression.ts`);
    const saves: typeof import("../src/systems/save") = await import(`${prefix}src/systems/save.ts`);
    const codex: typeof import("../src/systems/codex") = await import(`${prefix}src/systems/codex.ts`);
    const cutscenes: typeof import("../src/data/cutscenes") = await import(`${prefix}src/data/cutscenes.ts`);
    const preferences: typeof import("../src/systems/accessibility") = await import(`${prefix}src/systems/accessibility.ts`);
    const factions: typeof import("../src/data/reputation") = await import(`${prefix}src/data/reputation.ts`);
    const hero = players.createPlayer("Prestige browser fixture", input.fixture.stats, input.fixture.starting);
    if (!players.isValidPointBuy(input.fixture.stats)) throw new Error("Fixture must use legal point buy");
    players.awardXP(hero, players.xpForLevel(input.fixture.id === "chordsteelEnvoy" ? 4 : 6));
    players.processPendingLevelUps(hero);
    if (input.fixture.id === "chordsteelEnvoy") {
      for (let total = 4; total < 6; total++) {
        players.awardXP(hero, players.xpForLevel(total + 1) - hero.xp);
        progression.prepareHeroLevelUp(hero, () => 0.5);
        const result = progression.commitHeroLevelUp(hero, { trackId: "wizard", expectedTotalLevel: total });
        if (!result.ok) throw new Error(result.message);
      }
    }
    hero.progression.tutorial.completed = true;
    hero.progression.seenCutsceneIds = cutscenes.CUTSCENE_IDS.filter((entry) =>
      entry !== cutscenes.CAMPAIGN_EPILOGUE_CUTSCENE_ID);
    hero.progression.pendingCutsceneIds = [];
    hero.progression.pendingFeatureRevealIds = [];
    if (!input.options.naturalSource) {
      for (const faction of factions.FACTION_DEFINITIONS) {
        hero.progression.social.factionReputation[faction.id] = 15;
      }
      hero.progression.discoveredCities = ["shadowfen_city", "deeproot_city"];
    }
    players.awardXP(hero, players.xpForLevel(7) - hero.xp);
    hero.hp = 1;
    hero.mp = 0;
    if (input.options.prepared) progression.prepareHeroLevelUp(hero, () => 0.5);
    preferences.gamePreferences.setReducedMotion(true);
    if (input.options.largeText) {
      preferences.gamePreferences.cycleTextScale();
      preferences.gamePreferences.cycleTextScale();
      preferences.gamePreferences.setHighContrast(true);
    }
    const result = saves.saveGame(hero, new Set(), codex.createCodex(), hero.appearanceId);
    if (!result.ok) throw new Error(result.message);
  }, { fixture, options });
  await page.reload({ waitUntil: "networkidle" });
  await clickLayoutItem(page, "title-continue");
  await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
  if (!options.prepared) {
    await expect(page.locator("#debug-state")).toContainText("[PROGRESSION:stats");
    await holdKey(page, "Escape");
    await expect(page.locator("#debug-state")).not.toContainText("[PROGRESSION:");
  }
}

async function beginShortRest(page: Page): Promise<void> {
  await holdKey(page, "e");
  await clickLayoutItem(page, "equip-skills-tab");
  await clickLayoutItem(page, "hero-short-rest");
  await expect(page.locator("#debug-state")).toContainText("[PROGRESSION:level");
}

async function selectPath(page: Page, id: PrestigePathId): Promise<void> {
  for (let index = 0; index < 18; index++) {
    if ((await page.locator("#debug-state").textContent())?.includes(`Track:prestige:${id} `)) return;
    await holdKey(page, "ArrowDown");
  }
  throw new Error(`Cannot select prestige:${id}`);
}

async function submitDebug(page: Page, command: string): Promise<void> {
  await page.locator("#debug-checkbox").check();
  await page.locator("#debug-cmd").fill(command);
  await page.locator("#debug-cmd").press("Enter");
  await page.locator("#debug-cmd").blur();
}

for (const fixture of cases) {
  test(`${fixture.id} previews, advances one real rested level and survives reload`, async ({ page }) => {
    const errors = watchErrors(page);
    await seedCampaign(page, fixture.id);
    const before = await readSave(page);
    await beginShortRest(page);
    await selectPath(page, fixture.id);
    await expect(page.locator("#hero-progression-live-region")).toContainText("Rank 5:");
    await expectCleanLayout(page);
    const prepared = await readSave(page);
    const snapshot = prepared.player.classProgression.pendingLevel;
    if (!snapshot) throw new Error("Missing frozen rest receipt");
    await holdKey(page, "Escape");
    await page.reload({ waitUntil: "networkidle" });
    await clickLayoutItem(page, "title-continue");
    await expect(page.locator("#debug-state")).toContainText("[PROGRESSION:level");
    await selectPath(page, fixture.id);
    expect((await readSave(page)).player.classProgression.pendingLevel).toEqual(snapshot);
    await page.keyboard.down("Enter");
    await page.waitForTimeout(150);
    await page.keyboard.up("Enter");
    await expect(page.locator("#debug-state")).toContainText("[PROGRESSION:result");
    const committed = await readSave(page);
    expect(committed.version).toBe(20);
    expect(committed.player.level).toBe(7);
    expect(committed.player.classProgression.classLevels).toEqual(before.player.classProgression.classLevels);
    expect(committed.player.classProgression.trackLevels).toEqual({ [`prestige:${fixture.id}`]: 1 });
    expect(committed.player.classProgression.readyLevelUps).toBe(0);
    expect(committed.player.pendingLevelUps).toBe(0);
    expect(committed.player.stats).toEqual(before.player.stats);
    expect(committed.player.inventory).toEqual(before.player.inventory);
    expect(committed.player.appearanceId).toBe(fixture.starting);
    expect(committed.player.progression.achievements.earned.map((entry) => entry.id)).toContain("prestigeInitiate");
    await holdKey(page, "Escape");
    await page.reload({ waitUntil: "networkidle" });
    await clickLayoutItem(page, "title-continue");
    await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
    const reloaded = await readSave(page);
    expect(reloaded.player.classProgression).toEqual(committed.player.classProgression);
    expect(reloaded.player.maxHp).toBe(committed.player.maxHp);
    expect(reloaded.player.maxMp).toBe(committed.player.maxMp);
    expect(errors).toEqual([]);
  });
}

test("natural city discovery changes rejection into entry and executes a real prestige battle action", async ({ page }) => {
  const errors = watchErrors(page);
  await seedCampaign(page, "rootwakeKeeper", { naturalSource: true });
  await beginShortRest(page);
  await selectPath(page, "rootwakeKeeper");
  await expect(page.locator("#hero-progression-live-region")).toContainText("Requires");
  const rejected = await readSave(page);
  await holdKey(page, "Enter");
  expect((await readSave(page)).player.classProgression).toEqual(rejected.player.classProgression);
  await holdKey(page, "Escape");
  await submitDebug(page, "/tp Deeproot");
  for (let attempt = 0; attempt < 4; attempt++) {
    await holdKey(page, "Space");
    if ((await page.locator("#debug-state").textContent())?.includes("[CITY:deeproot_city:0]")) break;
  }
  await expect(page.locator("#debug-state")).toContainText("[CITY:deeproot_city:0]");
  expect((await readSave(page)).player.progression.discoveredCities).toContain("deeproot_city");
  await expect(page.locator("#debug-state")).toContainText("[PROGRESSION:level");
  await selectPath(page, "rootwakeKeeper");
  expect((await readSave(page)).player.classProgression.pendingLevel)
    .toEqual(rejected.player.classProgression.pendingLevel);
  await clickLayoutItem(page, "progression-primary");
  await clickLayoutItem(page, "progression-primary");
  await expect(page.locator("#debug-state")).toContainText("[PROGRESSION:stats");
  await clickLayoutItem(page, "progression-primary");
  await clickLayoutItem(page, "progression-primary");
  await holdKey(page, "Escape");
  const committed = await readSave(page);
  await submitDebug(page, "/spawn goblin");
  await expect(page.locator("#debug-state")).toContainText("Phase: playerTurn");
  await clickLayoutItem(page, "battle-action-abilities");
  await clickLayoutItem(page, "battle-ability-rootwakeLash");
  await holdKey(page, "Enter");
  await expect(page.locator("#debug-log")).toContainText("Player Ability rootwakeLash");
  if ((await page.locator("#debug-state").textContent())?.includes("BATTLE")) await submitDebug(page, "/kill");
  await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
  const returned = await readSave(page);
  expect(returned.player.mp).toBe(committed.player.mp - 5);
  expect(returned.player.classProgression.trackLevels).toEqual({ "prestige:rootwakeKeeper": 1 });
  expect(returned.codex.unlockedEntryIds).toContain("historyPrestigeRootwakeKeeper");
  expect(errors).toEqual([]);
});

test.describe("touch prestige inspection", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  test("touch pages and 150% text retain clean portrait and landscape qualification layouts", async ({ page }) => {
    const errors = watchErrors(page);
    await seedCampaign(page, "rootwakeKeeper", { prepared: true, largeText: true });
    await expect(page.locator("#debug-state")).toContainText("[PROGRESSION:level");
    const target = "progression-track-prestige:rootwakeKeeper";
    for (let index = 0; index < 18; index++) {
      const report = await page.locator("#layout-report").textContent() ?? "";
      if (report.includes(`"${target}"`)) break;
      await tapLayoutItem(page, "progression-control-next");
    }
    await tapLayoutItem(page, target);
    await expectCleanLayout(page);
    await tapLayoutItem(page, "progression-control-details");
    await expectCleanLayout(page);
    await page.setViewportSize({ width: 844, height: 390 });
    await expectCleanLayout(page);
    await tapLayoutItem(page, "progression-primary");
    await expect(page.locator("#debug-state")).toContainText("[PROGRESSION:result");
    expect((await readSave(page)).player.classProgression.trackLevels).toEqual({ "prestige:rootwakeKeeper": 1 });
    expect(errors).toEqual([]);
  });
});

test("gamepad D-pad, A and B enter one path without leaking input to exploration", async ({ page }) => {
  const errors = watchErrors(page);
  await page.addInitScript(() => {
    const pad = {
      id: "Prestige mock controller", index: 0, connected: true, mapping: "standard", timestamp: 1,
      axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({
        pressed: false, touched: false, value: 0,
      })),
    };
    Object.defineProperty(navigator, "getGamepads", { configurable: true, value: () => [pad] });
    Object.defineProperty(window, "__prestigeButton", { value: (index: number, pressed: boolean) => {
      pad.buttons[index] = { pressed, touched: pressed, value: pressed ? 1 : 0 };
      pad.timestamp++;
    } });
  });
  const press = async (index: number): Promise<void> => {
    await page.evaluate((button) => (window as typeof window & {
      __prestigeButton(index: number, pressed: boolean): void;
    }).__prestigeButton(button, true), index);
    await page.waitForTimeout(100);
    await page.evaluate((button) => (window as typeof window & {
      __prestigeButton(index: number, pressed: boolean): void;
    }).__prestigeButton(button, false), index);
    await page.waitForTimeout(100);
  };
  await seedCampaign(page, "rootwakeKeeper", { prepared: true });
  await expect(page.locator("#debug-state")).toContainText("[PROGRESSION:level");
  const position = (await readSave(page)).player.position;
  for (let index = 0; index < 18; index++) {
    if ((await page.locator("#debug-state").textContent())?.includes("Track:prestige:rootwakeKeeper ")) break;
    await press(13);
  }
  await expect(page.locator("#debug-state")).toContainText("Track:prestige:rootwakeKeeper");
  await press(0);
  await expect(page.locator("#debug-state")).toContainText("[PROGRESSION:result");
  expect((await readSave(page)).player.position).toEqual(position);
  expect((await readSave(page)).player.level).toBe(7);
  await press(1);
  await expect(page.locator("#debug-state")).not.toContainText("[PROGRESSION:");
  expect(errors).toEqual([]);
});

test("a prestige hero completes the real final turn-in and retains ranks post-game", async ({ page }) => {
  const errors = watchErrors(page);
  await seedCampaign(page, "rootwakeKeeper", { prepared: true });
  await selectPath(page, "rootwakeKeeper");
  await clickLayoutItem(page, "progression-primary");
  await clickLayoutItem(page, "progression-primary");
  await expect(page.locator("#debug-state")).toContainText("[PROGRESSION:stats");
  await clickLayoutItem(page, "progression-primary");
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
  await expect(page.locator("#debug-state")).toContainText("ENDING");
  const completed = await readSave(page);
  expect(completed.player.progression.quests.quests.twelvefoldCovenant.status).toBe("completed");
  expect(completed.player.classProgression.trackLevels).toEqual({ "prestige:rootwakeKeeper": 1 });
  expect(completed.player.inventory.some((item) => item.id === "dawnforgedBlade")).toBe(true);
  for (let step = 0; step < 80; step++) {
    const state = await page.locator("#debug-state").textContent() ?? "";
    if (state.includes("ENDING | Choices")) break;
    await holdKey(page, "Space");
  }
  await expect(page.locator("#debug-state")).toContainText("ENDING | Choices");
  await page.keyboard.down("Enter");
  await page.waitForTimeout(350);
  await page.keyboard.up("Enter");
  await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
  await page.reload({ waitUntil: "networkidle" });
  await clickLayoutItem(page, "title-continue");
  await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
  expect((await readSave(page)).player.classProgression.trackLevels).toEqual({ "prestige:rootwakeKeeper": 1 });
  expect(errors).toEqual([]);
});

import { expect, test, type Page } from "@playwright/test";
import { clickLayoutItem } from "./helpers/layout";

const SAVE_KEY = "2dnd_save";
const PREFERENCES_KEY = "2dnd_preferences";
const OPENING_CUTSCENE_IDS = [
  "campaign.opening",
  "campaign.stage.firstSeal",
] as const;
const GAME_WIDTH = 640;
const GAME_HEIGHT = 528;

interface BrowserItem {
  id: string;
  name: string;
  description: string;
  type: string;
  cost: number;
  effect: number;
}

interface BrowserSave {
  version: number;
  player: {
    inventory: BrowserItem[];
    equippedWeapon: BrowserItem | null;
    position: {
      x: number;
      y: number;
      inCity: boolean;
      cityId: string;
      cityChunkIndex: number;
      inDungeon: boolean;
      dungeonId: string;
      dungeonLevel: number;
    };
    progression: {
      seenCutsceneIds: string[];
      pendingCutsceneIds: string[];
      tutorial: { completed: boolean };
      crafting: {
        statistics: {
          totalCrafts: number;
          equipmentUpgrades: number;
        };
        recentHistory: Array<{
          recipeId: string;
          quantity: number;
          debug: boolean;
        }>;
      };
    };
  };
}

async function holdKey(
  page: Page,
  key: string,
  duration = 180,
): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(duration);
  await page.keyboard.up(key);
  await page.waitForTimeout(140);
}

async function clickGame(
  page: Page,
  gameX: number,
  gameY: number,
): Promise<void> {
  const canvas = page.locator("#game-container canvas");
  await expect(canvas).toBeVisible();
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Game canvas has no rendered bounds");
  await page.mouse.click(
    bounds.x + (gameX / GAME_WIDTH) * bounds.width,
    bounds.y + (gameY / GAME_HEIGHT) * bounds.height,
  );
  await page.waitForTimeout(140);
}

async function waitForState(page: Page, text: string): Promise<void> {
  await expect(page.locator("#debug-state")).toContainText(text);
}

async function createCharacter(page: Page): Promise<void> {
  await page.goto("./", { waitUntil: "networkidle" });
  await waitForState(page, "BOOT | Screen: title");
  await clickGame(page, 320, 324);
  await waitForState(page, "BOOT | Screen: character");
  await clickGame(page, 284, 160);
  await holdKey(page, "Enter");
  await waitForState(page, "BOOT | Screen: stats");
  await clickGame(page, 390, 64);
  await clickGame(page, 400, 460);
  await waitForState(page, "BOOT | Screen: appearance");
  await clickGame(page, 320, 112);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await clickGame(page, 420, 312);
    await page.waitForTimeout(300);
    const state = await page.locator("#debug-state").textContent() ?? "";
    if (state.includes("CUTSCENE")) break;
  }
  await waitForState(page, "CUTSCENE");
  await page.evaluate(({ saveKey, openingCutsceneIds }) => {
    const raw = localStorage.getItem(saveKey);
    if (!raw) throw new Error("Missing new-character save");
    const save = JSON.parse(raw) as BrowserSave;
    save.player.progression.pendingCutsceneIds = [];
    save.player.progression.tutorial.completed = true;
    for (const id of openingCutsceneIds) {
      if (!save.player.progression.seenCutsceneIds.includes(id)) {
        save.player.progression.seenCutsceneIds.push(id);
      }
    }
    localStorage.setItem(saveKey, JSON.stringify(save));
  }, { saveKey: SAVE_KEY, openingCutsceneIds: OPENING_CUTSCENE_IDS });
  await page.reload({ waitUntil: "networkidle" });
  await waitForState(page, "BOOT | Screen: title");
  await clickGame(page, 320, 324);
  await waitForState(page, "OVERWORLD");
}

async function submitDebug(page: Page, command: string): Promise<void> {
  const checkbox = page.locator("#debug-checkbox");
  if (!await checkbox.isChecked()) await checkbox.check();
  const input = page.locator("#debug-cmd");
  await input.fill(command);
  await input.press("Enter");
  await input.blur();
  await page.locator("#game-container canvas").click();
  await page.waitForTimeout(180);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("craftingTestInitialized")) {
      localStorage.clear();
      sessionStorage.setItem("craftingTestInitialized", "true");
    }
    let seed = 0x56;
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x1_0000_0000;
    };
  });
});

test("crafts batches and upgrades across reloads and responsive locations", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  await createCharacter(page);
  await submitDebug(page, "/craft material wildHerbs 4");

  await holdKey(page, "v");
  await waitForState(page, "[CRAFTING");
  await page.keyboard.press("f");
  const search = page.locator("#mobile-text-input input");
  await expect(search).toBeVisible();
  await search.fill("field potion");
  await page.locator("#mobile-text-input").evaluate((form) => {
    (form as HTMLFormElement).requestSubmit();
  });
  await waitForState(page, "Recipe:fieldPotion");
  await page.keyboard.press("ArrowRight");
  await waitForState(page, "Batch:2");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  await holdKey(page, "Escape");

  const crafted = await page.evaluate((saveKey) => {
    const save = JSON.parse(localStorage.getItem(saveKey)!) as BrowserSave;
    return {
      version: save.version,
      potionCount: save.player.inventory.filter((item) => item.id === "potion").length,
      totalCrafts: save.player.progression.crafting.statistics.totalCrafts,
      history: save.player.progression.crafting.recentHistory,
    };
  }, SAVE_KEY);
  expect(crafted).toMatchObject({
    version: 16,
    potionCount: 2,
    totalCrafts: 2,
  });
  expect(crafted.history[crafted.history.length - 1]).toMatchObject({
    recipeId: "fieldPotion",
    quantity: 2,
    debug: false,
  });

  await page.reload({ waitUntil: "networkidle" });
  await waitForState(page, "BOOT | Screen: title");
  await clickGame(page, 320, 324);
  await waitForState(page, "OVERWORLD");
  await holdKey(page, "v");
  await waitForState(page, "[CRAFTING");
  await holdKey(page, "Escape");
  await submitDebug(page, "/item shortSword");
  await submitDebug(page, "/craft material ironOre 3");
  await submitDebug(page, "/craft unlock temperedLongSword");
  await page.evaluate(({ saveKey, preferencesKey }) => {
    const save = JSON.parse(localStorage.getItem(saveKey)!) as BrowserSave;
    const shortSword = save.player.inventory.find((item) =>
      item.id === "shortSword"
    );
    if (!shortSword) throw new Error("Missing short sword");
    save.player.equippedWeapon = shortSword;
    save.player.position.inCity = true;
    save.player.position.cityId = "ironhold_city";
    save.player.position.cityChunkIndex = 0;
    save.player.position.inDungeon = false;
    save.player.position.dungeonId = "";
    save.player.position.dungeonLevel = 0;
    save.player.position.x = 10;
    save.player.position.y = 13;
    localStorage.setItem(saveKey, JSON.stringify(save));
    localStorage.setItem(preferencesKey, JSON.stringify({
      accessibility: {
        textScale: 1.5,
        highContrast: true,
        reducedMotion: true,
      },
    }));
  }, { saveKey: SAVE_KEY, preferencesKey: PREFERENCES_KEY });
  await page.reload({ waitUntil: "networkidle" });
  await waitForState(page, "BOOT | Screen: title");
  await clickGame(page, 320, 324);
  await waitForState(page, "OVERWORLD");
  await expect(page.locator("#game-container canvas"))
    .toHaveAttribute("data-text-scale", "1.5");
  await expect(page.locator("#game-container canvas"))
    .toHaveAttribute("data-reduced-motion", "true");

  await holdKey(page, "v");
  await page.keyboard.press("f");
  await page.locator("#mobile-text-input input").fill("temper short");
  await page.locator("#mobile-text-input").evaluate((form) => {
    (form as HTMLFormElement).requestSubmit();
  });
  await waitForState(page, "Recipe:temperedLongSword");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  await holdKey(page, "Escape");
  const upgraded = await page.evaluate((saveKey) => {
    const save = JSON.parse(localStorage.getItem(saveKey)!) as BrowserSave;
    return {
      equipped: save.player.equippedWeapon?.id,
      shortSwords: save.player.inventory.filter((item) => item.id === "shortSword").length,
      longSwords: save.player.inventory.filter((item) => item.id === "longSword").length,
      upgrades: save.player.progression.crafting.statistics.equipmentUpgrades,
    };
  }, SAVE_KEY);
  expect(upgraded).toEqual({
    equipped: "longSword",
    shortSwords: 0,
    longSwords: 1,
    upgrades: 1,
  });

  await page.evaluate((saveKey) => {
    const save = JSON.parse(localStorage.getItem(saveKey)!) as BrowserSave;
    save.player.position.inCity = false;
    save.player.position.cityId = "";
    save.player.position.inDungeon = true;
    save.player.position.dungeonId = "heartlands_dungeon";
    save.player.position.dungeonLevel = 0;
    save.player.position.x = 1;
    save.player.position.y = 13;
    localStorage.setItem(saveKey, JSON.stringify(save));
  }, SAVE_KEY);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle" });
  await waitForState(page, "BOOT | Screen: title");
  await clickGame(page, 320, 324);
  await waitForState(page, "OVERWORLD");
  await holdKey(page, "Escape");
  await waitForState(page, "[MENU]");
  await clickLayoutItem(page, "escape-menu-crafting");
  await waitForState(page, "[CRAFTING");
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator("#game-container canvas")).toBeVisible();
  expect(browserErrors).toEqual([]);
});

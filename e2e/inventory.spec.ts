import { expect, test, type Page } from "@playwright/test";

const SAVE_KEY = "2dnd_save";
const PREFERENCES_KEY = "2dnd_inventory_prefs";
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
  player: {
    inventory: BrowserItem[];
    equippedWeapon: BrowserItem | null;
    progression: {
      seenCutsceneIds: string[];
      pendingCutsceneIds: string[];
      tutorial: {
        completed: boolean;
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
  await page.waitForTimeout(120);
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
  await page.waitForTimeout(120);
}

async function waitForState(page: Page, text: string): Promise<void> {
  await expect(page.locator("#debug-state")).toContainText(text);
}

async function cycleUntil(
  page: Page,
  key: string,
  expected: string,
): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const state = await page.locator("#debug-state").textContent() ?? "";
    if (state.includes(expected)) return;
    await page.keyboard.press(key);
  }
  throw new Error(`Failed to reach ${expected}`);
}

async function activateMenuEntry(page: Page, action: string): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const state = await page.locator("#debug-state").textContent() ?? "";
    if (state.includes(`[MENU_SELECTION:${action}]`)) {
      await holdKey(page, "Enter");
      return;
    }
    await holdKey(page, "ArrowDown");
  }
  throw new Error(`Menu entry not found: ${action}`);
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
  await clickGame(page, 420, 312);
  await waitForState(page, "CUTSCENE");
}

test("large inventories keep stable keyboard and pointer selection", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("inventoryTestInitialized")) {
      localStorage.clear();
      sessionStorage.setItem("inventoryTestInitialized", "true");
    }
    let seed = 0x71;
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x1_0000_0000;
    };
  });

  await createCharacter(page);
  const original = await page.evaluate(({
    saveKey,
    preferencesKey,
    openingCutsceneIds,
  }) => {
    const raw = localStorage.getItem(saveKey);
    if (!raw) throw new Error("Missing new-character save");
    const save = JSON.parse(raw) as BrowserSave;
    const weapon = save.player.inventory.find((item) => item.type === "weapon");
    if (!weapon) throw new Error("Missing starter weapon");
    const potion: BrowserItem = {
      id: "potion",
      name: "Healing Potion",
      description: "Restores 20 HP",
      type: "consumable",
      cost: 15,
      effect: 20,
    };

    const additions: BrowserItem[] = [];
    for (let index = 0; index < 52; index += 1) {
      if (index % 4 === 0) {
        additions.push({
          ...weapon,
          id: `lateBlade${index}`,
          name: `Late Blade ${index}`,
          cost: 100 + index,
          effect: 4 + index % 5,
        });
      } else if (index % 4 === 1) {
        additions.push({
          ...potion,
          id: `latePotion${index}`,
          name: `Late Potion ${index}`,
          cost: 20 + index,
        });
      } else if (index % 4 === 2) {
        additions.push({
          id: `relic${index}`,
          name: `Relic${index}`,
          description: "Late-campaign quest relic",
          type: "key",
          cost: 0,
          effect: 0,
        });
      } else {
        additions.push({
          id: `ore${index}`,
          name: `Future Ore ${index}`,
          description: "Future crafting material",
          type: "crafting",
          cost: index,
          effect: 0,
        });
      }
    }
    save.player.inventory.push(...additions);
    save.player.progression.pendingCutsceneIds = [];
    save.player.progression.tutorial.completed = true;
    for (const cutsceneId of openingCutsceneIds) {
      if (!save.player.progression.seenCutsceneIds.includes(cutsceneId)) {
        save.player.progression.seenCutsceneIds.push(cutsceneId);
      }
    }
    localStorage.setItem(saveKey, JSON.stringify(save));
    localStorage.setItem(preferencesKey, JSON.stringify({
      sortMode: "recent",
      filter: "all",
      search: "",
    }));
    return {
      inventoryIds: save.player.inventory.map((item) => item.id),
      equippedWeaponId: save.player.equippedWeapon?.id ?? null,
    };
  }, {
    saveKey: SAVE_KEY,
    preferencesKey: PREFERENCES_KEY,
    openingCutsceneIds: OPENING_CUTSCENE_IDS,
  });

  await page.reload({ waitUntil: "networkidle" });
  await waitForState(page, "BOOT | Screen: title");
  await clickGame(page, 320, 324);
  await waitForState(page, "OVERWORLD");
  await holdKey(page, "Escape");
  await activateMenuEntry(page, "inventory");
  await waitForState(page, "[PARTY:items");
  await waitForState(page, "Sort:recent Filter:all");

  await page.locator("#debug-checkbox").check();
  for (const key of ["g", "h", "o", "l"]) {
    await page.keyboard.press(key);
  }
  await expect(page.locator("#debug-log")).not.toContainText("[CHEAT]");
  await cycleUntil(page, "r", "Sort:recent");
  await waitForState(page, "Sort:recent");
  await cycleUntil(page, "f", "Filter:all");
  await waitForState(page, "Filter:all");

  await page.keyboard.press("End");
  await expect(page.locator("#debug-state")).toContainText(
    `Inventory ${original.inventoryIds.length}/${original.inventoryIds.length}`,
  );
  await page.keyboard.press("PageUp");
  await expect(page.locator("#debug-state")).toContainText("Page ");

  await page.keyboard.press("/");
  await waitForState(page, "Focus:search");
  for (const key of ["R", "e", "l", "i", "c", "4", "2"]) {
    await page.keyboard.press(key);
    await page.waitForTimeout(60);
  }
  await waitForState(page, "Inventory 1/1");
  await waitForState(page, "Search:Relic42");
  await page.keyboard.press("Enter");

  await clickGame(page, 592, 137);
  await waitForState(page, "Search:-");
  await page.keyboard.press("r");
  await waitForState(page, "Sort:name");
  await page.keyboard.press("f");
  await waitForState(page, "Filter:equipment");
  await clickGame(page, 350, 200);
  await waitForState(page, "[PARTY:items");
  await page.keyboard.press("PageDown");
  await expect(page.locator("#debug-state")).toContainText("Page 2/");
  await holdKey(page, "Escape");
  await expect(page.locator("#debug-state")).not.toContainText("[PARTY:");
  await holdKey(page, "Escape");
  await waitForState(page, "[MENU]");
  await activateMenuEntry(page, "inventory");
  await waitForState(page, "[PARTY:items");

  const persisted = await page.evaluate(({ saveKey, preferencesKey }) => {
    const save = JSON.parse(localStorage.getItem(saveKey)!) as BrowserSave;
    return {
      inventoryIds: save.player.inventory.map((item) => item.id),
      equippedWeaponId: save.player.equippedWeapon?.id ?? null,
      preferences: JSON.parse(localStorage.getItem(preferencesKey)!),
    };
  }, { saveKey: SAVE_KEY, preferencesKey: PREFERENCES_KEY });
  expect(persisted.inventoryIds).toEqual(original.inventoryIds);
  expect(persisted.equippedWeaponId).toBe(original.equippedWeaponId);
  expect(persisted.preferences).toEqual({
    sortMode: "name",
    filter: "equipment",
    search: "",
  });
  expect(browserErrors).toEqual([]);
});

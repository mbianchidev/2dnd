import { expect, test, type Page } from "@playwright/test";
import { expectCleanLayout } from "./helpers/layout";

async function waitForState(page: Page, text: string): Promise<void> {
  await expect(page.locator("#debug-state")).toContainText(text);
}

async function pressNavigationKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(80);
  await page.keyboard.up(key);
  await page.waitForTimeout(120);
}

async function seedCampaigns(page: Page, includeManual: boolean): Promise<void> {
  await page.evaluate(async (manual) => {
    const savePath = "/2dnd/src/systems/save.ts";
    const saveSlotsPath = "/2dnd/src/systems/saveSlots.ts";
    const playerPath = "/2dnd/src/systems/player.ts";
    const codexPath = "/2dnd/src/systems/codex.ts";
    const weatherPath = "/2dnd/src/systems/weather.ts";
    const save = await import(savePath);
    const saveSlots = await import(saveSlotsPath);
    const player = await import(playerPath);
    const codex = await import(codexPath);
    const weather = await import(weatherPath);
    const stats = {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    };
    save.deleteAllSaveSlots();
    const autosave = player.createPlayer("Autosave Hero", stats, "knight");
    autosave.progression.pendingCutsceneIds = [];
    autosave.progression.pendingFeatureRevealIds = [];
    autosave.progression.tutorial.completed = true;
    save.saveGame(
      autosave,
      new Set(),
      codex.createCodex(),
      autosave.appearanceId,
      12,
      weather.createWeatherState(),
    );
    if (manual) {
      const manualSave = player.createPlayer("Manual Hero", stats, "wizard");
      manualSave.progression.pendingCutsceneIds = [];
      manualSave.progression.pendingFeatureRevealIds = [];
      manualSave.progression.tutorial.completed = true;
      saveSlots.saveGameToSlot(
        "manual-1",
        manualSave,
        new Set(["cryptLich"]),
        codex.createCodex(),
        manualSave.appearanceId,
        40,
        weather.createWeatherState(),
        { name: "Before Frostheim" },
      );
    }
  }, includeManual);
}

async function seedDungeonExitCampaign(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const savePath = "/2dnd/src/systems/save.ts";
    const playerPath = "/2dnd/src/systems/player.ts";
    const codexPath = "/2dnd/src/systems/codex.ts";
    const weatherPath = "/2dnd/src/systems/weather.ts";
    const mapPath = "/2dnd/src/data/map.ts";
    const save = await import(savePath);
    const player = await import(playerPath);
    const codex = await import(codexPath);
    const weather = await import(weatherPath);
    const map = await import(mapPath);
    const hero = player.createPlayer("Exit Guard", {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    });
    const dungeon = map.getDungeon("heartlands_dungeon");
    if (!dungeon) throw new Error("Missing Heartlands dungeon");
    const level = map.getDungeonLevelMap(dungeon, 0);
    let exit: { x: number; y: number } | null = null;
    for (let y = 0; y < level.length; y += 1) {
      const x = level[y].indexOf(map.Terrain.DungeonExit);
      if (x >= 0) {
        exit = { x, y };
        break;
      }
    }
    if (!exit) throw new Error("Missing Heartlands dungeon exit");
    hero.position.inDungeon = true;
    hero.position.dungeonId = dungeon.id;
    hero.position.dungeonLevel = 0;
    hero.position.inCity = false;
    hero.position.cityId = "";
    hero.position.x = exit.x;
    hero.position.y = exit.y;
    hero.progression.pendingCutsceneIds = [];
    hero.progression.pendingFeatureRevealIds = [];
    hero.progression.tutorial.completed = true;
    save.deleteAllSaveSlots();
    save.saveGame(
      hero,
      new Set(),
      codex.createCodex(),
      hero.appearanceId,
      12,
      weather.createWeatherState(),
    );
  });
}

test("keyboard manages independent save slots with explicit confirmations", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("saveSlotsInitialized")) {
      localStorage.clear();
      sessionStorage.setItem("saveSlotsInitialized", "true");
    }
  });
  await page.goto("game.html", { waitUntil: "networkidle" });
  await seedCampaigns(page, true);
  await page.reload({ waitUntil: "networkidle" });
  await waitForState(page, "BOOT | Screen: title");

  await page.keyboard.press("l");
  await waitForState(page, "[SAVE_SLOTS:load]");
  await pressNavigationKey(page, "ArrowDown");
  await waitForState(page, "[SAVE_SLOT:manual-1]");
  await expect(page.locator("#save-slot-live-region")).toContainText(
    "Manual Hero",
  );
  await pressNavigationKey(page, "ArrowRight");
  await waitForState(page, "[SAVE_ACTION:rename]");
  await page.keyboard.press("Enter");
  const nameInput = page.locator("#mobile-text-input input");
  await expect(nameInput).toBeVisible();
  await nameInput.fill("Road keep");
  await nameInput.press("Enter");
  await expect(page.locator("#save-slot-live-region")).toContainText("Road keep");

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const state = await page.locator("#debug-state").textContent() ?? "";
    if (state.includes("[SAVE_ACTION:copy]")) break;
    await pressNavigationKey(page, "ArrowRight");
  }
  await waitForState(page, "[SAVE_ACTION:copy]");
  await page.keyboard.press("Enter");
  await waitForState(page, "[SAVE_PHASE:copy-target]");
  await waitForState(page, "[SAVE_SLOT:manual-2]");
  await page.waitForTimeout(100);
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(
    () => localStorage.getItem("2dnd_save_slot_manual-2"),
  )).not.toBeNull();

  await pressNavigationKey(page, "ArrowUp");
  await waitForState(page, "[SAVE_SLOT:manual-1]");
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const state = await page.locator("#debug-state").textContent() ?? "";
    if (state.includes("[SAVE_ACTION:delete]")) break;
    await pressNavigationKey(page, "ArrowRight");
  }
  await waitForState(page, "[SAVE_ACTION:delete]");
  await page.keyboard.press("Enter");
  await waitForState(page, "[SAVE_PHASE:confirm-delete]");
  await waitForState(page, "[SAVE_ACTION:confirm]");
  await page.waitForTimeout(100);
  await page.keyboard.press("Enter");

  await expect.poll(() => page.evaluate(
    () => localStorage.getItem("2dnd_save_slot_manual-1"),
  )).toBeNull();
  expect(await page.evaluate(() => {
    const raw = localStorage.getItem("2dnd_save_slot_manual-2");
    return raw ? JSON.parse(raw).player.name : null;
  })).toBe("Manual Hero");
  await expectCleanLayout(page);
  await page.keyboard.press("Escape");
  await page.keyboard.press("n");
  await waitForState(page, "[SAVE_PHASE:confirm-newGame]");
  await page.keyboard.press("Escape");
  await waitForState(page, "BOOT | Screen: title");
  await expect(page.locator("#debug-state")).not.toContainText("[SAVE_SLOTS:");
  await page.keyboard.press("n");
  await waitForState(page, "[SAVE_PHASE:confirm-newGame]");
  await waitForState(page, "[SAVE_ACTION:confirm]");
  await page.keyboard.press("Enter");
  await waitForState(page, "BOOT | Screen: character");
  expect(errors).toEqual([]);
});

test("save slot modal blocks feature shortcuts and Space world actions", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("saveSlotIsolationInitialized")) {
      localStorage.clear();
      sessionStorage.setItem("saveSlotIsolationInitialized", "true");
    }
  });
  await page.goto("game.html", { waitUntil: "networkidle" });
  await seedDungeonExitCampaign(page);
  await page.reload({ waitUntil: "networkidle" });
  await waitForState(page, "BOOT | Screen: title");
  await page.keyboard.press("Space");
  await waitForState(page, "[DUNGEON:heartlands_dungeon]");
  await page.keyboard.press("Escape");
  await waitForState(page, "[MENU]");
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const state = await page.locator("#debug-state").textContent() ?? "";
    if (state.includes("[MENU_SELECTION:save]")) break;
    await pressNavigationKey(page, "ArrowDown");
  }
  await waitForState(page, "[MENU_SELECTION:save]");
  await page.keyboard.press("Enter");
  await waitForState(page, "[SAVE_SLOTS:save]");

  await page.keyboard.press("c");
  await page.waitForTimeout(200);
  await waitForState(page, "[SAVE_SLOTS:save]");
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const state = await page.locator("#debug-state").textContent() ?? "";
    if (state.includes("[SAVE_ACTION:close]")) break;
    await pressNavigationKey(page, "ArrowRight");
  }
  await waitForState(page, "[SAVE_ACTION:close]");
  await page.keyboard.down("Space");
  await page.waitForTimeout(180);
  await page.keyboard.up("Space");
  await page.waitForTimeout(200);

  await expect(page.locator("#debug-state")).not.toContainText("[SAVE_SLOTS:");
  await waitForState(page, "[DUNGEON:heartlands_dungeon]");
  expect(await page.evaluate(() => {
    const raw = localStorage.getItem("2dnd_save");
    return raw ? JSON.parse(raw).player.position.inDungeon : null;
  })).toBe(true);
});

test.describe("touch save slots", () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 430, height: 932 },
  });

  test("creates a manual snapshot at 150 percent text scale", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.addInitScript(() => {
      if (!sessionStorage.getItem("touchSaveSlotsInitialized")) {
        localStorage.clear();
        sessionStorage.setItem("touchSaveSlotsInitialized", "true");
      }
    });
    await page.goto("game.html", { waitUntil: "networkidle" });
    await seedCampaigns(page, false);
    await page.evaluate(() => {
      localStorage.setItem("2dnd_preferences", JSON.stringify({
        version: 2,
        audio: {
          masterVolume: 1,
          musicVolume: 0.6,
          sfxVolume: 0.4,
          dialogVolume: 0.5,
          muted: false,
        },
        accessibility: {
          reducedMotion: true,
          textScale: 1.5,
          highContrast: true,
          advanceMode: "manual",
        },
        controls: {
          touchControls: "on",
          handedness: "right",
          promptSource: "touch",
        },
      }));
    });
    await page.reload({ waitUntil: "networkidle" });
    await waitForState(page, "BOOT | Screen: title");
    await page.locator('[data-action="confirm"]').tap();
    await waitForState(page, "OVERWORLD");
    await page.locator('[data-action="openMenu"]').tap();
    await waitForState(page, "[MENU]");

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const state = await page.locator("#debug-state").textContent() ?? "";
      if (state.includes("[MENU_SELECTION:save]")) break;
      await page.locator('[data-action="navigateDown"]').tap();
      await page.waitForTimeout(120);
    }
    await waitForState(page, "[MENU_SELECTION:save]");
    await page.locator('[data-action="confirm"]').tap();
    await waitForState(page, "[SAVE_SLOTS:save]");
    await waitForState(page, "[SAVE_SLOT:manual-1]");
    await page.locator('[data-action="confirm"]').tap();

    await expect.poll(() => page.evaluate(
      () => localStorage.getItem("2dnd_save_slot_manual-1"),
    )).not.toBeNull();
    await expect(page.locator("#save-slot-live-region")).toContainText(
      "Saved Autosave Hero",
    );
    await expectCleanLayout(page);
    await page.locator('[data-action="cancel"]').tap();
    await expect(page.locator("#debug-state")).not.toContainText("[SAVE_SLOTS:");
    expect(errors).toEqual([]);
  });
});

import { expect, test, type Page } from "@playwright/test";
import {
  clickLayoutItem,
  expectCleanLayout,
  tapLayoutItem,
} from "./helpers/layout";

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

test("invalid imports preserve exact slot bytes and malformed cores recover after reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("saveValidationInitialized")) {
      localStorage.clear();
      sessionStorage.setItem("saveValidationInitialized", "true");
    }
  });
  await page.goto("game.html", { waitUntil: "networkidle" });
  await seedCampaigns(page, true);
  await page.reload({ waitUntil: "networkidle" });
  await waitForState(page, "BOOT | Screen: title");
  const before = await page.evaluate(() =>
    Object.fromEntries(Object.keys(localStorage).map(
      (key): [string, string | null] => [key, localStorage.getItem(key)],
    ))
  );
  const original = before["2dnd_save_slot_manual-1"];
  if (!original) throw new Error("Missing manual campaign fixture");
  const parsed: unknown = JSON.parse(original);
  if (
    typeof parsed !== "object"
    || parsed === null
    || !("player" in parsed)
    || typeof parsed.player !== "object"
    || parsed.player === null
  ) {
    throw new Error("Invalid manual campaign fixture");
  }
  const malformed = JSON.stringify({
    ...parsed,
    player: { ...parsed.player, stats: null },
  });

  await clickLayoutItem(page, "title-save-slots");
  await clickLayoutItem(page, "save-slot-row-manual-1");
  await clickLayoutItem(page, "save-slot-action-import");
  await waitForState(page, "[SAVE_PHASE:confirm-import]");
  const chooser = page.waitForEvent("filechooser");
  await clickLayoutItem(page, "save-slot-action-confirm");
  await (await chooser).setFiles({
    name: "mock-invalid-campaign.json",
    mimeType: "application/json",
    buffer: Buffer.from(malformed),
  });
  await expect(page.locator("#save-storage-alert")).toContainText(
    "not a supported 2D&D campaign save",
  );
  expect(await page.evaluate(() =>
    Object.fromEntries(Object.keys(localStorage).map(
      (key): [string, string | null] => [key, localStorage.getItem(key)],
    ))
  )).toEqual(before);

  await page.evaluate(({ raw, invalid }) => {
    localStorage.setItem("2dnd_save_slot_manual-1:backup", raw);
    localStorage.setItem("2dnd_save_slot_manual-1", invalid);
    localStorage.setItem("2dnd_save_slot_manual-2", "{broken");
  }, { raw: original, invalid: malformed });
  await page.reload({ waitUntil: "networkidle" });
  await clickLayoutItem(page, "title-save-slots");
  await clickLayoutItem(page, "save-slot-row-manual-1");
  await expect(page.locator("#save-slot-live-region")).toContainText("Manual Hero");
  expect(await page.evaluate(() =>
    localStorage.getItem("2dnd_save_slot_manual-1")
  )).toBe(original);
  expect(await page.evaluate(() =>
    localStorage.getItem("2dnd_save_slot_manual-2")
  )).toBe("{broken");
  await expectCleanLayout(page);
  await clickLayoutItem(page, "save-slot-action-load");
  await waitForState(page, "OVERWORLD");
  expect(await page.evaluate(() => {
    const raw = localStorage.getItem("2dnd_save");
    return raw ? JSON.parse(raw).player.name : null;
  })).toBe("Manual Hero");
  expect(await page.evaluate(() =>
    localStorage.getItem("2dnd_save_slot_manual-1")
  )).toBe(original);
  await page.reload({ waitUntil: "networkidle" });
  await clickLayoutItem(page, "title-continue");
  await waitForState(page, "OVERWORLD");
  expect(await page.evaluate(() =>
    localStorage.getItem("2dnd_save_slot_manual-1")
  )).toBe(original);
  expect(errors).toEqual([]);
});

test("blocked browser storage keeps title and slot diagnostics usable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get: () => {
        throw new DOMException("Mock browser storage is blocked", "SecurityError");
      },
    });
  });
  await page.goto("game.html", { waitUntil: "networkidle" });
  await waitForState(page, "BOOT | Screen: title");
  await clickLayoutItem(page, "title-save-slots");
  await waitForState(page, "[SAVE_SLOTS:load]");
  await expect(page.locator("#save-slot-live-region")).toContainText(
    "Storage unavailable",
  );
  await expectCleanLayout(page);
  await page.keyboard.press("Escape");

  const result = await page.evaluate(async () => {
    const savePath = "/2dnd/src/systems/save.ts";
    const playerPath = "/2dnd/src/systems/player.ts";
    const codexPath = "/2dnd/src/systems/codex.ts";
    const save = await import(savePath);
    const player = await import(playerPath);
    const codex = await import(codexPath);
    const hero = player.createPlayer("Mock Offline Hero", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    return save.saveGame(
      hero,
      new Set(),
      codex.createCodex(),
      hero.appearanceId,
    );
  });
  expect(result).toMatchObject({ ok: false, code: "unavailable" });
  await expect(page.getByRole("alert")).toContainText("storage is unavailable");
  await clickLayoutItem(page, "title-new-game");
  await waitForState(page, "[SAVE_PHASE:confirm-newGame]");
  await clickLayoutItem(page, "save-slot-action-confirm");
  await waitForState(page, "BOOT | Screen: character");
  expect(errors).toEqual([]);
});

test("gamepad overwrite and delete stay inert until explicitly confirmed", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("saveGamepadInitialized")) {
      localStorage.clear();
      sessionStorage.setItem("saveGamepadInitialized", "true");
    }
    const pad = {
      id: "Mock Standard Save Gamepad",
      index: 0,
      connected: true,
      mapping: "standard",
      timestamp: 0,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({
        pressed: false, touched: false, value: 0,
      })),
    };
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => [pad],
    });
    Object.defineProperty(window, "__setSaveGamepadButton", {
      value: (index: number, pressed: boolean) => {
        pad.buttons[index] = { pressed, touched: pressed, value: pressed ? 1 : 0 };
        pad.timestamp += 1;
      },
    });
  });
  const pressGamepad = async (button: number): Promise<void> => {
    for (const pressed of [true, false]) {
      await page.evaluate(({ index, held }) => {
        (window as typeof window & {
          __setSaveGamepadButton(index: number, pressed: boolean): void;
        }).__setSaveGamepadButton(index, held);
      }, { index: button, held: pressed });
      await page.waitForTimeout(150);
    }
  };
  const selectDelete = async (): Promise<void> => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const state = await page.locator("#debug-state").textContent() ?? "";
      if (state.includes("[SAVE_ACTION:delete]")) return;
      await pressGamepad(15);
    }
    throw new Error("Gamepad did not select the Delete action");
  };
  await page.goto("game.html", { waitUntil: "networkidle" });
  await seedCampaigns(page, true);
  await page.reload({ waitUntil: "networkidle" });
  await waitForState(page, "BOOT | Screen: title");
  await pressGamepad(0);
  await waitForState(page, "OVERWORLD");
  const autosave = await page.evaluate(() => localStorage.getItem("2dnd_save"));
  const source = await page.evaluate(() =>
    localStorage.getItem("2dnd_save_slot_manual-1")
  );
  await pressGamepad(9);
  await waitForState(page, "[MENU]");
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const state = await page.locator("#debug-state").textContent() ?? "";
    if (state.includes("[MENU_SELECTION:save]")) break;
    await pressGamepad(13);
  }
  await waitForState(page, "[MENU_SELECTION:save]");
  await pressGamepad(0);
  await waitForState(page, "[SAVE_SLOTS:save]");
  await pressGamepad(0);
  await waitForState(page, "[SAVE_PHASE:confirm-save]");
  expect(await page.evaluate(() =>
    localStorage.getItem("2dnd_save_slot_manual-1")
  )).toBe(source);
  await pressGamepad(1);
  await waitForState(page, "[SAVE_PHASE:browse]");
  expect(await page.evaluate(() =>
    localStorage.getItem("2dnd_save_slot_manual-1")
  )).toBe(source);
  await pressGamepad(0);
  await waitForState(page, "[SAVE_PHASE:confirm-save]");
  await pressGamepad(0);
  await waitForState(page, "[SAVE_PHASE:browse]");
  const overwritten = await page.evaluate(() =>
    localStorage.getItem("2dnd_save_slot_manual-1")
  );
  expect(overwritten).not.toBe(source);
  expect(await page.evaluate(() =>
    localStorage.getItem("2dnd_save_slot_manual-1:backup")
  )).toBe(source);

  await selectDelete();
  await pressGamepad(0);
  await waitForState(page, "[SAVE_PHASE:confirm-delete]");
  expect(await page.evaluate(() =>
    localStorage.getItem("2dnd_save_slot_manual-1")
  )).toBe(overwritten);
  await pressGamepad(1);
  await waitForState(page, "[SAVE_PHASE:browse]");
  expect(await page.evaluate(() =>
    localStorage.getItem("2dnd_save_slot_manual-1")
  )).toBe(overwritten);
  await selectDelete();
  await pressGamepad(0);
  await waitForState(page, "[SAVE_PHASE:confirm-delete]");
  await pressGamepad(0);
  await expect.poll(() => page.evaluate(() =>
    localStorage.getItem("2dnd_save_slot_manual-1")
  )).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("2dnd_save"))).toBe(autosave);
  await expectCleanLayout(page);
  await pressGamepad(1);
  expect(errors).toEqual([]);
});

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

  test("uses title actions and keeps new-game confirmation usable in landscape", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.addInitScript(() => {
      if (!sessionStorage.getItem("touchTitleInitialized")) {
        localStorage.clear();
        sessionStorage.setItem("touchTitleInitialized", "true");
      }
    });
    await page.goto("game.html", { waitUntil: "networkidle" });
    await seedCampaigns(page, false);
    await page.setViewportSize({ width: 932, height: 430 });
    await page.reload({ waitUntil: "networkidle" });
    await waitForState(page, "BOOT | Screen: title");
    await waitForState(page, "[TITLE_ACTION:continue]");
    await expectCleanLayout(page);
    for (const action of ["navigateUp", "confirm"]) {
      const bounds = await page.locator(`[data-action="${action}"]`).boundingBox();
      expect(bounds?.width).toBeGreaterThanOrEqual(48);
      expect(bounds?.height).toBeGreaterThanOrEqual(48);
    }

    await tapLayoutItem(page, "title-new-game");
    await waitForState(page, "[SAVE_PHASE:confirm-newGame]");
    await waitForState(page, "[SAVE_SLOT:autosave]");
    await expectCleanLayout(page);
    await page.locator('[data-action="navigateDown"]').tap();
    await waitForState(page, "[SAVE_SLOT:autosave] [SAVE_ACTION:cancel]");
    await page.locator('[data-action="navigateUp"]').tap();
    await waitForState(page, "[SAVE_SLOT:autosave] [SAVE_ACTION:confirm]");
    await tapLayoutItem(page, "save-slot-action-cancel");
    await expect(page.locator("#debug-state")).not.toContainText("[SAVE_SLOTS:");
    await waitForState(page, "[TITLE_ACTION:newGame]");

    await page.locator('[data-action="navigateDown"]').tap();
    await waitForState(page, "[TITLE_ACTION:saveSlots]");
    await page.locator('[data-action="confirm"]').tap();
    await waitForState(page, "[SAVE_SLOTS:load]");
    await page.locator('[data-action="cancel"]').tap();
    await expect(page.locator("#debug-state")).not.toContainText("[SAVE_SLOTS:");

    await tapLayoutItem(page, "title-continue");
    await waitForState(page, "OVERWORLD");
    expect(errors).toEqual([]);
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

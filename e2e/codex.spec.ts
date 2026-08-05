import { expect, test, type Page } from "@playwright/test";

const GAME_WIDTH = 640;
const GAME_HEIGHT = 528;
const SAVE_KEY = "2dnd_save";
const PREFERENCES_KEY = "2dnd_preferences";

interface BrowserSave {
  version: number;
  codex: {
    entries: Record<string, { timesDefeated: number }>;
    unlockedEntryIds: string[];
  };
  player: {
    progression: {
      tutorial: { completed: boolean };
      seenCutsceneIds: string[];
      pendingCutsceneIds: string[];
    };
  };
}

async function gamePoint(
  page: Page,
  gameX: number,
  gameY: number,
): Promise<{ x: number; y: number }> {
  const canvas = page.locator("#game-container canvas");
  await expect(canvas).toBeVisible();
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Game canvas has no rendered bounds");
  return {
    x: bounds.x + (gameX / GAME_WIDTH) * bounds.width,
    y: bounds.y + (gameY / GAME_HEIGHT) * bounds.height,
  };
}

async function clickGame(
  page: Page,
  gameX: number,
  gameY: number,
): Promise<void> {
  const point = await gamePoint(page, gameX, gameY);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(100);
}

async function tapGame(
  page: Page,
  gameX: number,
  gameY: number,
): Promise<void> {
  const point = await gamePoint(page, gameX, gameY);
  await page.touchscreen.tap(point.x, point.y);
  await page.waitForTimeout(100);
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

async function waitForState(page: Page, text: string): Promise<void> {
  await expect(page.locator("#debug-state")).toContainText(text);
}

async function submitDebug(page: Page, command: string): Promise<void> {
  const checkbox = page.locator("#debug-checkbox");
  if (!await checkbox.isChecked()) await checkbox.check();
  const input = page.locator("#debug-cmd");
  await input.fill(command);
  await input.press("Enter");
  await input.blur();
  await page.locator("#game-container canvas").click();
}

async function drainCutscenes(page: Page, destination = "OVERWORLD"): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const state = await page.locator("#debug-state").textContent() ?? "";
    if (state.includes(destination)) return;
    if (state.includes("CUTSCENE")) {
      await holdKey(page, "Enter", 90);
    } else {
      await page.waitForTimeout(120);
    }
  }
  throw new Error(`Timed out draining cutscenes to ${destination}`);
}

async function createCampaign(page: Page): Promise<void> {
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
  await drainCutscenes(page);
  if ((await page.locator("#debug-state").textContent())?.includes("[TUTORIAL")) {
    await holdKey(page, "Escape");
  }
  await waitForState(page, "OVERWORLD");
}

async function readSave(page: Page): Promise<BrowserSave> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) throw new Error("Missing campaign save");
    return JSON.parse(raw) as BrowserSave;
  }, SAVE_KEY);
}

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

test("unlocks campaign knowledge and supports the full keyboard Codex flow", async ({
  page,
}) => {
  const errors = trackErrors(page);
  await page.addInitScript((preferencesKey) => {
    if (!sessionStorage.getItem("codexDesktopInitialized")) {
      localStorage.clear();
      sessionStorage.setItem("codexDesktopInitialized", "true");
      localStorage.setItem(preferencesKey, JSON.stringify({
        version: 1,
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
      }));
    }
  }, PREFERENCES_KEY);

  await createCampaign(page);
  await expect(page.locator("#game-container canvas"))
    .toHaveAttribute("data-text-scale", "1.5");
  await expect(page.locator("#game-container canvas"))
    .toHaveAttribute("data-reduced-motion", "true");
  expect((await readSave(page)).codex.unlockedEntryIds)
    .toContain("twelvefoldCovenant");

  await submitDebug(page, "/tp willowdale");
  await holdKey(page, "Space", 260);
  await waitForState(page, "[CITY:willowdale_city:0]");
  expect((await readSave(page)).codex.unlockedEntryIds).toContain("willowdale");

  await submitDebug(page, "/readable willowdaleFoundingVolume");
  await waitForState(page, "Pos: (10,5)");
  await holdKey(page, "Space");
  await holdKey(page, "Space");
  await holdKey(page, "Space");
  await expect(page.locator("#debug-log"))
    .toContainText("[CODEX] Discovered foundingOfTheCovenant");
  expect((await readSave(page)).codex.unlockedEntryIds)
    .toContain("foundingOfTheCovenant");

  const beforeMove = await page.locator("#debug-state").textContent();
  await page.waitForTimeout(400);
  await holdKey(page, "d", 300);
  expect(await page.locator("#debug-state").textContent()).not.toBe(beforeMove);

  await submitDebug(page, "/near willowdaleArchivist");
  await holdKey(page, "Space");
  await holdKey(page, "Space");
  await holdKey(page, "Space");
  await drainCutscenes(page, "[CITY:willowdale_city:0]");
  let save = await readSave(page);
  expect(save.codex.unlockedEntryIds).toEqual(expect.arrayContaining([
    "willowdaleArchivist",
    "covenantSigil",
  ]));

  await submitDebug(page, "/quest set ironboundDispatch completed");
  save = await readSave(page);
  expect(save.codex.unlockedEntryIds).toContain("theIronRoute");

  await submitDebug(page, "/item dungeonKey");
  await submitDebug(page, "/tp heartlands crypt");
  await holdKey(page, "Space", 260);
  await drainCutscenes(page, "[DUNGEON:heartlands_dungeon]");
  expect((await readSave(page)).codex.unlockedEntryIds)
    .toContain("heartlandsCrypt");

  await holdKey(page, "c");
  await waitForState(page, "CODEX | Category: Monsters");
  await holdKey(page, "2");
  await waitForState(page, "Category: Locations");
  await holdKey(page, "r");
  await waitForState(page, "Sort: name");
  await holdKey(page, "f");
  await waitForState(page, "Filter: canonical");
  await page.keyboard.press("/");
  await expect(page.locator("#mobile-text-input")).toBeVisible();
  await page.locator("#mobile-text-input input").fill("willow");
  await page.locator("#mobile-text-input input").press("Enter");
  await waitForState(page, "Search: willow");
  await waitForState(page, "Selected: willowdale");
  await holdKey(page, "e");
  await waitForState(page, "Category: Items");
  await holdKey(page, "Escape");
  await waitForState(page, "[DUNGEON:heartlands_dungeon]");

  await page.reload({ waitUntil: "networkidle" });
  await waitForState(page, "BOOT | Screen: title");
  await clickGame(page, 320, 324);
  await waitForState(page, "[DUNGEON:heartlands_dungeon]");
  save = await readSave(page);
  expect(save.version).toBe(11);
  expect(save.codex.unlockedEntryIds).toEqual(expect.arrayContaining([
    "willowdale",
    "foundingOfTheCovenant",
    "willowdaleArchivist",
    "covenantSigil",
    "theIronRoute",
    "heartlandsCrypt",
  ]));
  expect(errors).toEqual([]);
});

test.describe("touch Codex controls", () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 430, height: 932 },
  });

  test("opens from the touch menu and supports category search", async ({
    page,
  }) => {
    const errors = trackErrors(page);
    await page.addInitScript(() => localStorage.clear());
    await createCampaign(page);

    await page.waitForTimeout(350);
    await page.locator('[data-action="openMenu"]').tap();
    await waitForState(page, "[MENU]");
    await tapGame(page, 420, 92);
    await waitForState(page, "CODEX | Category: Monsters");
    await tapGame(page, 183, 32);
    await waitForState(page, "Category: Locations");
    await tapGame(page, 320, 50);
    await expect(page.locator("#mobile-text-input")).toBeVisible();
    await page.locator("#mobile-text-input input").fill("crypt");
    await page.locator('[data-action="confirm"]').tap();
    await waitForState(page, "Search: crypt");
    await tapGame(page, 560, 50);
    await waitForState(page, "Sort: name");
    await page.locator('[data-action="cancel"]').tap();
    await waitForState(page, "OVERWORLD");
    expect(errors).toEqual([]);
  });
});

test("supports gamepad navigation, cursor controls, and migrated old saves", async ({
  page,
}) => {
  const errors = trackErrors(page);
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("codexGamepadInitialized")) {
      localStorage.clear();
      sessionStorage.setItem("codexGamepadInitialized", "true");
    }
    const state = {
      buttons: Array.from({ length: 17 }, () => false),
      axes: [0, 0, 0, 0],
    };
    const pad = {
      id: "Codex Test Gamepad",
      index: 0,
      connected: true,
      mapping: "standard",
      timestamp: 0,
      vibrationActuator: null,
      buttons: state.buttons.map(() => ({
        pressed: false,
        touched: false,
        value: 0,
      })),
      axes: state.axes,
    };
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => [pad],
    });
    Object.defineProperty(window, "__setGamepadButton", {
      value: (index: number, pressed: boolean) => {
        state.buttons[index] = pressed;
        pad.buttons[index] = {
          pressed,
          touched: pressed,
          value: pressed ? 1 : 0,
        };
        pad.timestamp += 1;
      },
    });
    Object.defineProperty(window, "__setGamepadAxes", {
      value: (axes: number[]) => {
        pad.axes.splice(0, pad.axes.length, ...axes);
        pad.timestamp += 1;
      },
    });
  });

  const pressGamepad = async (button: number): Promise<void> => {
    await page.evaluate((index) => {
      (window as typeof window & {
        __setGamepadButton(index: number, pressed: boolean): void;
      }).__setGamepadButton(index, true);
    }, button);
    await page.waitForTimeout(150);
    await page.evaluate((index) => {
      (window as typeof window & {
        __setGamepadButton(index: number, pressed: boolean): void;
      }).__setGamepadButton(index, false);
    }, button);
    await page.waitForTimeout(150);
  };
  const setAxes = async (axes: number[]): Promise<void> => {
    await page.evaluate((values) => {
      (window as typeof window & {
        __setGamepadAxes(axes: number[]): void;
      }).__setGamepadAxes(values);
    }, axes);
  };
  const moveCursor = async (gameX: number, gameY: number): Promise<void> => {
    const target = await gamePoint(page, gameX, gameY);
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const bounds = await page.locator("#gamepad-cursor").boundingBox();
      if (bounds) {
        const dx = target.x - (bounds.x + bounds.width / 2);
        const dy = target.y - (bounds.y + bounds.height / 2);
        if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
          await setAxes([0, 0, 0, 0]);
          return;
        }
        await setAxes([
          0,
          0,
          Math.abs(dx) < 8 ? 0 : Math.sign(dx) * 0.8,
          Math.abs(dy) < 8 ? 0 : Math.sign(dy) * 0.8,
        ]);
      } else {
        await setAxes([0, 0, 0.8, 0]);
      }
      await page.waitForTimeout(50);
    }
    throw new Error("Timed out moving gamepad cursor");
  };

  await createCampaign(page);
  await page.evaluate((saveKey) => {
    const save = JSON.parse(localStorage.getItem(saveKey)!) as BrowserSave;
    save.version = 9;
    save.player.progression.tutorial.completed = true;
    save.codex.entries.slime = { timesDefeated: 4 };
    delete (save.codex as Partial<BrowserSave["codex"]>).unlockedEntryIds;
    localStorage.setItem(saveKey, JSON.stringify(save));
  }, SAVE_KEY);
  await page.reload({ waitUntil: "networkidle" });
  await waitForState(page, "BOOT | Screen: title");
  await clickGame(page, 320, 324);
  await waitForState(page, "OVERWORLD");

  await setAxes([0, 0, 0.8, 0]);
  await page.waitForTimeout(250);
  await setAxes([0, 0, 0, 0]);
  await expect(page.locator("#gamepad-cursor")).toBeVisible();
  await holdKey(page, "c");
  await waitForState(page, "CODEX | Category: Monsters");
  await pressGamepad(13);
  await expect(page.locator("#game-container canvas"))
    .toHaveAttribute("data-input-source", "gamepad");
  await pressGamepad(5);
  await waitForState(page, "Category: Locations");
  await pressGamepad(2);
  await expect(page.locator("#mobile-text-input")).toBeVisible();
  await page.locator("#mobile-text-input input").fill("willow");
  await pressGamepad(0);
  await waitForState(page, "Search: willow");
  await pressGamepad(1);
  await waitForState(page, "OVERWORLD");

  const migrated = await readSave(page);
  expect(migrated.version).toBe(11);
  expect(migrated.codex.entries.slime.timesDefeated).toBe(4);
  expect(Array.isArray(migrated.codex.unlockedEntryIds)).toBe(true);
  expect(errors).toEqual([]);
});

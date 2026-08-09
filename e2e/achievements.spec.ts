import { expect, test, type Page } from "@playwright/test";

const SAVE_KEY = "2dnd_save";
const PREFERENCES_KEY = "2dnd_preferences";
const GAME_WIDTH = 640;
const GAME_HEIGHT = 528;
const OPENING_CUTSCENE_IDS = [
  "campaign.opening",
  "campaign.stage.firstSeal",
] as const;

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
  await page.waitForTimeout(120);
}

async function tapGame(
  page: Page,
  gameX: number,
  gameY: number,
): Promise<void> {
  const point = await gamePoint(page, gameX, gameY);
  await page.touchscreen.tap(point.x, point.y);
  await page.waitForTimeout(120);
}

async function waitForState(page: Page, text: string): Promise<void> {
  await expect(page.locator("#debug-state")).toContainText(text);
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

async function typeKeys(page: Page, value: string): Promise<void> {
  for (const character of value) {
    await page.keyboard.press(character);
    await page.waitForTimeout(50);
  }
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

async function preparePlayableSave(
  page: Page,
  options: {
    completedCampaign?: boolean;
    defeatCount?: number;
    accessibility?: boolean;
    pendingNotice?: boolean;
  } = {},
): Promise<void> {
  await page.evaluate(({
    saveKey,
    preferencesKey,
    openingCutsceneIds,
    completedCampaign,
    defeatCount,
    accessibility,
    pendingNotice,
  }) => {
    const save = JSON.parse(localStorage.getItem(saveKey)!) as {
      version: number;
      player: {
        progression: {
          seenCutsceneIds: string[];
          pendingCutsceneIds: string[];
          tutorial: { completed: boolean };
          discoveredCities: string[];
          quests: {
            quests: Record<string, {
              status: string;
              stage: number;
              objectives: Record<string, number>;
              claimedRewards: string[];
            }>;
          };
          achievements: {
            earned: Array<{
              id: string;
              unlockedAt: number;
              order: number;
              sourceId: string;
              debug: boolean;
            }>;
            counters: {
              battleWins: number;
              oneHitDefeats: number;
              defeatCount: number;
              battleSequence: number;
            };
            processedEventIds: string[];
            pendingNotificationIds: string[];
            unlockedTitleIds: string[];
            equippedTitleId: string;
            defeatTrackingComplete: boolean;
            debugSuppressedIds: string[];
            debugPendingBattle: boolean;
          };
        };
      };
    };
    save.player.progression.pendingCutsceneIds = [];
    save.player.progression.tutorial.completed = true;
    for (const cutsceneId of openingCutsceneIds) {
      if (!save.player.progression.seenCutsceneIds.includes(cutsceneId)) {
        save.player.progression.seenCutsceneIds.push(cutsceneId);
      }
    }
    save.player.progression.discoveredCities = [
      "willowdale_city",
      "ironhold_city",
      "deeproot_city",
      "frostheim_city",
      "thornvale_city",
      "sandport_city",
    ];
    save.player.progression.achievements.counters.battleWins = 9;
    save.player.progression.achievements.counters.oneHitDefeats = 1;
    save.player.progression.achievements.counters.defeatCount = defeatCount;
    save.player.progression.achievements.defeatTrackingComplete = true;
    if (completedCampaign) {
      const main =
        save.player.progression.quests.quests.twelvefoldCovenant;
      main.status = "completed";
      main.stage = 6;
      const epilogueId = "campaign.twelvefoldCovenant.epilogue";
      if (!save.player.progression.seenCutsceneIds.includes(epilogueId)) {
        save.player.progression.seenCutsceneIds.push(epilogueId);
      }
    }
    if (pendingNotice) {
      save.player.progression.achievements.earned.push({
        id: "sixCities",
        unlockedAt: Date.now(),
        order: 1,
        sourceId: "test:browser",
        debug: false,
      });
      save.player.progression.achievements.pendingNotificationIds = [
        "sixCities",
      ];
    }
    localStorage.setItem(saveKey, JSON.stringify(save));
    if (accessibility) {
      const preferences = JSON.parse(
        localStorage.getItem(preferencesKey) ?? "{}",
      ) as {
        accessibility?: Record<string, unknown>;
      };
      preferences.accessibility = {
        ...(preferences.accessibility ?? {}),
        textScale: 1.5,
        highContrast: true,
        reducedMotion: true,
        autoAdvanceCutscenes: false,
      };
      localStorage.setItem(preferencesKey, JSON.stringify(preferences));
    }
  }, {
    saveKey: SAVE_KEY,
    preferencesKey: PREFERENCES_KEY,
    openingCutsceneIds: OPENING_CUTSCENE_IDS,
    completedCampaign: options.completedCampaign ?? false,
    defeatCount: options.defeatCount ?? 0,
    accessibility: options.accessibility ?? false,
    pendingNotice: options.pendingNotice ?? false,
  });
}

async function continueToOverworld(page: Page): Promise<void> {
  const validSaveVersion = await page.evaluate(async () => {
    const modulePath = "/2dnd/src/systems/save.ts";
    const saveModule = await import(modulePath);
    return saveModule.loadGame()?.version ?? null;
  });
  expect(validSaveVersion).toBe(15);
  await page.reload({ waitUntil: "networkidle" });
  await waitForState(page, "BOOT | Screen: title");
  await holdKey(page, "Space");
  await waitForState(page, "OVERWORLD");
}

async function openAchievementsFromMenu(page: Page): Promise<void> {
  await holdKey(page, "Escape");
  await waitForState(page, "[MENU]");
  await clickGame(page, 226, 95);
  await waitForState(page, "[ACHIEVEMENTS");
}

test("achievement profile shows progress, hidden reveals, titles, and reload persistence", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("achievementDesktopInitialized")) {
      localStorage.clear();
      sessionStorage.setItem("achievementDesktopInitialized", "true");
    }
    let seed = 0x50;
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x1_0000_0000;
    };
  });
  await createCharacter(page);
  await preparePlayableSave(page, {
    completedCampaign: true,
    pendingNotice: true,
  });
  await continueToOverworld(page);
  await expect(page.locator("#debug-log")).toContainText(
    "[ACHIEVEMENT] Unlocked sixCities",
  );

  await openAchievementsFromMenu(page);
  await page.keyboard.press("/");
  await typeKeys(page, "seasoned");
  await waitForState(page, "Search:seasoned");
  await waitForState(page, "Selected:seasonedVictor Progress:9/10");
  await page.keyboard.press("Enter");
  await page.keyboard.press("/");
  for (let index = 0; index < "seasoned".length; index += 1) {
    await page.keyboard.press("Backspace");
  }
  await page.waitForTimeout(180);
  await typeKeys(page, "single");
  await waitForState(page, "Selected:singleStroke Progress:1/1");
  await page.keyboard.press("Enter");
  await page.keyboard.press("/");
  for (let index = 0; index < "single".length; index += 1) {
    await page.keyboard.press("Backspace");
  }
  await page.waitForTimeout(180);
  await typeKeys(page, "unbroken");
  await waitForState(page, "Selected:unbrokenCovenant Progress:1/1");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");

  expect(await page.evaluate((saveKey) => {
    const save = JSON.parse(localStorage.getItem(saveKey)!);
    return {
      title: save.player.progression.achievements.equippedTitleId,
      earned: save.player.progression.achievements.earned.map(
        (record: { id: string }) => record.id,
      ),
    };
  }, SAVE_KEY)).toMatchObject({
    title: "unbroken",
    earned: expect.arrayContaining([
      "sixCities",
      "singleStroke",
      "twelvefoldCovenantComplete",
      "unbrokenCovenant",
    ]),
  });

  await holdKey(page, "Escape");
  await continueToOverworld(page);
  expect(await page.evaluate((saveKey) => {
    const save = JSON.parse(localStorage.getItem(saveKey)!);
    return save.player.progression.achievements.equippedTitleId;
  }, SAVE_KEY)).toBe("unbroken");
  expect(browserErrors).toEqual([]);
});

test("campaign completion excludes the no-defeat achievement after a recorded defeat", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("achievementDefeatInitialized")) {
      localStorage.clear();
      sessionStorage.setItem("achievementDefeatInitialized", "true");
    }
  });
  await createCharacter(page);
  await preparePlayableSave(page, {
    completedCampaign: true,
    defeatCount: 1,
  });
  await continueToOverworld(page);
  const earned = await page.evaluate((saveKey) => {
    const save = JSON.parse(localStorage.getItem(saveKey)!);
    return save.player.progression.achievements.earned.map(
      (record: { id: string }) => record.id,
    );
  }, SAVE_KEY);
  expect(earned).toContain("twelvefoldCovenantComplete");
  expect(earned).not.toContain("unbrokenCovenant");
});

test.describe("mobile achievement profile", () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 430, height: 932 },
  });

  test("opens from touch controls at 150% text with reduced motion", async ({
    page,
  }) => {
    const browserErrors: string[] = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    await page.addInitScript(() => {
      if (!sessionStorage.getItem("achievementMobileInitialized")) {
        localStorage.clear();
        sessionStorage.setItem("achievementMobileInitialized", "true");
      }
    });
    await createCharacter(page);
    await preparePlayableSave(page, {
      accessibility: true,
    });
    await continueToOverworld(page);
    await expect(page.locator("#game-container canvas"))
      .toHaveAttribute("data-text-scale", "1.5");
    await expect(page.locator("#game-container canvas"))
      .toHaveAttribute("data-reduced-motion", "true");
    await page.locator('[data-action="openMenu"]').tap();
    await waitForState(page, "[MENU]");
    await tapGame(page, 226, 95);
    await waitForState(page, "[ACHIEVEMENTS");
    await expect(page.locator("#touch-controls")).toHaveClass(/visible/);
    expect(browserErrors).toEqual([]);
  });
});

test("gamepad cursor opens achievements from the menu", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("achievementGamepadInitialized")) {
      localStorage.clear();
      sessionStorage.setItem("achievementGamepadInitialized", "true");
    }
    const state = {
      buttons: Array.from({ length: 17 }, () => false),
      axes: [0, 0, 0, 0],
    };
    const pad = {
      id: "Achievement Test Gamepad",
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

  await createCharacter(page);
  await preparePlayableSave(page);
  await continueToOverworld(page);
  await pressGamepad(9);
  await waitForState(page, "[MENU]");
  await moveCursor(226, 95);
  await pressGamepad(11);
  await waitForState(page, "[ACHIEVEMENTS");
  expect(browserErrors).toEqual([]);
});

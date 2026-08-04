import { expect, test, type Page } from "@playwright/test";

const GAME_WIDTH = 640;
const GAME_HEIGHT = 528;

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

async function tapGame(
  page: Page,
  gameX: number,
  gameY: number,
): Promise<void> {
  const point = await gamePoint(page, gameX, gameY);
  await page.touchscreen.tap(point.x, point.y);
}

async function clickGame(
  page: Page,
  gameX: number,
  gameY: number,
): Promise<void> {
  const point = await gamePoint(page, gameX, gameY);
  await page.mouse.click(point.x, point.y);
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

async function drainOpening(page: Page, source: "touch" | "keyboard"): Promise<void> {
  let lastState = "";
  for (let step = 0; step < 80; step += 1) {
    const state = await page.locator("#debug-state").textContent() ?? "";
    lastState = state;
    if (state.includes("OVERWORLD")) return;
    if (source === "touch") {
      await page.locator('[data-action="confirm"]').tap();
    } else {
      await holdKey(page, "Space", 80);
    }
    await page.waitForTimeout(360);
  }
  throw new Error(`Timed out draining opening cutscenes: ${lastState}`);
}

async function completeTutorialByTouch(page: Page): Promise<void> {
  await waitForState(page, "[TUTORIAL");
  for (let step = 0; step < 5; step += 1) {
    await page.locator('[data-action="confirm"]').tap();
    await page.waitForTimeout(100);
  }
  await expect(page.locator("#debug-state")).not.toContainText("[TUTORIAL");
}

async function submitDebug(page: Page, command: string): Promise<void> {
  await page.locator("#debug-checkbox").check();
  const input = page.locator("#debug-cmd");
  await input.fill(command);
  await input.press("Enter");
  await page.locator("#game-container canvas").click();
}

async function setGamepadAxes(page: Page, axes: number[]): Promise<void> {
  await page.evaluate((values) => {
    (window as typeof window & {
      __setGamepadAxes(axes: number[]): void;
    }).__setGamepadAxes(values);
  }, axes);
}

async function moveGamepadCursor(
  page: Page,
  gameX: number,
  gameY: number,
): Promise<void> {
  const target = await gamePoint(page, gameX, gameY);
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const bounds = await page.locator("#gamepad-cursor").boundingBox();
    if (bounds) {
      const cursorX = bounds.x + bounds.width / 2;
      const cursorY = bounds.y + bounds.height / 2;
      const dx = target.x - cursorX;
      const dy = target.y - cursorY;
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
        await setGamepadAxes(page, [0, 0, 0, 0]);
        return;
      }
      await setGamepadAxes(page, [
        0,
        0,
        Math.abs(dx) < 8 ? 0 : Math.sign(dx) * 0.8,
        Math.abs(dy) < 8 ? 0 : Math.sign(dy) * 0.8,
      ]);
    } else {
      await setGamepadAxes(page, [0, 0, 0, 0.8]);
    }
    await page.waitForTimeout(50);
  }
  await setGamepadAxes(page, [0, 0, 0, 0]);
  throw new Error("Timed out positioning gamepad cursor");
}

test.describe("touch controls", () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 430, height: 932 },
  });

  test("supports mobile onboarding, movement, overlays, and orientation", async ({
    page,
  }) => {
    const browserErrors: string[] = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    await page.addInitScript(() => {
      localStorage.clear();
      let seed = 0x89;
      Math.random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 0x1_0000_0000;
      };
    });

    await page.goto("./", { waitUntil: "networkidle" });
    await waitForState(page, "BOOT | Screen: title");
    await expect(page.locator("#touch-controls")).toHaveClass(/visible/);
    await page.locator('[data-action="confirm"]').tap();
    await waitForState(page, "BOOT | Screen: character");

    await page.locator('[data-action="navigateUp"]').tap();
    await tapGame(page, 320, 76);
    await expect(page.locator("#mobile-text-input")).toBeVisible();
    await expect(page.locator("#mobile-text-input input")).toHaveValue("Hero");
    await page.locator("#mobile-text-input input").fill("Touch");
    await page.locator('[data-action="confirm"]').tap();
    await expect(page.locator("#mobile-text-input")).not.toBeVisible();
    await waitForState(page, "BOOT | Screen: character");
    await tapGame(page, 320, 76);
    await page.locator("#mobile-text-input input").fill("Touch Hero");
    await page.locator("#mobile-text-input input").press("Enter");
    await expect(page.locator("#mobile-text-input")).not.toBeVisible();
    await waitForState(page, "BOOT | Screen: character");
    await tapGame(page, 284, 160);
    await page.locator('[data-action="confirm"]').tap();
    await waitForState(page, "BOOT | Screen: stats");
    await tapGame(page, 390, 64);
    await tapGame(page, 400, 460);
    await waitForState(page, "BOOT | Screen: appearance");
    await tapGame(page, 320, 112);
    await tapGame(page, 420, 312);
    await waitForState(page, "CUTSCENE");
    expect(await page.evaluate(() => {
      const save = JSON.parse(localStorage.getItem("2dnd_save")!);
      return save.player.name;
    })).toBe("Touch Hero");
    await drainOpening(page, "touch");
    await completeTutorialByTouch(page);

    const before = await page.evaluate(() => {
      const save = JSON.parse(localStorage.getItem("2dnd_save")!);
      return {
        x: save.player.position.x,
        y: save.player.position.y,
      };
    });
    await page.locator('[data-action="navigateRight"]').tap();
    await page.waitForTimeout(250);
    const after = await page.evaluate(() => {
      const save = JSON.parse(localStorage.getItem("2dnd_save")!);
      return {
        x: save.player.position.x,
        y: save.player.position.y,
      };
    });
    expect(after).not.toEqual(before);
    await expect(page.locator("#game-container canvas")).toHaveAttribute(
      "data-input-source",
      "touch",
    );

    await page.locator('[data-action="openMenu"]').tap();
    await waitForState(page, "[MENU]");
    await page.locator('[data-action="cancel"]').tap();
    await expect(page.locator("#debug-state")).not.toContainText("[MENU]");
    await page.locator('[data-action="openParty"]').tap();
    await waitForState(page, "[PARTY:status]");
    await page.locator('[data-action="cancel"]').tap();

    await page.setViewportSize({ width: 932, height: 430 });
    await expect(page.locator("#game-container canvas")).toBeVisible();
    await expect(page.locator("#touch-controls")).toHaveClass(/visible/);
    await expect(page.locator('[data-action="confirm"]')).toBeInViewport();
    await expect(page.locator('[data-action="navigateLeft"]')).toBeInViewport();
    expect(browserErrors).toEqual([]);
  });
});

test.describe("standard gamepad controls", () => {
  test("switches prompts and drives overlays, battle targeting, and recovery", async ({
    page,
  }) => {
    const browserErrors: string[] = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    await page.addInitScript(() => {
      localStorage.clear();
      const state = {
        buttons: Array.from({ length: 17 }, () => false),
        axes: [0, 0, 0, 0],
      };
      const pad = {
        id: "Deterministic Standard Gamepad",
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
      let seed = 0x91;
      Math.random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 0x1_0000_0000;
      };
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

    await page.goto("./", { waitUntil: "networkidle" });
    await waitForState(page, "BOOT | Screen: title");
    await moveGamepadCursor(page, 320, 324);
    await expect(page.locator("#gamepad-cursor")).toBeVisible();
    await expect(page.locator("#game-container canvas")).toHaveAttribute(
      "data-input-source",
      "gamepad",
    );
    await pressGamepad(11);
    await waitForState(page, "BOOT | Screen: character");
    await pressGamepad(0);
    await waitForState(page, "BOOT | Screen: stats");
    await clickGame(page, 390, 64);
    await clickGame(page, 400, 460);
    await waitForState(page, "BOOT | Screen: appearance");
    await clickGame(page, 320, 112);
    await clickGame(page, 420, 312);
    await waitForState(page, "CUTSCENE");
    for (let step = 0; step < 30; step += 1) {
      const state = await page.locator("#debug-state").textContent() ?? "";
      if (state.includes("OVERWORLD")) break;
      await pressGamepad(0);
    }
    await waitForState(page, "OVERWORLD");
    await page.waitForTimeout(250);
    if ((await page.locator("#debug-state").textContent())?.includes("[TUTORIAL")) {
      for (let step = 0; step < 5; step += 1) await pressGamepad(0);
    }
    await expect(page.locator("#game-container canvas")).toHaveAttribute(
      "data-input-source",
      "gamepad",
    );
    await expect(page.locator("#game-container canvas")).toHaveAttribute(
      "data-gamepad-connected",
      "true",
    );

    await pressGamepad(9);
    await waitForState(page, "[MENU]");
    await pressGamepad(1);
    await expect(page.locator("#debug-state")).not.toContainText("[MENU]");
    await pressGamepad(8);
    await waitForState(page, "[TIPS");
    await pressGamepad(1);
    await pressGamepad(9);
    await waitForState(page, "[MENU]");
    await clickGame(page, 320, 232);
    await waitForState(page, "[CHRONICLE_SELECTION:1/");
    await pressGamepad(13);
    await waitForState(page, "[CHRONICLE_SELECTION:2/");
    await pressGamepad(1);
    await expect(page.locator("#debug-state")).not.toContainText("[CHRONICLE]");

    await submitDebug(page, "/spawn goblin");
    await waitForState(page, "BATTLE");
    await waitForState(page, "Phase: playerTurn");
    await pressGamepad(0);
    await pressGamepad(0);
    await expect(page.locator("#debug-state")).toContainText(/Phase: (playerTurn|monsterTurn|victory)/);
    await submitDebug(page, "/defeat");
    await waitForState(page, "DEFEAT | Intro");
    await page.waitForTimeout(450);
    await pressGamepad(0);
    await waitForState(page, "DEFEAT | Results");
    await page.waitForTimeout(450);
    await pressGamepad(0);
    await waitForState(page, "OVERWORLD");

    await page.evaluate(() => {
      (window as typeof window & {
        __setGamepadAxes(axes: number[]): void;
      }).__setGamepadAxes([0, 0, 0.8, 0]);
    });
    await page.waitForTimeout(180);
    await page.evaluate(() => {
      (window as typeof window & {
        __setGamepadAxes(axes: number[]): void;
      }).__setGamepadAxes([0, 0, 0, 0]);
    });
    await expect(page.locator("#gamepad-cursor")).toBeVisible();
    expect(browserErrors).toEqual([]);
  });
});

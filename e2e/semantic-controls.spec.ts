import { expect, test, type Page } from "@playwright/test";
import {
  clickLayoutItem,
  expectCleanLayout,
  layoutItemCenter,
} from "./helpers/layout";

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

async function dispatchTouchControlPointer(
  page: Page,
  action: string,
  endType: "pointerup" | "pointercancel",
  pointerId: number,
): Promise<void> {
  const button = page.locator(`[data-action="${action}"]`);
  const eventInit = {
    pointerId,
    pointerType: "touch",
    isPrimary: true,
    bubbles: true,
    cancelable: true,
  };
  await button.dispatchEvent("pointerdown", eventInit);
  await button.dispatchEvent(endType, eventInit);
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
  await expectCleanLayout(page);
  for (let step = 0; step < 5; step += 1) {
    await page.locator('[data-action="confirm"]').tap();
    await page.waitForTimeout(100);
  }
  await expect(page.locator("#debug-state")).not.toContainText("[TUTORIAL");
}

async function submitDebug(page: Page, command: string): Promise<void> {
  await page.locator("#debug-checkbox").check();
  const input = page.locator("#debug-cmd");
  if (await input.isVisible()) {
    await input.fill(command);
    await input.press("Enter");
  } else {
    await input.evaluate((element, value) => {
      const commandInput = element as HTMLInputElement;
      commandInput.value = value;
      commandInput.dispatchEvent(new Event("input", { bubbles: true }));
      commandInput.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        bubbles: true,
      }));
    }, command);
  }
  if (!command.startsWith("/event trigger")) {
    await page.locator("#game-container canvas").click();
  }
}

async function setGamepadAxes(page: Page, axes: number[]): Promise<void> {
  await page.evaluate((values) => {
    (window as typeof window & {
      __setGamepadAxes(axes: number[]): void;
    }).__setGamepadAxes(values);
  }, axes);
}

function cursorAxis(delta: number): number {
  const distance = Math.abs(delta);
  if (distance < 20) return 0;
  return Math.sign(delta) * Math.min(0.7, Math.max(0.35, distance / 120));
}

async function moveGamepadCursor(
  page: Page,
  gameX: number,
  gameY: number,
): Promise<void> {
  const target = await gamePoint(page, gameX, gameY);
  for (let attempt = 0; attempt < 240; attempt += 1) {
    const bounds = await page.locator("#gamepad-cursor").boundingBox();
    if (bounds) {
      const cursorX = bounds.x + bounds.width / 2;
      const cursorY = bounds.y + bounds.height / 2;
      const dx = target.x - cursorX;
      const dy = target.y - cursorY;
      if (Math.abs(dx) < 20 && Math.abs(dy) < 20) {
        await setGamepadAxes(page, [0, 0, 0, 0]);
        return;
      }
      await setGamepadAxes(page, [
        0,
        0,
        cursorAxis(dx),
        cursorAxis(dy),
      ]);
    } else {
      await setGamepadAxes(page, [0, 0, 0, 0.8]);
    }
    await page.waitForTimeout(75);
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

    await page.goto("game.html", { waitUntil: "networkidle" });
    await waitForState(page, "BOOT | Screen: title");
    await expect(page.locator("#touch-controls")).toHaveClass(/visible/);
    await dispatchTouchControlPointer(
      page,
      "confirm",
      "pointercancel",
      41,
    );
    await waitForState(page, "BOOT | Screen: title");
    await dispatchTouchControlPointer(page, "confirm", "pointerup", 42);
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
    await submitDebug(page, "/gather reset");
    await submitDebug(page, "/event trigger abandonedSupplyCart");
    await waitForState(page, "[WORLD_EVENT:abandonedSupplyCart]");
    await waitForState(page, "[WORLD_EVENT_SELECTION:1/2]");
    await expectCleanLayout(page);
    await page.locator('[data-action="navigateDown"]').tap();
    await waitForState(page, "[WORLD_EVENT_SELECTION:2/2]");
    await page.locator('[data-action="navigateUp"]').tap();
    await waitForState(page, "[WORLD_EVENT_SELECTION:1/2]");
    await page.locator('[data-action="confirm"]').tap();
    await expect(page.locator("#debug-state")).not.toContainText("[WORLD_EVENT:");
    expect(await page.evaluate(() => {
      const save = JSON.parse(localStorage.getItem("2dnd_save")!);
      const log = save.player.progression.worldEvents.log;
      return log[log.length - 1]?.eventId;
    })).toBe("abandonedSupplyCart");

    const before = await page.evaluate(() => {
      const save = JSON.parse(localStorage.getItem("2dnd_save")!);
      return {
        x: save.player.position.x,
        y: save.player.position.y,
      };
    });
    await page.locator("#debug-checkbox").check();
    await page.locator("#game-container canvas").click();
    await holdKey(page, "f");
    await expect(page.locator("#debug-log")).toContainText("Encounters OFF");
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
    await submitDebug(page, "/feature reveal party");
    await submitDebug(page, "/feature reveal partyGambits");
    await submitDebug(page, "/feature reveal socialProfile");
    await page.locator('[data-action="openParty"]').tap();
    await waitForState(page, "[PARTY:status]");
    await holdKey(page, "2");
    await waitForState(page, "[PARTY:social]");
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

    await page.goto("game.html", { waitUntil: "networkidle" });
    await waitForState(page, "BOOT | Screen: title");
    await moveGamepadCursor(page, 320, 324);
    await expect(page.locator("#gamepad-cursor")).toBeVisible();
    await expect(page.locator("#game-container canvas")).toHaveAttribute(
      "data-input-source",
      "gamepad",
    );
    await pressGamepad(0);
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
    await submitDebug(page, "/feature reveal party");
    await submitDebug(page, "/feature reveal socialProfile");

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
    await expect.poll(() => page.evaluate(
      () => localStorage.getItem("2dnd_save_slot_manual-1"),
    )).not.toBeNull();
    await pressGamepad(1);
    await expect(page.locator("#debug-state")).not.toContainText("[SAVE_SLOTS:");
    await pressGamepad(8);
    await waitForState(page, "[TIPS");
    await pressGamepad(1);
    await pressGamepad(9);
    await waitForState(page, "[MENU]");
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const party = await layoutItemCenter(page, "escape-menu-party");
      await moveGamepadCursor(page, party.x, party.y);
      await pressGamepad(11);
      const state = await page.locator("#debug-state").textContent() ?? "";
      if (state.includes("[PARTY:status")) break;
      if (!state.includes("[MENU]")) {
        await pressGamepad(9);
        await waitForState(page, "[MENU]");
      }
    }
    await waitForState(page, "[PARTY:status");
    await clickLayoutItem(page, "party-tab-social");
    await waitForState(page, "[PARTY:social]");
    await pressGamepad(1);
    await pressGamepad(9);
    await waitForState(page, "[MENU]");
    await clickLayoutItem(page, "escape-menu-chronicle");
    await waitForState(page, "[CHRONICLE_SELECTION:1/");
    await pressGamepad(13);
    await waitForState(page, "[CHRONICLE_SELECTION:2/");
    await pressGamepad(1);
    await expect(page.locator("#debug-state")).not.toContainText("[CHRONICLE]");

    await submitDebug(page, "/event trigger abandonedSupplyCart");
    await waitForState(page, "[WORLD_EVENT:abandonedSupplyCart]");
    await waitForState(page, "[WORLD_EVENT_SELECTION:1/2]");
    await pressGamepad(13);
    await waitForState(page, "[WORLD_EVENT_SELECTION:2/2]");
    await pressGamepad(12);
    await waitForState(page, "[WORLD_EVENT_SELECTION:1/2]");
    await pressGamepad(0);
    await expect(page.locator("#debug-state")).not.toContainText("[WORLD_EVENT:");
    expect(await page.evaluate(() => {
      const save = JSON.parse(localStorage.getItem("2dnd_save")!);
      const log = save.player.progression.worldEvents.log;
      return log[log.length - 1]?.eventId;
    })).toBe("abandonedSupplyCart");

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

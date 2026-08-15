import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const APP_ROOT = resolve(import.meta.dirname, "..");
const SAVE_KEY = "2dnd_save";
const GAME_WIDTH = 640;
const GAME_HEIGHT = 528;

interface DesktopSaveSummary {
  readonly name: string;
  readonly version: number;
}

function createLaunchEnvironment(userDataDirectory: string): Record<string, string> {
  const environment: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && key !== "ELECTRON_RUN_AS_NODE") {
      environment[key] = value;
    }
  }
  environment["ELECTRON_TEST_MODE"] = "1";
  environment["ELECTRON_USER_DATA_DIR"] = userDataDirectory;
  return environment;
}

async function launchDesktop(
  userDataDirectory: string,
): Promise<ElectronApplication> {
  return electron.launch({
    args: [APP_ROOT],
    cwd: APP_ROOT,
    env: createLaunchEnvironment(userDataDirectory),
  });
}

async function clickGame(
  page: Page,
  gameX: number,
  gameY: number,
): Promise<void> {
  const canvas = page.locator("#game-container canvas");
  await expect(canvas).toBeVisible();
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Desktop game canvas has no rendered bounds");
  await page.mouse.click(
    bounds.x + (gameX / GAME_WIDTH) * bounds.width,
    bounds.y + (gameY / GAME_HEIGHT) * bounds.height,
  );
}

async function createDesktopSave(page: Page): Promise<DesktopSaveSummary> {
  await page.waitForTimeout(800);
  await page.keyboard.press("Space");
  await page.waitForTimeout(300);
  await clickGame(page, 320, 76);
  const nameInput = page.locator("#mobile-text-input input");
  await expect(nameInput).toBeVisible();
  await nameInput.fill("Desktop Hero");
  await nameInput.press("Enter");
  await clickGame(page, 284, 160);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(250);
  await clickGame(page, 390, 64);
  await clickGame(page, 400, 460);
  await page.waitForTimeout(250);
  await clickGame(page, 320, 112);
  await clickGame(page, 420, 312);

  await expect.poll(async () => page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const version = "version" in parsed ? parsed.version : undefined;
    const player = "player" in parsed ? parsed.player : undefined;
    if (
      typeof version !== "number"
      || typeof player !== "object"
      || player === null
      || !("name" in player)
      || typeof player.name !== "string"
    ) {
      return null;
    }
    return { name: player.name, version };
  }, SAVE_KEY)).toEqual({
    name: "Desktop Hero",
    version: 17,
  });

  return { name: "Desktop Hero", version: 17 };
}

test("secure desktop shell persists a campaign across launches", async () => {
  const userDataDirectory = await mkdtemp(join(tmpdir(), "2dnd-electron-"));
  let desktop: ElectronApplication | undefined;
  try {
    desktop = await launchDesktop(userDataDirectory);
    let page = await desktop.firstWindow();
    const rendererErrors: string[] = [];
    page.on("pageerror", (error) => rendererErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") rendererErrors.push(message.text());
    });

    await expect(page).toHaveTitle(/2D&D/);
    await expect(page.locator("#desktop-fullscreen")).toBeVisible();
    await expect.poll(() => page.evaluate(() => location.origin)).toBe(
      "app://2dnd",
    );
    const desktopState = await page.evaluate(() => window.desktop?.getState());
    expect(desktopState?.appVersion).toBe("1.0.0");
    expect(desktopState?.isFullscreen).toBe(false);

    await page.locator("#desktop-fullscreen").click();
    await expect.poll(() => page.evaluate(
      () => window.desktop?.getState().then((state) => state.isFullscreen),
    )).toBe(true);
    await expect(page.locator("#desktop-fullscreen")).toHaveText(
      "Windowed (F11)",
    );
    await page.keyboard.press("F11");
    await expect.poll(() => page.evaluate(
      () => window.desktop?.getState().then((state) => state.isFullscreen),
    )).toBe(false);

    const saved = await createDesktopSave(page);
    expect(rendererErrors).toEqual([]);
    await desktop.close();
    desktop = undefined;

    desktop = await launchDesktop(userDataDirectory);
    page = await desktop.firstWindow();
    await expect(page.locator("#desktop-fullscreen")).toBeVisible();
    const loaded = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) throw new Error("Desktop campaign save was not persisted");
      const parsed = JSON.parse(raw) as {
        version: number;
        player: { name: string };
      };
      return {
        name: parsed.player.name,
        version: parsed.version,
      };
    }, SAVE_KEY);
    expect(loaded).toEqual(saved);
    await page.keyboard.press("Space");
    await page.waitForTimeout(1_000);
    await expect(page.locator("#game-container canvas")).toBeVisible();
  } finally {
    await desktop?.close();
    await rm(userDataDirectory, { recursive: true, force: true });
  }
});

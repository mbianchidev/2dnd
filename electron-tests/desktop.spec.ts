import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import {
  mkdtemp,
  readFile,
  rm,
} from "node:fs/promises";
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
    version: 18,
  });

  return { name: "Desktop Hero", version: 18 };
}

async function prepareSaveForOverworld(page: Page): Promise<void> {
  await page.evaluate((key) => {
    const isRecord = (value: unknown): value is Record<string, unknown> =>
      typeof value === "object" && value !== null && !Array.isArray(value);
    const raw = localStorage.getItem(key);
    if (!raw) throw new Error("Missing desktop campaign save");
    const parsed: unknown = JSON.parse(raw);
    if (
      !isRecord(parsed)
      || !("player" in parsed)
      || !isRecord(parsed.player)
      || !("progression" in parsed.player)
      || !isRecord(parsed.player.progression)
    ) {
      throw new Error("Desktop campaign save has invalid progression");
    }
    const progression = parsed.player.progression;
    progression.pendingCutsceneIds = [];
    progression.pendingFeatureRevealIds = [];
    progression.tutorial = { completed: true };
    localStorage.setItem(key, JSON.stringify(parsed));
  }, SAVE_KEY);
}

function monitorRendererErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

test("secure desktop shell persists a campaign across launches", async () => {
  const userDataDirectory = await mkdtemp(join(tmpdir(), "2dnd-electron-"));
  let desktop: ElectronApplication | undefined;
  let logPath = "";
  try {
    desktop = await launchDesktop(userDataDirectory);
    let page = await desktop.firstWindow();
    const rendererErrors = monitorRendererErrors(page);

    await expect(page).toHaveTitle(/2D&D/);
    await expect(page.locator("#desktop-fullscreen")).toBeVisible();
    await expect.poll(() => page.evaluate(() => location.origin)).toBe(
      "app://2dnd",
    );
    await expect.poll(() => page.evaluate(() => location.pathname)).toBe(
      "/game.html",
    );
    const desktopState = await page.evaluate(() => window.desktop?.getState());
    expect(desktopState?.appVersion).toBe("1.0.0");
    expect(desktopState?.isFullscreen).toBe(false);
    logPath = desktopState?.logPath ?? "";
    expect(logPath).toBe(join(userDataDirectory, "logs", "2dnd.log"));

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
    await prepareSaveForOverworld(page);
    expect(rendererErrors).toEqual([]);
    await desktop.close();
    desktop = undefined;

    desktop = await launchDesktop(userDataDirectory);
    page = await desktop.firstWindow();
    const relaunchedRendererErrors = monitorRendererErrors(page);
    await expect(page.locator("#desktop-fullscreen")).toBeVisible();
    const loaded = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) throw new Error("Desktop campaign save was not persisted");
      const parsed: unknown = JSON.parse(raw);
      if (
        typeof parsed !== "object"
        || parsed === null
        || !("version" in parsed)
        || typeof parsed.version !== "number"
        || !("player" in parsed)
        || typeof parsed.player !== "object"
        || parsed.player === null
        || !("name" in parsed.player)
        || typeof parsed.player.name !== "string"
      ) {
        throw new Error("Desktop campaign save has an invalid shape");
      }
      return {
        name: parsed.player.name,
        version: parsed.version,
      };
    }, SAVE_KEY);
    expect(loaded).toEqual(saved);
    await holdKey(page, "Space");
    await waitForState(page, "OVERWORLD");
    await holdKey(page, "Escape");
    await waitForState(page, "[MENU]");
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const state = await page.locator("#debug-state").textContent() ?? "";
      if (state.includes("[MENU_SELECTION:save]")) break;
      await holdKey(page, "ArrowDown", 80);
    }
    await waitForState(page, "[MENU_SELECTION:save]");
    await holdKey(page, "Enter");
    await waitForState(page, "[SAVE_SLOTS:save]");
    await holdKey(page, "Enter");
    await expect.poll(() => page.evaluate(() => {
      const raw = localStorage.getItem("2dnd_save_slot_manual-1");
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (
        typeof parsed !== "object"
        || parsed === null
        || !("version" in parsed)
        || !("player" in parsed)
        || typeof parsed.player !== "object"
        || parsed.player === null
        || !("name" in parsed.player)
      ) {
        return null;
      }
      return {
        version: parsed.version,
        name: parsed.player.name,
      };
    })).toEqual(saved);
    await holdKey(page, "Escape");
    await expect(page.locator("#debug-state")).not.toContainText("[SAVE_SLOTS:");
    await holdKey(page, "Escape");
    await waitForState(page, "[MENU]");
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const state = await page.locator("#debug-state").textContent() ?? "";
      if (state.includes("[MENU_SELECTION:quit]")) break;
      await holdKey(page, "ArrowDown", 80);
    }
    await waitForState(page, "[MENU_SELECTION:quit]");
    await holdKey(page, "Enter");
    await waitForState(page, "BOOT | Screen: title");
    expect(relaunchedRendererErrors).toEqual([]);

    const closePromise = desktop.waitForEvent("close");
    await clickGame(page, 320, 492);
    await closePromise;
    desktop = undefined;

    const log = await readFile(logPath, "utf8");
    expect(log).toContain("[INFO] Application starting");
    expect(log).toContain("[INFO] Renderer ready");
    expect(log).toContain("[INFO] Quit requested by renderer");
    expect(log).toContain("[INFO] Application will quit");
    expect(log).not.toContain("Desktop Hero");
  } finally {
    await desktop?.close();
    await rm(userDataDirectory, { recursive: true, force: true });
  }
});

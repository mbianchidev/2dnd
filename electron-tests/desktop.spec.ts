import {
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
import { join } from "node:path";
import {
  APP_ROOT,
  closeDesktop,
  holdKey,
  launchDesktop,
  waitForState,
} from "./helpers/desktop";
const SAVE_KEY = "2dnd_save";
const GAME_WIDTH = 640;
const GAME_HEIGHT = 528;

interface DesktopSaveSummary {
  readonly name: string;
  readonly version: number;
  readonly appearanceId: string;
}

async function clickGame(
  page: Page,
  gameX: number,
  gameY: number,
  activation: "held" | "terminal" = "held",
): Promise<void> {
  const canvas = page.locator("#game-container canvas");
  await expect(canvas).toBeVisible();
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Desktop game canvas has no rendered bounds");
  const x = bounds.x + (gameX / GAME_WIDTH) * bounds.width;
  const y = bounds.y + (gameY / GAME_HEIGHT) * bounds.height;
  if (activation === "terminal") {
    await page.mouse.click(x, y);
    return;
  }
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(80);
  await page.mouse.up();
}

async function activateTitleAction(
  page: Page,
  action: "continue" | "newGame" | "saveSlots",
): Promise<void> {
  await waitForState(page, "BOOT | Screen: title");
  if (action === "saveSlots") {
    await holdKey(page, "l");
    await waitForState(page, "[SAVE_SLOTS:load]");
    return;
  }
  const marker = `[TITLE_ACTION:${action}]`;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const state = await page.locator("#debug-state").textContent() ?? "";
    if (state.includes(marker)) {
      await holdKey(page, "Enter");
      return;
    }
    await holdKey(page, "ArrowUp", 80);
  }
  throw new Error(`Unable to select desktop title action: ${action}`);
}

async function activateSlotAction(
  page: Page,
  action: "copy" | "confirm" | "import" | "load",
): Promise<void> {
  const marker = `[SAVE_ACTION:${action}]`;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const state = await page.locator("#debug-state").textContent() ?? "";
    if (state.includes(marker)) {
      await holdKey(page, "Enter");
      return;
    }
    await holdKey(page, "ArrowRight", 80);
  }
  throw new Error(`Unable to select desktop save action: ${action}`);
}

async function returnToTitle(page: Page): Promise<void> {
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
}

async function createDesktopSave(page: Page): Promise<DesktopSaveSummary> {
  await activateTitleAction(page, "newGame");
  await waitForState(page, "BOOT | Screen: character");
  await clickGame(page, 320, 76);
  const nameInput = page.locator("#mobile-text-input input");
  await expect(nameInput).toBeVisible();
  await nameInput.fill("Desktop Hero");
  await nameInput.press("Enter");
  await clickGame(page, 284, 160);
  await waitForState(page, "[CLASS:ranger]");
  await holdKey(page, "Enter");
  await waitForState(page, "BOOT | Screen: stats");
  await clickGame(page, 390, 64);
  await waitForState(page, "[MODE:random]");
  await holdKey(page, "Enter");
  await waitForState(page, "BOOT | Screen: appearance");
  await clickGame(page, 320, 112);
  await holdKey(page, "Enter");

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
      || !("appearanceId" in player)
      || typeof player.appearanceId !== "string"
    ) {
      return null;
    }
    return { name: player.name, version, appearanceId: player.appearanceId };
  }, SAVE_KEY)).toEqual({
    name: "Desktop Hero",
    version: 18,
    appearanceId: "ranger",
  });

  return { name: "Desktop Hero", version: 18, appearanceId: "ranger" };
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
    const manifest = JSON.parse(
      await readFile(join(APP_ROOT, "package.json"), "utf8"),
    ) as { version: string };
    expect(desktopState?.appVersion).toBe(manifest.version);
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
        || !("appearanceId" in parsed.player)
        || typeof parsed.player.appearanceId !== "string"
      ) {
        throw new Error("Desktop campaign save has an invalid shape");
      }
      return {
        name: parsed.player.name,
        version: parsed.version,
        appearanceId: parsed.player.appearanceId,
      };
    }, SAVE_KEY);
    expect(loaded).toEqual(saved);
    await activateTitleAction(page, "continue");
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
        || !("appearanceId" in parsed.player)
      ) {
        return null;
      }
      return {
        version: parsed.version,
        name: parsed.player.name,
        appearanceId: parsed.player.appearanceId,
      };
    })).toEqual(saved);
    const manualSnapshot = await page.evaluate(() =>
      localStorage.getItem("2dnd_save_slot_manual-1")
    );
    if (!manualSnapshot) throw new Error("Missing desktop manual snapshot");
    await holdKey(page, "Escape");
    await expect(page.locator("#debug-state")).not.toContainText("[SAVE_SLOTS:");
    await returnToTitle(page);
    expect(relaunchedRendererErrors).toEqual([]);

    await activateTitleAction(page, "saveSlots");
    await waitForState(page, "[SAVE_SLOTS:load]");
    await holdKey(page, "ArrowDown", 80);
    await waitForState(page, "[SAVE_SLOT:manual-1]");
    await expect(page.locator("#save-slot-live-region")).toContainText(
      "Desktop Hero Lv.1 Ranger",
    );
    await activateSlotAction(page, "copy");
    await waitForState(page, "[SAVE_PHASE:copy-target]");
    await activateSlotAction(page, "confirm");
    await expect.poll(() => page.evaluate(() =>
      localStorage.getItem("2dnd_save_slot_manual-2")
    )).not.toBeNull();

    const secondCampaign = await page.evaluate((raw) => {
      const parsed: unknown = JSON.parse(raw);
      if (
        typeof parsed !== "object"
        || parsed === null
        || !("player" in parsed)
        || typeof parsed.player !== "object"
        || parsed.player === null
      ) {
        throw new Error("Invalid desktop manual fixture");
      }
      return JSON.stringify({
        ...parsed,
        player: { ...parsed.player, name: "Desktop Second Hero" },
      });
    }, manualSnapshot);
    await activateSlotAction(page, "import");
    await waitForState(page, "[SAVE_PHASE:confirm-import]");
    const picker = page.waitForEvent("filechooser");
    await activateSlotAction(page, "confirm");
    await (await picker).setFiles({
      name: "mock-second-desktop-campaign.json",
      mimeType: "application/json",
      buffer: Buffer.from(secondCampaign),
    });
    await expect(page.locator("#save-slot-live-region")).toContainText(
      "Desktop Second Hero",
    );
    const secondSnapshot = await page.evaluate(() =>
      localStorage.getItem("2dnd_save_slot_manual-2")
    );
    if (!secondSnapshot) throw new Error("Missing imported desktop snapshot");
    expect(await page.evaluate(() =>
      localStorage.getItem("2dnd_save_slot_manual-1")
    )).toBe(manualSnapshot);

    await page.evaluate((raw) => {
      localStorage.setItem("2dnd_save_slot_manual-2:staging", raw);
      localStorage.setItem("2dnd_save_slot_manual-2", JSON.stringify({
        version: 18,
        player: { inventory: [] },
      }));
    }, secondSnapshot);
    expect(relaunchedRendererErrors).toEqual([]);
    await desktop.close();
    desktop = undefined;

    desktop = await launchDesktop(userDataDirectory);
    page = await desktop.firstWindow();
    const recoveredRendererErrors = monitorRendererErrors(page);
    await waitForState(page, "BOOT | Screen: title");
    await activateTitleAction(page, "saveSlots");
    await waitForState(page, "[SAVE_SLOTS:load]");
    await holdKey(page, "ArrowDown", 80);
    await holdKey(page, "ArrowDown", 80);
    await waitForState(page, "[SAVE_SLOT:manual-2]");
    await expect(page.locator("#save-slot-live-region")).toContainText(
      "Desktop Second Hero Lv.1 Ranger",
    );
    expect(await page.evaluate(() =>
      localStorage.getItem("2dnd_save_slot_manual-2")
    )).toBe(secondSnapshot);
    expect(await page.evaluate(() =>
      localStorage.getItem("2dnd_save_slot_manual-2:staging")
    )).toBeNull();
    expect(await page.evaluate(() =>
      localStorage.getItem("2dnd_save_slot_manual-1")
    )).toBe(manualSnapshot);
    await activateSlotAction(page, "load");
    await waitForState(page, "OVERWORLD");
    expect(await page.evaluate(() => {
      const raw = localStorage.getItem("2dnd_save");
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (
        typeof parsed !== "object"
        || parsed === null
        || !("player" in parsed)
        || typeof parsed.player !== "object"
        || parsed.player === null
        || !("name" in parsed.player)
      ) {
        throw new Error("Missing continued desktop campaign");
      }
      return parsed.player.name;
    })).toBe("Desktop Second Hero");
    expect(await page.evaluate(() =>
      localStorage.getItem("2dnd_save_slot_manual-2")
    )).toBe(secondSnapshot);
    await returnToTitle(page);
    expect(recoveredRendererErrors).toEqual([]);

    const closePromise = desktop.waitForEvent("close");
    await clickGame(page, 320, 492, "terminal");
    await closePromise;
    desktop = undefined;

    const log = await readFile(logPath, "utf8");
    expect(log).toContain("[INFO] Application starting");
    expect(log).toContain("[INFO] Renderer ready");
    expect(log).toContain("[INFO] Quit requested by renderer");
    expect(log).toContain("[INFO] Application will quit");
    expect(log).not.toContain("Desktop Hero");
  } finally {
    if (desktop) await closeDesktop(desktop);
    await rm(userDataDirectory, { recursive: true, force: true });
  }
});

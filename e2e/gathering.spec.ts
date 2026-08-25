import { expect, test, type Page } from "@playwright/test";
import { clickLayoutItem } from "./helpers/layout";

const GAME_WIDTH = 640;
const GAME_HEIGHT = 528;
const SAVE_KEY = "2dnd_save";
const PREFERENCES_KEY = "2dnd_preferences";

interface GatheringSave {
  version: number;
  player: {
    inventory: Array<{ id: string }>;
    progression: {
      gathering: {
        pending: {
          discipline: "fishing" | "mining" | "foraging";
          outcomeId: string;
          resourceId: string;
          rarity: string;
          phase: "playing" | "battle";
          game: {
            kind: "fishing" | "mining" | "foraging";
            phase: string;
            biteAt?: number;
            pattern?: Array<"up" | "right" | "down" | "left">;
            tensionPattern?: Array<"up" | "right" | "down" | "left">;
          };
        } | null;
        stats: Record<string, {
          attempts: number;
          successes: number;
          failures: number;
          rareFinds: number;
        }>;
        discoveredResourceIds: string[];
      };
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

async function holdKey(
  page: Page,
  key: string,
  duration = 130,
): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(duration);
  await page.keyboard.up(key);
  await page.waitForTimeout(100);
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
  await page.waitForTimeout(220);
}

async function drainCutscenes(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const state = await page.locator("#debug-state").textContent() ?? "";
    if (state.includes("OVERWORLD")) return;
    if (state.includes("CUTSCENE")) await holdKey(page, "Enter", 70);
    else await page.waitForTimeout(100);
  }
  throw new Error("Timed out draining opening cutscenes");
}

async function createCampaign(page: Page): Promise<void> {
  await page.goto("game.html", { waitUntil: "networkidle" });
  await waitForState(page, "BOOT | Screen: title");
  await clickLayoutItem(page, "title-new-game");
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
    for (let step = 0; step < 5; step += 1) {
      await holdKey(page, "Space");
    }
  }
  await waitForState(page, "OVERWORLD");
}

async function readSave(page: Page): Promise<GatheringSave> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) throw new Error("Missing campaign save");
    return JSON.parse(raw) as GatheringSave;
  }, SAVE_KEY);
}

const GAMEPAD_BUTTON_BY_DIRECTION = {
  up: 12,
  right: 15,
  down: 13,
  left: 14,
} as const;

test("plays, reloads, records, and battles through all gathering disciplines", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  await page.addInitScript((preferencesKey) => {
    if (!sessionStorage.getItem("gatheringInitialized")) {
      localStorage.clear();
      sessionStorage.setItem("gatheringInitialized", "true");
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
        controls: {
          touchControls: "on",
          handedness: "right",
          promptSource: "auto",
        },
      }));
    }
    const state = {
      buttons: Array.from({ length: 17 }, () => false),
      axes: [0, 0, 0, 0],
    };
    const pad = {
      id: "Gathering Standard Gamepad",
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
    Object.defineProperty(window, "__setGatheringGamepadButton", {
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
    let seed = 0x6200;
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x1_0000_0000;
    };
  }, PREFERENCES_KEY);

  const pressGamepad = async (button: number): Promise<void> => {
    await page.evaluate((index) => {
      (window as typeof window & {
        __setGatheringGamepadButton(index: number, pressed: boolean): void;
      }).__setGatheringGamepadButton(index, true);
    }, button);
    await page.waitForTimeout(130);
    await page.evaluate((index) => {
      (window as typeof window & {
        __setGatheringGamepadButton(index: number, pressed: boolean): void;
      }).__setGatheringGamepadButton(index, false);
    }, button);
    await page.waitForTimeout(130);
  };

  await createCampaign(page);
  await expect(page.locator("#game-container canvas"))
    .toHaveAttribute("data-text-scale", "1.5");
  await expect(page.locator("#game-container canvas"))
    .toHaveAttribute("data-reduced-motion", "true");
  await expect(page.locator("#touch-controls")).toHaveClass(/visible/);

  await submitDebug(page, "/gather near fishing");
  await waitForState(page, "OVERWORLD");
  await page.locator('[data-action="confirm"]').click();
  await waitForState(page, "[GATHERING:fishing]");
  const fishingBeforeReload = (await readSave(page)).player.progression.gathering.pending;
  expect(fishingBeforeReload?.discipline).toBe("fishing");

  await page.reload({ waitUntil: "networkidle" });
  await waitForState(page, "BOOT | Screen: title");
  await clickLayoutItem(page, "title-continue");
  await waitForState(page, "[GATHERING:fishing]");
  await page.locator('[data-action="confirm"]').click();
  await submitDebug(page, "/gather resolve success");
  await expect(page.locator("#debug-state")).not.toContainText("[GATHERING:");
  let save = await readSave(page);
  expect(save.player.progression.gathering.stats.fishing.successes).toBe(1);
  expect(save.player.progression.gathering.discoveredResourceIds.length).toBe(1);

  await submitDebug(page, "/gather near mining");
  await submitDebug(page, "/gather trigger mining");
  await waitForState(page, "[GATHERING:mining]");
  let pending = (await readSave(page)).player.progression.gathering.pending!;
  const expected = pending.game.pattern?.[0] ?? "left";
  const wrong = expected === "left" ? "right" : "left";
  await pressGamepad(GAMEPAD_BUTTON_BY_DIRECTION[wrong]);
  await expect(page.locator("#game-container canvas"))
    .toHaveAttribute("data-input-source", "gamepad");
  await submitDebug(page, "/gather resolve failure");
  save = await readSave(page);
  expect(save.player.progression.gathering.stats.mining.failures).toBe(1);

  await submitDebug(page, "/gather near foraging");
  await submitDebug(page, "/gather trigger foraging");
  await waitForState(page, "[GATHERING:foraging]");
  await clickGame(page, 320, 395);
  await submitDebug(page, "/gather resolve success");
  save = await readSave(page);
  expect(save.player.progression.gathering.stats.foraging.successes).toBe(1);

  await holdKey(page, "k");
  await waitForState(page, "[GATHERING_STATUS:");
  await page.setViewportSize({ width: 932, height: 430 });
  await expect(page.locator("#game-container canvas")).toBeVisible();
  await holdKey(page, "Escape");

  await submitDebug(page, "/gather near fishing");
  await submitDebug(page, "/gather trigger fishing");
  await waitForState(page, "[GATHERING:fishing]");
  await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key)!) as GatheringSave;
    const pending = save.player.progression.gathering.pending!;
    pending.outcomeId = "catchStormEel";
    pending.resourceId = "stormEel";
    pending.rarity = "rare";
    localStorage.setItem(key, JSON.stringify(save));
  }, SAVE_KEY);
  await page.reload({ waitUntil: "networkidle" });
  await waitForState(page, "BOOT | Screen: title");
  await clickLayoutItem(page, "title-continue");
  await waitForState(page, "[GATHERING:fishing]");
  await submitDebug(page, "/gather resolve success");
  await waitForState(page, "BATTLE");
  await submitDebug(page, "/kill");
  await waitForState(page, "OVERWORLD");
  save = await readSave(page);
  expect(save.player.inventory.some((item) => item.id === "stormEel")).toBe(true);
  expect(save.player.progression.gathering.pending).toBeNull();
  expect(save.version).toBe(18);
  expect(browserErrors).toEqual([]);
});

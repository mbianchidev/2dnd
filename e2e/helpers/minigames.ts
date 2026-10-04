import { expect, type Page } from "@playwright/test";
import { createCurrentSaveData } from "../../src/systems/save";
import { createCodex } from "../../src/systems/codex";
import { createMinigameChallenge } from "../../src/systems/minigameRules";
import { getMinigameRunId } from "../../src/systems/minigameState";
import { createWeatherState, WeatherType } from "../../src/systems/weather";
import { playerAt } from "../../tests/helpers/minigames";
import { clickPointerAt, tapPointerAt, waitForGameInputFrame } from "./layout";
import type { MinigameVenueId } from "../../src/data/minigames";
import type { SaveData } from "../../src/systems/save";
import type { MinigameSession } from "../../src/systems/minigameTypes";
import type { InputSource } from "../../src/systems/input";

const GAME_WIDTH = 640;
const GAME_HEIGHT = 528;

export type MinigameTestSource = Extract<InputSource, "keyboard" | "touch" | "gamepad">;

export function minigameFixture(venueId: MinigameVenueId, seed = 167): SaveData {
  const player = playerAt(venueId, seed);
  player.progression.tutorial.completed = true;
  player.progression.seenCutsceneIds = ["campaign.opening"];
  player.progression.pendingCutsceneIds = [];
  const data = createCurrentSaveData(player, new Set(), createCodex(), player.appearanceId, 45, createWeatherState());
  data.timestamp = 1;
  return data;
}

export function crownFixtureSeed(firstBones = false): number {
  for (let seed = 1; seed < 500; seed += 1) {
    const challenge = createMinigameChallenge("crownAndBones", "friendly", seed, getMinigameRunId(seed, 1));
    if (challenge.kind !== "crownAndBones") throw new Error("Missing dice fixture");
    const totals = challenge.rolls.map(([first, second]) => first + second);
    if (firstBones ? totals[0] === 7 : totals.every((total) => total !== 7)) return seed;
  }
  throw new Error("No deterministic dice fixture was found");
}

export async function installMinigameGamepad(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const pad = {
      id: "Minigame Fixture Standard Pad", mapping: "standard", index: 0,
      connected: true, timestamp: 0, axes: [0, 0, 0, 0], vibrationActuator: null,
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
    };
    Object.defineProperty(navigator, "getGamepads", { configurable: true, value: () => [pad] });
    Object.defineProperty(window, "__setMinigamePadButton", {
      configurable: true,
      value: (index: number, pressed: boolean): void => {
        pad.buttons[index] = { pressed, touched: pressed, value: pressed ? 1 : 0 };
        pad.timestamp += 1;
      },
    });
  });
}

export async function readMinigameSave(page: Page): Promise<SaveData> {
  return page.evaluate(() => {
    const raw = localStorage.getItem("2dnd_save");
    if (!raw) throw new Error("Missing minigame campaign fixture");
    return JSON.parse(raw) as SaveData;
  });
}

export async function waitMinigameState(page: Page, text: string): Promise<void> {
  await expect(page.locator("#debug-state")).toContainText(text);
}

async function holdMinigameInputFrame(page: Page, duration: number): Promise<void> {
  await Promise.all([
    page.waitForTimeout(duration),
    waitForGameInputFrame(page),
  ]);
}

export async function minigameKey(page: Page, key: string, duration = 100): Promise<void> {
  await page.keyboard.down(key);
  try {
    await holdMinigameInputFrame(page, duration);
  } finally {
    await page.keyboard.up(key);
  }
  await page.waitForTimeout(130);
}

export async function minigamePad(page: Page, index: number): Promise<void> {
  await page.evaluate((button) => {
    (window as typeof window & {
      __setMinigamePadButton(index: number, pressed: boolean): void;
    }).__setMinigamePadButton(button, true);
  }, index);
  try {
    await holdMinigameInputFrame(page, 100);
  } finally {
    await page.evaluate((button) => {
      (window as typeof window & {
        __setMinigamePadButton(index: number, pressed: boolean): void;
      }).__setMinigamePadButton(button, false);
    }, index);
  }
  await page.waitForTimeout(140);
}

export async function minigameTouchControl(page: Page, action: string): Promise<void> {
  const control = page.locator(`[data-action="${action}"]`);
  await expect(control).toBeVisible();
  const bounds = await control.boundingBox();
  if (!bounds) throw new Error(`Touch control ${action} has no rendered bounds`);
  await tapPointerAt(page, bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
}

export async function minigameConfirm(page: Page, source: MinigameTestSource): Promise<void> {
  if (source === "gamepad") await minigamePad(page, 0);
  else if (source === "touch") {
    await minigameTouchControl(page, "confirm");
    await page.waitForTimeout(200);
  } else await minigameKey(page, "Enter");
}

export async function minigameCancel(page: Page, source: MinigameTestSource): Promise<void> {
  if (source === "gamepad") await minigamePad(page, 1);
  else if (source === "touch") {
    await minigameTouchControl(page, "cancel");
    await page.waitForTimeout(200);
  } else await minigameKey(page, "Escape");
}

export async function seedMinigamePage(
  page: Page,
  save: SaveData,
  source: MinigameTestSource,
  options: { reducedMotion?: boolean; textScale?: 1 | 1.25 | 1.5; touchControls?: "on" | "off" } = {},
): Promise<void> {
  await page.evaluate(({ campaign, preferences }) => {
    localStorage.clear();
    localStorage.setItem("2dnd_save", JSON.stringify(campaign));
    localStorage.setItem("2dnd_preferences", JSON.stringify(preferences));
  }, {
    campaign: save,
    preferences: {
      version: 2,
      audio: { masterVolume: 0, musicVolume: 0, sfxVolume: 0, dialogVolume: 0, muted: true },
      accessibility: {
        reducedMotion: options.reducedMotion ?? true,
        textScale: options.textScale ?? (source === "touch" ? 1.5 : source === "gamepad" ? 1.25 : 1),
        highContrast: true, advanceMode: "manual",
      },
      controls: { touchControls: options.touchControls ?? (source === "touch" ? "on" : "off"), handedness: "right", promptSource: "auto" },
    },
  });
  await page.reload({ waitUntil: "networkidle" });
  await continueMinigameFixture(page);
}

export async function continueMinigameFixture(page: Page): Promise<void> {
  await waitMinigameState(page, "BOOT | Screen: title");
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const state = await page.locator("#debug-state").textContent() ?? "";
    if (state.includes("[TITLE_ACTION:continue]")) break;
    await minigameKey(page, "ArrowDown", 70);
  }
  await expect(page.locator("#debug-state")).toContainText("[TITLE_ACTION:continue]");
  await minigameKey(page, "Enter");
  await waitMinigameState(page, "OVERWORLD");
}

export async function openMinigameFixture(page: Page, source: MinigameTestSource): Promise<void> {
  if (source === "keyboard") await minigameKey(page, "Space");
  else await minigameConfirm(page, source);
  await waitMinigameState(page, "[MINIGAME_VIEW:lobby]");
  await expect(page.locator("#minigame-live-region")).toContainText("Entry");
  await minigameConfirm(page, source);
  await waitMinigameState(page, "[MINIGAME_VIEW:game]");
}

export async function aimMinigamePointer(page: Page, aim: number, touch = false): Promise<void> {
  const canvas = page.locator("#game-container canvas");
  const raw = await canvas.getAttribute("data-minigame-meter");
  if (!raw) throw new Error("The rendered archery meter has no bounds");
  const meter = JSON.parse(raw) as { x: number; y: number; width: number };
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("The archery canvas has no rendered bounds");
  const x = bounds.x + (meter.x + meter.width * aim / 100) / GAME_WIDTH * bounds.width;
  const y = bounds.y + meter.y / GAME_HEIGHT * bounds.height;
  if (touch) await tapPointerAt(page, x, y);
  else await clickPointerAt(page, x, y);
  await page.waitForTimeout(140);
}

export async function minigameDirection(
  page: Page,
  direction: "up" | "down" | "left" | "right",
  source: MinigameTestSource,
): Promise<void> {
  if (source === "gamepad") {
    await minigamePad(page, { up: 12, down: 13, left: 14, right: 15 }[direction]);
  } else if (source === "touch") {
    const action = `navigate${direction[0]!.toUpperCase()}${direction.slice(1)}`;
    await minigameTouchControl(page, action);
    await page.waitForTimeout(150);
  } else await minigameKey(page, `Arrow${direction[0]!.toUpperCase()}${direction.slice(1)}`);
}

export async function finishRegattaFixture(page: Page, source: MinigameTestSource): Promise<void> {
  const session: MinigameSession | null = (await readMinigameSave(page)).player.progression.minigames.pending;
  if (session?.activityId !== "regatta") throw new Error("Missing live regatta fixture");
  for (let index = 1; index < session.challenge.route.length; index += 1) {
    const previous = session.challenge.route[index - 1]!;
    const next = session.challenge.route[index]!;
    const direction = next.x > previous.x ? "right" : next.x < previous.x ? "left" : next.y > previous.y ? "down" : "up";
    await minigameDirection(page, direction, source);
  }
  await waitMinigameState(page, "[MINIGAME_VIEW:result]");
}

export async function finishArcheryFixture(
  page: Page,
  source: MinigameTestSource,
  afterArrow?: (index: number) => Promise<void>,
): Promise<void> {
  for (let index = 0; index < 5; index += 1) {
    const pending = (await readMinigameSave(page)).player.progression.minigames.pending;
    if (pending?.activityId !== "archery") throw new Error("Missing live archery fixture");
    const target = pending.challenge.targets[index]!;
    const coarse = Math.floor(target / 5);
    for (let step = 0; step < coarse; step += 1) {
      await minigameDirection(page, "up", source);
      await expect(page.locator("#game-container canvas")).toHaveAttribute("data-minigame-visible-aim", String((step + 1) * 5));
    }
    for (let step = coarse * 5; step < target; step += 1) {
      await minigameDirection(page, "right", source);
      await expect(page.locator("#game-container canvas")).toHaveAttribute("data-minigame-visible-aim", String(step + 1));
    }
    await expect(page.locator("#game-container canvas")).toHaveAttribute("data-minigame-visible-aim", String(target));
    await minigameConfirm(page, source);
    await expect.poll(async () => {
      const current = (await readMinigameSave(page)).player.progression.minigames.pending;
      return current?.activityId === "archery" ? current.game.shots.length : 0;
    }).toBe(index + 1);
    if (afterArrow) await afterArrow(index);
  }
  await waitMinigameState(page, "[MINIGAME_VIEW:result]");
}

export function minigameBrowserErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  return errors;
}

export const MINIGAME_TEST_WEATHER = WeatherType.Storm;

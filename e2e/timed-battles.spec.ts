import { expect, test, type Page } from "@playwright/test";
import { getItem } from "../src/data/items";
import type { BattleTimingSettings } from "../src/data/battleTiming";
import { SAVE_VERSION, type SaveData } from "../src/systems/save";
import { clickLayoutItem, expectCleanLayout, tapLayoutItem } from "./helpers/layout";

const SAVE_KEY = "2dnd_save";
const GAME_WIDTH = 640;
const GAME_HEIGHT = 528;
const canvasSelector = "#game-container canvas";

interface FixtureOptions {
  timing?: BattleTimingSettings;
  textScale?: 1 | 1.25 | 1.5;
  reducedMotion?: boolean;
}

async function state(page: Page, text: string): Promise<void> {
  await expect(page.locator("#debug-state")).toContainText(text);
}

async function holdKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(140);
  await page.keyboard.up(key);
  await page.waitForTimeout(100);
}

async function clickGame(page: Page, x: number, y: number): Promise<void> {
  const bounds = await page.locator(canvasSelector).boundingBox();
  if (!bounds) throw new Error("Game canvas has no rendered bounds");
  await page.mouse.click(
    bounds.x + x / GAME_WIDTH * bounds.width,
    bounds.y + y / GAME_HEIGHT * bounds.height,
  );
}

async function readSave(page: Page): Promise<SaveData> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) throw new Error("Missing mock campaign checkpoint");
    return JSON.parse(raw) as SaveData;
  }, SAVE_KEY);
}

async function remaining(page: Page): Promise<number> {
  return Number(await page.locator(canvasSelector).getAttribute("data-battle-timing-remaining-ms"));
}

async function readyCampaign(page: Page, options: FixtureOptions = {}): Promise<void> {
  await page.addInitScript((preferences) => {
    if (!sessionStorage.getItem("timedBattleFixtureInitialized")) {
      localStorage.clear();
      sessionStorage.setItem("timedBattleFixtureInitialized", "true");
      localStorage.setItem("2dnd_preferences", JSON.stringify({
        version: 2,
        audio: { masterVolume: 0, musicVolume: 0, sfxVolume: 0, dialogVolume: 0, muted: true },
        accessibility: {
          textScale: preferences.textScale,
          highContrast: true,
          reducedMotion: preferences.reducedMotion,
          advanceMode: "manual",
        },
        controls: { touchControls: "on", handedness: "right", promptSource: "auto" },
      }));
    }
    let seed = 0x1642026;
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x1_0000_0000;
    };
  }, { textScale: options.textScale ?? 1, reducedMotion: options.reducedMotion ?? false });
  await page.goto("game.html", { waitUntil: "networkidle" });
  await state(page, "BOOT | Screen: title");
  await clickLayoutItem(page, "title-new-game");
  await state(page, "BOOT | Screen: character");
  await clickGame(page, 284, 160);
  await holdKey(page, "Enter");
  await state(page, "BOOT | Screen: stats");
  await clickGame(page, 390, 64);
  await clickGame(page, 400, 460);
  await state(page, "BOOT | Screen: appearance");
  await clickGame(page, 320, 112);
  await clickGame(page, 420, 312);
  await state(page, "CUTSCENE");
  await page.evaluate(({ timing, items }) => {
    const raw = localStorage.getItem("2dnd_save");
    if (!raw) throw new Error("Missing new mock campaign");
    const save = JSON.parse(raw) as SaveData;
    save.player.progression.pendingCutsceneIds = [];
    save.player.progression.seenCutsceneIds = ["campaign.opening", "campaign.stage.firstSeal"];
    save.player.progression.tutorial.completed = true;
    save.player.level = 5;
    save.player.hp = 200;
    save.player.maxHp = 500;
    save.player.mp = 20;
    save.player.maxMp = 40;
    save.player.gold = 100;
    save.player.stats.dexterity = 60;
    save.player.knownSpells = ["magicMissile", "cureWounds"];
    save.player.knownAbilities = ["rage", "recklessStrike"];
    save.player.inventory.push(...items);
    if (timing) save.player.battleTiming = timing;
    localStorage.setItem("2dnd_save", JSON.stringify(save));
  }, {
    timing: options.timing,
    items: [
      { ...getItem("ether")! }, { ...getItem("ether")! },
      { ...getItem("potion")! }, { ...getItem("potion")! },
    ],
  });
  await page.reload({ waitUntil: "networkidle" });
  await state(page, "BOOT | Screen: title");
  await clickLayoutItem(page, "title-continue");
  await state(page, "OVERWORLD");
}

async function debug(page: Page, command: string): Promise<void> {
  const checkbox = page.locator("#debug-checkbox");
  if (!await checkbox.isChecked()) await checkbox.check();
  const input = page.locator("#debug-cmd");
  if (await input.isVisible()) {
    await input.fill(command);
    await input.press("Enter");
    await input.blur();
  } else {
    await input.evaluate((element, value) => {
      const commandInput = element as HTMLInputElement;
      commandInput.value = value;
      commandInput.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Enter", code: "Enter", bubbles: true,
      }));
    }, command);
  }
  await page.locator(canvasSelector).focus();
}

async function encounter(page: Page): Promise<void> {
  await debug(page, "/spawn orc");
  await state(page, "BATTLE | Phase: playerTurn");
  const canvas = page.locator(canvasSelector);
  if ((await readSave(page)).player.battleTiming.mode === "timed") {
    await expect(canvas).toHaveAttribute("data-battle-timing-actor", "party:hero");
    await expect(canvas).toHaveAttribute("data-battle-timing-state", "active");
  }
}

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

test("Standard stays unlimited; keyboard settings, timeout targeting, and reload recover safely", async ({ page }) => {
  const errors = trackErrors(page);
  await readyCampaign(page, { textScale: 1.5, reducedMotion: true });
  expect((await readSave(page)).player.battleTiming).toEqual({
    mode: "standard", durationSeconds: 30, timeoutAction: "defend",
  });
  await encounter(page);
  await page.waitForTimeout(1_000);
  await expect(page.locator(canvasSelector)).not.toHaveAttribute("data-battle-timing-mode");
  await expect(page.locator("#battle-countdown-status")).toHaveCount(0);
  await debug(page, "/kill");
  await state(page, "OVERWORLD");

  const preferences = await page.evaluate(() => localStorage.getItem("2dnd_preferences"));
  await holdKey(page, "Escape");
  await clickLayoutItem(page, "escape-menu-settings");
  await expectCleanLayout(page);
  await holdKey(page, "Enter");
  await expect(page.locator("#layout-report")).toContainText("battle-timing-settings");
  await expectCleanLayout(page);
  await holdKey(page, "Enter");
  await holdKey(page, "ArrowDown");
  for (let index = 0; index < 4; index++) await holdKey(page, "Enter");
  expect((await readSave(page)).player.battleTiming).toEqual({
    mode: "timed", durationSeconds: 15, timeoutAction: "defend",
  });
  expect(await page.evaluate(() => localStorage.getItem("2dnd_preferences"))).toBe(preferences);
  await expectCleanLayout(page);
  await holdKey(page, "Escape");
  await holdKey(page, "F1");
  await holdKey(page, "D");
  await holdKey(page, "S");
  await holdKey(page, "S");
  await expect(page.locator("#layout-report")).toContainText("Timed decisions");
  await expectCleanLayout(page);
  await holdKey(page, "Escape");
  await encounter(page);
  await expectCleanLayout(page);
  const checkpoint = await readSave(page);
  const checkpointRaw = await page.evaluate(() => localStorage.getItem("2dnd_save"));
  await holdKey(page, "Enter");
  await state(page, "[TARGET:Attack]");
  await expect.poll(() => remaining(page), { timeout: 20_000 }).toBeLessThanOrEqual(5_000);
  await expect(page.locator("#battle-countdown-status")).toContainText("TIME LOW");
  await expect(page.locator(canvasSelector)).toHaveAttribute("data-battle-timeout-count", "1");
  await state(page, "[TARGET:-]");
  await expect(page.locator("#debug-log")).toContainText("Time expired:");
  expect(await page.evaluate(() => localStorage.getItem("2dnd_save"))).toBe(checkpointRaw);
  await page.reload({ waitUntil: "networkidle" });
  await state(page, "BOOT | Screen: title");
  await expect(page.locator("#battle-countdown-status")).toHaveCount(0);
  await clickLayoutItem(page, "title-continue");
  await state(page, "OVERWORLD");
  const reloaded = await readSave(page);
  expect({
    hp: reloaded.player.hp, mp: reloaded.player.mp,
    gold: reloaded.player.gold, xp: reloaded.player.xp,
    items: reloaded.player.inventory.map((item) => item.id),
  }).toEqual({
    hp: checkpoint.player.hp, mp: checkpoint.player.mp,
    gold: checkpoint.player.gold, xp: checkpoint.player.xp,
    items: checkpoint.player.inventory.map((item) => item.id),
  });
  expect(reloaded.version).toBe(SAVE_VERSION);
  await encounter(page);
  expect(await remaining(page)).toBeGreaterThan(14_000);
  await expect(page.locator(canvasSelector)).toHaveAttribute("data-battle-timeout-count", "0");
  await debug(page, "/kill");
  await state(page, "OVERWORLD");
  await expect(page.locator("#battle-timing-announcement")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("items, bonus abilities, spells, Defend, Flee, and real action pauses share authoritative economy", async ({ page }) => {
  const errors = trackErrors(page);
  await readyCampaign(page, {
    timing: { mode: "timed", durationSeconds: 60, timeoutAction: "defend" },
  });
  await encounter(page);
  const checkpointRaw = await page.evaluate(() => localStorage.getItem("2dnd_save"));
  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("#game-container canvas");
    if (!canvas) throw new Error("Missing Battle canvas");
    Object.defineProperty(window, "__timedActionPause", { configurable: true, writable: true, value: false });
    const observer = new MutationObserver(() => {
      if (
        canvas.dataset.battleTimingActor === "party:hero"
        && canvas.dataset.battleTimingState === "paused"
        && canvas.dataset.battleTimingReasons?.includes("animation")
      ) {
        (window as typeof window & { __timedActionPause: boolean }).__timedActionPause = true;
      }
    });
    observer.observe(canvas, { attributes: true, attributeFilter: ["data-battle-timing-reasons"] });
  });
  const turn = await page.locator(canvasSelector).getAttribute("data-battle-timing-turn");
  const budget = await remaining(page);
  await clickLayoutItem(page, "battle-action-items");
  await clickLayoutItem(page, "battle-hero-menu-item-3");
  await state(page, "[DECISION_MENU:Choose ally:");
  await holdKey(page, "Enter");
  await state(page, "[ECONOMY:main-ready:bonus-used:items-1]");
  expect(await page.evaluate(() => localStorage.getItem("2dnd_save"))).toBe(checkpointRaw);
  expect(await page.locator(canvasSelector).getAttribute("data-battle-timing-turn")).toBe(turn);
  expect(await remaining(page)).toBeLessThanOrEqual(budget);
  await expect.poll(() => page.evaluate(() =>
    (window as typeof window & { __timedActionPause: boolean }).__timedActionPause
  )).toBe(true);
  await expect(page.locator(canvasSelector)).toHaveAttribute("data-battle-timing-state", "active");
  await clickLayoutItem(page, "battle-action-abilities");
  await state(page, "[UNAVAILABLE_ACTIONS:ability-rage]");
  await clickLayoutItem(page, "battle-hero-menu-ability-rage");
  await state(page, "[ECONOMY:main-ready:bonus-used:items-1]");
  await state(page, "MP 20/40");
  await holdKey(page, "Escape");
  await clickLayoutItem(page, "battle-action-defend");
  await expect(page.locator(canvasSelector)).toHaveAttribute("data-battle-timing-actor", "party:hero");
  await expect(page.locator(canvasSelector)).toHaveAttribute("data-battle-timing-state", "active");
  const nextTurn = await page.locator(canvasSelector).getAttribute("data-battle-timing-turn");
  expect(nextTurn).not.toBe(turn);
  await clickLayoutItem(page, "battle-action-abilities");
  await clickLayoutItem(page, "battle-hero-menu-ability-rage");
  await state(page, "[ECONOMY:main-ready:bonus-used:items-0]");
  await state(page, "MP 15/40");
  await expect(page.locator(canvasSelector)).toHaveAttribute("data-battle-timing-state", "active");
  await expect(page.locator('[data-action="openMenu"]')).toBeHidden();
  await holdKey(page, "Escape");
  await expect(page.locator(canvasSelector)).toHaveAttribute("data-battle-timing-reasons", /log/);
  await expect(page.locator("#layout-report")).not.toContainText("battle-timing-settings");
  await expect(page.locator("#layout-report")).not.toContainText("settings-battle-timing");
  expect(await page.evaluate(() => localStorage.getItem("2dnd_save"))).toBe(checkpointRaw);
  await holdKey(page, "Enter");
  await expect(page.locator(canvasSelector)).toHaveAttribute("data-battle-timing-state", "active");
  await clickLayoutItem(page, "battle-action-spells");
  await clickLayoutItem(page, "battle-hero-menu-spell-magicMissile");
  await holdKey(page, "Enter");
  await state(page, "party:hero:cast:spell");
  await state(page, "MP 12/40");
  expect(await page.evaluate(() => localStorage.getItem("2dnd_save"))).toBe(checkpointRaw);
  await expect(page.locator(canvasSelector)).toHaveAttribute("data-battle-timing-actor", "party:hero");
  await expect(page.locator(canvasSelector)).toHaveAttribute("data-battle-timing-state", "active");
  await clickLayoutItem(page, "battle-action-flee");
  await state(page, "OVERWORLD");
  const saved = await readSave(page);
  expect(saved.player.mp).toBe(12);
  expect(saved.player.inventory.filter((item) => item.id === "potion")).toHaveLength(1);
  expect(saved.player.inventory.filter((item) => item.id === "ether")).toHaveLength(2);
  expect(saved.player.gold).toBe(100);
  expect(saved.player.activeEffects).toEqual([]);
  await expect(page.locator("#battle-countdown-status")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("log reading, text entry, focus, and visibility freeze time without confirming a target", async ({ page }) => {
  const errors = trackErrors(page);
  await readyCampaign(page, {
    timing: { mode: "timed", durationSeconds: 15, timeoutAction: "defend" },
    textScale: 1.25, reducedMotion: true,
  });
  await encounter(page);
  const canvas = page.locator(canvasSelector);
  await holdKey(page, "Enter");
  await state(page, "[TARGET:Attack]");
  await holdKey(page, "Escape");
  await expect(canvas).toHaveAttribute("data-battle-timing-state", "active");
  await holdKey(page, "Escape");
  await expect(canvas).toHaveAttribute("data-battle-timing-reasons", /log/);
  const logBudget = await remaining(page);
  await page.waitForTimeout(900);
  expect(await remaining(page)).toBe(logBudget);
  await holdKey(page, "Enter");
  await expect(canvas).toHaveAttribute("data-battle-timing-state", "active");
  await holdKey(page, "Enter");
  await state(page, "[TARGET:Attack]");
  await page.locator("#debug-cmd").fill("reading without submitting a command");
  await expect(canvas).toHaveAttribute("data-battle-timing-reasons", /overlay/);
  const overlayBudget = await remaining(page);
  await page.waitForTimeout(900);
  expect(await remaining(page)).toBe(overlayBudget);
  await page.locator("#debug-cmd").blur();
  await canvas.focus();
  await expect(canvas).toHaveAttribute("data-battle-timing-state", "active");

  for (const blocked of ["visibility", "focus"] as const) {
    await page.evaluate((reason) => {
      if (reason === "visibility") {
        Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
        document.dispatchEvent(new Event("visibilitychange"));
      } else window.dispatchEvent(new Event("blur"));
    }, blocked);
    await expect(canvas).toHaveAttribute("data-battle-timing-reasons", new RegExp(blocked));
    const paused = await remaining(page);
    await page.waitForTimeout(900);
    expect(await remaining(page)).toBe(paused);
    await page.evaluate((reason) => {
      if (reason === "visibility") {
        Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
        document.dispatchEvent(new Event("visibilitychange"));
      } else window.dispatchEvent(new Event("focus"));
    }, blocked);
    await expect(canvas).toHaveAttribute("data-battle-timing-state", "active");
  }
  await clickLayoutItem(page, "battle-timing-pause");
  await expect(canvas).toHaveAttribute("data-battle-timing-reasons", /log/);
  await clickLayoutItem(page, "battle-timing-pause");
  await state(page, "[TARGET:Attack]");
  await expect(canvas).toHaveAttribute("data-battle-timeout-count", "0");
  await expectCleanLayout(page);
  await debug(page, "/kill");
  await state(page, "OVERWORLD");
  expect(errors).toEqual([]);
});

test.describe("touch and gamepad timed decisions", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 430, height: 932 } });

  test("manual companion targeting, spent-main timeout, and controller recovery work at 150%", async ({ page }) => {
    const errors = trackErrors(page);
    await page.addInitScript(() => {
      const pad = {
        id: "Mock Timed Battle Pad", index: 0, connected: true,
        mapping: "standard", timestamp: 0, vibrationActuator: null,
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
      };
      const sparePad = {
        ...pad, id: "Mock Spare Timed Battle Pad", index: 1,
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
      };
      Object.defineProperty(navigator, "getGamepads", {
        configurable: true, value: () => pad.connected ? [pad, sparePad] : [sparePad],
      });
      Object.defineProperty(window, "__timedPadButton", {
        value: (index: number, pressed: boolean) => {
          pad.buttons[index] = { pressed, touched: pressed, value: pressed ? 1 : 0 };
          pad.timestamp++;
        },
      });
      Object.defineProperty(window, "__timedPadConnected", {
        value: (connected: boolean) => {
          pad.connected = connected;
          window.dispatchEvent(new Event(connected ? "gamepadconnected" : "gamepaddisconnected"));
        },
      });
    });
    const padButton = async (index: number): Promise<void> => {
      await page.evaluate((button) => {
        (window as typeof window & { __timedPadButton(index: number, pressed: boolean): void })
          .__timedPadButton(button, true);
      }, index);
      await page.waitForTimeout(150);
      await page.evaluate((button) => {
        (window as typeof window & { __timedPadButton(index: number, pressed: boolean): void })
          .__timedPadButton(button, false);
      }, index);
      await page.waitForTimeout(150);
    };
    const connect = async (connected: boolean): Promise<void> => {
      await page.evaluate((value) => {
        (window as typeof window & { __timedPadConnected(connected: boolean): void })
          .__timedPadConnected(value);
      }, connected);
    };
    await readyCampaign(page, {
      timing: { mode: "standard", durationSeconds: 15, timeoutAction: "defend" },
      textScale: 1.5, reducedMotion: true,
    });
    await page.locator('[data-action="openMenu"]').tap();
    await tapLayoutItem(page, "escape-menu-settings");
    await tapLayoutItem(page, "settings-battle-timing");
    await expectCleanLayout(page);
    await tapLayoutItem(page, "battle-timing-mode");
    await page.locator('[data-action="cancel"]').tap();
    expect((await readSave(page)).player.battleTiming.mode).toBe("timed");
    await debug(page, "/companion recruit guardian");
    await debug(page, "/companion mode guardian manual");
    await encounter(page);
    await tapLayoutItem(page, "battle-action-defend");
    const canvas = page.locator(canvasSelector);
    await expect(canvas).toHaveAttribute("data-battle-timing-actor", "party:companion:guardian");
    await expect(canvas).toHaveAttribute("data-battle-timing-state", "active");
    await expectCleanLayout(page);
    const manualTurn = await canvas.getAttribute("data-battle-timing-turn");
    await page.locator('[data-action="confirm"]').tap();
    await state(page, "[DECISION_MENU:Choose Target:");
    await expectCleanLayout(page);
    await page.locator('[data-action="cancel"]').tap();
    expect(await canvas.getAttribute("data-battle-timing-turn")).toBe(manualTurn);
    await padButton(0);
    await state(page, "[DECISION_MENU:Choose Target:");
    await padButton(0);
    expect(await canvas.getAttribute("data-battle-timing-turn")).toBe(manualTurn);
    await expect(canvas).toHaveAttribute("data-battle-timeout-count", "1");
    await expect(page.locator("#debug-log")).toContainText("Turn action is unavailable. Ending turn.");
    await expect(canvas).toHaveAttribute("data-battle-timing-actor", "party:hero");
    await expect(canvas).toHaveAttribute("data-battle-timing-state", "active");

    await connect(false);
    await expect(canvas).toHaveAttribute("data-battle-timing-reasons", /controller/);
    const disconnectedBudget = await remaining(page);
    await page.waitForTimeout(900);
    expect(await remaining(page)).toBe(disconnectedBudget);
    await connect(true);
    await expect(canvas).toHaveAttribute("data-battle-timing-reasons", /controller/);
    await padButton(0);
    await expect(canvas).toHaveAttribute("data-battle-timing-state", "active");
    await state(page, "[ECONOMY:main-ready:bonus-ready:items-0]");
    await connect(false);
    await expect(canvas).toHaveAttribute("data-battle-timing-reasons", /controller/);
    await tapLayoutItem(page, "battle-timing-pause");
    await expect(canvas).toHaveAttribute("data-battle-timing-state", "active");
    await state(page, "[ECONOMY:main-ready:bonus-ready:items-0]");
    await connect(true);
    await padButton(14);
    await connect(false);
    await expect(canvas).toHaveAttribute("data-battle-timing-reasons", /controller/);
    await holdKey(page, "Enter");
    await expect(canvas).toHaveAttribute("data-battle-timing-state", "active");
    await state(page, "[ECONOMY:main-ready:bonus-ready:items-0]");
    await page.setViewportSize({ width: 932, height: 430 });
    await expectCleanLayout(page);
    await debug(page, "/kill");
    await state(page, "OVERWORLD");
    expect(errors).toEqual([]);
  });
});

test("a pending special encounter reloads once with a fresh budget and no result replay", async ({ page }) => {
  const errors = trackErrors(page);
  await readyCampaign(page, {
    timing: { mode: "timed", durationSeconds: 15, timeoutAction: "defend" },
    reducedMotion: true,
  });
  await debug(page, "/event trigger goblinRoadAmbush");
  await state(page, "[WORLD_EVENT:goblinRoadAmbush]");
  await clickLayoutItem(page, "world-event-choice-fightAmbush");
  await state(page, "BATTLE | Phase: playerTurn");
  const pending = (await readSave(page)).player.progression.worldEvents.pending;
  expect(pending?.phase).toBe("battle");
  await page.reload({ waitUntil: "networkidle" });
  await state(page, "BOOT | Screen: title");
  await clickLayoutItem(page, "title-continue");
  await state(page, "BATTLE | Phase: playerTurn");
  expect((await readSave(page)).player.progression.worldEvents.pending).toEqual(pending);
  await expect(page.locator(canvasSelector)).toHaveAttribute("data-battle-timeout-count", "0");
  expect(await remaining(page)).toBeGreaterThan(14_000);
  await debug(page, "/kill");
  await state(page, "OVERWORLD");
  const resolved = await readSave(page);
  expect(resolved.player.progression.worldEvents.pending).toBeNull();
  expect(resolved.player.progression.worldEvents.resolvedOutcomeIds
    .filter((id) => id.includes(pending!.instanceId))).toHaveLength(1);
  const gold = resolved.player.gold;
  const xp = resolved.player.xp;
  await page.reload({ waitUntil: "networkidle" });
  await state(page, "BOOT | Screen: title");
  await clickLayoutItem(page, "title-continue");
  await state(page, "OVERWORLD");
  expect((await readSave(page)).player.gold).toBe(gold);
  expect((await readSave(page)).player.xp).toBe(xp);
  await expect(page.locator("#battle-countdown-status")).toHaveCount(0);
  expect(errors).toEqual([]);
});

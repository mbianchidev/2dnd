import { expect, test, type Page } from "@playwright/test";

const GAME_WIDTH = 640;
const GAME_HEIGHT = 528;
const PREFERENCES_KEY = "2dnd_preferences";

interface BackdropDataset {
  readonly biome: string;
  readonly weather: string;
  readonly containers: number;
  readonly children: number;
  readonly weatherEmitters: number;
  readonly lightningTimers: number;
  readonly labels: number;
  readonly layers: Array<{
    readonly id: string;
    readonly depth: number;
    readonly bounds: {
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
    };
    readonly childCount: number;
  }>;
}

async function clickGame(page: Page, x: number, y: number): Promise<void> {
  const canvas = page.locator("#game-container canvas");
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Game canvas has no rendered bounds");
  await page.mouse.click(
    bounds.x + (x / GAME_WIDTH) * bounds.width,
    bounds.y + (y / GAME_HEIGHT) * bounds.height,
  );
}

async function holdKey(page: Page, key: string, duration = 180): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(duration);
  await page.keyboard.up(key);
  await page.waitForTimeout(100);
}

async function waitForState(page: Page, text: string): Promise<void> {
  await expect(page.locator("#debug-state")).toContainText(text);
}

async function submitDebug(page: Page, command: string): Promise<void> {
  const input = page.locator("#debug-cmd");
  await input.fill(command);
  await input.press("Enter");
  await input.blur();
}

async function drainCutscenes(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const state = await page.locator("#debug-state").textContent() ?? "";
    if (state.includes("BATTLE") || state.includes("OVERWORLD")) return;
    if (state.includes("CUTSCENE")) {
      await page.waitForTimeout(380);
      await holdKey(page, "Escape");
    } else {
      await page.waitForTimeout(120);
    }
  }
  throw new Error("Timed out draining backdrop cutscenes");
}

async function createCampaign(
  page: Page,
  highContrast: boolean,
  reducedMotion = true,
): Promise<void> {
  await page.addInitScript(({ key, contrast, reduceMotion }) => {
    let seed = contrast ? 0x5a17c0de : 0x2badcafe;
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x1_0000_0000;
    };
    localStorage.clear();
    localStorage.setItem(key, JSON.stringify({
      version: 1,
      audio: {
        masterVolume: 0,
        musicVolume: 0,
        sfxVolume: 0,
        dialogVolume: 0,
        muted: true,
      },
      accessibility: {
        reducedMotion: reduceMotion,
        textScale: 1,
        highContrast: contrast,
        advanceMode: "manual",
      },
    }));
  }, {
    key: PREFERENCES_KEY,
    contrast: highContrast,
    reduceMotion: reducedMotion,
  });
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
  await drainCutscenes(page);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const state = await page.locator("#debug-state").textContent() ?? "";
    if (!state.includes("[TUTORIAL]") && !state.includes("[MENU]")) break;
    await holdKey(page, "Escape");
  }
  const checkbox = page.locator("#debug-checkbox");
  if (!await checkbox.isChecked()) await checkbox.check();
  await expect(page.locator("#debug-panel")).toBeVisible();
}

async function enterBattleView(
  page: Page,
  encounter: string,
  biome: string,
  time: string,
  weather: string,
): Promise<void> {
  await submitDebug(
    page,
    `/battleview ${encounter} ${biome} ${time} ${weather}`,
  );
  await expect.poll(async () => {
    const state = await page.locator("#debug-state").textContent() ?? "";
    return state.includes("BATTLE") || state.includes("CUTSCENE");
  }).toBeTruthy();
  await drainCutscenes(page);
  await waitForState(page, "BATTLE");
}

async function readBackdrop(page: Page): Promise<BackdropDataset> {
  return page.locator("#game-container canvas").evaluate((canvas) => {
    const raw = (canvas as HTMLCanvasElement).dataset.battleBackdrop;
    if (!raw) throw new Error("Missing battle backdrop inspection dataset");
    return JSON.parse(raw) as BackdropDataset;
  });
}

async function finishBattle(page: Page): Promise<void> {
  await submitDebug(page, "/kill");
  await expect.poll(async () => {
    const state = await page.locator("#debug-state").textContent() ?? "";
    return state.includes("OVERWORLD") || state.includes("CUTSCENE");
  }, { timeout: 15_000 }).toBeTruthy();
  await drainCutscenes(page);
  await waitForState(page, "OVERWORLD");
  const cleanup = await page.locator("#game-container canvas").evaluate(
    (canvas) => JSON.parse(
      (canvas as HTMLCanvasElement).dataset.battleBackdropCleanup ?? "{}",
    ) as Record<string, number>,
  );
  expect(cleanup).toEqual({
    containers: 0,
    children: 0,
    weatherEmitters: 0,
    lightningTimers: 0,
    labels: 0,
  });
}

test("Battle backdrop layers remain ordered across environments and repeated battles", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  await createCampaign(page, false);
  await enterBattleView(
    page,
    "goblinRaidingParty",
    "forest",
    "day",
    "clear",
  );

  const initial = await readBackdrop(page);
  expect(initial.containers).toBe(10);
  expect(initial.weatherEmitters).toBe(0);
  expect(initial.lightningTimers).toBe(0);
  expect(initial.layers.map((layer) => layer.depth)).toEqual(
    [...initial.layers.map((layer) => layer.depth)].sort((a, b) => a - b),
  );
  expect(initial.layers.find((layer) => layer.id === "farSky")?.bounds)
    .toEqual({ x: 0, y: 0, width: GAME_WIDTH, height: GAME_HEIGHT });
  expect(initial.layers.find((layer) => layer.id === "actorShadows")?.childCount)
    .toBe(5);

  const canvas = page.locator("#game-container canvas");
  await expect(canvas).toHaveScreenshot("group-forest-day.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.01,
  });

  const matrix = [
    ["grass", "dawn", "rain"],
    ["forest", "day", "clear"],
    ["deep_forest", "dusk", "fog"],
    ["sand", "dusk", "sandstorm"],
    ["tundra", "night", "snow"],
    ["swamp", "dawn", "fog"],
    ["volcanic", "dusk", "storm"],
    ["canyon", "day", "clear"],
    ["dungeon", "night", "clear"],
    ["city", "dusk", "rain"],
    ["sea", "night", "storm"],
  ] as const;
  for (const [biome, time, weather] of matrix) {
    await submitDebug(page, `/backdrop set ${biome} ${time} ${weather}`);
    await expect.poll(async () => (await readBackdrop(page)).biome).toBe(biome);
    const inspection = await readBackdrop(page);
    expect(inspection.weather.toLowerCase()).toBe(weather);
    expect(inspection.weatherEmitters).toBe(0);
    expect(inspection.lightningTimers).toBe(0);
    expect(inspection.containers).toBe(10);
    if (biome === "city") {
      await expect(canvas).toHaveScreenshot("city-dusk-rain.png", {
        animations: "disabled",
        maxDiffPixelRatio: 0.01,
      });
    }
  }

  await submitDebug(page, "/backdrop set sand dusk sandstorm");
  await expect(canvas).toHaveScreenshot("sand-dusk-sandstorm.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.01,
  });
  await submitDebug(page, "/backdrop set sea night storm");
  await expect(canvas).toHaveScreenshot("sea-night-storm.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.01,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(canvas).toHaveScreenshot("sea-night-storm-mobile.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.01,
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await finishBattle(page);

  for (const [encounter, biome, time, weather] of [
    ["slime", "grass", "dawn", "rain"],
    ["troll", "forest", "dusk", "clear"],
    ["kraken", "sea", "night", "fog"],
  ] as const) {
    await submitDebug(page, "/heal");
    if (encounter === "kraken") {
      await submitDebug(page, "/level 20");
      await submitDebug(page, "/max_hp 500");
      await submitDebug(page, "/hp 500");
    }
    await enterBattleView(page, encounter, biome, time, weather);
    const inspection = await readBackdrop(page);
    expect(inspection.containers).toBe(10);
    expect(inspection.children).toBeGreaterThanOrEqual(12);
    if (encounter === "troll") {
      expect(inspection.biome).toBe("dungeon");
      await expect(canvas).toHaveScreenshot("boss-troll-cave.png", {
        animations: "disabled",
        maxDiffPixelRatio: 0.01,
      });
    }
    if (encounter === "kraken") {
      await expect(canvas).toHaveScreenshot("kraken-sea-fog.png", {
        animations: "disabled",
        maxDiffPixelRatio: 0.01,
      });
    }
    await finishBattle(page);
  }
  expect(browserErrors).toEqual([]);
});

test("Battle backdrop remains readable in high contrast on a portrait viewport", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  await createCampaign(page, true);
  await enterBattleView(page, "cryptLich", "dungeon", "night", "fog");
  await page.setViewportSize({ width: 430, height: 932 });
  const canvas = page.locator("#game-container canvas");
  await expect(canvas).toHaveAttribute("data-high-contrast", "true");
  await expect(canvas).toHaveAttribute("data-reduced-motion", "true");
  await expect(canvas).toHaveScreenshot("crypt-fog-high-contrast-mobile.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.01,
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await finishBattle(page);
  expect(browserErrors).toEqual([]);
});

test("Battle backdrop releases animated storm resources on return", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  await createCampaign(page, false, false);
  await enterBattleView(page, "slime", "grass", "day", "storm");
  const active = await readBackdrop(page);
  expect(active.weatherEmitters).toBe(1);
  expect(active.lightningTimers).toBe(1);
  await finishBattle(page);
  expect(browserErrors).toEqual([]);
});

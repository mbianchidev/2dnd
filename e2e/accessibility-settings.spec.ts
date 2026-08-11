import { expect, test, type Page } from "@playwright/test";

const GAME_WIDTH = 640;
const GAME_HEIGHT = 528;
const PREFERENCES_KEY = "2dnd_preferences";
const SAVE_KEY = "2dnd_save";

interface BrowserPreferences {
  audio: {
    masterVolume: number;
    muted: boolean;
  };
  accessibility: {
    textScale: number;
    highContrast: boolean;
    reducedMotion: boolean;
  };
}

interface LayoutReportItem {
  id: string;
  bounds: { x: number; y: number; width: number; height: number };
}

interface LayoutReport {
  overlapCount: number;
  clippingCount: number;
  groups: Record<string, { items: LayoutReportItem[] }>;
}

async function clickGame(
  page: Page,
  gameX: number,
  gameY: number,
): Promise<void> {
  const canvas = page.locator("#game-container canvas");
  await expect(canvas).toBeVisible();
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Game canvas has no rendered bounds");
  await page.mouse.click(
    bounds.x + (gameX / GAME_WIDTH) * bounds.width,
    bounds.y + (gameY / GAME_HEIGHT) * bounds.height,
  );
  await page.waitForTimeout(120);
}

async function readLayoutReport(page: Page): Promise<LayoutReport> {
  await expect(page.locator("#layout-report")).not.toHaveText("");
  return page.locator("#layout-report").evaluate((element) =>
    JSON.parse(element.textContent ?? "{}") as LayoutReport
  );
}

async function clickLayoutItem(page: Page, id: string): Promise<void> {
  await expect.poll(async () => {
    const report = await readLayoutReport(page);
    return Object.values(report.groups)
      .flatMap((group) => group.items)
      .some((item) => item.id === id);
  }).toBe(true);
  const report = await readLayoutReport(page);
  const item = Object.values(report.groups)
    .flatMap((group) => group.items)
    .find((candidate) => candidate.id === id);
  if (!item) throw new Error(`Missing layout item: ${id}`);
  await clickGame(
    page,
    item.bounds.x + item.bounds.width / 2,
    item.bounds.y + item.bounds.height / 2,
  );
}

async function expectCleanLayout(page: Page): Promise<void> {
  await expect.poll(async () => {
    const report = await readLayoutReport(page);
    return {
      overlaps: report.overlapCount,
      clipping: report.clippingCount,
    };
  }).toEqual({ overlaps: 0, clipping: 0 });
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

async function enableDebug(page: Page): Promise<void> {
  const checkbox = page.locator("#debug-checkbox");
  if (!await checkbox.isChecked()) await checkbox.check();
  await expect(page.locator("#debug-panel")).toBeVisible();
}

async function submitDebug(page: Page, command: string): Promise<void> {
  const input = page.locator("#debug-cmd");
  await input.fill(command);
  await input.press("Enter");
  await input.blur();
}

async function readPreferences(page: Page): Promise<BrowserPreferences> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) throw new Error(`Missing localStorage preferences: ${key}`);
    return JSON.parse(raw) as BrowserPreferences;
  }, PREFERENCES_KEY);
}

async function drainCutscenes(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const state = await page.locator("#debug-state").textContent() ?? "";
    if (state.includes("OVERWORLD")) return;
    if (state.includes("CUTSCENE")) {
      await holdKey(page, "Enter");
    } else {
      await page.waitForTimeout(100);
    }
  }
  throw new Error("Timed out draining opening cutscenes");
}

test("title and in-game accessibility settings share live preferences", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("accessibilitySettingsInitialized")) {
      localStorage.clear();
      sessionStorage.setItem("accessibilitySettingsInitialized", "true");
    }
  });
  await page.goto("./", { waitUntil: "networkidle" });
  await waitForState(page, "BOOT | Screen: title");

  await test.step("change title settings at the largest text scale", async () => {
    await clickGame(page, 320, 364);
    await expectCleanLayout(page);
    await clickGame(page, 194, 115);
    await clickLayoutItem(page, "settings-text-scale");
    await clickLayoutItem(page, "settings-text-scale");
    await clickLayoutItem(page, "settings-high-contrast");
    await clickLayoutItem(page, "settings-reduced-motion");
    await expectCleanLayout(page);
    await page.screenshot({
      path: test.info().outputPath("title-settings-150.png"),
    });

    const preferences = await readPreferences(page);
    expect(preferences.audio.masterVolume).toBeCloseTo(0.5, 1);
    expect(preferences.accessibility).toMatchObject({
      textScale: 1.5,
      highContrast: true,
      reducedMotion: true,
    });
    const canvas = page.locator("#game-container canvas");
    await expect(canvas).toHaveAttribute("data-text-scale", "1.5");
    await expect(canvas).toHaveAttribute("data-high-contrast", "true");
    await expect(canvas).toHaveAttribute("data-reduced-motion", "true");
    await expect(canvas).toHaveAttribute("data-master-volume", /0\.[45]/);
  });

  await test.step("create and enter a campaign with large text", async () => {
    await clickGame(page, 50, 50);
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
    await drainCutscenes(page);
    await waitForState(page, "[TUTORIAL]");
    await holdKey(page, "Escape");
    await expect(page.locator("#debug-state")).not.toContainText("[TUTORIAL]");
    await enableDebug(page);
    await submitDebug(page, "/spawn slime");
    await waitForState(page, "BATTLE");
    await expect(page.locator("#game-container canvas"))
      .toHaveAttribute("data-text-scale", "1.5");
    await submitDebug(page, "/kill");
    await waitForState(page, "OVERWORLD");
    await submitDebug(page, "/codex all");
    await holdKey(page, "c");
    await waitForState(page, "CODEX | Category: Monsters");
    await waitForState(page, "Texture: monster-slime-normal-idle");
    await clickGame(page, 320, 498);
    await waitForState(page, "OVERWORLD");
  });

  await test.step("change the same settings from the in-game menu", async () => {
    await holdKey(page, "Escape");
    await expectCleanLayout(page);
    await clickLayoutItem(page, "escape-menu-settings");
    await clickLayoutItem(page, "settings-text-scale");
    await clickLayoutItem(page, "settings-high-contrast");
    await clickLayoutItem(page, "settings-reduced-motion");
    await clickLayoutItem(page, "settings-mute");
    await expectCleanLayout(page);
    await page.screenshot({
      path: test.info().outputPath("ingame-settings-100.png"),
    });

    const preferences = await readPreferences(page);
    expect(preferences.audio.muted).toBe(true);
    expect(preferences.accessibility).toMatchObject({
      textScale: 1,
      highContrast: false,
      reducedMotion: false,
    });
    const canvas = page.locator("#game-container canvas");
    await expect(canvas).toHaveAttribute("data-text-scale", "1");
    await expect(canvas).toHaveAttribute("data-high-contrast", "false");
    await expect(canvas).toHaveAttribute("data-reduced-motion", "false");
    await expect(canvas).toHaveAttribute("data-audio-muted", "true");

    const save = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
    expect(save).not.toContain("highContrast");
    expect(save).not.toContain("reducedMotion");
    expect(save).not.toContain("masterVolume");
  });

  await page.reload({ waitUntil: "networkidle" });
  await waitForState(page, "BOOT | Screen: title");
  await expect(page.locator("#game-container canvas"))
    .toHaveAttribute("data-audio-muted", "true");
  expect(await readPreferences(page)).toMatchObject({
    audio: { muted: true },
    accessibility: {
      textScale: 1,
      highContrast: false,
      reducedMotion: false,
    },
  });
  expect(browserErrors).toEqual([]);
});

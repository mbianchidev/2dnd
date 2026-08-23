import { expect, test, type Page } from "@playwright/test";

const GAME_WIDTH = 640;
const GAME_HEIGHT = 528;

async function clickGame(
  page: Page,
  gameX: number,
  gameY: number,
): Promise<void> {
  const canvas = page.locator("#game-container canvas");
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Game canvas has no rendered bounds");
  await page.mouse.click(
    bounds.x + (gameX / GAME_WIDTH) * bounds.width,
    bounds.y + (gameY / GAME_HEIGHT) * bounds.height,
  );
  await page.waitForTimeout(100);
}

async function holdKey(
  page: Page,
  key: string,
  duration = 150,
): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(duration);
  await page.keyboard.up(key);
  await page.waitForTimeout(120);
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
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const state = await page.locator("#debug-state").textContent() ?? "";
    if (state.includes("OVERWORLD")) return;
    if (state.includes("CUTSCENE")) await holdKey(page, "Enter", 70);
    else await page.waitForTimeout(100);
  }
  throw new Error("Timed out draining cutscenes");
}

async function createCampaign(page: Page): Promise<void> {
  await page.goto("game.html", { waitUntil: "networkidle" });
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
  if ((await page.locator("#debug-state").textContent())?.includes("[TUTORIAL")) {
    for (let step = 0; step < 5; step += 1) await holdKey(page, "Space");
  }
  await waitForState(page, "OVERWORLD");
}

test("sails, enters Tidehaven, opens the world map, and reloads at sea", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript(() => {
    if (sessionStorage.getItem("nauticalInitialized")) return;
    sessionStorage.setItem("nauticalInitialized", "true");
    localStorage.clear();
    localStorage.setItem("2dnd_preferences", JSON.stringify({
      version: 2,
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
  });

  await createCampaign(page);
  await submitDebug(page, "/boat merchantSloop");
  await submitDebug(page, "/port tidehavenPort");
  await submitDebug(page, "/sail on");
  await waitForState(page, "[BOAT:merchantSloop]");

  await holdKey(page, "Space");
  await waitForState(page, "[CITY:tidehaven_city:0]");
  await holdKey(page, "m");
  await expect(page.locator("canvas")).toBeVisible();
  await holdKey(page, "m");

  await submitDebug(page, "/sail on");
  await holdKey(page, "d");
  await expect(page.locator("#debug-state")).toContainText(/BATTLE|OVERWORLD/);
  await page.setViewportSize({ width: 430, height: 932 });
  await page.reload({ waitUntil: "networkidle" });
  await waitForState(page, "BOOT | Screen: title");
  await clickGame(page, 320, 324);
  await expect(page.locator("#debug-state")).toContainText(/BATTLE|OVERWORLD/);
  const resumedState = await page.locator("#debug-state").textContent() ?? "";
  if (resumedState.includes("BATTLE")) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await submitDebug(page, "/kill");
    await waitForState(page, "[BOAT:merchantSloop]");
    await page.setViewportSize({ width: 430, height: 932 });
  }
  await waitForState(page, "[BOAT:merchantSloop]");

  expect(browserErrors).toEqual([]);
});

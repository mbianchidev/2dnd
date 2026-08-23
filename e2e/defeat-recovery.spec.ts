import { expect, test, type Page } from "@playwright/test";

const SAVE_KEY = "2dnd_save";
const GAME_WIDTH = 640;
const GAME_HEIGHT = 528;

interface BrowserSave {
  player: {
    gold: number;
    xp: number;
    hp: number;
    maxHp: number;
    activeEffects: unknown[];
    position: {
      x: number;
      y: number;
      chunkX: number;
      chunkY: number;
      inDungeon: boolean;
      inCity: boolean;
    };
  };
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

async function readSave(page: Page): Promise<BrowserSave> {
  return page.evaluate((saveKey) => {
    const raw = localStorage.getItem(saveKey);
    if (!raw) throw new Error(`Missing localStorage save: ${saveKey}`);
    return JSON.parse(raw) as BrowserSave;
  }, SAVE_KEY);
}

async function drainOpeningCutscenes(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const state = await page.locator("#debug-state").textContent() ?? "";
    if (state.includes("OVERWORLD")) return;
    if (state.includes("CUTSCENE")) {
      await page.waitForTimeout(420);
      await holdKey(page, "Escape");
    } else {
      await page.waitForTimeout(150);
    }
  }
  throw new Error("Timed out reaching Overworld after character creation");
}

async function startEncounter(page: Page, monsterId: string): Promise<void> {
  await submitDebug(page, `/spawn ${monsterId}`);
  await expect.poll(async () => {
    const state = await page.locator("#debug-state").textContent() ?? "";
    if (state.includes("BATTLE")) return "battle";
    if (state.includes("CUTSCENE")) return "cutscene";
    return "waiting";
  }).not.toBe("waiting");
  const state = await page.locator("#debug-state").textContent() ?? "";
  if (state.includes("CUTSCENE")) {
    await page.waitForTimeout(420);
    await holdKey(page, "Escape");
  }
  await waitForState(page, "BATTLE");
}

test("random and boss defeats recover cleanly through the result sequence", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  await page.addInitScript(() => {
    let seed = 0x57d0e2026;
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x1_0000_0000;
    };
    if (!sessionStorage.getItem("defeatRecoveryInitialized")) {
      localStorage.clear();
      sessionStorage.setItem("defeatRecoveryInitialized", "true");
    }
  });

  await page.goto("game.html", { waitUntil: "networkidle" });
  await waitForState(page, "BOOT | Screen: title");
  await clickGame(page, 320, 324);
  await waitForState(page, "BOOT | Screen: character");
  for (let index = 0; index < 12; index++) {
    await page.keyboard.press("Backspace");
  }
  for (const key of ["f", "a", "l", "l", "e", "n", "h", "e", "r", "o"]) {
    await page.keyboard.press(key);
  }
  await clickGame(page, 284, 160);
  await holdKey(page, "Enter");
  await waitForState(page, "BOOT | Screen: stats");
  await clickGame(page, 390, 64);
  await clickGame(page, 400, 460);
  await waitForState(page, "BOOT | Screen: appearance");
  await clickGame(page, 320, 112);
  await clickGame(page, 420, 312);
  await drainOpeningCutscenes(page);
  await page.waitForTimeout(300);
  if ((await page.locator("#debug-state").textContent())?.includes("[TUTORIAL")) {
    await holdKey(page, "Escape");
  }
  await enableDebug(page);
  await submitDebug(page, "/gather reset");

  await submitDebug(page, "/gold 101");
  await submitDebug(page, "/xp 50");
  await startEncounter(page, "slime");
  await submitDebug(page, "/defeat");
  await waitForState(page, "Phase: defeat");
  await waitForState(page, "DEFEAT | Intro | Random");
  await page.waitForTimeout(420);
  await holdKey(page, "Enter");
  await waitForState(
    page,
    "DEFEAT | Results | Random | Gold -31 | Recovery Willowdale",
  );
  const randomRecovery = await readSave(page);
  expect(randomRecovery.player.gold).toBe(70);
  expect(randomRecovery.player.xp).toBe(0);
  expect(randomRecovery.player.hp).toBe(
    Math.max(1, Math.floor(randomRecovery.player.maxHp / 2)),
  );
  expect(randomRecovery.player.activeEffects).toEqual([]);
  expect(randomRecovery.player.position).toMatchObject({
    x: 2,
    y: 2,
    chunkX: 4,
    chunkY: 2,
    inDungeon: false,
    inCity: false,
  });
  await page.waitForTimeout(420);
  await holdKey(page, "Enter");
  await waitForState(page, "OVERWORLD");

  await page.reload({ waitUntil: "networkidle" });
  await waitForState(page, "BOOT | Screen: title");
  await clickGame(page, 320, 324);
  await waitForState(page, "OVERWORLD");
  await enableDebug(page);
  expect((await readSave(page)).player.gold).toBe(70);

  await submitDebug(page, "/gold 100");
  await startEncounter(page, "troll");
  await submitDebug(page, "/defeat");
  await waitForState(page, "DEFEAT | Intro | Boss");
  await page.waitForTimeout(420);
  await holdKey(page, "Enter");
  await waitForState(
    page,
    "DEFEAT | Results | Boss | Gold -30 | Recovery Willowdale",
  );
  await page.waitForTimeout(420);
  await holdKey(page, "Enter");
  await waitForState(page, "OVERWORLD");
  expect((await readSave(page)).player.gold).toBe(70);
  expect(browserErrors).toEqual([]);
});

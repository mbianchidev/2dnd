import { expect, test, type Page } from "@playwright/test";

const GAME_WIDTH = 640;
const GAME_HEIGHT = 528;
const PREFERENCES_KEY = "2dnd_preferences";

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
  await page.waitForTimeout(80);
}

async function holdKey(
  page: Page,
  key: string,
  duration = 180,
): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(duration);
  await page.keyboard.up(key);
  await page.waitForTimeout(100);
}

async function waitForState(page: Page, text: string): Promise<void> {
  await expect(page.locator("#debug-state")).toContainText(text);
}

async function waitForPresentation(
  page: Page,
  text: string,
  timeout = 12_000,
): Promise<void> {
  await expect.poll(
    async () => page.locator("#debug-state").textContent(),
    { timeout },
  ).toContain(text);
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

async function drainCutscenes(page: Page, destination = "OVERWORLD"): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const state = await page.locator("#debug-state").textContent() ?? "";
    if (state.includes(destination)) return;
    if (state.includes("CUTSCENE")) {
      await page.waitForTimeout(380);
      await holdKey(page, "Escape");
    } else {
      await page.waitForTimeout(120);
    }
  }
  throw new Error(`Timed out draining cutscenes to ${destination}`);
}

async function createRangerCampaign(page: Page): Promise<void> {
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
  await page.waitForTimeout(320);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const state = await page.locator("#debug-state").textContent() ?? "";
    if (!state.includes("[TUTORIAL]") && !state.includes("[MENU]")) break;
    await holdKey(page, "Escape");
  }
  await enableDebug(page);
}

async function startEncounter(
  page: Page,
  monsterId: string,
): Promise<"battle" | "cutscene"> {
  await submitDebug(page, `/spawn ${monsterId}`);
  await expect.poll(async () => {
    const state = await page.locator("#debug-state").textContent() ?? "";
    if (state.includes("BATTLE")) return "battle";
    if (state.includes("CUTSCENE")) return "cutscene";
    return "waiting";
  }).not.toBe("waiting");
  const state = await page.locator("#debug-state").textContent() ?? "";
  return state.includes("CUTSCENE") ? "cutscene" : "battle";
}

async function finishBattle(page: Page, boss = false): Promise<void> {
  await submitDebug(page, "/kill");
  await waitForPresentation(page, ":faint");
  if (boss) {
    await expect.poll(async () => {
      const state = await page.locator("#debug-state").textContent() ?? "";
      return state.includes("CUTSCENE") || state.includes("OVERWORLD");
    }, { timeout: 12_000 }).toBeTruthy();
    await drainCutscenes(page);
  } else {
    await waitForState(page, "OVERWORLD");
  }
}

async function useBattleMenuAction(
  page: Page,
  buttonX: number,
  buttonY: number,
  menuY: number,
): Promise<void> {
  await waitForState(page, "Phase: playerTurn");
  await clickGame(page, buttonX, buttonY);
  await clickGame(page, 360, menuY);
  await holdKey(page, "Enter", 100);
}

async function moveUntilPresentation(
  page: Page,
  presentation: string,
): Promise<void> {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
  await clickGame(page, 100, 100);
  for (const key of ["D", "A", "S", "W"]) {
    await holdKey(page, key, 320);
    const state = await page.locator("#debug-state").textContent() ?? "";
    if (state.includes(presentation)) return;
    await page.evaluate(async (movementKey) => {
      const code = `Key${movementKey}`;
      window.dispatchEvent(new KeyboardEvent("keydown", {
        key: movementKey.toLowerCase(),
        code,
        bubbles: true,
      }));
      await new Promise((resolve) => window.setTimeout(resolve, 220));
      window.dispatchEvent(new KeyboardEvent("keyup", {
        key: movementKey.toLowerCase(),
        code,
        bubbles: true,
      }));
    }, key);
    const dispatchedState =
      await page.locator("#debug-state").textContent() ?? "";
    if (dispatchedState.includes(presentation)) return;
  }
  throw new Error(`No walkable adjacent tile produced ${presentation}`);
}

test("battle, world, mount, companion, boss, and cutscene presentation animate", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  await page.addInitScript(() => {
    let seed = 0x72_2026;
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x1_0000_0000;
    };
    if (!sessionStorage.getItem("animationPresentationInitialized")) {
      localStorage.clear();
      sessionStorage.setItem("animationPresentationInitialized", "true");
    }
  });

  await createRangerCampaign(page);
  await holdKey(page, "f");
  await waitForState(page, "[OFF]");
  await moveUntilPresentation(page, "overworld:hero:walk");
  await submitDebug(page, "/level 5");
  await submitDebug(page, "/companion recruit guardian");
  await submitDebug(page, "/companion mode guardian gambit");
  await waitForPresentation(page, "overworld:companion:guardian:walk");
  await submitDebug(page, "/mount horse");
  await waitForState(page, "[MOUNT:horse]");
  await waitForPresentation(page, "overworld:mount:horse:walk");

  await startEncounter(page, "orc");
  await waitForState(page, "Phase: playerTurn");
  await clickGame(page, 360, 435);
  await holdKey(page, "Enter", 100);
  await waitForPresentation(page, "party:hero:attack:attack");
  await waitForPresentation(page, "party:companion:guardian:");
  await waitForPresentation(page, ":enemy:orc:");
  await finishBattle(page);

  await startEncounter(page, "orc");
  await useBattleMenuAction(page, 510, 468, 250);
  await waitForPresentation(page, "party:hero:cast:spell");
  await finishBattle(page);

  await startEncounter(page, "orc");
  await useBattleMenuAction(page, 360, 468, 322);
  await waitForPresentation(page, "party:hero:ability:ability");
  await finishBattle(page);

  expect(await startEncounter(page, "troll")).toBe("cutscene");
  await waitForPresentation(page, "Anim: step-0:shake:boss");
  await waitForPresentation(page, ":troll:ability");
  await holdKey(page, "Escape");
  await waitForState(page, "BATTLE");
  await waitForState(page, "Phase: playerTurn");
  await clickGame(page, 360, 435);
  await holdKey(page, "Enter", 100);
  await waitForPresentation(page, ":enemy:troll:");
  await finishBattle(page, true);
  expect(browserErrors).toEqual([]);
});

test("reduced motion makes presentation immediate and readable", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  await page.addInitScript((preferencesKey) => {
    if (sessionStorage.getItem("reducedAnimationInitialized")) return;
    localStorage.clear();
    sessionStorage.setItem("reducedAnimationInitialized", "true");
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
        textScale: 1,
        highContrast: true,
        advanceMode: "manual",
      },
    }));
  }, PREFERENCES_KEY);

  await createRangerCampaign(page);
  await submitDebug(page, "/mount horse");
  await waitForPresentation(
    page,
    "overworld:mount:horse:walk:immediate",
  );
  await startEncounter(page, "slime");
  await waitForState(page, "Phase: playerTurn");
  await clickGame(page, 360, 435);
  await holdKey(page, "Enter", 100);
  await waitForPresentation(page, "party:hero:attack:attack:immediate");
  await submitDebug(page, "/kill");
  await waitForPresentation(page, ":faint:immediate");
  await expect(page.locator("#game-container canvas"))
    .toHaveAttribute("data-reduced-motion", "true");
  await expect(page.locator("#game-container canvas"))
    .toHaveAttribute("data-high-contrast", "true");
  expect(browserErrors).toEqual([]);
});

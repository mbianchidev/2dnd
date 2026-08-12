import { expect, test, type Page } from "@playwright/test";
import { getHeroCutsceneIds } from "../src/data/cutscenes";
import { clickLayoutItem } from "./helpers/layout";

const GAME_WIDTH = 640;
const GAME_HEIGHT = 528;

test.use({ hasTouch: true });

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

async function holdKey(page: Page, key: string, duration = 120): Promise<void> {
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
  if (await input.isVisible()) {
    await input.fill(command);
    await input.press("Enter");
    await input.blur();
  } else {
    await input.evaluate((element, value) => {
      const commandInput = element as HTMLInputElement;
      commandInput.value = value;
      commandInput.dispatchEvent(new Event("input", { bubbles: true }));
      commandInput.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        bubbles: true,
      }));
    }, command);
  }
}

async function drainOpening(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const state = await page.locator("#debug-state").textContent() ?? "";
    if (state.includes("OVERWORLD")) return;
    if (state.includes("CUTSCENE")) {
      await holdKey(page, "Escape");
    } else {
      await page.waitForTimeout(120);
    }
  }
  throw new Error("Timed out draining opening cutscenes");
}

async function createCampaign(page: Page): Promise<void> {
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
  await waitForState(page, "CUTSCENE | campaign.opening");
  await expect(page.locator("#debug-state")).toContainText(
    "Hero: actor=hero descriptor=ranger/",
  );
  await expect(page.locator("#debug-state")).toContainText(
    "texture=heroVisual.v1",
  );
  await drainOpening(page);
  if ((await page.locator("#debug-state").textContent())?.includes("[TUTORIAL")) {
    await holdKey(page, "Escape");
  }
  await waitForState(page, "OVERWORLD");
}

async function launchHeroCutscene(
  page: Page,
  cutsceneId: string,
  fixture: string,
  loadout: string,
): Promise<void> {
  await submitDebug(
    page,
    `/cutsceneview ${cutsceneId} ${fixture} ${loadout}`,
  );
  const scenePrefix = cutsceneId === "campaign.twelvefoldCovenant.epilogue"
    ? "ENDING"
    : `CUTSCENE | ${cutsceneId}`;
  await waitForState(page, scenePrefix);
  await expect(page.locator("#debug-state")).toContainText("Hero: actor=hero");
  await expect(page.locator("#debug-state")).toContainText(
    "texture=heroVisual.v1",
  );
}

async function exitHeroCutscene(page: Page, cutsceneId: string): Promise<void> {
  await holdKey(page, "Escape");
  if (cutsceneId === "campaign.twelvefoldCovenant.epilogue") {
    await waitForState(page, "ENDING | Choices");
    await holdKey(page, "Enter");
  }
  await waitForState(page, "OVERWORLD");
}

async function updateAccessibility(
  page: Page,
  controls: readonly string[],
): Promise<void> {
  await holdKey(page, "Escape");
  await clickLayoutItem(page, "escape-menu-settings");
  for (const control of controls) {
    await clickLayoutItem(page, control);
  }
  await holdKey(page, "Escape");
  await expect(page.locator("#debug-state")).not.toContainText("[MENU]");
}

test("every story path resolves the live hero visual and selected loadout", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  await page.addInitScript(() => {
    localStorage.clear();
    let seed = 0x2d0d;
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x1_0000_0000;
    };
  });
  await createCampaign(page);

  const fixtures = ["knightLight", "wizardDeep", "barbarianTan", "bardBlue"];
  const loadouts = ["unarmored", "plateShield", "robes", "dualWield", "lateGame"];
  for (const [index, cutsceneId] of getHeroCutsceneIds().entries()) {
    const fixture = fixtures[index % fixtures.length]!;
    const loadout = loadouts[index % loadouts.length]!;
    await launchHeroCutscene(page, cutsceneId, fixture, loadout);
    await exitHeroCutscene(page, cutsceneId);
  }

  expect(browserErrors).toEqual([]);
});

test("hero screenshots change with PlayerState-derived fixtures and remain accessible", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  await page.addInitScript(() => {
    localStorage.clear();
    let seed = 0x5150;
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x1_0000_0000;
    };
  });
  await createCampaign(page);

  const canvas = page.locator("#game-container canvas");
  await launchHeroCutscene(
    page,
    "campaign.opening",
    "knightLight",
    "unarmored",
  );
  const unarmored = await canvas.screenshot();
  await expect(page).toHaveScreenshot("cutscene-opening-knight-unarmored.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.03,
  });
  await exitHeroCutscene(page, "campaign.opening");

  await updateAccessibility(page, ["settings-text-scale"]);
  await expect(canvas).toHaveAttribute("data-text-scale", "1.25");
  await launchHeroCutscene(
    page,
    "campaign.opening",
    "wizardDeep",
    "robes",
  );
  const robed = await canvas.screenshot();
  expect(robed.equals(unarmored)).toBe(false);
  await exitHeroCutscene(page, "campaign.opening");

  await updateAccessibility(page, [
    "settings-text-scale",
    "settings-high-contrast",
    "settings-reduced-motion",
  ]);
  await expect(canvas).toHaveAttribute("data-text-scale", "1.5");
  await expect(canvas).toHaveAttribute("data-high-contrast", "true");
  await expect(canvas).toHaveAttribute("data-reduced-motion", "true");
  await page.setViewportSize({ width: 390, height: 844 });
  await launchHeroCutscene(
    page,
    "campaign.companion.guardian",
    "barbarianTan",
    "dualWield",
  );
  await expect(page).toHaveScreenshot("cutscene-recruitment-dual-mobile.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.03,
  });
  await page.locator('[data-action="confirm"]').tap();
  await waitForState(page, "OVERWORLD");

  await page.setViewportSize({ width: 844, height: 390 });
  await launchHeroCutscene(
    page,
    "boss.kraken.pre",
    "bardBlue",
    "lateGame",
  );
  await expect(page).toHaveScreenshot("cutscene-kraken-lategame-landscape.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.08,
  });
  await exitHeroCutscene(page, "boss.kraken.pre");

  expect(browserErrors).toEqual([]);
});

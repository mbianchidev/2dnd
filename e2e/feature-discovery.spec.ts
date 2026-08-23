import { expect, test, type Page } from "@playwright/test";

const SAVE_KEY = "2dnd_save";
const PREFERENCES_KEY = "2dnd_preferences";
const OPENING_CUTSCENE_IDS = [
  "campaign.opening",
  "campaign.stage.firstSeal",
] as const;
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
  await page.waitForTimeout(120);
}

async function holdKey(page: Page, key: string, duration = 140): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(duration);
  await page.keyboard.up(key);
  await page.waitForTimeout(120);
}

async function waitForState(page: Page, text: string): Promise<void> {
  await expect(page.locator("#debug-state")).toContainText(text);
}

async function createReadyCampaign(page: Page): Promise<void> {
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
  await waitForState(page, "CUTSCENE");
  await page.evaluate(({ saveKey, openingIds }) => {
    const raw = localStorage.getItem(saveKey);
    if (!raw) throw new Error("Missing new-character save");
    const save = JSON.parse(raw);
    save.player.progression.pendingCutsceneIds = [];
    save.player.progression.tutorial.completed = true;
    save.player.progression.seenCutsceneIds = [...openingIds];
    localStorage.setItem(saveKey, JSON.stringify(save));
  }, { saveKey: SAVE_KEY, openingIds: OPENING_CUTSCENE_IDS });
  await page.reload({ waitUntil: "networkidle" });
  await waitForState(page, "BOOT | Screen: title");
  await holdKey(page, "Space");
  await waitForState(page, "OVERWORLD");
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
  await page.locator("#game-container canvas").click();
  await page.waitForTimeout(160);
}

test.use({
  hasTouch: true,
  isMobile: true,
  viewport: { width: 430, height: 932 },
});

test("progressively grows menus, tabs, shortcuts, and touch actions", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("featureDiscoveryInitialized")) {
      localStorage.clear();
      sessionStorage.setItem("featureDiscoveryInitialized", "true");
    }
    let seed = 0x2d0d17;
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x1_0000_0000;
    };
  });

  await createReadyCampaign(page);
  await expect(page.locator('[data-action="openParty"]')).toBeHidden();
  await holdKey(page, "p");
  await expect(page.locator("#debug-state")).not.toContainText("[PARTY:");

  await holdKey(page, "Escape");
  await waitForState(
    page,
    "[MENU_ENTRIES:resume,inventory,questJournal,chronicle,codex,gathering,tips,save,settings,quit]",
  );
  await waitForState(page, "[MENU_SELECTION:resume]");
  await holdKey(page, "ArrowDown");
  await waitForState(page, "[MENU_SELECTION:inventory]");
  await holdKey(page, "Enter");
  await waitForState(page, "[PARTY:items");
  await holdKey(page, "Escape");

  for (const featureId of [
    "party",
    "partyGambits",
    "codex",
    "codexMonsters",
    "achievements",
    "crafting",
    "craftingEquipment",
    "gathering",
    "gatheringFishing",
    "worldEvents",
    "socialProfile",
    "mounts",
    "nauticalHarbors",
    "nauticalRoutes",
    "nauticalBoat",
  ]) {
    await submitDebug(page, `/feature reveal ${featureId}`);
  }

  await expect(page.locator('[data-action="openParty"]')).toBeVisible();
  await holdKey(page, "p");
  await waitForState(page, "[PARTY:status]");
  await holdKey(page, "4");
  await waitForState(page, "[PARTY:gambits]");
  await holdKey(page, "Escape");

  await holdKey(page, "Escape");
  await waitForState(
    page,
    "[MENU_ENTRIES:resume,inventory,party,questJournal,chronicle,codex,achievements,gathering,crafting,tips,save,settings,quit]",
  );
  await page.setViewportSize({ width: 932, height: 430 });
  await waitForState(page, "[MENU_ENTRIES:");
  await page.setViewportSize({ width: 430, height: 932 });
  await holdKey(page, "Escape");

  await page.evaluate((preferencesKey) => {
    const raw = localStorage.getItem(preferencesKey);
    const preferences = raw ? JSON.parse(raw) : {
      version: 2,
      audio: {
        masterVolume: 1,
        musicVolume: 0.6,
        sfxVolume: 0.4,
        dialogVolume: 0.5,
        muted: false,
      },
      accessibility: {
        textScale: 1,
        highContrast: false,
        reducedMotion: false,
        advanceMode: "manual",
      },
      controls: {
        touchControls: "auto",
        handedness: "right",
        promptSource: "auto",
      },
    };
    preferences.accessibility.textScale = 1.5;
    preferences.accessibility.reducedMotion = true;
    localStorage.setItem(preferencesKey, JSON.stringify(preferences));
  }, PREFERENCES_KEY);
  await page.reload({ waitUntil: "networkidle" });
  await waitForState(page, "BOOT | Screen: title");
  await holdKey(page, "Space");
  await waitForState(page, "OVERWORLD");
  await expect(page.locator("#game-container canvas"))
    .toHaveAttribute("data-text-scale", "1.5");
  await expect(page.locator("#game-container canvas"))
    .toHaveAttribute("data-reduced-motion", "true");
  await holdKey(page, "Escape");
  await waitForState(
    page,
    "[MENU_ENTRIES:resume,inventory,party,questJournal,chronicle,codex,achievements,gathering,crafting,tips,save,settings,quit]",
  );

  const discovery = await page.evaluate((saveKey) => {
    const save = JSON.parse(localStorage.getItem(saveKey)!);
    return {
      discovered: save.player.progression.discoveredFeatureIds,
      debug: save.player.progression.debugDiscoveredFeatureIds,
    };
  }, SAVE_KEY);
  expect(discovery.discovered).toContain("party");
  expect(discovery.debug).toContain("party");
  expect(browserErrors).toEqual([]);
});

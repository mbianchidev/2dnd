import { expect, test, type Page } from "@playwright/test";

const GAME_WIDTH = 640;
const GAME_HEIGHT = 528;
const SAVE_KEY = "2dnd_save";
const PREFERENCES_KEY = "2dnd_preferences";

interface BrowserSave {
  version: number;
  codex: {
    unlockedEntryIds: string[];
  };
  player: {
    inventory: Array<{ id: string }>;
    progression: {
      quests: {
        quests: Record<string, { status: string; stage: number }>;
      };
      worldEvents: {
        pending: {
          eventId: string;
          phase: string;
        } | null;
        log: Array<{
          eventId: string;
          choiceId: string;
          outcomeId: string;
          outcome: string;
          source: string;
        }>;
      };
      social: {
        alignment: { lawChaos: number; goodEvil: number };
        townReputation: Record<string, number>;
        factionReputation: Record<string, number>;
        appliedSourceIds: string[];
        history: Array<{ sourceId: string; cause: string; summary: string }>;
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
  await page.waitForTimeout(120);
}

async function holdKey(
  page: Page,
  key: string,
  duration = 160,
): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(duration);
  await page.keyboard.up(key);
  await page.waitForTimeout(120);
}

async function waitForState(page: Page, text: string): Promise<void> {
  await expect(page.locator("#debug-state")).toContainText(text);
}

async function activateMenuEntry(page: Page, action: string): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const state = await page.locator("#debug-state").textContent() ?? "";
    if (state.includes(`[MENU_SELECTION:${action}]`)) {
      await holdKey(page, "Enter");
      return;
    }
    await holdKey(page, "ArrowDown");
  }
  throw new Error(`Menu entry not found: ${action}`);
}

async function clickVisibleEventChoice(page: Page): Promise<void> {
  for (let y = 190; y <= 390; y += 16) {
    await clickGame(page, 320, y);
    const state = await page.locator("#debug-state").textContent() ?? "";
    if (!state.includes("[WORLD_EVENT:")) return;
  }
  throw new Error("Could not locate a visible World Event choice");
}

async function submitDebug(page: Page, command: string): Promise<void> {
  const checkbox = page.locator("#debug-checkbox");
  if (!await checkbox.isChecked()) await checkbox.check();
  const input = page.locator("#debug-cmd");
  await input.fill(command);
  await input.press("Enter");
  await input.blur();
  if (!command.startsWith("/event trigger")) {
    await page.locator("#game-container canvas").click();
  }
}

async function drainCutscenes(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const state = await page.locator("#debug-state").textContent() ?? "";
    if (state.includes("OVERWORLD")) return;
    if (state.includes("CUTSCENE")) await holdKey(page, "Enter", 80);
    else await page.waitForTimeout(120);
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
  await waitForState(page, "CUTSCENE");
  await drainCutscenes(page);
  if ((await page.locator("#debug-state").textContent())?.includes("[TUTORIAL")) {
    await holdKey(page, "Escape");
  }
  await waitForState(page, "OVERWORLD");
}

async function readSave(page: Page): Promise<BrowserSave> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) throw new Error("Missing campaign save");
    return JSON.parse(raw) as BrowserSave;
  }, SAVE_KEY);
}

test("resolves, recovers, battles, and records accessible World Events", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  await page.addInitScript((preferencesKey) => {
    if (!sessionStorage.getItem("worldEventsInitialized")) {
      localStorage.clear();
      sessionStorage.setItem("worldEventsInitialized", "true");
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
      }));
    }
    let seed = 0x6900;
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x1_0000_0000;
    };
  }, PREFERENCES_KEY);

  await createCampaign(page);
  expect((await readSave(page)).player.progression.social.alignment).toEqual({
    lawChaos: -50,
    goodEvil: 0,
  });
  await expect(page.locator("#game-container canvas"))
    .toHaveAttribute("data-text-scale", "1.5");
  await expect(page.locator("#game-container canvas"))
    .toHaveAttribute("data-reduced-motion", "true");

  await submitDebug(page, "/event trigger moonlitShrine");
  await waitForState(page, "[WORLD_EVENT:moonlitShrine]");
  await holdKey(page, "ArrowDown");
  await holdKey(page, "Enter");
  await expect(page.locator("#debug-state")).not.toContainText("[WORLD_EVENT:");
  let save = await readSave(page);
  expect(
    save.player.progression.worldEvents.log[
      save.player.progression.worldEvents.log.length - 1
    ]?.eventId,
  )
    .toBe("moonlitShrine");
  expect(save.codex.unlockedEntryIds).toContain("roadsideShrines");
  expect(save.player.progression.social.alignment.lawChaos).toBeGreaterThan(-50);

  await submitDebug(page, "/quest set main 1");
  expect(
    (await readSave(page)).player.progression.quests.quests.twelvefoldCovenant.stage,
  ).toBe(1);
  await submitDebug(page, "/event trigger woundedCourier");
  await waitForState(page, "[WORLD_EVENT:woundedCourier]");
  await holdKey(page, "Space");
  await expect(page.locator("#debug-state")).not.toContainText("[WORLD_EVENT:");
  save = await readSave(page);
  expect(
    save.player.progression.worldEvents.log[
      save.player.progression.worldEvents.log.length - 1
    ],
  ).toMatchObject({
    eventId: "woundedCourier",
    choiceId: "takeDispatch",
    outcomeId: "dispatchAccepted",
  });
  expect(save.player.progression.quests.quests.ironboundDispatch.status)
    .toBe("active");
  expect(save.player.inventory.some((item) => item.id === "sealedDispatch"))
    .toBe(true);

  const potionCount = save.player.inventory.filter((item) =>
    item.id === "potion"
  ).length;
  await submitDebug(page, "/event trigger abandonedSupplyCart");
  await waitForState(page, "[WORLD_EVENT:abandonedSupplyCart]");
  await holdKey(page, "Space");
  await expect(page.locator("#debug-state")).not.toContainText("[WORLD_EVENT:");
  save = await readSave(page);
  expect(save.player.inventory.filter((item) => item.id === "potion")).toHaveLength(
    potionCount + 1,
  );
  expect(save.player.progression.social.alignment.goodEvil).toBe(1);

  await submitDebug(page, "/event trigger weatheredRoadbook");
  await waitForState(page, "[WORLD_EVENT:weatheredRoadbook]");
  expect((await readSave(page)).player.progression.worldEvents.pending).toMatchObject({
    eventId: "weatheredRoadbook",
    phase: "choice",
  });
  await page.reload({ waitUntil: "networkidle" });
  await waitForState(page, "BOOT | Screen: title");
  await clickGame(page, 320, 324);
  await waitForState(page, "[WORLD_EVENT:weatheredRoadbook]");
  expect((await readSave(page)).player.inventory.filter((item) =>
    item.id === "potion"
  )).toHaveLength(potionCount + 1);
  await holdKey(page, "ArrowDown");
  await holdKey(page, "Enter");
  save = await readSave(page);
  expect(save.player.progression.worldEvents.pending).toBeNull();
  expect(save.player.progression.worldEvents.log.filter((entry) =>
    entry.eventId === "weatheredRoadbook"
  )).toHaveLength(1);

  await submitDebug(page, "/event trigger goblinRoadAmbush");
  await waitForState(page, "[WORLD_EVENT:goblinRoadAmbush]");
  await holdKey(page, "Enter");
  await waitForState(page, "BATTLE");
  await page.reload({ waitUntil: "networkidle" });
  await waitForState(page, "BOOT | Screen: title");
  await clickGame(page, 320, 324);
  await waitForState(page, "BATTLE");
  await submitDebug(page, "/kill");
  await waitForState(page, "OVERWORLD");
  save = await readSave(page);
  expect(save.player.progression.worldEvents.pending).toBeNull();
  expect(
    save.player.progression.worldEvents.log[
      save.player.progression.worldEvents.log.length - 1
    ],
  ).toMatchObject({
    eventId: "goblinRoadAmbush",
    outcomeId: "ambushDefeated",
  });
  expect(save.player.progression.social.factionReputation.roadwardens)
    .toBeGreaterThan(0);

  await submitDebug(page, "/alignment set goodEvil 30");
  await submitDebug(page, "/reputation set town willowdale_city 50");
  save = await readSave(page);
  expect(save.player.progression.social.alignment.goodEvil).toBe(30);
  expect(save.player.progression.social.townReputation.willowdale_city).toBe(50);
  const sourceCount = save.player.progression.social.appliedSourceIds.length;
  await page.reload({ waitUntil: "networkidle" });
  await waitForState(page, "BOOT | Screen: title");
  await clickGame(page, 320, 324);
  await waitForState(page, "OVERWORLD");
  expect((await readSave(page)).player.progression.social.appliedSourceIds)
    .toHaveLength(sourceCount);
  await holdKey(page, "Escape");
  await holdKey(page, "ArrowDown");
  await holdKey(page, "Enter");
  await waitForState(page, "[PARTY:items");
  await holdKey(page, "1");
  await waitForState(page, "[PARTY:social]");
  await holdKey(page, "Escape");

  await submitDebug(page, "/event trigger goblinRoadAmbush");
  await waitForState(page, "[WORLD_EVENT:goblinRoadAmbush]");
  await holdKey(page, "Space");
  await waitForState(page, "BATTLE");
  await submitDebug(page, "/defeat");
  await waitForState(page, "DEFEAT | Intro");
  await page.waitForTimeout(450);
  await holdKey(page, "Enter");
  await waitForState(page, "DEFEAT | Results");
  await page.waitForTimeout(450);
  await holdKey(page, "Enter");
  await waitForState(page, "OVERWORLD");
  save = await readSave(page);
  expect(save.player.progression.worldEvents.pending).toBeNull();
  expect(
    save.player.progression.worldEvents.log[
      save.player.progression.worldEvents.log.length - 1
    ],
  ).toMatchObject({
    eventId: "goblinRoadAmbush",
    outcomeId: "ambushOverwhelmed",
  });

  await holdKey(page, "Escape");
  await waitForState(page, "[MENU]");
  await activateMenuEntry(page, "chronicle");
  await waitForState(page, "[CHRONICLE]");
  for (let index = 0; index < 12; index++) {
    const state = await page.locator("#debug-state").textContent() ?? "";
    if (state.includes("[WORLD_EVENT_RECORD:")) break;
    await holdKey(page, "ArrowDown");
  }
  await expect(page.locator("#debug-state")).toContainText(
    "[WORLD_EVENT_RECORD:",
  );
  expect(browserErrors).toEqual([]);
});

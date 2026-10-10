import { expect, test, type Page } from "@playwright/test";
import { Terrain } from "../src/data/mapTypes";
import { TimePeriod } from "../src/systems/daynight";
import { WeatherType } from "../src/systems/weather";
import {
  clickLayoutItem,
  expectCleanLayout,
  tapLayoutItem,
} from "./helpers/layout";

const SAVE_KEY = "2dnd_save";
const PREFERENCES_KEY = "2dnd_preferences";

interface BrowserSave {
  version: number;
  timeStep: number;
  codex: { unlockedEntryIds: string[] };
  player: {
    hp: number;
    maxHp: number;
    activeEffects: Array<{ id: string; remainingTurns: number; source: string }>;
    position: {
      x: number; y: number; chunkX: number; chunkY: number;
      inCity: boolean; cityId: string; cityChunkIndex: number;
      inDungeon: boolean; dungeonId: string; dungeonLevel: number;
    };
    progression: {
      devotion: {
        deityId: string | null;
        score: number;
        affiliationChanges: number;
        appliedSourceIds: string[];
        visitedTempleIds: string[];
        history: Array<{ sourceId: string; delta: number; score: number }>;
      };
      social: {
        alignment: { lawChaos: number; goodEvil: number };
        townReputation: Record<string, number>;
      };
      quests: { quests: Record<string, { status: string; stage: number }> };
      worldEvents: {
        triggerCount: number;
        pending: {
          instanceId: string; eventId: string; phase: string;
          location: { chunkX: number; chunkY: number; x: number; y: number; areaName: string; terrain: number };
          timeStep: number; period: string; weather: string;
        } | null;
      };
    };
  };
}

async function readSave(page: Page): Promise<BrowserSave> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) throw new Error("Missing devotion campaign fixture");
    return JSON.parse(raw) as BrowserSave;
  }, SAVE_KEY);
}

async function holdKey(page: Page, key: string, duration = 140): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(duration);
  await page.keyboard.up(key);
  await page.waitForTimeout(120);
}

async function state(page: Page, value: string): Promise<void> {
  await expect(page.locator("#debug-state")).toContainText(value);
}

async function clickGame(page: Page, x: number, y: number): Promise<void> {
  const bounds = await page.locator("#game-container canvas").boundingBox();
  if (!bounds) throw new Error("Game canvas has no bounds");
  await page.mouse.click(bounds.x + x / 640 * bounds.width, bounds.y + y / 528 * bounds.height);
}

async function initialize(page: Page, textScale = 1.5): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.addInitScript(({ key, scale }) => {
    if (!sessionStorage.getItem("devotionFixtureInitialized")) {
      localStorage.clear();
      sessionStorage.setItem("devotionFixtureInitialized", "true");
      localStorage.setItem(key, JSON.stringify({
        version: 1,
        accessibility: { textScale: scale, reducedMotion: true, highContrast: true, advanceMode: "manual" },
      }));
    }
    let seed = 0x169;
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x1_0000_0000;
    };
  }, { key: PREFERENCES_KEY, scale: textScale });
  return errors;
}

async function drainCutscenes(page: Page, destination = "OVERWORLD"): Promise<void> {
  for (let index = 0; index < 70; index++) {
    const current = await page.locator("#debug-state").textContent() ?? "";
    if (current.includes(destination)) return;
    if (current.includes("CUTSCENE")) await holdKey(page, "Enter", 100);
    else await page.waitForTimeout(150);
  }
  throw new Error(`Cutscenes did not return to ${destination}`);
}

async function createCampaign(page: Page): Promise<void> {
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
  await drainCutscenes(page);
  await state(page, "[TUTORIAL]");
  await holdKey(page, "Escape");
  await expect(page.locator("#debug-state")).not.toContainText("[TUTORIAL]");
}

async function debug(page: Page, command: string): Promise<void> {
  if (!await page.locator("#debug-checkbox").isChecked()) await page.locator("#debug-checkbox").check();
  const input = page.locator("#debug-cmd");
  if (await input.isVisible()) {
    await input.fill(command);
    await input.press("Enter");
  } else {
    await input.evaluate((element, value) => {
      const commandInput = element as HTMLInputElement;
      commandInput.value = value;
      commandInput.dispatchEvent(new Event("input", { bubbles: true }));
      commandInput.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Enter", code: "Enter", bubbles: true,
      }));
    }, command);
  }
  await input.blur();
}

async function nearTemple(page: Page, temple = "willowdaleSpan"): Promise<void> {
  await debug(page, `/devotion near ${temple}`);
  await state(page, "OVERWORLD");
  await expect(page.locator("#debug-log")).toContainText(`Near `);
  await expect.poll(async () => {
    const report = JSON.parse(await page.locator("#layout-report").textContent() || "{}") as {
      groups?: Record<string, unknown>;
    };
    return Object.prototype.hasOwnProperty.call(report.groups ?? {}, "devotion-visit");
  }).toBe(true);
}

async function openTemple(page: Page): Promise<void> {
  await clickLayoutItem(page, "devotion-visit-prompt");
  await state(page, "[DEVOTION:");
  await expectCleanLayout(page);
}

async function selectFigure(page: Page, deityId: string): Promise<void> {
  await clickLayoutItem(page, "devotion-action-pantheon");
  for (let index = 0; index < 3; index++) {
    const current = await page.locator("#debug-state").textContent() ?? "";
    if (current.includes(`Figure:${deityId}`)) break;
    await clickLayoutItem(page, "devotion-action-next-figure");
  }
  await state(page, `Figure:${deityId}`);
}

async function initialAffiliation(page: Page, deityId: string): Promise<void> {
  await selectFigure(page, deityId);
  const before = (await readSave(page)).player.progression.devotion;
  await clickLayoutItem(page, "devotion-action-follow");
  await state(page, "View:confirmation");
  await expect(page.locator("#devotion-accessible-content")).toContainText("0 devotion");
  await clickLayoutItem(page, "devotion-action-cancel-affiliation");
  expect((await readSave(page)).player.progression.devotion).toEqual(before);
  await clickLayoutItem(page, "devotion-action-follow");
  await clickLayoutItem(page, "devotion-action-confirm-affiliation");
  await state(page, `Affiliation:${deityId}`);
  expect((await readSave(page)).player.progression.devotion.affiliationChanges).toBe(1);
}

async function continueCampaign(page: Page): Promise<void> {
  await page.reload({ waitUntil: "networkidle" });
  await state(page, "BOOT | Screen: title");
  await clickLayoutItem(page, "title-continue");
  await state(page, "OVERWORLD");
}

async function enterPrimaryCity(page: Page, name: string, id: string): Promise<void> {
  await debug(page, `/tp ${name}`);
  for (let attempt = 0; attempt < 5; attempt++) {
    await holdKey(page, "Space", 300);
    if ((await page.locator("#debug-state").textContent())?.includes(`[CITY:${id}:0]`)) return;
  }
  throw new Error(`Could not enter ${name}'s primary district`);
}

async function completeMakerDialogue(
  page: Page,
  npcId: string,
  finished: (save: BrowserSave) => boolean,
): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt++) {
    await drainCutscenes(page);
    if (finished(await readSave(page))) return;
    await debug(page, `/near ${npcId}`);
    await expect(page.locator("#debug-log")).toContainText(`Positioned beside ${npcId}`);
    for (let step = 0; step < 3; step++) {
      const current = await page.locator("#debug-state").textContent() ?? "";
      if (current.includes("CUTSCENE")) break;
      await holdKey(page, "Space");
    }
  }
  throw new Error(`Real maker dialogue at ${npcId} did not complete its canonical objective`);
}

test("keeps unaffiliated rites once-only through pre-Battle and post-victory reload", async ({ page }) => {
  const errors = await initialize(page);
  await createCampaign(page);
  const baseline = (await readSave(page)).player.progression.social;
  expect((await readSave(page)).player.progression.devotion.deityId).toBeNull();
  await nearTemple(page);
  expect((await readSave(page)).player.progression.devotion.visitedTempleIds).toEqual([]);
  await openTemple(page);
  let saved = await readSave(page);
  expect(saved.player.progression.devotion.visitedTempleIds).toEqual(["willowdaleSpan"]);
  expect(saved.codex.unlockedEntryIds).toContain("unfinishedConstellation");
  await clickLayoutItem(page, "devotion-action-rites");
  await clickLayoutItem(page, "devotion-action-rite-willowdaleSpanThread");
  saved = await readSave(page);
  expect(saved.player.activeEffects).toEqual([{
    id: "templeWard", remainingTurns: 3, source: "devotion:willowdaleSpanThread:openRoadThread",
  }]);
  expect(saved.player.progression.devotion.score).toBe(0);
  expect(saved.player.progression.social).toEqual(baseline);
  await expect(page.locator('[data-devotion-action="rite-willowdaleSpanThread"]')).toBeDisabled();
  await expectCleanLayout(page);
  await clickLayoutItem(page, "devotion-action-close");
  await continueCampaign(page);
  expect((await readSave(page)).player.activeEffects[0]?.remainingTurns).toBe(3);
  await openTemple(page);
  await clickLayoutItem(page, "devotion-action-rites");
  await expect(page.locator('[data-devotion-action="rite-willowdaleSpanThread"]')).toBeDisabled();
  await clickLayoutItem(page, "devotion-action-close");
  await debug(page, "/spawn slime");
  await state(page, "BATTLE");
  await debug(page, "/kill");
  await state(page, "Phase: victory");
  expect((await readSave(page)).player.activeEffects).toEqual([]);
  await drainCutscenes(page);
  await continueCampaign(page);
  expect((await readSave(page)).player.activeEffects).toEqual([]);
  await holdKey(page, "Escape");
  await clickLayoutItem(page, "escape-menu-devotion");
  await state(page, "View:profile");
  await expect(page.locator("#devotion-accessible-content")).toContainText("Affiliation: none");
  await expectCleanLayout(page);
  await clickLayoutItem(page, "devotion-action-close");
  expect(await page.locator("#devotion-accessibility").count()).toBe(0);
  expect(errors).toEqual([]);
});

for (const deityId of ["orivane", "selquor", "tessune"]) {
  test(`chooses ${deityId} explicitly and preserves separate causes on reload`, async ({ page }) => {
    const errors = await initialize(page);
    await createCampaign(page);
    await nearTemple(page);
    await openTemple(page);
    const socialBefore = (await readSave(page)).player.progression.social;
    await initialAffiliation(page, deityId);
    expect((await readSave(page)).player.progression.social).toEqual(socialBefore);
    await clickLayoutItem(page, "devotion-action-keeper");
    await clickLayoutItem(page, "devotion-action-choice-willowdaleSpanShare");
    const after = await readSave(page);
    expect(after.player.progression.devotion.score).toBe(4);
    expect(after.player.progression.social.alignment.goodEvil).toBe(socialBefore.alignment.goodEvil + 2);
    expect(after.player.progression.devotion.appliedSourceIds.filter((id) => id === "willowdaleSpanSharedWork")).toHaveLength(1);
    await expect(page.locator('[data-devotion-action="choice-willowdaleSpanShare"]')).toBeDisabled();
    await expectCleanLayout(page);
    await clickLayoutItem(page, "devotion-action-close");
    await continueCampaign(page);
    expect((await readSave(page)).player.progression.devotion).toEqual(after.player.progression.devotion);
    await openTemple(page);
    await clickLayoutItem(page, "devotion-action-history");
    await expect(page.locator("#devotion-accessible-content")).toContainText("+4");
    await expectCleanLayout(page);
    await clickLayoutItem(page, "devotion-action-close");
    await openTemple(page);
    await clickLayoutItem(page, "devotion-action-rites");
    await clickLayoutItem(page, "devotion-action-rite-willowdaleSpanThread");
    const beforeSwitch = await readSave(page);
    await clickLayoutItem(page, "devotion-action-back");
    const figures = ["orivane", "selquor", "tessune"];
    const nextFigure = figures[(figures.indexOf(deityId) + 1) % figures.length];
    await selectFigure(page, nextFigure);
    await clickLayoutItem(page, "devotion-action-follow");
    await expect(page.locator("#devotion-accessible-content")).toContainText(
      `lose ${beforeSwitch.player.progression.devotion.score} devotion`,
    );
    await expectCleanLayout(page);
    await clickLayoutItem(page, "devotion-action-confirm-affiliation");
    let changed = await readSave(page);
    expect(changed.player.progression.devotion.deityId).toBe(nextFigure);
    expect(changed.player.progression.devotion.score).toBe(0);
    expect(changed.player.activeEffects).toEqual([]);
    expect(changed.player.progression.devotion.appliedSourceIds)
      .toEqual(beforeSwitch.player.progression.devotion.appliedSourceIds);
    expect(changed.player.progression.social).toEqual(beforeSwitch.player.progression.social);
    await clickLayoutItem(page, "devotion-action-pantheon");
    await clickLayoutItem(page, "devotion-action-unaffiliate");
    await clickLayoutItem(page, "devotion-action-confirm-affiliation");
    changed = await readSave(page);
    expect(changed.player.progression.devotion.deityId).toBeNull();
    expect(changed.player.progression.devotion.score).toBe(0);
    expect(changed.player.progression.devotion.affiliationChanges).toBe(3);
    await clickLayoutItem(page, "devotion-action-close");
    await continueCampaign(page);
    expect((await readSave(page)).player.progression.devotion).toEqual(changed.player.progression.devotion);
    expect(errors).toEqual([]);
  });
}

test("resumes a natural event fixture and completes the real optional maker dialogue route", async ({ page }) => {
  const errors = await initialize(page, 1.25);
  await createCampaign(page);
  await nearTemple(page);
  await openTemple(page);
  await initialAffiliation(page, "selquor");
  await clickLayoutItem(page, "devotion-action-keeper");
  await clickLayoutItem(page, "devotion-action-choice-willowdaleSpanShare");
  await clickLayoutItem(page, "devotion-action-offer-quest");
  await expect(page.locator("#debug-state")).not.toContainText("[DEVOTION:");
  expect((await readSave(page)).player.progression.quests.quests.mendTheSpan.status).toBe("active");
  await enterPrimaryCity(page, "Willowdale", "willowdale_city");
  await completeMakerDialogue(page, "willowdaleArchivist", (save) =>
    save.player.progression.quests.quests.mendTheSpan.stage === 1);
  expect((await readSave(page)).player.progression.quests.quests.mendTheSpan.stage).toBe(1);
  await enterPrimaryCity(page, "Ironhold", "ironhold_city");
  await completeMakerDialogue(page, "ironholdWarden", (save) =>
    save.player.progression.quests.quests.mendTheSpan.status === "completed");
  let saved = await readSave(page);
  expect(saved.player.progression.quests.quests.mendTheSpan.status).toBe("completed");
  expect(saved.player.progression.devotion.appliedSourceIds).toContain("spanMended");
  const scoreBefore = saved.player.progression.devotion.score;
  const goodBefore = saved.player.progression.social.alignment.goodEvil;
  await page.evaluate(({ key, terrain, period, weather }) => {
    const raw = localStorage.getItem(key);
    if (!raw) throw new Error("Missing event fixture campaign");
    const campaign = JSON.parse(raw) as BrowserSave;
    const eventState = campaign.player.progression.worldEvents;
    eventState.triggerCount++;
    eventState.pending = {
      instanceId: `fallenEchoGlass:${eventState.triggerCount}`, eventId: "fallenEchoGlass", phase: "choice",
      location: { chunkX: 4, chunkY: 2, x: 3, y: 3, areaName: "Heartlands", terrain },
      timeStep: 90, period, weather,
    };
    campaign.timeStep = 90;
    Object.assign(campaign.player.position, {
      inCity: false, cityId: "", cityChunkIndex: 0, inDungeon: false, dungeonId: "", dungeonLevel: 0,
      chunkX: 4, chunkY: 2, x: 3, y: 3,
    });
    localStorage.setItem(key, JSON.stringify(campaign));
  }, { key: SAVE_KEY, terrain: Terrain.Grass, period: TimePeriod.Day, weather: WeatherType.Clear });
  await continueCampaign(page);
  await state(page, "[WORLD_EVENT:fallenEchoGlass]");
  await clickLayoutItem(page, "world-event-choice-claimEchoGlass");
  await expect(page.locator("#debug-state")).not.toContainText("[WORLD_EVENT:");
  saved = await readSave(page);
  expect(saved.player.progression.devotion.score).toBe(Math.max(0, scoreBefore - 12));
  expect(saved.player.progression.social.alignment.goodEvil).toBe(goodBefore - 3);
  expect(saved.player.progression.devotion.appliedSourceIds.filter((id) => id === "echoRecordTaken")).toHaveLength(1);
  const devotionAfter = saved.player.progression.devotion;
  await continueCampaign(page);
  expect((await readSave(page)).player.progression.devotion).toEqual(devotionAfter);
  expect(errors).toEqual([]);
});

test.describe("devotion touch and native focus", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 430, height: 932 } });
  for (const scale of [1, 1.25, 1.5]) {
    test(`keeps every temple page clean at ${scale * 100}% in both orientations`, async ({ page }) => {
      const errors = await initialize(page, scale);
      await createCampaign(page);
      await nearTemple(page);
      await tapLayoutItem(page, "devotion-visit-prompt");
      await state(page, "[DEVOTION:");
      await expectCleanLayout(page);
      await page.keyboard.press("Tab");
      await expect(page.locator("#devotion-accessibility button:focus")).toHaveCount(1);
      await tapLayoutItem(page, "devotion-action-pantheon");
      await state(page, "View:pantheon");
      await expectCleanLayout(page);
      await tapLayoutItem(page, "devotion-action-follow");
      await state(page, "View:confirmation");
      await expectCleanLayout(page);
      await page.locator('[data-action="cancel"]').tap();
      await state(page, "View:pantheon");
      expect((await readSave(page)).player.progression.devotion.deityId).toBeNull();
      await tapLayoutItem(page, "devotion-action-back");
      await tapLayoutItem(page, "devotion-action-rites");
      await expectCleanLayout(page);
      await page.setViewportSize({ width: 844, height: 390 });
      await expectCleanLayout(page);
      await tapLayoutItem(page, "devotion-action-back");
      await tapLayoutItem(page, "devotion-action-keeper");
      await expectCleanLayout(page);
      await tapLayoutItem(page, "devotion-action-back");
      await tapLayoutItem(page, "devotion-action-history");
      await expectCleanLayout(page);
      await tapLayoutItem(page, "devotion-action-close");
      await expect(page.locator("#devotion-accessibility")).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  }
});

test("uses only the standard semantic gamepad actions for temple navigation and confirmation", async ({ page }) => {
  const errors = await initialize(page);
  await page.addInitScript(() => {
    const pad = {
      id: "Synthetic standard fixture", index: 0, connected: true, mapping: "standard",
      timestamp: 0, axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
    };
    Object.defineProperty(navigator, "getGamepads", { configurable: true, value: () => [pad] });
    Object.defineProperty(window, "__devotionGamepadButton", {
      value: (index: number, pressed: boolean) => {
        pad.buttons[index] = { pressed, touched: pressed, value: pressed ? 1 : 0 };
        pad.timestamp++;
      },
    });
  });
  const press = async (index: number): Promise<void> => {
    for (const pressed of [true, false]) {
      await page.evaluate(({ button, down }) => {
        (window as typeof window & {
          __devotionGamepadButton(button: number, down: boolean): void;
        }).__devotionGamepadButton(button, down);
      }, { button: index, down: pressed });
      await page.waitForTimeout(180);
    }
  };
  await createCampaign(page);
  await nearTemple(page);
  await press(0);
  await state(page, "View:profile");
  await expect(page.locator("#game-container canvas")).toHaveAttribute("data-input-source", "gamepad");
  await press(0);
  await state(page, "View:pantheon");
  await press(13);
  await state(page, "Action:follow");
  await press(0);
  await state(page, "View:confirmation");
  await expectCleanLayout(page);
  await press(1);
  await state(page, "View:pantheon");
  expect((await readSave(page)).player.progression.devotion.deityId).toBeNull();
  await press(1);
  await expect(page.locator("#debug-state")).not.toContainText("[DEVOTION:");
  expect(await page.locator("#devotion-accessibility").count()).toBe(0);
  expect(errors).toEqual([]);
});

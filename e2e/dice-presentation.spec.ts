import { expect, test, type Page } from "@playwright/test";
import { createPlayer } from "../src/systems/player";
import { createCodex } from "../src/systems/codex";
import { createCurrentSaveData, type SaveData } from "../src/systems/save";
import { createWeatherState } from "../src/systems/weather";
import {
  normalizeGamePreferences,
  type TextScale,
} from "../src/systems/accessibility";
import {
  createTrapDicePresentation,
  formatDicePresentation,
} from "../src/systems/dicePresentation";
import {
  attemptTrapDetection,
  attemptTrapDisarm,
  generateDungeonTraps,
} from "../src/systems/traps";
import { DUNGEONS, getDungeonLevelMap, Terrain } from "../src/data/map";
import { getTrapDefinition } from "../src/data/traps";
import { getSpell } from "../src/data/spells";
import { formatSkillCheckResult } from "../src/systems/skillChecks";
import { clickLayoutItem, expectCleanLayout } from "./helpers/layout";

test.use({ hasTouch: true });

const SAVE_KEY = "2dnd_save";
const PREFERENCES_KEY = "2dnd_preferences";
const DIRECTIONS = {
  up: "ArrowUp", right: "ArrowRight", down: "ArrowDown", left: "ArrowLeft",
} as const;
const GAMEPAD_DIRECTIONS = { up: 12, right: 15, down: 13, left: 14 } as const;

interface SeedOptions {
  textScale?: TextScale;
  reducedMotion?: boolean;
  disabled?: boolean;
  dungeon?: boolean;
}

type DiceGamepadWindow = Window & {
  __dicePadButton?: (index: number, pressed: boolean) => void;
};

async function readSave(page: Page): Promise<SaveData> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) throw new Error("Missing dice-test campaign");
    return JSON.parse(raw) as SaveData;
  }, SAVE_KEY);
}

async function holdKey(page: Page, key: string, duration = 80): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(duration);
  await page.keyboard.up(key);
}

async function pressGamepad(page: Page, button: number): Promise<void> {
  await page.evaluate((index) => {
    const press = (window as DiceGamepadWindow).__dicePadButton;
    if (!press) throw new Error("Missing deterministic gamepad");
    press(index, true);
  }, button);
  await page.waitForTimeout(80);
  await page.evaluate((index) => {
    const press = (window as DiceGamepadWindow).__dicePadButton;
    if (!press) throw new Error("Missing deterministic gamepad");
    press(index, false);
  }, button);
  await page.waitForTimeout(60);
}

async function clickGame(page: Page, x: number, y: number): Promise<void> {
  const bounds = await page.locator("#game-container canvas").boundingBox();
  if (!bounds) throw new Error("Missing game canvas bounds");
  await page.mouse.click(
    bounds.x + x / 640 * bounds.width,
    bounds.y + y / 528 * bounds.height,
  );
}

async function debugCommand(page: Page, command: string): Promise<void> {
  const checkbox = page.locator("#debug-checkbox");
  if (!await checkbox.isChecked()) await checkbox.check();
  const input = page.locator("#debug-cmd");
  await input.fill(command);
  await input.press("Enter");
  await input.blur();
}

async function seedCampaign(page: Page, options: SeedOptions = {}) {
  const player = createPlayer("Dice Tester", {
    strength: 14, dexterity: 18, constitution: 8,
    intelligence: 18, wisdom: 14, charisma: 12,
  }, "wizard");
  player.level = 5;
  player.hp = player.maxHp = 500;
  player.mp = player.maxMp = 100;
  player.knownSpells = ["magicMissile", "fireBolt"];
  player.progression.tutorial.completed = true;
  player.progression.seenCutsceneIds = ["campaign.opening"];
  player.progression.gathering.seed = 24680;
  player.progression.trapSeed = 24680;
  player.progression.trapGuidance = true;
  player.activeEffects = options.dungeon ? [] : [{
    id: "poison", remainingTurns: 4, source: "Test effect",
  }];
  let trapEvidence: {
    id: string;
    detection: string;
    disarm: string;
  } | undefined;
  if (options.dungeon) {
    const dungeon = DUNGEONS[0]!;
    const map = getDungeonLevelMap(dungeon, 0);
    const traps = generateDungeonTraps(dungeon, 0, player.progression.trapSeed);
    for (const trap of traps) {
      const approach = [
        { x: trap.x - 1, y: trap.y }, { x: trap.x + 1, y: trap.y },
        { x: trap.x, y: trap.y - 1 }, { x: trap.x, y: trap.y + 1 },
      ].find((point) => map[point.y]?.[point.x] === Terrain.DungeonFloor
        && traps.filter((other) =>
          Math.abs(other.x - point.x) + Math.abs(other.y - point.y) <= 1
        ).length === 1);
      if (!approach) continue;
      const resolvedPlayer = structuredClone(player);
      const detection = attemptTrapDetection(resolvedPlayer, trap, 11);
      const disarm = attemptTrapDisarm(resolvedPlayer, trap, 11);
      if (!detection.success || !disarm.success) continue;
      const name = getTrapDefinition(trap.type).name;
      trapEvidence = {
        id: trap.id,
        detection: formatDicePresentation(createTrapDicePresentation(detection, name, true)!),
        disarm: formatDicePresentation(createTrapDicePresentation(disarm, name, false)!),
      };
      Object.assign(player.position, {
        inDungeon: true, dungeonId: dungeon.id, dungeonLevel: 0,
        inCity: false, ...approach,
      });
      break;
    }
    if (!trapEvidence) throw new Error("No deterministic single-trap approach");
  }
  const save = createCurrentSaveData(
    player, new Set(), createCodex(), player.appearanceId, 90, createWeatherState(),
  );
  const preferences = normalizeGamePreferences({
    audio: { muted: true },
    accessibility: {
      textScale: options.textScale ?? 1,
      reducedMotion: options.reducedMotion ?? false,
      highContrast: options.textScale === 1.5,
    },
    controls: { touchControls: "on" },
    dice: { frequency: options.disabled ? "off" : "all", speed: "normal" },
  });
  await page.addInitScript(({ campaign, preferences }) => {
    if (!sessionStorage.getItem("diceInitialized")) {
      sessionStorage.setItem("diceInitialized", "true");
      localStorage.clear();
      localStorage.setItem("2dnd_save", campaign);
      localStorage.setItem("2dnd_preferences", JSON.stringify(preferences));
    }
    Math.random = () => 0.5;
    const buttons = Array.from({ length: 17 }, () => ({
      pressed: false, touched: false, value: 0,
    }));
    const pad = {
      id: "Dice Test Gamepad", index: 0, connected: true, mapping: "standard",
      timestamp: 0, buttons, axes: [0, 0, 0, 0],
    };
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true, value: () => [pad],
    });
    Object.defineProperty(window, "__dicePadButton", {
      value: (index: number, pressed: boolean) => {
        buttons[index] = { pressed, touched: pressed, value: pressed ? 1 : 0 };
        pad.timestamp += 1;
      },
    });
  }, { campaign: JSON.stringify(save), preferences });
  await page.goto("game.html", { waitUntil: "networkidle" });
  await expect(page.locator("#debug-state")).toContainText("BOOT | Screen: title");
  return trapEvidence;
}

async function continueCampaign(page: Page): Promise<void> {
  await clickLayoutItem(page, "title-continue");
  await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

for (const textScale of [1, 1.25, 1.5] as const) {
  test(`battle receipts and skip controls remain truthful at ${textScale * 100}% text`, async ({ page }) => {
    const errors = collectErrors(page);
    await seedCampaign(page, { textScale });
    await continueCampaign(page);
    await debugCommand(page, "/spawn orc");
    await expect(page.locator("#debug-state")).toContainText("Phase: playerTurn");
    const log = page.locator("#dice-log");
    await expect(log.locator('[data-category="initiative"]')).toHaveCount(2);
    const enemyInitiative = await log.locator('[data-category="initiative"]')
      .filter({ hasText: "Orc" }).textContent();
    expect(enemyInitiative).toContain("d20 11");
    expect(enemyInitiative).not.toMatch(/=[ ]?\d|\+\d/);
    await expect(log.locator('[data-category="save"]')).toContainText("d20 11");

    if (textScale === 1) {
      await holdKey(page, "Enter");
      await holdKey(page, "Enter");
    } else if (textScale === 1.25) {
      await pressGamepad(page, 0);
      await pressGamepad(page, 0);
    } else {
      await page.locator('#touch-controls [data-action="confirm"]').tap();
      await page.locator('#touch-controls [data-action="confirm"]').tap();
    }
    const attack = log.locator('[data-category="attack"]').filter({ hasText: "Dice Tester attack" });
    await expect(attack).toContainText("Disadvantage: d20 [11 selected, 11] -> 11");
    expect(await attack.textContent()).not.toContain("vs AC");
    expect(await page.locator("#dice-presentation .resolved-die").evaluateAll(
      (dice) => dice.map((die) => (die as HTMLElement).dataset.natural),
    )).toEqual(["11", "11"]);
    if (textScale === 1) await holdKey(page, "z", 30);
    else if (textScale === 1.25) await pressGamepad(page, 10);
    else await page.locator("#dice-fast-forward").tap();
    await expect(page.locator("#dice-presentation")).toHaveAttribute("data-skipped", "true");
    await expect(page.locator("#dice-presentation")).toHaveAttribute("data-phase", "ready");
    await expect(attack).toHaveCount(1);

    await page.locator("#dice-history summary").click();
    await expect(attack).toBeVisible();
    await page.locator("#dice-history summary").press("Escape");
    await expect(page.locator("#debug-state")).toContainText("Phase: playerTurn");
    const hasAbilities = ((await readSave(page)).player.knownAbilities?.length ?? 0) > 0;
    await clickGame(page, hasAbilities ? 510 : 360, 468);
    await clickGame(page, 360, 325);
    await holdKey(page, "Enter");
    const missile = log.locator('[data-category="attack"]').filter({ hasText: "Magic Missile" });
    await expect(missile).toContainText("Auto-hit (no attack roll)");
    expect(await missile.textContent()).not.toMatch(/d20|Disadvantage|\bAC\b/);
    await expect(page.locator("#dice-presentation .resolved-die")).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath(`dice-battle-${textScale}.png`) });
    await debugCommand(page, "/kill");
    await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
    await expect(log).toContainText("Magic Missile");
    await expect(page.locator("#dice-presentation")).toHaveAttribute("data-phase", "ready");
    const save = await readSave(page);
    expect(save.version).toBe(18);
    expect(save.player.mp).toBe(100 - getSpell("magicMissile")!.mpCost);
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator("#debug-state")).toContainText("BOOT | Screen: title");
    await expect(page.locator("#dice-presentation")).toBeHidden();
    expect(errors).toEqual([]);
  });
}

test("preferences, disabled results and non-combat checks survive reload without campaign coupling", async ({ page }) => {
  const errors = collectErrors(page);
  await seedCampaign(page, { textScale: 1.5, reducedMotion: true });
  const before = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
  await clickLayoutItem(page, "title-settings");
  await expectCleanLayout(page);
  await holdKey(page, "[");
  await holdKey(page, "[");
  await holdKey(page, "]");
  await holdKey(page, "]");
  await expectCleanLayout(page);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).dice, PREFERENCES_KEY))
    .toEqual({ frequency: "off", speed: "instant" });
  expect(await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY)).toBe(before);
  await holdKey(page, "Escape");
  await continueCampaign(page);
  await debugCommand(page, "/event trigger moonlitShrine");
  await expect(page.locator("#debug-state")).toContainText("[WORLD_EVENT:moonlitShrine]");
  await clickLayoutItem(page, "world-event-choice-studyRunes");
  await expect(page.locator("#debug-state")).not.toContainText("[WORLD_EVENT:");
  const save = await readSave(page);
  const check = Object.entries(save.player.progression.skillChecks)
    .find(([id]) => id.startsWith("worldEvent:"))?.[1];
  if (!check) throw new Error("No authoritative World Event check was persisted");
  await expect(page.locator("#dice-log")).toContainText(formatSkillCheckResult(check));
  await expect(page.locator("#dice-presentation")).toHaveAttribute("data-phase", "ready");
  await expect(page.locator("#dice-presentation svg")).toHaveCount(0);
  await page.reload({ waitUntil: "networkidle" });
  await continueCampaign(page);
  expect((await readSave(page)).player.progression.skillChecks).toEqual(save.player.progression.skillChecks);
  await expect(page.locator("#game-container canvas")).toHaveAttribute("data-dice-frequency", "off");
  await expect(page.locator("#dice-presentation")).toBeHidden();
  expect(errors).toEqual([]);
});

test("real trap detection and disarm use the exact canonical checks and never reroll on load", async ({ page }) => {
  const errors = collectErrors(page);
  const evidence = await seedCampaign(page, { dungeon: true, textScale: 1.25 });
  if (!evidence) throw new Error("Missing trap fixture evidence");
  await continueCampaign(page);
  await expect(page.locator("#dice-log")).toContainText(evidence.detection);
  await holdKey(page, "Space");
  await expect(page.locator("#dice-log")).toContainText(evidence.disarm);
  await page.locator("#dice-fast-forward").click();
  await expect(page.locator("#dice-presentation")).toHaveAttribute("data-skipped", "true");
  const saved = await readSave(page);
  expect(saved.player.progression.trapStates[evidence.id]).toBe("disarmed");
  const xp = saved.player.xp;
  await page.reload({ waitUntil: "networkidle" });
  await continueCampaign(page);
  await expect(page.locator("#dice-presentation")).toBeHidden();
  expect((await readSave(page)).player.xp).toBe(xp);
  expect((await readSave(page)).player.progression.trapStates[evidence.id]).toBe("disarmed");
  expect(errors).toEqual([]);
});

test("a real flee check hands off once with readable immediate results and unchanged resources", async ({ page }) => {
  const errors = collectErrors(page);
  await seedCampaign(page, { reducedMotion: true });
  await continueCampaign(page);
  const before = await readSave(page);
  await debugCommand(page, "/spawn orc");
  await expect(page.locator("#debug-state")).toContainText("Phase: playerTurn");
  const hasAbilities = (before.player.knownAbilities?.length ?? 0) > 0;
  await clickGame(page, hasAbilities ? 510 : 360, 501);
  await expect(page.locator("#dice-log [data-category='flee']")).toContainText("d20 11 +4 = 15 vs DC 10");
  await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
  await expect(page.locator("#dice-log [data-category='flee']")).toHaveCount(1);
  await expect(page.locator("#dice-presentation")).toHaveAttribute("data-phase", "ready");
  const after = await readSave(page);
  expect(after.player.mp).toBe(before.player.mp);
  expect(after.player.gold).toBe(before.player.gold);
  expect(after.player.xp).toBe(before.player.xp);
  expect(errors).toEqual([]);
});

test("real gathering controls show canonical scores without fabricated d20s and retain transition feedback", async ({ page }) => {
  const errors = collectErrors(page);
  await seedCampaign(page, { textScale: 1.5, reducedMotion: true });
  await continueCampaign(page);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const discipline of ["fishing", "mining", "foraging"] as const) {
    await debugCommand(page, `/gather near ${discipline}`);
    await holdKey(page, "Space");
    await expect(page.locator("#debug-state")).toContainText(`[GATHERING:${discipline}]`);
    let pending = (await readSave(page)).player.progression.gathering.pending;
    if (!pending) throw new Error("No pending gathering pattern");
    const instanceId = pending.instanceId;
    if (discipline === "fishing") {
      await page.reload({ waitUntil: "networkidle" });
      await continueCampaign(page);
      expect((await readSave(page)).player.progression.gathering.pending?.instanceId).toBe(instanceId);
    }
    if (pending.game.kind === "fishing") {
      for (let tick = 0; tick < pending.game.biteAt; tick += 1) {
        await page.locator('#touch-controls [data-action="confirm"]').tap();
        await page.waitForTimeout(90);
      }
      await page.locator('#touch-controls [data-action="confirm"]').tap();
      for (const direction of pending.game.tensionPattern) {
        await pressGamepad(page, GAMEPAD_DIRECTIONS[direction]);
      }
    } else if (pending.game.kind === "mining") {
      for (const direction of pending.game.pattern) {
        await holdKey(page, DIRECTIONS[direction]);
        await holdKey(page, "Enter");
      }
    } else {
      for (let clue = 0; clue < pending.game.pattern.length; clue += 1) {
        await holdKey(page, "Enter");
      }
      for (const direction of pending.game.pattern) {
        await pressGamepad(page, GAMEPAD_DIRECTIONS[direction]);
      }
    }
    await expect(page.locator("#debug-state")).not.toContainText(`[GATHERING:${discipline}]`);
    const entry = page.locator('#dice-log [data-category="gathering"]')
      .filter({ hasText: discipline.charAt(0).toUpperCase() + discipline.slice(1) }).last();
    await expect(entry).toContainText("Score 100; required 50");
    await expect(entry).toContainText("(no d20 roll)");
    if ((await page.locator("#debug-state").textContent())?.includes("BATTLE")) {
      await debugCommand(page, "/kill");
      await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
      await expect(entry).toContainText("Score 100");
    }
    pending = (await readSave(page)).player.progression.gathering.pending;
    expect(pending).toBeNull();
    const bounds = await page.locator("#dice-presentation").boundingBox();
    if (!bounds) throw new Error("No visible gathering result");
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  }
  await page.setViewportSize({ width: 932, height: 430 });
  await page.locator("#dice-history summary").click();
  await expect(page.locator("#dice-log")).toBeVisible();
  expect((await readSave(page)).player.progression.gathering.stats.mining.successes).toBe(1);
  expect(errors).toEqual([]);
});

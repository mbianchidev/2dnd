import { expect, test, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { createPlayer } from "../src/systems/player";
import { createCodex } from "../src/systems/codex";
import { createCurrentSaveData, normalizeSaveData, SAVE_VERSION, type SaveData } from "../src/systems/save";
import { createHeroClassProgression } from "../src/systems/classProgression";
import { createWeatherState } from "../src/systems/weather";
import {
  normalizeGamePreferences,
  type TextScale,
} from "../src/systems/accessibility";
import {
  createTrapDicePresentation,
  createD20Presentation,
  createCombatDicePresentation,
  createEffectDicePresentation,
  formatDicePresentation,
  type CombatDiceReceipt,
} from "../src/systems/dicePresentation";
import type { ResolvedD20Roll, ResolvedEffectRoll } from "../src/systems/rollResults";
import type { StatusDamageRollResult, StatusSavingThrowResult } from "../src/systems/statusEffects";
import type { TrapCheckResult, TrapTriggerResult } from "../src/systems/traps";
import { getMonsterGroupTemplate } from "../src/data/monsterGroups";
import { getMonster } from "../src/data/monsters";
import {
  attemptTrapDetection,
  attemptTrapDisarm,
  generateDungeonTraps,
} from "../src/systems/traps";
import { DUNGEONS, getDungeonLevelMap, Terrain } from "../src/data/map";
import { getTrapDefinition, type TrapType } from "../src/data/traps";
import { getSpell } from "../src/data/spells";
import { getItem } from "../src/data/items";
import { formatSkillCheckResult } from "../src/systems/skillChecks";
import { clickLayoutItem, expectCleanLayout } from "./helpers/layout";
import type { ConsoleMessage } from "@playwright/test";

test.use({
  hasTouch: true,
  video: process.env.DICE_CAPTURE_MOTION === "1"
    ? { mode: "on", size: { width: 1440, height: 900 } }
    : "off",
});

const SAVE_KEY = "2dnd_save";
const PREFERENCES_KEY = "2dnd_preferences";
const DIRECTIONS = {
  up: "ArrowUp", right: "ArrowRight", down: "ArrowDown", left: "ArrowLeft",
} as const;
const GAMEPAD_DIRECTIONS = { up: 12, right: 15, down: 13, left: 14 } as const;
const diceCaptureCleanups = new WeakMap<Page, () => Promise<void>>();

async function closeDiceCapture(page: Page): Promise<void> {
  const cleanup = diceCaptureCleanups.get(page);
  if (!cleanup) return;
  diceCaptureCleanups.delete(page);
  await cleanup();
}

test.afterEach(async ({ page }) => closeDiceCapture(page));

interface SeedOptions {
  textScale?: TextScale;
  reducedMotion?: boolean;
  disabled?: boolean;
  dungeon?: boolean;
  flee?: boolean;
  healing?: boolean;
  area?: boolean;
  trapTrigger?: boolean;
  instant?: boolean;
  hp?: number;
  attackNaturals?: readonly number[];
}

interface DiceDebugPacket {
  kind: string;
  actorId?: string;
  targetId?: string;
  actionId?: string;
  trapId?: string;
  rollResult?: ResolvedD20Roll;
  attack?: CombatDiceReceipt;
  save?: StatusSavingThrowResult;
  flee?: { rollResult: ResolvedD20Roll; dc: number; success: boolean };
  trap?: TrapCheckResult;
  damage?: StatusDamageRollResult | TrapTriggerResult;
  appliedDamage?: number;
  healing?: { healing?: number; healingRoll?: ResolvedEffectRoll };
}

interface DisplayedDiceSnapshot {
  text: string;
  faces: { sides: string | undefined; natural: string | undefined }[];
  hidden: boolean;
  rollingFaces: { sides: string | undefined; natural: string | undefined }[];
  phase: string | undefined;
  motionCount: number;
}

function captureDice(page: Page): {
  packets: DiceDebugPacket[];
  find(kind: string, actorId?: string, from?: number): Promise<DiceDebugPacket>;
} {
  const packets: DiceDebugPacket[] = [];
  const pending: Promise<void>[] = [];
  const failures: unknown[] = [];
  const capture = (message: ConsoleMessage): void => {
    if (!message.text().startsWith("[DEBUG] [dice] receipt")) return;
    const argument = message.args()[2];
    if (!argument) {
      failures.push(new Error("Missing canonical dice diagnostic"));
      return;
    }
    const task = argument.jsonValue().then((value: unknown) => {
      if (typeof value !== "object" || value === null || !("kind" in value)
        || typeof value.kind !== "string") {
        throw new Error("Invalid canonical dice diagnostic");
      }
      packets.push(value as DiceDebugPacket);
    }).catch((error: unknown) => {
      failures.push(error);
    });
    pending.push(task);
  };
  page.on("console", capture);
  diceCaptureCleanups.set(page, async () => {
    page.off("console", capture);
    await Promise.all(pending);
    if (failures.length > 0) throw failures[0];
  });
  return {
    packets,
    find: async (kind, actorId, from = 0) => {
      await expect.poll(() => packets.slice(from).some((packet) =>
        packet.kind === kind && (actorId === undefined || packet.actorId === actorId)
      )).toBe(true);
      return packets.slice(from).find((packet) =>
        packet.kind === kind && (actorId === undefined || packet.actorId === actorId)
      )!;
    },
  };
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
  if (!await input.isVisible()) {
    await page.evaluate((value) => {
      const field = document.getElementById("debug-cmd");
      if (!(field instanceof HTMLInputElement)) {
        throw new Error("Missing local debug setup input");
      }
      field.value = value;
      field.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Enter", code: "Enter", bubbles: true,
      }));
      field.blur();
    }, command);
  } else {
    await input.fill(command);
    await input.press("Enter");
    await input.blur();
  }
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}

async function seedCampaign(page: Page, options: SeedOptions = {}) {
  const player = createPlayer("Dice Tester", {
    strength: 14, dexterity: options.dungeon || options.flee ? 30 : 18, constitution: 8,
    intelligence: options.dungeon ? 28 : 18, wisdom: 14, charisma: 12,
  }, options.healing ? "cleric" : "wizard");
  player.level = options.area ? 6 : 5;
  player.classProgression = createHeroClassProgression(options.healing ? "cleric" : "wizard", player.level);
  player.maxHp = 500;
  player.hp = options.hp ?? (options.healing ? 499 : options.trapTrigger ? 2 : 500);
  player.mp = player.maxMp = 100;
  player.knownSpells = options.healing ? ["cureWounds"]
    : options.area ? ["fireball"] : ["magicMissile", "fireBolt"];
  player.progression.tutorial.completed = true;
  player.progression.seenCutsceneIds = ["campaign.opening"];
  player.progression.gathering.seed = 24680;
  player.progression.trapSeed = 24680;
  player.progression.trapGuidance = true;
  player.activeEffects = options.dungeon || options.healing || options.area ? [] : [
    { id: "poison", remainingTurns: 4, source: "Test effect" },
    { id: "prone", remainingTurns: 10, source: "Test effect" },
  ];
  let trapEvidence: {
    id: string;
    name: string;
    type: TrapType;
    x: number;
    y: number;
    triggerKey?: string;
  } | undefined;
  if (options.dungeon) {
    const trapKit = getItem("trapKit");
    if (!trapKit) throw new Error("Missing canonical trap-kit fixture");
    player.inventory.push({ ...trapKit });
    const dungeon = DUNGEONS[0]!;
    const map = getDungeonLevelMap(dungeon, 0);
    const traps = generateDungeonTraps(dungeon, 0, player.progression.trapSeed);
    for (const trap of traps) {
      const definition = getTrapDefinition(trap.type);
      if (options.trapTrigger && (!definition.damage || definition.dropsLevel || definition.startsEncounter)) continue;
      const approach = [
        { x: trap.x - 1, y: trap.y }, { x: trap.x + 1, y: trap.y },
        { x: trap.x, y: trap.y - 1 }, { x: trap.x, y: trap.y + 1 },
      ].find((point) => map[point.y]?.[point.x] === Terrain.DungeonFloor
        && traps.filter((other) =>
          Math.abs(other.x - point.x) + Math.abs(other.y - point.y) <= 1
        ).length === 1);
      if (!approach) continue;
      if (!options.trapTrigger) {
        const resolvedPlayer = structuredClone(player);
        const detection = attemptTrapDetection(resolvedPlayer, trap, 1);
        const disarm = attemptTrapDisarm(resolvedPlayer, trap, 1);
        if (!detection.success || !disarm.success) continue;
      }
      const name = getTrapDefinition(trap.type).name;
      trapEvidence = {
        id: trap.id,
        name,
        type: trap.type,
        x: trap.x,
        y: trap.y,
        triggerKey: trap.x > approach.x ? "d" : trap.x < approach.x ? "a"
          : trap.y > approach.y ? "s" : "w",
      };
      if (options.trapTrigger) player.progression.trapStates[trap.id] = "missed";
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
  const normalized = normalizeSaveData(structuredClone(save));
  if (!normalized) throw new Error("Invalid canonical dice-test campaign");
  expect(normalized.player.level).toBe(player.level);
  expect(normalized.player.stats).toEqual(player.stats);
  const preferences = normalizeGamePreferences({
    audio: { muted: true },
    accessibility: {
      textScale: options.textScale ?? 1,
      reducedMotion: options.reducedMotion ?? false,
      highContrast: options.textScale === 1.5,
    },
    controls: { touchControls: "on" },
    dice: { frequency: options.disabled ? "off" : "all", speed: options.instant ? "instant" : "normal" },
  });
  await page.addInitScript(({ campaign, preferences, attackNaturals, area }) => {
    if (!sessionStorage.getItem("diceInitialized")) {
      sessionStorage.setItem("diceInitialized", "true");
      localStorage.clear();
      localStorage.setItem("2dnd_save", campaign);
      localStorage.setItem("2dnd_preferences", JSON.stringify(preferences));
    }
    let seed = 0x165_2026;
    const forced = [...attackNaturals];
    Math.random = () => {
      const stack = forced.length > 0 || area ? new Error().stack ?? "" : "";
      // This damage fixture must hit independently of Phaser's texture UUID RNG calls.
      if (area && stack.includes("playerCastSpellAtTargets") && stack.includes("rollCombatD20")) {
        return 0.925;
      }
      if (forced.length > 0 && stack.includes("playerAttack") && stack.includes("rollCombatD20")) {
        const natural = forced.shift()!;
        if (!Number.isInteger(natural) || natural < 1 || natural > 20) {
          throw new Error("Invalid canonical attack RNG fixture");
        }
        return (natural - 0.5) / 20;
      }
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x1_0000_0000;
    };
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
  }, {
    campaign: JSON.stringify(save), preferences, attackNaturals: options.attackNaturals ?? [],
    area: options.area === true,
  });
  await page.goto("game.html", { waitUntil: "networkidle" });
  await expect(page.locator("#debug-state")).toContainText("BOOT | Screen: title");
  await page.locator("#debug-checkbox").check();
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

async function expectDiceBounds(page: Page, textScale: TextScale): Promise<void> {
  await expect.poll(() => page.evaluate(() => {
    const root = document.getElementById("dice-presentation");
    const canvas = document.querySelector("#game-container canvas");
    if (!root || root.hidden || !canvas) return false;
    const rect = root.getBoundingClientRect();
    const bounds = canvas.getBoundingClientRect();
    return Math.abs(rect.left - bounds.left) < 1
      && Math.abs(rect.width - bounds.width) < 1
      && rect.right <= window.innerWidth
      && rect.bottom <= window.innerHeight;
  })).toBe(true);
  const bounds = await page.locator("#dice-presentation").evaluate((root) => {
    const rect = root.getBoundingClientRect();
    const glyphs = root.querySelector<HTMLElement>(".resolved-dice")!;
    const result = root.querySelector<HTMLElement>("#dice-result")!;
    const canvas = document.querySelector<HTMLCanvasElement>("#game-container canvas")!.getBoundingClientRect();
    return {
      left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, height: rect.height,
      width: root.clientWidth, scrollWidth: root.scrollWidth,
      glyphWidth: glyphs.clientWidth, glyphScrollWidth: glyphs.scrollWidth,
      resultWidth: result.clientWidth, resultScrollWidth: result.scrollWidth,
      viewportWidth: window.innerWidth, viewportHeight: window.innerHeight,
      canvas: { left: canvas.left, right: canvas.right, top: canvas.top, bottom: canvas.bottom, height: canvas.height },
      textScale: Number(root.style.getPropertyValue("--dice-text-scale")),
    };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewportWidth);
  expect(bounds.left).toBeGreaterThanOrEqual(bounds.canvas.left);
  expect(bounds.right).toBeLessThanOrEqual(bounds.canvas.right);
  expect(bounds.top).toBeGreaterThanOrEqual(bounds.canvas.top);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.canvas.bottom);
  expect(bounds.height).toBeCloseTo(bounds.canvas.height * 0.72, 0);
  expect(bounds.textScale).toBe(textScale);
  expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.width);
  expect(bounds.glyphScrollWidth).toBeLessThanOrEqual(bounds.glyphWidth);
  expect(bounds.resultScrollWidth).toBeLessThanOrEqual(bounds.resultWidth);
}

async function captureDiceScreenshot(page: Page, name: string): Promise<void> {
  const path = test.info().outputPath(`${name}.png`);
  // Full-page capture resizes the viewport and correctly cancels a live throw.
  await page.screenshot({ path });
  await test.info().attach(name, { path, contentType: "image/png" });
}

async function skipDiceWithKeyboard(page: Page): Promise<void> {
  const dock = page.locator("#dice-presentation");
  const previous = await dock.getAttribute("data-last-skipped-sequence");
  await page.keyboard.down("z");
  try {
    await expect.poll(() => dock.getAttribute("data-last-skipped-sequence")).not.toBe(previous);
  } finally {
    await page.keyboard.up("z");
  }
}

async function captureDisplayedDice(
  page: Page,
  label: string,
  boundary: "present" | "skip" = "present",
): Promise<DisplayedDiceSnapshot> {
  return page.evaluate(({ expected, boundary }) => new Promise<DisplayedDiceSnapshot>((resolve, reject) => {
    const root = document.getElementById("dice-presentation");
    if (!root) throw new Error("Missing live dice view");
    const previousSequence = boundary === "skip"
      ? root.dataset.lastSkippedSequence : root.dataset.sequence;
    const read = (): boolean => {
      const sequence = boundary === "skip"
        ? root.dataset.lastSkippedSequence : root.dataset.sequence;
      if (sequence === previousSequence) return false;
      const text = root.querySelector("#dice-result")?.textContent ?? "";
      if (!text.startsWith(expected)) return false;
      observer.disconnect();
      window.clearTimeout(timeout);
      resolve({
        text,
        phase: root.dataset.phase,
        motionCount: root.getAnimations({ subtree: true }).length,
        hidden: root.hidden === true,
        faces: [...root.querySelectorAll<HTMLElement>(".resolved-die")].map((die) => ({
          sides: die.dataset.sides, natural: die.dataset.natural,
        })),
        rollingFaces: [...document.querySelectorAll<HTMLElement>("#dice-roll-stage .rolling-die")].map((die) => ({
          sides: die.dataset.sides, natural: die.dataset.natural,
        })),
      });
      return true;
    };
    const observer = new MutationObserver(read);
    const timeout = window.setTimeout(() => {
      observer.disconnect();
      reject(new Error(`No live presentation for ${expected}`));
    }, 5000);
    observer.observe(root, { childList: true, subtree: true, attributes: true });
    read();
  }), { expected: label, boundary });
}

test.describe("physical dice game-viewport demo", () => {
  test("real dice travel, tumble, bounce and settle without hiding controls or changing results", async ({ page }) => {
    const recordingAt = Date.now();
    const errors = collectErrors(page);
    const evidence = captureDice(page);
    await seedCampaign(page, { textScale: 1.5, healing: true, hp: 450 });
    await continueCampaign(page);
    await page.setViewportSize({ width: 932, height: 620 });
    await holdKey(page, "e");
    await clickLayoutItem(page, "equip-skills-tab");
    const startedAt = Date.now();
    const motionPromise = page.evaluate(async () => {
      const stage = document.getElementById("dice-roll-stage")!;
      const startDeadline = performance.now() + 5000;
      while (stage.hidden && performance.now() < startDeadline) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
      const die = stage.querySelector<HTMLElement>(".rolling-die")!;
      if (!die) throw new Error("No actual rolling die was rendered");
      const sequence = stage.dataset.sequence;
      const canvas = document.querySelector<HTMLCanvasElement>("#game-container canvas")!;
      const bounds = canvas.getBoundingClientRect();
      const stageBounds = stage.getBoundingClientRect();
      const samples: {
        at: number; x: number; y: number; tilt: number; yaw: number; natural: string | undefined;
      }[] = [];
      const deadline = performance.now() + 1400;
      while (!stage.hidden && performance.now() < deadline) {
        if (stage.dataset.sequence !== sequence) throw new Error("The sampled roll was replaced");
        const matrix = new DOMMatrix(getComputedStyle(die).transform);
        samples.push({
          at: performance.now(), x: matrix.m41, y: matrix.m42,
          tilt: matrix.m23, yaw: matrix.m13, natural: die.dataset.natural,
        });
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
      return {
        samples,
        size: Number.parseFloat(die.style.width),
        hidden: stage.hidden,
        childCount: stage.childElementCount,
        skipped: document.getElementById("dice-presentation")?.dataset.skipped,
        pointerEvents: getComputedStyle(stage).pointerEvents,
        stage: { left: stageBounds.left, right: stageBounds.right, top: stageBounds.top, bottom: stageBounds.bottom },
        canvas: { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom },
      };
    });
    await clickLayoutItem(page, "equip-spell-cureWounds");
    const receipt = await evidence.find("healing", "party:hero");
    const healing = receipt.healing?.healingRoll;
    if (!healing?.roll) throw new Error("No canonical die for the physical-roll demonstration");
    await expect(page.locator("#dice-roll-stage")).toBeVisible();
    await captureDiceScreenshot(page, "physical-die-desktop-in-flight");
    const motion = await motionPromise;
    expect(motion.samples.length).toBeGreaterThan(5);
    const spread = (values: readonly number[]): number => Math.max(...values) - Math.min(...values);
    expect(spread(motion.samples.map((sample) => sample.x))).toBeGreaterThan(motion.size);
    expect(spread(motion.samples.map((sample) => sample.tilt))).toBeGreaterThan(0.1);
    expect(spread(motion.samples.map((sample) => sample.yaw))).toBeGreaterThan(0.1);
    const y = motion.samples.map((sample) => sample.y);
    expect(y.some((height, index) => index > 0 && height < y[index - 1]! - 0.5)).toBe(true);
    expect(motion.samples.every((sample) => sample.natural === String(healing.roll!.naturalRolls[0]))).toBe(true);
    expect(motion.hidden).toBe(false);
    expect(motion.childCount).toBeGreaterThan(0);
    expect(motion.skipped).toBe("false");
    expect(motion.pointerEvents).toBe("none");
    expect(motion.stage.left).toBeGreaterThanOrEqual(motion.canvas.left);
    expect(motion.stage.right).toBeLessThanOrEqual(motion.canvas.right);
    expect(motion.stage.top).toBeGreaterThanOrEqual(motion.canvas.top);
    expect(motion.stage.bottom).toBeLessThanOrEqual(motion.canvas.bottom);
    await expect(page.locator("#dice-presentation")).toHaveAttribute("data-phase", "ready");
    await expect(page.locator("#dice-result")).toContainText(formatDicePresentation(createEffectDicePresentation(
      healing, { category: "healing", label: "Dice Tester Cure Wounds", outcome: "success" },
    )));
    await expectDiceBounds(page, 1.5);
    await captureDiceScreenshot(page, "physical-die-desktop-final");
    await page.setViewportSize({ width: 390, height: 844 });
    const from = evidence.packets.length;
    await clickLayoutItem(page, "equip-spell-cureWounds");
    await evidence.find("healing", "party:hero", from);
    await expect(page.locator("#dice-roll-stage")).toBeVisible();
    await captureDiceScreenshot(page, "physical-die-mobile-in-flight");
    await expect(page.locator("#dice-presentation")).toHaveAttribute("data-phase", "ready");
    await expect(page.locator("#dice-roll-stage .rolling-die")).toHaveCount(1);
    await expectDiceBounds(page, 1.5);
    await captureDiceScreenshot(page, "physical-die-mobile-final");
    await clickLayoutItem(page, "equip-spell-cureWounds");
    await expect(page.locator("#dice-roll-stage")).toBeVisible();
    await skipDiceWithKeyboard(page);
    await expect(page.locator("#dice-presentation")).toHaveAttribute("data-phase", "ready");
    await expect(page.locator("#dice-roll-stage .rolling-die")).toHaveCount(1);
    expect(await page.locator("#dice-roll-stage").evaluate((stage) => stage.getAnimations({ subtree: true }).length)).toBe(0);
    await clickLayoutItem(page, "equip-spell-cureWounds");
    await expect(page.locator("#dice-roll-stage")).toBeVisible();
    await page.evaluate(() => {
      // Headless Chromium keeps every tab visible; drive the same visibility boundary explicitly.
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(page.locator("#dice-roll-stage")).toBeHidden();
    await expect(page.locator("#dice-roll-stage .rolling-die")).toHaveCount(0);
    await page.evaluate(() => {
      Reflect.deleteProperty(document, "visibilityState");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe("visible");
    await holdKey(page, "e");
    await expectCleanLayout(page);
    const heals = evidence.packets.filter((packet) => packet.kind === "healing" && packet.actionId === "cureWounds");
    expect(heals).toHaveLength(4);
    const evidencePath = test.info().outputPath("physical-roll-frame-evidence.json");
    const frameEvidence = { recordingAt, startedAt, motion, receipts: heals.map((packet) => packet.healing) };
    await writeFile(evidencePath, JSON.stringify(frameEvidence, null, 2), "utf8");
    const storedEvidence: unknown = JSON.parse(await readFile(evidencePath, "utf8"));
    expect(storedEvidence).toEqual(frameEvidence);
    await test.info().attach("physical-roll-frame-evidence", { path: evidencePath, contentType: "application/json" });
    await holdKey(page, "Escape");
    await clickLayoutItem(page, "escape-menu-quit");
    await expect(page.locator("#debug-state")).toContainText("BOOT | Screen: title");
    const saved = await readSave(page);
    const hpRestored = heals.reduce((total, packet) => total + (packet.healing?.healingRoll?.application?.amount ?? 0), 0);
    expect(saved.player.hp).toBe(450 + hpRestored);
    expect(saved.player.mp).toBe(100 - 4 * getSpell("cureWounds")!.mpCost);
    expect(errors).toEqual([]);
    const video = page.video();
    if (video) {
      await closeDiceCapture(page);
      await page.close();
      const path = test.info().outputPath("physical-dice.webm");
      await video.saveAs(path);
      await test.info().attach("physical-dice-recording", { path, contentType: "video/webm" });
    }
  });
});

for (const textScale of [1, 1.25, 1.5] as const) {
  test(`battle receipts and skip controls remain truthful at ${textScale * 100}% text`, async ({ page }) => {
    const errors = collectErrors(page);
    const evidence = captureDice(page);
    await seedCampaign(page, { textScale });
    await continueCampaign(page);
    await debugCommand(page, "/spawn orc");
    await expect(page.locator("#debug-state")).toContainText("Phase: playerTurn");
    const log = page.locator("#battle-log");
    await expect(page.locator("#dice-history, #dice-log")).toHaveCount(0);
    await expect(log.locator('[data-category="initiative"]')).toHaveCount(2);
    await expect.poll(() => evidence.packets.some((packet) =>
      packet.kind === "initiative" && packet.actorId?.includes(":enemy:")
    )).toBe(true);
    const enemy = evidence.packets.find((packet) =>
      packet.kind === "initiative" && packet.actorId?.includes(":enemy:")
    );
    if (!enemy?.rollResult) throw new Error("Missing canonical initiative");
    const enemyInitiative = await log.locator('[data-category="initiative"]')
      .filter({ hasText: "Orc" }).textContent();
    expect(enemyInitiative).toContain(`d20 ${enemy.rollResult.naturalRoll}`);
    expect(enemyInitiative).not.toMatch(/=[ ]?\d|\+\d/);
    const savePacket = await evidence.find("save", "party:hero");
    if (!savePacket.save) throw new Error("Missing canonical saving throw");
    await expect(log.locator('[data-category="save"]').first()).toContainText(
      formatDicePresentation(createD20Presentation(savePacket.save.rollResult, {
        category: "save", label: `Dice Tester save vs ${savePacket.save.label}`,
        outcome: savePacket.save.success ? "success" : "failure",
        threshold: { kind: "DC", value: savePacket.save.dc },
      })),
    );
    const status = await evidence.find("statusDamage", "party:hero");
    if (!status.damage || !("effectId" in status.damage)) throw new Error("Missing canonical status tick");
    await expect(log).toContainText(formatDicePresentation(createEffectDicePresentation(
      status.damage.damageRoll, {
        category: "damage", label: `Dice Tester ${status.damage.label} damage`,
        actorId: "party:hero", outcome: "rolled",
      },
    )));
    await expect(log).toContainText(`HP lost ${status.appliedDamage}`);

    const displayedAttack = captureDisplayedDice(page, "Dice Tester attack");
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
    const visibleAttack = await displayedAttack;
    const dock = page.locator("#dice-presentation");
    await expect(dock).toHaveAttribute("data-phase", "animating");
    const beforeSkip = await dock.getAttribute("data-last-skipped-sequence");
    const skipSnapshot = captureDisplayedDice(page, "", "skip");
    if (textScale === 1) await skipDiceWithKeyboard(page);
    else if (textScale === 1.25) await pressGamepad(page, 10);
    else await page.locator("#dice-fast-forward").tap();
    await expect.poll(() => dock.getAttribute("data-last-skipped-sequence")).not.toBe(beforeSkip);
    const skipped = await skipSnapshot;
    expect(skipped.phase).toBe("ready");
    expect(skipped.motionCount).toBe(0);
    expect(skipped.rollingFaces).toEqual(skipped.faces);

    const attack = log.locator('[data-category="attack"]').filter({ hasText: "Dice Tester attack" });
    const attackPacket = await evidence.find("attack", "party:hero");
    const roll = attackPacket.attack?.rollResult;
    if (!roll) throw new Error("Missing canonical attack dice");
    expect(roll.selection).toBe("disadvantage");
    await expect(attack).toContainText("Disadvantage");
    await expect(attack).toContainText(`-> ${roll.naturalRoll}`);
    await expect(attack).toContainText(`${roll.modifier >= 0 ? "+" : ""}${roll.modifier} = ${roll.total}`);
    expect(await attack.textContent()).not.toContain("vs AC");
    expect(visibleAttack.faces.map((die) => die.natural)).toEqual([
      ...roll.naturalRolls,
      ...(attackPacket.attack?.damageRoll?.roll?.naturalRolls ?? []),
    ].map(String));
    await expect(attack).toContainText(formatDicePresentation(createCombatDicePresentation(
      attackPacket.attack!, { label: `Dice Tester attack -> ${getMonster("orc")!.name}` },
    )!));
    expect(visibleAttack.text).toBe(formatDicePresentation(createCombatDicePresentation(
      attackPacket.attack!, { label: `Dice Tester attack -> ${getMonster("orc")!.name}` },
    )!));
    if (textScale === 1) await captureDiceScreenshot(page, "disadvantage-desktop");
    await page.setViewportSize({ width: 390, height: 844 });
    await expectDiceBounds(page, textScale);
    await expect(attack).toHaveCount(1);

    await expect(log).toHaveAttribute("aria-label", "Battle log");
    await expect(page.locator("#debug-state")).toContainText("Phase: playerTurn");
    const displayedMissile = captureDisplayedDice(page, "Dice Tester Magic Missile");
    await clickLayoutItem(page, "battle-action-spells");
    await clickLayoutItem(page, "battle-spell-magicMissile");
    await holdKey(page, "Enter");
    const missile = log.locator('[data-category="attack"]').filter({ hasText: "Magic Missile" });
    await expect(missile).toContainText("Auto-hit (no attack roll)");
    expect(await missile.textContent()).not.toMatch(/d20|Disadvantage|\bAC\b/);
    const missilePacket = await evidence.find("attack", "party:hero", evidence.packets.indexOf(attackPacket) + 1);
    if (!missilePacket.attack?.damageRoll?.roll) throw new Error("Missing canonical Magic Missile damage");
    expect(missilePacket.actionId).toBe("magicMissile");
    expect(missilePacket.attack.damageRoll.roll.sides).toBe(4);
    expect(missilePacket.attack.damageRoll.roll.naturalRolls).toHaveLength(3);
    await expect(missile).toContainText(formatDicePresentation(createCombatDicePresentation(
      missilePacket.attack, { label: `Dice Tester Magic Missile -> ${getMonster("orc")!.name}` },
    )!));
    const visibleMissile = await displayedMissile;
    expect(visibleMissile.faces.map((die) => [die.sides, die.natural]))
      .toEqual(missilePacket.attack.damageRoll.roll.naturalRolls.map((natural) => ["4", String(natural)]));
    expect(visibleMissile.text).toBe(formatDicePresentation(createCombatDicePresentation(
      missilePacket.attack, { label: `Dice Tester Magic Missile -> ${getMonster("orc")!.name}` },
    )!));
    await expectDiceBounds(page, textScale);
    await captureDiceScreenshot(page, `magic-missile-mobile-${textScale}`);
    if (textScale === 1) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await captureDiceScreenshot(page, "magic-missile-desktop");
    }
    await debugCommand(page, "/kill");
    await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
    await expect(log).toHaveCount(0);
    await expect(page.locator("#dice-presentation")).toBeHidden();
    await expect(page.locator("#dice-roll-stage .resolved-die")).toHaveCount(0);
    await expect(page.locator("#dice-presentation")).toHaveAttribute("data-phase", "ready");
    const save = await readSave(page);
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.player.mp).toBe(100 - getSpell("magicMissile")!.mpCost);
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator("#debug-state")).toContainText("BOOT | Screen: title");
    await expect(page.locator("#dice-presentation")).toBeHidden();
    expect(errors).toEqual([]);
  });
}

for (const textScale of [1, 1.25, 1.5] as const) {
  test(`real exploration and battle healing keep exact pools and HP caps at ${textScale * 100}% mobile text`, async ({ page }) => {
    const errors = collectErrors(page);
    const evidence = captureDice(page);
    await seedCampaign(page, {
      textScale, healing: true, reducedMotion: true,
      attackNaturals: textScale === 1 ? [12] : undefined,
    });
    await continueCampaign(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await holdKey(page, "e");
    await clickLayoutItem(page, "equip-skills-tab");
    await clickLayoutItem(page, "equip-spell-cureWounds");
    const exploration = await evidence.find("healing", "party:hero");
    const heal = exploration.healing?.healingRoll;
    if (!heal?.roll) throw new Error("Missing exact exploration heal");
    expect(exploration.actionId).toBe("cureWounds");
    expect(heal.roll.sides).toBe(8);
    expect(heal.roll.naturalRolls).toHaveLength(1);
    expect(heal.roll.modifier).toBe(0);
    expect(heal.application?.amount).toBe(1);
    if (heal.amount > 1) expect(heal.application?.limit).toBe("Maximum HP");
    await expect(page.locator("#dice-result")).toContainText(formatDicePresentation(
      createEffectDicePresentation(heal, {
        category: "healing", label: "Dice Tester Cure Wounds", outcome: "success",
      }),
    ));
    await expect(page.locator("#dice-presentation")).toHaveAttribute("data-phase", "ready");
    await expect(page.locator("#dice-fast-forward")).toBeDisabled();
    expect(await page.locator("#dice-presentation").evaluate((root) => root.getAnimations({ subtree: true }).length)).toBe(0);
    await expectDiceBounds(page, textScale);
    await expectCleanLayout(page);
    await holdKey(page, "e");
    await debugCommand(page, "/spawn orc");
    await expect(page.locator("#debug-state")).toContainText("Phase: playerTurn");
    if (textScale === 1) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await holdKey(page, "Enter");
      await holdKey(page, "Enter");
      await expect(page.locator("#dice-result")).toContainText("Dice Tester attack");
      const attack = await evidence.find("attack", "party:hero");
      if (!attack.attack?.rollResult || !attack.attack.damageRoll?.roll) {
        throw new Error("Screenshot attack did not expose canonical hit/damage dice");
      }
      expect(attack.attack.hit).toBe(true);
      await captureDiceScreenshot(page, "attack-d20-damage-desktop");
      await page.setViewportSize({ width: 390, height: 844 });
      await captureDiceScreenshot(page, "attack-d20-damage-mobile");
      await expect(page.locator("#debug-state")).toContainText("Phase: playerTurn");
    }
    const from = evidence.packets.length;
    await clickLayoutItem(page, "battle-action-spells");
    await clickLayoutItem(page, "battle-spell-cureWounds");
    const battle = await evidence.find("healing", "party:hero", from);
    const battleHeal = battle.healing?.healingRoll;
    if (!battleHeal?.roll) throw new Error("Missing exact battle heal");
    expect(battle.actionId).toBe("cureWounds");
    expect(battleHeal.roll.sides).toBe(8);
    expect(battleHeal.roll.naturalRolls).toHaveLength(1);
    expect(battleHeal.roll.modifier).toBe(0);
    await expect(page.locator("#battle-log")).toContainText(formatDicePresentation(
      createEffectDicePresentation(battleHeal, {
        category: "healing", label: "Dice Tester Cure Wounds -> Dice Tester", outcome: "success",
      }),
    ));
    await expectDiceBounds(page, textScale);
    if (textScale === 1) {
      await captureDiceScreenshot(page, "healing-d8-mobile");
      await page.setViewportSize({ width: 1440, height: 900 });
      await captureDiceScreenshot(page, "healing-d8-desktop");
    }
    await debugCommand(page, "/kill");
    await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
    expect((await readSave(page)).player.mp).toBe(100 - 2 * getSpell("cureWounds")!.mpCost);
    await expect(page.locator("#battle-log")).toHaveCount(0);
    await expect(page.locator("#dice-presentation")).toBeHidden();
    await expect(page.locator("#dice-presentation")).toHaveAttribute("data-phase", "ready");
    expect(errors).toEqual([]);
  });
}

test("one real area cast shows one exact pool with independent target HP results in instant mode", async ({ page }) => {
  const errors = collectErrors(page);
  const evidence = captureDice(page);
  await seedCampaign(page, { textScale: 1.5, area: true, instant: true });
  await continueCampaign(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await debugCommand(page, "/battleview goblinRaidingParty forest day clear");
  await expect(page.locator("#debug-state")).toContainText("Phase: playerTurn");
  await clickLayoutItem(page, "battle-action-spells");
  const displayed = captureDisplayedDice(page, "Dice Tester Fireball");
  await clickLayoutItem(page, "battle-spell-fireball");
  const targetCount = getMonsterGroupTemplate("goblinRaidingParty")!.members.length;
  await expect.poll(() => evidence.packets.filter((packet) =>
    packet.actorId === "party:hero" && packet.actionId === "fireball" && packet.kind === "attack"
  ).length).toBe(targetCount);
  const attacks = evidence.packets.filter((packet) =>
    packet.actorId === "party:hero" && packet.actionId === "fireball" && packet.kind === "attack"
  );
  const pool = attacks[0]?.attack?.damageRoll?.roll;
  if (!pool) throw new Error("Area fixture did not resolve a damage roll");
  expect(pool.sides).toBe(6);
  expect(pool.naturalRolls).toHaveLength(8);
  const entry = page.locator('#battle-log [data-category="attack"]').filter({ hasText: "Dice Tester Fireball" });
  await expect(entry).toHaveCount(1);
  for (const packet of attacks) {
    expect(packet.attack?.damageRoll?.roll).toEqual(pool);
    expect(packet.attack?.damageRoll?.shared).toBe(true);
    await expect(entry).toContainText(`HP lost ${packet.attack?.damageRoll?.application?.amount}`);
  }
  await expect(entry).toContainText("(shared roll)");
  const visible = await displayed;
  expect(visible.faces.map((die) => [die.sides, die.natural])).toEqual([
    ["20", String(attacks[0]!.attack!.rollResult!.naturalRoll)],
    ...pool.naturalRolls.map((natural) => ["6", String(natural)]),
  ]);
  expect(visible.rollingFaces).toEqual(visible.faces);
  await expect(page.locator("#dice-presentation")).toHaveAttribute("data-phase", "ready");
  await expectDiceBounds(page, 1.5);
  await debugCommand(page, "/kill");
  await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
  expect((await readSave(page)).player.mp).toBe(100 - getSpell("fireball")!.mpCost);
  await expect(entry).toHaveCount(0);
  expect(errors).toEqual([]);
});

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
  await expect(page.locator("#dice-result")).toContainText(formatSkillCheckResult(check));
  await expect(page.locator("#dice-log, #battle-log")).toHaveCount(0);
  await expect(page.locator("#dice-presentation")).toHaveAttribute("data-phase", "ready");
  await expect(page.locator("#dice-presentation")).toBeHidden();
  await expect(page.locator("#dice-presentation svg")).toHaveCount(0);
  await page.reload({ waitUntil: "networkidle" });
  await continueCampaign(page);
  expect((await readSave(page)).player.progression.skillChecks).toEqual(save.player.progression.skillChecks);
  await expect(page.locator("#game-container canvas")).toHaveAttribute("data-dice-frequency", "off");
  await expect(page.locator("#dice-presentation")).toBeHidden();
  expect(errors).toEqual([]);
});

test("non-battle event dice fade without a dock, lasting history or replay in another battle", async ({ page }) => {
  const errors = collectErrors(page);
  await seedCampaign(page);
  await continueCampaign(page);
  await expect(page.locator("#dice-presentation")).toBeHidden();
  const canvasBefore = await page.locator("#game-container canvas").boundingBox();
  await debugCommand(page, "/event trigger moonlitShrine");
  await clickLayoutItem(page, "world-event-choice-studyRunes");
  await expect(page.locator("#debug-state")).not.toContainText("[WORLD_EVENT:");
  const check = Object.entries((await readSave(page)).player.progression.skillChecks)
    .find(([id]) => id.startsWith("worldEvent:"))?.[1];
  if (!check) throw new Error("No canonical World Event result");
  await expect(page.locator("#dice-result")).toContainText(formatSkillCheckResult(check));
  await expect(page.locator('#dice-roll-stage [data-sides="20"]'))
    .toHaveAttribute("data-natural", String(check.naturalRoll));
  await expect(page.locator("#dice-history, #dice-log, #battle-log")).toHaveCount(0);
  expect(await page.locator("#game-container canvas").boundingBox()).toEqual(canvasBefore);
  await expectDiceBounds(page, 1);
  await expect(page.locator("#dice-presentation")).toBeHidden({ timeout: 5_000 });
  await expect(page.locator("#dice-result")).toBeEmpty();
  await expect(page.locator("#dice-roll-stage .resolved-die")).toHaveCount(0);
  await holdKey(page, "Escape");
  await expect(page.locator("#debug-state")).toContainText("[MENU]");
  await expect(page.locator("#dice-presentation")).toBeHidden();
  await holdKey(page, "Escape");
  await debugCommand(page, "/spawn orc");
  await expect(page.locator("#debug-state")).toContainText("Phase: playerTurn");
  await expect(page.locator('#battle-log [data-category="skill"]')).toHaveCount(0);
  await debugCommand(page, "/kill");
  await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
  await expect(page.locator("#battle-log")).toHaveCount(0);
  await expect(page.locator("#dice-presentation")).toBeHidden();
  expect(errors).toEqual([]);
});

test("rolls default on, disable easily, and actual positive/negative crits remain visible with Off", async ({ page }) => {
  const errors = collectErrors(page);
  const evidence = captureDice(page);
  await seedCampaign(page, {
    healing: true, textScale: 1.5, attackNaturals: [12, 20, 1],
  });
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).dice.frequency, PREFERENCES_KEY))
    .toBe("all");
  const campaign = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
  await clickLayoutItem(page, "title-settings");
  await clickLayoutItem(page, "settings-dice-frequency");
  await clickLayoutItem(page, "settings-dice-frequency");
  await expectCleanLayout(page);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).dice.frequency, PREFERENCES_KEY))
    .toBe("off");
  expect(await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY)).toBe(campaign);
  await holdKey(page, "Escape");
  await continueCampaign(page);
  await debugCommand(page, "/spawn orc");
  await expect(page.locator("#debug-state")).toContainText("Phase: playerTurn");
  for (const natural of [12, 20, 1]) {
    const from = evidence.packets.length;
    const displayed = captureDisplayedDice(page, "Dice Tester attack");
    await holdKey(page, "Enter");
    await holdKey(page, "Enter");
    const packet = await evidence.find("attack", "party:hero", from);
    const result = packet.attack;
    if (!result?.rollResult) throw new Error("No canonical resolved attack");
    expect(result.rollResult.naturalRoll).toBe(natural);
    const visible = await displayed;
    expect(visible.text).toContain(`d20 ${natural}`);
    if (natural === 12) {
      expect(result.critical ?? false).toBe(false);
      expect(result.fumble ?? false).toBe(false);
      expect(visible.hidden).toBe(true);
      expect(visible.faces).toEqual([]);
      expect(visible.rollingFaces).toEqual([]);
    } else {
      expect(natural === 20 ? result.critical : result.fumble).toBe(true);
      expect(visible.hidden).toBe(false);
      expect(visible.faces[0]).toEqual({ sides: "20", natural: String(natural) });
      expect(visible.rollingFaces[0]).toEqual({ sides: "20", natural: String(natural) });
      expect(visible.text).toContain(natural === 20 ? "Critical hit" : "Fumble / critical miss");
    }
    await expect(page.locator("#battle-log")).toContainText(visible.text);
    await expect(page.locator("#debug-state")).toContainText("Phase: playerTurn");
  }
  await debugCommand(page, "/kill");
  await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
  expect((await readSave(page)).player.mp).toBe(100);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("#game-container canvas")).toHaveAttribute("data-dice-frequency", "off");
  expect(errors).toEqual([]);
});

test("real trap detection and disarm use the exact canonical checks and never reroll on load", async ({ page }) => {
  const errors = collectErrors(page);
  const packets = captureDice(page);
  const evidence = await seedCampaign(page, { dungeon: true, textScale: 1.25 });
  if (!evidence) throw new Error("Missing trap fixture evidence");
  await continueCampaign(page);
  const detection = await packets.find("trapDetection");
  if (!detection.trap || detection.trapId !== evidence.id) throw new Error("Wrong canonical detection target");
  await expect(page.locator("#dice-result")).toContainText(
    formatDicePresentation(createTrapDicePresentation(detection.trap, evidence.name, true)!),
  );
  await holdKey(page, "Space");
  const disarm = await packets.find("trapDisarm");
  if (!disarm.trap || disarm.trapId !== evidence.id) throw new Error("Wrong canonical disarm target");
  await expect(page.locator("#dice-result")).toContainText(
    formatDicePresentation(createTrapDicePresentation(disarm.trap, evidence.name, false)!),
  );
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

test("stepping onto a real missed trap shows its exact damage dice and nonlethal HP change once", async ({ page }) => {
  const errors = collectErrors(page);
  const packets = captureDice(page);
  const trap = await seedCampaign(page, {
    dungeon: true, trapTrigger: true, textScale: 1.5, reducedMotion: true,
  });
  if (!trap?.triggerKey) throw new Error("Missing damage-trap approach");
  await continueCampaign(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await holdKey(page, trap.triggerKey);
  const packet = await packets.find("trapDamage");
  if (!packet.damage || !("triggered" in packet.damage) || !packet.damage.damageRoll?.roll) {
    throw new Error("Missing canonical trap damage");
  }
  const result = packet.damage;
  const effect = result.damageRoll!;
  expect(packet.trapId).toBe(trap.id);
  const damage = getTrapDefinition(trap.type).damage!;
  expect(effect.roll?.sides).toBe(damage.sides);
  expect(effect.roll?.naturalRolls).toHaveLength(damage.count);
  expect(effect.application?.amount).toBe(1);
  if (effect.amount > 1) expect(effect.application?.limit).toBe("Nonlethal");
  await expect(page.locator("#dice-result")).toContainText(formatDicePresentation(createEffectDicePresentation(
    effect, { category: "damage", label: `${trap.name} damage`, outcome: "rolled" },
  )));
  await expectDiceBounds(page, 1.5);
  const saved = await readSave(page);
  expect(saved.player.hp).toBe(1);
  expect(saved.player.position.x).toBe(trap.x);
  expect(saved.player.position.y).toBe(trap.y);
  expect(saved.player.progression.trapStates[trap.id]).toBe("triggered");
  await page.reload({ waitUntil: "networkidle" });
  await continueCampaign(page);
  await expect(page.locator("#dice-presentation")).toBeHidden();
  expect((await readSave(page)).player.hp).toBe(1);
  expect((await readSave(page)).player.progression.trapStates[trap.id]).toBe("triggered");
  expect(errors).toEqual([]);
});

test("a real flee check clears its battle log and dice on handoff without changing resources", async ({ page }) => {
  const errors = collectErrors(page);
  const evidence = captureDice(page);
  await seedCampaign(page, { reducedMotion: true, flee: true });
  await continueCampaign(page);
  const before = await readSave(page);
  await debugCommand(page, "/spawn orc");
  await expect(page.locator("#debug-state")).toContainText("Phase: playerTurn");
  const hasAbilities = (before.player.knownAbilities?.length ?? 0) > 0;
  await clickGame(page, hasAbilities ? 510 : 360, 501);
  const packet = await evidence.find("flee");
  if (!packet.flee) throw new Error("Missing canonical flee receipt");
  expect(packet.flee.success).toBe(true);
  await expect(page.locator("#debug-log")).toContainText(
    formatDicePresentation(createD20Presentation(packet.flee.rollResult, {
      category: "flee", label: "Dice Tester flee",
      outcome: packet.flee.success ? "success" : "failure",
      threshold: { kind: "DC", value: packet.flee.dc },
    })),
  );
  await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
  await expect(page.locator("#battle-log, #dice-log")).toHaveCount(0);
  await expect(page.locator("#dice-presentation")).toBeHidden();
  await expect(page.locator("#dice-roll-stage .resolved-die")).toHaveCount(0);
  await expect(page.locator("#dice-presentation")).toHaveAttribute("data-phase", "ready");
  const after = await readSave(page);
  expect(after.player.mp).toBe(before.player.mp);
  expect(after.player.gold).toBe(before.player.gold);
  expect(after.player.xp).toBe(before.player.xp);
  expect(errors).toEqual([]);
});

test("real gathering scores fade without fabricated d20s or history surviving a battle", async ({ page }) => {
  const errors = collectErrors(page);
  await seedCampaign(page, { textScale: 1.5, reducedMotion: true });
  await continueCampaign(page);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const discipline of ["fishing", "mining", "foraging"] as const) {
    interface GatheringResultObservation {
      battle: boolean;
      text: string;
      bounds: { x: number; width: number; height: number } | null;
    }
    const observeResult = () => page.waitForFunction((): GatheringResultObservation | null => {
      if (document.getElementById("debug-state")?.textContent?.includes("BATTLE")) {
        return { battle: true, text: "", bounds: null };
      }
      const text = document.getElementById("dice-result")?.textContent ?? "";
      const panel = document.getElementById("dice-presentation");
      if (!text.includes("Score 100; required 50") || !panel) return null;
      const bounds = panel.getBoundingClientRect();
      return { battle: false, text, bounds: {
        x: bounds.x, width: bounds.width, height: bounds.height,
      } };
    }, undefined, { polling: "raf" });
    let observation: ReturnType<typeof observeResult> | null = null;
    await debugCommand(page, `/gather near ${discipline}`);
    await expect(page.locator("#debug-log")).toContainText(`Moved near ${discipline} node`);
    const position = (await readSave(page)).player.position;
    await expect(page.locator("#debug-state")).toContainText(
      `Chunk: (${position.chunkX},${position.chunkY}) Pos: (${position.x},${position.y})`,
    );
    await expect(page.locator("#debug-state")).toContainText("Move: ready Handoff: ready");
    if (discipline === "fishing") await holdKey(page, "Space");
    else await debugCommand(page, `/gather trigger ${discipline}`);
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
        await expect.poll(async () => {
          const game = (await readSave(page)).player.progression.gathering.pending?.game;
          return game?.kind === "fishing" ? game.waitTicks : undefined;
        }).toBe(tick + 1);
        await page.waitForTimeout(90);
      }
      await expect(page.locator("#debug-state")).toContainText("[GATHERING_PHASE:bite]");
      await page.locator('#touch-controls [data-action="confirm"]').tap();
      await expect(page.locator("#debug-state")).toContainText("[GATHERING_PHASE:tension]");
      for (const [index, direction] of pending.game.tensionPattern.entries()) {
        if (index === pending.game.tensionPattern.length - 1) observation = observeResult();
        await pressGamepad(page, GAMEPAD_DIRECTIONS[direction]);
      }
    } else if (pending.game.kind === "mining") {
      for (const [index, direction] of pending.game.pattern.entries()) {
        await holdKey(page, DIRECTIONS[direction]);
        if (index === pending.game.pattern.length - 1) observation = observeResult();
        await holdKey(page, "Enter");
      }
    } else {
      for (let clue = 0; clue < pending.game.pattern.length; clue += 1) {
        await holdKey(page, "Enter");
      }
      for (const [index, direction] of pending.game.pattern.entries()) {
        if (index === pending.game.pattern.length - 1) observation = observeResult();
        await pressGamepad(page, GAMEPAD_DIRECTIONS[direction]);
      }
    }
    if (!observation) throw new Error("No final gathering input was observed");
    const observed = await observation;
    const view = await observed.jsonValue();
    await observed.dispose();
    if (!view) throw new Error("No gathering result evidence");
    await expect(page.locator("#debug-state")).not.toContainText(`[GATHERING:${discipline}]`);
    await expect(page.locator("#debug-log")).toContainText("Score 100; required 50");
    await expect(page.locator("#debug-log")).toContainText("(no d20 roll)");
    if ((await page.locator("#debug-state").textContent())?.includes("BATTLE")) {
      await debugCommand(page, "/kill");
      await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
      await expect(page.locator("#dice-presentation")).toBeHidden();
    } else {
      expect(view.text).toContain("Score 100; required 50");
      const bounds = view.bounds;
      if (!bounds || bounds.height <= 0) {
        throw new Error("No visible transient gathering result");
      }
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
      await expect(page.locator("#dice-presentation")).toBeHidden({ timeout: 5_000 });
      await expect(page.locator("#dice-result")).toBeEmpty();
    }
    pending = (await readSave(page)).player.progression.gathering.pending;
    expect(pending).toBeNull();
    await expect(page.locator("#dice-log, #battle-log")).toHaveCount(0);
  }
  await page.setViewportSize({ width: 932, height: 430 });
  await expect(page.locator("#dice-history")).toHaveCount(0);
  expect((await readSave(page)).player.progression.gathering.stats.mining.successes).toBe(1);
  expect(errors).toEqual([]);
});

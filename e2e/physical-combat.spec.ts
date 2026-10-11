import { expect, test, type Page } from "@playwright/test";
import { CUTSCENE_IDS, CAMPAIGN_EPILOGUE_CUTSCENE_ID } from "../src/data/cutscenes";
import { getItem } from "../src/data/items";
import { getMonster } from "../src/data/monsters";
import { createPlayer } from "../src/systems/player";
import { recruitCompanion } from "../src/systems/party";
import { createCodex, recordDefeat } from "../src/systems/codex";
import { createCurrentSaveData, SAVE_VERSION, type SaveData } from "../src/systems/save";
import { normalizeGamePreferences, type TextScale } from "../src/systems/accessibility";
import { createWeatherState } from "../src/systems/weather";
import { auditLayout, type LayoutRect } from "../src/systems/layout";
import { clickLayoutItem, expectCleanLayout, tapLayoutItem } from "./helpers/layout";

type CombatGamepadWindow = Window & {
  __combatPadButton?: (index: number, pressed: boolean) => void;
};

async function holdKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(90);
  await page.keyboard.up(key);
  await page.waitForTimeout(100);
}

async function pressGamepad(page: Page, index: number): Promise<void> {
  await page.evaluate((button) => new Promise<void>((resolve) => {
    const press = (window as CombatGamepadWindow).__combatPadButton;
    if (!press) throw new Error("Missing mock gamepad");
    press(button, true);
    window.requestAnimationFrame(() => {
      press(button, false);
      resolve();
    });
  }), index);
  await page.waitForTimeout(100);
}

async function readSave(page: Page): Promise<SaveData> {
  return page.evaluate(() => {
    const raw = localStorage.getItem("2dnd_save");
    if (!raw) throw new Error("Missing physical combat campaign");
    return JSON.parse(raw) as SaveData;
  });
}

async function debugCommand(page: Page, command: string): Promise<void> {
  if (!await page.locator("#debug-checkbox").isChecked()) await page.locator("#debug-checkbox").check();
  await page.locator("#debug-cmd").evaluate((element, value) => {
    const input = element as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Enter", code: "Enter", bubbles: true,
    }));
    input.blur();
  }, command);
}

async function enterBattle(page: Page, monster: string): Promise<void> {
  await debugCommand(page, `/spawn ${monster}`);
  await expect(page.locator("#debug-state")).toContainText("BATTLE | Phase: playerTurn");
}

async function endBattle(page: Page): Promise<void> {
  await debugCommand(page, "/kill");
  await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
  await expect(page.locator("#battle-body-accessibility")).toHaveCount(0);
}

async function seedCampaign(
  page: Page,
  textScale: TextScale = 1,
  weaponId = "startMace",
  companion = false,
): Promise<string[]> {
  const player = createPlayer("Combat browser fixture", {
    strength: 10, dexterity: 14, constitution: 12,
    intelligence: 12, wisdom: 12, charisma: 10,
  });
  player.stats.strength = 12;
  player.hp = player.maxHp = 500;
  player.mp = player.maxMp = 100;
  player.knownTalents = [];
  const weapon = { ...getItem(weaponId)!, effect: 0 };
  player.inventory.push(weapon);
  player.equippedWeapon = weapon;
  player.equippedOffHand = null;
  player.progression.tutorial.completed = true;
  player.progression.seenCutsceneIds = CUTSCENE_IDS.filter((id) => id !== CAMPAIGN_EPILOGUE_CUTSCENE_ID);
  player.progression.pendingCutsceneIds = [];
  if (companion) {
    recruitCompanion(player, "guardian");
    const guardian = player.party.companions[0]!;
    guardian.controlMode = "manual";
    guardian.hp = guardian.maxHp = 300;
  }
  const codex = createCodex();
  for (const id of ["skeleton", "dragon", "swampHydra", "kraken"]) {
    recordDefeat(codex, getMonster(id)!, false, []);
  }
  const save = createCurrentSaveData(player, new Set(), codex, player.appearanceId, 90, createWeatherState());
  const preferences = normalizeGamePreferences({
    audio: { muted: true },
    accessibility: { textScale, highContrast: textScale === 1.5, reducedMotion: true },
    controls: { touchControls: "on" },
    dice: { speed: "instant", frequency: "all" },
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.addInitScript(({ campaign, settings }) => {
    if (!sessionStorage.getItem("physicalCombatInitialized")) {
      sessionStorage.setItem("physicalCombatInitialized", "true");
      localStorage.clear();
      localStorage.setItem("2dnd_save", campaign);
      localStorage.setItem("2dnd_preferences", JSON.stringify(settings));
    }
    let seed = 0x22b0d1;
    Math.random = () => {
      const stack = new Error().stack ?? "";
      if (stack.includes("playerAttack") && stack.includes("rollCombatD20")) return 0.999;
      if (stack.includes("playerAttack") && stack.includes("rollDiceDetailed")) return 0.5;
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x1_0000_0000;
    };
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
    const pad = {
      id: "Mock combat gamepad", index: 0, connected: true, mapping: "standard",
      timestamp: 0, buttons, axes: [0, 0, 0, 0],
    };
    Object.defineProperty(navigator, "getGamepads", { configurable: true, value: () => [pad] });
    Object.defineProperty(window, "__combatPadButton", {
      value: (index: number, pressed: boolean) => {
        buttons[index] = { pressed, touched: pressed, value: pressed ? 1 : 0 };
        pad.timestamp++;
      },
    });
  }, { campaign: JSON.stringify(save), settings: preferences });
  await page.goto("game.html", { waitUntil: "networkidle" });
  await expect(page.locator("#debug-state")).toContainText("BOOT | Screen: title");
  await holdKey(page, "Enter");
  await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
  return errors;
}

test.use({ hasTouch: true });

for (const scale of [1, 1.25, 1.5] as const) {
  test(`aimed physical attacks, cancellation and saved discoveries at ${scale * 100}% text`, async ({ page }) => {
    const errors = await seedCampaign(page, scale);
    await enterBattle(page, "skeleton");
    await clickLayoutItem(page, "battle-action-attack");
    await expectCleanLayout(page);
    await clickLayoutItem(page, "battle-aim-parts");
    await expect(page.locator("#battle-body-accessibility")).toBeAttached();
    await expectCleanLayout(page);
    await expect(page.locator('[data-body-part="head"]')).toContainText("Defense unknown");
    for (let step = 0; step < 3; step++) {
      await holdKey(page, "ArrowDown");
      await expectCleanLayout(page);
    }
    await expect(page.locator("#game-container canvas")).toHaveAttribute("data-body-target", /"selectedId":"arms"/);
    await holdKey(page, "Enter");
    await expect(page.locator("#battle-body-accessibility")).toHaveCount(0);
    await expect(page.locator("#debug-log")).toContainText(/(?:hits|strikes) arms/);
    await expect(page.locator("#debug-log")).toContainText("Weakened!");
    await expect(page.locator("#debug-log")).toContainText("weak to Bludgeoning");
    await endBattle(page);
    const saved = await readSave(page);
    expect(saved.version).toBe(SAVE_VERSION);
    expect(saved.codex.entries.skeleton!.discoveredPhysical).toContainEqual({
      damageType: "bludgeoning", bodyPartId: "arms",
    });
    expect(saved.player.activeEffects).toEqual([]);
    await page.reload({ waitUntil: "networkidle" });
    await holdKey(page, "Enter");
    await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
    await enterBattle(page, "skeleton");
    await clickLayoutItem(page, "battle-action-attack");
    await clickLayoutItem(page, "battle-aim-parts");
    await expect(page.locator('[data-body-part="arms"]')).toContainText("Weakness x2");
    const beforeCancel = await readSave(page);
    await holdKey(page, "Escape");
    await expect(page.locator("#battle-body-accessibility")).toHaveCount(0);
    await expect(page.locator("#debug-state")).toContainText("Phase: playerTurn");
    await holdKey(page, "Escape");
    expect((await readSave(page)).player.inventory).toEqual(beforeCancel.player.inventory);
    expect((await readSave(page)).player.mp).toBe(beforeCancel.player.mp);
    await endBattle(page);
    if (scale === 1.5) {
      await holdKey(page, "c");
      await expect(page.locator("#debug-state")).toContainText("CODEX");
      await holdKey(page, "/");
      await page.locator("#mobile-text-input input").fill("skeleton");
      await page.locator("#mobile-text-input input").press("Enter");
      for (let attempt = 0; attempt < 4; attempt++) {
        const state = await page.locator("#debug-state").textContent() ?? "";
        if (state.includes("Selected: skeleton ")) break;
        await holdKey(page, "ArrowDown");
      }
      await expect(page.locator("#debug-state")).toContainText("Selected: skeleton");
      const pages: string[] = [];
      for (let attempt = 0; attempt < 6; attempt++) {
        await expectCleanLayout(page);
        const detail = await page.locator("#game-container canvas").evaluate((element) => {
          const raw = (element as HTMLCanvasElement).dataset.codexDetail;
          if (!raw) throw new Error("Missing Codex detail evidence");
          return JSON.parse(raw) as { page: number; total: number; text: string };
        });
        pages.push(detail.text);
        if (detail.page === detail.total - 1) break;
        await holdKey(page, "PageDown");
      }
      expect(pages.join(" ").replace(/\s+/g, " ")).toContain("Observed physical defenses:");
      expect(pages.join(" ").replace(/\s+/g, " ")).toContain("Arms: Weak to Bludgeoning");
      await holdKey(page, "Escape");
      await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
    }
    expect(errors).toEqual([]);
  });
}

test("keeps whole-target attack confirmation unchanged and has no parts for amorphous foes", async ({ page }) => {
  const errors = await seedCampaign(page);
  await enterBattle(page, "skeleton");
  await clickLayoutItem(page, "battle-action-attack");
  await holdKey(page, "Enter");
  await expect(page.locator("#debug-log")).toContainText("weak to Bludgeoning");
  await expect(page.locator("#battle-body-accessibility")).toHaveCount(0);
  await endBattle(page);
  await enterBattle(page, "slime");
  await clickLayoutItem(page, "battle-action-attack");
  await expect(page.locator("#battle-body-accessibility")).toHaveCount(0);
  await expect.poll(async () => {
    const report = JSON.parse(await page.locator("#layout-report").textContent() ?? "{}");
    return Object.values(report.groups as Record<string, { items: { id: string }[] }>)
      .flatMap((group) => group.items).some((item) => item.id === "battle-aim-parts");
  }).toBe(false);
  await endBattle(page);
  expect(errors).toEqual([]);
});

test("supports controller aiming and different dragon, Hydra and Kraken parts", async ({ page }) => {
  const errors = await seedCampaign(page, 1.5, "startSword");
  await enterBattle(page, "dragon");
  await pressGamepad(page, 0);
  await pressGamepad(page, 13);
  await expect(page.locator("#battle-body-accessibility")).toBeAttached();
  for (const selected of ["head", "body", "wings"]) {
    await pressGamepad(page, 13);
    await expect(page.locator("#game-container canvas"))
      .toHaveAttribute("data-body-target", new RegExp(`"selectedId":"${selected}"`));
  }
  await expect(page.locator("#game-container canvas")).toHaveAttribute("data-body-target", /"selectedId":"wings"/);
  await expectCleanLayout(page);
  const aiming = await page.locator("#game-container canvas").evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    if (!canvas.dataset.bodyTarget || !canvas.dataset.bodyTargetMarker) {
      throw new Error("Missing aimed-part geometry");
    }
    return {
      pane: (JSON.parse(canvas.dataset.bodyTarget) as { pane: LayoutRect }).pane,
      marker: JSON.parse(canvas.dataset.bodyTargetMarker) as LayoutRect,
    };
  });
  expect(auditLayout([
    { id: "body-pane", bounds: aiming.pane }, { id: "part-marker", bounds: aiming.marker },
  ]).overlaps).toEqual([]);
  await pressGamepad(page, 0);
  await expect(page.locator("#debug-log")).toContainText(/(?:hits|strikes) wings/);
  await expect(page.locator("#debug-log")).toContainText("Prone!");
  await endBattle(page);
  expect((await readSave(page)).codex.entries.dragon!.discoveredPhysical).toContainEqual({
    damageType: "slashing", bodyPartId: "wings",
  });
  await enterBattle(page, "swampHydra");
  await clickLayoutItem(page, "battle-action-attack");
  await clickLayoutItem(page, "battle-aim-parts");
  for (let step = 0; step < 5; step++) {
    await holdKey(page, "ArrowDown");
    await expectCleanLayout(page);
  }
  await expect(page.locator("#game-container canvas")).toHaveAttribute("data-body-target", /"selectedId":"headFive"/);
  await holdKey(page, "Enter");
  await expect(page.locator("#debug-log")).toContainText(/(?:hits|strikes) fifth head/);
  await endBattle(page);
  await enterBattle(page, "kraken");
  await clickLayoutItem(page, "battle-action-attack");
  await tapLayoutItem(page, "battle-aim-parts");
  await tapLayoutItem(page, "battle-body-next");
  await expectCleanLayout(page);
  await tapLayoutItem(page, "battle-body-tentacles");
  await expect(page.locator("#debug-log")).toContainText(/(?:hits|strikes) tentacles/);
  await endBattle(page);
  expect(errors).toEqual([]);
});

test("manual companions use the same aimed strike and return safely to exploration", async ({ page }) => {
  const errors = await seedCampaign(page, 1.5, "startMace", true);
  await enterBattle(page, "kraken");
  await clickLayoutItem(page, "battle-action-defend");
  const canvas = page.locator("#game-container canvas");
  await expect(canvas).toHaveAttribute("data-companion-menu", /Bram Ironward/);
  await expectCleanLayout(page);
  await holdKey(page, "Enter");
  await expect(canvas).toHaveAttribute("data-companion-menu", "Choose Target");
  await expectCleanLayout(page);
  await holdKey(page, "ArrowDown");
  await expect(canvas).toHaveAttribute("data-companion-selection", /Aim parts/);
  await holdKey(page, "Enter");
  await expect(page.locator("#battle-body-accessibility")).toBeAttached();
  for (let step = 0; step < 3; step++) await holdKey(page, "ArrowDown");
  await expect(canvas).toHaveAttribute("data-body-target", /"selectedId":"tentacles"/);
  await expectCleanLayout(page);
  await holdKey(page, "Enter");
  await expect(page.locator("#debug-log")).toContainText(/(?:hits|strikes) tentacles/);
  await expect(page.locator("#battle-body-accessibility")).toHaveCount(0);
  await endBattle(page);
  expect((await readSave(page)).codex.entries.kraken!.discoveredPhysical).toContainEqual({
    damageType: "slashing", bodyPartId: "tentacles",
  });
  expect(errors).toEqual([]);
});

test("losing focus cancels held aim confirmation without consuming the action", async ({ page }) => {
  const errors = await seedCampaign(page);
  await enterBattle(page, "skeleton");
  await clickLayoutItem(page, "battle-action-attack");
  await clickLayoutItem(page, "battle-aim-parts");
  await holdKey(page, "ArrowDown");
  await page.keyboard.down("Enter");
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.keyboard.up("Enter");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator("#battle-body-accessibility")).toBeAttached();
  await expect(page.locator("#debug-state")).toContainText("Phase: playerTurn");
  await expect(page.locator("#debug-log")).not.toContainText(/(?:hits|strikes) head/);
  await holdKey(page, "Escape");
  await holdKey(page, "Escape");
  await endBattle(page);
  expect(errors).toEqual([]);
});

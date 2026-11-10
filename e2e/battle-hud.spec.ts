import { expect, test, type Page } from "@playwright/test";
import { CUTSCENE_IDS } from "../src/data/cutscenes";
import { getMonster } from "../src/data/monsters";
import { MONSTER_GROUP_TEMPLATES } from "../src/data/monsterGroups";
import { getSpell } from "../src/data/spells";
import { getItem } from "../src/data/items";
import { createHeroClassProgression, getAvailableProgressionGrants } from "../src/systems/classProgression";
import { recordDefeat } from "../src/systems/codex";
import { createCompanionState } from "../src/systems/party";
import { xpForLevel } from "../src/systems/player";
import { applyStatusEffect } from "../src/systems/statusEffects";
import { BATTLE_HUD_ACTION_IDS } from "../src/systems/battleHud";
import { pressGameKey } from "./helpers/input";
import { clickLayoutItem, expectCleanLayout, readLayoutReport, tapLayoutItem, waitForGameInputFrame } from "./helpers/layout";
import {
  installMinigameGamepad, minigameBrowserErrors, minigameFixture, minigamePad,
  minigameTouchControl, seedMinigamePage,
} from "./helpers/minigames";

function fixture(party: boolean): ReturnType<typeof minigameFixture> {
  const save = minigameFixture("willowdaleRange");
  const player = save.player;
  player.name = "HUD Adventurer";
  player.level = 5;
  player.xp = xpForLevel(5);
  player.stats.strength = 15;
  player.stats.intelligence = 17;
  player.stats.wisdom = 15;
  player.classProgression = createHeroClassProgression("knight", 1);
  player.classProgression.classLevels = { knight: 1, wizard: 4 };
  const grants = getAvailableProgressionGrants(player);
  player.knownAbilities = [...grants.abilities];
  player.knownSpells = [...grants.spells];
  player.maxHp = 500;
  player.hp = 480;
  player.mp = player.maxMp = 100;
  player.progression.seenCutsceneIds = [...CUTSCENE_IDS];
  player.progression.pendingCutsceneIds = [];
  if (party) {
    for (const id of ["guardian", "scout", "mystic"] as const) {
      player.party.companions.push(createCompanionState(id, player.level));
      player.party.activeCompanionIds.push(id);
    }
  }
  return save;
}

async function command(page: Page, value: string): Promise<void> {
  if (!await page.locator("#debug-checkbox").isChecked()) await page.locator("#debug-checkbox").check();
  await page.locator("#debug-cmd").evaluate((element, text) => {
    if (!(element instanceof HTMLInputElement)) throw new Error("Missing debug setup.");
    element.value = text;
    element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
    element.blur();
  }, value);
  await waitForGameInputFrame(page);
}

for (const textScale of [1, 1.25, 1.5] as const) {
  test(`battle icons and resource bars remain distinct and private at ${textScale * 100}% text`, async ({ page }) => {
    const errors = minigameBrowserErrors(page);
    const save = fixture(true);
    recordDefeat(save.codex, getMonster("goblin")!, false, []);
    await page.goto("game.html", { waitUntil: "domcontentloaded" });
    await seedMinigamePage(page, save, "keyboard", { reducedMotion: true, textScale, highContrast: textScale === 1.5 });
    await command(page, "/battleview goblinRaidingParty forest day clear");
    await expect(page.locator("#debug-state")).toContainText("Phase: playerTurn");
    await expect(page.locator("#battle-vitals meter[data-resource='HP']")).toHaveCount(4);
    await expect(page.locator("#battle-vitals meter[data-resource='MP']")).toHaveCount(4);
    const enemies = page.locator("#battle-vitals [data-side='enemy']");
    await expect(enemies).toHaveCount(0);
    await expect(page.locator("#battle-turn-order li")).toHaveCount(7);
    await expect(page.locator("#battle-turn-order [aria-current='step']")).toHaveText(`Now: ${save.player.name}`);
    for (const action of BATTLE_HUD_ACTION_IDS) {
      await expect(page.locator(`#battle-vitals button[data-battle-action='${action}']`)).toBeEnabled();
    }
    const report = await readLayoutReport(page);
    const items = Object.values(report.groups).flatMap((group) => group.items);
    for (const action of BATTLE_HUD_ACTION_IDS) {
      const icon = items.find((item) => item.id === `battle-action-${action}-icon`);
      expect(icon?.bounds.width).toBe(16);
      expect(icon?.bounds.height).toBe(16);
    }
    expect(items.filter((item) => item.id.endsWith("-bar")).length).toBe(8);
    expect(items.filter((item) => item.id.endsWith("-portrait"))).toHaveLength(4);
    const timeline = report.groups["battle-turn-order"]!.items.filter((item) => item.id.startsWith("turn-order-")
      && !item.id.startsWith("turn-order-letter-"));
    expect(timeline).toHaveLength(7);
    expect(timeline.every(({ bounds }) => bounds.width <= 30 && bounds.height <= 30)).toBe(true);
    await expectCleanLayout(page);
    const path = test.info().outputPath(`battle-hud-${textScale * 100}.png`);
    await page.locator("#game-inner").screenshot({ path });
    await test.info().attach("battle-hud", { path, contentType: "image/png" });
    const before = await page.evaluate(() => localStorage.getItem("2dnd_save"));
    await pressGameKey(page, "U");
    await expect(page.locator("#game-container canvas")).toHaveAttribute("data-battle-vitals-mode", "compact");
    await expectCleanLayout(page);
    expect(await page.evaluate(() => localStorage.getItem("2dnd_save"))).toBe(before);
    await expect(page.locator("#battle-vitals [data-side='party'] meter")).toHaveCount(8);
    await pressGameKey(page, "U");
    await expect(page.locator("#game-container canvas")).toHaveAttribute("data-battle-vitals-mode", "expanded");
    await clickLayoutItem(page, "battle-action-items");
    await expectCleanLayout(page);
    await clickLayoutItem(page, "battle-item-category-next");
    await expectCleanLayout(page);
    await clickLayoutItem(page, "battle-item-category-next");
    await expectCleanLayout(page);
    await pressGameKey(page, "Escape");
    await command(page, "/kill");
    await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
    await expect(page.locator("#battle-vitals")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test("resource bars update from actual status damage and spell costs without exposing unknown HP", async ({ page }) => {
  const errors = minigameBrowserErrors(page);
  const save = fixture(false);
  expect(applyStatusEffect(save.player.activeEffects, "poison", "HUD damage fixture", 4).applied).toBe(true);
  await page.goto("game.html", { waitUntil: "domcontentloaded" });
  await seedMinigamePage(page, save, "keyboard", { reducedMotion: false, textScale: 1.5, highContrast: false });
  await command(page, "/spawn troll");
  await expect(page.locator("#debug-state")).toContainText("Phase: playerTurn");
  await expect(page.locator("#battle-vitals [data-side='enemy'] meter")).toHaveCount(0);
  const mana = page.getByRole("meter", { name: /HUD Adventurer.*mana/ });
  await expect(mana).toHaveAttribute("value", "100");
  await clickLayoutItem(page, "battle-action-spells");
  await clickLayoutItem(page, "battle-spell-magicMissile");
  await pressGameKey(page, "Enter");
  await expect(mana).toHaveAttribute("value", String(100 - getSpell("magicMissile")!.mpCost));
  await expect(page.locator("#battle-vitals [data-side='enemy']")).toHaveCount(0);
  await expect(page.locator("#battle-vitals [data-side='enemy'] meter")).toHaveCount(0);
  await expectCleanLayout(page);
  await expect(page.locator("#debug-state")).toContainText("Phase: playerTurn");
  const health = page.getByRole("meter", { name: /HUD Adventurer.*health/ });
  await expect.poll(async () => Number(await health.getAttribute("value"))).toBeLessThan(save.player.hp);
  await expectCleanLayout(page);
  await command(page, "/kill");
  await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
  await expect(page.locator("#battle-vitals")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("the largest known enemy group and full party fit at enlarged high-contrast text", async ({ page }) => {
  const errors = minigameBrowserErrors(page);
  const save = fixture(true);
  save.player.name = "ABCDEFGHIJKLMNOPQRST";
  const group = MONSTER_GROUP_TEMPLATES.reduce((largest, entry) =>
    entry.members.length > largest.members.length ? entry : largest);
  for (const member of group.members) {
    recordDefeat(save.codex, getMonster(member.monsterId)!, false, []);
  }
  await page.goto("game.html", { waitUntil: "domcontentloaded" });
  await seedMinigamePage(page, save, "keyboard", { reducedMotion: true, textScale: 1.5, highContrast: true });
  await command(page, `/battleview ${group.id} forest day clear`);
  await expect(page.locator("#debug-state")).toContainText("Phase: playerTurn");
  await expect(page.locator("#battle-vitals [data-side='enemy'] meter")).toHaveCount(0);
  await expect(page.locator("#battle-vitals [data-side='party'] meter")).toHaveCount(8);
  await expect(page.locator("#battle-turn-order li")).toHaveCount(4 + group.members.length);
  await expectCleanLayout(page);
  const path = test.info().outputPath("full-battle-hud-150.png");
  await page.locator("#game-inner").screenshot({ path });
  await test.info().attach("full-battle-hud", { path, contentType: "image/png" });
  await command(page, "/kill");
  await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
  expect(errors).toEqual([]);
});

test("known monster health appears only while targeting its hovered or keyboard-focused body", async ({ page }) => {
  const errors = minigameBrowserErrors(page);
  const save = fixture(false);
  recordDefeat(save.codex, getMonster("goblin")!, false, []);
  await page.goto("game.html", { waitUntil: "domcontentloaded" });
  await seedMinigamePage(page, save, "keyboard", { reducedMotion: true, textScale: 1.5 });
  await command(page, "/battleview goblinRaidingParty forest day clear");
  await expect(page.locator("#debug-state")).toContainText("Phase: playerTurn");
  const enemyMeters = page.locator("#battle-vitals [data-side='enemy'] meter");
  await expect(enemyMeters).toHaveCount(0);
  await clickLayoutItem(page, "battle-action-spells");
  await clickLayoutItem(page, "battle-spell-magicMissile");
  await pressGameKey(page, "ArrowRight");
  await expect(enemyMeters).toHaveCount(1);
  await expect(enemyMeters).toHaveAttribute("aria-label", "Goblin B health");
  await pressGameKey(page, "ArrowRight");
  await expect(enemyMeters).toHaveCount(0);
  await pressGameKey(page, "ArrowLeft");
  const canvas = page.locator("#game-container canvas");
  const raw = await canvas.getAttribute("data-body-target-marker");
  if (!raw) throw new Error("Missing actual target marker bounds.");
  const marker = JSON.parse(raw) as { x: number; y: number; width: number; height: number };
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Missing actual canvas bounds.");
  await page.mouse.move(bounds.x + (marker.x + marker.width / 2) / 640 * bounds.width,
    bounds.y + (marker.y + marker.height + 24) / 528 * bounds.height);
  await expect(enemyMeters).toHaveCount(1);
  await page.mouse.move(bounds.x + 3, bounds.y + 3);
  await expect(enemyMeters).toHaveCount(0);
  await pressGameKey(page, "Escape");
  await expect(enemyMeters).toHaveCount(0);
  await command(page, "/kill");
  await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
  expect(errors).toEqual([]);
});

test("commands leave the battlefield during actual attack presentation and return for the next choice", async ({ page }) => {
  const errors = minigameBrowserErrors(page);
  await page.goto("game.html", { waitUntil: "domcontentloaded" });
  await seedMinigamePage(page, fixture(false), "keyboard", { reducedMotion: false, textScale: 1.5 });
  await command(page, "/spawn troll");
  const canvas = page.locator("#game-container canvas");
  await expect(canvas).toHaveAttribute("data-battle-commands-visible", "true");
  await clickLayoutItem(page, "battle-action-attack");
  await pressGameKey(page, "Enter");
  await expect(canvas).toHaveAttribute("data-battle-presentation-active", "true");
  await expect(canvas).toHaveAttribute("data-battle-commands-visible", "false");
  for (const action of BATTLE_HUD_ACTION_IDS) {
    await expect(page.locator(`#battle-vitals button[data-battle-action='${action}']`)).toBeDisabled();
  }
  await expect(canvas).toHaveAttribute("data-battle-commands-visible", "true");
  await expect(canvas).toHaveAttribute("data-battle-presentation-active", "false");
  await command(page, "/kill");
  await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
  expect(errors).toEqual([]);
});

test("latest action feedback fades while the complete log remains available without spending a timed decision", async ({ page }) => {
  const errors = minigameBrowserErrors(page);
  const save = fixture(false);
  save.player.battleTiming.mode = "timed";
  await page.goto("game.html", { waitUntil: "domcontentloaded" });
  await seedMinigamePage(page, save, "keyboard", { reducedMotion: true, textScale: 1.5 });
  await command(page, "/spawn troll");
  const canvas = page.locator("#game-container canvas");
  await expect(canvas).toHaveAttribute("data-battle-commands-visible", "true");
  await clickLayoutItem(page, "battle-action-defend");
  await expect(canvas).toHaveAttribute("data-battle-notice-visible", "true");
  await expect(canvas).toHaveAttribute("data-battle-commands-visible", "true");
  const count = await page.locator("#battle-log li").count();
  expect(count).toBeGreaterThan(0);
  await expect(canvas).toHaveAttribute("data-battle-notice-visible", "false", { timeout: 6000 });
  expect(await page.locator("#battle-log li").count()).toBeGreaterThanOrEqual(count);
  await pressGameKey(page, "J");
  await expect(page.getByRole("dialog", { name: "Battle log history" })).toHaveCount(1);
  await expect(page.locator("#dice-roll-stage")).toBeHidden();
  await expect(page.locator("#debug-state")).toContainText("[TIMING:paused:");
  const remaining = await canvas.getAttribute("data-battle-timing-remaining-ms");
  await waitForGameInputFrame(page);
  expect(await canvas.getAttribute("data-battle-timing-remaining-ms")).toBe(remaining);
  await clickLayoutItem(page, "battle-vitals-toggle");
  await expect(canvas).toHaveAttribute("data-battle-vitals-mode", "expanded");
  await expectCleanLayout(page);
  const historyPath = test.info().outputPath("battle-history-150.png");
  await page.locator("#game-inner").screenshot({ path: historyPath });
  await test.info().attach("Battle history", { path: historyPath, contentType: "image/png" });
  await pressGameKey(page, "Escape");
  await expect(canvas).toHaveAttribute("data-battle-commands-visible", "true");
  await command(page, "/kill");
  await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
  expect(errors).toEqual([]);
});

for (const source of ["touch", "gamepad"] as const) {
  test(`portrait vitals and full history use the shared ${source} controls`, async ({ page }) => {
    const errors = minigameBrowserErrors(page);
    if (source === "gamepad") await installMinigameGamepad(page);
    else await page.setViewportSize({ width: 844, height: 390 });
    await page.goto("game.html", { waitUntil: "domcontentloaded" });
    await seedMinigamePage(page, fixture(true), source, { reducedMotion: true, textScale: 1.5 });
    await command(page, "/battleview goblinRaidingParty forest day clear");
    const canvas = page.locator("#game-container canvas");
    await expect(canvas).toHaveAttribute("data-battle-commands-visible", "true");
    if (source === "gamepad") await minigamePad(page, 8);
    else await minigameTouchControl(page, "battleToggleVitals");
    await expect(canvas).toHaveAttribute("data-battle-vitals-mode", "compact");
    await expectCleanLayout(page);
    if (source === "gamepad") await minigamePad(page, 9);
    else await minigameTouchControl(page, "battleToggleLog");
    await expect(page.getByRole("dialog", { name: "Battle log history" })).toHaveCount(1);
    if (source === "gamepad") await minigamePad(page, 0);
    else await minigameTouchControl(page, "cancel");
    await expect(page.getByRole("dialog", { name: "Battle log history" })).toHaveCount(0);
    await expect(canvas).toHaveAttribute("data-battle-commands-visible", "true");
    await command(page, "/kill");
    await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
    await command(page, "/spawn troll");
    await expect(canvas).toHaveAttribute("data-battle-vitals-mode", "compact");
    await command(page, "/kill");
    await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
    expect(errors).toEqual([]);
  });
}

test("a held touch previews a known target without spending MP until the matching release", async ({ page }) => {
  const errors = minigameBrowserErrors(page);
  const save = fixture(false);
  recordDefeat(save.codex, getMonster("goblin")!, false, []);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("game.html", { waitUntil: "domcontentloaded" });
  await seedMinigamePage(page, save, "touch", { reducedMotion: true, textScale: 1.5 });
  await command(page, "/battleview goblinRaidingParty forest day clear");
  await tapLayoutItem(page, "battle-action-spells");
  await tapLayoutItem(page, "battle-spell-magicMissile");
  const canvas = page.locator("#game-container canvas");
  const raw = await canvas.getAttribute("data-body-target-marker");
  if (!raw) throw new Error("Missing actual target marker.");
  const marker = JSON.parse(raw) as { x: number; y: number; width: number; height: number };
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Missing actual canvas bounds.");
  const protocol = await page.context().newCDPSession(page);
  try {
    await protocol.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
    await protocol.send("Input.dispatchTouchEvent", {
      type: "touchStart", touchPoints: [{
        x: bounds.x + (marker.x + marker.width / 2) / 640 * bounds.width,
        y: bounds.y + (marker.y + marker.height + 24) / 528 * bounds.height, id: 1,
      }],
    });
    await waitForGameInputFrame(page);
    const mana = page.getByRole("meter", { name: /HUD Adventurer.*mana/ });
    await expect(mana).toHaveAttribute("value", "100");
    await expect(page.locator("#battle-vitals [data-side='enemy'] meter")).toHaveCount(1);
    await protocol.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(mana).toHaveAttribute("value", String(100 - getSpell("magicMissile")!.mpCost));
    await expect(page.locator("#battle-vitals [data-side='enemy'] meter")).toHaveCount(0);
  } finally { await protocol.detach(); }
  await command(page, "/kill");
  await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
  expect(errors).toEqual([]);
});

test("manual companion target choices never print hidden enemy HP", async ({ page }) => {
  const errors = minigameBrowserErrors(page);
  const save = fixture(true);
  const guardian = save.player.party.companions.find(({ id }) => id === "guardian")!;
  guardian.controlMode = "manual";
  const bow = { ...getItem("huntingBow")! };
  guardian.inventory.push(bow);
  guardian.equippedWeapon = bow;
  guardian.equippedShield = null;
  save.player.party.activeCompanionIds = ["guardian"];
  recordDefeat(save.codex, getMonster("goblin")!, false, []);
  await page.goto("game.html", { waitUntil: "domcontentloaded" });
  await seedMinigamePage(page, save, "keyboard", { reducedMotion: true, textScale: 1.5 });
  await command(page, "/battleview goblinRaidingParty forest day clear");
  const canvas = page.locator("#game-container canvas");
  await expect.poll(async () => await canvas.getAttribute("data-companion-menu")
    || await canvas.getAttribute("data-battle-commands-visible") === "true").toBeTruthy();
  if (!await canvas.getAttribute("data-companion-menu")) await clickLayoutItem(page, "battle-action-defend");
  await expect(canvas).toHaveAttribute("data-companion-menu", /./);
  await clickLayoutItem(page, "battle-companion-attack");
  await expect(canvas).toHaveAttribute("data-companion-menu", "Choose Target");
  await expect(canvas).not.toHaveAttribute("data-companion-selection", /HP/);
  for (let row = 0; row < 8 && await canvas.getAttribute("data-companion-selection") !== "Orc Warrior"; row++) {
    await pressGameKey(page, "ArrowDown");
    await expect(canvas).not.toHaveAttribute("data-companion-selection", /HP/);
  }
  await expect(canvas).toHaveAttribute("data-companion-selection", "Orc Warrior");
  await expect(page.locator("#battle-vitals [data-side='enemy'] meter")).toHaveCount(0);
  await expectCleanLayout(page);
  await command(page, "/kill");
  await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
  expect(errors).toEqual([]);
});

test("a detached native command cannot act in a replacement battle", async ({ page }) => {
  const errors = minigameBrowserErrors(page);
  await page.goto("game.html", { waitUntil: "domcontentloaded" });
  await seedMinigamePage(page, fixture(false), "keyboard", { reducedMotion: true, highContrast: false });
  await command(page, "/spawn orc");
  await expect(page.locator("#debug-state")).toContainText("Phase: playerTurn");
  const oldAttack = await page.locator("#battle-vitals button[data-battle-action='attack']").elementHandle();
  if (!oldAttack) throw new Error("Missing native attack counterpart.");
  await command(page, "/kill");
  await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
  expect(await oldAttack.evaluate((button) => button.isConnected)).toBe(false);
  await command(page, "/battleview goblinRaidingParty forest day clear");
  await expect(page.locator("#debug-state")).toContainText("Phase: playerTurn");
  await oldAttack.evaluate((button) => button.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  await waitForGameInputFrame(page);
  const state = await page.locator("#debug-state").textContent() ?? "";
  expect(state).toContain("[TARGET:-]");
  expect(state).toContain("main-ready");
  await command(page, "/kill");
  await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
  await oldAttack.dispose();
  expect(errors).toEqual([]);
});

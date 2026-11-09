import { expect, test, type Page } from "@playwright/test";
import { CUTSCENE_IDS } from "../src/data/cutscenes";
import { getMonster } from "../src/data/monsters";
import { MONSTER_GROUP_TEMPLATES } from "../src/data/monsterGroups";
import { getSpell } from "../src/data/spells";
import { createHeroClassProgression, getAvailableProgressionGrants } from "../src/systems/classProgression";
import { recordDefeat } from "../src/systems/codex";
import { createCompanionState } from "../src/systems/party";
import { xpForLevel } from "../src/systems/player";
import { applyStatusEffect } from "../src/systems/statusEffects";
import { BATTLE_HUD_ACTION_IDS } from "../src/systems/battleHud";
import { pressGameKey } from "./helpers/input";
import { clickLayoutItem, expectCleanLayout, readLayoutReport, waitForGameInputFrame } from "./helpers/layout";
import { minigameBrowserErrors, minigameFixture, seedMinigamePage } from "./helpers/minigames";

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
    await expect(page.locator("#battle-vitals meter[data-resource='HP']")).toHaveCount(6);
    await expect(page.locator("#battle-vitals meter[data-resource='MP']")).toHaveCount(4);
    const unknown = page.locator("#battle-vitals [data-side='enemy']").filter({ hasText: "Orc Warrior" });
    await expect(unknown).toHaveText("Orc Warrior");
    await expect(unknown.locator("meter")).toHaveCount(0);
    const enemies = page.locator("#battle-vitals [data-side='enemy']");
    await expect(enemies).toHaveCount(3);
    await expect(enemies.filter({ hasText: "Goblin A" }).locator("meter")).toHaveCount(1);
    await expect(enemies.filter({ hasText: "Goblin B" }).locator("meter")).toHaveCount(1);
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
    expect(items.filter((item) => item.id.endsWith("-bar")).length).toBeGreaterThanOrEqual(10);
    await expectCleanLayout(page);
    const path = test.info().outputPath(`battle-hud-${textScale * 100}.png`);
    await page.locator("#game-inner").screenshot({ path });
    await test.info().attach("battle-hud", { path, contentType: "image/png" });
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
  await expect(page.locator("#battle-vitals [data-side='enemy']")).toHaveText("Cave Troll");
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
  await expect(page.locator("#battle-vitals [data-side='enemy'] meter")).toHaveCount(group.members.length);
  await expect(page.locator("#battle-vitals [data-side='party'] meter")).toHaveCount(8);
  await expectCleanLayout(page);
  const path = test.info().outputPath("full-battle-hud-150.png");
  await page.locator("#game-inner").screenshot({ path });
  await test.info().attach("full-battle-hud", { path, contentType: "image/png" });
  await command(page, "/kill");
  await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
  expect(errors).toEqual([]);
});

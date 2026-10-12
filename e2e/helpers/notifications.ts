import { expect, test, type Page } from "@playwright/test";
import { CUTSCENE_IDS } from "../../src/data/cutscenes";
import { CITIES } from "../../src/data/cities";
import { FEATURE_IDS } from "../../src/data/featureDiscovery";
import { createPlayer } from "../../src/systems/player";
import { createCodex } from "../../src/systems/codex";
import { reconcileAchievements, recordAchievementEvent } from "../../src/systems/achievements";
import { executeFeatureDiscoveryDebugCommand, getEscapeMenuEntries, reconcileFeatureDiscovery } from "../../src/systems/featureDiscovery";
import { createCurrentSaveData } from "../../src/systems/save";
import { createWeatherState } from "../../src/systems/weather";
import { clickLayoutItem, expectCleanLayout, readLayoutReport, tapLayoutItem } from "./layout";
import {
  installMinigameGamepad, minigameCancel, minigameKey, minigamePad,
  minigameTouchControl, readMinigameSave, seedMinigamePage, waitMinigameState,
} from "./minigames";
import type { AchievementState } from "../../src/systems/achievements";
import type { MinigameTestSource } from "./minigames";

export interface NoticeMenuFixture {
  achievements: AchievementState;
  menuItemIds: string[];
}

function noticeCampaign(): ReturnType<typeof createCurrentSaveData> {
  const player = createPlayer("Mock Notice", {
    strength: 15, dexterity: 15, constitution: 15,
    intelligence: 15, wisdom: 15, charisma: 15,
  }, "cleric");
  Object.assign(player.position, {
    inCity: true, cityId: "willowdale_city", cityChunkIndex: 0, x: 13, y: 12,
  });
  player.hp = Math.max(1, player.maxHp - 12);
  player.progression.tutorial.completed = true;
  player.progression.seenCutsceneIds = [...CUTSCENE_IDS];
  player.progression.discoveredCities = CITIES.map((city) => city.id);
  const codex = createCodex();
  const context = { player, codex, defeatedBosses: new Set<string>() };
  reconcileAchievements(context, { notify: false });
  recordAchievementEvent(player, {
    type: "battleResolved", sourceId: "fixture:menus:oneStroke",
    outcome: "victory", oneHitDefeats: 1, debug: false,
  });
  reconcileAchievements(context, { sourceId: "fixture:menus:oneStroke", unlockedAt: 100 });
  reconcileFeatureDiscovery(player, codex, { silent: true });
  for (const id of FEATURE_IDS) executeFeatureDiscoveryDebugCommand(player, `reveal ${id}`);
  return createCurrentSaveData(player, context.defeatedBosses, codex, player.appearanceId, 45, createWeatherState());
}

async function capture(page: Page, name: string): Promise<void> {
  const path = test.info().outputPath(`${name}.png`);
  await page.screenshot({ path });
  await test.info().attach(name, { path, contentType: "image/png" });
}

export async function prepareNoticeMenu(
  page: Page,
  source: MinigameTestSource,
  textScale: 1 | 1.25 | 1.5,
): Promise<NoticeMenuFixture> {
  if (source === "gamepad") await installMinigameGamepad(page);
  const campaign = noticeCampaign();
  expect(campaign.player.progression.achievements.pendingNotificationIds).toEqual(["singleStroke"]);
  await seedMinigamePage(page, campaign, source, { textScale, touchControls: "on" });
  await expect(page.locator("#achievement-notification-live-region")).toContainText("Single Stroke");
  await expect.poll(async () => (await readLayoutReport(page)).groups["achievement-notification"])
    .toMatchObject({ overlaps: [], clipping: [] });

  await minigameKey(page, "e");
  await expect(page.locator("#achievement-notification-live-region")).toHaveCount(0);
  await clickLayoutItem(page, "equip-skills-tab");
  await clickLayoutItem(page, "equip-spell-cureWounds");
  await expect(page.locator("#dice-presentation")).toBeVisible();
  const achievements = (await readMinigameSave(page)).player.progression.achievements;
  expect(achievements.pendingNotificationIds).toEqual(["singleStroke"]);
  await minigameKey(page, "e");
  if (source === "gamepad") await minigamePad(page, 9);
  else if (source === "touch") await minigameTouchControl(page, "openMenu");
  else await minigameKey(page, "Escape");
  await waitMinigameState(page, "[MENU]");
  const fixture = {
    achievements,
    menuItemIds: getEscapeMenuEntries(campaign.player).map((entry) => `escape-menu-${entry.action}`),
  };
  await expectNoticeDeferred(page, fixture);
  return fixture;
}

export async function expectNoticeDeferred(page: Page, fixture: NoticeMenuFixture): Promise<void> {
  await expect(page.locator("#achievement-notification-live-region")).toHaveCount(0);
  await expect(page.locator("#codex-discovery-notice-live-region")).toHaveCount(0);
  await expect.poll(async () => Object.keys((await readLayoutReport(page)).groups))
    .not.toContain("achievement-notification");
  await expect.poll(async () => (await readMinigameSave(page)).player.progression.achievements)
    .toEqual(fixture.achievements);
  await expectCleanLayout(page);
}

async function advanceMenu(page: Page, source: MinigameTestSource): Promise<void> {
  if (source === "touch") await tapLayoutItem(page, "escape-menu-page-next");
  else if (source === "gamepad") await minigamePad(page, 13);
  else await minigameKey(page, "ArrowDown");
}

export async function visitNoticeMenuPages(
  page: Page,
  source: MinigameTestSource,
  fixture: NoticeMenuFixture,
): Promise<void> {
  const seen = new Set<string>();
  for (let index = 0; index < fixture.menuItemIds.length * 2; index += 1) {
    const state = await page.locator("#debug-state").textContent() ?? "";
    const selected = state.match(/\[MENU_SELECTION:([a-zA-Z]+)/)?.[1];
    expect(selected).toBeDefined();
    await expect.poll(async () => (await readLayoutReport(page)).groups["escape-menu"]?.items.map((item) => item.id))
      .toContain(`escape-menu-${selected}`);
    const group = (await readLayoutReport(page)).groups["escape-menu"];
    group?.items.filter((item) => fixture.menuItemIds.includes(item.id))
      .forEach((item) => seen.add(item.id));
    await expectNoticeDeferred(page, fixture);
    if (seen.size === fixture.menuItemIds.length) break;
    await advanceMenu(page, source);
  }
  expect(seen).toEqual(new Set(fixture.menuItemIds));
}

export async function finishNoticeMenu(
  page: Page,
  source: MinigameTestSource,
  fixture: NoticeMenuFixture,
): Promise<void> {
  for (let index = 0; index < fixture.menuItemIds.length * 2; index += 1) {
    const group = (await readLayoutReport(page)).groups["escape-menu"];
    if (group?.items.some((item) => item.id === "escape-menu-settings")) break;
    await advanceMenu(page, source);
  }
  await clickLayoutItem(page, "escape-menu-settings");
  await expect.poll(async () => Object.keys((await readLayoutReport(page)).groups)).toContain("settings");
  await expectNoticeDeferred(page, fixture);
  await minigameCancel(page, source);
  const notice = page.locator("#achievement-notification-live-region");
  await expect(notice).toContainText("Single Stroke");
  await expect.poll(async () => (await readLayoutReport(page)).groups["achievement-notification"])
    .toMatchObject({ overlaps: [], clipping: [] });
  await capture(page, "achievement-notice-resumed");
  await expect(notice).toHaveCount(0);
  await expect.poll(async () => (await readMinigameSave(page)).player.progression.achievements)
    .toEqual({ ...fixture.achievements, pendingNotificationIds: [] });
  await expectCleanLayout(page);
}

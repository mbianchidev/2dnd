import { expect, test, type Page } from "@playwright/test";
import { CUTSCENE_IDS } from "../src/data/cutscenes";
import { getCity, getCityConnectionAt } from "../src/data/map";
import { getItem } from "../src/data/items";
import { getCityShopSkillCheckId, SHOP_NEGOTIATION_OPTIONS } from "../src/data/skillChecks";
import { reconcileFeatureDiscovery } from "../src/systems/featureDiscovery";
import { pressGameKey } from "./helpers/input";
import {
  clickLayoutItem, clickPointerAt, expectCleanLayout, layoutItemCenter, pressPointerAt,
  readLayoutReport, tapLayoutItem, waitForGameInputFrame,
} from "./helpers/layout";
import { minigameBrowserErrors, minigameFixture, readMinigameSave, seedMinigamePage } from "./helpers/minigames";

test.use({ hasTouch: true });

type PointerSource = "mouse" | "touch";

async function activate(page: Page, source: PointerSource, id: string): Promise<void> {
  if (source === "touch") await tapLayoutItem(page, id);
  else await clickLayoutItem(page, id);
}

async function expectMenu(page: Page, id: string, open = true): Promise<void> {
  await expect.poll(async () => (await readLayoutReport(page)).groups[id] !== undefined).toBe(open);
}

async function releaseFromAnotherControl(page: Page, fromId: string, toId: string | null): Promise<void> {
  const from = await layoutItemCenter(page, fromId);
  const to = toId ? await layoutItemCenter(page, toId) : { x: 2, y: 2 };
  const canvas = await page.locator("#game-container canvas").boundingBox();
  if (!canvas) throw new Error("Missing menu canvas.");
  await pressPointerAt(page, canvas.x + from.x / 640 * canvas.width, canvas.y + from.y / 528 * canvas.height);
  try {
    await page.mouse.move(canvas.x + to.x / 640 * canvas.width, canvas.y + to.y / 528 * canvas.height);
    await waitForGameInputFrame(page);
  } finally { await page.mouse.up(); }
  await waitForGameInputFrame(page);
}

async function setup(
  page: Page, source: PointerSource, textScale: 1 | 1.25 | 1.5, shop = true,
): Promise<{ shopCheckId: string; gold: number }> {
  const fixture = minigameFixture("willowdaleRange");
  fixture.player.progression.seenCutsceneIds = [...CUTSCENE_IDS];
  fixture.player.progression.minigames.discoveredVenueIds = ["willowdaleRange"];
  fixture.player.gold = 500;
  fixture.player.inventory.push({ ...getItem("potion")! }, { ...getItem("potion")! });
  const city = getCity("willowdale_city")!;
  const service = city.shops.find((entry) => entry.type === "general")!;
  const door = getCityConnectionAt(city, 0, service.x, service.y)!;
  if (shop) Object.assign(fixture.player.position, { cityChunkIndex: door.toChunkIndex, x: 10, y: 6 });
  reconcileFeatureDiscovery(fixture.player, fixture.codex, { silent: true });
  await page.goto("game.html", { waitUntil: "domcontentloaded" });
  await seedMinigamePage(page, fixture, source === "touch" ? "touch" : "keyboard", { textScale });
  if (shop) {
    await pressGameKey(page, "Space");
    await expect(page.locator("#debug-state")).toContainText("SHOP |");
    await expectMenu(page, "shop-chrome");
  }
  return { shopCheckId: getCityShopSkillCheckId(city.id, 0, service), gold: fixture.player.gold };
}

for (const source of ["mouse", "touch"] as const) {
  for (const textScale of [1, 1.25, 1.5] as const) {
    test(`Negotiate stays open after its ${source} gesture at ${textScale * 100}% text`, async ({ page }) => {
      const errors = minigameBrowserErrors(page);
      const fixture = await setup(page, source, textScale);
      await activate(page, source, "shop-negotiate");
      await expectMenu(page, "shop-negotiation");
      await activate(page, source, "shop-negotiation-0");
      await expectMenu(page, "shop-negotiation");
      await expectCleanLayout(page);
      expect((await readMinigameSave(page)).player.progression.skillChecks[fixture.shopCheckId]).toBeUndefined();
      await page.keyboard.down("Enter");
      try {
        await waitForGameInputFrame(page);
        await pressGameKey(page, "Escape");
        await expectMenu(page, "shop-negotiation", false);
      } finally { await page.keyboard.up("Enter"); }
      await expect(page.locator("#debug-state")).toContainText("SHOP |");
      await expect(page.locator("#debug-state")).toContainText(`Gold: ${fixture.gold}`);
      await activate(page, source, "shop-negotiate");
      await expectMenu(page, "shop-negotiation");
      await activate(page, source, "shop-negotiation-1");
      await expectMenu(page, "shop-negotiation", false);
      const saved = await readMinigameSave(page);
      expect(saved.player.progression.skillChecks[fixture.shopCheckId]?.optionId).toBe(SHOP_NEGOTIATION_OPTIONS[0]!.id);
      expect(saved.player.gold).toBe(fixture.gold);
      if (source === "mouse" && textScale === 1) {
        const potions = saved.player.inventory.filter((item) => item.id === "potion").length;
        await pressGameKey(page, "Enter");
        await expect(page.locator("#debug-state")).not.toContainText(`Gold: ${fixture.gold}`);
        await pressGameKey(page, "Escape");
        await expect(page.locator("#debug-state")).toContainText("OVERWORLD");
        await pressGameKey(page, "Escape");
        await clickLayoutItem(page, "escape-menu-quit");
        await expect(page.locator("#debug-state")).toContainText("BOOT | Screen: title");
        const purchased = await readMinigameSave(page);
        expect(purchased.player.inventory.filter((item) => item.id === "potion")).toHaveLength(potions + 1);
        expect(purchased.player.gold).toBeLessThan(fixture.gold);
      }
      expect(errors).toEqual([]);
    });
  }

  test(`sale and item-detail menus keep their opening ${source} gesture isolated`, async ({ page }) => {
    const errors = minigameBrowserErrors(page);
    const fixture = await setup(page, source, 1.5);
    await activate(page, source, "shop-item-potion-info");
    await expectMenu(page, "shop-item-details");
    await activate(page, source, "shop-item-details-title");
    await expectMenu(page, "shop-item-details");
    if (source === "mouse") {
      await releaseFromAnotherControl(page, "shop-item-details-title", "shop-item-details-close");
      await expectMenu(page, "shop-item-details");
    }
    await pressGameKey(page, "Escape");
    await expectMenu(page, "shop-item-details", false);
    await activate(page, source, "shop-sell");
    await activate(page, source, "shop-sell-potion");
    await expectMenu(page, "shop-sale");
    await activate(page, source, "shop-sale-0");
    await expectMenu(page, "shop-sale");
    await pressGameKey(page, "I");
    await expectMenu(page, "shop-item-details", false);
    await pressGameKey(page, "Escape");
    await expectMenu(page, "shop-sale", false);
    await expect(page.locator("#debug-state")).toContainText(`Gold: ${fixture.gold}`);
    expect(errors).toEqual([]);
  });

  test(`activity records do not close or start a run from the opening ${source} gesture`, async ({ page }) => {
    const errors = minigameBrowserErrors(page);
    const fixture = await setup(page, source, 1.5, false);
    await pressGameKey(page, "Escape");
    await activate(page, source, "escape-menu-minigames");
    await expect(page.locator("#debug-state")).toContainText("[MINIGAME_VIEW:records]");
    await activate(page, source, "minigame-title");
    await expect(page.locator("#debug-state")).toContainText("[MINIGAME_VIEW:records]");
    if (source === "mouse") {
      await releaseFromAnotherControl(page, "minigame-title", null);
      await expect(page.locator("#debug-state")).toContainText("[MINIGAME_VIEW:records]");
    }
    await expectCleanLayout(page);
    const saved = await readMinigameSave(page);
    expect(saved.player.progression.minigames.pending).toBeNull();
    expect(saved.player.gold).toBe(fixture.gold);
    if (source === "mouse") {
      const canvas = await page.locator("#game-container canvas").boundingBox();
      if (!canvas) throw new Error("Missing records canvas.");
      await clickPointerAt(page, canvas.x + 2 / 640 * canvas.width, canvas.y + 2 / 528 * canvas.height);
    } else await pressGameKey(page, "Escape");
    await expectMenu(page, "minigames", false);
    expect(errors).toEqual([]);
  });

  test(`difficulty remains open until an explicit ${source} or keyboard cancellation`, async ({ page }) => {
    const errors = minigameBrowserErrors(page);
    await setup(page, source, 1.5, false);
    const before = (await readMinigameSave(page)).player.difficulty;
    await pressGameKey(page, "Escape");
    await activate(page, source, "escape-menu-settings");
    await activate(page, source, "settings-difficulty");
    await expect(page.locator("#debug-state")).toContainText("[DIFFICULTY]");
    await activate(page, source, "difficulty-title");
    await expect(page.locator("#debug-state")).toContainText("[DIFFICULTY]");
    if (source === "mouse") {
      await releaseFromAnotherControl(page, "difficulty-title", "difficulty-close");
      await expect(page.locator("#debug-state")).toContainText("[DIFFICULTY]");
    }
    await expectCleanLayout(page);
    await pressGameKey(page, "Escape");
    await expectMenu(page, "difficulty", false);
    await activate(page, source, "settings-difficulty");
    await expectMenu(page, "difficulty");
    await activate(page, source, "difficulty-close");
    await expectMenu(page, "difficulty", false);
    expect((await readMinigameSave(page)).player.difficulty).toEqual(before);
    expect(errors).toEqual([]);
  });
}

test("losing focus cancels a held negotiation choice without spending the attempt", async ({ page }) => {
  const errors = minigameBrowserErrors(page);
  const fixture = await setup(page, "mouse", 1.5);
  await clickLayoutItem(page, "shop-negotiate");
  await expectMenu(page, "shop-negotiation");
  const point = await layoutItemCenter(page, "shop-negotiation-1");
  const canvas = await page.locator("#game-container canvas").boundingBox();
  if (!canvas) throw new Error("Missing shop canvas.");
  await pressPointerAt(page, canvas.x + point.x / 640 * canvas.width, canvas.y + point.y / 528 * canvas.height);
  try {
    await waitForGameInputFrame(page);
    expect((await readMinigameSave(page)).player.progression.skillChecks[fixture.shopCheckId]).toBeUndefined();
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  } finally {
    await page.mouse.up();
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  }
  await expectMenu(page, "shop-negotiation");
  expect((await readMinigameSave(page)).player.progression.skillChecks[fixture.shopCheckId]).toBeUndefined();
  expect(errors).toEqual([]);
});

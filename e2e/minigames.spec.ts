import { expect, test } from "@playwright/test";
import {
  clickLayoutItem,
  expectCleanLayout,
  tapLayoutItem,
} from "./helpers/layout";
import {
  MINIGAME_TEST_WEATHER,
  aimMinigamePointer,
  continueMinigameFixture,
  crownFixtureSeed,
  finishArcheryFixture,
  finishRegattaFixture,
  installMinigameGamepad,
  minigameBrowserErrors,
  minigameCancel,
  minigameConfirm,
  minigameFixture,
  minigameKey,
  openMinigameFixture,
  readMinigameSave,
  seedMinigamePage,
  waitMinigameState,
} from "./helpers/minigames";
import type { MinigameTestSource } from "./helpers/minigames";

test.use({ hasTouch: true });

for (const source of ["keyboard", "touch", "gamepad"] as const satisfies readonly MinigameTestSource[]) {
  test(`Crown & Bones banks and recovers exact paid results with ${source}`, async ({ page }) => {
    const errors = minigameBrowserErrors(page);
    await installMinigameGamepad(page);
    await page.goto("game.html", { waitUntil: "networkidle" });
    const fixture = minigameFixture("willowInnTable", crownFixtureSeed());
    await seedMinigamePage(page, fixture, source);
    await openMinigameFixture(page, source);
    await expectCleanLayout(page);
    const entry = await readMinigameSave(page);
    expect(entry.player.gold).toBe(995);
    expect(entry.player.progression.minigames.pending?.feePaid).toBe(5);
    const position = entry.player.position;
    for (let roll = 1; roll <= 4; roll += 1) {
      await minigameConfirm(page, source);
      await expect.poll(async () => {
        const current = (await readMinigameSave(page)).player.progression.minigames.pending;
        return current?.activityId === "crownAndBones" ? current.game.rollCount : 0;
      }).toBe(roll);
      await expectCleanLayout(page);
    }
    await waitMinigameState(page, "[MINIGAME_VIEW:result]");
    const settled = await readMinigameSave(page);
    expect(settled.player.gold).toBe(1_005);
    expect(settled.player.progression.minigames.pending?.receipt?.goldPaid).toBe(10);
    expect(settled.player.progression.minigames.statistics.crownAndBones.medals).toBe(1);
    expect(settled.player.position).toEqual(position);
    expect(settled.player.progression.social.alignment).toEqual(fixture.player.progression.social.alignment);
    const receipt = settled.player.progression.minigames.pending?.receipt;
    await page.reload({ waitUntil: "networkidle" });
    await continueMinigameFixture(page);
    await waitMinigameState(page, "[MINIGAME_VIEW:result]");
    const recovered = await readMinigameSave(page);
    expect(recovered.player.gold).toBe(1_005);
    expect(recovered.player.progression.minigames.pending?.receipt).toEqual(receipt);
    expect(recovered.player.progression.minigames.history).toHaveLength(1);
    await minigameCancel(page, source);
    await expect(page.locator("#debug-state")).not.toContainText("[MINIGAME:");
    await expect(page.locator("#minigame-live-region")).toHaveCount(0);
    await expect(page.locator("#game-container canvas")).not.toHaveAttribute("data-minigame-input-owned", "true");
    const closed = await readMinigameSave(page);
    expect(closed.player.progression.minigames.pending).toBeNull();
    expect(closed.player.gold).toBe(1_005);
    expect(errors).toEqual([]);
  });

  test(`Archery uses class-neutral precision and mid-run recovery with ${source}`, async ({ page }) => {
    const errors = minigameBrowserErrors(page);
    await installMinigameGamepad(page);
    if (source === "touch") await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("game.html", { waitUntil: "networkidle" });
    const fixture = minigameFixture("willowdaleRange");
    await seedMinigamePage(page, fixture, source);
    await openMinigameFixture(page, source);
    const entry = await readMinigameSave(page);
    const challenge = entry.player.progression.minigames.pending?.challenge;
    expect(entry.player.gold).toBe(995);
    await finishArcheryFixture(page, source, async (index) => {
      await expectCleanLayout(page);
      if (index !== 1) return;
      const before = await readMinigameSave(page);
      const pending = before.player.progression.minigames.pending;
      await page.reload({ waitUntil: "networkidle" });
      await continueMinigameFixture(page);
      await waitMinigameState(page, "[MINIGAME_VIEW:game]");
      const recovered = await readMinigameSave(page);
      expect(recovered.player.gold).toBe(995);
      expect(recovered.player.progression.minigames.pending).toEqual(pending);
      if (source === "touch") {
        await page.setViewportSize({ width: 932, height: 430 });
        await expectCleanLayout(page);
      }
    });
    const settled = await readMinigameSave(page);
    expect(settled.player.progression.minigames.pending?.challenge).toEqual(challenge);
    expect(settled.player.progression.minigames.pending?.receipt?.score).toBe(100);
    expect(settled.player.progression.minigames.pending?.receipt?.goldPaid).toBe(13);
    expect(settled.player.gold).toBe(1_008);
    expect(settled.player.progression.achievements.earned.map((record) => record.id)).toContain("steadyHand");
    await minigameCancel(page, source);
    await expect(page.locator("#debug-state")).not.toContainText("[MINIGAME:");
    await expectCleanLayout(page);
    expect(errors).toEqual([]);
  });

  test(`Harbor Regatta reuses boat movement, forecast, and recovery with ${source}`, async ({ page }) => {
    const errors = minigameBrowserErrors(page);
    await installMinigameGamepad(page);
    await page.goto("game.html", { waitUntil: "networkidle" });
    const fixture = minigameFixture("sandportRegatta");
    fixture.weatherState = { current: MINIGAME_TEST_WEATHER, stepsUntilChange: 40 };
    await seedMinigamePage(page, fixture, source);
    await openMinigameFixture(page, source);
    const entry = await readMinigameSave(page);
    const pending = entry.player.progression.minigames.pending;
    expect(pending?.activityId).toBe("regatta");
    expect(pending?.weather).toBe(MINIGAME_TEST_WEATHER);
    expect(entry.player.gold).toBe(995);
    await page.reload({ waitUntil: "networkidle" });
    await continueMinigameFixture(page);
    await waitMinigameState(page, "[MINIGAME_VIEW:game]");
    const recovered = await readMinigameSave(page);
    expect(recovered.player.progression.minigames.pending).toEqual(pending);
    expect(recovered.player.gold).toBe(995);
    await finishRegattaFixture(page, source);
    await expectCleanLayout(page);
    const settled = await readMinigameSave(page);
    expect(settled.player.gold).toBe(1_010);
    expect(settled.player.position).toEqual(fixture.player.position);
    expect(settled.weatherState).toEqual(fixture.weatherState);
    expect(settled.player.progression.nautical.sailing).toBe(false);
    expect(settled.player.progression.minigames.pending?.receipt?.score).toBe(100);
    expect(settled.player.progression.nautical.ownedBoats[0]!.condition)
      .toBeGreaterThanOrEqual(fixture.player.progression.nautical.ownedBoats[0]!.condition - 4);
    expect(settled.player.progression.minigames.statistics.regatta.medals).toBe(1);
    await minigameCancel(page, source);
    await expect(page.locator("#debug-state")).not.toContainText("[MINIGAME:");
    await expect(page.locator("#minigame-live-region")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test("dice input replay, loss, abandonment, and personal-board exit cannot leak resources or input", async ({ page }) => {
  const errors = minigameBrowserErrors(page);
  await page.goto("game.html", { waitUntil: "networkidle" });
  await seedMinigamePage(page, minigameFixture("willowInnTable", crownFixtureSeed()), "keyboard");
  await openMinigameFixture(page, "keyboard");
  await page.keyboard.down("Enter");
  await clickLayoutItem(page, "minigame-roll");
  await page.waitForTimeout(300);
  await page.keyboard.up("Enter");
  await expect.poll(async () => {
    const current = (await readMinigameSave(page)).player.progression.minigames.pending;
    return current?.activityId === "crownAndBones" ? current.game.rollCount : 0;
  }).toBe(1);
  await minigameKey(page, "Escape");
  await waitMinigameState(page, "[MINIGAME_VIEW:pause]");
  await clickLayoutItem(page, "minigame-abandon");
  await waitMinigameState(page, "[MINIGAME_VIEW:result]");
  let save = await readMinigameSave(page);
  expect(save.player.gold).toBe(995);
  expect(save.player.progression.minigames.pending?.receipt?.outcome).toBe("abandoned");
  expect(save.player.progression.minigames.statistics.crownAndBones.medals).toBe(0);
  await clickLayoutItem(page, "minigame-board");
  await waitMinigameState(page, "[MINIGAME_VIEW:records]");
  await minigameKey(page, "Escape");
  await waitMinigameState(page, "[MINIGAME_VIEW:result]");
  await minigameKey(page, "Escape");
  await expect(page.locator("#debug-state")).not.toContainText("[MINIGAME:");
  await minigameKey(page, "Escape");
  await waitMinigameState(page, "[MENU]");
  await clickLayoutItem(page, "escape-menu-minigames");
  await waitMinigameState(page, "[MINIGAME_VIEW:records]");
  await expectCleanLayout(page);
  await minigameKey(page, "Escape");
  await seedMinigamePage(page, minigameFixture("willowInnTable", crownFixtureSeed(true)), "keyboard");
  await openMinigameFixture(page, "keyboard");
  await minigameConfirm(page, "keyboard");
  await waitMinigameState(page, "[MINIGAME_VIEW:result]");
  save = await readMinigameSave(page);
  expect(save.player.gold).toBe(995);
  expect(save.player.progression.minigames.pending?.receipt?.outcome).toBe("bones");
  expect(save.player.progression.minigames.claimedMilestoneIds).toEqual([]);
  await minigameKey(page, "Escape");
  const position = save.player.position;
  await minigameKey(page, "w", 160);
  await expect(page.locator("#debug-state")).toContainText(`Pos: (${position.x},${position.y - 1})`);
  expect(errors).toEqual([]);
});

test("timed archery displays an input preview without saving frames or rerolling targets", async ({ page }) => {
  const errors = minigameBrowserErrors(page);
  await page.goto("game.html", { waitUntil: "networkidle" });
  await seedMinigamePage(page, minigameFixture("willowdaleRange"), "keyboard", { reducedMotion: false });
  await openMinigameFixture(page, "keyboard");
  const initial = await readMinigameSave(page);
  await expect.poll(async () => page.locator("#game-container canvas").getAttribute("data-minigame-visible-aim")).not.toBe("0");
  await page.waitForTimeout(500);
  const unchanged = await readMinigameSave(page);
  expect(unchanged.player.progression.minigames.pending).toEqual(initial.player.progression.minigames.pending);
  expect(unchanged.player.gold).toBe(995);
  await clickLayoutItem(page, "minigame-fire");
  const fired = await readMinigameSave(page);
  const pending = fired.player.progression.minigames.pending;
  if (pending?.activityId !== "archery") throw new Error("Missing timed archery fixture");
  await expect(page.locator("#game-container canvas")).toHaveAttribute("data-minigame-accepted-aim", String(pending.game.shots[0]));
  expect(pending.game.shots[0]).toBeGreaterThanOrEqual(0);
  expect(pending.game.shots[0]).toBeLessThanOrEqual(100);
  expect(pending.challenge).toEqual(initial.player.progression.minigames.pending?.challenge);
  await page.reload({ waitUntil: "networkidle" });
  await continueMinigameFixture(page);
  expect((await readMinigameSave(page)).player.progression.minigames.pending).toEqual(pending);
  await expectCleanLayout(page);
  expect(errors).toEqual([]);
});

test("a failed real local-storage write cannot charge an entry or expose uncommitted results", async ({ page }) => {
  const errors = minigameBrowserErrors(page);
  await page.goto("game.html", { waitUntil: "networkidle" });
  await seedMinigamePage(page, minigameFixture("willowInnTable", crownFixtureSeed()), "keyboard");
  await minigameKey(page, "Space");
  await waitMinigameState(page, "[MINIGAME_VIEW:lobby]");
  const before = await readMinigameSave(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Object.defineProperty(window, "__restoreMinigameStorage", {
      configurable: true, value: () => { Storage.prototype.setItem = original; },
    });
    Storage.prototype.setItem = function (key: string, value: string): void {
      if (key.startsWith("2dnd_save")) throw new DOMException("Fixture quota exceeded", "QuotaExceededError");
      original.call(this, key, value);
    };
  });
  await minigameConfirm(page, "keyboard");
  await waitMinigameState(page, "[MINIGAME_VIEW:error]");
  await expect(page.locator("#save-storage-alert")).toContainText("Save error");
  const rejected = await readMinigameSave(page);
  expect(rejected.player.gold).toBe(1_000);
  expect(rejected.player.progression.minigames).toEqual(before.player.progression.minigames);
  await page.evaluate(() => {
    (window as typeof window & { __restoreMinigameStorage(): void }).__restoreMinigameStorage();
  });
  await clickLayoutItem(page, "minigame-retry");
  await waitMinigameState(page, "[MINIGAME_VIEW:game]");
  const accepted = await readMinigameSave(page);
  expect(accepted.player.gold).toBe(995);
  expect(accepted.player.progression.minigames.sequence).toBe(1);
  await expect(page.locator("#save-storage-alert")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("free practice and persisted debug archery cannot create paid medals or first-reward claims", async ({ page }) => {
  const errors = minigameBrowserErrors(page);
  await page.goto("game.html", { waitUntil: "networkidle" });
  await seedMinigamePage(page, minigameFixture("willowdaleRange"), "touch");
  await page.locator('[data-action="confirm"]').tap();
  await waitMinigameState(page, "[MINIGAME_VIEW:lobby]");
  await tapLayoutItem(page, "minigame-setup");
  await tapLayoutItem(page, "minigame-practice");
  await tapLayoutItem(page, "minigame-back");
  await tapLayoutItem(page, "minigame-play");
  for (let index = 0; index < 5; index += 1) {
    const pending = (await readMinigameSave(page)).player.progression.minigames.pending;
    if (pending?.activityId !== "archery") throw new Error("Missing practice fixture");
    await aimMinigamePointer(page, pending.challenge.targets[index]!, true);
    await page.locator('[data-action="confirm"]').tap();
    await page.waitForTimeout(180);
  }
  await waitMinigameState(page, "[MINIGAME_VIEW:result]");
  const practice = await readMinigameSave(page);
  expect(practice.player.gold).toBe(1_000);
  expect(practice.player.progression.minigames.statistics.archery.medals).toBe(0);
  expect(practice.player.progression.minigames.claimedMilestoneIds).toEqual([]);
  expect(practice.player.progression.achievements.earned.map((record) => record.id)).not.toContain("steadyHand");
  await minigameCancel(page, "touch");
  await page.locator("#debug-checkbox").check();
  await page.locator("#debug-cmd").fill("/minigame play willowdaleRange");
  await page.locator("#debug-cmd").press("Enter");
  await page.locator("#debug-cmd").blur();
  await waitMinigameState(page, "[MINIGAME_VIEW:game]");
  expect((await readMinigameSave(page)).player.progression.minigames.pending?.debug).toBe(true);
  await page.reload({ waitUntil: "networkidle" });
  await continueMinigameFixture(page);
  await finishArcheryFixture(page, "keyboard");
  const debug = await readMinigameSave(page);
  expect(debug.player.gold).toBe(1_000);
  expect(debug.player.progression.minigames.statistics.archery.medals).toBe(0);
  expect(debug.player.progression.minigames.bests).toEqual({});
  expect(debug.player.progression.minigames.claimedMilestoneIds).toEqual([]);
  expect(errors).toEqual([]);
});

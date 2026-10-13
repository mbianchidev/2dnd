import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { measureFrameWorkload } from "../hacks/lib/frameWorkload";
import type { FrameWorkloadSample } from "../hacks/lib/frameWorkload";
import { expectCleanLayout, layoutItemCenter, readLayoutReport, waitForGameInputFrame } from "./helpers/layout";
import {
  minigameBrowserErrors,
  minigameFixture,
  readMinigameSave,
  seedMinigamePage,
} from "./helpers/minigames";

test("settled scenes do no redundant DOM work and live preferences still reflow", async ({ page }) => {
  const errors = minigameBrowserErrors(page);
  const record = async (phase: string, sample: FrameWorkloadSample): Promise<void> => {
    const path = test.info().outputPath(`${phase}-frame-workload.json`);
    await writeFile(path, JSON.stringify(sample, null, 2));
    await test.info().attach(`${phase} frame workload`, { path, contentType: "application/json" });
  };
  await page.goto("game.html", { waitUntil: "domcontentloaded" });
  await layoutItemCenter(page, "title-new-game");
  const title = await measureFrameWorkload(page);
  await record("title", title);
  expect(title).toMatchObject({
    frameCount: 120, canvasAttributeWrites: 0, debugStateWrites: 0, layoutReportWrites: 0,
  });

  await seedMinigamePage(page, minigameFixture("willowdaleRange"), "keyboard");
  await layoutItemCenter(page, "minigame-venue-willowdaleRange");
  await expect.poll(async () => {
    const progression = (await readMinigameSave(page)).player.progression;
    const report = await readLayoutReport(page);
    return {
      reveals: progression.pendingFeatureRevealIds.length,
      achievements: progression.achievements.pendingNotificationIds.length,
      hud: report.groups["world-hud"]?.items.map((item) => item.id),
      notices: await page.locator("#achievement-notification-live-region, #codex-discovery-notice-live-region").count(),
    };
  }, { message: "Observe actual startup feedback completing before measuring a settled scene" })
    .toEqual({ reveals: 0, achievements: 0, hud: [], notices: 0 });
  const exploration = await measureFrameWorkload(page);
  await record("exploration", exploration);
  expect(exploration).toMatchObject({
    frameCount: 120, canvasAttributeWrites: 0, debugStateWrites: 0, layoutReportWrites: 0,
  });
  const save = await page.evaluate(() => localStorage.getItem("2dnd_save"));
  const layoutBefore = await page.locator("#layout-report").textContent();
  await page.evaluate(async () => {
    const path = "/2dnd/src/systems/accessibility.ts";
    const { gamePreferences }: typeof import("../src/systems/accessibility") = await import(path);
    gamePreferences.cycleTextScale();
    gamePreferences.setHighContrast(false);
  });
  const canvas = page.locator("#game-container canvas");
  await expect(canvas).toHaveAttribute("data-text-scale", "1.25");
  await expect(canvas).toHaveAttribute("data-high-contrast", "false");
  await waitForGameInputFrame(page);
  await expect(page.locator("#layout-report")).not.toHaveText(layoutBefore ?? "");
  await expectCleanLayout(page);
  expect(await page.evaluate(() => localStorage.getItem("2dnd_save"))).toBe(save);
  const reflowed = await measureFrameWorkload(page);
  await record("reflowed", reflowed);
  expect(reflowed).toMatchObject({
    frameCount: 120, canvasAttributeWrites: 0, debugStateWrites: 0, layoutReportWrites: 0,
  });

  expect(errors).toEqual([]);
});

import { expect, test } from "@playwright/test";
import { CUTSCENE_IDS, CAMPAIGN_EPILOGUE_CUTSCENE_ID } from "../src/data/cutscenes";
import { clickLayoutItem, clickPointerAt, expectCleanLayout } from "./helpers/layout";
import { createJourneySource, holdJourneyKey } from "./helpers/ngJourney";

test("NG+ epic hero and full party summary stays paginated, accessible and immutable at 150% text", async ({ page }) => {
  const source = createJourneySource({ profileId: "standard" }, 1);
  source.player.progression.seenCutsceneIds = CUTSCENE_IDS.filter((id) => id !== CAMPAIGN_EPILOGUE_CUTSCENE_ID);
  source.player.progression.pendingCutsceneIds = [CAMPAIGN_EPILOGUE_CUTSCENE_ID];
  const raw = JSON.stringify(source);
  await page.addInitScript((bytes) => {
    if (!sessionStorage.getItem("ng-summary-seeded")) {
      localStorage.clear();
      localStorage.setItem("2dnd_save", bytes);
      localStorage.setItem("2dnd_save_slot_manual-1", bytes);
      localStorage.setItem("2dnd_save_slots_migrated_v1", "verified");
      localStorage.setItem("2dnd_preferences", JSON.stringify({
        version: 3, accessibility: { textScale: 1.5, highContrast: true, reducedMotion: true },
      }));
      sessionStorage.setItem("ng-summary-seeded", "true");
    }
  }, raw);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("game.html", { waitUntil: "networkidle" });
  await clickLayoutItem(page, "title-continue");
  for (let step = 0; step < 8; step++) {
    if ((await page.locator("#debug-state").textContent())?.includes("Type: summary")) break;
    await page.waitForTimeout(400);
    await holdJourneyKey(page, "Enter");
  }
  await expect(page.locator("#ending-summary-accessible-content")).toContainText("NG+ 1");
  await expect(page.locator("#ending-summary-accessible-content")).toContainText("Lv.30");
  await expectCleanLayout(page);
  const canvas = await page.locator("#game-container canvas").boundingBox();
  if (!canvas) throw new Error("Missing measured summary canvas");
  await clickPointerAt(page, canvas.x + 16 / 640 * canvas.width, canvas.y + 16 / 528 * canvas.height);
  await expect(page.locator("#ending-summary-accessibility")).toHaveCount(1);
  await holdJourneyKey(page, "d");
  await expect(page.locator("#ending-summary-live-region")).toContainText("Summary page 2");
  await holdJourneyKey(page, "a");
  await expect(page.locator("#ending-summary-live-region")).toContainText("Summary page 1");
  for (let pageIndex = 0; pageIndex < 5; pageIndex++) {
    await holdJourneyKey(page, "ArrowRight");
    await expectCleanLayout(page);
  }
  await clickLayoutItem(page, "ending-summary-continue");
  await expect(page.locator("#ending-summary-accessibility")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("2dnd_save_slot_manual-1"))).toBe(raw);
  expect(errors).toEqual([]);
});

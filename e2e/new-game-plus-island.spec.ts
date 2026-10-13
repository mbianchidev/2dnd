import { expect, test, type Page } from "@playwright/test";
import { createIslandVoyage } from "../tests/helpers/campaign";
import { holdJourneyKey, readJourneySave } from "./helpers/ngJourney";
import { clickLayoutItem, expectCleanLayout, readLayoutReport } from "./helpers/layout";
import type { SaveData } from "../src/systems/save";

test.use({ hasTouch: true, viewport: { width: 844, height: 390 } });

async function reachExploration(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const state = await page.locator("#debug-state").textContent() ?? "";
    if (state.includes("OVERWORLD")) return;
    if (state.includes("ENDING | Choices")) {
      await holdJourneyKey(page, "Enter");
      continue;
    }
    const report = await readLayoutReport(page);
    if (Object.values(report.groups).some((group) =>
      group.items.some((item) => item.id === "ending-summary-continue"),
    )) await clickLayoutItem(page, "ending-summary-continue");
    else if (state.includes("CUTSCENE") || state.includes("ENDING")) await holdJourneyKey(page, "Escape");
    else await page.waitForTimeout(100);
  }
  throw new Error(`Island fixture did not reach exploration: ${await page.locator("#debug-state").textContent()}`);
}

async function seedVoyage(page: Page, ng: boolean): Promise<{ source: string; voyage: SaveData }> {
  const fixture = createIslandVoyage(ng);
  const source = JSON.stringify(fixture.source);
  const voyage = fixture.voyage;
  await page.addInitScript(({ checkpoint, protectedSource }) => {
    let seed = 0x172a;
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return 0.8 + seed / 0x1_0000_0000 * 0.19;
    };
    if (sessionStorage.getItem("island-fixture")) return;
    sessionStorage.setItem("island-fixture", "true");
    localStorage.clear();
    localStorage.setItem("2dnd_save", checkpoint);
    localStorage.setItem("2dnd_save_slot_manual-1", protectedSource);
    localStorage.setItem("2dnd_save_slots_migrated_v1", "verified");
    localStorage.setItem("2dnd_preferences", JSON.stringify({
      version: 3,
      accessibility: { textScale: 1.5, highContrast: true, reducedMotion: true },
      controls: { touchControls: "on" },
    }));
  }, { checkpoint: JSON.stringify(voyage), protectedSource: source });
  await page.goto("game.html", { waitUntil: "networkidle" });
  await clickLayoutItem(page, "title-continue");
  await reachExploration(page);
  return { source, voyage };
}

async function markerIds(page: Page): Promise<string[]> {
  return Object.values((await readLayoutReport(page)).groups).flatMap((group) =>
    group.items.map((item) => item.id),
  );
}

for (const ng of [false, true]) {
  test(`${ng ? "NG+" : "ordinary post-game"} voyage ${ng ? "lands on" : "cannot see or enter"} the secret island`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    const { source, voyage } = await seedVoyage(page, ng);
    await expect.poll(() => markerIds(page)).toEqual(ng
      ? expect.arrayContaining(["island-name-starfallAtoll"])
      : expect.not.arrayContaining(["island-name-starfallAtoll"]));
    await holdJourneyKey(page, "s");
    await holdJourneyKey(page, "Space");
    if (ng) {
      await expect(page.locator("#debug-state")).toContainText("[CITY:starfall_atoll:0]");
      const landed = await readJourneySave(page);
      expect(landed.player.progression.nautical.discoveredIslandIds).toContain("starfallAtoll");
      expect(landed.codex.unlockedEntryIds).toContain("locationStarfallAtoll");
      expect(landed.player.inventory).toEqual(voyage.player.inventory);
      expect(landed.player.progression.nautical.ownedBoats).toEqual(voyage.player.progression.nautical.ownedBoats);
      expect(landed.player.progression.quests).toEqual(voyage.player.progression.quests);
      await expectCleanLayout(page);
      await page.reload({ waitUntil: "networkidle" });
      await clickLayoutItem(page, "title-continue");
      await expect(page.locator("#debug-state")).toContainText("[CITY:starfall_atoll:0]");
      await holdJourneyKey(page, "s");
      await page.locator('[data-action="confirm"]').tap();
      await expect(page.locator("#debug-state")).toContainText("[BOAT:reedSkiff]");
      const departed = await readJourneySave(page);
      expect(departed.player.position).toMatchObject({ inCity: false, cityId: "", x: 12, y: 1 });
      expect(departed.player.progression.nautical.ownedBoats[0]?.condition).toBe(47);
    } else {
      await expect(page.locator("#debug-state")).not.toContainText("[CITY:starfall_atoll:");
      expect((await markerIds(page))).not.toContain("island-name-starfallAtoll");
      const normal = await readJourneySave(page);
      expect(normal.player.newGamePlus).toBeNull();
      expect(normal.player.progression.nautical.discoveredIslandIds).not.toContain("starfallAtoll");
    }
    expect(await page.evaluate(() => localStorage.getItem("2dnd_save_slot_manual-1"))).toBe(source);
    expect(errors).toEqual([]);
  });
}

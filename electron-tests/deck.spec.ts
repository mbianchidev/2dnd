import { expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { arch, cpus, platform, release, tmpdir } from "node:os";
import { join } from "node:path";
import { expectCleanLayout } from "../e2e/helpers/layout";
import { SAVE_WRITE_MEASURE } from "../src/systems/saveStorage";
import { launchDesktop, monitorRendererErrors, waitForState } from "./helpers/desktop";
import {
  clickControllerLayoutItem,
  installController,
  moveControllerCursor,
  pressController,
  selectControllerAction,
  typeWithController,
} from "./helpers/controller";

async function sizeDesktop(desktop: ElectronApplication): Promise<void> {
  await desktop.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0];
    if (!window) throw new Error("Missing equivalent desktop window");
    window.setContentSize(1280, 800);
  });
}

async function drainOpening(page: Page): Promise<void> {
  for (let step = 0; step < 70; step += 1) {
    const state = await page.locator("#debug-state").textContent() ?? "";
    if (state.includes("OVERWORLD") && !state.includes("[TUTORIAL")) return;
    await pressController(page, 0);
  }
  throw new Error("Controller could not complete opening/tutorial presentation");
}

async function createControllerCampaign(page: Page, name: string): Promise<void> {
  await waitForState(page, "BOOT | Screen: title");
  await selectControllerAction(page, "[TITLE_ACTION:newGame]");
  await waitForState(page, "BOOT | Screen: character");
  await pressController(page, 2);
  await expect(page.locator("#controller-keyboard")).toBeVisible();
  await typeWithController(page, name);
  await pressController(page, 15);
  await pressController(page, 14);
  await pressController(page, 0);
  await waitForState(page, "BOOT | Screen: stats");
  for (let stat = 0; stat < 3; stat += 1) {
    for (let point = 0; point < 7; point += 1) await pressController(page, 15);
    if (stat < 2) await pressController(page, 13);
  }
  await pressController(page, 0);
  await waitForState(page, "BOOT | Screen: appearance");
  await pressController(page, 15);
  await pressController(page, 13);
  await pressController(page, 15);
  await pressController(page, 0);
  await drainOpening(page);
}

async function visitMenu(page: Page, action: string): Promise<void> {
  await pressController(page, 9);
  await waitForState(page, "[MENU]");
  await selectControllerAction(page, `[MENU_SELECTION:${action}]`);
}

async function representativeBattle(page: Page): Promise<void> {
  await page.evaluate(() => window.__mockController.random(0.01));
  for (let step = 0; step < 30; step += 1) {
    const state = await page.locator("#debug-state").textContent() ?? "";
    if (state.includes("BATTLE")) break;
    if (state.includes("[WORLD_EVENT:") || state.includes("[TUTORIAL")) {
      await pressController(page, 0);
    } else {
      await pressController(page, step % 2 === 0 ? 15 : 14);
    }
  }
  await waitForState(page, "BATTLE");
  await page.evaluate(() => window.__mockController.random(null));
  for (let action = 0; action < 60; action += 1) {
    const state = await page.locator("#debug-state").textContent() ?? "";
    if (state.includes("OVERWORLD")) return;
    await pressController(page, 0);
  }
  throw new Error("Representative controller battle did not resolve");
}

for (const textScale of [1, 1.25]) {
  test(`1280x800 controller name entry at ${textScale * 100}% text`, async () => {
    const userData = await mkdtemp(join(tmpdir(), "2dnd-deck-text-"));
    let desktop: ElectronApplication | undefined;
    try {
      desktop = await launchDesktop(userData);
      await sizeDesktop(desktop);
      const page = await desktop.firstWindow();
      const errors = monitorRendererErrors(page);
      await installController(page, textScale);
      await selectControllerAction(page, "[TITLE_ACTION:newGame]");
      await waitForState(page, "BOOT | Screen: character");
      await pressController(page, 2);
      const geometry = await page.locator("#mobile-text-input").evaluate((form) => {
        if (!(form instanceof HTMLFormElement)) throw new Error("Missing text-entry form");
        const bounds = form.getBoundingClientRect();
        return {
          withinViewport: bounds.left >= 0 && bounds.top >= 0
            && bounds.right <= innerWidth && bounds.bottom <= innerHeight,
          scale: form.dataset.textScale,
        };
      });
      expect(geometry).toEqual({ withinViewport: true, scale: String(textScale) });
      await typeWithController(page, "mock");
      await pressController(page, 2);
      await pressController(page, 1);
      await expect(page.locator("#mobile-text-input")).toHaveCount(0);
      await waitForState(page, "BOOT | Screen: character");
      expect(errors).toEqual([]);
    } finally {
      await desktop?.close();
      await rm(userData, { recursive: true, force: true });
    }
  });
}

test("1280x800 offline controller campaign, reload, exit and cleanup (desktop equivalent)", async () => {
  const userData = await mkdtemp(join(tmpdir(), "2dnd-deck-equivalent-"));
  let desktop: ElectronApplication | undefined;
  try {
    const launchStarted = performance.now();
    desktop = await launchDesktop(userData);
    await sizeDesktop(desktop);
    let page = await desktop.firstWindow();
    const errors = monitorRendererErrors(page);
    await waitForState(page, "BOOT | Screen: title");
    const startupMs = performance.now() - launchStarted;
    await installController(page);
    await page.context().setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect.poll(() => page.evaluate(() => ({
      width: innerWidth, height: innerHeight, origin: location.origin,
    }))).toEqual({ width: 1280, height: 800, origin: "app://2dnd" });
    expect(await page.evaluate(() => Object.keys(window.desktop ?? {}).sort())).toEqual([
      "getState", "onFullscreenChanged", "quitApp", "reportError", "toggleFullscreen",
    ]);
    await createControllerCampaign(page, "deck");
    await expect(page.locator("#game-container canvas")).toHaveAttribute("data-text-scale", "1.5");
    await expect(page.locator("#game-container canvas")).toHaveAttribute("data-input-source", "gamepad");

    await pressController(page, 9);
    await waitForState(page, "[MENU]");
    await page.evaluate(() => window.__mockController.button(13, true));
    await page.waitForTimeout(120);
    const beforeDisconnect = (await page.locator("#debug-state").textContent())?.match(
      /\[MENU_SELECTION:[^\]]+\]/,
    )?.[0];
    await page.evaluate(() => window.__mockController.connected(false));
    await expect(page.locator("#game-container canvas")).toHaveAttribute("data-gamepad-connected", "false");
    await page.waitForTimeout(400);
    expect((await page.locator("#debug-state").textContent())?.match(
      /\[MENU_SELECTION:[^\]]+\]/,
    )?.[0]).toBe(beforeDisconnect);
    await page.evaluate(() => window.__mockController.connected(true));
    await expect(page.locator("#game-container canvas")).toHaveAttribute("data-gamepad-connected", "true");
    await pressController(page, 1);

    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await pressController(page, 9);
    await waitForState(page, "[MENU]");
    await expectCleanLayout(page);
    await pressController(page, 1);
    await representativeBattle(page);
    await visitMenu(page, "codex");
    await waitForState(page, "CODEX");
    await pressController(page, 2);
    await typeWithController(page, "slime");
    await waitForState(page, "Search: slime");
    await pressController(page, 1);
    await waitForState(page, "OVERWORLD");

    await visitMenu(page, "save");
    await waitForState(page, "[SAVE_SLOTS:save]");
    await expectCleanLayout(page);
    await pressController(page, 0);
    await expect.poll(() => page.evaluate(
      () => localStorage.getItem("2dnd_save_slot_manual-1"),
    )).not.toBeNull();
    const saveWriteMs = await page.evaluate((name) => {
      const measure = performance.getEntriesByName(name)[0];
      if (!measure) throw new Error("Missing actual atomic save-write measurement");
      return measure.duration;
    }, SAVE_WRITE_MEASURE);
    await clickControllerLayoutItem(page, "save-slot-action-rename");
    await typeWithController(page, "camp");
    expect(await page.evaluate(
      () => localStorage.getItem("2dnd_save_slot_manual-1:name"),
    )).toBe("camp");
    await pressController(page, 1);
    await visitMenu(page, "quit");
    await waitForState(page, "BOOT | Screen: title");
    await page.evaluate(() => localStorage.setItem("2dnd_save", "{corrupt mock JSON"));
    expect(errors).toEqual([]);
    await desktop.close();
    desktop = undefined;

    desktop = await launchDesktop(userData);
    await sizeDesktop(desktop);
    page = await desktop.firstWindow();
    const reloadErrors = monitorRendererErrors(page);
    await installController(page);
    await page.context().setOffline(true);
    await selectControllerAction(page, "[TITLE_ACTION:continue]");
    await waitForState(page, "OVERWORLD");
    const reloaded = await page.evaluate(() => {
      const raw = localStorage.getItem("2dnd_save_slot_manual-1");
      if (!raw) throw new Error("Manual campaign did not survive direct relaunch");
      const saved: unknown = JSON.parse(raw);
      if (
        typeof saved !== "object" || saved === null || !("player" in saved)
        || typeof saved.player !== "object" || saved.player === null
        || !("name" in saved.player) || typeof saved.player.name !== "string"
      ) throw new Error("Reloaded mock campaign has invalid player data");
      return { campaign: saved.player.name, label: localStorage.getItem("2dnd_save_slot_manual-1:name") };
    });
    expect(reloaded).toEqual({ campaign: "deck", label: "camp" });

    await desktop.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]!.setContentSize(1920, 1080);
    });
    await expect.poll(() => page.evaluate(() => innerWidth)).toBe(1920);
    await sizeDesktop(desktop);
    await expect.poll(() => page.evaluate(() => innerWidth)).toBe(1280);
    const fullscreen = await page.locator("#desktop-fullscreen").boundingBox();
    if (!fullscreen) throw new Error("Missing native fullscreen control");
    await moveControllerCursor(page, {
      x: fullscreen.x + fullscreen.width / 2,
      y: fullscreen.y + fullscreen.height / 2,
    });
    await pressController(page, 11);
    await expect.poll(() => page.evaluate(
      () => window.desktop?.getState().then((state) => state.isFullscreen),
    )).toBe(true);
    const windowed = await page.locator("#desktop-fullscreen").boundingBox();
    if (!windowed) throw new Error("Missing windowed-mode control");
    await moveControllerCursor(page, {
      x: windowed.x + windowed.width / 2, y: windowed.y + windowed.height / 2,
    });
    await pressController(page, 11);
    await expect.poll(() => page.evaluate(
      () => window.desktop?.getState().then((state) => state.isFullscreen),
    )).toBe(false);
    await sizeDesktop(desktop);

    for (let warmup = 0; warmup < 5; warmup += 1) {
      await pressController(page, 9);
      await pressController(page, 1);
      await pressController(page, 8);
      await pressController(page, 1);
    }
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Performance.enable");
    await cdp.send("HeapProfiler.collectGarbage");
    const before = await cdp.send("Memory.getDOMCounters");
    for (let cycle = 0; cycle < 30; cycle += 1) {
      await pressController(page, 9);
      await waitForState(page, "[MENU]");
      await pressController(page, 1);
      await pressController(page, 8);
      await waitForState(page, "[TIPS");
      await pressController(page, 1);
    }
    await cdp.send("HeapProfiler.collectGarbage");
    const after = await cdp.send("Memory.getDOMCounters");
    const memory = await cdp.send("Performance.getMetrics");
    const frameIntervals = await page.evaluate(() => new Promise<number[]>((resolve) => {
      const samples: number[] = [];
      let previous = 0;
      const frame = (timestamp: number): void => {
        if (previous) samples.push(timestamp - previous);
        previous = timestamp;
        if (samples.length >= 180) resolve(samples);
        else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }));
    const nativeMemory = await desktop.evaluate(({ app }) => app.getAppMetrics().map(
      (metric) => ({ type: metric.type, memory: metric.memory }),
    ));
    const sortedFrames = [...frameIntervals].sort((left, right) => left - right);
    await test.info().attach("desktop-equivalent-metrics.json", {
      contentType: "application/json",
      body: JSON.stringify({
        environment: { platform: `${platform()} ${release()}`, arch: arch(), cpu: cpus()[0]?.model },
        resolution: "1280x800",
        physicalDeck: false,
        steamClient: false,
        startupMs,
        actualAtomicSlotWriteMs: saveWriteMs,
        frameIntervalsMs: { median: sortedFrames[89], p95: sortedFrames[170], max: sortedFrames[179] },
        jsHeapUsedBytes: memory.metrics.find((metric) => metric.name === "JSHeapUsedSize")?.value,
        nativeMemory,
        cleanupCycles: 30,
        domBefore: before,
        domAfter: after,
      }, null, 2),
    });
    expect(after.jsEventListeners).toBe(before.jsEventListeners);
    expect(after.nodes).toBe(before.nodes);
    await cdp.detach();
    await visitMenu(page, "quit");
    await waitForState(page, "BOOT | Screen: title");
    expect(reloadErrors).toEqual([]);
    const closing = desktop.waitForEvent("close");
    await selectControllerAction(page, "[TITLE_ACTION:quit]", false);
    await page.evaluate(() => window.__mockController.button(0, true));
    await closing;
    desktop = undefined;
  } finally {
    await desktop?.close();
    await rm(userData, { recursive: true, force: true });
  }
});

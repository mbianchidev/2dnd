import { expect, type Page } from "@playwright/test";
import { layoutItemCenter } from "../../e2e/helpers/layout";
import { TEXT_KEY_ROWS } from "../../src/systems/textEntry";
import { waitForState } from "./desktop";

declare global {
  interface Window {
    __mockController: {
      button(index: number, pressed: boolean): void;
      axes(values: number[]): void;
      connected(value: boolean): void;
    };
  }
}

export async function installController(
  page: Page,
  textScale = 1.5,
  initializePreferences = true,
): Promise<void> {
  await waitForState(page, "BOOT | Screen: title");
  await page.addInitScript((options) => {
    let connected = true;
    let seed = 0x91;
    const pad = {
      id: "Mock standard controller",
      index: 0,
      connected: true,
      mapping: "standard",
      timestamp: 0,
      buttons: Array.from({ length: 17 }, () => ({
        pressed: false, touched: false, value: 0,
      })),
      axes: [0, 0, 0, 0],
    };
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => connected ? [pad] : [],
    });
    window.__mockController = {
      button(index, pressed): void {
        pad.buttons[index] = { pressed, touched: pressed, value: pressed ? 1 : 0 };
        pad.timestamp += 1;
      },
      axes(values): void {
        pad.axes.splice(0, pad.axes.length, ...values);
        pad.timestamp += 1;
      },
      connected(value): void {
        connected = value;
        pad.connected = value;
        pad.buttons.forEach((button) => {
          button.pressed = false;
          button.value = 0;
        });
        pad.axes.fill(0);
        window.dispatchEvent(new Event(value ? "gamepadconnected" : "gamepaddisconnected"));
      },
    };
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x1_0000_0000;
    };
    if (
      options.initializePreferences
      && !sessionStorage.getItem("deck-equivalent-preferences-initialized")
    ) {
      localStorage.setItem("2dnd_preferences", JSON.stringify({
        version: 2,
        accessibility: {
          textScale: options.textScale, highContrast: true, reducedMotion: true, advanceMode: "manual",
        },
        controls: { touchControls: "off", handedness: "right", promptSource: "auto" },
      }));
      sessionStorage.setItem("deck-equivalent-preferences-initialized", "1");
    }
  }, { textScale, initializePreferences });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForState(page, "BOOT | Screen: title");
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }));
}

export async function pressController(page: Page, button: number): Promise<void> {
  await page.evaluate((index) => {
    window.__mockController.button(index, true);
    return new Promise<void>((resolve) => {
      // Keep D-pad taps short; frame-polled buttons need a full held update.
      let heldFrames = index >= 12 && index <= 15 ? 1 : 2;
      const frame = (): void => {
        heldFrames -= 1;
        if (heldFrames > 0) {
          requestAnimationFrame(frame);
          return;
        }
        window.__mockController.button(index, false);
        requestAnimationFrame(() => resolve());
      };
      requestAnimationFrame(frame);
    });
  }, button);
  await page.waitForTimeout(120);
}

export async function holdControllerUntil(
  page: Page,
  button: number,
  state: string,
): Promise<void> {
  await page.evaluate((index) => window.__mockController.button(index, true), button);
  try {
    await waitForState(page, state);
  } finally {
    await page.evaluate((index) => window.__mockController.button(index, false), button);
  }
  await page.evaluate(() => new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  ));
}

export async function selectControllerAction(
  page: Page,
  marker: string,
  activate = true,
): Promise<void> {
  for (let attempt = 0; attempt < 18; attempt += 1) {
    const state = await page.locator("#debug-state").textContent() ?? "";
    if (state.includes(marker)) {
      if (activate) await pressController(page, 0);
      if (activate && marker.startsWith("[TITLE_ACTION:")) {
        for (let retry = 0; retry < 3; retry += 1) {
          const selected = await page.locator("#debug-state").textContent() ?? "";
          if (!selected.includes(marker)) break;
          await pressController(page, 0);
        }
      }
      return;
    }
    await pressController(page, 13);
  }
  throw new Error(`Controller could not select ${marker}`);
}

export async function typeWithController(page: Page, text: string): Promise<void> {
  await expect(page.locator("#controller-keyboard")).toBeVisible();
  await pressController(page, 2);
  let entered = "";
  for (const value of text) {
    let row = -1;
    let column = -1;
    TEXT_KEY_ROWS.forEach((keys, rowIndex) => keys.forEach((key, columnIndex) => {
      if (key.kind === "character" && key.value === value) {
        row = rowIndex;
        column = columnIndex;
      }
    }));
    if (row < 0) throw new Error("Mock controller text must use supported lower-case keys");
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const selected = await page.locator("#controller-keyboard [data-selected=true]")
        .getAttribute("data-text-key");
      let selectedRow = -1;
      let selectedColumn = -1;
      TEXT_KEY_ROWS.forEach((keys, rowIndex) => keys.forEach((key, columnIndex) => {
        if (key.id === selected) {
          selectedRow = rowIndex;
          selectedColumn = columnIndex;
        }
      }));
      if (selectedRow === row && selectedColumn === column) break;
      await pressController(page, selectedRow !== row ? 13 : 15);
      if (attempt === 15) throw new Error("Controller keyboard selection did not converge");
    }
    await pressController(page, 0);
    entered += value;
    await expect(page.locator("#mobile-text-input input")).toHaveValue(entered);
  }
  await expect(page.locator("#mobile-text-input input")).toHaveValue(text);
  await pressController(page, 9);
  await expect(page.locator("#mobile-text-input")).toHaveCount(0);
}

export async function moveControllerCursor(
  page: Page,
  target: { x: number; y: number },
): Promise<void> {
  for (let attempt = 0; attempt < 160; attempt += 1) {
    const bounds = await page.locator("#gamepad-cursor").boundingBox();
    if (bounds) {
      const dx = target.x - (bounds.x + bounds.width / 2);
      const dy = target.y - (bounds.y + bounds.height / 2);
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
        await page.evaluate(() => window.__mockController.axes([0, 0, 0, 0]));
        return;
      }
      const axis = (delta: number): number => Math.abs(delta) < 6
        ? 0 : Math.sign(delta) * Math.min(0.8, Math.max(0.3, Math.abs(delta) / 100));
      await page.evaluate((axes) => window.__mockController.axes(axes), [
        0, 0, axis(dx), axis(dy),
      ]);
    } else {
      await page.evaluate(() => window.__mockController.axes([0, 0, 0.5, 0]));
    }
    await page.waitForTimeout(25);
  }
  await page.evaluate(() => window.__mockController.axes([0, 0, 0, 0]));
  throw new Error("Controller cursor did not reach its target");
}

export async function clickControllerLayoutItem(page: Page, id: string): Promise<void> {
  const point = await layoutItemCenter(page, id);
  const canvas = await page.locator("#game-container canvas").boundingBox();
  if (!canvas) throw new Error("Missing controller-test canvas bounds");
  await moveControllerCursor(page, {
    x: canvas.x + point.x / 640 * canvas.width,
    y: canvas.y + point.y / 528 * canvas.height,
  });
  await pressController(page, 11);
}

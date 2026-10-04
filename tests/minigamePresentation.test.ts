import { describe, expect, it } from "vitest";
import { MINIGAME_DIFFICULTY_IDS } from "../src/data/minigames";
import { getArcheryMeterAim, getMinigameGamePresentation, MinigameInputGate } from "../src/systems/minigamePresentation";
import { layoutMinigamePanel, paginateMinigameLines } from "../src/systems/minigameLayout";
import { auditLayout, containsRect } from "../src/systems/layout";
import { applyMinigameAction, startMinigame } from "../src/systems/minigames";
import { isInputContext, isTouchActionAvailable, mapKeyboardCode } from "../src/systems/input";
import { playerAt, requestFor, startRequest } from "./helpers/minigames";

describe("truthful component presentation and reduced motion", () => {
  it("reveals only a resolved dice pair and never mutates or rerolls a hand", () => {
    const player = playerAt("willowInnTable");
    startMinigame(player, startRequest(player, "willowInnTable"));
    const unrolled = getMinigameGamePresentation(player.progression.minigames.pending!, "keyboard", false);
    expect(unrolled.board).toEqual({ kind: "dice", roll: undefined });
    const result = applyMinigameAction(player, requestFor(player, { type: "roll" }));
    const before = structuredClone(player);
    for (const reducedMotion of [false, true]) {
      const view = getMinigameGamePresentation(player.progression.minigames.pending!, "touch", reducedMotion);
      expect(view.board).toEqual({ kind: "dice", roll: result.roll });
      expect(view.status).toContain(result.roll!.naturalRolls.join(" + "));
    }
    expect(player).toEqual(before);
  });

  it("samples bounded deterministic meter positions without changing the pending session or scoring", () => {
    const player = playerAt("willowdaleRange");
    startMinigame(player, startRequest(player, "willowdaleRange"));
    const before = structuredClone(player);
    for (const difficulty of MINIGAME_DIFFICULTY_IDS) {
      for (const initial of [0, 27, 100]) {
        for (const elapsed of [0, 180, 1_800, 18_000]) {
          const aim = getArcheryMeterAim(initial, elapsed, difficulty);
          expect(aim).toBeGreaterThanOrEqual(0);
          expect(aim).toBeLessThanOrEqual(100);
          const view = getMinigameGamePresentation(player.progression.minigames.pending!, "gamepad", false, aim);
          expect(view.status).toContain(`Aim ${aim}`);
        }
      }
    }
    expect(player).toEqual(before);
    expect(getMinigameGamePresentation(player.progression.minigames.pending!, "pointer", true).status).toContain("Steady aim");
  });

  it("coalesces duplicate input and releases all remembered state at cleanup", () => {
    const gate = new MinigameInputGate();
    expect(gate.accept("fire", 0)).toBe(true);
    expect(gate.accept("fire", 50)).toBe(false);
    expect(gate.accept("fire", 100)).toBe(true);
    expect(gate.accept("bank", 100)).toBe(true);
    gate.clear();
    expect(gate.accept("fire", 100)).toBe(true);
  });

  it("uses the shared semantic context and exposes only relevant touch actions", () => {
    expect(isInputContext("minigame")).toBe(true);
    expect(mapKeyboardCode("Space", "minigame")).toBe("confirm");
    expect(mapKeyboardCode("ArrowLeft", "minigame")).toBe("navigateLeft");
    expect(isTouchActionAvailable("navigateLeft", "minigame")).toBe(true);
    expect(isTouchActionAvailable("confirm", "minigame")).toBe(true);
    expect(isTouchActionAvailable("cancel", "minigame")).toBe(true);
    for (const action of ["openMenu", "openParty", "openTips"] as const) {
      expect(isTouchActionAvailable(action, "minigame")).toBe(false);
    }
  });
});

describe("measured responsive panel geometry", () => {
  it.each([1, 1.25, 1.5])("keeps stacks, button grids, and bounded content clean at text scale %s", (scale) => {
    for (const canvasScale of [1, 0.65, 0.5]) {
      for (const bottom of [0, 100, 150]) {
        for (const count of [1, 2, 3, 4]) {
          const layout = layoutMinigamePanel({
            viewport: { x: 0, y: 0, width: 640, height: 528 },
            safeArea: { bottom }, titleHeight: 20 * scale,
            statusHeight: 44 * scale, promptHeight: 26 * scale,
            buttonHeight: Math.max(48, Math.ceil(44 / canvasScale)),
            buttonCount: count, columns: count === 4 ? 2 : 3,
          });
          const items = [layout.title, layout.status, layout.actions, layout.prompt];
          expect(auditLayout(items.map((bounds, index) => ({ id: String(index), bounds })), layout.panel).overlaps).toEqual([]);
          for (const bounds of items) expect(containsRect(layout.panel, bounds)).toBe(true);
          expect(layout.body.height).toBeGreaterThanOrEqual(0);
          expect(layout.grid.columns).toBe(count === 4 ? 2 : Math.min(3, count));
          for (const cell of layout.grid.cells) expect(cell.height * canvasScale).toBeGreaterThanOrEqual(44);
        }
      }
    }
  });

  it("paginates long instructions and records without blank pages or missing lines", () => {
    const pages = paginateMinigameLines(30, 24, 110);
    expect(pages.flat()).toEqual(Array.from({ length: 30 }, (_, index) => index));
    expect(pages.every((page) => page.length > 0 && page.length <= 4)).toBe(true);
    expect(paginateMinigameLines(0, 24, 110)).toEqual([]);
  });
});

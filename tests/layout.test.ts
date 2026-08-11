import { describe, expect, it } from "vitest";
import {
  auditLayout,
  centeredRect,
  getFocusableLayoutItems,
  getVisibleMeasuredRange,
  insetRect,
  layoutResponsiveGrid,
  layoutVerticalStack,
  paginateMeasuredItems,
  restoreLayoutFocus,
  wrapMeasuredText,
} from "../src/systems/layout";

describe("measured UI layout", () => {
  it("centers and clamps panels inside safe-area insets", () => {
    expect(centeredRect(
      { x: 0, y: 0, width: 320, height: 240 },
      { width: 400, height: 300 },
      { top: 12, right: 20, bottom: 28, left: 16 },
    )).toEqual({
      x: 16,
      y: 12,
      width: 284,
      height: 200,
    });
  });

  it("calculates an inset viewport without negative dimensions", () => {
    expect(insetRect(
      { x: 10, y: 20, width: 30, height: 40 },
      { top: 30, right: 30, bottom: 30, left: 30 },
    )).toEqual({ x: 40, y: 50, width: 0, height: 0 });
  });

  it("stacks variable-height rows from measured bounds", () => {
    const result = layoutVerticalStack([
      { id: "short", width: 40, height: 12 },
      { id: "wrapped", width: 80, height: 36 },
      { id: "button", width: 60, height: 20 },
    ], { x: 10, y: 5, width: 100, gap: 4, align: "center" });
    expect(result.items.map(({ id, x, y }) => ({ id, x, y }))).toEqual([
      { id: "short", x: 40, y: 5 },
      { id: "wrapped", x: 20, y: 21 },
      { id: "button", x: 30, y: 61 },
    ]);
    expect(result.height).toBe(76);
  });

  it("reflows responsive grids at the minimum viewport width", () => {
    const narrow = layoutResponsiveGrid({
      availableWidth: 180,
      minColumnWidth: 120,
      columnGap: 8,
      rowGap: 6,
      itemHeights: [20, 40, 30],
      maxColumns: 3,
    });
    expect(narrow.columns).toBe(1);
    expect(narrow.height).toBe(102);

    const wide = layoutResponsiveGrid({
      availableWidth: 400,
      minColumnWidth: 120,
      columnGap: 8,
      rowGap: 6,
      itemHeights: [20, 40, 30],
      maxColumns: 3,
    });
    expect(wide.columns).toBe(3);
    expect(wide.height).toBe(40);
  });

  it("paginates measured rows without splitting a wrapped row", () => {
    expect(paginateMeasuredItems([20, 40, 30, 80], 70, 5)).toEqual([
      [0, 1],
      [2],
      [3],
    ]);
  });

  it("returns only rows intersecting a scroll viewport", () => {
    expect(getVisibleMeasuredRange([20, 40, 30, 10], 25, 50, 5)).toEqual({
      start: 1,
      end: 3,
    });
  });

  it("wraps long localized-style words without clipping", () => {
    const lines = wrapMeasuredText(
      "An extraordinarilylongunbrokenlocalizedlabel appears",
      12,
      (value) => value.length,
    );
    expect(lines).toEqual([
      "An",
      "extraordinar",
      "ilylongunbro",
      "kenlocalized",
      "label",
      "appears",
    ]);
    expect(lines.every((line) => line.length <= 12)).toBe(true);
  });

  it("filters hidden menu rows and restores focus by stable ID", () => {
    const items = [
      { id: "party", visible: true, enabled: true },
      { id: "nautical", visible: false, enabled: true },
      { id: "crafting", visible: true, enabled: false },
      { id: "codex", visible: true, enabled: true },
    ];
    expect(getFocusableLayoutItems(items).map((item) => item.id)).toEqual([
      "party",
      "codex",
    ]);
    expect(restoreLayoutFocus(items, "codex")).toMatchObject({ index: 1 });
    expect(restoreLayoutFocus(items, "nautical", 8)).toMatchObject({ index: 1 });
  });

  it("detects unintended overlaps and viewport clipping", () => {
    const result = auditLayout([
      { id: "title", bounds: { x: 10, y: 10, width: 80, height: 20 } },
      { id: "button", bounds: { x: 10, y: 25, width: 80, height: 20 } },
      {
        id: "tooltip",
        bounds: { x: 10, y: 42, width: 80, height: 20 },
        allowOverlapWith: ["button"],
      },
    ], { x: 0, y: 0, width: 100, height: 60 });
    expect(result.overlaps.map(({ firstId, secondId }) => [
      firstId,
      secondId,
    ])).toEqual([["title", "button"]]);
    expect(result.clipping.map((entry) => entry.id)).toEqual(["tooltip"]);
  });
});

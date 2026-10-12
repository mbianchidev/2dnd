import { describe, expect, it } from "vitest";
import {
  auditLayout,
  centeredRect,
  getFocusableLayoutItems,
  getVisibleMeasuredRange,
  insetRect,
  layoutResponsiveGrid,
  layoutHorizontalStack,
  layoutVerticalStack,
  layoutAnchoredLabels,
  moveGridSelection,
  paginateMeasuredItems,
  restoreLayoutFocus,
  wrapMeasuredText,
} from "../src/systems/layout";

describe("measured UI layout", () => {
  it.each([
    { title: 176, replay: 131, close: 61 },
    { title: 220, replay: 158, close: 70 },
    { title: 264, replay: 187, close: 79 },
  ])("keeps measured Tips header controls disjoint at every text scale: %j", (sizes) => {
    const x = 49 + sizes.title + 8;
    const row = layoutHorizontalStack([
      { id: "replay", width: sizes.replay, height: 35 },
      { id: "close", width: sizes.close, height: 35 },
    ], { x, y: 55, width: 599 - x, gap: 8, justify: "end" });
    const report = auditLayout([
      { id: "title", bounds: { x: 49, y: 45, width: sizes.title, height: 32 } },
      ...row.items.map((item) => ({ id: item.id, bounds: item })),
    ], { x: 25, y: 29, width: 590, height: 470 });
    expect(report.overlaps).toEqual([]);
    expect(report.clipping).toEqual([]);
    expect(row.items[1]!.x + row.items[1]!.width).toBe(599);
  });

  it("lays out an empty horizontal stack without a phantom gap", () => {
    expect(layoutHorizontalStack([], { x: 12, gap: 8 })).toEqual({
      items: [], width: 0, height: 0,
    });
  });

  it("bounds measured battle pages by both content height and item count", () => {
    expect(paginateMeasuredItems([20, 20, 20, 20, 20, 20], 200, 0, 5))
      .toEqual([[0, 1, 2, 3, 4], [5]]);
    expect(paginateMeasuredItems([60, 60, 60], 125, 6, 5)).toEqual([[0], [1], [2]]);
    expect(() => paginateMeasuredItems([20], 200, 0, 0)).toThrow(RangeError);
  });
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

  it("keeps enlarged anchored location labels within map edges and apart", () => {
    const viewport = { x: 0, y: 0, width: 640, height: 480 };
    const labels = layoutAnchoredLabels([
      { id: "city", bounds: { x: -20, y: -12, width: 180, height: 40 } },
      { id: "shop", bounds: { x: 30, y: 8, width: 150, height: 38 } },
      { id: "port", bounds: { x: 580, y: 460, width: 160, height: 32 } },
    ], viewport);
    expect(auditLayout(labels, viewport)).toEqual({ overlaps: [], clipping: [] });
    expect(labels.map((item) => item.id)).toEqual(["city", "shop", "port"]);
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

  it("moves focus spatially through complete and partial grids", () => {
    expect(moveGridSelection(0, 6, 2, "right")).toBe(1);
    expect(moveGridSelection(1, 6, 2, "down")).toBe(3);
    expect(moveGridSelection(3, 6, 2, "left")).toBe(2);
    expect(moveGridSelection(2, 6, 2, "up")).toBe(0);
    expect(moveGridSelection(4, 5, 2, "right")).toBe(4);
    expect(moveGridSelection(3, 5, 2, "down")).toBe(1);
    expect(moveGridSelection(99, 6, 2, "down")).toBe(1);
    expect(moveGridSelection(0, 0, 2, "down")).toBe(-1);
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

  it("detects glyphs clipped inside an otherwise in-bounds fixed text surface", () => {
    const bounds = { x: 10, y: 10, width: 120, height: 40 };
    const result = auditLayout([{
      id: "slot-row", bounds, contentBounds: { ...bounds, height: 65 },
    }], { x: 0, y: 0, width: 200, height: 200 });
    expect(result.clipping).toEqual([{
      id: "slot-row", bounds: { ...bounds, height: 65 }, viewport: bounds, reason: "content",
    }]);
  });
});

import { describe, expect, it } from "vitest";
import { auditLayout, containsRect } from "../src/systems/layout";
import { layoutProgressionPanel } from "../src/systems/progressionPresentation";

describe("measured progression panel", () => {
  it.each([1, 1.25, 1.5])("fits long paginated lists at text scale %s", (scale) => {
    for (const desiredButtonHeight of [38 * scale, 72, 112]) {
      const viewport = { x: 16, y: 12, width: 608, height: 504 };
      const layout = layoutProgressionPanel({
        viewport, headerBottom: 70 + 32 * scale,
        desiredButtonHeight, hintHeight: 22 * scale,
        itemCount: 18, selectedIndex: 17,
      });
      const regions = [layout.list, layout.details, layout.controls, layout.primary, layout.hint];
      expect(regions.every((region) => containsRect(viewport, region))).toBe(true);
      expect(auditLayout(regions.map((bounds, index) => ({
        id: String(index), bounds,
      })), viewport).overlaps).toEqual([]);
      expect(layout.pages.flat()).toEqual(Array.from({ length: 18 }, (_, index) => index));
      expect(layout.pages[layout.selectedPage]).toContain(17);
      for (const page of layout.pages) {
        expect(page.length * layout.buttonHeight + (page.length - 1) * 6)
          .toBeLessThanOrEqual(layout.list.height);
      }
    }
  });

  it("leaves no empty rows when the last page contains one entry", () => {
    const layout = layoutProgressionPanel({
      viewport: { x: 0, y: 0, width: 640, height: 528 },
      headerBottom: 80, desiredButtonHeight: 44, hintHeight: 24,
      itemCount: 11, selectedIndex: 10,
    });
    expect(layout.pages.every((page) => page.length > 0)).toBe(true);
    expect(layout.pages.flat()).toHaveLength(11);
    const page = layout.pages[layout.selectedPage]!;
    expect(page).toEqual([10]);
  });
});

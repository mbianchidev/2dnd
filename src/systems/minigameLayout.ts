import { centeredRect, layoutResponsiveGrid, paginateMeasuredItems } from "./layout";
import type { GridLayout, LayoutInsets, LayoutRect } from "./layout";

export interface MinigamePanelLayout {
  readonly panel: LayoutRect;
  readonly title: LayoutRect;
  readonly status: LayoutRect;
  readonly body: LayoutRect;
  readonly actions: LayoutRect;
  readonly prompt: LayoutRect;
  readonly grid: GridLayout;
}

export function layoutMinigamePanel(input: {
  readonly viewport: LayoutRect;
  readonly safeArea: Partial<LayoutInsets>;
  readonly titleHeight: number;
  readonly statusHeight: number;
  readonly promptHeight: number;
  readonly buttonHeight: number;
  readonly buttonCount: number;
  readonly columns: number;
}): MinigamePanelLayout {
  const panel = centeredRect(input.viewport, {
    width: Math.min(608, input.viewport.width - 24),
    height: input.viewport.height - 24,
  }, input.safeArea);
  const padding = 16;
  const gap = 8;
  const contentWidth = Math.max(1, panel.width - padding * 2);
  const columns = Math.min(input.columns, Math.max(1, input.buttonCount));
  const grid = layoutResponsiveGrid({
    availableWidth: contentWidth,
    minColumnWidth: Math.max(1, (contentWidth - (columns - 1) * 8) / columns - 0.001),
    columnGap: 8, rowGap: 8, maxColumns: columns,
    itemHeights: Array.from({ length: input.buttonCount }, () => input.buttonHeight),
  });
  const title = {
    x: panel.x + padding, y: panel.y + padding,
    width: contentWidth, height: input.titleHeight,
  };
  const status = { ...title, y: title.y + title.height + gap, height: input.statusHeight };
  const prompt = {
    ...title, y: panel.y + panel.height - padding - input.promptHeight,
    height: input.promptHeight,
  };
  const actions = {
    ...title, y: prompt.y - gap - grid.height,
    height: grid.height,
  };
  const body = {
    ...title, y: status.y + status.height + gap,
    height: Math.max(0, actions.y - gap - status.y - status.height - gap),
  };
  return { panel, title, status, body, actions, prompt, grid };
}

export function paginateMinigameLines(
  lineCount: number,
  lineHeight: number,
  availableHeight: number,
): number[][] {
  return paginateMeasuredItems(
    Array.from({ length: lineCount }, () => lineHeight),
    availableHeight,
    3,
  );
}

import { insetRect, paginateMeasuredItems, type LayoutRect } from "./layout";

export interface ProgressionPanelLayout {
  list: LayoutRect;
  details: LayoutRect;
  controls: LayoutRect;
  primary: LayoutRect;
  hint: LayoutRect;
  buttonHeight: number;
  pages: number[][];
  selectedPage: number;
}

/** Fit measured content, touch targets and both control rows inside the modal viewport. */
export function layoutProgressionPanel(options: {
  viewport: LayoutRect;
  headerBottom: number;
  desiredButtonHeight: number;
  hintHeight: number;
  itemCount: number;
  selectedIndex: number;
}): ProgressionPanelLayout {
  const inner = insetRect(options.viewport, { top: 12, right: 12, bottom: 12, left: 12 });
  const bodyY = options.headerBottom + 8;
  const availableHeight = inner.y + inner.height - bodyY - options.hintHeight - 28;
  const buttonHeight = Math.min(options.desiredButtonHeight, Math.floor(availableHeight / 3));
  const controlsY = inner.y + inner.height - options.hintHeight - 8 - buttonHeight * 2 - 6;
  const bodyHeight = controlsY - bodyY - 10;
  const listWidth = Math.floor(inner.width * 0.42);
  const pages = paginateMeasuredItems(
    Array.from({ length: options.itemCount }, () => buttonHeight), bodyHeight, 6,
  );
  const selectedPage = Math.max(0, pages.findIndex((page) => page.includes(options.selectedIndex)));
  return {
    list: { x: inner.x, y: bodyY, width: listWidth, height: bodyHeight },
    details: {
      x: inner.x + listWidth + 12, y: bodyY,
      width: inner.width - listWidth - 12, height: bodyHeight,
    },
    controls: { x: inner.x, y: controlsY, width: inner.width, height: buttonHeight },
    primary: {
      x: inner.x, y: controlsY + buttonHeight + 6,
      width: inner.width, height: buttonHeight,
    },
    hint: {
      x: inner.x, y: inner.y + inner.height - options.hintHeight,
      width: inner.width, height: options.hintHeight,
    },
    buttonHeight,
    pages,
    selectedPage,
  };
}

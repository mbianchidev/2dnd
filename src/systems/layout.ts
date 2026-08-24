export interface LayoutSize {
  width: number;
  height: number;
}

export interface LayoutPoint {
  x: number;
  y: number;
}

export interface LayoutRect extends LayoutPoint, LayoutSize {}

export interface LayoutInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface StackItem {
  id: string;
  width: number;
  height: number;
}

export interface PositionedStackItem extends StackItem, LayoutPoint {}

export interface StackLayout {
  items: PositionedStackItem[];
  width: number;
  height: number;
}

export interface GridLayoutOptions {
  availableWidth: number;
  minColumnWidth: number;
  columnGap: number;
  rowGap: number;
  itemHeights: number[];
  maxColumns?: number;
}

export interface GridCell extends LayoutRect {
  index: number;
  row: number;
  column: number;
}

export interface GridLayout {
  cells: GridCell[];
  columns: number;
  rows: number;
  width: number;
  height: number;
}

export type GridNavigationDirection = "up" | "down" | "left" | "right";

export interface LayoutAuditItem {
  id: string;
  bounds: LayoutRect;
  allowOverlapWith?: readonly string[];
  containedBy?: string;
}

export interface LayoutOverlap {
  firstId: string;
  secondId: string;
  intersection: LayoutRect;
}

export interface LayoutClipping {
  id: string;
  bounds: LayoutRect;
  viewport: LayoutRect;
}

export interface LayoutAuditResult {
  overlaps: LayoutOverlap[];
  clipping: LayoutClipping[];
}

export interface FocusableLayoutItem {
  id: string;
  visible: boolean;
  enabled: boolean;
}

export const ZERO_INSETS: LayoutInsets = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function insetRect(
  rect: LayoutRect,
  insets: Partial<LayoutInsets>,
): LayoutRect {
  const top = finiteNonNegative(insets.top ?? 0);
  const right = finiteNonNegative(insets.right ?? 0);
  const bottom = finiteNonNegative(insets.bottom ?? 0);
  const left = finiteNonNegative(insets.left ?? 0);
  return {
    x: rect.x + left,
    y: rect.y + top,
    width: Math.max(0, rect.width - left - right),
    height: Math.max(0, rect.height - top - bottom),
  };
}

export function clampRectToViewport(
  rect: LayoutRect,
  viewport: LayoutRect,
): LayoutRect {
  const width = Math.min(finiteNonNegative(rect.width), viewport.width);
  const height = Math.min(finiteNonNegative(rect.height), viewport.height);
  return {
    x: Math.min(
      Math.max(rect.x, viewport.x),
      viewport.x + viewport.width - width,
    ),
    y: Math.min(
      Math.max(rect.y, viewport.y),
      viewport.y + viewport.height - height,
    ),
    width,
    height,
  };
}

export function centeredRect(
  viewport: LayoutRect,
  requestedSize: LayoutSize,
  padding: Partial<LayoutInsets> = ZERO_INSETS,
): LayoutRect {
  const available = insetRect(viewport, padding);
  const width = Math.min(finiteNonNegative(requestedSize.width), available.width);
  const height = Math.min(
    finiteNonNegative(requestedSize.height),
    available.height,
  );
  return {
    x: available.x + Math.floor((available.width - width) / 2),
    y: available.y + Math.floor((available.height - height) / 2),
    width,
    height,
  };
}

export function layoutVerticalStack(
  items: readonly StackItem[],
  options: {
    x?: number;
    y?: number;
    gap?: number;
    align?: "start" | "center" | "end";
    width?: number;
  } = {},
): StackLayout {
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const gap = finiteNonNegative(options.gap ?? 0);
  const naturalWidth = items.reduce(
    (max, item) => Math.max(max, finiteNonNegative(item.width)),
    0,
  );
  const width = Math.max(naturalWidth, finiteNonNegative(options.width ?? 0));
  const align = options.align ?? "start";
  let cursorY = y;
  const positioned = items.map((item) => {
    const itemWidth = finiteNonNegative(item.width);
    const itemHeight = finiteNonNegative(item.height);
    const offsetX = align === "center"
      ? (width - itemWidth) / 2
      : align === "end"
      ? width - itemWidth
      : 0;
    const result = {
      ...item,
      width: itemWidth,
      height: itemHeight,
      x: x + offsetX,
      y: cursorY,
    };
    cursorY += itemHeight + gap;
    return result;
  });
  return {
    items: positioned,
    width,
    height: items.length === 0 ? 0 : cursorY - y - gap,
  };
}

export function layoutResponsiveGrid(
  options: GridLayoutOptions,
): GridLayout {
  const availableWidth = finiteNonNegative(options.availableWidth);
  const minColumnWidth = Math.max(1, finiteNonNegative(options.minColumnWidth));
  const columnGap = finiteNonNegative(options.columnGap);
  const rowGap = finiteNonNegative(options.rowGap);
  const fittingColumns = Math.max(
    1,
    Math.floor((availableWidth + columnGap) / (minColumnWidth + columnGap)),
  );
  const columns = Math.max(
    1,
    Math.min(options.maxColumns ?? fittingColumns, fittingColumns),
  );
  const columnWidth = Math.max(
    0,
    (availableWidth - columnGap * (columns - 1)) / columns,
  );
  const rows = Math.ceil(options.itemHeights.length / columns);
  const rowHeights = Array.from({ length: rows }, () => 0);
  options.itemHeights.forEach((height, index) => {
    const row = Math.floor(index / columns);
    rowHeights[row] = Math.max(rowHeights[row], finiteNonNegative(height));
  });
  const rowOffsets: number[] = [];
  let cursorY = 0;
  for (const height of rowHeights) {
    rowOffsets.push(cursorY);
    cursorY += height + rowGap;
  }
  const cells = options.itemHeights.map((height, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    return {
      index,
      row,
      column,
      x: column * (columnWidth + columnGap),
      y: rowOffsets[row],
      width: columnWidth,
      height: finiteNonNegative(height),
    };
  });
  return {
    cells,
    columns,
    rows,
    width: availableWidth,
    height: rows === 0 ? 0 : cursorY - rowGap,
  };
}

export function moveGridSelection(
  index: number,
  itemCount: number,
  columns: number,
  direction: GridNavigationDirection,
): number {
  const count = Number.isFinite(itemCount) ? Math.max(0, Math.floor(itemCount)) : 0;
  if (count === 0) return -1;
  const columnCount = Number.isFinite(columns)
    ? Math.max(1, Math.floor(columns))
    : 1;
  const current = Number.isFinite(index)
    ? Math.min(Math.max(0, Math.floor(index)), count - 1)
    : 0;
  const row = Math.floor(current / columnCount);
  const column = current % columnCount;

  if (direction === "left" || direction === "right") {
    const rowStart = row * columnCount;
    const rowLength = Math.min(columnCount, count - rowStart);
    const offset = direction === "left" ? -1 : 1;
    const nextColumn = (column + offset + rowLength) % rowLength;
    return rowStart + nextColumn;
  }

  const rowCount = Math.ceil(count / columnCount);
  const offset = direction === "up" ? -1 : 1;
  for (let distance = 1; distance <= rowCount; distance += 1) {
    const nextRow = (row + offset * distance + rowCount) % rowCount;
    const candidate = nextRow * columnCount + column;
    if (candidate < count) return candidate;
  }
  return current;
}

export function paginateMeasuredItems(
  itemHeights: readonly number[],
  availableHeight: number,
  gap = 0,
): number[][] {
  const heightLimit = finiteNonNegative(availableHeight);
  const safeGap = finiteNonNegative(gap);
  const pages: number[][] = [];
  let current: number[] = [];
  let usedHeight = 0;
  itemHeights.forEach((rawHeight, index) => {
    const height = finiteNonNegative(rawHeight);
    const nextHeight = current.length === 0
      ? height
      : usedHeight + safeGap + height;
    if (current.length > 0 && nextHeight > heightLimit) {
      pages.push(current);
      current = [index];
      usedHeight = height;
      return;
    }
    current.push(index);
    usedHeight = nextHeight;
  });
  if (current.length > 0) pages.push(current);
  return pages;
}

export function getFocusableLayoutItems<T extends FocusableLayoutItem>(
  items: readonly T[],
): T[] {
  return items.filter((item) => item.visible && item.enabled);
}

export function restoreLayoutFocus<T extends FocusableLayoutItem>(
  items: readonly T[],
  previousId?: string,
  fallbackIndex = 0,
): { items: T[]; index: number } {
  const focusable = getFocusableLayoutItems(items);
  if (focusable.length === 0) return { items: focusable, index: -1 };
  const previousIndex = previousId
    ? focusable.findIndex((item) => item.id === previousId)
    : -1;
  return {
    items: focusable,
    index: previousIndex >= 0
      ? previousIndex
      : Math.min(Math.max(0, fallbackIndex), focusable.length - 1),
  };
}

export function getVisibleMeasuredRange(
  itemHeights: readonly number[],
  scrollOffset: number,
  viewportHeight: number,
  gap = 0,
): { start: number; end: number } {
  const safeOffset = finiteNonNegative(scrollOffset);
  const safeHeight = finiteNonNegative(viewportHeight);
  const safeGap = finiteNonNegative(gap);
  let cursor = 0;
  let start = itemHeights.length;
  let end = itemHeights.length;
  for (let index = 0; index < itemHeights.length; index += 1) {
    const height = finiteNonNegative(itemHeights[index]);
    const itemEnd = cursor + height;
    if (start === itemHeights.length && itemEnd > safeOffset) start = index;
    if (cursor < safeOffset + safeHeight) end = index + 1;
    cursor = itemEnd + safeGap;
  }
  return { start, end: Math.max(start, end) };
}

export function wrapMeasuredText(
  text: string,
  maxWidth: number,
  measure: (value: string) => number,
): string[] {
  const width = finiteNonNegative(maxWidth);
  if (text.length === 0) return [""];
  const result: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      result.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const candidate = line.length === 0 ? word : `${line} ${word}`;
      if (measure(candidate) <= width) {
        line = candidate;
        continue;
      }
      if (line.length > 0) result.push(line);
      if (measure(word) <= width) {
        line = word;
        continue;
      }
      let fragment = "";
      for (const char of word) {
        if (fragment.length > 0 && measure(`${fragment}${char}`) > width) {
          result.push(fragment);
          fragment = char;
        } else {
          fragment += char;
        }
      }
      line = fragment;
    }
    if (line.length > 0) result.push(line);
  }
  return result;
}

export function intersectRects(
  first: LayoutRect,
  second: LayoutRect,
): LayoutRect | null {
  const x = Math.max(first.x, second.x);
  const y = Math.max(first.y, second.y);
  const right = Math.min(first.x + first.width, second.x + second.width);
  const bottom = Math.min(first.y + first.height, second.y + second.height);
  if (right <= x || bottom <= y) return null;
  return { x, y, width: right - x, height: bottom - y };
}

export function containsRect(container: LayoutRect, item: LayoutRect): boolean {
  return item.x >= container.x
    && item.y >= container.y
    && item.x + item.width <= container.x + container.width
    && item.y + item.height <= container.y + container.height;
}

export function auditLayout(
  items: readonly LayoutAuditItem[],
  viewport?: LayoutRect,
): LayoutAuditResult {
  const overlaps: LayoutOverlap[] = [];
  const clipping: LayoutClipping[] = [];
  items.forEach((item, index) => {
    if (viewport && !containsRect(viewport, item.bounds)) {
      clipping.push({ id: item.id, bounds: item.bounds, viewport });
    }
    for (let otherIndex = index + 1; otherIndex < items.length; otherIndex += 1) {
      const other = items[otherIndex];
      if (
        item.allowOverlapWith?.includes(other.id)
        || other.allowOverlapWith?.includes(item.id)
        || item.containedBy === other.id
        || other.containedBy === item.id
      ) {
        continue;
      }
      const intersection = intersectRects(item.bounds, other.bounds);
      if (intersection) {
        overlaps.push({
          firstId: item.id,
          secondId: other.id,
          intersection,
        });
      }
    }
  });
  return { overlaps, clipping };
}

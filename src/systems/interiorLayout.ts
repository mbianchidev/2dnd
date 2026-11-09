import type { InteriorPropData } from "../data/mapTypes";

export function containsTileFootprint(
  prop: Pick<InteriorPropData, "x" | "y" | "width" | "height">, x: number, y: number,
): boolean {
  return x >= prop.x && y >= prop.y && x < prop.x + (prop.width ?? 1) && y < prop.y + (prop.height ?? 1);
}

export function getInteriorPropDistance(prop: InteriorPropData, x: number, y: number): number {
  const nearestX = Math.max(prop.x, Math.min(prop.x + (prop.width ?? 1) - 1, x));
  const nearestY = Math.max(prop.y, Math.min(prop.y + (prop.height ?? 1) - 1, y));
  return Math.abs(nearestX - x) + Math.abs(nearestY - y);
}

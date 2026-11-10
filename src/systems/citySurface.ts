import { Terrain } from "../data/mapTypes";
import type { CityChunk } from "../data/mapTypes";
import { containsTileFootprint } from "./interiorLayout";

/** A rug in each connected walk-through floor adds decoration, never collision or an interaction. */
export function getWalkthroughRugTiles(
  map: readonly (readonly Terrain[])[],
): readonly { readonly x: number; readonly y: number }[] {
  const rugs: Array<{ x: number; y: number }> = [];
  const visited = new Set<string>();
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[y]!.length; x++) {
      if (map[y]![x] !== Terrain.ShopFloor || visited.has(`${x},${y}`)) continue;
      const tiles: Array<{ x: number; y: number }> = [];
      const queue = [{ x, y }];
      while (queue.length) {
        const tile = queue.pop()!;
        const key = `${tile.x},${tile.y}`;
        if (visited.has(key) || map[tile.y]?.[tile.x] !== Terrain.ShopFloor) continue;
        visited.add(key);
        tiles.push(tile);
        for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
          queue.push({ x: tile.x + dx!, y: tile.y + dy! });
        }
      }
      const centerX = tiles.reduce((total, tile) => total + tile.x, 0) / tiles.length;
      const centerY = tiles.reduce((total, tile) => total + tile.y, 0) / tiles.length;
      const distance = (tile: { x: number; y: number }): number =>
        (tile.x - centerX) ** 2 + (tile.y - centerY) ** 2;
      rugs.push(tiles.reduce((nearest, tile) => distance(tile) < distance(nearest) ? tile : nearest));
    }
  }
  return rugs;
}

/** Multi-tile props own their art; their collision tiles must never redraw miniature buildings or walls. */
export function getCitySurfaceTerrainOverride(chunk: CityChunk, x: number, y: number): Terrain | "fog" | undefined {
  const interior = chunk.interior;
  if (interior) {
    if (!containsTileFootprint(interior.bounds, x, y)) return "fog";
    if (interior.props.some((prop) => prop.kind !== "window" && prop.kind !== "painting"
      && containsTileFootprint(prop, x, y))) return Terrain.ShopFloor;
    return undefined;
  }
  if (chunk.mapData[y]?.[x] === Terrain.Fountain
    || chunk.buildings?.some((building) => containsTileFootprint(building, x, y))) return Terrain.CityFloor;
  return undefined;
}

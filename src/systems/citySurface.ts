import { Terrain } from "../data/mapTypes";
import type { CityChunk } from "../data/mapTypes";
import { containsTileFootprint } from "./interiorLayout";

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

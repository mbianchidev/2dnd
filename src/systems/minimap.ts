import { Terrain } from "../data/mapTypes";
import { WORLD_ART_COLORS } from "./terrainArt";
import type { LayoutRect } from "./layout";

export type MinimapMarker = "exit" | "door" | "stairs" | "town" | "boss" | "story";
export interface MinimapCell {
  readonly dx: number;
  readonly dy: number;
  readonly color: number;
  readonly explored: boolean;
  readonly marker?: MinimapMarker;
}
export interface MinimapPlan {
  readonly cells: readonly MinimapCell[];
  readonly description: string;
}

function terrainMarker(terrain: Terrain): MinimapMarker | undefined {
  if (terrain === Terrain.CityGate) return "door";
  if (terrain === Terrain.CityExit || terrain === Terrain.DungeonExit) return "exit";
  if (terrain === Terrain.DungeonStairs) return "stairs";
  if (terrain === Terrain.Town || terrain === Terrain.Dungeon) return "town";
  if (terrain === Terrain.Boss || terrain === Terrain.DungeonBoss) return "boss";
  return undefined;
}

/** A north-up local window; fogged terrain and hidden markers never enter its output. */
export function createMinimapPlan(
  map: readonly (readonly Terrain[])[],
  playerX: number,
  playerY: number,
  isExplored: (x: number, y: number) => boolean,
  markers: ReadonlyMap<string, MinimapMarker | undefined> = new Map(),
): MinimapPlan {
  const cells: MinimapCell[] = [];
  const visibleMarkers: string[] = [];
  for (let dy = -5; dy <= 5; dy++) {
    for (let dx = -5; dx <= 5; dx++) {
      if (dx * dx + dy * dy > 25) continue;
      const x = playerX + dx;
      const y = playerY + dy;
      const terrain = map[y]?.[x];
      if (terrain === undefined) continue;
      const explored = isExplored(x, y);
      const marker = explored ? markers.has(`${x},${y}`) ? markers.get(`${x},${y}`) : terrainMarker(terrain) : undefined;
      cells.push({ dx, dy, explored, color: explored ? WORLD_ART_COLORS[terrain] : 0x27353c, marker });
      if (marker) visibleMarkers.push(`${marker} ${Math.abs(dx)} ${dx < 0 ? "west" : "east"}, ${Math.abs(dy)} ${dy < 0 ? "north" : "south"}`);
    }
  }
  return {
    cells,
    description: `North-up exploration minimap. Tile ${playerX + 1}, ${playerY + 1}. `
      + (visibleMarkers.length ? `${visibleMarkers.join("; ")}. ` : "")
      + "Dark areas are unexplored. The white arrow is your position.",
  };
}

export function getMinimapBounds(viewport: LayoutRect, playerX: number, playerY: number): LayoutRect {
  const width = Math.min(120, Math.max(80, viewport.width * 0.24));
  const height = Math.min(124, Math.max(88, viewport.height * 0.24));
  const avoidHero = playerX >= 16 && playerY <= 4;
  return {
    x: avoidHero ? viewport.x + 8 : viewport.x + viewport.width - width - 8,
    y: viewport.y + 8, width, height,
  };
}

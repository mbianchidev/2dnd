import { MAP_HEIGHT, MAP_WIDTH, Terrain, WORLD_HEIGHT, WORLD_WIDTH } from "../data/map";
import { getBoat, getSeaZoneAt } from "../data/nautical";
import { findBoat } from "./nauticalState";
import type { CardinalHeading, SeaLocation } from "../data/nautical";
import type { NauticalState } from "./nauticalState";
import type { PlayerPosition } from "./player";

export interface SailingMoveCheck {
  readonly ok: boolean;
  readonly reason?: string;
  readonly target?: PlayerPosition;
  readonly seaLocation?: SeaLocation;
}

export function canSailTo(
  state: NauticalState,
  chunkX: number,
  chunkY: number,
  tileX: number,
  tileY: number,
): boolean {
  const boat = findBoat(state);
  const sea = getSeaZoneAt(chunkX, chunkY, tileX, tileY);
  return state.sailing
    && !!boat
    && boat.condition > 0
    && !!sea
    && (sea.depth === "shallow" || getBoat(boat.id).deepWaterCapable);
}

/** Shared cardinal destination for embarkation, landing, sailing, and harbor courses. */
export function getNauticalMoveTarget(
  position: PlayerPosition,
  heading: CardinalHeading,
): PlayerPosition | undefined {
  let chunkX = position.chunkX;
  let chunkY = position.chunkY;
  let x = position.x;
  let y = position.y;
  if (heading === "north") y -= 1;
  if (heading === "east") x += 1;
  if (heading === "south") y += 1;
  if (heading === "west") x -= 1;
  if (x < 0) {
    chunkX -= 1;
    x = MAP_WIDTH - 1;
  } else if (x >= MAP_WIDTH) {
    chunkX += 1;
    x = 0;
  }
  if (y < 0) {
    chunkY -= 1;
    y = MAP_HEIGHT - 1;
  } else if (y >= MAP_HEIGHT) {
    chunkY += 1;
    y = 0;
  }
  if (chunkX < 0 || chunkX >= WORLD_WIDTH || chunkY < 0 || chunkY >= WORLD_HEIGHT) {
    return undefined;
  }
  return {
    ...position, chunkX, chunkY, x, y,
    inCity: false, cityId: "", cityChunkIndex: 0,
    inDungeon: false, dungeonId: "", dungeonLevel: 0,
  };
}

/** Validate without mutating navigation, discovery, condition, or campaign position. */
export function resolveSailingMove(
  state: NauticalState,
  position: PlayerPosition,
  heading: CardinalHeading,
  terrainAt: (chunkX: number, chunkY: number, x: number, y: number) => Terrain | undefined,
  isBlocked: (target: PlayerPosition) => boolean,
): SailingMoveCheck {
  const target = getNauticalMoveTarget(position, heading);
  if (!target) return { ok: false, reason: "The world edge blocks sailing." };
  if (terrainAt(target.chunkX, target.chunkY, target.x, target.y) !== Terrain.Water) {
    return { ok: false, reason: "There is no navigable water ahead." };
  }
  if (isBlocked(target)) return { ok: false, reason: "The water approach is blocked." };
  if (!canSailTo(state, target.chunkX, target.chunkY, target.x, target.y)) {
    return { ok: false, reason: "The boat cannot sail to that water." };
  }
  return {
    ok: true, target,
    seaLocation: getSeaZoneAt(target.chunkX, target.chunkY, target.x, target.y),
  };
}

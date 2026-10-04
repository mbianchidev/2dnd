import {
  DEITIES,
  DEVOTION_SOURCE_DEFINITIONS,
  TEMPLES,
  getTemple,
  isTempleId,
} from "../data/devotion";
import { getCity, getCityChunk, isWalkable } from "../data/map";
import { applyDevotionSource } from "./devotion";
import { getDevotionHistoryLines, getDevotionProfileLines } from "./devotionProfile";
import type { PlayerState } from "./player";

export interface DevotionDebugResult {
  readonly changed: boolean;
  readonly relocated: boolean;
  readonly lines: readonly string[];
}

export function executeDevotionDebugCommand(player: PlayerState, args: string): DevotionDebugResult {
  const [command = "status", id] = args.trim().split(/\s+/).filter(Boolean);
  const result = (lines: readonly string[], changed = false, relocated = false): DevotionDebugResult =>
    ({ changed, relocated, lines });
  if (command === "list") return result([
    ...DEITIES.map((deity) => `${deity.id}: ${deity.name} (${deity.domainIds.join(", ")})`),
    ...TEMPLES.map((temple) => `${temple.id}: ${temple.name} (${temple.cityId}:${temple.cityChunkIndex}, ${temple.x},${temple.y})`),
    `Sources: ${DEVOTION_SOURCE_DEFINITIONS.map((source) => source.id).join(", ")}`,
  ]);
  if (command === "status") return result([
    ...getDevotionProfileLines(player), ...getDevotionHistoryLines(player),
  ]);
  if (command === "source") {
    const source = DEVOTION_SOURCE_DEFINITIONS.find((entry) => entry.id === id);
    if (!source) return result(["Unknown devotion source. Use /devotion list."]);
    const mutation = applyDevotionSource(player, source.id, { debug: true });
    return result([`[DEBUG] ${mutation.message}`], mutation.changed);
  }
  if (command === "near") {
    if (!isTempleId(id)) return result(["Unknown temple. Use /devotion list."]);
    const temple = getTemple(id);
    const city = getCity(temple.cityId);
    const chunk = city ? getCityChunk(city, temple.cityChunkIndex) : undefined;
    if (!city || !chunk) return result([`Temple ${id} has no valid city district.`]);
    const approach = [
      { x: temple.x + 1, y: temple.y }, { x: temple.x - 1, y: temple.y },
      { x: temple.x, y: temple.y + 1 }, { x: temple.x, y: temple.y - 1 },
    ].find((tile) => {
      const terrain = chunk.mapData[tile.y]?.[tile.x];
      return terrain !== undefined && isWalkable(terrain);
    });
    if (!approach) return result([`Temple ${id} has no safe adjacent approach.`]);
    Object.assign(player.position, {
      chunkX: city.chunkX, chunkY: city.chunkY,
      inDungeon: false, dungeonId: "", dungeonLevel: 0,
      inCity: true, cityId: city.id, cityChunkIndex: temple.cityChunkIndex,
      ...approach,
    });
    player.progression.nautical.sailing = false;
    return result([`Near ${temple.name}. Interact normally; no visit, affiliation, devotion or blessing was granted.`], true, true);
  }
  return result(["Usage: /devotion <list|status|near templeId|source sourceId>. Sources are debug-consumed without points; ledgers cannot be reset."]);
}

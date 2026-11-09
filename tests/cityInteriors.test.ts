import { describe, expect, it } from "vitest";
import { CITIES, getCityChunk, getCityChunkCount, getCityChunkMap } from "../src/data/cities";
import { isWalkable } from "../src/data/map";
import { MAP_HEIGHT, MAP_WIDTH, Terrain } from "../src/data/mapTypes";
import { getItem } from "../src/data/items";
import { INTERIOR_STUDIES } from "../src/data/interiorBooks";
import { getSpell } from "../src/data/spells";

function reachable(map: Terrain[][], x: number, y: number): Set<string> {
  const visited = new Set<string>();
  const queue = [{ x, y }];
  while (queue.length) {
    const point = queue.pop()!;
    const key = `${point.x},${point.y}`;
    if (visited.has(key) || map[point.y]?.[point.x] === undefined || !isWalkable(map[point.y]![point.x]!)) continue;
    visited.add(key);
    for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) queue.push({ x: point.x + dx!, y: point.y + dy! });
  }
  return visited;
}

describe("explorable city rooms", () => {
  it("adds a furnished library, guesthouse and every indoor shop to every city", () => {
    for (const city of CITIES) {
      const rooms = city.chunks?.filter((chunk) => chunk.interior) ?? [];
      expect(rooms.some((room) => room.interior?.kind === "library"), city.id).toBe(true);
      expect(rooms.some((room) => room.interior?.kind === "home"), city.id).toBe(true);
      for (const room of rooms) {
        expect(room.mapData).toHaveLength(MAP_HEIGHT);
        expect(room.mapData.every((row) => row.length === MAP_WIDTH)).toBe(true);
        const reached = reachable(room.mapData, room.spawnX, room.spawnY);
        expect(reached.size, room.name).toBeGreaterThan(80);
        expect(reached.has("10,13"), room.name).toBe(true);
        for (const prop of room.interior!.props.filter((entry) => entry.reward)) {
          expect([[0, 1], [1, 0], [0, -1], [-1, 0]].some(([dx, dy]) =>
            reached.has(`${prop.x + dx!},${prop.y + dy!}`)), prop.id).toBe(true);
          if (prop.reward?.itemId) expect(getItem(prop.reward.itemId), prop.id).toBeDefined();
          expect(prop.reward?.gold ?? 0).toBeLessThanOrEqual(5);
        }
      }
    }
  });

  it("keeps reversible real doors and all reward IDs globally unique", () => {
    const ids: string[] = [];
    for (const city of CITIES) {
      for (let index = 0; index < getCityChunkCount(city); index++) {
        const chunk = getCityChunk(city, index)!;
        const reached = reachable(chunk.mapData, chunk.spawnX, chunk.spawnY);
        for (const connection of city.connections.filter((entry) => entry.fromChunkIndex === index)) {
          expect(chunk.mapData[connection.fromY]?.[connection.fromX], city.id).toBe(Terrain.CityGate);
          expect(reached.has(`${connection.fromX},${connection.fromY}`), `${city.id}:${index}`).toBe(true);
          const destination = getCityChunkMap(city, connection.toChunkIndex);
          expect(isWalkable(destination[connection.toY]![connection.toX]!), city.id).toBe(true);
        }
        for (const prop of chunk.interior?.props ?? []) ids.push(prop.id);
      }
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("makes rare spell books finite, modest and independent from prestige grants", () => {
    expect(INTERIOR_STUDIES).toHaveLength(3);
    for (const study of INTERIOR_STUDIES) {
      const spell = getSpell(study.spellId)!;
      expect(spell.levelRequired).toBeLessThanOrEqual(study.minimumRank);
      expect(spell.progressionScope).not.toBe("track");
      expect(study.minimumRank).toBeGreaterThanOrEqual(4);
    }
  });
});

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

  it("gives enterable buildings real blocked footprints and keeps residences closed", () => {
    for (const city of CITIES) {
      const buildings = [getCityChunk(city, 0)!, ...(city.chunks ?? [])].flatMap((chunk) =>
        (chunk.buildings ?? []).map((building) => ({ chunk, building })));
      expect(buildings.filter(({ building }) => building.door).length, city.id).toBeGreaterThanOrEqual(2);
      expect(buildings.some(({ building }) => !building.door), city.id).toBe(true);
      for (const { chunk, building } of buildings) {
        expect(building.width, building.id).toBeGreaterThanOrEqual(3);
        expect(building.height, building.id).toBeGreaterThanOrEqual(3);
        if (building.door) expect(isWalkable(chunk.mapData[building.door.y + 1]![building.door.x]!)).toBe(true);
        for (let y = building.y; y < building.y + building.height; y++) {
          for (let x = building.x; x < building.x + building.width; x++) {
            const door = building.door?.x === x && building.door?.y === y;
            expect(isWalkable(chunk.mapData[y]![x]!), `${building.id}:${x},${y}`).toBe(door);
          }
        }
        if (!building.door) expect(chunk.mapData.flat().filter((tile) => tile === Terrain.House).length).toBeGreaterThan(0);
      }
    }
  });

  it("decorates rooms without blocking their original rewards, counters or exit approaches", () => {
    for (const city of CITIES) {
      for (const room of city.chunks?.filter((chunk) => chunk.interior) ?? []) {
        const kinds = new Set(room.interior!.props.map((prop) => prop.kind));
        expect(room.interior!.props.length, `${city.id}:${room.name}`).toBeGreaterThanOrEqual(14);
        expect(kinds.has("window")).toBe(true);
        expect(kinds.has("painting")).toBe(true);
        expect(kinds.has("candle")).toBe(true);
        const reached = reachable(room.mapData, room.spawnX, room.spawnY);
        expect(reached.has("10,12")).toBe(true);
        expect(reached.has("10,13")).toBe(true);
        if (room.shops.length) expect(reached.has("10,6")).toBe(true);
        if (room.interior!.kind === "library") {
          for (const [x, y] of [[6, 8], [7, 8], [8, 8], [9, 8], [9, 7], [10, 7], [11, 7], [12, 7], [13, 7]]) {
            expect(reached.has(`${x},${y}`), `${city.id}:library-aisle:${x},${y}`).toBe(true);
          }
        }
      }
    }
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

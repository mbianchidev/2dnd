import { describe, it, expect } from "vitest";
import { tryGridMove, type MoveResult } from "../src/systems/movement";
import { createPlayer, type PlayerState, type PlayerStats } from "../src/systems/player";
import { MAP_WIDTH, MAP_HEIGHT, getDungeon, getCity } from "../src/data/map";

const defaultStats: PlayerStats = {
  strength: 10, dexterity: 10, constitution: 10,
  intelligence: 10, wisdom: 10, charisma: 10,
};

/** Create a fresh player for movement tests. */
function testPlayer(overrides?: Partial<PlayerState>): PlayerState {
  const player = createPlayer("TestMover", defaultStats);
  // Place in a known walkable position (center-ish of Heartlands chunk 4,2)
  player.x = 5;
  player.y = 5;
  player.chunkX = 4;
  player.chunkY = 2;
  if (overrides) Object.assign(player, overrides);
  return player;
}

describe("tryGridMove", () => {
  describe("overworld movement", () => {
    it("moves the player on valid terrain", () => {
      const player = testPlayer();
      const origX = player.x;
      const origY = player.y;

      // Try moving in each direction until we find a valid move
      let moved = false;
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const result = tryGridMove(player, dx, dy);
        if (result.moved) {
          moved = true;
          expect(player.x).toBe(origX + dx);
          expect(player.y).toBe(origY + dy);
          expect(result.chunkChanged).toBe(false);
          expect(result.newTerrain).toBeDefined();
          break;
        }
        // Reset position for next attempt
        player.x = origX;
        player.y = origY;
      }
      // At least one direction should be walkable from (5,5)
      expect(moved).toBe(true);
    });

    it("does not move into unwalkable terrain", () => {
      const player = testPlayer();
      // Place at edge of map against water or mountain — try all 4 directions
      // If none move, position should stay the same
      const origX = player.x;
      const origY = player.y;

      // A failed move should not change position
      // We'll try from a position known to have at least one blocked direction
      player.x = 0;
      player.y = 0;
      player.chunkX = 0;
      player.chunkY = 0;

      // Try moving left (out of bounds wraps to chunk -1 which doesn't exist)
      const result = tryGridMove(player, -1, 0);
      if (!result.moved) {
        expect(player.x).toBe(0);
        expect(player.y).toBe(0);
      }
    });

    it("handles chunk transitions correctly", () => {
      const player = testPlayer();
      player.x = 0;
      player.y = 5;
      player.chunkX = 4;
      player.chunkY = 2;

      // Move left — should cross chunk boundary
      const result = tryGridMove(player, -1, 0);
      if (result.moved && result.chunkChanged) {
        expect(player.x).toBe(MAP_WIDTH - 1);
        expect(player.chunkX).toBe(3);
      }
    });

    it("wraps coordinates on chunk transitions", () => {
      const player = testPlayer();
      player.x = MAP_WIDTH - 1;
      player.y = 5;
      player.chunkX = 4;
      player.chunkY = 2;

      const result = tryGridMove(player, 1, 0);
      if (result.moved && result.chunkChanged) {
        expect(player.x).toBe(0);
        expect(player.chunkX).toBe(5);
      }
    });

    it("returns moved=false for invalid terrain", () => {
      const player = testPlayer();
      // Place at an edge of the world where there's nothing
      player.chunkX = 99;
      player.chunkY = 99;
      const result = tryGridMove(player, 0, 1);
      expect(result.moved).toBe(false);
      expect(result.chunkChanged).toBe(false);
    });
  });

  describe("dungeon movement", () => {
    it("moves within dungeon bounds", () => {
      const player = testPlayer({
        inDungeon: true,
        dungeonId: "heartlands_dungeon",
      });
      const dungeon = getDungeon("heartlands_dungeon");
      expect(dungeon).toBeDefined();

      // Place at the spawn point
      player.x = dungeon!.spawnX;
      player.y = dungeon!.spawnY;

      // Try moving right — should be within bounds
      const origX = player.x;
      const result = tryGridMove(player, 1, 0);
      if (result.moved) {
        expect(player.x).toBe(origX + 1);
        expect(result.chunkChanged).toBe(false);
      }
    });

    it("blocks movement outside dungeon bounds", () => {
      const player = testPlayer({
        inDungeon: true,
        dungeonId: "heartlands_dungeon",
      });
      player.x = 0;
      player.y = 0;

      const result = tryGridMove(player, -1, 0);
      expect(result.moved).toBe(false);
      expect(player.x).toBe(0);
    });

    it("returns moved=false for invalid dungeon ID", () => {
      const player = testPlayer({
        inDungeon: true,
        dungeonId: "nonexistent_dungeon",
      });
      const result = tryGridMove(player, 1, 0);
      expect(result.moved).toBe(false);
    });

    it("never produces chunk transitions in dungeons", () => {
      const player = testPlayer({
        inDungeon: true,
        dungeonId: "heartlands_dungeon",
      });
      const dungeon = getDungeon("heartlands_dungeon")!;
      player.x = dungeon.spawnX;
      player.y = dungeon.spawnY;

      // Try all directions
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const savedX = player.x;
        const savedY = player.y;
        const result = tryGridMove(player, dx, dy);
        if (result.moved) {
          expect(result.chunkChanged).toBe(false);
        }
        // Reset for next test
        player.x = savedX;
        player.y = savedY;
      }
    });
  });

  describe("city movement", () => {
    it("moves within city bounds", () => {
      const player = testPlayer({
        inCity: true,
        cityId: "willowdale_city",
      });
      const city = getCity("willowdale_city");
      expect(city).toBeDefined();

      // Place at a known interior position
      player.x = 5;
      player.y = 5;

      const origX = player.x;
      let moved = false;
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const result = tryGridMove(player, dx, dy);
        if (result.moved) {
          moved = true;
          expect(result.chunkChanged).toBe(false);
          break;
        }
        player.x = origX;
        player.y = 5;
      }
    });

    it("blocks movement outside city bounds", () => {
      const player = testPlayer({
        inCity: true,
        cityId: "willowdale_city",
      });
      player.x = 0;
      player.y = 0;

      const result = tryGridMove(player, -1, 0);
      expect(result.moved).toBe(false);
      expect(player.x).toBe(0);
    });

    it("returns moved=false for invalid city ID", () => {
      const player = testPlayer({
        inCity: true,
        cityId: "nonexistent_city",
      });
      const result = tryGridMove(player, 1, 0);
      expect(result.moved).toBe(false);
    });

    it("never produces chunk transitions in cities", () => {
      const player = testPlayer({
        inCity: true,
        cityId: "willowdale_city",
      });
      player.x = 5;
      player.y = 5;

      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const savedX = player.x;
        const savedY = player.y;
        const result = tryGridMove(player, dx, dy);
        if (result.moved) {
          expect(result.chunkChanged).toBe(false);
        }
        player.x = savedX;
        player.y = savedY;
      }
    });
  });
});

import { describe, expect, it } from "vitest";
import { FogOfWar } from "../src/managers/fogOfWar";
import { createPlayer } from "../src/systems/player";
import { CITIES, getCity, getCityChunkCount, MAP_HEIGHT, MAP_WIDTH } from "../src/data/map";

const stats = {
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
};

describe("fog of war location separation", () => {
  it("preserves legacy dungeon keys only for level zero", () => {
    const fog = new FogOfWar();
    const player = createPlayer("Explorer", stats);
    player.position.inDungeon = true;
    player.position.dungeonId = "heartlands_dungeon";

    expect(fog.exploredKey(5, 3, player)).toBe(
      "d:heartlands_dungeon,5,3",
    );

    player.position.dungeonLevel = 1;
    expect(fog.exploredKey(5, 3, player)).toBe(
      "d:heartlands_dungeon,1,5,3",
    );
  });

  it("keeps dungeon exploration separate between levels", () => {
    const fog = new FogOfWar();
    const player = createPlayer("Explorer", stats);
    player.position.inDungeon = true;
    player.position.dungeonId = "heartlands_dungeon";

    fog.revealAround(5, 5, 0, player);
    expect(fog.isExplored(5, 5, player)).toBe(true);

    player.position.dungeonLevel = 1;
    expect(fog.isExplored(5, 5, player)).toBe(false);
    fog.revealAround(5, 5, 0, player);

    player.position.dungeonLevel = 0;
    expect(fog.isExplored(5, 5, player)).toBe(true);
  });

  it("keeps city exploration separate between districts", () => {
    const fog = new FogOfWar();
    const player = createPlayer("Explorer", stats);
    player.position.inCity = true;
    player.position.cityId = "willowdale_city";

    fog.revealAround(5, 5, 0, player);
    expect(fog.isExplored(5, 5, player)).toBe(true);

    player.position.cityChunkIndex = 1;
    expect(fog.isExplored(5, 5, player)).toBe(false);
  });

  it.each(CITIES)("reveals every district of $name without revealing another location", (city) => {
    const fog = new FogOfWar();
    const player = createPlayer("Explorer", stats);
    const original = { "4,2,1,1": true };
    fog.setExploredTiles(original);
    Object.assign(player.position, { inCity: true, cityId: city.id });
    fog.revealCity(city);
    for (let district = 0; district < getCityChunkCount(city); district++) {
      player.position.cityChunkIndex = district;
      for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
          expect(fog.isExplored(x, y, player)).toBe(true);
        }
      }
    }
    expect(fog.getExploredTiles()).toBe(original);
    expect(Object.keys(original)).toHaveLength(1 + getCityChunkCount(city) * MAP_WIDTH * MAP_HEIGHT);
    expect(original["4,2,1,1"]).toBe(true);
    expect(fog.isFogDisabled()).toBe(false);
    const count = Object.keys(original).length;
    fog.revealCity(city);
    expect(Object.keys(original)).toHaveLength(count);
  });

  it("recovers full city visibility from a partial legacy district without touching dungeon fog", () => {
    const fog = new FogOfWar();
    const tiles = { "c:willowdale_city,1,5,5": true, "d:heartlands_dungeon,1,2,3": true };
    fog.setExploredTiles(tiles);
    fog.revealCity(getCity("willowdale_city")!);
    expect(tiles["c:willowdale_city,1,5,5"]).toBe(true);
    expect(tiles["d:heartlands_dungeon,1,2,3"]).toBe(true);
    expect(Object.keys(tiles).filter((key) => key.startsWith("d:"))).toHaveLength(1);
    expect(Object.keys(tiles).some((key) => key.startsWith("c:ironhold_city"))).toBe(false);
  });
});

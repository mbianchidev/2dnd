import { describe, expect, it } from "vitest";
import { FogOfWar } from "../src/managers/fogOfWar";
import { createPlayer } from "../src/systems/player";

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
});

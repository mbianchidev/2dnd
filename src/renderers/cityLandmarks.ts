import type * as Phaser from "phaser";
import { Terrain } from "../data/mapTypes";
import { TILE_SIZE } from "../config";

/** Connected fountain tiles form one landmark, rather than four repeated miniature wells. */
export function renderCityLandmarks(
  scene: Phaser.Scene, map: Terrain[][], explored: (x: number, y: number) => boolean,
): Phaser.GameObjects.Sprite[] {
  const sprites: Phaser.GameObjects.Sprite[] = [];
  const visited = new Set<string>();
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[y]!.length; x++) {
      if (map[y]![x] !== Terrain.Fountain || visited.has(`${x},${y}`)) continue;
      const tiles: Array<{ x: number; y: number }> = [];
      const queue = [{ x, y }];
      while (queue.length) {
        const tile = queue.pop()!;
        const key = `${tile.x},${tile.y}`;
        if (visited.has(key) || map[tile.y]?.[tile.x] !== Terrain.Fountain) continue;
        visited.add(key);
        tiles.push(tile);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) queue.push({ x: tile.x + dx!, y: tile.y + dy! });
      }
      if (!tiles.every((tile) => explored(tile.x, tile.y))) continue;
      const left = Math.min(...tiles.map((tile) => tile.x));
      const top = Math.min(...tiles.map((tile) => tile.y));
      const width = Math.max(...tiles.map((tile) => tile.x)) - left + 1;
      const height = Math.max(...tiles.map((tile) => tile.y)) - top + 1;
      sprites.push(scene.add.sprite((left + width / 2) * TILE_SIZE, (top + height / 2) * TILE_SIZE, "prop_fountain")
        .setDisplaySize(width * TILE_SIZE, height * TILE_SIZE).setDepth(6));
    }
  }
  return sprites;
}

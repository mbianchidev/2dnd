import { Terrain } from "../data/mapTypes";
import { artNoise, PixelSurface, shadePixelColor as shade } from "./pixelArt";

export const WORLD_ART_COLORS: Readonly<Record<Terrain, number>> = {
  [Terrain.Grass]: 0x6d964e, [Terrain.Forest]: 0x507d40, [Terrain.DeepForest]: 0x395d3e,
  [Terrain.Mountain]: 0x817d74, [Terrain.Water]: 0x326c9c, [Terrain.River]: 0x458ea5,
  [Terrain.Sand]: 0xd7bb7d, [Terrain.Tundra]: 0xbecdd0, [Terrain.Swamp]: 0x647d51,
  [Terrain.Volcanic]: 0x65524c, [Terrain.Canyon]: 0xa37d60, [Terrain.Path]: 0xbda67d,
  [Terrain.Town]: 0x6d964e, [Terrain.Dungeon]: 0x817d74, [Terrain.Boss]: 0x6d964e,
  [Terrain.DungeonFloor]: 0x615f57, [Terrain.DungeonWall]: 0x333b3d,
  [Terrain.DungeonExit]: 0x615f57, [Terrain.Chest]: 0x615f57,
  [Terrain.MinorTreasure]: 0x6d964e, [Terrain.CityFloor]: 0x6d964e,
  [Terrain.CityWall]: 0x998b70, [Terrain.CityExit]: 0xbda67d,
  [Terrain.Carpet]: 0x936250, [Terrain.Well]: 0x6d964e, [Terrain.Fountain]: 0x6d964e,
  [Terrain.Crate]: 0x6d964e, [Terrain.Barrel]: 0x6d964e,
  [Terrain.ShopFloor]: 0xb28b5d, [Terrain.Temple]: 0x6d964e,
  [Terrain.Statue]: 0x6d964e, [Terrain.Mill]: 0x6d964e,
  [Terrain.CropField]: 0x7b8950, [Terrain.Fence]: 0x6d964e,
  [Terrain.House]: 0x6d964e, [Terrain.Flower]: 0x6d964e,
  [Terrain.Cactus]: 0xd7bb7d, [Terrain.Geyser]: 0x65524c,
  [Terrain.Mushroom]: 0x647d51, [Terrain.Casino]: 0x6d964e,
  [Terrain.CityPath]: 0xb9ae92, [Terrain.CityGate]: 0xb9ae92,
  [Terrain.DungeonStairs]: 0x615f57, [Terrain.DungeonBoss]: 0x615f57,
};

export interface TerrainArtSpec {
  readonly terrain: Terrain;
  readonly variant: number;
  /** Exposed north/east/south/west edges, not collision or navigation state. */
  readonly edges: number;
  readonly ground: Terrain;
}

function groundFor(terrain: Terrain): Terrain {
  if (terrain === Terrain.Forest || terrain === Terrain.DeepForest || terrain === Terrain.Mountain
    || terrain === Terrain.House || terrain === Terrain.Town || terrain === Terrain.Flower
    || terrain === Terrain.CityFloor || terrain === Terrain.Well || terrain === Terrain.Fountain
    || terrain === Terrain.Fence || terrain === Terrain.Crate || terrain === Terrain.Barrel
    || terrain === Terrain.Statue || terrain === Terrain.Temple || terrain === Terrain.Casino
    || terrain === Terrain.Mill || terrain === Terrain.Boss || terrain === Terrain.MinorTreasure) return Terrain.Grass;
  if (terrain === Terrain.Cactus) return Terrain.Sand;
  return terrain;
}

export function getTerrainArtSpec(map: readonly (readonly Terrain[])[], x: number, y: number): TerrainArtSpec {
  const terrain = map[y]?.[x];
  if (terrain === undefined) throw new Error(`[art] Missing terrain at ${x},${y}.`);
  const neighbors = [map[y - 1]?.[x], map[y]?.[x + 1], map[y + 1]?.[x], map[y]?.[x - 1]];
  const connected = (neighbor: Terrain | undefined): boolean => neighbor === undefined || neighbor === terrain
    || ((terrain === Terrain.Water || terrain === Terrain.River) && (neighbor === Terrain.Water || neighbor === Terrain.River))
    || (terrain === Terrain.Forest && neighbor === Terrain.DeepForest);
  const edges = neighbors.reduce<number>((mask, neighbor, index) =>
    mask | (connected(neighbor) ? 0 : 1 << index), 0);
  const ground = neighbors.find((neighbor) => neighbor === Terrain.Sand || neighbor === Terrain.Tundra
    || neighbor === Terrain.Swamp || neighbor === Terrain.Volcanic || neighbor === Terrain.Canyon);
  const fallback = terrain === Terrain.Water || terrain === Terrain.River || terrain === Terrain.Path
    || terrain === Terrain.CityPath ? Terrain.Grass : groundFor(terrain);
  return { terrain, variant: artNoise(x, y, terrain) % 3, edges, ground: ground ?? fallback };
}

export function getTerrainArtKey(spec: TerrainArtSpec): string {
  return `terrain-${spec.terrain}-${spec.ground}-${spec.edges}-${spec.variant}`;
}

function paintGround(art: PixelSurface, terrain: Terrain, variant: number): void {
  const color = WORLD_ART_COLORS[terrain];
  art.rect(0, 0, 32, 32, color);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const noise = artNoise(x, y, variant * 173 + terrain * 29);
      if (noise % 9 < 2) art.pixel(x, y, shade(color, noise % 2 ? 9 : -10));
      if (noise % 47 === 0) art.rect(x, y, 2, 1, shade(color, 18));
    }
  }
  if (terrain === Terrain.ShopFloor) {
    for (let x = 0; x < 32; x += 8) {
      const end = (x * 7 + variant * 9) % 32;
      art.line(x, 0, x, 31, 0x70553e);
      art.line(x + 1, 0, x + 1, 31, 0xc8a473);
      art.line(x + 1, end, x + 7, end, 0x856345);
      art.pixel(x + 2, end + 2, 0x69503c);
    }
  }
}

function drawTree(art: PixelSurface, variant: number, dark = false): void {
  const color = dark ? 0x386a44 : 0x477d43;
  art.ellipse(17, 27, 12, 3, 0x3d5a36);
  art.rect(14, 18, 5, 12, 0x4b4030);
  art.rect(16, 20, 2, 9, 0x8b714a);
  art.line(16, 24, 9, 19, 0x695436, 2);
  for (const [x, y, rx, ry] of [[9, 16, 8, 7], [23, 17, 8, 8], [16, 10, 11, 9], [15, 20, 10, 6]]) {
    art.volume(x!, y! - variant, rx!, ry!, color, 0x294c35);
  }
  for (let index = 0; index < 32; index++) {
    const x = 4 + artNoise(index, variant) % 24;
    const y = 4 + artNoise(variant, index) % 17;
    art.rect(x, y, 2, 1, index % 3 === 0 ? 0x9cae59 : 0x668e49);
  }
}

function drawMountain(art: PixelSurface, variant: number, snowy: boolean): void {
  const peak = 10 + variant * 4;
  art.ellipse(17, 28, 14, 3, 0x586445);
  art.polygon([{ x: 1, y: 28 }, { x: peak - 4, y: 9 }, { x: peak, y: 3 },
    { x: peak + 6, y: 10 }, { x: 31, y: 28 }], 0x524f50);
  art.polygon([{ x: 3, y: 26 }, { x: peak, y: 4 }, { x: peak + 1, y: 26 }], 0xa4a297);
  art.polygon([{ x: peak, y: 5 }, { x: peak + 6, y: 13 }, { x: 28, y: 26 },
    { x: peak + 2, y: 22 }], 0x797b79);
  art.line(peak - 1, 10, peak - 6, 25, 0xc0baaa, 2);
  art.line(peak + 5, 14, peak + 7, 25, 0x5f6262, 2);
  art.polygon([{ x: peak - 4, y: 9 }, { x: peak, y: 3 }, { x: peak + 5, y: 10 },
    { x: peak + 2, y: 9 }, { x: peak, y: 12 }, { x: peak - 1, y: 8 }], snowy ? 0xe1e5dd : 0xcac7b6);
}

function drawPath(art: PixelSurface, color: number, variant: number): void {
  for (let row = 0; row < 5; row++) {
    for (let column = -1; column < 4; column++) {
      const x = column * 11 + (row % 2) * 5;
      const y = row * 7 - 2;
      const lift = artNoise(column, row, variant) % 16;
      art.polygon([{ x, y: y + 1 }, { x: x + 7, y }, { x: x + 10, y: y + 2 },
        { x: x + 8, y: y + 5 }, { x: x + 1, y: y + 6 }], shade(color, lift - 10));
      art.line(x + 1, y + 1, x + 7, y + 1, shade(color, 17));
    }
  }
}

function drawWater(art: PixelSurface, spec: TerrainArtSpec): void {
  const color = WORLD_ART_COLORS[spec.terrain];
  for (let y = 0; y < 32; y++) {
    const offset = Math.round(Math.sin((y + spec.variant * 4) * 0.55) * 3);
    art.rect((y * 7 + spec.variant * 3) % 32, y, y % 3 === 0 ? 9 : 3, 1,
      shade(color, y % 2 === 0 ? 20 : -13));
    for (let x = 0; x < 32; x++) {
      const edge = 3 + (artNoise(x, y, 17) % 3);
      const bank = ((spec.edges & 1) !== 0 && y < edge + offset)
        || ((spec.edges & 2) !== 0 && x >= 32 - edge + offset)
        || ((spec.edges & 4) !== 0 && y >= 32 - edge + offset)
        || ((spec.edges & 8) !== 0 && x < edge + offset);
      if (bank) art.pixel(x, y, shade(WORLD_ART_COLORS[spec.ground], (x + y) % 3 === 0 ? -26 : 0));
      else if (((spec.edges & 1) !== 0 && y === edge + offset)
        || ((spec.edges & 4) !== 0 && y === 31 - edge + offset)
        || ((spec.edges & 8) !== 0 && x === edge + offset)
        || ((spec.edges & 2) !== 0 && x === 31 - edge + offset)) art.pixel(x, y, 0xb7d5cc);
    }
  }
}

function drawWall(art: PixelSurface, spec: TerrainArtSpec): void {
  const dungeon = spec.terrain === Terrain.DungeonWall;
  const color = dungeon ? 0x737467
    : spec.ground === Terrain.Sand || spec.ground === Terrain.Canyon ? 0xc3aa7a
      : spec.ground === Terrain.Tundra ? 0xabbcc0
        : spec.ground === Terrain.Swamp ? 0x888672
          : spec.ground === Terrain.Volcanic ? 0x8d7766 : WORLD_ART_COLORS[Terrain.CityWall];
  art.rect(0, 0, 32, 32, dungeon ? 0x283133 : 0x675e4e);
  for (let y = 2; y < 32; y += 7) {
    for (let x = -5 + ((y + spec.variant) % 2) * 7; x < 32; x += 13) {
      art.polygon([{ x, y }, { x: x + 10, y: y - 1 }, { x: x + 12, y: y + 4 },
        { x: x + 9, y: y + 6 }, { x: x + 1, y: y + 5 }], shade(color, (x + y) % 12 - 6));
      art.line(x + 1, y, x + 9, y, shade(color, 23));
    }
  }
  if (spec.edges & 4) {
    for (let x = 0; x < 32; x += 3) {
      art.rect(x, 25 + artNoise(x, spec.variant) % 4, 3, 7, dungeon ? 0x424b44 : 0x776b55);
    }
    art.line(0, 23, 31, 23, shade(color, 38), 2);
  }
  if (spec.edges & 2) art.rect(28, 0, 4, 32, shade(color, -35));
  if (spec.edges & 8) art.rect(0, 0, 2, 32, shade(color, 19));
  if (dungeon) {
    for (let i = 0; i < 8; i++) art.rect((i * 7 + spec.variant) % 32, (i * 11) % 27, 3, 2, 0x546c49);
  }
}

export function drawWorldBuilding(art: PixelSurface, roofColor: number, temple = false): void {
  art.ellipse(17, 28, 14, 3, 0x40573b);
  art.rect(5, 14, 23, 14, 0x504e44);
  art.rect(6, 14, 19, 12, 0xd2c5a1);
  art.rect(7, 15, 2, 11, 0xe9ddba);
  art.rect(24, 15, 3, 12, 0x8f8977);
  art.polygon([{ x: 2, y: 15 }, { x: 15, y: temple ? 1 : 4 }, { x: 30, y: 15 }], shade(roofColor, -37));
  art.polygon([{ x: 4, y: 13 }, { x: 15, y: temple ? 1 : 4 }, { x: 27, y: 13 }], roofColor);
  for (let y = 7; y < 14; y += 3) art.line(15 - (y - 4), y, 15 + (y - 4), y, shade(roofColor, 23));
  art.rect(13, 19, 7, 10, 0x443d35);
  art.rect(14, 20, 5, 8, 0x987348);
  art.pixel(18, 24, 0xf4d77d);
  art.rect(8, 17, 3, 4, 0x5b7580);
  art.rect(22, 17, 2, 4, 0x5b7580);
  art.rect(8, 17, 3, 1, 0xf0e2b9);
  art.rect(12, 28, 10, 2, 0xbdb79a);
  if (temple) {
    art.volume(16, 3, 3, 3, 0xe2c67d, roofColor);
    art.pixel(16, 3, 0x4d7890);
  }
}

function drawProp(art: PixelSurface, terrain: Terrain, variant: number): void {
  const stone = 0xb1ae98;
  if (terrain === Terrain.Well || terrain === Terrain.Fountain) {
    art.ellipse(16, 25, 13, 5, 0x465d42);
    art.ellipse(16, 21, 12, 7, shade(stone, -26));
    art.ellipse(16, 18, 12, 7, stone);
    art.ellipse(16, 18, 8, 4, 0x356e8b);
    art.line(9, 17, 18, 17, 0x96ced0);
    if (terrain === Terrain.Well) {
      art.rect(5, 8, 2, 13, 0x786043);
      art.rect(25, 8, 2, 13, 0x786043);
      art.polygon([{ x: 2, y: 9 }, { x: 16, y: 2 }, { x: 30, y: 9 }], 0xab754e);
      art.line(16, 8, 16, 20, 0xe0c98e);
    } else {
      art.rect(14, 8, 4, 13, 0xd3c9aa);
      art.ellipse(16, 9, 7, 3, 0x89bbc1);
      art.rect(15, 4, 2, 6, 0xc3e6df);
    }
  } else if (terrain === Terrain.Crate || terrain === Terrain.Barrel || terrain === Terrain.Chest) {
    art.ellipse(16, 27, 11, 3, 0x46533b);
    const barrel = terrain === Terrain.Barrel;
    const chest = terrain === Terrain.Chest;
    if (barrel) art.volume(16, 18, 9, 11, 0xa07748);
    else {
      art.rect(6, 10, 21, 17, 0x423b32);
      art.rect(7, 10, 18, 15, chest ? 0x9e6538 : 0xb18b58);
      art.rect(8, 8, 17, 5, chest ? 0xbd8749 : 0xd1ab70);
    }
    for (let x = 9; x < 26; x += 4) art.line(x, 13, x, 24, 0x785437);
    art.rect(6, 13, 20, 2, chest ? 0xe4c06f : 0x69685e);
    art.rect(7, 23, 18, 2, chest ? 0xe4c06f : 0x69685e);
    if (chest) art.rect(15, 14, 4, 5, 0xf3d386);
    if (terrain === Terrain.Crate) {
      art.line(8, 11, 23, 24, 0xd4b378, 2);
      art.line(23, 11, 8, 24, 0xd4b378, 2);
    }
  } else if (terrain === Terrain.Statue) {
    art.rect(7, 25, 19, 5, 0x777c70);
    art.rect(9, 23, 15, 3, 0xc1bd9e);
    art.volume(16, 9, 4, 5, stone);
    art.polygon([{ x: 12, y: 12 }, { x: 20, y: 12 }, { x: 23, y: 23 }, { x: 9, y: 23 }], stone);
    art.line(15, 14, 14, 22, 0xe0d3b0, 2);
  } else if (terrain === Terrain.Fence) {
    for (const x of [3, 15, 27]) {
      art.rect(x, 13, 3, 16, 0x7b6445);
      art.rect(x, 11, 3, 2, 0xc4aa74);
    }
    art.rect(0, 17, 32, 3, 0xa18a60);
    art.rect(0, 24, 32, 2, 0xa18a60);
  } else if (terrain === Terrain.Flower || terrain === Terrain.CropField) {
    for (let i = 0; i < 12; i++) {
      const x = 2 + artNoise(i, variant) % 28;
      const y = 5 + artNoise(variant, i) % 25;
      art.line(x, y, x, y - 4, 0x43633c);
      art.rect(x - 1, y - 5, 3, 2, terrain === Terrain.CropField ? 0xd6c271 : i % 2 ? 0xd5bcda : 0xf2dfaf);
    }
  } else if (terrain === Terrain.Cactus) {
    art.volume(16, 18, 4, 11, 0x779957);
    art.line(9, 17, 13, 21, 0x4e713f, 3);
    art.line(9, 12, 9, 18, 0x83a35e, 3);
    art.line(20, 18, 24, 14, 0x4e713f, 3);
    art.line(24, 10, 24, 16, 0x83a35e, 3);
    art.line(15, 9, 15, 26, 0xb8bf77);
  } else if (terrain === Terrain.Mushroom) {
    for (const [x, y] of [[9, 18], [23, 23]]) {
      art.rect(x!, y!, 3, 8, 0xdacba6);
      art.volume(x! + 1, y!, 7, 4, 0x936a75);
      art.rect(x! - 2, y! - 2, 2, 2, 0xe0cba8);
    }
  }
}

export function createTerrainArt(spec: TerrainArtSpec): PixelSurface {
  const art = new PixelSurface(32, 32);
  const terrain = spec.terrain;
  const object = groundFor(terrain) !== terrain;
  paintGround(art, object ? spec.ground : terrain, spec.variant);
  if (terrain === Terrain.Water || terrain === Terrain.River) drawWater(art, spec);
  else if (terrain === Terrain.Forest || terrain === Terrain.DeepForest) drawTree(art, spec.variant, terrain === Terrain.DeepForest);
  else if (terrain === Terrain.Mountain) drawMountain(art, spec.variant, spec.ground === Terrain.Tundra);
  else if (terrain === Terrain.CityWall || terrain === Terrain.DungeonWall) drawWall(art, spec);
  else if (terrain === Terrain.Path || terrain === Terrain.CityPath || terrain === Terrain.DungeonFloor) {
    drawPath(art, WORLD_ART_COLORS[terrain], spec.variant);
  } else if (terrain === Terrain.Town || terrain === Terrain.House || terrain === Terrain.Temple || terrain === Terrain.Mill || terrain === Terrain.Casino) {
    drawWorldBuilding(art, terrain === Terrain.Temple ? 0x4d7890 : terrain === Terrain.Casino ? 0x826a97 : 0xb07449, terrain === Terrain.Temple);
    if (terrain === Terrain.Mill) {
      art.line(16, 8, 16, 27, 0xddd0ab, 2);
      art.line(6, 17, 27, 17, 0xddd0ab, 2);
    }
  } else if (terrain === Terrain.Dungeon) {
    drawMountain(art, spec.variant, false);
    art.ellipse(16, 22, 6, 8, 0x252f32);
    art.rect(10, 25, 13, 5, 0x252f32);
  } else if (terrain === Terrain.CityExit || terrain === Terrain.CityGate || terrain === Terrain.DungeonExit) {
    art.rect(4, 4, 4, 25, 0xb5a889);
    art.rect(24, 4, 4, 25, 0x8f856e);
    art.rect(4, 3, 24, 5, 0xd2c4a1);
    art.rect(11, 7, 10, 22, 0x3e4640);
    art.rect(8, 28, 17, 3, 0xd2c4a1);
    art.rect(14, 9, 4, 4, 0xddc780);
  } else if (terrain === Terrain.DungeonStairs) {
    art.rect(4, 3, 25, 28, 0x303a3c);
    for (let i = 0; i < 5; i++) {
      art.rect(6 + i, 6 + i * 5, 21 - i * 2, 3, shade(0xada68c, -i * 12));
      art.rect(6 + i, 9 + i * 5, 21 - i * 2, 2, 0x56594f);
    }
  } else if (terrain === Terrain.Boss || terrain === Terrain.DungeonBoss) {
    art.ellipse(16, 20, 11, 7, 0x8b6551);
    art.ellipse(16, 19, 8, 5, 0x5a4544);
    art.line(9, 15, 23, 24, 0xcfaf76, 2);
    art.line(23, 15, 9, 24, 0xcfaf76, 2);
    art.volume(16, 12, 4, 4, 0xd9c5a0);
    art.pixel(14, 12, 0x3f3536);
    art.pixel(18, 12, 0x3f3536);
  } else if (terrain === Terrain.MinorTreasure) {
    art.rect(12, 19, 9, 7, 0xa18455);
    art.rect(14, 16, 5, 5, 0xd3bc7c);
    art.line(16, 8, 16, 14, 0xf5e7b2);
    art.line(13, 11, 19, 11, 0xf5e7b2);
  } else if (terrain === Terrain.Carpet) {
    art.rect(3, 5, 26, 23, 0x854e45);
    art.rect(5, 7, 22, 19, 0xa7735b);
    art.line(6, 8, 25, 8, 0xdec390);
    art.line(6, 24, 25, 24, 0xdec390);
    art.polygon([{ x: 16, y: 11 }, { x: 21, y: 17 }, { x: 16, y: 22 }, { x: 11, y: 17 }], 0xdec390);
  } else if (terrain === Terrain.Volcanic || terrain === Terrain.Geyser) {
    art.line(2, 7, 13, 13, 0xb77747, 2);
    art.line(13, 13, 9, 25, 0xd9a15c);
    art.line(13, 13, 29, 20, 0x8d4837, 2);
    if (terrain === Terrain.Geyser) art.volume(16, 21, 8, 4, 0x989989);
  } else if (terrain === Terrain.Canyon) {
    for (let y = 5; y < 32; y += 8) art.line(0, y, 31, y + 2, y % 2 ? 0xbfa182 : 0x816044, 2);
  } else if (terrain === Terrain.Swamp) {
    art.ellipse(10, 17, 8, 4, 0x536f68);
    art.ellipse(24, 28, 9, 3, 0x536f68);
    art.line(6, 15, 4, 8, 0xb1a770);
    art.line(9, 15, 10, 9, 0xb1a770);
  } else drawProp(art, terrain, spec.variant);
  if (terrain === Terrain.Path || terrain === Terrain.CityPath) {
    const border = WORLD_ART_COLORS[spec.ground];
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const edge = 2 + artNoise(x, y, 47) % 4;
        if (((spec.edges & 1) && y < edge) || ((spec.edges & 2) && x >= 32 - edge)
          || ((spec.edges & 4) && y >= 32 - edge) || ((spec.edges & 8) && x < edge)) {
          art.pixel(x, y, shade(border, (x + y) % 3 === 0 ? -10 : 7));
        }
      }
    }
  }
  return art;
}

import { MAP_HEIGHT, MAP_WIDTH } from "../data/mapTypes";
import type { CityData } from "../data/mapTypes";
import { WORLD_CITY_ART, type WorldCityArtProfile } from "../data/worldCityArt";
import { PixelSurface, shadePixelColor as shade } from "./pixelArt";

export interface WorldCityArtTile {
  readonly x: number;
  readonly y: number;
  readonly column: number;
  readonly row: number;
}

export function getWorldCityArtProfile(cityId: string): WorldCityArtProfile {
  const profile = WORLD_CITY_ART[cityId];
  if (!profile) throw new Error(`[world-city] Missing landmark profile ${cityId}.`);
  return profile;
}

export function getWorldCityArtTiles(
  city: Pick<CityData, "id" | "tileX" | "tileY">,
  isExplored: (x: number, y: number) => boolean,
): readonly WorldCityArtTile[] {
  if (!isExplored(city.tileX, city.tileY)) return [];
  const { columns, rows } = getWorldCityArtProfile(city.id);
  const tiles: WorldCityArtTile[] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const x = city.tileX - Math.floor(columns / 2) + column;
      const y = city.tileY - rows + 1 + row;
      if (x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT && isExplored(x, y)) {
        tiles.push({ x, y, column, row });
      }
    }
  }
  return tiles;
}

export function createWorldCityArt(profile: WorldCityArtProfile): PixelSurface {
  const art = new PixelSurface(profile.columns * 32, profile.rows * 32);
  const { stone, roof, accent } = profile;
  const outline = 0x293a3b;
  const w = art.width;
  const h = art.height;
  const cx = w / 2;
  const gate = Math.floor(profile.columns / 2) * 32 + 16;
  art.ellipse(cx, h - 12, cx - 3, 10, shade(stone, -37));
  art.ellipse(cx, h - 14, cx - 6, 8, shade(stone, -13));
  art.rect(gate - 4, h - 18, 8, 18, 0xc7b68b);

  const house = (x: number, y: number, width: number, height: number): void => {
    art.rect(x, y, width, height, outline);
    art.rect(x + 2, y + 2, width - 4, height - 3, stone);
    art.rect(x + width - 5, y + 2, 3, height - 3, shade(stone, -24));
    art.polygon([{ x: x - 2, y: y + 3 }, { x: x + width / 2, y: y - 9 },
      { x: x + width + 1, y: y + 3 }], outline);
    art.polygon([{ x, y: y + 1 }, { x: x + width / 2, y: y - 7 },
      { x: x + width - 1, y: y + 1 }], roof);
    art.line(x + 2, y, x + width / 2, y - 6, shade(roof, 31));
    for (let window = 4; window < width - 4; window += 8) {
      art.rect(x + window, y + 6, 4, 5, outline);
      art.rect(x + window + 1, y + 7, 2, 2, accent);
    }
    art.rect(x + width / 2 - 2, y + height - 7, 5, 7, outline);
  };
  const tower = (x: number, y: number, height: number, width = 13): void => {
    art.rect(x, y, width, height, outline);
    art.rect(x + 2, y + 2, width - 4, height - 3, stone);
    art.rect(x + width - 4, y + 2, 2, height - 3, shade(stone, -29));
    for (let step = 0; step < width; step += 5) art.rect(x + step, y - 3, 3, 5, stone);
    art.rect(x + width / 2 - 1, y + 6, 3, 6, outline);
    art.rect(x + width / 2, y + 7, 1, 3, accent);
  };
  const tree = (x: number, y: number, size: number, color: number): void => {
    art.rect(x - 2, y, 4, size + 8, 0x6d5943);
    art.volume(x, y, size, size - 2, color, outline);
  };
  for (const building of profile.houses) house(building.x, building.y, building.width, building.height);
  switch (profile.landmark) {
    case "willow":
      tree(49, 17, 15, accent);
      for (let branch = 0; branch < 4; branch++) {
        art.line(37 + branch * 8, 16, 34 + branch * 9, 36 - branch % 2 * 4, shade(accent, -25), 2);
      }
      art.rect(11, 51, 26, 4, 0x688d9b);
      art.line(18, 50, 29, 55, 0xc6b384, 3);
      break;
    case "fortress":
      art.rect(10, 39, w - 20, 12, shade(stone, -21));
      for (let x = 12; x < w - 10; x += 8) art.rect(x, 35, 5, 6, stone);
      tower(8, 16, 37, 17); tower(w - 26, 13, 40, 18); tower(cx - 8, 4, 31, 16);
      art.rect(gate - 5, 43, 10, 12, outline);
      break;
    case "harbor":
      art.rect(93, 42, 30, 7, 0x72959b);
      for (let x = 96; x <= 119; x += 9) art.rect(x, 47, 2, 9, 0x8f704f);
      art.line(106, 8, 106, 45, 0x5f5545, 2);
      art.polygon([{ x: 108, y: 12 }, { x: 121, y: 31 }, { x: 108, y: 31 }], 0xe4d8b3);
      art.rect(35, 34, 20, 4, accent);
      for (let x = 36; x < 54; x += 6) art.rect(x, 34, 3, 4, 0xe6cc94);
      break;
    case "longhouse":
      house(27, 21, 44, 26);
      art.line(24, 23, 49, 5, accent, 3); art.line(49, 5, 73, 23, accent, 3);
      art.line(27, 19, 20, 10, roof, 2); art.line(69, 19, 78, 10, roof, 2);
      art.rect(10, 39, 19, 2, accent); art.rect(65, 35, 21, 2, accent);
      break;
    case "greatTree":
      art.rect(cx - 9, 24, 18, 48, 0x6d5841);
      art.line(cx - 4, 40, cx - 23, 76, 0x91754c, 4);
      art.line(cx + 4, 38, cx + 23, 77, 0x776747, 4);
      tree(cx - 17, 24, 17, roof); tree(cx + 18, 24, 19, roof); tree(cx, 12, 21, accent);
      house(cx - 10, 45, 20, 16);
      art.line(19, 58, 76, 58, 0xc5ac78, 2);
      break;
    case "bridge":
      art.rect(36, 41, 54, 7, stone);
      for (let x = 40; x < 87; x += 13) {
        art.rect(x, 48, 6, 8, shade(stone, -38));
        art.rect(x + 6, 48, 7, 5, outline);
      }
      tower(18, 10, 29); tower(96, 7, 33);
      art.rect(34, 36, 58, 3, accent);
      break;
    case "stilts":
      for (const building of profile.houses) {
        art.rect(building.x + 3, building.y + building.height, 3, 10, 0x5e5440);
        art.rect(building.x + building.width - 6, building.y + building.height, 3, 10, 0x5e5440);
      }
      art.line(16, 54, 79, 48, accent, 3);
      art.line(31, 18, 33, 38, 0x675a44, 2);
      art.ellipse(32, 18, 6, 3, 0xb1bd83);
      break;
    case "orchard":
      for (const [x, y] of [[12, 23], [72, 17], [17, 42], [86, 29]]) {
        tree(x!, y!, 8, roof); art.rect(x! - 3, y!, 2, 2, accent);
      }
      art.rect(35, 17, 20, 3, accent);
      art.rect(8, 54, 79, 2, 0x9a8b5c);
      for (let x = 9; x < 88; x += 8) art.rect(x, 50, 2, 7, 0x9a8b5c);
      break;
    case "furnace":
      house(29, 30, 34, 23);
      for (const [x, y, height] of [[33, 6, 26], [48, 12, 19], [60, 2, 33]]) {
        art.rect(x!, y!, 7, height!, outline); art.rect(x! + 1, y!, 4, height!, stone);
        art.rect(x! - 1, y!, 9, 3, accent);
      }
      art.rect(40, 41, 12, 11, outline); art.rect(42, 44, 8, 7, accent);
      art.rect(44, 48, 4, 3, 0xf0cd88);
      break;
    case "oasis":
      art.ellipse(48, 24, 14, 12, outline); art.ellipse(48, 23, 12, 10, roof);
      art.rect(34, 24, 28, 4, accent); art.rect(47, 8, 2, 7, accent);
      art.ellipse(25, 50, 12, 5, 0x548d9b); art.line(13, 37, 12, 51, 0x9d7e4f, 2);
      art.line(13, 38, 4, 34, 0x648451, 2); art.line(13, 38, 24, 32, 0x648451, 2);
      break;
    case "beacon":
      art.polygon([{ x: 27, y: 74 }, { x: 38, y: 18 }, { x: 59, y: 18 }, { x: 70, y: 74 }], outline);
      art.polygon([{ x: 31, y: 72 }, { x: 41, y: 20 }, { x: 56, y: 20 }, { x: 65, y: 72 }], stone);
      for (let y = 31; y < 68; y += 14) art.rect(32, y, 32, 3, shade(stone, -25));
      art.rect(35, 16, 27, 7, roof); art.rect(42, 9, 13, 9, accent);
      art.rect(46, 4, 5, 7, 0xf0d494); art.rect(47, 1, 2, 5, 0xf7ead0);
      break;
    case "causeway":
      art.line(22, 52, 72, 42, stone, 6); art.line(25, 48, 70, 38, accent, 2);
      tower(36, 15, 28, 14);
      art.polygon([{ x: 34, y: 15 }, { x: 43, y: 3 }, { x: 52, y: 15 }], roof);
      art.polygon([{ x: 7, y: 52 }, { x: 27, y: 52 }, { x: 22, y: 58 }, { x: 13, y: 58 }], 0x5c5547);
      break;
    case "lighthouse":
      tower(32, 12, 40, 16);
      art.rect(30, 10, 20, 8, roof); art.rect(34, 11, 12, 4, accent);
      art.polygon([{ x: 28, y: 10 }, { x: 40, y: 1 }, { x: 52, y: 10 }], roof);
      art.rect(33, 30, 14, 5, roof); art.line(74, 11, 74, 30, 0x6d604b, 2);
      art.polygon([{ x: 76, y: 12 }, { x: 85, y: 24 }, { x: 76, y: 24 }], 0xe8dab1);
      break;
    case "observatory":
      art.ellipse(cx, 31, 23, 15, outline); art.ellipse(cx, 30, 20, 12, stone);
      art.ellipse(cx, 29, 13, 7, roof);
      art.line(cx - 16, 18, cx + 11, 5, accent, 3);
      art.line(cx - 9, 10, cx + 4, 24, stone, 3);
      for (const [x, y] of [[27, 23], [64, 13], [70, 36], [36, 44]]) {
        art.rect(x!, y!, 3, 6, accent);
      }
      break;
  }
  return art;
}

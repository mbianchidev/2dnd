export type WorldCityLandmark =
  | "willow" | "fortress" | "harbor" | "longhouse" | "greatTree" | "bridge"
  | "stilts" | "orchard" | "furnace" | "oasis" | "beacon" | "causeway" | "lighthouse" | "observatory";

export interface WorldCityHouse {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface WorldCityArtProfile {
  readonly columns: 3 | 4;
  readonly rows: 2 | 3;
  readonly landmark: WorldCityLandmark;
  readonly stone: number;
  readonly roof: number;
  readonly accent: number;
  readonly houses: readonly WorldCityHouse[];
}

/** Cartographic silhouettes, not extra entrances, terrain, collision or discovery authority. */
export const WORLD_CITY_ART: Readonly<Record<string, WorldCityArtProfile>> = {
  willowdale_city: {
    columns: 3, rows: 2, landmark: "willow", stone: 0xd4bf91, roof: 0x99704f, accent: 0x779950,
    houses: [{ x: 7, y: 33, width: 23, height: 19 }, { x: 33, y: 40, width: 18, height: 13 },
      { x: 63, y: 31, width: 24, height: 20 }],
  },
  ironhold_city: {
    columns: 4, rows: 2, landmark: "fortress", stone: 0x939c9d, roof: 0x555e72, accent: 0xc3a563,
    houses: [{ x: 20, y: 29, width: 24, height: 22 }, { x: 49, y: 34, width: 28, height: 17 },
      { x: 88, y: 28, width: 22, height: 23 }],
  },
  sandport_city: {
    columns: 4, rows: 2, landmark: "harbor", stone: 0xe2c993, roof: 0x557f90, accent: 0xb37155,
    houses: [{ x: 9, y: 31, width: 23, height: 17 }, { x: 34, y: 36, width: 21, height: 15 },
      { x: 64, y: 26, width: 25, height: 21 }],
  },
  frostheim_city: {
    columns: 3, rows: 2, landmark: "longhouse", stone: 0xa2b4b8, roof: 0x697f91, accent: 0xe0e8d8,
    houses: [{ x: 8, y: 39, width: 22, height: 14 }, { x: 64, y: 35, width: 24, height: 18 }],
  },
  deeproot_city: {
    columns: 3, rows: 3, landmark: "greatTree", stone: 0xb4a279, roof: 0x5c8062, accent: 0xa2b96b,
    houses: [{ x: 9, y: 64, width: 24, height: 18 }, { x: 62, y: 61, width: 23, height: 21 }],
  },
  canyonwatch_city: {
    columns: 4, rows: 2, landmark: "bridge", stone: 0xc09b78, roof: 0x8c5847, accent: 0xd9bf83,
    houses: [{ x: 9, y: 35, width: 24, height: 18 }, { x: 89, y: 30, width: 27, height: 22 }],
  },
  bogtown_city: {
    columns: 3, rows: 2, landmark: "stilts", stone: 0x9b9472, roof: 0x6f7053, accent: 0xc3ad70,
    houses: [{ x: 7, y: 27, width: 23, height: 17 }, { x: 38, y: 35, width: 20, height: 14 },
      { x: 68, y: 25, width: 20, height: 18 }],
  },
  thornvale_city: {
    columns: 3, rows: 2, landmark: "orchard", stone: 0xc2b387, roof: 0x6c834b, accent: 0xc38b58,
    houses: [{ x: 29, y: 29, width: 31, height: 23 }, { x: 66, y: 39, width: 21, height: 14 }],
  },
  ashfall_city: {
    columns: 3, rows: 2, landmark: "furnace", stone: 0x8f827b, roof: 0x644b43, accent: 0xd78c57,
    houses: [{ x: 6, y: 36, width: 21, height: 17 }, { x: 65, y: 33, width: 25, height: 20 }],
  },
  dunerest_city: {
    columns: 3, rows: 2, landmark: "oasis", stone: 0xe1c791, roof: 0x8b9b8a, accent: 0xc89559,
    houses: [{ x: 6, y: 35, width: 22, height: 17 }, { x: 33, y: 27, width: 30, height: 23 },
      { x: 70, y: 37, width: 19, height: 15 }],
  },
  ridgewatch_city: {
    columns: 3, rows: 3, landmark: "beacon", stone: 0xa4a39a, roof: 0x6a7281, accent: 0xddb66c,
    houses: [{ x: 9, y: 68, width: 23, height: 16 }, { x: 63, y: 59, width: 25, height: 23 }],
  },
  shadowfen_city: {
    columns: 3, rows: 2, landmark: "causeway", stone: 0x8e9c8b, roof: 0x566774, accent: 0xb4b68c,
    houses: [{ x: 5, y: 32, width: 23, height: 15 }, { x: 64, y: 26, width: 24, height: 19 }],
  },
  tidehaven_city: {
    columns: 3, rows: 2, landmark: "lighthouse", stone: 0xc7c8aa, roof: 0x587a8a, accent: 0xe1bd76,
    houses: [{ x: 8, y: 37, width: 20, height: 16 }, { x: 57, y: 32, width: 28, height: 21 }],
  },
  starfall_atoll: {
    columns: 3, rows: 2, landmark: "observatory", stone: 0xa8b5b6, roof: 0x687a9c, accent: 0x9ac4b2,
    houses: [{ x: 9, y: 39, width: 18, height: 14 }, { x: 67, y: 35, width: 20, height: 17 }],
  },
};

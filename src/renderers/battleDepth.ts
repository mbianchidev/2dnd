export const BATTLE_DEPTH = {
  farSky: -100,
  stars: -95,
  celestial: -90,
  rearWeather: -85,
  clouds: -80,
  distantScenery: -70,
  ground: -60,
  midgroundProps: -50,
  foregroundProps: -40,
  actorShadows: 0,
  backActors: 10,
  frontActors: 20,
  actionParticles: 30,
  frontWeather: 40,
  uiBackdrop: 100,
  ui: 110,
  uiOverlay: 120,
  inspection: 190,
} as const;

export type BattleBackdropLayerId =
  | "farSky"
  | "stars"
  | "celestial"
  | "rearWeather"
  | "clouds"
  | "distantScenery"
  | "ground"
  | "midgroundProps"
  | "foregroundProps"
  | "actorShadows";

export type BattleBiome =
  | "grass"
  | "forest"
  | "deep_forest"
  | "sand"
  | "tundra"
  | "swamp"
  | "volcanic"
  | "canyon"
  | "dungeon"
  | "city"
  | "sea";

export interface BattleBackdropLayout {
  readonly width: number;
  readonly height: number;
  readonly skyBottom: number;
  readonly horizonY: number;
  readonly groundTop: number;
  readonly actorBaseline: number;
}

export interface BattleBackdropInspection {
  readonly id: BattleBackdropLayerId;
  readonly depth: number;
  readonly bounds: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly childCount: number;
  readonly scrollFactorX: number;
  readonly scrollFactorY: number;
}

export const BATTLE_BACKDROP_LAYER_IDS: readonly BattleBackdropLayerId[] = [
  "farSky",
  "stars",
  "celestial",
  "rearWeather",
  "clouds",
  "distantScenery",
  "ground",
  "midgroundProps",
  "foregroundProps",
  "actorShadows",
];

export function normalizeBattleBiome(biome: string): BattleBiome {
  const normalized = biome.trim().toLowerCase();
  if (normalized.includes("deep") && normalized.includes("forest")) {
    return "deep_forest";
  }
  if (normalized.includes("forest")) return "forest";
  if (normalized.includes("sand") || normalized.includes("desert")) return "sand";
  if (
    normalized.includes("tundra")
    || normalized.includes("frost")
    || normalized.includes("snow")
  ) {
    return "tundra";
  }
  if (normalized.includes("swamp") || normalized.includes("marsh")) return "swamp";
  if (
    normalized.includes("volcan")
    || normalized.includes("forge")
    || normalized.includes("lava")
  ) {
    return "volcanic";
  }
  if (normalized.includes("canyon")) return "canyon";
  if (
    normalized.includes("dungeon")
    || normalized.includes("crypt")
    || normalized.includes("cavern")
  ) {
    return "dungeon";
  }
  if (
    normalized.includes("sea")
    || normalized.includes("ocean")
    || normalized.includes("water")
    || normalized.includes("island")
  ) {
    return "sea";
  }
  if (normalized.includes("city") || normalized.includes("town")) return "city";
  return "grass";
}

export function getBattleBackdropLayout(
  width: number,
  height: number,
): BattleBackdropLayout {
  return {
    width,
    height,
    skyBottom: height * 0.46,
    horizonY: height * 0.43,
    groundTop: height * 0.46,
    actorBaseline: height * 0.67,
  };
}

export function getBattleDepthOrder(): readonly number[] {
  return [
    BATTLE_DEPTH.farSky,
    BATTLE_DEPTH.stars,
    BATTLE_DEPTH.celestial,
    BATTLE_DEPTH.rearWeather,
    BATTLE_DEPTH.clouds,
    BATTLE_DEPTH.distantScenery,
    BATTLE_DEPTH.ground,
    BATTLE_DEPTH.midgroundProps,
    BATTLE_DEPTH.foregroundProps,
    BATTLE_DEPTH.actorShadows,
    BATTLE_DEPTH.backActors,
    BATTLE_DEPTH.frontActors,
    BATTLE_DEPTH.actionParticles,
    BATTLE_DEPTH.frontWeather,
    BATTLE_DEPTH.uiBackdrop,
    BATTLE_DEPTH.ui,
    BATTLE_DEPTH.uiOverlay,
    BATTLE_DEPTH.inspection,
  ];
}

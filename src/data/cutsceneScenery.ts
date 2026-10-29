import type { CutsceneBackdrop, CutsceneId } from "./cutscenes";

export type CutsceneStructure =
  | "road" | "bells" | "rootBridge" | "iceRoad" | "sunArch" | "reedRoad"
  | "watch" | "forgeRoad" | "archive" | "keep" | "rootHall" | "iceHall"
  | "shrine" | "harbor" | "bridge" | "library" | "stilts" | "ferry"
  | "foundry" | "beacon" | "cryptDoor" | "iceCavern" | "forgeGate"
  | "altar" | "yard" | "camp" | "observatory" | "raisedGate" | "ashRoad"
  | "chainBridge" | "covenantHall" | "restoredTown" | "trollCave"
  | "dragonCrater" | "giantPass" | "hydraPool" | "wyrmRift" | "drakeLedge"
  | "lichThrone" | "wardenGate" | "greatAnvil" | "krakenWake";

export interface CutsceneSceneryDefinition {
  readonly landmark: string;
  readonly structure: CutsceneStructure;
  readonly period: "dawn" | "day" | "dusk" | "night";
  readonly accent: number;
  readonly state: "quiet" | "threat" | "restored";
  readonly interior: boolean;
}

export interface CutsceneSceneryPalette {
  readonly sky: readonly [number, number, number];
  readonly far: number;
  readonly near: number;
  readonly ground: number;
  readonly path: number;
  readonly foliage: number;
  readonly stone: number;
  readonly wood: number;
  readonly water: number;
  readonly roof: number;
}

export const CUTSCENE_PALETTES: Readonly<Record<CutsceneBackdrop, CutsceneSceneryPalette>> = {
  heartlands: {
    sky: [0x426b91, 0x9eb8b2, 0xf3d4a0], far: 0x667c79, near: 0x3e6650,
    ground: 0x50724b, path: 0xb9a282, foliage: 0x355d3f,
    stone: 0x929183, wood: 0x73553e, water: 0x5c929c, roof: 0x995f48,
  },
  city: {
    sky: [0x42698e, 0x9dbdc3, 0xf0dcb4], far: 0x788c94, near: 0x596f6d,
    ground: 0x626e65, path: 0xb1a38b, foliage: 0x456b49,
    stone: 0xb5aa92, wood: 0x735039, water: 0x568b9b, roof: 0x995f50,
  },
  forest: {
    sky: [0x264958, 0x668d83, 0xb6c59c], far: 0x4c7066, near: 0x2d5947,
    ground: 0x395b3c, path: 0x9d8e6e, foliage: 0x3f754a,
    stone: 0x899487, wood: 0x705038, water: 0x497e7f, roof: 0x6d6c44,
  },
  canyon: {
    sky: [0x496b95, 0xc49b8a, 0xf3ce9d], far: 0xae857b, near: 0x975e46,
    ground: 0xa57954, path: 0xd3b78e, foliage: 0x6e7c48,
    stone: 0xb78560, wood: 0x79523a, water: 0x538c9c, roof: 0x8c4f44,
  },
  desert: {
    sky: [0x4d729e, 0xbcc9c0, 0xf2da9c], far: 0xc1aa83, near: 0xbb925b,
    ground: 0xd2b479, path: 0xe7d2a4, foliage: 0x577a50,
    stone: 0xd0b18a, wood: 0x805a3b, water: 0x4b9ca1, roof: 0xa66e55,
  },
  marsh: {
    sky: [0x3c526a, 0x839d9e, 0xc5c5a3], far: 0x667f7b, near: 0x3d645a,
    ground: 0x36554b, path: 0x8f9779, foliage: 0x597950,
    stone: 0x85918a, wood: 0x705647, water: 0x426f76, roof: 0x76634e,
  },
  frost: {
    sky: [0x395b87, 0x95b5ce, 0xe1e7de], far: 0x829bb5, near: 0x577f9b,
    ground: 0xb3cad5, path: 0xe3e9df, foliage: 0x3e666b,
    stone: 0x90b9cc, wood: 0x6c6561, water: 0x4e8fa6, roof: 0x54758b,
  },
  mountain: {
    sky: [0x425478, 0xa79caa, 0xe7c6a5], far: 0x85859c, near: 0x555e72,
    ground: 0x6b7068, path: 0xa6a08b, foliage: 0x4c6654,
    stone: 0x969184, wood: 0x735747, water: 0x5a899c, roof: 0x795d5b,
  },
  crypt: {
    sky: [0x151f32, 0x303b4b, 0x596368], far: 0x33444b, near: 0x28383e,
    ground: 0x37484a, path: 0x697374, foliage: 0x4b7866,
    stone: 0x737f7d, wood: 0x645249, water: 0x426a75, roof: 0x576871,
  },
  forge: {
    sky: [0x28223c, 0x864348, 0xd68d59], far: 0x755b65, near: 0x443b48,
    ground: 0x51474a, path: 0x96877c, foliage: 0x61715c,
    stone: 0x827678, wood: 0x735043, water: 0xd66c3d, roof: 0x695261,
  },
  sea: {
    sky: [0x2a466f, 0x839eaf, 0xe3d3b4], far: 0x6e8b9b, near: 0x436a80,
    ground: 0x2e667a, path: 0x91bdc0, foliage: 0x4d7964,
    stone: 0x879a9b, wood: 0x8c654a, water: 0x367f97, roof: 0x7e5b55,
  },
  stars: {
    sky: [0x0d1730, 0x343858, 0x786080], far: 0x4a536f, near: 0x293d54,
    ground: 0x263e4d, path: 0x75849a, foliage: 0x456a68,
    stone: 0x8798ae, wood: 0x685a65, water: 0x466a89, roof: 0x695f84,
  },
};

function scenery(
  landmark: string,
  structure: CutsceneStructure,
  period: CutsceneSceneryDefinition["period"],
  accent: number,
  state: CutsceneSceneryDefinition["state"] = "quiet",
  interior = false,
): CutsceneSceneryDefinition {
  return { landmark, structure, period, accent, state, interior };
}

/** Every story has its own staging; boss aftermaths change the environment as well as its light. */
export const CUTSCENE_SCENERY: Readonly<Record<CutsceneId, CutsceneSceneryDefinition>> = {
  "campaign.opening": scenery("willowRoad", "road", "dawn", 0xf0cd88),
  "campaign.stage.firstSeal": scenery("silentBells", "bells", "dusk", 0xd7ae62),
  "campaign.stage.stoneAndRoot": scenery("stoneRootCrossing", "rootBridge", "day", 0xc3b387),
  "campaign.stage.winterWitness": scenery("winterCauseway", "iceRoad", "dusk", 0xa5dfef),
  "campaign.stage.sunRoad": scenery("sunRoadArch", "sunArch", "day", 0xf5c775),
  "campaign.stage.marshCovenant": scenery("reedCauseway", "reedRoad", "dusk", 0xafc299),
  "campaign.stage.ashenWatch": scenery("ashenWatchtower", "watch", "dusk", 0xe59a6b),
  "campaign.stage.lastForge": scenery("lastFurnaceApproach", "forgeRoad", "night", 0xffc77d),
  "campaign.oath.willowdale": scenery("elowenArchive", "archive", "day", 0xd7ad70),
  "campaign.oath.ironhold": scenery("ironholdKeep", "keep", "day", 0xc57b61),
  "campaign.oath.deeproot": scenery("rootspeakerHall", "rootHall", "day", 0xb9c578),
  "campaign.oath.frostheim": scenery("frostheimHall", "iceHall", "night", 0xb5e7ee),
  "campaign.oath.thornvale": scenery("thornvaleShrine", "shrine", "dawn", 0xdda6b9),
  "campaign.oath.sandport": scenery("sandportHarbor", "harbor", "day", 0xebbc75),
  "campaign.oath.canyonwatch": scenery("canyonwatchBridge", "bridge", "dusk", 0xe2a574),
  "campaign.oath.dunerest": scenery("dunerestLibrary", "library", "day", 0xe8cda1),
  "campaign.oath.bogtown": scenery("bogtownStiltHouses", "stilts", "day", 0xc3a17b),
  "campaign.oath.shadowfen": scenery("veyFerryLanding", "ferry", "night", 0x9fc6c9),
  "campaign.oath.ashfall": scenery("ashfallFoundry", "foundry", "dusk", 0xeab16f),
  "campaign.oath.ridgewatch": scenery("ridgewatchBeacon", "beacon", "night", 0xf0d18a),
  "campaign.dungeon.heartlandsCrypt.reveal": scenery("sealedCryptSteps", "cryptDoor", "night", 0x9cd9c8, "quiet", true),
  "campaign.dungeon.frostCavern.reveal": scenery("blueIceGallery", "iceCavern", "night", 0x9cdbef, "quiet", true),
  "campaign.dungeon.volcanicForge.reveal": scenery("furnacePortcullis", "forgeGate", "night", 0xf2a36a, "quiet", true),
  "campaign.keystone.heartlands": scenery("stoneKeystoneDais", "altar", "night", 0x8fe0bc, "restored", true),
  "campaign.keystone.frost": scenery("thawingKeystonePool", "altar", "dawn", 0xb4e9ff, "restored", true),
  "campaign.keystone.forge": scenery("cleanFirePedestal", "altar", "night", 0xffd68c, "restored", true),
  "campaign.companion.guardian": scenery("ironwardTrainingYard", "yard", "day", 0xd4a57b),
  "campaign.companion.scout": scenery("swiftstepTrailCamp", "camp", "dusk", 0xf2c981),
  "campaign.companion.mystic": scenery("veiledFlameObservatory", "observatory", "night", 0xc6a0f3, "quiet", true),
  "campaign.route.canyonwatch": scenery("raisedSunGate", "raisedGate", "day", 0xe9ba79, "restored"),
  "campaign.route.ashfall": scenery("openedAshBarricade", "ashRoad", "dusk", 0xcbaa91, "restored"),
  "campaign.route.volcanicForge": scenery("forgeChainBridge", "chainBridge", "night", 0xf8b76f, "restored"),
  "campaign.finalReturn": scenery("twelvefoldAssembly", "covenantHall", "dusk", 0xf3d07a, "restored", true),
  "campaign.twelvefoldCovenant.epilogue": scenery("restoredWillowdale", "restoredTown", "dawn", 0xf9d487, "restored"),
  "boss.troll.pre": scenery("trollCaveChallenge", "trollCave", "dusk", 0xbca77c, "threat"),
  "boss.troll.post": scenery("trollRoadCleared", "trollCave", "dawn", 0xd4c59c, "restored"),
  "boss.dragon.pre": scenery("dragonFireCrater", "dragonCrater", "dusk", 0xf59854, "threat"),
  "boss.dragon.post": scenery("dragonEmbersCooling", "dragonCrater", "dawn", 0xe3c68c, "restored"),
  "boss.frostGiant.pre": scenery("giantWhiteoutPass", "giantPass", "night", 0xb4d8ec, "threat"),
  "boss.frostGiant.post": scenery("giantPaleHorizon", "giantPass", "dawn", 0xf2dfba, "restored"),
  "boss.swampHydra.pre": scenery("hydraBlackwater", "hydraPool", "night", 0x9ebd72, "threat"),
  "boss.swampHydra.post": scenery("hydraStillwater", "hydraPool", "dawn", 0xd9c78e, "restored"),
  "boss.volcanicWyrm.pre": scenery("wyrmMoltenRift", "wyrmRift", "night", 0xffb36e, "threat"),
  "boss.volcanicWyrm.post": scenery("wyrmObsidianRidge", "wyrmRift", "dawn", 0xdcc598, "restored"),
  "boss.canyonDrake.pre": scenery("drakeWindLedge", "drakeLedge", "day", 0xdfa06d, "threat"),
  "boss.canyonDrake.post": scenery("drakePassReopened", "drakeLedge", "dusk", 0xe4c38b, "restored"),
  "boss.cryptLich.pre": scenery("lichBoundThrone", "lichThrone", "night", 0x99d3bb, "threat", true),
  "boss.cryptLich.post": scenery("lichBrokenCrown", "lichThrone", "dawn", 0xe9cc8a, "restored", true),
  "boss.frostWarden.pre": scenery("wardenGlacierGate", "wardenGate", "night", 0xa3dbee, "threat", true),
  "boss.frostWarden.post": scenery("wardenThawingArch", "wardenGate", "dawn", 0xe4e5c4, "restored", true),
  "boss.infernoForgemaster.pre": scenery("forgemasterChainedAnvil", "greatAnvil", "night", 0xff9f64, "threat", true),
  "boss.infernoForgemaster.post": scenery("forgemasterUnboundFire", "greatAnvil", "dawn", 0xffd58f, "restored", true),
  "boss.kraken.pre": scenery("krakenStormWake", "krakenWake", "night", 0x95c6db, "threat"),
  "boss.kraken.post": scenery("krakenUnchartedDawn", "krakenWake", "dawn", 0xf0d9ae, "restored"),
};

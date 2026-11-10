import type { PlayerClass } from "./classes";

export type BodyBuild = "light" | "standard" | "broad";
export type AppearanceAccessory = "none" | "spectacles" | "earring";

/** Cosmetic overrides never change class ownership, equipment or statistics. */
export interface CustomAppearance {
  skinColor: number;
  hairStyle: number;
  hairColor: number;
  eyeColor?: number;
  facialHair?: number;
  bodyBuild?: BodyBuild;
  outfitColor?: number;
  legColor?: number;
  accentColor?: number;
  accessory?: AppearanceAccessory;
  headwear?: boolean;
}

export const SKIN_COLOR_OPTIONS: readonly { label: string; color: number }[] = [
  { label: "Porcelain", color: 0xf3d9cd },
  { label: "Light", color: 0xffccbc },
  { label: "Warm", color: 0xe6b597 },
  { label: "Tan", color: 0xd7a97c },
  { label: "Medium", color: 0xc68642 },
  { label: "Umber", color: 0xa97755 },
  { label: "Dark", color: 0x8d6e63 },
  { label: "Deep", color: 0x5d4037 },
  { label: "Ebony", color: 0x49332e },
];

export const HAIR_STYLE_OPTIONS: readonly { label: string; id: number }[] = [
  { label: "Bald", id: 0 },
  { label: "Short", id: 1 },
  { label: "Medium", id: 2 },
  { label: "Long", id: 3 },
  { label: "Curls", id: 4 },
  { label: "Braids", id: 5 },
  { label: "Ponytail", id: 6 },
  { label: "Mohawk", id: 7 },
  { label: "Cropped", id: 8 },
];

export const HAIR_COLOR_OPTIONS: readonly { label: string; color: number }[] = [
  { label: "Black", color: 0x1a1a1a },
  { label: "Brown", color: 0x5d4037 },
  { label: "Chestnut", color: 0x8a5239 },
  { label: "Blonde", color: 0xffd54f },
  { label: "Red", color: 0xb71c1c },
  { label: "Copper", color: 0xbc7549 },
  { label: "White", color: 0xeeeeee },
  { label: "Silver", color: 0xa9b8ba },
  { label: "Blue", color: 0x1565c0 },
  { label: "Violet", color: 0x8970ac },
  { label: "Rose", color: 0xba7c91 },
  { label: "Teal", color: 0x4e8d88 },
];

export const EYE_COLOR_OPTIONS: readonly { label: string; color: number }[] = [
  { label: "Brown", color: 0x49372b }, { label: "Hazel", color: 0x967446 },
  { label: "Green", color: 0x52775b }, { label: "Blue", color: 0x507eab },
  { label: "Grey", color: 0x8a979a }, { label: "Amber", color: 0xc28b41 },
  { label: "Violet", color: 0x926fa6 },
];

export const OUTFIT_COLOR_OPTIONS: readonly { label: string; color: number }[] = [
  { label: "Midnight", color: 0x394659 }, { label: "Ocean", color: 0x527a94 },
  { label: "Forest", color: 0x547653 }, { label: "Wine", color: 0x894d60 },
  { label: "Violet", color: 0x82709b }, { label: "Copper", color: 0xa57650 },
  { label: "Ivory", color: 0xd9cfaf }, { label: "Teal", color: 0x4f8982 },
  { label: "Charcoal", color: 0x41474c }, { label: "Gold", color: 0xb79a58 },
];

export const FACIAL_HAIR_OPTIONS = [
  { label: "Clean-shaven", id: 0 }, { label: "Stubble", id: 1 },
  { label: "Beard", id: 2 }, { label: "Moustache", id: 3 },
] as const;
export const BODY_BUILD_OPTIONS: readonly { label: string; id: BodyBuild }[] = [
  { label: "Light", id: "light" }, { label: "Standard", id: "standard" }, { label: "Broad", id: "broad" },
];
export const ACCESSORY_OPTIONS: readonly { label: string; id: AppearanceAccessory }[] = [
  { label: "None", id: "none" }, { label: "Spectacles", id: "spectacles" }, { label: "Earring", id: "earring" },
];

export function getClassBodyBuild(playerClass: PlayerClass): BodyBuild {
  if (playerClass.clothingStyle === "heavy" || playerClass.clothingStyle === "bare") return "broad";
  return ["leather", "wrap", "performer"].includes(playerClass.clothingStyle) ? "light" : "standard";
}

export function createCustomAppearance(playerClass: PlayerClass): CustomAppearance {
  return {
    skinColor: playerClass.skinColor, hairStyle: 0, hairColor: HAIR_COLOR_OPTIONS[0]!.color,
    eyeColor: EYE_COLOR_OPTIONS[0]!.color, facialHair: 0, bodyBuild: getClassBodyBuild(playerClass),
    outfitColor: playerClass.bodyColor, legColor: playerClass.legColor, accentColor: 0xe5c781,
    accessory: "none", headwear: true,
  };
}

/** Retain legacy/custom colors exactly; omit invalid optional overrides instead of inventing history. */
export function normalizeCustomAppearance(value: unknown, playerClass: PlayerClass): CustomAppearance | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const record: Record<string, unknown> = value as Record<string, unknown>;
  const color = (entry: unknown): entry is number =>
    typeof entry === "number" && Number.isInteger(entry) && entry >= 0 && entry <= 0xffffff;
  const appearance: CustomAppearance = {
    skinColor: color(record["skinColor"]) ? record["skinColor"] : playerClass.skinColor,
    hairColor: color(record["hairColor"]) ? record["hairColor"] : HAIR_COLOR_OPTIONS[0]!.color,
    hairStyle: HAIR_STYLE_OPTIONS.some(({ id }) => id === record["hairStyle"]) ? Number(record["hairStyle"]) : 0,
  };
  for (const key of ["eyeColor", "outfitColor", "legColor", "accentColor"] as const) {
    if (color(record[key])) appearance[key] = record[key];
  }
  if (FACIAL_HAIR_OPTIONS.some(({ id }) => id === record["facialHair"])) appearance.facialHair = Number(record["facialHair"]);
  const build = record["bodyBuild"];
  if (build === "light" || build === "standard" || build === "broad") appearance.bodyBuild = build;
  const accessory = record["accessory"];
  if (accessory === "none" || accessory === "spectacles" || accessory === "earring") appearance.accessory = accessory;
  if (typeof record["headwear"] === "boolean") appearance.headwear = record["headwear"];
  return appearance;
}

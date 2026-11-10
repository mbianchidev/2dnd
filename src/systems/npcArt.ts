import { createHumanoidArt, type CharacterArtPose } from "./humanoidArt";
import type { NpcVisualDescriptor } from "./npcVisuals";
import type { PixelSurface } from "./pixelArt";

/** World sprites and dialogue busts share the same canonical face and clothing. */
export function createNpcArt(visual: NpcVisualDescriptor, pose: CharacterArtPose = "standard"): PixelSurface {
  const { template, skinColor, hairColor, dressColor } = visual;
  const guard = template.id.startsWith("guard");
  return createHumanoidArt({
    bodyColor: dressColor, skinColor, legColor: 0x625443, hairColor,
    hairStyle: template.ageGroup === "female" ? 3 : 1,
    clothingStyle: guard ? "heavy" : template.ageGroup === "female" ? "vestment" : "leather",
    weapon: guard ? "sword" : undefined, pose,
  });
}

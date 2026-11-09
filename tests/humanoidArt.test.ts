import { describe, expect, it } from "vitest";
import { PLAYER_CLASSES } from "../src/systems/classes";
import { createHumanoidArt } from "../src/systems/humanoidArt";

describe("recognizable humanoid art", () => {
  const options = {
    skinColor: 0xd6a079, hairColor: 0x47382f, hairStyle: 2,
    bodyColor: 0x567998, legColor: 0x47505b, clothingStyle: "heavy" as const,
  };
  it("keeps faces, separate arms, boots and transparent silhouette space", () => {
    const art = createHumanoidArt(options);
    expect(art.width).toBe(32);
    expect(art.height).toBe(40);
    expect(art.pixels[3]).toBe(0);
    expect(art.pixels[(37 * 32 + 16) * 4 + 3]).toBe(0);
    const colors = new Set(Array.from({ length: 32 * 40 }, (_, index) =>
      [...art.pixels.slice(index * 4, index * 4 + 4)].join(",")));
    expect(colors.size).toBeGreaterThan(18);
  });
  it("distinguishes all twelve classes, facings and gait/action poses", () => {
    const signatures = new Set(PLAYER_CLASSES.map((profile) => Buffer.from(createHumanoidArt({
      ...options, bodyColor: profile.bodyColor, legColor: profile.legColor,
      clothingStyle: profile.clothingStyle, classId: profile.id,
    }).pixels).toString("base64")));
    expect(signatures.size).toBe(12);
    const poses = ["standard", "strideLeft", "strideRight", "ready", "strike", "blink", "fallen"] as const;
    expect(new Set(poses.map((pose) => Buffer.from(createHumanoidArt({
      ...options, pose, weapon: "sword",
    }).pixels).toString("base64"))).size).toBe(poses.length);
    expect(createHumanoidArt({ ...options, facing: "back" }).pixels)
      .not.toEqual(createHumanoidArt({ ...options, facing: "side" }).pixels);
  });
});

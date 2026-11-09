import { describe, expect, it } from "vitest";
import {
  createCustomAppearance, normalizeCustomAppearance, HAIR_STYLE_OPTIONS,
  HAIR_COLOR_OPTIONS, SKIN_COLOR_OPTIONS,
} from "../src/systems/appearance";
import { PLAYER_CLASSES } from "../src/systems/classes";
import { resolveHeroVisualDescriptor, getHeroVisualTextureKey } from "../src/systems/heroVisuals";
import { createHeroArt } from "../src/systems/humanoidArt";
import { createPlayer } from "../src/systems/player";
import { createCodex } from "../src/systems/codex";
import { createCurrentSaveData, normalizeSaveData, SAVE_VERSION } from "../src/systems/save";

const knight = PLAYER_CLASSES.find((entry) => entry.id === "knight")!;
const stats = { strength: 15, dexterity: 10, constitution: 14, intelligence: 10, wisdom: 10, charisma: 10 };

describe("expanded cosmetic appearance", () => {
  it("offers distinct hair silhouettes and a wider range of named colors", () => {
    expect(HAIR_STYLE_OPTIONS.length).toBeGreaterThanOrEqual(8);
    expect(SKIN_COLOR_OPTIONS.length).toBeGreaterThanOrEqual(8);
    expect(HAIR_COLOR_OPTIONS.length).toBeGreaterThanOrEqual(10);
    const prints = HAIR_STYLE_OPTIONS.map(({ id }) => {
      const source = createPlayer("Fixture", stats, "knight", {
        ...createCustomAppearance(knight), hairStyle: id, headwear: false,
      });
      return [...createHeroArt(resolveHeroVisualDescriptor(source), "front", "standard").pixels].join(",");
    });
    expect(new Set(prints).size).toBe(prints.length);
  });

  it("gives every cosmetic axis a real visual effect and an independent texture identity", () => {
    const appearance = createCustomAppearance(knight);
    const source = createPlayer("Fixture", stats, "knight", appearance);
    source.equippedArmor = null;
    const original = resolveHeroVisualDescriptor(source);
    const originalArt = createHeroArt(original, "front", "standard").pixels;
    for (const change of [
      { eyeColor: 0x79b9ac }, { facialHair: 2 }, { bodyBuild: "light" as const },
      { outfitColor: 0x997bb2 }, { legColor: 0x8c654a }, { accentColor: 0x79b9ac },
      { accessory: "spectacles" as const },
    ]) {
      source.customAppearance = { ...appearance, ...change };
      const descriptor = resolveHeroVisualDescriptor(source);
      expect(getHeroVisualTextureKey(descriptor, "front")).not.toBe(getHeroVisualTextureKey(original, "front"));
      expect(createHeroArt(descriptor, "front", "standard").pixels).not.toEqual(originalArt);
      expect(source.stats).toEqual(createPlayer("Fixture", stats, "knight", appearance).stats);
    }
  });

  it("preserves old colors and hair while repairing unknown cosmetic fields", () => {
    const legacy = { skinColor: 0x987654, hairColor: 0x234567, hairStyle: 3 };
    expect(normalizeCustomAppearance(legacy, knight)).toEqual(legacy);
    expect(normalizeCustomAppearance(undefined, knight)).toBeUndefined();
    const repaired = normalizeCustomAppearance({
      ...legacy, eyeColor: Number.NaN, facialHair: 900, bodyBuild: "giant",
      outfitColor: -1, legColor: Infinity, accessory: "crown", headwear: "yes",
    }, knight)!;
    expect(repaired).toEqual(legacy);
    expect(normalizeCustomAppearance({ hairStyle: -1, hairColor: "red" }, knight)).toEqual({
      skinColor: knight.skinColor, hairStyle: 0, hairColor: HAIR_COLOR_OPTIONS[0]!.color,
    });
  });

  it("round-trips full customization and migrates v27 without changing mechanics or old appearance", () => {
    const appearance = {
      ...createCustomAppearance(knight), hairStyle: 7, facialHair: 3,
      accessory: "earring" as const, headwear: false, bodyBuild: "light" as const,
      outfitColor: 0x748f92, legColor: 0x465b68, accentColor: 0xe4c98d, eyeColor: 0x709a77,
    };
    const player = createPlayer("Fixture", stats, "knight", appearance);
    const save = createCurrentSaveData(player, new Set(), createCodex(), "knight", 42);
    expect(normalizeSaveData(JSON.parse(JSON.stringify(save)))?.player.customAppearance).toEqual(appearance);
    const legacy = { skinColor: 0x987654, hairStyle: 3, hairColor: 0x234567 };
    save.version = 27;
    save.player.customAppearance = legacy;
    const migrated = normalizeSaveData(JSON.parse(JSON.stringify(save)))!;
    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.player.customAppearance).toEqual(legacy);
    expect(migrated.player.stats).toEqual(player.stats);
    expect(migrated.player.classProgression).toEqual(player.classProgression);
  });
});

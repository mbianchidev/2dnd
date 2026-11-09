import { describe, expect, it, vi } from "vitest";
import { ALL_MONSTERS } from "../src/data/monsters";
import { MONSTER_FAMILY_IDS } from "../src/data/monsterFamilies";
import { createMonsterArt } from "../src/systems/monsterArt";
import { getPixelArtGroundOrigin } from "../src/systems/pixelArt";

describe("defined procedural creature families", () => {
  it("has a distinct, shaded, transparent anatomical silhouette for every family", () => {
    const signatures = new Set<string>();
    for (const family of MONSTER_FAMILY_IDS) {
      const monster = ALL_MONSTERS.find((entry) => entry.family === family)!;
      const art = createMonsterArt(monster);
      expect(art.pixels[3], family).toBe(0);
      expect(new Set(Array.from({ length: art.width * art.height }, (_, index) =>
        [...art.pixels.slice(index * 4, index * 4 + 4)].join(","))).size, family).toBeGreaterThan(8);
      signatures.add(Buffer.from(art.pixels).toString("base64"));
    }
    expect(signatures.size).toBe(MONSTER_FAMILY_IDS.length);
  });

  it("renders every palette, boss and real action pose deterministically without RNG", () => {
    const rng = vi.spyOn(Math, "random");
    for (const monster of ALL_MONSTERS) {
      const art = createMonsterArt(monster);
      expect(art.width).toBe(monster.isBoss ? 64 : 48);
      expect(art.pixels).toEqual(createMonsterArt(monster).pixels);
      expect(createMonsterArt(monster, "fallen").pixels).not.toEqual(art.pixels);
      expect(createMonsterArt(monster, "blink").pixels).not.toEqual(art.pixels);
    }
    expect(rng).not.toHaveBeenCalled();
    rng.mockRestore();
  });

  it("raises curved tentacles and opens the beak for a Kraken strike", () => {
    const monster = ALL_MONSTERS.find((entry) => entry.anatomy === "tentacled")!;
    expect(createMonsterArt(monster, "strike").pixels).not.toEqual(createMonsterArt(monster, "idle").pixels);
    expect(createMonsterArt(monster, "cast").pixels).not.toEqual(createMonsterArt(monster, "idle").pixels);
  });

  it("finds a real visible contact edge for every creature, boss and action frame", () => {
    for (const monster of ALL_MONSTERS) {
      for (const pose of ["idle", "blink", "ready", "strike", "cast", "hurt", "fallen"] as const) {
        const art = createMonsterArt(monster, pose);
        const origin = getPixelArtGroundOrigin(art);
        expect(origin, `${monster.id}:${pose}`).toBeGreaterThan(0);
        expect(origin).toBeLessThanOrEqual(1);
        const contactRow = Math.round(origin * art.height) - 1;
        expect(Array.from({ length: art.width }, (_, x) => art.pixels[(contactRow * art.width + x) * 4 + 3])
          .some((alpha) => alpha! > 0)).toBe(true);
        for (let y = contactRow + 1; y < art.height; y++) {
          expect(Array.from({ length: art.width }, (_, x) => art.pixels[(y * art.width + x) * 4 + 3])
            .every((alpha) => alpha === 0)).toBe(true);
        }
      }
    }
  });
});

import { describe, expect, it, vi } from "vitest";
import { ALL_MONSTERS } from "../src/data/monsters";
import { MONSTER_FAMILY_IDS } from "../src/data/monsterFamilies";
import { createMonsterArt } from "../src/systems/monsterArt";

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
});

import { describe, expect, it } from "vitest";
import { Element } from "../src/data/elements";
import { getItem, type Item } from "../src/data/items";
import {
  heroItemsMatch,
  isSerializedHeroItem,
  normalizeSerializedHeroItem,
} from "../src/systems/heroItemState";

const fixture: Item = {
  id: "customMockBlade", name: "Mock blade", description: "Serialized mock equipment",
  type: "weapon", cost: 12.5, effect: -0.5, light: true, finesse: true,
  weaponSprite: "dagger", element: Element.Psychic, tags: ["mock", "legacy"],
};

describe("serialized hero ownership", () => {
  it("preserves a well-formed custom item without substituting a canonical definition", () => {
    const item = { ...fixture, fixtureMetadata: { source: "mock", order: [2, 1] } };
    expect(isSerializedHeroItem(item)).toBe(true);
    const normalized = normalizeSerializedHeroItem(item);
    expect(normalized).toEqual(item);
    expect(normalized).not.toBe(item);
    expect(item).toEqual({ ...fixture, fixtureMetadata: { source: "mock", order: [2, 1] } });
  });

  it("retains the full gathering material contract", () => {
    const definition = getItem("ironOre");
    if (!definition) throw new Error("Missing material fixture");
    const item = { ...definition, id: "customMockOre" };
    expect(isSerializedHeroItem(item)).toBe(true);
    expect(normalizeSerializedHeroItem(item)).toEqual(item);
  });

  it.each([
    null, [], 1, {},
    { ...fixture, id: "" },
    { ...fixture, name: null },
    { ...fixture, description: 7 },
    { ...fixture, type: "unknown" },
    { ...fixture, cost: -1 },
    { ...fixture, cost: Infinity },
    { ...fixture, effect: NaN },
    { ...fixture, twoHanded: "yes" },
    { ...fixture, weaponSprite: "unknown" },
    { ...fixture, mountId: 7 },
    { ...fixture, element: "water" },
    { ...fixture, targetType: "enemy" },
    { ...fixture, levelReq: Infinity },
    { ...fixture, trapDetectionBonus: "three" },
    { ...fixture, restoresMp: 1 },
    { ...fixture, tags: ["mock", 7] },
    { ...fixture, material: { resourceId: "mock", discipline: "unknown" } },
  ])("rejects malformed custom ownership without unsafe fields", (value) => {
    expect(isSerializedHeroItem(value)).toBe(false);
    expect(normalizeSerializedHeroItem(value)).toBeNull();
  });

  it("repairs an incomplete known entry without mutating its canonical definition", () => {
    const definition = getItem("potion");
    if (!definition) throw new Error("Missing item fixture");
    const before = structuredClone(definition);
    expect(normalizeSerializedHeroItem({ id: "potion", cost: 23, effect: 42 })).toEqual({
      ...definition, cost: 23, effect: 42,
    });
    expect(definition).toEqual(before);
  });

  it("matches metadata independent of object key order, but not value or array order", () => {
    const first = { ...fixture, fixtureMetadata: { source: "mock", order: [2, 1] } };
    const reordered = { ...fixture, fixtureMetadata: { order: [2, 1], source: "mock" } };
    expect(heroItemsMatch(first, reordered)).toBe(true);
    const differentOrder = { ...fixture, fixtureMetadata: { source: "mock", order: [1, 2] } };
    expect(heroItemsMatch(first, differentOrder)).toBe(false);
    expect(heroItemsMatch(first, { ...first, name: "Different mock blade" })).toBe(false);
  });
});

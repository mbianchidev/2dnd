import { describe, expect, it, vi } from "vitest";
import { getHeroCutsceneIds, getCutsceneDefinition } from "../src/data/cutscenes";
import { ITEMS, getItem, type Item } from "../src/data/items";
import { PLAYER_CLASSES } from "../src/systems/classes";
import {
  createDebugHeroVisualDescriptor,
  getHeroVisualTextureKey,
  HERO_VISUAL_FIXTURE_IDS,
  HERO_VISUAL_LOADOUT_IDS,
  resolveHeroVisualDescriptor,
} from "../src/systems/heroVisuals";
import { createPlayer, type PlayerState } from "../src/systems/player";
import { HeroTextureLeaseRegistry } from "../src/renderers/heroTextures";

function createHero(classId = "knight"): PlayerState {
  return createPlayer("Visual Hero", {
    strength: 12,
    dexterity: 12,
    constitution: 12,
    intelligence: 12,
    wisdom: 12,
    charisma: 12,
  }, classId, {
    skinColor: 0xc68642,
    hairStyle: 2,
    hairColor: 0x1565c0,
  });
}

function requiredItem(itemId: string): Item {
  const item = getItem(itemId);
  if (!item) throw new Error(`Missing test item: ${itemId}`);
  return item;
}

describe("hero visual descriptors", () => {
  it("normalizes every class and gives materially distinct body families", () => {
    const descriptors = PLAYER_CLASSES.map((playerClass) =>
      resolveHeroVisualDescriptor(createHero(playerClass.id))
    );

    expect(descriptors.map(({ classId }) => classId)).toEqual(
      PLAYER_CLASSES.map(({ id }) => id),
    );
    expect(new Set(descriptors.map(({ bodyBuild }) => bodyBuild))).toEqual(
      new Set(["light", "standard", "broad"]),
    );
    expect(new Set(descriptors.map((descriptor) =>
      getHeroVisualTextureKey(descriptor, "front")
    )).size).toBe(PLAYER_CLASSES.length);
  });

  it("normalizes custom appearance colors and hair style deterministically", () => {
    const hero = createHero("wizard");
    hero.customAppearance = {
      skinColor: 0x1234567,
      hairStyle: 99,
      hairColor: -4,
    };

    const descriptor = resolveHeroVisualDescriptor(hero);

    expect(descriptor.appearance).toEqual({
      skinColor: 0xffffff,
      hairStyle: 3,
      hairColor: 0,
    });
  });

  it("creates collision-free keys from every visible input", () => {
    const hero = createHero("bard");
    const base = resolveHeroVisualDescriptor(hero);
    const identical = resolveHeroVisualDescriptor(hero);
    const baseKey = getHeroVisualTextureKey(base, "front");

    expect(getHeroVisualTextureKey(identical, "front")).toBe(baseKey);
    expect(getHeroVisualTextureKey(base, "side")).not.toBe(baseKey);
    expect(getHeroVisualTextureKey(base, "front", "mounted")).not.toBe(baseKey);
    expect(getHeroVisualTextureKey(base, "front", "standard", true))
      .not.toBe(baseKey);

    hero.customAppearance = {
      ...hero.customAppearance!,
      hairColor: 0xffffff,
    };
    expect(getHeroVisualTextureKey(
      resolveHeroVisualDescriptor(hero),
      "front",
    )).not.toBe(baseKey);
  });

  it("covers every weapon, armor, and shield with a typed visual layer", () => {
    for (const item of ITEMS.filter(({ type }) =>
      type === "weapon" || type === "armor" || type === "shield"
    )) {
      const hero = createHero();
      if (item.type === "weapon") {
        hero.equippedWeapon = item;
      } else if (item.type === "armor") {
        hero.equippedArmor = item;
      } else {
        hero.equippedShield = item;
      }
      const descriptor = resolveHeroVisualDescriptor(hero);
      const matchingLayers = descriptor.equipmentLayers.filter(
        (layer) => layer.itemId === item.id,
      );
      expect(matchingLayers, item.id).not.toHaveLength(0);
      expect(matchingLayers.every((layer) =>
        layer.primaryColor >= 0 && layer.primaryColor <= 0xffffff
      ), item.id).toBe(true);
    }
  });

  it("orders back gear, armor, and hand equipment predictably", () => {
    const hero = createHero();
    hero.equippedArmor = requiredItem("shadowCloak");
    hero.equippedWeapon = requiredItem("startDagger");
    hero.equippedOffHand = requiredItem("frostfang");
    hero.equippedShield = requiredItem("towerShield");

    const descriptor = resolveHeroVisualDescriptor(hero);

    expect(descriptor.equipmentLayers.map(({ slot }) => slot)).toEqual([
      "back",
      "mainHand",
      "offHand",
    ]);
    expect(descriptor.equipmentLayers.map(({ order }) => order)).toEqual(
      [...descriptor.equipmentLayers.map(({ order }) => order)].sort(
        (left, right) => left - right,
      ),
    );
  });

  it("uses category-safe fallbacks for missing dedicated equipment visuals", () => {
    const hero = createHero();
    hero.equippedWeapon = {
      id: "testRelicWeapon",
      name: "Test Relic Weapon",
      description: "No dedicated visual",
      type: "weapon",
      cost: 0,
      effect: 1,
    };
    hero.equippedArmor = {
      id: "testRelicArmor",
      name: "Test Relic Armor",
      description: "No dedicated visual",
      type: "armor",
      cost: 0,
      effect: 1,
    };
    hero.equippedShield = {
      id: "testRelicShield",
      name: "Test Relic Shield",
      description: "No dedicated visual",
      type: "shield",
      cost: 0,
      effect: 1,
    };

    const descriptor = resolveHeroVisualDescriptor(hero);

    expect(descriptor.equipmentLayers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        slot: "body",
        category: "armor",
        family: "armor",
        fallbackUsed: true,
      }),
      expect.objectContaining({
        slot: "mainHand",
        category: "weapon",
        fallbackUsed: true,
      }),
      expect.objectContaining({
        slot: "shield",
        category: "shield",
        family: "metalShield",
        fallbackUsed: true,
      }),
    ]));
  });

  it("provides deterministic debug fixtures across all fixture/loadout pairs", () => {
    const keys = new Set<string>();
    for (const fixtureId of HERO_VISUAL_FIXTURE_IDS) {
      for (const loadoutId of HERO_VISUAL_LOADOUT_IDS) {
        const descriptor = createDebugHeroVisualDescriptor(
          fixtureId,
          loadoutId,
        );
        const key = getHeroVisualTextureKey(descriptor, "front");
        expect(key).toBe(getHeroVisualTextureKey(
          createDebugHeroVisualDescriptor(fixtureId, loadoutId),
          "front",
        ));
        keys.add(key);
      }
    }
    expect(keys.size).toBe(
      HERO_VISUAL_FIXTURE_IDS.length * HERO_VISUAL_LOADOUT_IDS.length,
    );
  });

  it("derives visuals without mutating live player state", () => {
    const hero = createHero();
    hero.equippedArmor = requiredItem("plateArmor");
    hero.equippedShield = requiredItem("towerShield");
    const before = JSON.stringify(hero);

    resolveHeroVisualDescriptor(hero);

    expect(JSON.stringify(hero)).toBe(before);
  });
});

describe("hero texture lease registry", () => {
  it("reuses identical textures and removes them after the final release", () => {
    const registry = new HeroTextureLeaseRegistry();
    let exists = false;
    const generate = vi.fn(() => {
      exists = true;
    });
    const remove = vi.fn(() => {
      exists = false;
    });
    const first = registry.acquire("hero-key", () => exists, generate, remove);
    const second = registry.acquire("hero-key", () => exists, generate, remove);

    expect(first.reused).toBe(false);
    expect(second.reused).toBe(true);
    expect(generate).toHaveBeenCalledTimes(1);
    first.release();
    expect(remove).not.toHaveBeenCalled();
    second.release();
    second.release();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(registry.size).toBe(0);
  });

  it("keeps changed descriptors isolated from previous cached textures", () => {
    const registry = new HeroTextureLeaseRegistry();
    const existing = new Set<string>();
    const generate = vi.fn((key: string) => existing.add(key));
    const remove = vi.fn((key: string) => existing.delete(key));
    const first = registry.acquire(
      "hero-a",
      () => existing.has("hero-a"),
      () => generate("hero-a"),
      () => remove("hero-a"),
    );
    const second = registry.acquire(
      "hero-b",
      () => existing.has("hero-b"),
      () => generate("hero-b"),
      () => remove("hero-b"),
    );

    expect(existing).toEqual(new Set(["hero-a", "hero-b"]));
    first.release();
    expect(existing).toEqual(new Set(["hero-b"]));
    second.release();
    expect(existing.size).toBe(0);
  });
});

describe("cutscene hero data integrity", () => {
  it("runtime-resolves the hero in every campaign and optional cutscene", () => {
    const heroCutsceneIds = getHeroCutsceneIds();

    expect(heroCutsceneIds).toHaveLength(54);
    for (const cutsceneId of heroCutsceneIds) {
      const definition = getCutsceneDefinition(cutsceneId);
      const heroActors = definition.steps.flatMap(
        (step) => step.presentation?.actors?.filter(
          (actor) => actor.id === "hero",
        ) ?? [],
      );
      expect(heroActors.length, cutsceneId).toBeGreaterThan(0);
      expect(heroActors.every((actor) =>
        actor.role === "hero"
        && actor.label === "{hero}"
        && !("color" in actor)
      ), cutsceneId).toBe(true);
    }
  });
});

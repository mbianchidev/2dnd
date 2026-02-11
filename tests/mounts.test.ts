import { describe, it, expect } from "vitest";
import { MOUNTS, getMount, getShopMounts } from "../src/data/mounts";
import { ITEMS, getItem } from "../src/data/items";
import { createPlayer, useItem, ownsEquipment, type PlayerState, type PlayerStats } from "../src/systems/player";

const defaultStats: PlayerStats = {
  strength: 10, dexterity: 10, constitution: 10,
  intelligence: 10, wisdom: 10, charisma: 10,
};

/** Helper: create a player with controlled stats for deterministic testing. */
function createTestPlayer(overrides?: Partial<PlayerState>): PlayerState {
  const player = createPlayer("Test", {
    strength: 10, dexterity: 8, constitution: 12,
    intelligence: 8, wisdom: 8, charisma: 8,
  });
  player.stats = {
    strength: 12, dexterity: 10, constitution: 14,
    intelligence: 10, wisdom: 10, charisma: 8,
  };
  player.maxHp = 30;
  player.hp = 30;
  player.maxMp = 10;
  player.mp = 10;
  if (overrides) Object.assign(player, overrides);
  return player;
}

describe("mount system", () => {
  describe("mount data", () => {
    it("has at least 3 mounts defined", () => {
      expect(MOUNTS.length).toBeGreaterThanOrEqual(3);
    });

    it("each mount has a unique ID", () => {
      const ids = MOUNTS.map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("each mount has a speed multiplier >= 1", () => {
      for (const mount of MOUNTS) {
        expect(mount.speedMultiplier).toBeGreaterThanOrEqual(1);
      }
    });

    it("each mount has an encounter multiplier <= 1", () => {
      for (const mount of MOUNTS) {
        expect(mount.encounterMultiplier).toBeLessThanOrEqual(1);
        expect(mount.encounterMultiplier).toBeGreaterThan(0);
      }
    });

    it("getMount looks up by ID", () => {
      const horse = getMount("horse");
      expect(horse).toBeDefined();
      expect(horse!.name).toBe("Horse");
      expect(horse!.speedMultiplier).toBe(1.5);
    });

    it("getMount returns undefined for non-existent ID", () => {
      expect(getMount("dragon")).toBeUndefined();
    });

    it("getShopMounts returns only purchasable mounts", () => {
      const shopMounts = getShopMounts();
      expect(shopMounts.length).toBeGreaterThan(0);
      for (const m of shopMounts) {
        expect(m.cost).toBeGreaterThan(0);
      }
    });

    it("has at least one quest-only mount (cost 0)", () => {
      const questMounts = MOUNTS.filter((m) => m.cost === 0);
      expect(questMounts.length).toBeGreaterThanOrEqual(1);
    });

    it("shadowSteed has the avoidEncounters ability", () => {
      const shadow = getMount("shadowSteed");
      expect(shadow).toBeDefined();
      expect(shadow!.abilities.some((a) => a.id === "avoidEncounters")).toBe(true);
    });
  });

  describe("mount items", () => {
    it("has mount items in the ITEMS array", () => {
      const mountItems = ITEMS.filter((i) => i.type === "mount");
      expect(mountItems.length).toBeGreaterThanOrEqual(3);
    });

    it("each mount item references a valid mount ID", () => {
      const mountItems = ITEMS.filter((i) => i.type === "mount");
      for (const item of mountItems) {
        expect(item.mountId).toBeDefined();
        const mount = getMount(item.mountId!);
        expect(mount, `mount item ${item.id} references unknown mount ${item.mountId}`).toBeDefined();
      }
    });

    it("getItem returns mount items by ID", () => {
      const horse = getItem("mountHorse");
      expect(horse).toBeDefined();
      expect(horse!.type).toBe("mount");
      expect(horse!.mountId).toBe("horse");
    });
  });

  describe("player mount state", () => {
    it("createPlayer initializes with no mount", () => {
      const player = createPlayer("Hero", defaultStats);
      expect(player.mountId).toBe("");
    });

    it("useItem equips a mount", () => {
      const player = createTestPlayer();
      const horseItem = getItem("mountHorse")!;
      player.inventory.push({ ...horseItem });

      const result = useItem(player, 0);
      expect(result.used).toBe(true);
      expect(result.message).toContain("Horse");
      expect(player.mountId).toBe("horse");
    });

    it("useItem with a different mount changes active mount", () => {
      const player = createTestPlayer({ mountId: "donkey" });
      const warHorseItem = getItem("mountWarHorse")!;
      player.inventory.push({ ...warHorseItem });

      const result = useItem(player, 0);
      expect(result.used).toBe(true);
      expect(player.mountId).toBe("warHorse");
    });

    it("ownsEquipment detects mount items in inventory", () => {
      const player = createTestPlayer();
      expect(ownsEquipment(player, "mountHorse")).toBe(false);

      const horseItem = getItem("mountHorse")!;
      player.inventory.push({ ...horseItem });
      expect(ownsEquipment(player, "mountHorse")).toBe(true);
    });
  });
});

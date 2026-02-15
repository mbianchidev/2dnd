import { describe, it, expect } from "vitest";
import {
  rollInitiative,
  playerAttack,
  playerOffHandAttack,
  playerCastSpell,
  playerUseAbility,
  monsterAttack,
  attemptFlee,
} from "../src/systems/combat";
import { createPlayer, isLightWeapon, canDualWield, equipOffHand, hasTwoWeaponFighting, useItem, type PlayerStats } from "../src/systems/player";
import type { Monster } from "../src/data/monsters";
import { getItem } from "../src/data/items";

const defaultStats: PlayerStats = {
  strength: 10, dexterity: 10, constitution: 10,
  intelligence: 10, wisdom: 10, charisma: 10,
};

function createTestMonster(overrides?: Partial<Monster>): Monster {
  return {
    id: "testMonster",
    name: "Test Monster",
    hp: 20,
    ac: 12,
    attackBonus: 3,
    damageCount: 1,
    damageDie: 6,
    xpReward: 50,
    goldReward: 10,
    isBoss: false,
    color: 0xff0000,
    ...overrides,
  };
}

describe("combat system", () => {
  describe("rollInitiative", () => {
    it("returns initiative rolls for both sides", () => {
      for (let i = 0; i < 20; i++) {
        const result = rollInitiative(0, 3);
        expect(result.playerRoll).toBeGreaterThanOrEqual(1);
        expect(result.monsterRoll).toBeGreaterThanOrEqual(4); // min 1 + 3
        expect(typeof result.playerFirst).toBe("boolean");
      }
    });
  });

  describe("playerAttack", () => {
    it("returns a combat result with message and damage", () => {
      const player = createPlayer("Test", defaultStats);
      const monster = createTestMonster();

      const result = playerAttack(player, monster);
      expect(result.message).toBeTruthy();
      expect(typeof result.damage).toBe("number");
      expect(typeof result.hit).toBe("boolean");
      expect(result.damage).toBeGreaterThanOrEqual(0);
    });

    it("deals more damage with equipped weapon", () => {
      const player = createPlayer("Test", defaultStats);
      const sword = getItem("greatSword")!;
      player.equippedWeapon = sword;
      const monster = createTestMonster({ ac: 1 }); // easy to hit

      let totalDamage = 0;
      let hits = 0;
      for (let i = 0; i < 100; i++) {
        const result = playerAttack(player, monster);
        if (result.hit) {
          totalDamage += result.damage;
          hits++;
        }
      }

      // With great sword (+7), average damage should be higher than bare hands
      if (hits > 0) {
        expect(totalDamage / hits).toBeGreaterThan(3);
      }
    });
  });

  describe("playerCastSpell", () => {
    it("casts fire bolt and uses MP", () => {
      const player = createPlayer("Test", defaultStats);
      const monster = createTestMonster({ ac: 1 });
      const initialMp = player.mp;

      const result = playerCastSpell(player, "fireBolt", monster);
      expect(result.message).toContain("Fire Bolt");
      if (result.hit) {
        expect(result.damage).toBeGreaterThan(0);
      }
      expect(result.mpUsed).toBe(2);
      expect(player.mp).toBe(initialMp - 2);
    });

    it("fails with insufficient MP", () => {
      const player = createPlayer("Test", defaultStats);
      player.mp = 0;
      const monster = createTestMonster();

      const result = playerCastSpell(player, "fireBolt", monster);
      expect(result.message).toBe("Not enough MP!");
      expect(result.mpUsed).toBe(0);
    });

    it("handles healing spells", () => {
      const player = createPlayer("Test", defaultStats);
      player.knownSpells.push("cureWounds");
      player.hp = 10;
      const monster = createTestMonster();

      const result = playerCastSpell(player, "cureWounds", monster);
      expect(result.message).toContain("Cure Wounds");
      expect(result.hit).toBe(true);
      expect(player.hp).toBeGreaterThan(10);
    });

    it("returns error for unknown spell", () => {
      const player = createPlayer("Test", defaultStats);
      const monster = createTestMonster();

      const result = playerCastSpell(player, "nonexistent", monster);
      expect(result.message).toBe("Unknown spell!");
    });
  });

  describe("monsterAttack", () => {
    it("can hit and damage the player", () => {
      const player = createPlayer("Test", defaultStats);
      const monster = createTestMonster({ attackBonus: 20, ac: 1 }); // guaranteed hit

      let gotHit = false;
      for (let i = 0; i < 50; i++) {
        player.hp = player.maxHp;
        const result = monsterAttack(monster, player);
        if (result.hit) {
          gotHit = true;
          expect(result.damage).toBeGreaterThan(0);
          expect(player.hp).toBeLessThan(player.maxHp);
        }
      }
      expect(gotHit).toBe(true);
    });

    it("never reduces HP below 0", () => {
      const player = createPlayer("Test", defaultStats);
      player.hp = 1;
      const monster = createTestMonster({ attackBonus: 20 });

      for (let i = 0; i < 20; i++) {
        const result = monsterAttack(monster, player);
        expect(player.hp).toBeGreaterThanOrEqual(0);
        if (player.hp === 0) break;
        player.hp = 1;
      }
    });
  });

  describe("attemptFlee", () => {
    it("returns success or failure", () => {
      let escaped = false;
      let failed = false;
      for (let i = 0; i < 100; i++) {
        const result = attemptFlee(0);
        if (result.success) escaped = true;
        else failed = true;
        expect(result.message).toBeTruthy();
      }
      // With 100 attempts and DC 10, we should see both outcomes
      expect(escaped).toBe(true);
      expect(failed).toBe(true);
    });
  });

  describe("utility spell/ability combat rejection", () => {
    it("rejects utility spells in combat", () => {
      const player = createPlayer("Test", defaultStats);
      player.knownSpells.push("teleport");
      const monster = createTestMonster();
      const result = playerCastSpell(player, "teleport", monster);
      expect(result.hit).toBe(false);
      expect(result.damage).toBe(0);
      expect(result.message).toContain("cannot be used in battle");
    });

    it("rejects utility abilities in combat", () => {
      const player = createPlayer("Test", defaultStats);
      const monster = createTestMonster();
      const result = playerUseAbility(player, "fastTravel", monster);
      expect(result.hit).toBe(false);
      expect(result.damage).toBe(0);
      expect(result.message).toContain("cannot be used in battle");
    });
  });

  describe("playerUseAbility damage path", () => {
    it("returns combat result with attack metadata for damage abilities", () => {
      const player = createPlayer("Test", defaultStats);
      player.knownAbilities = ["shieldBash"];
      const monster = createTestMonster({ ac: 1 }); // easy to hit

      let gotHit = false;
      for (let i = 0; i < 50; i++) {
        player.mp = 100;
        const result = playerUseAbility(player, "shieldBash", monster);
        expect(typeof result.attackMod).toBe("number");
        expect(typeof result.totalRoll).toBe("number");
        expect(typeof result.targetAC).toBe("number");
        expect(result.mpUsed).toBeGreaterThan(0);
        if (result.hit) {
          gotHit = true;
          expect(result.damage).toBeGreaterThan(0);
        }
      }
      expect(gotHit).toBe(true);
    });
  });

  describe("dual wielding (Two-Weapon Fighting)", () => {
    describe("isLightWeapon", () => {
      it("returns true for light weapons", () => {
        expect(isLightWeapon(getItem("startDagger")!)).toBe(true);
        expect(isLightWeapon(getItem("startAxe")!)).toBe(true);
        expect(isLightWeapon(getItem("shortSword")!)).toBe(true);
        expect(isLightWeapon(getItem("frostfang")!)).toBe(true);
      });

      it("returns false for non-light weapons", () => {
        expect(isLightWeapon(getItem("startSword")!)).toBe(false);
        expect(isLightWeapon(getItem("greatSword")!)).toBe(false);
        expect(isLightWeapon(getItem("startBow")!)).toBe(false);
        expect(isLightWeapon(getItem("startStaff")!)).toBe(false);
      });

      it("returns false for null", () => {
        expect(isLightWeapon(null)).toBe(false);
      });

      it("returns false for non-weapon items", () => {
        expect(isLightWeapon(getItem("potion")!)).toBe(false);
        expect(isLightWeapon(getItem("leatherArmor")!)).toBe(false);
      });
    });

    describe("canDualWield", () => {
      it("returns true when main hand is light and no shield", () => {
        const player = createPlayer("Test", defaultStats, "rogue");
        player.equippedWeapon = getItem("startDagger")!;
        player.equippedShield = null;
        expect(canDualWield(player)).toBe(true);
      });

      it("returns false when main hand is not light", () => {
        const player = createPlayer("Test", defaultStats, "knight");
        player.equippedWeapon = getItem("startSword")!;
        expect(canDualWield(player)).toBe(false);
      });

      it("returns false when shield is equipped", () => {
        const player = createPlayer("Test", defaultStats, "rogue");
        player.equippedWeapon = getItem("startDagger")!;
        player.equippedShield = getItem("woodenShield")!;
        expect(canDualWield(player)).toBe(false);
      });

      it("returns false when no weapon equipped", () => {
        const player = createPlayer("Test", defaultStats, "knight");
        player.equippedWeapon = null;
        expect(canDualWield(player)).toBe(false);
      });
    });

    describe("equipOffHand", () => {
      it("equips a light weapon in the off-hand", () => {
        const player = createPlayer("Test", defaultStats, "rogue");
        player.equippedWeapon = getItem("startDagger")!;
        const shortSword = getItem("shortSword")!;
        player.inventory.push({ ...shortSword });

        const result = equipOffHand(player, shortSword);
        expect(result.success).toBe(true);
        expect(player.equippedOffHand?.id).toBe("shortSword");
      });

      it("rejects non-light weapons", () => {
        const player = createPlayer("Test", defaultStats, "rogue");
        player.equippedWeapon = getItem("startDagger")!;
        const longSword = getItem("longSword")!;

        const result = equipOffHand(player, longSword);
        expect(result.success).toBe(false);
        expect(player.equippedOffHand).toBeNull();
      });

      it("rejects two-handed weapons", () => {
        const player = createPlayer("Test", defaultStats, "rogue");
        player.equippedWeapon = getItem("startDagger")!;
        const bow = getItem("startBow")!;

        const result = equipOffHand(player, bow);
        expect(result.success).toBe(false);
      });

      it("rejects when main hand is not light", () => {
        const player = createPlayer("Test", defaultStats, "knight");
        player.equippedWeapon = getItem("startSword")!;
        const dagger = getItem("startDagger")!;

        const result = equipOffHand(player, dagger);
        expect(result.success).toBe(false);
        expect(result.message).toContain("Main hand");
      });

      it("unequips shield when equipping off-hand", () => {
        const player = createPlayer("Test", defaultStats, "rogue");
        player.equippedWeapon = getItem("startDagger")!;
        player.equippedShield = getItem("woodenShield")!;
        const shortSword = getItem("shortSword")!;

        equipOffHand(player, shortSword);
        expect(player.equippedShield).toBeNull();
        expect(player.equippedOffHand?.id).toBe("shortSword");
      });

      it("rejects equipping the same weapon as main hand", () => {
        const player = createPlayer("Test", defaultStats, "rogue");
        player.equippedWeapon = getItem("startDagger")!;

        const result = equipOffHand(player, getItem("startDagger")!);
        expect(result.success).toBe(false);
        expect(result.message).toContain("same weapon");
      });
    });

    describe("hasTwoWeaponFighting", () => {
      it("returns false when talent not learned", () => {
        const player = createPlayer("Test", defaultStats, "knight");
        expect(hasTwoWeaponFighting(player)).toBe(false);
      });

      it("returns true when talent is learned", () => {
        const player = createPlayer("Test", defaultStats, "knight");
        player.knownTalents.push("twoWeaponFighting");
        expect(hasTwoWeaponFighting(player)).toBe(true);
      });
    });

    describe("playerOffHandAttack", () => {
      it("performs an off-hand attack", () => {
        const player = createPlayer("Test", defaultStats, "rogue");
        player.equippedWeapon = getItem("startDagger")!;
        player.equippedOffHand = getItem("shortSword")!;
        const monster = createTestMonster({ ac: 1 });

        let gotHit = false;
        for (let i = 0; i < 50; i++) {
          const result = playerOffHandAttack(player, monster);
          expect(result.message).toBeTruthy();
          expect(typeof result.damage).toBe("number");
          if (result.hit) {
            gotHit = true;
            expect(result.damage).toBeGreaterThan(0);
            expect(result.message).toContain("off-hand");
          }
        }
        expect(gotHit).toBe(true);
      });

      it("throws when no off-hand weapon equipped", () => {
        const player = createPlayer("Test", defaultStats, "rogue");
        player.equippedWeapon = getItem("startDagger")!;
        const monster = createTestMonster();

        expect(() => playerOffHandAttack(player, monster)).toThrow("no off-hand weapon");
      });

      it("off-hand miss message mentions off-hand", () => {
        const player = createPlayer("Test", defaultStats, "rogue");
        player.equippedWeapon = getItem("startDagger")!;
        player.equippedOffHand = getItem("shortSword")!;
        const monster = createTestMonster({ ac: 30 }); // very hard to hit

        let gotMiss = false;
        for (let i = 0; i < 50; i++) {
          const result = playerOffHandAttack(player, monster);
          if (!result.hit) {
            gotMiss = true;
            expect(result.message).toContain("off-hand");
          }
        }
        expect(gotMiss).toBe(true);
      });
    });

    describe("shield/off-hand mutual exclusion", () => {
      it("equipping shield via useItem clears off-hand", () => {
        const player = createPlayer("Test", defaultStats, "rogue");
        player.equippedWeapon = getItem("startDagger")!;
        player.equippedOffHand = getItem("shortSword")!;
        const shield = getItem("woodenShield")!;
        player.inventory.push({ ...shield });
        const idx = player.inventory.findIndex(i => i.id === "woodenShield");

        // Need to clear two-handed since dagger is not two-handed
        const result = useItem(player, idx);
        expect(result.used).toBe(true);
        expect(player.equippedShield?.id).toBe("woodenShield");
        expect(player.equippedOffHand).toBeNull();
      });

      it("equipping two-handed weapon clears off-hand", () => {
        const player = createPlayer("Test", defaultStats, "rogue");
        player.equippedWeapon = getItem("startDagger")!;
        player.equippedOffHand = getItem("shortSword")!;
        const greatSword = getItem("greatSword")!;
        player.inventory.push({ ...greatSword });
        const idx = player.inventory.findIndex(i => i.id === "greatSword");

        const result = useItem(player, idx);
        expect(result.used).toBe(true);
        expect(player.equippedWeapon?.id).toBe("greatSword");
        expect(player.equippedOffHand).toBeNull();
        expect(player.equippedShield).toBeNull();
      });
    });
  });
});

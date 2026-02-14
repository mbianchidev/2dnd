import { describe, it, expect } from "vitest";
import {
  rollInitiative,
  playerAttack,
  playerCastSpell,
  playerUseAbility,
  monsterAttack,
  attemptFlee,
} from "../src/systems/combat";
import { createPlayer, type PlayerStats } from "../src/systems/player";
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
      const monster = createTestMonster();
      const result = playerCastSpell(player, "shortRest", monster);
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
});

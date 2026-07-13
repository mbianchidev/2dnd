import { describe, expect, it } from "vitest";
import {
  CHESTS,
  DUNGEONS,
  Terrain,
  getDungeonLevelMap,
  getDungeonLevelSpawn,
  getDungeonTotalLevels,
} from "../src/data/map";
import {
  TRAP_TYPES,
  getTrapDefinition,
  type DungeonTrap,
  type TrapType,
} from "../src/data/traps";
import { getItem } from "../src/data/items";
import { createPlayer, type PlayerState, type PlayerStats } from "../src/systems/player";
import {
  attemptTrapDetection,
  attemptTrapDisarm,
  generateDungeonTraps,
  getNearbyDungeonTraps,
  getTrapCheckModifiers,
  getTrapDropDestination,
  getTrapEntryDisposition,
  selectActionableTrap,
  triggerDungeonTrap,
} from "../src/systems/traps";

const BASE_STATS: PlayerStats = {
  strength: 10,
  dexterity: 14,
  constitution: 12,
  intelligence: 16,
  wisdom: 10,
  charisma: 8,
};

function createTestPlayer(): PlayerState {
  const player = createPlayer("Trap Tester", BASE_STATS, "rogue");
  player.hp = 30;
  player.maxHp = 30;
  player.mp = 20;
  player.maxMp = 20;
  player.xp = 0;
  player.pendingLevelUps = 0;
  return player;
}

function createTrap(
  type: TrapType,
  overrides: Partial<DungeonTrap> = {},
): DungeonTrap {
  const definition = getTrapDefinition(type);
  return {
    id: `test:${type}`,
    dungeonId: "heartlands_dungeon",
    level: 0,
    x: 5,
    y: 5,
    type,
    detectionDC: definition.detectionDC,
    disarmDC: definition.disarmDC,
    rewardXp: definition.rewardXp,
    protectsTreasure: false,
    ...overrides,
  };
}

describe("dungeon trap layouts", () => {
  it("defines the requested common and thematic trap types", () => {
    expect(TRAP_TYPES).toEqual([
      "spikePit",
      "poisonDarts",
      "fallingRocks",
      "alarm",
      "hiddenFloor",
      "necroticRune",
      "frostBurst",
      "flameJet",
    ]);
  });

  it("generates a stable layout for the same playthrough seed", () => {
    const dungeon = DUNGEONS[0];
    const first = generateDungeonTraps(dungeon, 0, 12345);
    const second = generateDungeonTraps(dungeon, 0, 12345);

    expect(second).toEqual(first);
  });

  it("varies layouts across playthrough seeds", () => {
    const dungeon = DUNGEONS[0];
    const first = generateDungeonTraps(dungeon, 0, 12345);
    const second = generateDungeonTraps(dungeon, 0, 98765);

    expect(second.map((trap) => trap.id)).not.toEqual(
      first.map((trap) => trap.id),
    );
  });

  it("places unique traps only on safe dungeon floor candidates", () => {
    for (const dungeon of DUNGEONS) {
      const totalLevels = getDungeonTotalLevels(dungeon);
      for (let level = 0; level < totalLevels; level++) {
        const layout = generateDungeonTraps(dungeon, level, 24680);
        const map = getDungeonLevelMap(dungeon, level);
        const spawn = getDungeonLevelSpawn(dungeon, level);
        const positions = new Set<string>();

        expect(layout.length).toBeGreaterThanOrEqual(
          dungeon.trapProfile.trapsPerLevel,
        );
        for (const trap of layout) {
          const key = `${trap.x},${trap.y}`;
          expect(positions.has(key)).toBe(false);
          positions.add(key);
          expect(map[trap.y][trap.x]).toBe(Terrain.DungeonFloor);
          expect(
            Math.abs(trap.x - spawn.x) + Math.abs(trap.y - spawn.y),
          ).toBeGreaterThan(1);
        }
      }
    }
  });

  it("protects every level-zero dungeon chest with an adjacent trap", () => {
    for (const dungeon of DUNGEONS) {
      const layout = generateDungeonTraps(dungeon, 0, 13579);
      const chests = CHESTS.filter(
        (chest) =>
          chest.location.type === "dungeon"
          && chest.location.dungeonId === dungeon.id
          && (chest.location.dungeonLevel ?? 0) === 0,
      );

      for (const chest of chests) {
        expect(
          layout.some(
            (trap) =>
              trap.protectsTreasure
              && Math.abs(trap.x - chest.x) + Math.abs(trap.y - chest.y) === 1,
          ),
        ).toBe(true);
      }
    }
  });
});

describe("trap detection and disarming", () => {
  it("persists a successful Intelligence detection without storing a skill record", () => {
    const player = createTestPlayer();
    const trap = createTrap("poisonDarts", { detectionDC: 13 });
    const result = attemptTrapDetection(player, trap, 10);

    expect(result).toMatchObject({
      attempted: true,
      success: true,
      automatic: false,
      roll: 10,
      modifier: 3,
      total: 13,
      dc: 13,
    });
    expect(player.progression.trapStates[trap.id]).toBe("detected");
    expect(player.progression.skillChecks).toEqual({});
  });

  it("persists a failed detection so it cannot be rerolled", () => {
    const player = createTestPlayer();
    const trap = createTrap("poisonDarts", { detectionDC: 20 });
    const failed = attemptTrapDetection(player, trap, 1);
    const repeated = attemptTrapDetection(player, trap, 20);

    expect(failed.success).toBe(false);
    expect(player.progression.trapStates[trap.id]).toBe("missed");
    expect(repeated.attempted).toBe(false);
    expect(player.progression.skillChecks).toEqual({});
  });

  it("automatically detects traps with Danger Sense without rolling", () => {
    const player = createTestPlayer();
    player.knownTalents.push("dangerSense");
    const trap = createTrap("hiddenFloor", { detectionDC: 99 });
    const result = attemptTrapDetection(player, trap, 1);

    expect(result.automatic).toBe(true);
    expect(result.success).toBe(true);
    expect(result.roll).toBeNull();
    expect(player.progression.trapStates[trap.id]).toBe("detected");
    expect(player.progression.skillChecks).toEqual({});
  });

  it("combines trap-kit, talent, and adventurer-guidance bonuses", () => {
    const player = createTestPlayer();
    const trapKit = getItem("trapKit");
    expect(trapKit).toBeDefined();
    player.inventory.push({ ...trapKit! });
    player.knownTalents.push("naturalExplorer", "cunningAction");
    player.progression.trapGuidance = true;

    expect(getTrapCheckModifiers(player)).toEqual({
      detectionBonus: 7,
      disarmBonus: 6,
      autoDetect: false,
    });
  });

  it("disarms detected traps and awards XP without storing a skill record", () => {
    const player = createTestPlayer();
    const trap = createTrap("spikePit", { disarmDC: 12, rewardXp: 35 });
    player.progression.trapStates[trap.id] = "detected";

    const result = attemptTrapDisarm(player, trap, 10);

    expect(result.success).toBe(true);
    expect(result.rewardXp).toBe(35);
    expect(player.xp).toBe(35);
    expect(player.progression.trapStates[trap.id]).toBe("disarmed");
    expect(player.progression.skillChecks).toEqual({});
  });

  it("leaves failed disarms detected until consequences trigger", () => {
    const player = createTestPlayer();
    const trap = createTrap("spikePit", { disarmDC: 20 });
    player.progression.trapStates[trap.id] = "detected";

    const failed = attemptTrapDisarm(player, trap, 1);

    expect(failed.success).toBe(false);
    expect(player.progression.trapStates[trap.id]).toBe("detected");
    const triggered = triggerDungeonTrap(player, trap, () => 5);
    expect(triggered.damage).toBe(5);
    expect(player.progression.trapStates[trap.id]).toBe("triggered");
  });

  it("blocks detected traps but triggers unseen or missed traps on entry", () => {
    expect(getTrapEntryDisposition(undefined)).toBe("trigger");
    expect(getTrapEntryDisposition("missed")).toBe("trigger");
    expect(getTrapEntryDisposition("detected")).toBe("blocked");
    expect(getTrapEntryDisposition("disarmed")).toBe("safe");
    expect(getTrapEntryDisposition("triggered")).toBe("safe");
  });

  it("finds traps within Manhattan distance", () => {
    const traps = [
      createTrap("spikePit", { id: "near", x: 4, y: 5 }),
      createTrap("alarm", { id: "far", x: 8, y: 8 }),
    ];

    expect(getNearbyDungeonTraps(traps, 5, 5, 1).map((trap) => trap.id)).toEqual([
      "near",
    ]);
  });

  it("prioritizes the detected trap that blocked movement", () => {
    const traps = [
      createTrap("spikePit", { id: "a-trap", x: 4, y: 5 }),
      createTrap("alarm", { id: "z-focused", x: 5, y: 4 }),
    ];
    const states = {
      "a-trap": "detected",
      "z-focused": "detected",
    } as const;

    expect(selectActionableTrap(traps, states, 5, 5, "z-focused")?.id).toBe(
      "z-focused",
    );
    expect(selectActionableTrap(traps, states, 5, 5, "stale")?.id).toBe(
      "a-trap",
    );
  });
});

describe("trap consequences", () => {
  it("applies immediate damage and seeds the next battle with a status", () => {
    const player = createTestPlayer();
    const trap = createTrap("poisonDarts");
    const result = triggerDungeonTrap(player, trap, () => 6);

    expect(result.triggered).toBe(true);
    expect(result.damage).toBe(6);
    expect(player.hp).toBe(24);
    expect(player.activeEffects).toContainEqual({
      id: "poison",
      remainingTurns: 3,
      source: "Poison Darts",
    });
    expect(player.progression.trapStates[trap.id]).toBe("triggered");
  });

  it("never reduces the player below one HP", () => {
    const player = createTestPlayer();
    player.hp = 3;
    const trap = createTrap("fallingRocks");

    const result = triggerDungeonTrap(player, trap, () => 99);

    expect(result.damage).toBe(2);
    expect(player.hp).toBe(1);
  });

  it("reports alarm encounters and hidden-floor drops", () => {
    const alarmPlayer = createTestPlayer();
    const alarm = triggerDungeonTrap(
      alarmPlayer,
      createTrap("alarm"),
      () => 0,
    );
    expect(alarm.startsEncounter).toBe(true);

    const floorPlayer = createTestPlayer();
    const hiddenFloor = triggerDungeonTrap(
      floorPlayer,
      createTrap("hiddenFloor"),
      () => 4,
    );
    expect(hiddenFloor.dropsLevel).toBe(true);
    expect(hiddenFloor.mpLoss).toBeGreaterThan(0);
  });

  it("does not retrigger resolved traps", () => {
    const player = createTestPlayer();
    const trap = createTrap("flameJet");
    triggerDungeonTrap(player, trap, () => 4);
    const hpAfterFirstTrigger = player.hp;

    const repeated = triggerDungeonTrap(player, trap, () => 4);

    expect(repeated.triggered).toBe(false);
    expect(player.hp).toBe(hpAfterFirstTrigger);
  });

  it("uses the next level spawn for hidden floors and stops at the deepest floor", () => {
    const player = createTestPlayer();
    player.position.inDungeon = true;
    player.position.dungeonId = "heartlands_dungeon";
    player.position.dungeonLevel = 0;

    expect(getTrapDropDestination(player)).toEqual({
      level: 1,
      x: 1,
      y: 13,
    });

    player.position.dungeonLevel = 1;
    expect(getTrapDropDestination(player)).toBeNull();
  });
});

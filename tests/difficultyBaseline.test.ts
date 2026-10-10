import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ALL_MONSTERS } from "../src/data/monsters";
import { createSoloEncounter } from "../src/data/monsterGroups";
import {
  attemptFlee,
  monsterAttack,
  monsterUseAbility,
} from "../src/systems/combat";
import {
  calculateEncounterRewards,
  createGroupCombatants,
  deriveMonsterStats,
  getFleeDC,
  getMonsterDefendChance,
} from "../src/systems/groupCombat";
import { getEffectiveEncounterRate } from "../src/managers/encounter";
import {
  createPlayer,
  buyItem,
  type PlayerState,
} from "../src/systems/player";
import { applyPartyDefeat, recruitCompanion } from "../src/systems/party";
import { getItem, getSellValue } from "../src/data/items";
import { resolveSkillCheck } from "../src/systems/skillChecks";
import { applyStatusEffect } from "../src/systems/statusEffects";

function makePlayer(): PlayerState {
  return createPlayer("RulesTest", {
    strength: 15,
    dexterity: 12,
    constitution: 13,
    intelligence: 10,
    wisdom: 10,
    charisma: 8,
  });
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

afterEach(() => vi.restoreAllMocks());

describe("Standard baseline captured from main 183954b", () => {
  it("preserves every canonical enemy attack, ability, reward and group value", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0.5);
    const matrix = ALL_MONSTERS.map((monster) => {
      const outcomes = [0, 0.45, 0.95].map((roll) => {
        random.mockReturnValue(roll);
        const player = makePlayer();
        player.hp = player.maxHp = 10000;
        const targetEffects = player.activeEffects;
        applyStatusEffect(targetEffects, "haste", "baseline");
        const effects: PlayerState["activeEffects"] = [];
        applyStatusEffect(effects, "slow", "baseline");
        const attack = monsterAttack(monster, player, 2, 1, 1, effects, 2, 1);
        const abilities = (monster.abilities ?? []).map((ability) => {
          player.hp = player.maxHp;
          player.activeEffects = [];
          const result = monsterUseAbility(ability, monster, player, effects, 1);
          return { result, hp: player.hp, effects: player.activeEffects };
        });
        return { attack, abilities };
      });
      const solo = createSoloEncounter(monster);
      const group = {
        ...solo,
        id: `baseline:${monster.id}`,
        isGroup: true,
        members: [
          { monster, position: "front" as const },
          { monster, position: "back" as const },
        ],
      };
      const actors = createGroupCombatants(group);
      return {
        id: monster.id,
        outcomes,
        soloReward: calculateEncounterRewards(solo),
        groupReward: calculateEncounterRewards(group),
        group: actors.map((actor) => ({
          id: actor.id,
          label: actor.label,
          hp: actor.currentHp,
          maxHp: actor.maxHp,
          position: actor.position,
          defendChance: getMonsterDefendChance(undefined, actors, 0),
        })),
        stats: deriveMonsterStats(monster.attackBonus),
      };
    });
    expect({ enemies: matrix.length, digest: digest(matrix) }).toMatchInlineSnapshot(`
      {
        "digest": "cdb1a5763ed9f1275762ff4574a29a362526e52c0be1668c7209836ca1b2b62e",
        "enemies": 58,
      }
    `);
  });

  it("preserves encounter caps, flee checks and ability-check totals", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.45);
    const player = makePlayer();
    const matrix = {
      encounters: [0, 0.02, 0.08, 0.12, 0.15].map((base) =>
        [0, 0.5, 1, 1.5, 3].map((multiplier) =>
          getEffectiveEncounterRate(base, multiplier, 1.5, 0.8, 1.25),
        ),
      ),
      flee: [1, 2, 3, 4].map((count) => ({
        dc: getFleeDC(count),
        result: attemptFlee(2, count),
      })),
      checks: [1, 8, 20].map((roll) =>
        [10, 13, 18].map((dc) =>
          resolveSkillCheck(player.stats, "wisdom", dc, roll, {
            situationalModifier: 2,
            optionId: "baseline",
          }),
        ),
      ),
    };
    expect(matrix).toMatchInlineSnapshot(`
      {
        "checks": [
          [
            {
              "ability": "wisdom",
              "dc": 10,
              "modifier": 2,
              "naturalRoll": 1,
              "optionId": "baseline",
              "success": false,
              "total": 3,
            },
            {
              "ability": "wisdom",
              "dc": 13,
              "modifier": 2,
              "naturalRoll": 1,
              "optionId": "baseline",
              "success": false,
              "total": 3,
            },
            {
              "ability": "wisdom",
              "dc": 18,
              "modifier": 2,
              "naturalRoll": 1,
              "optionId": "baseline",
              "success": false,
              "total": 3,
            },
          ],
          [
            {
              "ability": "wisdom",
              "dc": 10,
              "modifier": 2,
              "naturalRoll": 8,
              "optionId": "baseline",
              "success": true,
              "total": 10,
            },
            {
              "ability": "wisdom",
              "dc": 13,
              "modifier": 2,
              "naturalRoll": 8,
              "optionId": "baseline",
              "success": false,
              "total": 10,
            },
            {
              "ability": "wisdom",
              "dc": 18,
              "modifier": 2,
              "naturalRoll": 8,
              "optionId": "baseline",
              "success": false,
              "total": 10,
            },
          ],
          [
            {
              "ability": "wisdom",
              "dc": 10,
              "modifier": 2,
              "naturalRoll": 20,
              "optionId": "baseline",
              "success": true,
              "total": 22,
            },
            {
              "ability": "wisdom",
              "dc": 13,
              "modifier": 2,
              "naturalRoll": 20,
              "optionId": "baseline",
              "success": true,
              "total": 22,
            },
            {
              "ability": "wisdom",
              "dc": 18,
              "modifier": 2,
              "naturalRoll": 20,
              "optionId": "baseline",
              "success": true,
              "total": 22,
            },
          ],
        ],
        "encounters": [
          [
            0,
            0,
            0,
            0,
            0,
          ],
          [
            0,
            0.015,
            0.03,
            0.045,
            0.09,
          ],
          [
            0,
            0.06,
            0.12,
            0.15,
            0.15,
          ],
          [
            0,
            0.09,
            0.15,
            0.15,
            0.15,
          ],
          [
            0,
            0.11249999999999999,
            0.15,
            0.15,
            0.15,
          ],
        ],
        "flee": [
          {
            "dc": 10,
            "result": {
              "message": "Escaped! (rolled 12)",
              "success": true,
            },
          },
          {
            "dc": 12,
            "result": {
              "message": "Escaped! (rolled 12)",
              "success": true,
            },
          },
          {
            "dc": 14,
            "result": {
              "message": "Failed to escape! (rolled 12, needed 14)",
              "success": false,
            },
          },
          {
            "dc": 16,
            "result": {
              "message": "Failed to escape! (rolled 12, needed 16)",
              "success": false,
            },
          },
        ],
      }
    `);
  });

  it("preserves exact odd-value defeat, companion recovery and baseline economy", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const player = makePlayer();
    player.gold = 101;
    player.xp = 399;
    player.maxHp = 31;
    player.maxMp = 9;
    player.hp = 0;
    player.pendingLevelUps = 1;
    recruitCompanion(player, "guardian");
    const companion = player.party.companions[0]!;
    companion.hp = 0;
    companion.xp = 399;
    const receipt = applyPartyDefeat(player, [
      "party:hero",
      "party:companion:guardian",
      "party:hero",
    ]);
    const potion = getItem("potion")!;
    player.gold = 100;
    const purchased = buyItem(player, potion);
    expect({
      receipt,
      economy: {
        purchased,
        gold: player.gold,
        sellValue: getSellValue(potion),
      },
    }).toMatchInlineSnapshot(`
      {
        "economy": {
          "gold": 85,
          "purchased": true,
          "sellValue": 7,
        },
        "receipt": {
          "actors": [
            {
              "combatantId": "party:hero",
              "level": 1,
              "name": "RulesTest",
              "restoredHp": 15,
              "restoredMp": 4,
              "xpAfter": 0,
              "xpBefore": 399,
              "xpLost": 399,
            },
            {
              "combatantId": "party:companion:guardian",
              "level": 1,
              "name": "Bram Ironward",
              "restoredHp": 15,
              "restoredMp": 3,
              "xpAfter": 0,
              "xpBefore": 399,
              "xpLost": 399,
            },
          ],
          "goldAfter": 70,
          "goldBefore": 101,
          "goldLost": 31,
          "recoveryLocation": {
            "chunkX": 4,
            "chunkY": 2,
            "name": "Willowdale",
            "x": 2,
            "y": 2,
          },
        },
      }
    `);
  });
});

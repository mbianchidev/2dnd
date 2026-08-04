// @vitest-environment happy-dom

import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({
  Scene: class {
    constructor(_config?: unknown) {}
  },
}));

import { BattleScene } from "../src/scenes/Battle";
import { createSoloEncounter } from "../src/data/monsterGroups";
import { getMonster } from "../src/data/monsters";
import { createCodex, type CodexData } from "../src/systems/codex";
import { createPlayer, type PlayerState } from "../src/systems/player";
import {
  createGroupCombatants,
  createHeroCombatant,
  type GroupCombatant,
  type PartyCombatant,
} from "../src/systems/groupCombat";
import { xpFloorForLevel, type PartyDefeatResult } from "../src/systems/party";
import { deleteSave, loadGame } from "../src/systems/save";
import {
  createWeatherState,
  type WeatherState,
} from "../src/systems/weather";
import type { SavedSpecialNpc } from "../src/data/npcs";
import type { QuestUpdate } from "../src/systems/quests";
import type { ActiveStatusEffect } from "../src/systems/statusEffects";

interface TransitionManagerHarness {
  startWithFade(
    startScene: () => void,
    options: { duration?: number; label?: string },
  ): boolean;
}

interface BattleTransitionHarness {
  returnToOverworld(): void;
  defeatEncounterForDebug(): void;
  handleDefeat(): void;
  isReturningToOverworld: boolean;
  phase: string;
  battleResultReported: boolean;
  defeatResult: PartyDefeatResult | null;
  battlePartyManager: { clear(): void };
  battlePartyRenderer: { clear(): void };
  sceneTransitions: TransitionManagerHarness;
  partyCombatants: Array<{ effects: ActiveStatusEffect[] }> | PartyCombatant[];
  combatants:
    | Array<{ effects: ActiveStatusEffect[]; isAlive?: boolean }>
    | GroupCombatant[];
  encounter: ReturnType<typeof createSoloEncounter>;
  battleHooks?: { onBattleResolved(result: unknown): void };
  setCombatantHp(index: number, hp: number): void;
  updateMonsterDisplay(): void;
  checkBattleEnd(endPlayerTurn?: boolean): void;
  scene: { start(sceneKey: string, data: unknown): void };
  player: PlayerState;
  defeatedBosses: Set<string>;
  codex: CodexData;
  timeStep: number;
  weatherState: WeatherState;
  savedSpecialNpcs: SavedSpecialNpc[];
  questUpdates: QuestUpdate[];
}

function poisonEffect(): ActiveStatusEffect {
  return {
    id: "poison",
    remainingTurns: 2,
    source: "Regression test",
  };
}

describe("BattleScene Overworld transition", () => {
  it("waits for fade completion, clears transient state, and starts once with the full payload", () => {
    const battle = new BattleScene();
    const harness = battle as unknown as BattleTransitionHarness;
    const player = createPlayer("TransitionHero", {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    });
    player.activeEffects.push(poisonEffect());
    player.position.inDungeon = true;
    player.position.dungeonId = "heartlands_dungeon";
    player.position.dungeonLevel = 1;
    player.progression.trapStates["trap:test"] = "disarmed";
    player.progression.quests.seenWarnings.push("frostRouteDanger");
    const enemyEffects = [poisonEffect()];
    const defeatedBosses = new Set(["cryptLich"]);
    const codex = createCodex();
    const weatherState = createWeatherState();
    const savedSpecialNpcs: SavedSpecialNpc[] = [];
    const questUpdates: QuestUpdate[] = [{
      type: "objective",
      questId: "twelvefoldCovenant",
      message: "Defeat recorded.",
    }];
    const clearParty = vi.fn();
    const clearRenderer = vi.fn();
    const start = vi.fn();
    let fadeComplete: (() => void) | undefined;
    const sceneTransitions: TransitionManagerHarness = {
      startWithFade: vi.fn((callback, options) => {
        expect(options).toEqual({
          duration: 500,
          label: "battle return",
        });
        fadeComplete = callback;
        return true;
      }),
    };

    Object.assign(harness, {
      isReturningToOverworld: false,
      battlePartyManager: { clear: clearParty },
      battlePartyRenderer: { clear: clearRenderer },
      sceneTransitions,
      partyCombatants: [{ effects: player.activeEffects }],
      combatants: [{ effects: enemyEffects }],
      player,
      defeatedBosses,
      codex,
      timeStep: 173,
      weatherState,
      savedSpecialNpcs,
      questUpdates,
    });
    Object.defineProperties(battle, {
      scene: {
        configurable: true,
        value: { start },
      },
    });

    harness.returnToOverworld();
    harness.returnToOverworld();

    expect(clearParty).toHaveBeenCalledTimes(1);
    expect(clearRenderer).toHaveBeenCalledTimes(1);
    expect(player.activeEffects).toEqual([]);
    expect(enemyEffects).toEqual([]);
    expect(sceneTransitions.startWithFade).toHaveBeenCalledTimes(1);
    expect(start).not.toHaveBeenCalled();

    fadeComplete?.();

    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith("OverworldScene", {
      player,
      defeatedBosses,
      codex,
      timeStep: 173,
      weatherState,
      savedSpecialNpcs,
      questUpdates,
    });
  });

  it("allows a retry when the transition manager rejects the first return", () => {
    const battle = new BattleScene();
    const harness = battle as unknown as BattleTransitionHarness;
    const player = createPlayer("RetryHero", {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    });
    const startWithFade = vi.fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    Object.assign(harness, {
      isReturningToOverworld: false,
      battlePartyManager: { clear: vi.fn() },
      battlePartyRenderer: { clear: vi.fn() },
      sceneTransitions: { startWithFade },
      partyCombatants: [{ effects: [] }],
      combatants: [{ effects: [] }],
      player,
      defeatedBosses: new Set<string>(),
      codex: createCodex(),
      timeStep: 0,
      weatherState: createWeatherState(),
      savedSpecialNpcs: [],
      questUpdates: [],
    });

    harness.returnToOverworld();
    expect(harness.isReturningToOverworld).toBe(false);

    harness.returnToOverworld();
    expect(harness.isReturningToOverworld).toBe(true);
    expect(startWithFade).toHaveBeenCalledTimes(2);
  });

  it("routes debug instant victory through the normal battle-end check during init", () => {
    const battle = new BattleScene();
    const harness = battle as unknown as BattleTransitionHarness;
    const setCombatantHp = vi.fn((index: number) => {
      const combatant = harness.combatants[index];
      if (combatant) combatant.isAlive = false;
    });
    const updateMonsterDisplay = vi.fn();
    const checkBattleEnd = vi.fn();
    Object.assign(harness, {
      phase: "init",
      combatants: [
        { effects: [], isAlive: true },
        { effects: [], isAlive: true },
      ],
      setCombatantHp,
      updateMonsterDisplay,
      checkBattleEnd,
    });

    harness.defeatEncounterForDebug();

    expect(setCombatantHp).toHaveBeenNthCalledWith(1, 0, 0);
    expect(setCombatantHp).toHaveBeenNthCalledWith(2, 1, 0);
    expect(updateMonsterDisplay).toHaveBeenCalledTimes(1);
    expect(checkBattleEnd).toHaveBeenCalledWith(false);
  });

  it.each([
    { monsterId: "slime", encounterType: "random" },
    { monsterId: "troll", encounterType: "boss" },
  ] as const)(
    "applies one defeat penalty and routes $encounterType encounters through DefeatScene",
    ({ monsterId, encounterType }) => {
      deleteSave();
      const battle = new BattleScene();
      const harness = battle as unknown as BattleTransitionHarness;
      const player = createPlayer("DefeatedHero", {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      });
      player.level = 5;
      player.xp = xpFloorForLevel(5) + 500;
      player.gold = 101;
      player.hp = 0;
      player.activeEffects.push(poisonEffect());
      const encounter = createSoloEncounter(getMonster(monsterId)!);
      const partyCombatants = [createHeroCombatant(player)];
      const combatants = createGroupCombatants(encounter);
      const resolved = vi.fn();
      const start = vi.fn();
      let fadeComplete: (() => void) | undefined;
      const startWithFade = vi.fn((callback, options) => {
        expect(options).toEqual({
          duration: 500,
          red: 24,
          green: 0,
          blue: 8,
          label: "battle defeat result",
        });
        fadeComplete = callback;
        return true;
      });
      Object.assign(harness, {
        player,
        encounter,
        partyCombatants,
        combatants,
        battleHooks: { onBattleResolved: resolved },
        battleResultReported: false,
        defeatResult: null,
        defeatedBosses: new Set<string>(),
        codex: createCodex(),
        timeStep: 19,
        weatherState: createWeatherState(),
        savedSpecialNpcs: [],
        questUpdates: [],
        battlePartyManager: { clear: vi.fn() },
        battlePartyRenderer: { clear: vi.fn() },
        sceneTransitions: { startWithFade },
        isReturningToOverworld: false,
      });
      Object.defineProperty(battle, "scene", {
        configurable: true,
        value: { start },
      });

      harness.handleDefeat();
      harness.handleDefeat();

      expect(player.gold).toBe(70);
      expect(player.xp).toBe(xpFloorForLevel(5));
      expect(player.activeEffects).toEqual([]);
      expect(resolved).toHaveBeenCalledTimes(1);
      expect(startWithFade).toHaveBeenCalledTimes(1);
      expect(loadGame()?.player.gold).toBe(70);
      expect(start).not.toHaveBeenCalled();

      fadeComplete?.();

      expect(start).toHaveBeenCalledWith(
        "DefeatScene",
        expect.objectContaining({
          player,
          encounterName: encounter.name,
          encounterType,
          defeatResult: expect.objectContaining({
            goldBefore: 101,
            goldAfter: 70,
            goldLost: 31,
            recoveryLocation: expect.objectContaining({
              name: "Willowdale",
            }),
          }),
        }),
      );
    },
  );
});

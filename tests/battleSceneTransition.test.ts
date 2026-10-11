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
  type BattleOutcome,
} from "../src/systems/groupCombat";
import { createActivePartyCombatants, recruitCompanion, xpFloorForLevel, type PartyDefeatResult } from "../src/systems/party";
import { deleteSave, loadGame, saveGame } from "../src/systems/save";
import {
  createWeatherState,
  type WeatherState,
} from "../src/systems/weather";
import type { SavedSpecialNpc } from "../src/data/npcs";
import type { QuestUpdate } from "../src/systems/quests";
import type { ActiveStatusEffect } from "../src/systems/statusEffects";
import { getActiveDevotionBlessing, performTempleRite } from "../src/systems/devotionTemples";

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
  handleVictory(): void;
  reportBattleResult(outcome: BattleOutcome): unknown;
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
  it.each(["victory", "fled", "defeat"] as const)(
    "clears effects at the once-only %s resolution boundary before callers autosave",
    (outcome) => {
      deleteSave();
      const battle = new BattleScene();
      const harness = battle as unknown as BattleTransitionHarness;
      const player = createPlayer("Resolution fixture", {
        strength: 10, dexterity: 10, constitution: 10,
        intelligence: 10, wisdom: 10, charisma: 10,
      });
      Object.assign(player.position, {
        inCity: true, cityId: "willowdale_city", cityChunkIndex: 1, x: 10, y: 8,
      });
      performTempleRite(player, "willowdaleSpanThread");
      const companion = recruitCompanion(player, "guardian").companion!;
      companion.activeEffects.push(poisonEffect());
      const encounter = createSoloEncounter(getMonster("slime")!);
      const combatants = createGroupCombatants(encounter);
      combatants[0].effects.push(poisonEffect());
      const resolved = vi.fn(() => {
        expect(player.activeEffects.some((effect) => effect.id === "templeWard")).toBe(true);
        expect(companion.activeEffects).toHaveLength(1);
      });
      Object.assign(harness, {
        player, encounter, combatants, partyCombatants: [
          createHeroCombatant(player), ...createActivePartyCombatants(player.party),
        ],
        battleResultReported: false, battleHooks: { onBattleResolved: resolved },
        achievementBattleSourceId: `fixture:resolved:${outcome}`,
      });
      harness.reportBattleResult(outcome);
      harness.reportBattleResult(outcome);
      expect(resolved).toHaveBeenCalledTimes(1);
      expect(player.activeEffects).toEqual([]);
      expect(companion.activeEffects).toEqual([]);
      expect(combatants[0].effects).toEqual([]);
      saveGame(player, new Set(), createCodex(), player.appearanceId);
      expect(loadGame()!.player.activeEffects).toEqual([]);
      expect(loadGame()!.player.party.companions[0].activeEffects).toEqual([]);
    },
  );

  it("saves victory after clearing a prepared blessing, even before the presentation handoff", () => {
    deleteSave();
    const battle = new BattleScene();
    const harness = battle as unknown as BattleTransitionHarness;
    const player = createPlayer("Blessing fixture", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    Object.assign(player.position, {
      inCity: true, cityId: "willowdale_city", cityChunkIndex: 1, x: 10, y: 8,
    });
    expect(performTempleRite(player, "willowdaleSpanThread").changed).toBe(true);
    const encounter = createSoloEncounter(getMonster("slime")!);
    const partyCombatants = [createHeroCombatant(player)];
    const combatants = createGroupCombatants(encounter);
    for (const combatant of combatants) {
      combatant.currentHp = 0;
      combatant.isAlive = false;
      combatant.isKnockedOut = true;
      combatant.effects.push(poisonEffect());
    }
    const delayedCall = vi.fn();
    Object.assign(harness, {
      player, encounter, partyCombatants, combatants,
      phase: "playerTurn", battleResultReported: false,
      defeatedBosses: new Set(), codex: createCodex(),
      timeStep: 0, weatherState: createWeatherState(),
      achievementBattleSourceId: "fixture:blessingVictory",
      achievementBattleDebug: false,
      updateButtonStates: vi.fn(), updateMonsterDisplay: vi.fn(), addLog: vi.fn(),
      codexDiscovery: { show: vi.fn() },
      battlePresentation: { presentVictory: vi.fn() },
      updatePlayerStats: vi.fn(), time: { delayedCall },
    });
    harness.handleVictory();
    const loaded = loadGame()!.player;
    expect(loaded.activeEffects).toEqual([]);
    expect(getActiveDevotionBlessing(loaded)).toBeNull();
    expect(loaded.progression.devotion.appliedSourceIds).toContain("willowdaleSpanThread");
    expect(performTempleRite(loaded, "willowdaleSpanThread").changed).toBe(false);
    expect(delayedCall).toHaveBeenCalledTimes(1);
    const goldAfter = player.gold;
    harness.handleVictory();
    expect(player.gold).toBe(goldAfter);
  });

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

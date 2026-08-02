import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({
  Scene: class {
    constructor(_config?: unknown) {}
  },
}));

import { BattleScene } from "../src/scenes/Battle";
import { createCodex, type CodexData } from "../src/systems/codex";
import { createPlayer, type PlayerState } from "../src/systems/player";
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
  isReturningToOverworld: boolean;
  battlePartyManager: { clear(): void };
  battlePartyRenderer: { clear(): void };
  sceneTransitions: TransitionManagerHarness;
  partyCombatants: Array<{ effects: ActiveStatusEffect[] }>;
  combatants: Array<{ effects: ActiveStatusEffect[] }>;
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
});

import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({
  Scene: class {
    constructor(_config?: unknown) {}
  },
  Cameras: {
    Scene2D: {
      Events: {
        FADE_OUT_COMPLETE: "camerafadeoutcomplete",
      },
    },
  },
}));

import * as Phaser from "phaser";
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

interface FadeCameraHarness {
  resetFX(): void;
  once(event: string, callback: () => void): FadeCameraHarness;
  fadeOut(
    duration: number,
    red: number,
    green: number,
    blue: number,
  ): void;
}

interface BattleTransitionHarness {
  returnToOverworld(): void;
  isReturningToOverworld: boolean;
  battlePartyManager: { clear(): void };
  battlePartyRenderer: { clear(): void };
  partyCombatants: Array<{ effects: ActiveStatusEffect[] }>;
  combatants: Array<{ effects: ActiveStatusEffect[] }>;
  cameras: { main: FadeCameraHarness };
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
    const resetFX = vi.fn();
    const fadeOut = vi.fn();
    let fadeComplete: (() => void) | undefined;
    const camera: FadeCameraHarness = {
      resetFX,
      once: vi.fn((event: string, callback: () => void) => {
        expect(event).toBe(
          Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
        );
        fadeComplete = callback;
        return camera;
      }),
      fadeOut,
    };

    Object.assign(harness, {
      isReturningToOverworld: false,
      battlePartyManager: { clear: clearParty },
      battlePartyRenderer: { clear: clearRenderer },
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
      cameras: {
        configurable: true,
        value: { main: camera },
      },
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
    expect(resetFX).toHaveBeenCalledTimes(1);
    expect(camera.once).toHaveBeenCalledTimes(1);
    expect(fadeOut).toHaveBeenCalledWith(500, 0, 0, 0);
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

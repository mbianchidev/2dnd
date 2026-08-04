// @vitest-environment happy-dom

import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({
  Scene: class {
    constructor(_config?: unknown) {}
  },
}));

import {
  DefeatScene,
  type DefeatSceneData,
} from "../src/scenes/Defeat";
import { createCodex } from "../src/systems/codex";
import { createPlayer } from "../src/systems/player";
import { createWeatherState } from "../src/systems/weather";

interface TransitionManagerHarness {
  isPending: boolean;
  startWithFade(
    startScene: () => void,
    options: {
      duration?: number;
      red?: number;
      green?: number;
      blue?: number;
      label?: string;
    },
  ): boolean;
}

interface DefeatTransitionHarness {
  continueRecovery(): void;
  sceneTransitions: TransitionManagerHarness;
  scene: { start(sceneKey: string, data: unknown): void };
}

function createSceneData(): DefeatSceneData {
  const player = createPlayer("RecoveryHero", {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
  });
  return {
    player,
    defeatedBosses: new Set(["cryptLich"]),
    codex: createCodex(),
    timeStep: 84,
    weatherState: createWeatherState(),
    savedSpecialNpcs: [],
    encounterName: "Cave Troll",
    encounterType: "boss",
    defeatResult: {
      actors: [{
        combatantId: "party:hero",
        name: player.name,
        level: player.level,
        xpBefore: 50,
        xpAfter: 0,
        xpLost: 50,
        restoredHp: Math.max(1, Math.floor(player.maxHp / 2)),
        restoredMp: Math.floor(player.maxMp / 2),
      }],
      goldBefore: 101,
      goldAfter: 70,
      goldLost: 31,
      recoveryLocation: {
        name: "Willowdale",
        x: 2,
        y: 2,
        chunkX: 4,
        chunkY: 2,
      },
    },
  };
}

describe("DefeatScene transition contracts", () => {
  it("continues once with the unchanged full shared payload", () => {
    const data = createSceneData();
    const defeat = new DefeatScene();
    defeat.init(data);
    const harness = defeat as unknown as DefeatTransitionHarness;
    const start = vi.fn();
    let fadeComplete: (() => void) | undefined;
    const sceneTransitions: TransitionManagerHarness = {
      isPending: false,
      startWithFade: vi.fn((callback, options) => {
        expect(options).toEqual({
          duration: 500,
          red: 24,
          green: 0,
          blue: 8,
          label: "defeat recovery",
        });
        fadeComplete = callback;
        sceneTransitions.isPending = true;
        return true;
      }),
    };
    Object.assign(harness, { sceneTransitions });
    Object.defineProperty(defeat, "scene", {
      configurable: true,
      value: { start },
    });

    harness.continueRecovery();
    harness.continueRecovery();

    expect(start).not.toHaveBeenCalled();
    expect(sceneTransitions.startWithFade).toHaveBeenCalledTimes(1);
    fadeComplete?.();
    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith("OverworldScene", {
      player: data.player,
      defeatedBosses: data.defeatedBosses,
      codex: data.codex,
      timeStep: data.timeStep,
      weatherState: data.weatherState,
      savedSpecialNpcs: data.savedSpecialNpcs,
    });
  });
});

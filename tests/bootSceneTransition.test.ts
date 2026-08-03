import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({
  Scene: class {
    constructor(_config?: unknown) {}
  },
}));

import { BootScene } from "../src/scenes/Boot";
import { createCodex } from "../src/systems/codex";
import { createPlayer, type PlayerState } from "../src/systems/player";
import { deleteSave, loadGame, saveGame } from "../src/systems/save";
import { createWeatherState } from "../src/systems/weather";

interface TransitionManagerHarness {
  isPending: boolean;
  startWithFade(
    startScene: () => void,
    options: { duration?: number; label?: string },
  ): boolean;
}

interface BootTransitionHarness {
  continueGame(): void;
  startNewGame(player: PlayerState): void;
  sceneTransitions: TransitionManagerHarness;
  scene: { start(sceneKey: string, data?: unknown): void };
}

function createTestPlayer(name: string): PlayerState {
  return createPlayer(name, {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
  });
}

describe("BootScene Overworld transition", () => {
  beforeEach(() => {
    deleteSave();
  });

  it("loads and starts Overworld with the complete persistent payload", () => {
    const player = createTestPlayer("LoadedHero");
    const defeatedBosses = new Set(["cryptLich"]);
    const codex = createCodex();
    const weatherState = createWeatherState();
    weatherState.stepsUntilChange = 17;
    saveGame(player, defeatedBosses, codex, player.appearanceId, 143, weatherState);

    const boot = new BootScene();
    const harness = boot as unknown as BootTransitionHarness;
    const start = vi.fn();
    let fadeComplete: (() => void) | undefined;
    const sceneTransitions: TransitionManagerHarness = {
      isPending: false,
      startWithFade: vi.fn((callback, options) => {
        expect(options).toEqual({
          duration: 500,
          label: "continue game",
        });
        fadeComplete = callback;
        sceneTransitions.isPending = true;
        return true;
      }),
    };
    Object.assign(harness, { sceneTransitions });
    Object.defineProperty(boot, "scene", {
      configurable: true,
      value: { start },
    });

    harness.continueGame();

    expect(start).not.toHaveBeenCalled();
    fadeComplete?.();

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(start).toHaveBeenCalledWith("OverworldScene", {
      player: loaded!.player,
      defeatedBosses: new Set(["cryptLich"]),
      codex: loaded!.codex,
      timeStep: 143,
      weatherState: loaded!.weatherState,
      savedSpecialNpcs: [],
    });
  });

  it("starts a new campaign with fresh shared state instead of stale scene defaults", () => {
    const oldPlayer = createTestPlayer("OldHero");
    saveGame(
      oldPlayer,
      new Set(["infernoForgemaster"]),
      createCodex(),
      oldPlayer.appearanceId,
      300,
      createWeatherState(),
    );
    const player = createTestPlayer("NewHero");
    const boot = new BootScene();
    const harness = boot as unknown as BootTransitionHarness;
    const start = vi.fn();
    let fadeComplete: (() => void) | undefined;
    const sceneTransitions: TransitionManagerHarness = {
      isPending: false,
      startWithFade: vi.fn((callback, options) => {
        expect(options).toEqual({
          duration: 500,
          label: "start new game",
        });
        fadeComplete = callback;
        sceneTransitions.isPending = true;
        return true;
      }),
    };
    Object.assign(harness, { sceneTransitions });
    Object.defineProperty(boot, "scene", {
      configurable: true,
      value: { start },
    });

    harness.startNewGame(player);
    harness.startNewGame(player);

    expect(loadGame()).toBeNull();
    expect(sceneTransitions.startWithFade).toHaveBeenCalledTimes(1);
    fadeComplete?.();

    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith("OverworldScene", {
      player,
      defeatedBosses: new Set(),
      codex: { entries: {} },
      timeStep: 0,
      weatherState: createWeatherState(),
      savedSpecialNpcs: [],
    });
  });
});

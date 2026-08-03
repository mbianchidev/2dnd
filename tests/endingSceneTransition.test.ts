import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({
  Scene: class {
    constructor(_config?: unknown) {}
  },
}));

import { CAMPAIGN_EPILOGUE_CUTSCENE_ID } from "../src/data/cutscenes";
import type { SavedSpecialNpc } from "../src/data/npcs";
import { EndingScene, type EndingSceneData } from "../src/scenes/Ending";
import { createCodex } from "../src/systems/codex";
import { createPlayer } from "../src/systems/player";
import { deleteSave, loadGame } from "../src/systems/save";
import { createWeatherState } from "../src/systems/weather";

interface TransitionManagerHarness {
  isPending: boolean;
  startWithFade(
    startScene: () => void,
    options: { duration?: number; label?: string },
  ): boolean;
}

interface EndingTransitionHarness {
  continuePostGame(): void;
  returnToTitle(): void;
  sceneTransitions: TransitionManagerHarness;
  scene: { start(sceneKey: string, data?: unknown): void };
}

function createSceneData(): EndingSceneData {
  const player = createPlayer("EndingHero", {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
  });
  const savedSpecialNpcs: SavedSpecialNpc[] = [{
    kind: "traveler",
    x: 7,
    y: 8,
    interactions: 2,
  }];
  return {
    player,
    defeatedBosses: new Set([
      "cryptLich",
      "frostWarden",
      "infernoForgemaster",
    ]),
    codex: createCodex(),
    timeStep: 281,
    weatherState: createWeatherState(),
    savedSpecialNpcs,
    cutsceneId: CAMPAIGN_EPILOGUE_CUTSCENE_ID,
  };
}

function attachHarness(
  ending: EndingScene,
  expectedLabel: string,
): {
  harness: EndingTransitionHarness;
  start: ReturnType<typeof vi.fn>;
  completeFade(): void;
} {
  const harness = ending as unknown as EndingTransitionHarness;
  const start = vi.fn();
  let fadeComplete: (() => void) | undefined;
  const sceneTransitions: TransitionManagerHarness = {
    isPending: false,
    startWithFade: vi.fn((callback, options) => {
      expect(options).toEqual({
        duration: 500,
        label: expectedLabel,
      });
      fadeComplete = callback;
      sceneTransitions.isPending = true;
      return true;
    }),
  };
  Object.assign(harness, { sceneTransitions });
  Object.defineProperty(ending, "scene", {
    configurable: true,
    value: { start },
  });
  return {
    harness,
    start,
    completeFade: () => fadeComplete?.(),
  };
}

describe("EndingScene transition contracts", () => {
  beforeEach(() => {
    deleteSave();
  });

  it("continues post-game with the unchanged full shared payload", () => {
    const data = createSceneData();
    const ending = new EndingScene();
    ending.init(data);
    const { harness, start, completeFade } = attachHarness(
      ending,
      "ending to post-game",
    );

    harness.continuePostGame();

    expect(start).not.toHaveBeenCalled();
    completeFade();
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

  it("saves before fading back to Boot", () => {
    const data = createSceneData();
    const ending = new EndingScene();
    ending.init(data);
    const { harness, start, completeFade } = attachHarness(
      ending,
      "ending to title",
    );

    harness.returnToTitle();
    harness.returnToTitle();

    const saved = loadGame();
    expect(saved).not.toBeNull();
    expect(saved!.player.name).toBe(data.player.name);
    expect(saved!.defeatedBosses).toEqual([...data.defeatedBosses]);
    expect(saved!.timeStep).toBe(data.timeStep);
    expect(start).not.toHaveBeenCalled();
    expect(harness.sceneTransitions.startWithFade).toHaveBeenCalledTimes(1);

    completeFade();

    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith("BootScene");
  });
});

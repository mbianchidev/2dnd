// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({
  Scene: class {
    constructor(_config?: unknown) {}
  },
}));

import {
  BOSS_CUTSCENES,
  getCutsceneDefinition,
  type CutsceneDefinition,
} from "../src/data/cutscenes";
import { CutsceneScene, type CutsceneSceneData } from "../src/scenes/Cutscene";
import { createCodex } from "../src/systems/codex";
import { createPlayer } from "../src/systems/player";
import { deleteSave } from "../src/systems/save";
import { createWeatherState } from "../src/systems/weather";

interface TransitionHarness {
  isPending: boolean;
  startWithFade(
    callback: () => void,
    options: { label?: string },
  ): boolean;
}

interface CutsceneHarness {
  director: { definition: CutsceneDefinition };
  sceneTransitions: TransitionHarness;
  finishCutscene(): void;
  scene: { start(sceneKey: string, data?: unknown): void };
}

function createSceneData(
  cutsceneId: CutsceneSceneData["cutsceneId"],
  replay = false,
): CutsceneSceneData {
  return {
    player: createPlayer("SceneHero", {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    }),
    defeatedBosses: new Set(),
    codex: createCodex(),
    timeStep: 120,
    weatherState: createWeatherState(),
    savedSpecialNpcs: [],
    cutsceneId,
    replay,
  };
}

describe("CutsceneScene transition contracts", () => {
  beforeEach(() => {
    deleteSave();
  });

  it("starts the chosen boss fight after a skipped pre-boss scene", () => {
    const cutsceneId = BOSS_CUTSCENES.dragon.pre;
    const data = createSceneData(cutsceneId);
    data.player.progression.pendingCutsceneIds.push(cutsceneId);
    const cutscene = new CutsceneScene();
    cutscene.init(data);
    const harness = cutscene as unknown as CutsceneHarness;
    const start = vi.fn();
    let completeFade: (() => void) | undefined;
    Object.assign(harness, {
      director: { definition: getCutsceneDefinition(cutsceneId) },
      sceneTransitions: {
        isPending: false,
        startWithFade: vi.fn((callback: () => void) => {
          completeFade = callback;
          return true;
        }),
      },
    });
    Object.defineProperty(cutscene, "scene", {
      configurable: true,
      value: { start },
    });

    harness.finishCutscene();

    expect(data.player.progression.pendingCutsceneIds).toEqual([]);
    expect(data.player.progression.seenCutsceneIds).toContain(cutsceneId);
    completeFade?.();
    expect(start).toHaveBeenCalledWith(
      "BattleScene",
      expect.objectContaining({
        player: data.player,
        defeatedBosses: data.defeatedBosses,
        codex: data.codex,
        encounter: expect.objectContaining({
          members: [
            expect.objectContaining({
              monster: expect.objectContaining({ id: "dragon" }),
            }),
          ],
        }),
      }),
    );
  });

  it("returns from Chronicle replay without mutating progression", () => {
    const cutsceneId = "campaign.opening";
    const data = createSceneData(cutsceneId, true);
    data.player.progression.seenCutsceneIds.push(cutsceneId);
    const before = JSON.stringify(data.player.progression);
    const cutscene = new CutsceneScene();
    cutscene.init(data);
    const harness = cutscene as unknown as CutsceneHarness;
    const start = vi.fn();
    let completeFade: (() => void) | undefined;
    Object.assign(harness, {
      director: { definition: getCutsceneDefinition(cutsceneId) },
      sceneTransitions: {
        isPending: false,
        startWithFade: vi.fn((callback: () => void) => {
          completeFade = callback;
          return true;
        }),
      },
    });
    Object.defineProperty(cutscene, "scene", {
      configurable: true,
      value: { start },
    });

    harness.finishCutscene();
    completeFade?.();

    expect(JSON.stringify(data.player.progression)).toBe(before);
    expect(start).toHaveBeenCalledWith(
      "OverworldScene",
      expect.objectContaining({ player: data.player }),
    );
  });
});

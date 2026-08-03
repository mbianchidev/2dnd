import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({
  Scene: class {
    constructor(_config?: unknown) {}
  },
}));

import { CAMPAIGN_EPILOGUE_CUTSCENE_ID } from "../src/data/cutscenes";
import type { SavedSpecialNpc } from "../src/data/npcs";
import {
  OverworldScene,
  type OverworldSceneData,
} from "../src/scenes/Overworld";
import { createCodex, type CodexData } from "../src/systems/codex";
import { createPlayer, type PlayerState } from "../src/systems/player";
import { setQuestState } from "../src/systems/questDebug";
import { MAIN_QUEST_ID } from "../src/data/quests";
import {
  createWeatherState,
  WeatherType,
  type WeatherState,
} from "../src/systems/weather";

interface TransitionManagerHarness {
  isPending: boolean;
  startWithFade(
    startScene: () => void,
    options: { duration?: number; label?: string },
  ): boolean;
}

interface OverworldTransitionHarness {
  player: PlayerState;
  defeatedBosses: Set<string>;
  codex: CodexData;
  timeStep: number;
  weatherState: WeatherState;
  specialNpcManager: { snapshotSpecialNpcs(): SavedSpecialNpc[] };
  dialogueSystem: { dismissDialogue(): void };
  overlayManager: { destroyAll(): void };
  partyOverlayManager: { close(): void };
  questJournal: { close(): void };
  sceneTransitions: TransitionManagerHarness;
  autoSave(): void;
  handleAction(): void;
  startCampaignEpilogue(replay?: boolean): boolean;
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

describe("OverworldScene transition contracts", () => {
  it("resets omitted shared state when a reused scene starts a new campaign", () => {
    const overworld = new OverworldScene();
    const firstPlayer = createTestPlayer("FirstHero");
    const firstWeather = createWeatherState();
    firstWeather.current = WeatherType.Storm;
    const firstData: OverworldSceneData = {
      player: firstPlayer,
      defeatedBosses: new Set(["infernoForgemaster"]),
      codex: {
        entries: {
          slime: {
            monsterId: "slime",
            name: "Slime",
            color: 0x44cc44,
            isBoss: false,
            timesDefeated: 1,
            acDiscovered: false,
            ac: 8,
            hp: 6,
            xpReward: 10,
            goldReward: 5,
            itemsDropped: [],
            discoveredElements: [],
          },
        },
      },
      timeStep: 300,
      weatherState: firstWeather,
    };
    overworld.init(firstData);

    const secondPlayer = createTestPlayer("SecondHero");
    overworld.init({ player: secondPlayer });

    const harness = overworld as unknown as OverworldTransitionHarness;
    expect(harness.player).toBe(secondPlayer);
    expect(harness.defeatedBosses).toEqual(new Set());
    expect(harness.codex).toEqual(createCodex());
    expect(harness.timeStep).toBe(0);
    expect(harness.weatherState).toEqual(createWeatherState());
  });

  it("launches an eligible unseen epilogue once with the full shared payload", () => {
    const overworld = new OverworldScene();
    const harness = overworld as unknown as OverworldTransitionHarness;
    const player = createTestPlayer("Roadwarden");
    setQuestState(player, MAIN_QUEST_ID, "completed");
    const defeatedBosses = new Set([
      "cryptLich",
      "frostWarden",
      "infernoForgemaster",
    ]);
    const codex = createCodex();
    const weatherState = createWeatherState();
    const savedSpecialNpcs: SavedSpecialNpc[] = [{
      kind: "hermit",
      x: 4,
      y: 6,
      interactions: 1,
    }];
    const start = vi.fn();
    let fadeComplete: (() => void) | undefined;
    const transitionManager: TransitionManagerHarness = {
      isPending: false,
      startWithFade: vi.fn(),
    };
    const startWithFade = vi.fn((callback: () => void, options: {
      duration?: number;
      label?: string;
    }) => {
      expect(options).toEqual({
        duration: 500,
        label: "campaign epilogue",
      });
      fadeComplete = callback;
      transitionManager.isPending = true;
      return true;
    });
    transitionManager.startWithFade = startWithFade;
    const dismissDialogue = vi.fn();
    const destroyAll = vi.fn();
    const closeParty = vi.fn();
    const closeJournal = vi.fn();
    const autoSave = vi.fn();
    Object.assign(harness, {
      player,
      defeatedBosses,
      codex,
      timeStep: 211,
      weatherState,
      specialNpcManager: {
        snapshotSpecialNpcs: () => savedSpecialNpcs,
      },
      dialogueSystem: { dismissDialogue },
      overlayManager: { destroyAll },
      partyOverlayManager: { close: closeParty },
      questJournal: { close: closeJournal },
      sceneTransitions: transitionManager,
      autoSave,
    });
    Object.defineProperty(overworld, "scene", {
      configurable: true,
      value: { start },
    });

    expect(harness.startCampaignEpilogue()).toBe(true);
    expect(harness.startCampaignEpilogue()).toBe(false);
    expect(startWithFade).toHaveBeenCalledTimes(1);
    expect(dismissDialogue).toHaveBeenCalledTimes(1);
    expect(destroyAll).toHaveBeenCalledTimes(1);
    expect(closeParty).toHaveBeenCalledTimes(1);
    expect(closeJournal).toHaveBeenCalledTimes(1);
    expect(autoSave).toHaveBeenCalledTimes(1);
    expect(start).not.toHaveBeenCalled();

    fadeComplete?.();

    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith("EndingScene", {
      player,
      defeatedBosses,
      codex,
      timeStep: 211,
      weatherState,
      savedSpecialNpcs,
      cutsceneId: CAMPAIGN_EPILOGUE_CUTSCENE_ID,
    });
  });

  it("blocks dungeon actions while a scene handoff is pending", () => {
    const overworld = new OverworldScene();
    const harness = overworld as unknown as OverworldTransitionHarness & {
      dungeonTrapManager: { handleAction(player: PlayerState): boolean };
    };
    const player = createTestPlayer("BlockedHero");
    player.position.inDungeon = true;
    player.position.dungeonId = "heartlands_dungeon";
    const handleDungeonAction = vi.fn(() => true);
    Object.assign(harness, {
      player,
      sceneTransitions: {
        isPending: true,
        startWithFade: vi.fn(),
      },
      partyOverlayManager: {
        isOpen: () => false,
        close: vi.fn(),
      },
      dialogueSystem: {
        advanceDialogue: () => false,
        isDialogueOpen: () => false,
        dismissDialogue: vi.fn(),
      },
      questJournal: {
        isOpen: () => false,
        close: vi.fn(),
      },
      dungeonTrapManager: {
        handleAction: handleDungeonAction,
      },
    });

    harness.handleAction();

    expect(handleDungeonAction).not.toHaveBeenCalled();
  });
});

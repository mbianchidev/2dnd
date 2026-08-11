import * as Phaser from "phaser";
import { debugPanelState, GAME_HEIGHT, GAME_WIDTH } from "../config";
import {
  CAMPAIGN_EPILOGUE_CUTSCENE_ID,
  getCutsceneDefinition,
  isCutsceneId,
  type CutsceneId,
} from "../data/cutscenes";
import { createSoloEncounter } from "../data/monsterGroups";
import { getMonster } from "../data/monsters";
import { CutsceneDirector, type CutscenePresentationAdapter } from "../managers/cutscene";
import { SceneTransitionManager } from "../managers/sceneTransition";
import { CutsceneRenderer } from "../renderers/cutscene";
import {
  gamePreferences,
  installSceneAccessibility,
} from "../systems/accessibility";
import {
  completeCutscene,
  getNextPendingCutscene,
} from "../systems/cutscenes";
import { createActivePartyCombatants } from "../systems/party";
import { saveGame } from "../systems/save";
import {
  createSharedSceneState,
  type SharedSceneState,
} from "../systems/sceneState";
import type { QuestUpdate } from "../systems/quests";
import { unlockCodexFromSignal } from "../systems/codex";
import type { HeroVisualDescriptor } from "../systems/heroVisuals";

const INPUT_GRACE_MS = 300;

export interface CutsceneSceneData extends SharedSceneState {
  cutsceneId: CutsceneId;
  replay?: boolean;
  questUpdates?: QuestUpdate[];
  debugHeroVisual?: HeroVisualDescriptor;
}

interface CutsceneKeys {
  SPACE: Phaser.Input.Keyboard.Key;
  ENTER: Phaser.Input.Keyboard.Key;
  ESC: Phaser.Input.Keyboard.Key;
}

export class CutsceneScene extends Phaser.Scene {
  private readonly sceneTransitions = new SceneTransitionManager(this);
  private sceneData!: CutsceneSceneData;
  private director!: CutsceneDirector;
  private cutsceneRenderer!: CutsceneRenderer;
  private keys!: CutsceneKeys;
  private inputReadyAt = 0;
  private automaticAdvance: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super({ key: "CutsceneScene" });
  }

  init(data: CutsceneSceneData): void {
    if (
      !data?.player
      || !data.defeatedBosses
      || !data.codex
      || !data.weatherState
      || !isCutsceneId(data.cutsceneId)
    ) {
      throw new Error("[cutscene] Missing or invalid persistent scene state.");
    }
    this.sceneData = {
      ...createSharedSceneState({
        ...data,
        savedSpecialNpcs: data.savedSpecialNpcs ?? [],
      }),
      cutsceneId: data.cutsceneId,
      replay: data.replay === true,
      questUpdates: data.questUpdates,
      debugHeroVisual: data.debugHeroVisual,
    };
    this.inputReadyAt = 0;
    this.automaticAdvance = null;
  }

  create(): void {
    this.sceneTransitions.prepare(350);
    installSceneAccessibility(this);
    this.cutsceneRenderer = new CutsceneRenderer(
      this,
      this.sceneData.player,
      this.sceneData.debugHeroVisual,
    );
    const presentation: CutscenePresentationAdapter = {
      present: (step, index, onReady) => {
        this.cutsceneRenderer.present(step, index, () => {
          onReady();
          this.onStepReady();
          this.updateDebugPanel();
        });
      },
      reset: () => this.cutsceneRenderer.reset(),
      cleanup: () => this.cutsceneRenderer.cleanup(),
    };
    const definition = getCutsceneDefinition(this.sceneData.cutsceneId);
    this.director = new CutsceneDirector(
      definition,
      () => this.finishCutscene(),
      presentation,
    );
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error("[cutscene] Keyboard input is unavailable.");
    }
    this.keys = keyboard.addKeys({
      SPACE: Phaser.Input.Keyboard.KeyCodes.SPACE,
      ENTER: Phaser.Input.Keyboard.KeyCodes.ENTER,
      ESC: Phaser.Input.Keyboard.KeyCodes.ESC,
    }) as CutsceneKeys;
    this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0xffffff,
      0,
    ).setInteractive().setDepth(110).on("pointerdown", () => this.tryAdvance());
    this.inputReadyAt = this.time.now + INPUT_GRACE_MS;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.clearAutomaticAdvance();
      this.director.destroy();
    });
    this.updateDebugPanel();
  }

  update(time: number): void {
    this.updateDebugPanel();
    if (
      time < this.inputReadyAt
      || this.sceneTransitions.isPending
    ) {
      return;
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
      this.clearAutomaticAdvance();
      this.director.skip();
    } else if (!this.director.inputLocked && (
      Phaser.Input.Keyboard.JustDown(this.keys.SPACE)
      || Phaser.Input.Keyboard.JustDown(this.keys.ENTER)
    )) {
      this.tryAdvance();
    }
  }

  private tryAdvance(): void {
    if (
      this.time.now < this.inputReadyAt
      || this.director.inputLocked
      || this.sceneTransitions.isPending
    ) {
      return;
    }
    this.clearAutomaticAdvance();
    this.director.advance();
    this.inputReadyAt = this.time.now + 100;
    this.updateDebugPanel();
  }

  private onStepReady(): void {
    this.inputReadyAt = Math.max(this.inputReadyAt, this.time.now + 100);
    if (gamePreferences.getAccessibility().advanceMode !== "automatic") {
      return;
    }
    const step = this.director.currentStep;
    const contentLength = step.type === "credits"
      ? step.lines.join(" ").length
      : step.type === "summary"
        ? step.heading.length
        : step.text.length;
    const delay = Phaser.Math.Clamp(1900 + contentLength * 32, 2500, 7200);
    this.automaticAdvance = this.time.delayedCall(delay, () => {
      this.automaticAdvance = null;
      this.tryAdvance();
    });
  }

  private clearAutomaticAdvance(): void {
    this.automaticAdvance?.remove(false);
    this.automaticAdvance = null;
  }

  private finishCutscene(): void {
    this.clearAutomaticAdvance();
    const definition = this.director.definition;
    if (!this.sceneData.replay) {
      completeCutscene(
        this.sceneData.player.progression,
        this.sceneData.cutsceneId,
      );
      const unlock = unlockCodexFromSignal(this.sceneData.codex, {
        type: "cutscene",
        cutsceneId: this.sceneData.cutsceneId,
      });
      this.sceneData.codexDiscoveryIds = [
        ...new Set([
          ...(this.sceneData.codexDiscoveryIds ?? []),
          ...unlock.unlockedIds,
        ]),
      ];
      this.save();
    }

    if (this.sceneData.replay) {
      this.returnToOverworld();
      return;
    }
    if (definition.completion?.type === "bossBattle") {
      this.startBossBattle(
        definition.completion.bossId,
        definition.completion.biome,
      );
      return;
    }
    const nextCutsceneId = getNextPendingCutscene(
      this.sceneData.player.progression,
    );
    if (nextCutsceneId) {
      this.startQueuedCutscene(nextCutsceneId);
    } else {
      this.returnToOverworld();
    }
  }

  private startBossBattle(bossId: string, biome: string): void {
    if (this.sceneData.defeatedBosses.has(bossId)) {
      this.returnToOverworld();
      return;
    }
    const boss = getMonster(bossId);
    if (!boss?.isBoss) {
      throw new Error(`[cutscene] Missing boss definition: ${bossId}`);
    }
    this.sceneTransitions.startWithFade(
      () => this.scene.start("BattleScene", {
        ...createSharedSceneState(this.sceneData),
        encounter: createSoloEncounter(boss),
        biome,
        partyCombatants: createActivePartyCombatants(this.sceneData.player.party),
      }),
      { label: `cutscene boss battle ${bossId}` },
    );
  }

  private startQueuedCutscene(cutsceneId: CutsceneId): void {
    if (cutsceneId === CAMPAIGN_EPILOGUE_CUTSCENE_ID) {
      this.sceneTransitions.startWithFade(
        () => this.scene.start("EndingScene", {
          ...createSharedSceneState(this.sceneData),
          cutsceneId,
          replay: false,
          questUpdates: this.sceneData.questUpdates,
        }),
        { label: "campaign epilogue" },
      );
      return;
    }
    this.sceneTransitions.startWithFade(
      () => this.scene.restart({
        ...createSharedSceneState(this.sceneData),
        cutsceneId,
        replay: false,
        questUpdates: this.sceneData.questUpdates,
      }),
      { label: `queued cutscene ${cutsceneId}` },
    );
  }

  private returnToOverworld(): void {
    this.sceneTransitions.startWithFade(
      () => this.scene.start(
        "OverworldScene",
        {
          ...createSharedSceneState(this.sceneData),
          questUpdates: this.sceneData.questUpdates,
        },
      ),
      { label: "cutscene return to overworld" },
    );
  }

  private save(): void {
    saveGame(
      this.sceneData.player,
      this.sceneData.defeatedBosses,
      this.sceneData.codex,
      this.sceneData.player.appearanceId,
      this.sceneData.timeStep,
      this.sceneData.weatherState,
    );
  }

  private updateDebugPanel(): void {
    if (!this.director) {
      return;
    }
    debugPanelState(
      `CUTSCENE | ${this.sceneData.cutsceneId} | Step ${this.director.currentStepIndex + 1}/${this.director.definition.steps.length} | ${this.sceneData.replay ? "Replay" : "Story"}`
      + ` | Anim: ${this.cutsceneRenderer.debugState}`
      + ` | Hero: ${this.cutsceneRenderer.heroInspectionReport}`,
    );
  }
}

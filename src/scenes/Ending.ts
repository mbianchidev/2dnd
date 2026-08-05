import * as Phaser from "phaser";
import {
  CAMPAIGN_EPILOGUE_CUTSCENE_ID,
  getCutsceneDefinition,
  isCutsceneId,
  type CutsceneId,
} from "../data/cutscenes";
import { CutsceneDirector } from "../managers/cutscene";
import { SceneTransitionManager } from "../managers/sceneTransition";
import { ResultRenderer } from "../renderers/result";
import { audioEngine } from "../systems/audio";
import { installSceneAccessibility } from "../systems/accessibility";
import {
  buildCampaignEndingSummary,
  completeCutscene,
} from "../systems/cutscenes";
import { saveGame } from "../systems/save";
import { debugPanelState } from "../config";
import {
  createSharedSceneState,
  type SharedSceneState,
} from "../systems/sceneState";
import { unlockCodexFromSignal } from "../systems/codex";

const INPUT_GRACE_MS = 350;

export interface EndingSceneData extends SharedSceneState {
  cutsceneId?: CutsceneId;
  replay?: boolean;
}

interface EndingKeys {
  SPACE: Phaser.Input.Keyboard.Key;
  ENTER: Phaser.Input.Keyboard.Key;
  ESC: Phaser.Input.Keyboard.Key;
  UP: Phaser.Input.Keyboard.Key;
  DOWN: Phaser.Input.Keyboard.Key;
  W: Phaser.Input.Keyboard.Key;
  S: Phaser.Input.Keyboard.Key;
}

export class EndingScene extends Phaser.Scene {
  private readonly sceneTransitions = new SceneTransitionManager(this);
  private sceneData!: EndingSceneData;
  private director!: CutsceneDirector;
  private endingRenderer!: ResultRenderer;
  private keys!: EndingKeys;
  private inputReadyAt = 0;
  private showingChoices = false;
  private selectedChoice = 0;

  constructor() {
    super({ key: "EndingScene" });
  }

  init(data: EndingSceneData): void {
    if (!data?.player || !data.defeatedBosses || !data.codex || !data.weatherState) {
      throw new Error("[ending] Missing required persistent scene state");
    }
    const cutsceneId = data.cutsceneId ?? CAMPAIGN_EPILOGUE_CUTSCENE_ID;
    if (!isCutsceneId(cutsceneId)) {
      throw new Error(`[ending] Unknown cutscene ID: ${String(cutsceneId)}`);
    }
    this.sceneData = {
      ...data,
      savedSpecialNpcs: data.savedSpecialNpcs ?? [],
      cutsceneId,
    };
    this.inputReadyAt = 0;
    this.showingChoices = false;
    this.selectedChoice = 0;
  }

  create(): void {
    this.sceneTransitions.prepare(500);
    installSceneAccessibility(this);
    this.endingRenderer = new ResultRenderer(this);
    const summary = buildCampaignEndingSummary(
      this.sceneData.player,
      this.sceneData.defeatedBosses,
      this.sceneData.codex,
    );
    const definition = getCutsceneDefinition(this.sceneData.cutsceneId!);
    this.director = new CutsceneDirector(
      definition,
      () => this.completeCutscene(),
    );
    this.keys = this.input.keyboard!.addKeys({
      SPACE: Phaser.Input.Keyboard.KeyCodes.SPACE,
      ENTER: Phaser.Input.Keyboard.KeyCodes.ENTER,
      ESC: Phaser.Input.Keyboard.KeyCodes.ESC,
      UP: Phaser.Input.Keyboard.KeyCodes.UP,
      DOWN: Phaser.Input.Keyboard.KeyCodes.DOWN,
      W: Phaser.Input.Keyboard.KeyCodes.W,
      S: Phaser.Input.Keyboard.KeyCodes.S,
    }) as EndingKeys;
    this.endingRenderer.createAdvanceZone().on("pointerdown", () => {
      if (this.time.now >= this.inputReadyAt) this.advanceCutscene(summary);
    });
    this.inputReadyAt = this.time.now + INPUT_GRACE_MS;
    this.endingRenderer.renderStep(this.director.currentStep, summary);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.director.destroy();
      this.endingRenderer.destroy();
    });
    this.updateDebugPanel();
    audioEngine.playEndingMusic();
  }

  update(time: number): void {
    if (time < this.inputReadyAt || this.sceneTransitions.isPending) return;

    if (this.showingChoices) {
      this.handleChoiceInput();
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
      this.director.skip();
      return;
    }
    if (
      Phaser.Input.Keyboard.JustDown(this.keys.SPACE)
      || Phaser.Input.Keyboard.JustDown(this.keys.ENTER)
    ) {
      const summary = buildCampaignEndingSummary(
        this.sceneData.player,
        this.sceneData.defeatedBosses,
        this.sceneData.codex,
      );
      this.advanceCutscene(summary);
    }
  }

  private advanceCutscene(
    summary: ReturnType<typeof buildCampaignEndingSummary>,
  ): void {
    if (this.showingChoices || this.director.completed) return;
    const completed = this.director.advance();
    if (!completed) {
      this.endingRenderer.renderStep(this.director.currentStep, summary);
      this.updateDebugPanel();
    }
  }

  private completeCutscene(): void {
    if (!this.sceneData.replay) {
      completeCutscene(
        this.sceneData.player.progression,
        this.sceneData.cutsceneId!,
      );
      const unlock = unlockCodexFromSignal(this.sceneData.codex, {
        type: "cutscene",
        cutsceneId: this.sceneData.cutsceneId!,
      });
      this.sceneData.codexDiscoveryIds = [
        ...new Set([
          ...(this.sceneData.codexDiscoveryIds ?? []),
          ...unlock.unlockedIds,
        ]),
      ];
      this.save();
    }
    this.showingChoices = true;
    this.selectedChoice = 0;
    debugPanelState("ENDING | Choices");
    this.endingRenderer.showChoices({
      continuePostGame: () => this.continuePostGame(),
      replay: () => this.replayCutscene(),
      returnToTitle: () => this.returnToTitle(),
      select: (index) => {
        this.selectedChoice = index;
        this.endingRenderer.setChoiceSelection(index);
      },
    });
  }

  private handleChoiceInput(): void {
    const moveUp = Phaser.Input.Keyboard.JustDown(this.keys.UP)
      || Phaser.Input.Keyboard.JustDown(this.keys.W);
    const moveDown = Phaser.Input.Keyboard.JustDown(this.keys.DOWN)
      || Phaser.Input.Keyboard.JustDown(this.keys.S);
    if (moveUp || moveDown) {
      const direction = moveUp ? -1 : 1;
      this.selectedChoice = (
        this.selectedChoice + direction + 3
      ) % 3;
      this.endingRenderer.setChoiceSelection(this.selectedChoice);
      return;
    }
    if (
      Phaser.Input.Keyboard.JustDown(this.keys.SPACE)
      || Phaser.Input.Keyboard.JustDown(this.keys.ENTER)
    ) {
      if (this.selectedChoice === 0) this.continuePostGame();
      else if (this.selectedChoice === 1) this.replayCutscene();
      else this.returnToTitle();
    }
  }

  private replayCutscene(): void {
    if (this.sceneTransitions.isPending) return;
    this.showingChoices = false;
    this.selectedChoice = 0;
    this.director.reset();
    this.inputReadyAt = this.time.now + INPUT_GRACE_MS;
    this.endingRenderer.renderStep(
      this.director.currentStep,
      buildCampaignEndingSummary(
        this.sceneData.player,
        this.sceneData.defeatedBosses,
        this.sceneData.codex,
      ),
    );
    this.updateDebugPanel();
  }

  private updateDebugPanel(): void {
    const step = this.director.currentStep;
    debugPanelState(
      `ENDING | Step: ${this.director.currentStepIndex + 1}/${this.director.definition.steps.length} | Type: ${step.type}`,
    );
  }

  private continuePostGame(): void {
    if (this.sceneTransitions.isPending) return;
    this.sceneTransitions.startWithFade(() => {
      this.scene.start(
        "OverworldScene",
        createSharedSceneState(this.sceneData),
      );
    }, {
      duration: 500,
      label: "ending to post-game",
    });
  }

  private returnToTitle(): void {
    if (this.sceneTransitions.isPending) return;
    this.save();
    this.sceneTransitions.startWithFade(() => {
      audioEngine.playTitleMusic();
      this.scene.start("BootScene");
    }, {
      duration: 500,
      label: "ending to title",
    });
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
}

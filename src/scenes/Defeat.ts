import * as Phaser from "phaser";
import { debugPanelState, setDebugCommandHandler } from "../config";
import { SceneTransitionManager } from "../managers/sceneTransition";
import {
  ResultRenderer,
  type DefeatResultPresentation,
} from "../renderers/result";
import { audioEngine } from "../systems/audio";
import type { PartyDefeatResult } from "../systems/party";
import {
  createSharedSceneState,
  type SharedSceneState,
} from "../systems/sceneState";
import { WeatherType } from "../systems/weather";

const INPUT_GRACE_MS = 350;

export interface DefeatSceneData extends SharedSceneState {
  encounterName: string;
  encounterType: "boss" | "random";
  defeatResult: PartyDefeatResult;
}

interface DefeatKeys {
  SPACE: Phaser.Input.Keyboard.Key;
  ENTER: Phaser.Input.Keyboard.Key;
}

export class DefeatScene extends Phaser.Scene {
  private readonly sceneTransitions = new SceneTransitionManager(this);
  private sceneData!: DefeatSceneData;
  private resultRenderer!: ResultRenderer;
  private keys!: DefeatKeys;
  private inputReadyAt = 0;
  private showingSummary = false;

  constructor() {
    super({ key: "DefeatScene" });
  }

  init(data: DefeatSceneData): void {
    if (
      !data?.player
      || !data.defeatedBosses
      || !data.codex
      || !data.weatherState
      || !data.defeatResult
    ) {
      throw new Error("[defeat] Missing required defeat scene state");
    }
    if (data.encounterType !== "boss" && data.encounterType !== "random") {
      throw new Error(
        `[defeat] Unknown encounter type: ${String(data.encounterType)}`,
      );
    }
    this.sceneData = {
      ...data,
      savedSpecialNpcs: data.savedSpecialNpcs ?? [],
    };
    this.inputReadyAt = 0;
    this.showingSummary = false;
  }

  create(): void {
    this.sceneTransitions.prepare(500, 24, 0, 8);
    setDebugCommandHandler(null);
    this.resultRenderer = new ResultRenderer(this, "defeat");
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error("[defeat] Keyboard input is unavailable");
    }
    this.keys = keyboard.addKeys({
      SPACE: Phaser.Input.Keyboard.KeyCodes.SPACE,
      ENTER: Phaser.Input.Keyboard.KeyCodes.ENTER,
    }) as DefeatKeys;
    this.resultRenderer.createAdvanceZone().on("pointerdown", () => {
      if (this.time.now >= this.inputReadyAt) this.advance();
    });
    this.resultRenderer.renderDefeatIntro(this.presentation);
    this.inputReadyAt = this.time.now + INPUT_GRACE_MS;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.resultRenderer.destroy();
    });
    debugPanelState(
      `DEFEAT | Intro | ${this.encounterTypeLabel}: ${this.sceneData.encounterName}`,
    );
    audioEngine.playWeatherSFX(WeatherType.Clear);
    audioEngine.playDefeatMusic();
  }

  update(time: number): void {
    if (time < this.inputReadyAt || this.sceneTransitions.isPending) return;
    if (
      Phaser.Input.Keyboard.JustDown(this.keys.SPACE)
      || Phaser.Input.Keyboard.JustDown(this.keys.ENTER)
    ) {
      this.advance();
    }
  }

  private get presentation(): DefeatResultPresentation {
    return {
      encounterName: this.sceneData.encounterName,
      encounterType: this.sceneData.encounterType,
      result: this.sceneData.defeatResult,
    };
  }

  private get encounterTypeLabel(): string {
    return this.sceneData.encounterType === "boss" ? "Boss" : "Random";
  }

  private advance(): void {
    if (!this.showingSummary) {
      this.showingSummary = true;
      this.inputReadyAt = this.time.now + INPUT_GRACE_MS;
      this.resultRenderer.renderDefeatSummary(
        this.presentation,
        () => this.continueRecovery(),
      );
      debugPanelState(
        `DEFEAT | Results | ${this.encounterTypeLabel}`
          + ` | Gold -${this.sceneData.defeatResult.goldLost}`
          + ` | Recovery ${this.sceneData.defeatResult.recoveryLocation.name}`,
      );
      return;
    }
    this.continueRecovery();
  }

  private continueRecovery(): void {
    if (this.sceneTransitions.isPending) return;
    debugPanelState("DEFEAT | Continuing");
    this.sceneTransitions.startWithFade(() => {
      this.scene.start(
        "OverworldScene",
        createSharedSceneState(this.sceneData),
      );
    }, {
      duration: 500,
      red: 24,
      green: 0,
      blue: 8,
      label: "defeat recovery",
    });
  }
}

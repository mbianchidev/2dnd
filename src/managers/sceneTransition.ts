import * as Phaser from "phaser";
import { debugLog } from "../config";

const DEFAULT_FADE_DURATION = 300;
const WATCHDOG_GRACE_MS = 250;

export interface SceneFadeOptions {
  duration?: number;
  red?: number;
  green?: number;
  blue?: number;
  label?: string;
}

interface CameraWait {
  event: string;
  handler: () => void;
  watchdog: Phaser.Time.TimerEvent;
  id: number;
}

export class SceneTransitionManager {
  private pending = false;
  private scheduledTimer: Phaser.Time.TimerEvent | null = null;
  private cameraWait: CameraWait | null = null;
  private cameraWaitId = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  get isPending(): boolean {
    return this.pending;
  }

  prepare(
    fadeInDuration = 0,
    red = 0,
    green = 0,
    blue = 0,
  ): void {
    this.cancelScheduledTimer();
    this.cancelCameraWait();
    this.pending = false;
    this.restoreCamera();

    if (fadeInDuration <= 0) return;

    this.waitForCameraEffect(
      Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE,
      fadeInDuration,
      "scene fade-in",
      () => this.restoreCamera(),
    );
    this.scene.cameras.main.fadeIn(
      fadeInDuration,
      red,
      green,
      blue,
    );
  }

  startWithFade(
    startScene: () => void,
    options: SceneFadeOptions = {},
  ): boolean {
    const label = options.label ?? "scene handoff";
    if (!this.beginTransition(label)) return false;

    const duration = options.duration ?? DEFAULT_FADE_DURATION;
    const red = options.red ?? 0;
    const green = options.green ?? 0;
    const blue = options.blue ?? 0;

    this.waitForCameraEffect(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      duration,
      label,
      () => this.completeSceneHandoff(startScene),
    );
    this.scene.cameras.main.fadeOut(duration, red, green, blue);
    return true;
  }

  startImmediately(startScene: () => void, label = "scene handoff"): boolean {
    if (!this.beginTransition(label)) return false;
    this.completeSceneHandoff(startScene);
    return true;
  }

  startAfter(
    delay: number,
    startScene: () => void,
    label = "delayed scene handoff",
  ): boolean {
    if (!this.beginTransition(label)) return false;

    this.scheduledTimer = this.scene.time.delayedCall(delay, () => {
      this.scheduledTimer = null;
      if (!this.pending) return;
      this.completeSceneHandoff(startScene);
    });
    return true;
  }

  fadeOutAndIn(
    atBlack: () => void,
    options: SceneFadeOptions = {},
  ): boolean {
    const label = options.label ?? "same-scene fade";
    if (!this.beginTransition(label)) return false;

    const duration = options.duration ?? DEFAULT_FADE_DURATION;
    const red = options.red ?? 0;
    const green = options.green ?? 0;
    const blue = options.blue ?? 0;

    this.waitForCameraEffect(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      duration,
      `${label} fade-out`,
      () => {
        this.restoreCamera();
        atBlack();
        this.waitForCameraEffect(
          Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE,
          duration,
          `${label} fade-in`,
          () => {
            this.restoreCamera();
            this.pending = false;
          },
        );
        this.scene.cameras.main.fadeIn(duration, red, green, blue);
      },
    );
    this.scene.cameras.main.fadeOut(duration, red, green, blue);
    return true;
  }

  private beginTransition(label: string): boolean {
    if (this.pending) {
      debugLog(
        `[SCENE] Ignored duplicate transition in ${this.scene.sys.settings.key}: ${label}`,
      );
      return false;
    }

    this.cancelScheduledTimer();
    this.cancelCameraWait();
    this.pending = true;
    this.restoreCamera();
    return true;
  }

  private completeSceneHandoff(startScene: () => void): void {
    this.cancelScheduledTimer();
    this.cancelCameraWait();
    this.restoreCamera();
    startScene();
  }

  private waitForCameraEffect(
    event: string,
    duration: number,
    label: string,
    onComplete: () => void,
  ): void {
    this.cancelCameraWait();
    const id = this.cameraWaitId;
    let settled = false;
    let handler: () => void;

    const finish = (recovered: boolean): void => {
      if (settled || id !== this.cameraWaitId) return;
      settled = true;
      this.clearCameraWait(id);
      if (recovered) {
        debugLog(
          `[SCENE] Recovered stalled camera effect in ${this.scene.sys.settings.key}: ${label}`,
        );
      }
      onComplete();
    };

    handler = () => finish(false);
    this.scene.cameras.main.once(event, handler);
    const watchdog = this.scene.time.delayedCall(
      Math.max(0, duration) + WATCHDOG_GRACE_MS,
      () => finish(true),
    );
    this.cameraWait = { event, handler, watchdog, id };
  }

  private clearCameraWait(id: number): void {
    const wait = this.cameraWait;
    if (!wait || wait.id !== id) return;

    this.scene.cameras.main.off(wait.event, wait.handler);
    wait.watchdog.remove(false);
    this.cameraWait = null;
  }

  private cancelCameraWait(): void {
    this.cameraWaitId += 1;
    const wait = this.cameraWait;
    if (!wait) return;

    this.scene.cameras.main.off(wait.event, wait.handler);
    wait.watchdog.remove(false);
    this.cameraWait = null;
  }

  private cancelScheduledTimer(): void {
    this.scheduledTimer?.remove(false);
    this.scheduledTimer = null;
  }

  private restoreCamera(): void {
    this.scene.cameras.main.resetFX();
    this.scene.cameras.main.setVisible(true);
    this.scene.cameras.main.setAlpha(1);
  }
}

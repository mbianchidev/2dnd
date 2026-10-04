import * as Phaser from "phaser";
import type { BattleTimingSettings } from "../data/battleTiming";
import {
  BattleDecisionClock,
  type BattleTimedDecision,
  type BattleTimingPauseReason,
} from "../systems/battleTiming";
import { inputAvailability } from "../systems/input";
import { BATTLE_DEPTH } from "../renderers/battleDepth";
import { createOverlayContainer, setOverlayViewport } from "../utils/ui";
import { layoutTextStack, syncInteractiveHitArea } from "./layout";

interface BattleTimingCallbacks {
  controlledActorId(): string | null;
  acceptsInput(): boolean;
  animationActive(): boolean;
  transitionActive(): boolean;
  timeout(decision: Readonly<BattleTimedDecision>): boolean;
}

const PAUSE_LABELS: Record<BattleTimingPauseReason, string> = {
  input: "input unavailable",
  action: "resolving action",
  animation: "action presentation",
  log: "reading log",
  overlay: "system overlay",
  transition: "scene transition",
  visibility: "page hidden",
  focus: "window unfocused",
  controller: "controller recovery",
  scene: "scene paused",
};

export class BattleTimingManager {
  readonly clock: BattleDecisionClock;
  private readonly container: Phaser.GameObjects.Container;
  private readonly countdown: Phaser.GameObjects.Text;
  private readonly pauseControl: Phaser.GameObjects.Text;
  private readonly timerRegion: HTMLElement;
  private readonly announcement: HTMLElement;
  private readonly unsubscribeInput: () => void;
  private sequence = 0;
  private actorLabel = "";
  private readingLog = false;
  private dispatchedId: string | null = null;
  private destroyed = false;
  private timeoutCount = 0;
  private lastAnnouncement = "";

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly settings: Readonly<BattleTimingSettings>,
    private readonly callbacks: BattleTimingCallbacks,
  ) {
    this.clock = new BattleDecisionClock(settings);
    this.container = createOverlayContainer(scene, "battle-timing", BATTLE_DEPTH.uiOverlay);
    this.countdown = scene.add.text(0, 0, "", {
      fontSize: "10px", fontFamily: "monospace",
      color: "#ffffff", backgroundColor: "#080c16",
      padding: { x: 6, y: 4 }, wordWrap: { width: 266 },
    }).setData("layoutId", "battle-countdown");
    this.pauseControl = scene.add.text(0, 0, "", {
      fontSize: "10px", fontFamily: "monospace",
      color: "#ffffff", backgroundColor: "#253654",
      padding: { x: 6, y: 5 }, wordWrap: { width: 266 },
    }).setData("layoutId", "battle-timing-pause")
      .setInteractive({ useHandCursor: true });
    this.pauseControl.on("pointerdown", () => this.toggleLogPause());
    this.container.add([this.countdown, this.pauseControl]);
    this.timerRegion = this.createScreenReaderRegion("battle-countdown-status", "timer");
    this.timerRegion.setAttribute("aria-live", "off");
    this.announcement = this.createScreenReaderRegion("battle-timing-announcement", "status");
    this.announcement.setAttribute("aria-atomic", "true");
    this.unsubscribeInput = inputAvailability.subscribe(() => {
      this.syncBrowserPauses();
      this.render();
    });
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    this.scene.events.on(Phaser.Scenes.Events.PAUSE, this.handleScenePause);
    this.scene.events.on(Phaser.Scenes.Events.SLEEP, this.handleScenePause);
    this.scene.events.on(Phaser.Scenes.Events.RESUME, this.handleSceneResume);
    this.scene.events.on(Phaser.Scenes.Events.WAKE, this.handleSceneResume);
    this.syncBrowserPauses();
    this.render();
  }

  get debugState(): string {
    const state = this.clock.snapshot;
    return ` [TIMING:${state.status}:${state.decision?.actorId ?? "-"}:`
      + `${Math.ceil(state.decision?.remainingMs ?? 0)}:${state.pauseReasons.join(",")}]`
      + ` [TIMEOUTS:${this.timeoutCount}]`;
  }

  beginTurn(actorId: string, label: string): void {
    if (this.destroyed) return;
    this.actorLabel = label;
    this.dispatchedId = null;
    this.readingLog = false;
    this.clock.setPaused("log", false);
    this.clock.beginTurn(`decision:${++this.sequence}:${actorId}`, actorId);
    this.render();
  }

  endTurn(): void {
    this.clock.endTurn();
    this.dispatchedId = null;
    this.readingLog = false;
    this.clock.setPaused("log", false);
    if (!this.destroyed) this.render();
  }

  update(elapsedMs: number): void {
    if (this.destroyed) return;
    const decision = this.clock.snapshot.decision;
    if (decision && this.callbacks.controlledActorId() !== decision.actorId) {
      this.endTurn();
    }
    this.syncPauses();
    this.clock.advance(elapsedMs);
    const state = this.clock.snapshot;
    if (
      state.status === "expired"
      && state.decision
      && this.dispatchedId !== state.decision.id
    ) {
      this.dispatchedId = state.decision.id;
      if (this.callbacks.timeout(state.decision)) this.timeoutCount++;
      else this.clock.endTurn();
    }
    this.render();
  }

  acceptsInput(): boolean {
    if (this.destroyed) return false;
    this.syncPauses();
    return this.clock.snapshot.status === "active";
  }

  /** Consume the resume confirmation; it must not also execute a selected action. */
  resumeIfPaused(): boolean {
    if (!this.readingLog && !inputAvailability.get().controllerRecovery) return false;
    const availability = inputAvailability.get();
    if (
      availability.pageVisible && availability.windowFocused && !availability.textEntryActive
      && this.callbacks.acceptsInput()
      && !this.callbacks.animationActive()
      && !this.callbacks.transitionActive()
    ) {
      this.readingLog = false;
      this.clock.setPaused("log", false);
      inputAvailability.acknowledgeControllerRecovery();
      this.syncPauses();
      this.render();
    }
    return true;
  }

  toggleLogPause(): void {
    if (this.destroyed || !this.clock.snapshot.decision) return;
    if (this.resumeIfPaused()) return;
    this.readingLog = true;
    this.clock.setPaused("log", true);
    this.render();
  }

  pauseForLogReading(): void {
    if (!this.destroyed && this.clock.snapshot.decision) {
      this.readingLog = true;
      this.clock.setPaused("log", true);
      this.render();
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.clock.destroy();
    this.unsubscribeInput();
    this.scene.events.off(Phaser.Scenes.Events.PAUSE, this.handleScenePause);
    this.scene.events.off(Phaser.Scenes.Events.SLEEP, this.handleScenePause);
    this.scene.events.off(Phaser.Scenes.Events.RESUME, this.handleSceneResume);
    this.scene.events.off(Phaser.Scenes.Events.WAKE, this.handleSceneResume);
    this.container.destroy();
    this.timerRegion.remove();
    this.announcement.remove();
    const canvas = this.scene.game.canvas;
    for (const key of [
      "battleTimingMode", "battleTimingState", "battleTimingActor",
      "battleTimingRemainingMs", "battleTimingTurn", "battleTimingReasons", "battleTimeoutCount",
    ]) {
      delete canvas.dataset[key];
    }
  }

  private syncBrowserPauses(): void {
    const state = inputAvailability.get();
    this.clock.setPaused("visibility", !state.pageVisible);
    this.clock.setPaused("focus", !state.windowFocused);
    this.clock.setPaused("overlay", state.textEntryActive);
    this.clock.setPaused("controller", state.controllerRecovery);
  }

  private readonly handleScenePause = (): void => {
    this.clock.setPaused("scene", true);
    this.render();
  };

  private readonly handleSceneResume = (): void => {
    this.clock.setPaused("scene", false);
    this.render();
  };

  private syncPauses(): void {
    this.syncBrowserPauses();
    this.clock.setPaused("input", !this.callbacks.acceptsInput());
    this.clock.setPaused("animation", this.callbacks.animationActive());
    this.clock.setPaused("transition", this.callbacks.transitionActive());
    this.clock.setPaused("scene", !this.scene.scene.isActive());
  }

  private render(): void {
    if (this.destroyed) return;
    const state = this.clock.snapshot;
    const seconds = Math.ceil((state.decision?.remainingMs ?? 0) / 1_000);
    const reason = state.pauseReasons[0];
    const status = reason
      ? `PAUSED: ${PAUSE_LABELS[reason]}`
      : seconds <= 5 ? "TIME LOW - Defend at 0" : "Timed - Defend at 0";
    const text = state.decision
      ? `${this.actorLabel} | ${seconds}s\n${status}`
      : `Timed battles | ${this.settings.durationSeconds}s\nWaiting for a controlled turn`;
    this.countdown.setText(text);
    const resume = this.readingLog || inputAvailability.get().controllerRecovery;
    this.pauseControl.setText(resume ? "> Resume (Enter / A)" : "Pause / read log (Esc / B)");
    this.pauseControl.setVisible(state.decision !== null);
    const height = layoutTextStack([
      this.countdown,
      ...(state.decision ? [this.pauseControl] : []),
    ], { x: 8, y: 8, width: 282, gap: 5, hitAreaPadding: 2 });
    syncInteractiveHitArea(this.pauseControl, 2);
    setOverlayViewport(this.scene, "battle-timing", { x: 6, y: 6, width: 286, height: height + 4 });
    this.timerRegion.textContent = text;
    const announcement = state.decision
      ? reason ? `${this.actorLabel}: ${status}. Countdown ${seconds} seconds.`
        : seconds <= 5 ? `${this.actorLabel}: ${seconds} seconds. Timeout Defend.`
          : `${this.actorLabel}: ${this.settings.durationSeconds} seconds to decide. Timeout Defend.`
      : "";
    if (announcement !== this.lastAnnouncement) {
      this.lastAnnouncement = announcement;
      this.announcement.textContent = announcement;
    }
    const canvas = this.scene.game.canvas;
    canvas.dataset.battleTimingMode = "timed";
    canvas.dataset.battleTimingState = state.status;
    canvas.dataset.battleTimingActor = state.decision?.actorId ?? "";
    canvas.dataset.battleTimingRemainingMs = String(Math.ceil(state.decision?.remainingMs ?? 0));
    canvas.dataset.battleTimingTurn = state.decision?.id ?? "";
    canvas.dataset.battleTimingReasons = state.pauseReasons.join(",");
    canvas.dataset.battleTimeoutCount = String(this.timeoutCount);
  }

  private createScreenReaderRegion(id: string, role: "timer" | "status"): HTMLElement {
    const region = document.createElement("span");
    region.id = id;
    region.setAttribute("role", role);
    region.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;";
    document.body.appendChild(region);
    return region;
  }
}

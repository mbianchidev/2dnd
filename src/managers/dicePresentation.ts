import type * as Phaser from "phaser";
import { debugPanelLog } from "../config";
import {
  gamePreferences,
  isReducedMotionEnabled,
} from "../systems/accessibility";
import {
  DicePresentationController,
  diceRollHistory,
  createSkillDicePresentation,
  type DicePresentation,
} from "../systems/dicePresentation";
import { inputPromptSource } from "../systems/input";
import { audioEngine } from "../systems/audio";
import { DiceRollRenderer } from "../renderers/dice";
import type { SkillCheckRecord } from "../data/skillChecks";

const scenePresentations = new WeakMap<Phaser.Scene, DicePresentationManager>();

export class DicePresentationManager {
  private readonly controller: DicePresentationController;
  private readonly renderer: DiceRollRenderer;
  private readonly unsubscribePreferences: () => void;
  private readonly unsubscribePrompts: () => void;
  private stopCue: (() => void) | null = null;
  private cleaned = false;

  constructor(
    private readonly scene: Phaser.Scene,
    addLog?: (message: string) => void,
  ) {
    this.renderer = new DiceRollRenderer(() => this.fastForward());
    for (const event of diceRollHistory.entries) this.renderer.record(event);
    const latest = diceRollHistory.entries[diceRollHistory.entries.length - 1];
    if (latest) this.renderer.show({ ...latest, duration: 0 }, gamePreferences.get(), false);
    this.controller = new DicePresentationController({
      record: (event) => {
        diceRollHistory.append(event);
        this.renderer.record(event);
        if (addLog) addLog(event.text);
        debugPanelLog(`[ROLL] ${event.text}`, false, "roll-detail");
      },
      show: (event) => {
        this.renderer.show(event, gamePreferences.get());
        if (event.duration > 0) {
          this.stopCue = audioEngine.playDiceCue(event.presentation.outcome);
        }
      },
      settle: () => this.settle(),
      clear: () => {
        this.settle();
        this.renderer.destroy();
      },
      schedule: (duration, complete) => {
        const timer = this.scene.time.delayedCall(duration, complete);
        return () => timer.remove(false);
      },
    });
    this.renderer.applyPreferences(gamePreferences.get());
    this.unsubscribePreferences = gamePreferences.subscribe((preferences) => {
      this.controller.fastForward();
      this.renderer.applyPreferences(preferences);
    });
    this.unsubscribePrompts = inputPromptSource.subscribe(() => this.renderer.updatePrompt());
    this.scene.input.keyboard?.on("keydown-Z", this.handleFastForward);
    this.scene.events.once("shutdown", this.cleanup, this);
    this.scene.events.once("destroy", this.cleanup, this);
  }

  present(presentation: DicePresentation, source?: object): void {
    this.controller.present(
      presentation, gamePreferences.getDice(), isReducedMotionEnabled(), source,
    );
  }

  fastForward(): void {
    if (this.controller.phase === "animating") {
      this.renderer.root.dataset.skipped = "true";
    }
    this.controller.fastForward();
  }

  private readonly handleFastForward = (): void => {
    const focused = document.activeElement;
    if (focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement) return;
    this.fastForward();
  };

  private settle(): void {
    this.stopCue?.();
    this.stopCue = null;
    this.renderer.settle();
  }

  cleanup(): void {
    if (this.cleaned) return;
    this.cleaned = true;
    this.controller.cleanup();
    this.unsubscribePreferences();
    this.unsubscribePrompts();
    this.scene.input.keyboard?.off("keydown-Z", this.handleFastForward);
    this.scene.events.off("shutdown", this.cleanup, this);
    this.scene.events.off("destroy", this.cleanup, this);
    scenePresentations.delete(this.scene);
  }
}

export function installDicePresentation(
  scene: Phaser.Scene,
  addLog?: (message: string) => void,
): DicePresentationManager {
  const existing = scenePresentations.get(scene);
  if (existing) return existing;
  const manager = new DicePresentationManager(scene, addLog);
  scenePresentations.set(scene, manager);
  return manager;
}

/** Accepts resolved presentation only; never blocks scene input or returns a promise. */
export function presentDiceResult(
  scene: Phaser.Scene,
  presentation: DicePresentation,
  source?: object,
): void {
  installDicePresentation(scene).present(presentation, source);
}

export function presentSkillDiceResult(
  scene: Phaser.Scene,
  result: SkillCheckRecord,
  label: string,
): void {
  presentDiceResult(scene, createSkillDicePresentation(result, { label }), result);
}

export function clearDicePresentation(scene: Phaser.Scene): void {
  scenePresentations.get(scene)?.cleanup();
}

export function resetDiceRollHistory(): void {
  diceRollHistory.clear();
}

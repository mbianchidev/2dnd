import { debugPanelLog } from "../config";
import {
  gamePreferences,
  isReducedMotionEnabled,
} from "../systems/accessibility";
import {
  DicePresentationController,
  createSkillDicePresentation,
  type DicePresentation,
  type DicePresentationEvent,
} from "../systems/dicePresentation";
import { inputPromptSource } from "../systems/input";
import { audioEngine } from "../systems/audio";
import { DiceRollRenderer } from "../renderers/dice";
import type { SkillCheckRecord } from "../data/skillChecks";

interface DicePresentationScene {
  readonly scene: { readonly key: string };
  readonly time: {
    delayedCall(duration: number, complete: () => void): { remove(dispatchCallback: boolean): unknown };
  };
  readonly input: {
    readonly keyboard?: {
      on(event: string, listener: () => void): unknown;
      off(event: string, listener: () => void): unknown;
    } | null;
  };
  readonly events: {
    once(event: string, listener: () => void, context?: object): unknown;
    off(event: string, listener: () => void, context?: object): unknown;
  };
}

const scenePresentations = new WeakMap<DicePresentationScene, DicePresentationManager>();
const inactiveScenes = new WeakSet<DicePresentationScene>();

export class DicePresentationManager {
  private readonly controller: DicePresentationController;
  private readonly renderer: DiceRollRenderer;
  private readonly unsubscribePreferences: () => void;
  private readonly unsubscribePrompts: () => void;
  private stopCue: (() => void) | null = null;
  private cleaned = false;

  constructor(
    private readonly scene: DicePresentationScene,
    addLog?: (message: string, event: DicePresentationEvent) => void,
  ) {
    this.renderer = new DiceRollRenderer(() => this.fastForward());
    this.controller = new DicePresentationController({
      record: (event) => {
        if (addLog) addLog(event.text, event);
        debugPanelLog(`[ROLL] ${event.text}`, false, "roll-detail");
      },
      show: (event) => {
        this.renderer.show(event, gamePreferences.get());
        if (event.duration > 0) {
          this.stopCue = audioEngine.playDiceCue(event.presentation.outcome);
        }
      },
      settle: () => this.settle(),
      hide: () => this.renderer.hide(),
      dismiss: (duration) => {
        this.settle();
        this.renderer.dismiss(duration);
      },
      clear: () => {
        this.settle();
        this.renderer.destroy();
      },
      schedule: (duration, complete) => {
        const timer = this.scene.time.delayedCall(duration, complete);
        return () => timer.remove(false);
      },
    }, scene.scene.key === "BattleScene" ? "battle" : "transient");
    this.renderer.applyPreferences(gamePreferences.get());
    this.unsubscribePreferences = gamePreferences.subscribe((preferences) => {
      this.controller.fastForward();
      this.renderer.applyPreferences(preferences);
    });
    this.unsubscribePrompts = inputPromptSource.subscribe(() => this.renderer.updatePrompt());
    this.scene.input.keyboard?.on("keydown-Z", this.handleFastForward);
    document.addEventListener("visibilitychange", this.handleVisibility);
    window.addEventListener("blur", this.handleBlur);
    window.addEventListener("resize", this.handleWindowChange);
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
      this.renderer.root.dataset.lastSkippedSequence = this.renderer.root.dataset.sequence;
    }
    this.controller.fastForward();
  }

  reset(): void {
    this.controller.reset();
    this.stopCue?.();
    this.stopCue = null;
  }

  private readonly handleFastForward = (): void => {
    const focused = document.activeElement;
    if (focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement) return;
    this.fastForward();
  };

  private readonly handleVisibility = (): void => {
    if (document.visibilityState !== "visible") this.reset();
  };

  private readonly handleBlur = (): void => this.reset();

  private readonly handleWindowChange = (): void => {
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
    document.removeEventListener("visibilitychange", this.handleVisibility);
    window.removeEventListener("blur", this.handleBlur);
    window.removeEventListener("resize", this.handleWindowChange);
    this.scene.events.off("shutdown", this.cleanup, this);
    this.scene.events.off("destroy", this.cleanup, this);
    scenePresentations.delete(this.scene);
    inactiveScenes.add(this.scene);
  }
}

export function installDicePresentation(
  scene: DicePresentationScene,
  addLog?: (message: string, event: DicePresentationEvent) => void,
): DicePresentationManager {
  const existing = scenePresentations.get(scene);
  if (existing) return existing;
  inactiveScenes.delete(scene);
  const manager = new DicePresentationManager(scene, addLog);
  scenePresentations.set(scene, manager);
  return manager;
}

/** Accepts resolved presentation only; never blocks scene input or returns a promise. */
export function presentDiceResult(
  scene: DicePresentationScene,
  presentation: DicePresentation,
  source?: object,
): void {
  if (inactiveScenes.has(scene)) return;
  installDicePresentation(scene).present(presentation, source);
}

export function presentSkillDiceResult(
  scene: DicePresentationScene,
  result: SkillCheckRecord,
  label: string,
): void {
  presentDiceResult(scene, createSkillDicePresentation(result, { label }), result);
}

export function clearDicePresentation(scene: DicePresentationScene): void {
  scenePresentations.get(scene)?.cleanup();
}

export function resetDicePresentation(scene: DicePresentationScene): void {
  scenePresentations.get(scene)?.reset();
}

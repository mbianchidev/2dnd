import type {
  CutsceneDefinition,
  CutsceneStep,
} from "../data/cutscenes";

export interface CutscenePresentationAdapter {
  present(
    step: CutsceneStep,
    stepIndex: number,
    onReady: () => void,
  ): void;
  reset(): void;
  cleanup(): void;
}

const NOOP_ADAPTER: CutscenePresentationAdapter = {
  present: (_step, _stepIndex, onReady) => onReady(),
  reset: () => {},
  cleanup: () => {},
};

export class CutsceneDirector {
  private stepIndex = 0;
  private isComplete = false;
  private isLocked = true;
  private isDestroyed = false;
  private presentationVersion = 0;

  constructor(
    readonly definition: CutsceneDefinition,
    private readonly onComplete: () => void,
    private readonly presentation: CutscenePresentationAdapter = NOOP_ADAPTER,
  ) {
    if (definition.steps.length === 0) {
      throw new Error(`[cutscene] ${definition.id} has no steps`);
    }
    this.presentCurrentStep();
  }

  get currentStep(): CutsceneStep {
    return this.definition.steps[this.stepIndex]!;
  }

  get currentStepIndex(): number {
    return this.stepIndex;
  }

  get completed(): boolean {
    return this.isComplete;
  }

  get inputLocked(): boolean {
    return this.isLocked;
  }

  advance(): boolean {
    if (this.isDestroyed || this.isComplete || this.isLocked) return false;
    if (this.stepIndex < this.definition.steps.length - 1) {
      this.stepIndex += 1;
      this.presentCurrentStep();
      return false;
    }
    return this.complete();
  }

  skip(): boolean {
    if (this.isDestroyed || this.isComplete) return false;
    return this.complete();
  }

  reset(): void {
    if (this.isDestroyed) return;
    this.presentationVersion += 1;
    this.presentation.reset();
    this.stepIndex = 0;
    this.isComplete = false;
    this.presentCurrentStep();
  }

  destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    this.isLocked = true;
    this.presentationVersion += 1;
    this.presentation.cleanup();
  }

  private presentCurrentStep(): void {
    this.isLocked = true;
    const version = ++this.presentationVersion;
    this.presentation.present(
      this.currentStep,
      this.stepIndex,
      () => {
        if (
          !this.isDestroyed
          && !this.isComplete
          && version === this.presentationVersion
        ) {
          this.isLocked = false;
        }
      },
    );
  }

  private complete(): true {
    this.isComplete = true;
    this.isLocked = true;
    this.onComplete();
    return true;
  }
}

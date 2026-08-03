import type {
  CutsceneDefinition,
  CutsceneStep,
} from "../data/cutscenes";

export class CutsceneDirector {
  private stepIndex = 0;
  private isComplete = false;

  constructor(
    readonly definition: CutsceneDefinition,
    private readonly onComplete: () => void,
  ) {
    if (definition.steps.length === 0) {
      throw new Error(`[cutscene] ${definition.id} has no steps`);
    }
  }

  get currentStep(): CutsceneStep {
    return this.definition.steps[this.stepIndex]!;
  }

  get completed(): boolean {
    return this.isComplete;
  }

  advance(): boolean {
    if (this.isComplete) return false;
    if (this.stepIndex < this.definition.steps.length - 1) {
      this.stepIndex += 1;
      return false;
    }
    return this.complete();
  }

  skip(): boolean {
    if (this.isComplete) return false;
    return this.complete();
  }

  reset(): void {
    this.stepIndex = 0;
    this.isComplete = false;
  }

  private complete(): true {
    this.isComplete = true;
    this.onComplete();
    return true;
  }
}

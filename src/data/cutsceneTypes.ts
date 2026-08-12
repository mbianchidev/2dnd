export type CutsceneCategory =
  | "opening"
  | "questStage"
  | "covenant"
  | "dungeonReveal"
  | "bossPre"
  | "bossPost"
  | "keystone"
  | "companion"
  | "route"
  | "finale"
  | "epilogue";

export type CutsceneBackdrop =
  | "heartlands"
  | "city"
  | "forest"
  | "canyon"
  | "desert"
  | "marsh"
  | "crypt"
  | "frost"
  | "forge"
  | "mountain"
  | "stars";

export type CutsceneEffect =
  | "none"
  | "runes"
  | "leaves"
  | "sand"
  | "mist"
  | "snow"
  | "embers"
  | "flash"
  | "shake"
  | "stars";

export type CutsceneAudioCue =
  | "opening"
  | "stage"
  | "oath"
  | "dungeon"
  | "bossReveal"
  | "bossDefeat"
  | "keystone"
  | "recruitment"
  | "routeOpen"
  | "finale";

export type CutsceneStageSlot =
  | "farLeft"
  | "left"
  | "center"
  | "right"
  | "farRight";

interface CutsceneActorCueBase {
  readonly id: string;
  readonly label: string;
  readonly slot: CutsceneStageSlot;
  readonly scale?: number;
  readonly entrance?: "left" | "right" | "fade";
}

export interface CutsceneHeroActorCue extends CutsceneActorCueBase {
  readonly role: "hero";
  readonly id: "hero";
  readonly label: "{hero}";
}

export interface CutsceneCharacterActorCue extends CutsceneActorCueBase {
  readonly role: "character" | "boss";
  readonly color: number;
}

export type CutsceneActorCue =
  | CutsceneHeroActorCue
  | CutsceneCharacterActorCue;

export interface CutsceneCameraCue {
  readonly focus: CutsceneStageSlot;
  readonly zoom?: number;
  readonly durationMs?: number;
}

export interface CutscenePresentation {
  readonly backdrop: CutsceneBackdrop;
  readonly actors?: readonly CutsceneActorCue[];
  readonly camera?: CutsceneCameraCue;
  readonly effect?: CutsceneEffect;
  readonly audioCue?: CutsceneAudioCue;
  readonly fade?: "in" | "cross";
}

interface CutsceneStepBase {
  readonly presentation?: CutscenePresentation;
}

export interface CutsceneNarrationStep extends CutsceneStepBase {
  readonly type: "narration";
  readonly heading?: string;
  readonly text: string;
}

export interface CutsceneDialogueStep extends CutsceneStepBase {
  readonly type: "dialogue";
  readonly speaker: string;
  readonly text: string;
}

export interface CutsceneSummaryStep extends CutsceneStepBase {
  readonly type: "summary";
  readonly heading: string;
}

export interface CutsceneCreditsStep extends CutsceneStepBase {
  readonly type: "credits";
  readonly lines: readonly string[];
}

export type CutsceneStep =
  | CutsceneNarrationStep
  | CutsceneDialogueStep
  | CutsceneSummaryStep
  | CutsceneCreditsStep;

export interface CutsceneBossBattleCompletion {
  readonly type: "bossBattle";
  readonly bossId: string;
  readonly biome: string;
}

export interface CutsceneDefinition<Id extends string = string> {
  readonly id: Id;
  readonly title: string;
  readonly category: CutsceneCategory;
  readonly steps: readonly CutsceneStep[];
  readonly completion?: CutsceneBossBattleCompletion;
  readonly chronicle?: boolean;
}

export type CutsceneEvent =
  | { readonly type: "newGame" }
  | { readonly type: "bossPre"; readonly bossId: string };

export type CutsceneTriggerCondition =
  | {
    readonly type: "event";
    readonly event: CutsceneEvent["type"];
    readonly targetId?: string;
  }
  | {
    readonly type: "questStage";
    readonly questId: string;
    readonly stageId: string;
  }
  | {
    readonly type: "questObjective";
    readonly questId: string;
    readonly objectiveId: string;
  }
  | {
    readonly type: "questCompleted";
    readonly questId: string;
  }
  | {
    readonly type: "bossDefeated";
    readonly bossId: string;
  }
  | {
    readonly type: "dungeonEntered";
    readonly dungeonId: string;
  }
  | {
    readonly type: "companionRecruited";
    readonly companionId: string;
  }
  | {
    readonly type: "questGate";
    readonly questId: string;
    readonly stageId: string;
    readonly objectiveIds?: readonly string[];
  };

export interface CutsceneTriggerDefinition<Id extends string = string> {
  readonly id: string;
  readonly cutsceneId: Id;
  readonly priority: number;
  readonly condition: CutsceneTriggerCondition;
}

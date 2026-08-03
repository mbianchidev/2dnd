import {
  CAMPAIGN_CUTSCENE_DEFINITIONS,
  CAMPAIGN_CUTSCENE_IDS,
  CAMPAIGN_CUTSCENE_TRIGGERS,
  CAMPAIGN_EPILOGUE_CUTSCENE,
  CAMPAIGN_EPILOGUE_CUTSCENE_ID,
  MAIN_QUEST_STAGE_CUTSCENES,
} from "./cutsceneCampaign";
import {
  BOSS_CUTSCENE_DEFINITIONS,
  BOSS_CUTSCENE_IDS,
  BOSS_CUTSCENE_TRIGGERS,
  BOSS_CUTSCENES,
} from "./cutsceneBosses";
import type {
  CutsceneDefinition,
  CutsceneTriggerDefinition,
} from "./cutsceneTypes";

export {
  BOSS_CUTSCENES,
  CAMPAIGN_EPILOGUE_CUTSCENE,
  CAMPAIGN_EPILOGUE_CUTSCENE_ID,
  MAIN_QUEST_STAGE_CUTSCENES,
};
export type {
  CutsceneActorCue,
  CutsceneAudioCue,
  CutsceneBackdrop,
  CutsceneBossBattleCompletion,
  CutsceneCameraCue,
  CutsceneCategory,
  CutsceneCreditsStep,
  CutsceneDefinition,
  CutsceneDialogueStep,
  CutsceneEffect,
  CutsceneEvent,
  CutsceneNarrationStep,
  CutscenePresentation,
  CutsceneStageSlot,
  CutsceneStep,
  CutsceneSummaryStep,
  CutsceneTriggerCondition,
  CutsceneTriggerDefinition,
} from "./cutsceneTypes";

export const CUTSCENE_IDS = [
  ...CAMPAIGN_CUTSCENE_IDS,
  ...BOSS_CUTSCENE_IDS,
] as const;

export type CutsceneId = (typeof CUTSCENE_IDS)[number];

export const CAMPAIGN_BOSS_IDS = [
  "cryptLich",
  "frostWarden",
  "infernoForgemaster",
] as const;

const CUTSCENE_ID_SET = new Set<string>(CUTSCENE_IDS);
const definitionRecord: Partial<
Record<CutsceneId, CutsceneDefinition<CutsceneId>>
> = {};

for (const definition of [
  ...CAMPAIGN_CUTSCENE_DEFINITIONS,
  ...BOSS_CUTSCENE_DEFINITIONS,
]) {
  if (!isCutsceneId(definition.id)) {
    throw new Error(`[cutscene] Definition has unknown ID ${definition.id}`);
  }
  if (definitionRecord[definition.id]) {
    throw new Error(`[cutscene] Duplicate definition ${definition.id}`);
  }
  definitionRecord[definition.id] =
    definition as CutsceneDefinition<CutsceneId>;
}

if (Object.keys(definitionRecord).length !== CUTSCENE_IDS.length) {
  throw new Error("[cutscene] Every stable ID must have exactly one definition");
}

export const CUTSCENES = Object.freeze(definitionRecord) as Readonly<
Record<CutsceneId, CutsceneDefinition<CutsceneId>>
>;

export const CUTSCENE_TRIGGERS: readonly CutsceneTriggerDefinition<CutsceneId>[] =
  [...CAMPAIGN_CUTSCENE_TRIGGERS, ...BOSS_CUTSCENE_TRIGGERS].map(
    (trigger) => {
      if (!isCutsceneId(trigger.cutsceneId)) {
        throw new Error(
          `[cutscene] Trigger ${trigger.id} references ${trigger.cutsceneId}`,
        );
      }
      return {
        ...trigger,
        cutsceneId: trigger.cutsceneId,
      };
    },
  );

export function isCutsceneId(value: unknown): value is CutsceneId {
  return typeof value === "string" && CUTSCENE_ID_SET.has(value);
}

export function getCutsceneDefinition(
  id: CutsceneId,
): CutsceneDefinition<CutsceneId> {
  return CUTSCENES[id];
}

export function getCutsceneDefinitions(): readonly CutsceneDefinition<CutsceneId>[] {
  return CUTSCENE_IDS.map((id) => CUTSCENES[id]);
}

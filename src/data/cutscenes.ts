export const CAMPAIGN_EPILOGUE_CUTSCENE_ID =
  "campaign.twelvefoldCovenant.epilogue" as const;

export const CUTSCENE_IDS = [
  CAMPAIGN_EPILOGUE_CUTSCENE_ID,
] as const;

export type CutsceneId = (typeof CUTSCENE_IDS)[number];

export const CAMPAIGN_BOSS_IDS = [
  "cryptLich",
  "frostWarden",
  "infernoForgemaster",
] as const;

export interface CutsceneNarrationStep {
  type: "narration";
  heading?: string;
  text: string;
}

export interface CutsceneDialogueStep {
  type: "dialogue";
  speaker: string;
  text: string;
}

export interface CutsceneSummaryStep {
  type: "summary";
  heading: string;
}

export interface CutsceneCreditsStep {
  type: "credits";
  lines: readonly string[];
}

export type CutsceneStep =
  | CutsceneNarrationStep
  | CutsceneDialogueStep
  | CutsceneSummaryStep
  | CutsceneCreditsStep;

export interface CutsceneDefinition {
  id: CutsceneId;
  title: string;
  steps: readonly CutsceneStep[];
}

export const CAMPAIGN_EPILOGUE_CUTSCENE: CutsceneDefinition = {
  id: CAMPAIGN_EPILOGUE_CUTSCENE_ID,
  title: "The Covenant Restored",
  steps: [
    {
      type: "narration",
      heading: "The Twelvefold Covenant",
      text: "Twelve oaths answer as one. The three keystones blaze, and the fire beneath the Volcanic Forge burns clean once more.",
    },
    {
      type: "dialogue",
      speaker: "Archivist Elowen",
      text: "The covenant names you its roadwarden. Its promise is restored, but its roads still need a guardian. Go freely - the world you saved remains yours to explore.",
    },
    {
      type: "narration",
      heading: "A New Road",
      text: "Across the realm, sealed gates open, old bells ring, and the twelve cities renew the promises that bound them together.",
    },
    {
      type: "summary",
      heading: "Your Chronicle",
    },
    {
      type: "credits",
      lines: [
        "2D&D",
        "Created by the 2D&D project contributors",
        "Built with Phaser",
        "Procedural art and synthesized audio",
        "Thank you for playing",
      ],
    },
  ],
};

export const CUTSCENES: Readonly<Record<CutsceneId, CutsceneDefinition>> = {
  [CAMPAIGN_EPILOGUE_CUTSCENE_ID]: CAMPAIGN_EPILOGUE_CUTSCENE,
};

export function isCutsceneId(value: unknown): value is CutsceneId {
  return typeof value === "string"
    && (CUTSCENE_IDS as readonly string[]).includes(value);
}

export function getCutsceneDefinition(id: CutsceneId): CutsceneDefinition {
  return CUTSCENES[id];
}

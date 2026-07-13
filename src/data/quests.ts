/**
 * Data-driven quest definitions, named quest NPCs, rewards, and gated entrances.
 */

export const MAIN_QUEST_ID = "ashenRoad" as const;
export const SIDE_QUEST_ID = "wardensDispatch" as const;

export const QUEST_IDS = [MAIN_QUEST_ID, SIDE_QUEST_ID] as const;

export type QuestId = (typeof QUEST_IDS)[number];
export type QuestStatus = "locked" | "active" | "completed";
export type QuestType = "main" | "side";
export type QuestNpcId = "elderRowan" | "wardenIlyra" | "magisterSol";
export type QuestEntranceType = "city" | "dungeon";

export interface QuestProgress {
  status: QuestStatus;
  stage: number;
  rewardGranted: boolean;
}

export type QuestLogState = Record<QuestId, QuestProgress>;

export interface QuestStageDefinition {
  title: string;
  objective: string;
  npcId?: QuestNpcId;
  bossId?: string;
}

export interface QuestRewardDefinition {
  gold: number;
  itemIds: string[];
}

export interface QuestCompletionActionDefinition {
  /** Stable idempotency key owned by the quest definition. */
  id: string;
  /** Consumer-defined action type, such as "worldState" or "recruitCompanion". */
  type: string;
  /** Stable target identifier interpreted by the consuming system. */
  targetId: string;
}

export interface QuestDefinition {
  id: QuestId;
  name: string;
  type: QuestType;
  summary: string;
  stages: QuestStageDefinition[];
  reward: QuestRewardDefinition;
  completionActions?: QuestCompletionActionDefinition[];
  outcome: string;
}

export interface QuestNpcDefinition {
  id: QuestNpcId;
  name: string;
  cityId: string;
}

export interface QuestEntranceLocation {
  type: QuestEntranceType;
  targetId: string;
  chunkX: number;
  chunkY: number;
  tileX: number;
  tileY: number;
}

export interface QuestEntranceBlockDefinition extends QuestEntranceLocation {
  id: string;
  label: string;
  requiredQuestId: QuestId;
  requiredStage: number;
  blockedMessage: string;
}

export const QUEST_NPCS: Record<QuestNpcId, QuestNpcDefinition> = {
  elderRowan: {
    id: "elderRowan",
    name: "Elder Rowan",
    cityId: "willowdale_city",
  },
  wardenIlyra: {
    id: "wardenIlyra",
    name: "Warden Ilyra",
    cityId: "sandport_city",
  },
  magisterSol: {
    id: "magisterSol",
    name: "Magister Sol",
    cityId: "ashfall_city",
  },
};

export const QUESTS: Record<QuestId, QuestDefinition> = {
  [MAIN_QUEST_ID]: {
    id: MAIN_QUEST_ID,
    name: "The Ashen Road",
    type: "main",
    summary: "Restore the sealed eastern road and end the fire beneath Ashfall.",
    stages: [
      {
        title: "Willowdale's Warning",
        objective: "Speak with Elder Rowan in Willowdale.",
        npcId: "elderRowan",
      },
      {
        title: "The Crypt Seal",
        objective: "Defeat the Crypt Lich, then report to Elder Rowan.",
        npcId: "elderRowan",
        bossId: "cryptLich",
      },
      {
        title: "The Warden's Test",
        objective: "Take the recovered seal to Warden Ilyra in Sandport.",
        npcId: "wardenIlyra",
      },
      {
        title: "Fire Beneath Ashfall",
        objective: "Defeat the Inferno Forgemaster, then report to Magister Sol.",
        npcId: "magisterSol",
        bossId: "infernoForgemaster",
      },
    ],
    reward: {
      gold: 500,
      itemIds: ["dawnforgedBlade"],
    },
    completionActions: [
      {
        id: "world.ashenRoadRestored",
        type: "worldState",
        targetId: "ashfallRestored",
      },
    ],
    outcome: "The eastern road reopens and Ashfall's forge burns clean again.",
  },
  [SIDE_QUEST_ID]: {
    id: SIDE_QUEST_ID,
    name: "Warden's Dispatch",
    type: "side",
    summary: "Carry Sandport's warning back to Willowdale before the road reopens.",
    stages: [
      {
        title: "Carry the Warning",
        objective: "Deliver Warden Ilyra's dispatch to Elder Rowan.",
        npcId: "elderRowan",
      },
      {
        title: "Return to Sandport",
        objective: "Tell Warden Ilyra that Willowdale has been warned.",
        npcId: "wardenIlyra",
      },
    ],
    reward: {
      gold: 175,
      itemIds: ["greaterPotion", "greaterPotion"],
    },
    completionActions: [
      {
        id: "world.wardenPatrols",
        type: "worldState",
        targetId: "heartlandsPatrolAlliance",
      },
    ],
    outcome: "Sandport and Willowdale coordinate patrols along the reopened road.",
  },
};

export const QUEST_ENTRANCE_BLOCKS: QuestEntranceBlockDefinition[] = [
  {
    id: "ashfallRoad",
    label: "Ashfall Road",
    type: "city",
    targetId: "ashfall_city",
    chunkX: 6,
    chunkY: 4,
    tileX: 10,
    tileY: 7,
    requiredQuestId: MAIN_QUEST_ID,
    requiredStage: 3,
    blockedMessage: "The Ashfall road is barricaded. Warden Ilyra in Sandport controls passage.",
  },
  {
    id: "volcanicForgeRoad",
    label: "Volcanic Forge Road",
    type: "dungeon",
    targetId: "volcanic_forge",
    chunkX: 6,
    chunkY: 5,
    tileX: 14,
    tileY: 5,
    requiredQuestId: MAIN_QUEST_ID,
    requiredStage: 3,
    blockedMessage: "The forge road is sealed until Warden Ilyra reopens the eastern route.",
  },
];

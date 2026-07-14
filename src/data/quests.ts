/**
 * Data-driven quest definitions, named quest NPCs, rewards, and gated entrances.
 */

export const MAIN_QUEST_ID = "ashenRoad" as const;
export const SIDE_QUEST_ID = "wardensDispatch" as const;
export const RECRUIT_GUARDIAN_QUEST_ID = "recruitGuardian" as const;
export const RECRUIT_SCOUT_QUEST_ID = "recruitScout" as const;
export const RECRUIT_MYSTIC_QUEST_ID = "recruitMystic" as const;

export const QUEST_IDS = [
  MAIN_QUEST_ID,
  SIDE_QUEST_ID,
  RECRUIT_GUARDIAN_QUEST_ID,
  RECRUIT_SCOUT_QUEST_ID,
  RECRUIT_MYSTIC_QUEST_ID,
] as const;

export type QuestId = (typeof QUEST_IDS)[number];
export type QuestStatus = "locked" | "active" | "completed";
export type QuestType = "main" | "side";
export type QuestNpcId =
  | "elderRowan"
  | "wardenIlyra"
  | "magisterSol"
  | "guardian"
  | "scout"
  | "mystic";
export type QuestEntranceType = "city" | "dungeon";

export interface QuestProgress {
  status: QuestStatus;
  stage: number;
  rewardGranted: boolean;
}

export type QuestLogState = Record<QuestId, QuestProgress>;

export interface QuestStageDefinition {
  id: string;
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
  guardian: {
    id: "guardian",
    name: "Bram Ironward",
    cityId: "ironhold_city",
  },
  scout: {
    id: "scout",
    name: "Kaia Swiftstep",
    cityId: "sandport_city",
  },
  mystic: {
    id: "mystic",
    name: "Selene Vey",
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
        id: "meetElderRowan",
        title: "Willowdale's Warning",
        objective: "Speak with Elder Rowan in Willowdale.",
        npcId: "elderRowan",
      },
      {
        id: "recoverRoadSeal",
        title: "The Crypt Seal",
        objective: "Defeat the Crypt Lich, then report to Elder Rowan.",
        npcId: "elderRowan",
        bossId: "cryptLich",
      },
      {
        id: "openEasternRoad",
        title: "The Warden's Test",
        objective: "Take the recovered seal to Warden Ilyra in Sandport.",
        npcId: "wardenIlyra",
      },
      {
        id: "cleanseVolcanicForge",
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
        id: "deliverWardensDispatch",
        title: "Carry the Warning",
        objective: "Deliver Warden Ilyra's dispatch to Elder Rowan.",
        npcId: "elderRowan",
      },
      {
        id: "reportWardensDispatch",
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
  [RECRUIT_GUARDIAN_QUEST_ID]: {
    id: RECRUIT_GUARDIAN_QUEST_ID,
    name: "The Ironward Oath",
    type: "side",
    summary: "Prove your resolve and earn Bram Ironward's shield.",
    stages: [
      {
        id: "meetGuardian",
        title: "Meet the Guardian",
        objective: "Speak with Bram Ironward in Ironhold.",
        npcId: "guardian",
      },
      {
        id: "guardianTrial",
        title: "The Guardian's Trial",
        objective: "Defeat the Cave Troll, then return to Bram Ironward.",
        npcId: "guardian",
        bossId: "troll",
      },
      {
        id: "guardianOath",
        title: "The Guardian's Oath",
        objective: "Speak with Bram once more to seal the oath.",
        npcId: "guardian",
      },
    ],
    reward: { gold: 0, itemIds: [] },
    completionActions: [
      {
        id: "companion.recruit.guardian",
        type: "recruitCompanion",
        targetId: "guardian",
      },
    ],
    outcome: "Bram Ironward pledges his shield to your party.",
  },
  [RECRUIT_SCOUT_QUEST_ID]: {
    id: RECRUIT_SCOUT_QUEST_ID,
    name: "The Swiftstep Trail",
    type: "side",
    summary: "Follow Kaia Swiftstep's trail and prove you can keep pace.",
    stages: [
      {
        id: "meetScout",
        title: "Meet the Scout",
        objective: "Speak with Kaia Swiftstep in Sandport.",
        npcId: "scout",
      },
      {
        id: "scoutTrial",
        title: "The Scout's Trial",
        objective: "Defeat the Canyon Drake, then return to Kaia.",
        npcId: "scout",
        bossId: "canyonDrake",
      },
      {
        id: "scoutOath",
        title: "The Scout's Oath",
        objective: "Speak with Kaia once more to plan the road ahead.",
        npcId: "scout",
      },
    ],
    reward: { gold: 0, itemIds: [] },
    completionActions: [
      {
        id: "companion.recruit.scout",
        type: "recruitCompanion",
        targetId: "scout",
      },
    ],
    outcome: "Kaia Swiftstep joins your party as its eyes and ears.",
  },
  [RECRUIT_MYSTIC_QUEST_ID]: {
    id: RECRUIT_MYSTIC_QUEST_ID,
    name: "The Veiled Flame",
    type: "side",
    summary: "Help Selene Vey quiet the magic beneath Ashfall.",
    stages: [
      {
        id: "meetMystic",
        title: "Meet the Mystic",
        objective: "Speak with Selene Vey in Ashfall.",
        npcId: "mystic",
      },
      {
        id: "mysticTrial",
        title: "The Mystic's Trial",
        objective: "Defeat the Volcanic Wyrm, then return to Selene.",
        npcId: "mystic",
        bossId: "volcanicWyrm",
      },
      {
        id: "mysticOath",
        title: "The Mystic's Oath",
        objective: "Speak with Selene once more to bind the ward.",
        npcId: "mystic",
      },
    ],
    reward: { gold: 0, itemIds: [] },
    completionActions: [
      {
        id: "companion.recruit.mystic",
        type: "recruitCompanion",
        targetId: "mystic",
      },
    ],
    outcome: "Selene Vey joins your party and carries the ward with her.",
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

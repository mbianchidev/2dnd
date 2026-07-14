/**
 * Immutable quest content for the Twelvefold Covenant story arc.
 */

export const MAIN_QUEST_ID = "twelvefoldCovenant" as const;
export const IRON_DISPATCH_QUEST_ID = "ironboundDispatch" as const;
export const FROST_SILK_QUEST_ID = "silkAgainstTheCold" as const;

export const QUEST_IDS = [
  MAIN_QUEST_ID,
  IRON_DISPATCH_QUEST_ID,
  FROST_SILK_QUEST_ID,
] as const;

export type QuestId = (typeof QUEST_IDS)[number];
export type QuestStatus = "inactive" | "active" | "completed";
export type QuestKind = "main" | "side";

export const QUEST_ITEM_IDS = {
  covenantSigil: "covenantSigil",
  sealedDispatch: "sealedDispatch",
  frostSilkBundle: "frostSilkBundle",
  shadowSteed: "mountShadowSteed",
} as const;

export const QUEST_NPC_IDS = {
  willowdale: "willowdaleArchivist",
  ironhold: "ironholdWarden",
  deeproot: "deeprootRootspeaker",
  frostheim: "frostheimSeer",
  thornvale: "thornvaleGreenwarden",
  sandport: "sandportHarbormaster",
  canyonwatch: "canyonwatchMarshal",
  dunerest: "dunerestLorekeeper",
  bogtown: "bogtownApothecary",
  shadowfen: "shadowfenFerryman",
  ashfall: "ashfallSmith",
  ridgewatch: "ridgewatchSentinel",
} as const;

export interface QuestNpcDefinition {
  id: string;
  cityId: string;
  name: string;
}

export const QUEST_NPCS: QuestNpcDefinition[] = [
  { id: QUEST_NPC_IDS.willowdale, cityId: "willowdale_city", name: "Archivist Elowen" },
  { id: QUEST_NPC_IDS.ironhold, cityId: "ironhold_city", name: "Warden Brann" },
  { id: QUEST_NPC_IDS.deeproot, cityId: "deeproot_city", name: "Rootspeaker Neris" },
  { id: QUEST_NPC_IDS.frostheim, cityId: "frostheim_city", name: "Seer Yrsa" },
  { id: QUEST_NPC_IDS.thornvale, cityId: "thornvale_city", name: "Greenwarden Rowan" },
  { id: QUEST_NPC_IDS.sandport, cityId: "sandport_city", name: "Harbormaster Sable" },
  { id: QUEST_NPC_IDS.canyonwatch, cityId: "canyonwatch_city", name: "Marshal Tarek" },
  { id: QUEST_NPC_IDS.dunerest, cityId: "dunerest_city", name: "Lorekeeper Zahra" },
  { id: QUEST_NPC_IDS.bogtown, cityId: "bogtown_city", name: "Apothecary Mirel" },
  { id: QUEST_NPC_IDS.shadowfen, cityId: "shadowfen_city", name: "Ferryman Vey" },
  { id: QUEST_NPC_IDS.ashfall, cityId: "ashfall_city", name: "Smith Kael" },
  { id: QUEST_NPC_IDS.ridgewatch, cityId: "ridgewatch_city", name: "Sentinel Mira" },
];

export interface QuestProgress {
  status: QuestStatus;
  stage: number;
  objectives: Record<string, number>;
  claimedRewards: string[];
}

export interface QuestLogState {
  quests: Record<QuestId, QuestProgress>;
  seenWarnings: string[];
}

export interface QuestRewardBase {
  id: string;
  message: string;
  optionalObjectiveId?: string;
}

export interface QuestGoldReward extends QuestRewardBase {
  type: "gold";
  amount: number;
}

export interface QuestXpReward extends QuestRewardBase {
  type: "xp";
  amount: number;
}

export interface QuestItemReward extends QuestRewardBase {
  type: "item";
  itemId: string;
  quantity?: number;
  unique?: boolean;
}

export type QuestRewardDefinition =
  | QuestGoldReward
  | QuestXpReward
  | QuestItemReward;

export interface QuestObjectiveDefinition {
  id: string;
  type: "talk" | "defeat" | "visit";
  targetId: string;
  description: string;
  required?: number;
  prerequisites?: string[];
  dialogue?: string[];
}

export interface QuestOptionalObjectiveDefinition extends QuestObjectiveDefinition {
  unlockStage: number;
}

export interface QuestStageDefinition {
  id: string;
  title: string;
  summary: string;
  objectives: QuestObjectiveDefinition[];
  rewards?: QuestRewardDefinition[];
  consumeItemIds?: string[];
}

export interface QuestDefinition {
  id: QuestId;
  title: string;
  kind: QuestKind;
  summary: string;
  startNpcId?: string;
  startDialogue?: string[];
  unlockMainStage?: number;
  startRewards?: QuestRewardDefinition[];
  stages: QuestStageDefinition[];
  optionalObjectives?: QuestOptionalObjectiveDefinition[];
  completionRewards?: QuestRewardDefinition[];
}

const MAIN_QUEST: QuestDefinition = {
  id: MAIN_QUEST_ID,
  title: "The Twelvefold Covenant",
  kind: "main",
  summary: "Restore the twelve city oaths and seal the power beneath the Volcanic Forge.",
  stages: [
    {
      id: "firstSeal",
      title: "The First Seal",
      summary: "Find Archivist Elowen in Willowdale and learn why the old covenant is failing.",
      objectives: [
        {
          id: "speakElowen",
          type: "talk",
          targetId: QUEST_NPC_IDS.willowdale,
          description: "Speak with Archivist Elowen in Willowdale.",
          dialogue: [
            "The old wards are fading. Each city once carried a voice in the Twelvefold Covenant.",
            "Take this sigil. Gather the twelve oaths, reclaim the lost keystones, and meet me here when the forge is silent.",
          ],
        },
      ],
      rewards: [
        {
          id: "main:covenantSigil",
          type: "item",
          itemId: QUEST_ITEM_IDS.covenantSigil,
          unique: true,
          message: "Received the Covenant Sigil.",
        },
      ],
    },
    {
      id: "stoneAndRoot",
      title: "Stone and Root",
      summary: "Unite Ironhold and Deeproot, then recover the Heartlands keystone.",
      objectives: [
        {
          id: "ironholdOath",
          type: "talk",
          targetId: QUEST_NPC_IDS.ironhold,
          description: "Receive Ironhold's oath from Warden Brann.",
          dialogue: [
            "Ironhold remembers its word, even if the old roads do not.",
            "You have our oath. Deeproot must answer beside us before the crypt seal will yield.",
          ],
        },
        {
          id: "deeprootOath",
          type: "talk",
          targetId: QUEST_NPC_IDS.deeproot,
          description: "Receive Deeproot's oath from Rootspeaker Neris.",
          dialogue: [
            "The roots below the Heartlands are restless. Something dead is pulling at them.",
            "Deeproot joins the covenant. With Ironhold's word, the crypt seal will recognize you.",
          ],
        },
        {
          id: "cryptLich",
          type: "defeat",
          targetId: "cryptLich",
          description: "Defeat the Crypt Lich in Heartlands Crypt.",
          prerequisites: ["ironholdOath", "deeprootOath"],
        },
      ],
    },
    {
      id: "winterWitness",
      title: "The Winter Witness",
      summary: "Join Frostheim and Thornvale, then face the Frost Warden.",
      objectives: [
        {
          id: "frostheimOath",
          type: "talk",
          targetId: QUEST_NPC_IDS.frostheim,
          description: "Receive Frostheim's oath from Seer Yrsa.",
          dialogue: [
            "I saw your sigil beneath a sky of broken ice.",
            "Frostheim bears witness. The cavern may be entered early, but it does not forgive haste.",
          ],
        },
        {
          id: "thornvaleOath",
          type: "talk",
          targetId: QUEST_NPC_IDS.thornvale,
          description: "Receive Thornvale's oath from Greenwarden Rowan.",
          dialogue: [
            "Winter and woodland share the same deep water.",
            "Thornvale adds its living word. Carry it north, where the Frost Warden keeps the second keystone.",
          ],
        },
        {
          id: "frostWarden",
          type: "defeat",
          targetId: "frostWarden",
          description: "Defeat the Frost Warden in Frost Cavern.",
        },
      ],
    },
    {
      id: "sunRoad",
      title: "The Sun Road",
      summary: "Carry Sandport's pass through Canyonwatch and consult Dunerest.",
      objectives: [
        {
          id: "sandportPass",
          type: "talk",
          targetId: QUEST_NPC_IDS.sandport,
          description: "Receive a canyon pass from Harbormaster Sable.",
          dialogue: [
            "The canyon marshal trusts seals more than travelers.",
            "Show Tarek the mark I have added to your sigil. Canyonwatch will open its gate.",
          ],
        },
        {
          id: "canyonwatchOath",
          type: "talk",
          targetId: QUEST_NPC_IDS.canyonwatch,
          description: "Receive Canyonwatch's oath from Marshal Tarek.",
          prerequisites: ["sandportPass"],
          dialogue: [
            "Sable's mark is genuine. You crossed the canyon by covenant law.",
            "Canyonwatch stands with you. Zahra in Dunerest keeps the words we have forgotten.",
          ],
        },
        {
          id: "dunerestOath",
          type: "talk",
          targetId: QUEST_NPC_IDS.dunerest,
          description: "Receive Dunerest's oath from Lorekeeper Zahra.",
          prerequisites: ["canyonwatchOath"],
          dialogue: [
            "The covenant was never a chain. It was twelve promises freely renewed.",
            "Dunerest renews its promise. The marsh and ash cities are the last voices you need.",
          ],
        },
      ],
    },
    {
      id: "marshCovenant",
      title: "The Marsh Covenant",
      summary: "Win the trust of Bogtown and Shadowfen.",
      objectives: [
        {
          id: "bogtownOath",
          type: "talk",
          targetId: QUEST_NPC_IDS.bogtown,
          description: "Receive Bogtown's oath from Apothecary Mirel.",
          dialogue: [
            "The swamp keeps every poison and every cure.",
            "Bogtown will lend its oath. Vey can guide its echo through Shadowfen.",
          ],
        },
        {
          id: "shadowfenOath",
          type: "talk",
          targetId: QUEST_NPC_IDS.shadowfen,
          description: "Receive Shadowfen's oath from Ferryman Vey.",
          prerequisites: ["bogtownOath"],
          dialogue: [
            "The fen has already weighed your footsteps.",
            "It accepts Bogtown's word and adds its own. A hydra stalks the old waters, if you seek to quiet them fully.",
          ],
        },
      ],
    },
    {
      id: "ashenWatch",
      title: "The Ashen Watch",
      summary: "Join Ashfall and Ridgewatch before approaching the final forge.",
      objectives: [
        {
          id: "ashfallOath",
          type: "talk",
          targetId: QUEST_NPC_IDS.ashfall,
          description: "Receive Ashfall's oath from Smith Kael.",
          dialogue: [
            "The forge below has begun to answer every hammer in Ashfall.",
            "Take our oath to Ridgewatch. Their sentinels can show you the last safe road.",
          ],
        },
        {
          id: "ridgewatchOath",
          type: "talk",
          targetId: QUEST_NPC_IDS.ridgewatch,
          description: "Receive Ridgewatch's oath from Sentinel Mira.",
          prerequisites: ["ashfallOath"],
          dialogue: [
            "From this ridge, the forge glows even at noon.",
            "Ridgewatch gives the twelfth oath. The Volcanic Forge will now test whether the covenant deserves to endure.",
          ],
        },
      ],
    },
    {
      id: "lastForge",
      title: "The Last Forge",
      summary: "Defeat the Inferno Forgemaster and return to Willowdale.",
      objectives: [
        {
          id: "infernoForgemaster",
          type: "defeat",
          targetId: "infernoForgemaster",
          description: "Defeat the Inferno Forgemaster in the Volcanic Forge.",
        },
        {
          id: "returnToElowen",
          type: "talk",
          targetId: QUEST_NPC_IDS.willowdale,
          description: "Return to Archivist Elowen in Willowdale.",
          prerequisites: ["infernoForgemaster"],
          dialogue: [
            "The sigil is whole again. Twelve voices, three keystones, and one choice freely made.",
            "The covenant names you its roadwarden. Take the Shadow Steed and carry its promise beyond these walls.",
          ],
        },
      ],
    },
  ],
  optionalObjectives: [
    {
      id: "swampHydra",
      type: "defeat",
      targetId: "swampHydra",
      description: "Optional: Defeat the Swamp Hydra.",
      unlockStage: 4,
    },
    {
      id: "youngRedDragon",
      type: "defeat",
      targetId: "dragon",
      description: "Optional: Defeat the Young Red Dragon.",
      unlockStage: 5,
    },
  ],
  completionRewards: [
    {
      id: "main:completionXp",
      type: "xp",
      amount: 2000,
      message: "Gained 2000 XP for restoring the covenant.",
    },
    {
      id: "main:completionGold",
      type: "gold",
      amount: 1000,
      message: "Received 1000 gold from the twelve cities.",
    },
    {
      id: "main:shadowSteed",
      type: "item",
      itemId: QUEST_ITEM_IDS.shadowSteed,
      unique: true,
      message: "The Shadow Steed is now yours.",
    },
    {
      id: "main:hydraBonus",
      type: "gold",
      amount: 300,
      optionalObjectiveId: "swampHydra",
      message: "The marsh cities add 300 gold for ending the hydra threat.",
    },
    {
      id: "main:dragonBonus",
      type: "xp",
      amount: 500,
      optionalObjectiveId: "youngRedDragon",
      message: "Gained 500 bonus XP for defeating the Young Red Dragon.",
    },
  ],
};

const IRON_DISPATCH_QUEST: QuestDefinition = {
  id: IRON_DISPATCH_QUEST_ID,
  title: "Ironbound Dispatch",
  kind: "side",
  summary: "Carry Ironhold's sealed dispatch to Sandport and report back.",
  startNpcId: QUEST_NPC_IDS.ironhold,
  unlockMainStage: 1,
  startDialogue: [
    "I have a smaller duty, if your road leads east.",
    "Deliver this sealed dispatch to Sable in Sandport, then bring me her answer.",
  ],
  startRewards: [
    {
      id: "dispatch:sealedLetter",
      type: "item",
      itemId: QUEST_ITEM_IDS.sealedDispatch,
      unique: true,
      message: "Received Ironhold's Sealed Dispatch.",
    },
  ],
  stages: [
    {
      id: "deliverDispatch",
      title: "Eastbound Message",
      summary: "Deliver Brann's sealed dispatch to Harbormaster Sable in Sandport.",
      objectives: [
        {
          id: "deliverToSable",
          type: "talk",
          targetId: QUEST_NPC_IDS.sandport,
          description: "Deliver the sealed dispatch to Sable in Sandport.",
          dialogue: [
            "Brann's seal has not crossed my desk in years.",
            "Tell him Sandport will reopen the iron route. He will know what that means.",
          ],
        },
      ],
      consumeItemIds: [QUEST_ITEM_IDS.sealedDispatch],
    },
    {
      id: "reportToBrann",
      title: "The Open Route",
      summary: "Return Sable's answer to Warden Brann.",
      objectives: [
        {
          id: "reportToBrann",
          type: "talk",
          targetId: QUEST_NPC_IDS.ironhold,
          description: "Report Sable's answer to Brann in Ironhold.",
          dialogue: [
            "The iron route opens again? Good. That road will outlive both of us.",
            "Take this key and our thanks. You have done more than carry a letter.",
          ],
        },
      ],
    },
  ],
  completionRewards: [
    {
      id: "dispatch:xp",
      type: "xp",
      amount: 300,
      message: "Gained 300 XP.",
    },
    {
      id: "dispatch:gold",
      type: "gold",
      amount: 200,
      message: "Received 200 gold.",
    },
    {
      id: "dispatch:dungeonKey",
      type: "item",
      itemId: "dungeonKey",
      message: "Received a Dungeon Key.",
    },
  ],
};

const FROST_SILK_QUEST: QuestDefinition = {
  id: FROST_SILK_QUEST_ID,
  title: "Silk Against the Cold",
  kind: "side",
  summary: "Gather enchanted silk from Frost Spiders for Seer Yrsa.",
  startNpcId: QUEST_NPC_IDS.frostheim,
  unlockMainStage: 2,
  startDialogue: [
    "The cold is cutting through our ward-cloths.",
    "Defeat three Frost Spiders. Their silk will bind itself into a usable bundle when enough has been gathered.",
  ],
  stages: [
    {
      id: "gatherSilk",
      title: "Threads of Winter",
      summary: "Defeat three Frost Spiders.",
      objectives: [
        {
          id: "frostSpiders",
          type: "defeat",
          targetId: "frostSpider",
          required: 3,
          description: "Defeat Frost Spiders.",
        },
      ],
      rewards: [
        {
          id: "frostSilk:bundle",
          type: "item",
          itemId: QUEST_ITEM_IDS.frostSilkBundle,
          unique: true,
          message: "The gathered silk formed a Frost Silk Bundle.",
        },
      ],
    },
    {
      id: "returnSilk",
      title: "Warmth for Frostheim",
      summary: "Return the Frost Silk Bundle to Seer Yrsa.",
      objectives: [
        {
          id: "returnSilkToYrsa",
          type: "talk",
          targetId: QUEST_NPC_IDS.frostheim,
          description: "Return the Frost Silk Bundle to Yrsa in Frostheim.",
          dialogue: [
            "This weave will hold. Frostheim's watch will sleep warmer because of you.",
            "Take these supplies. The northern roads demand preparation, not pride.",
          ],
        },
      ],
      consumeItemIds: [QUEST_ITEM_IDS.frostSilkBundle],
    },
  ],
  completionRewards: [
    {
      id: "frostSilk:xp",
      type: "xp",
      amount: 400,
      message: "Gained 400 XP.",
    },
    {
      id: "frostSilk:gold",
      type: "gold",
      amount: 250,
      message: "Received 250 gold.",
    },
    {
      id: "frostSilk:potions",
      type: "item",
      itemId: "greaterPotion",
      quantity: 2,
      message: "Received 2 Greater Healing Potions.",
    },
    {
      id: "frostSilk:ether",
      type: "item",
      itemId: "ether",
      message: "Received an Ether.",
    },
  ],
};

export const QUESTS: QuestDefinition[] = [
  MAIN_QUEST,
  IRON_DISPATCH_QUEST,
  FROST_SILK_QUEST,
];

export interface QuestAccessRule {
  id: string;
  type: "city" | "dungeon";
  targetId: string;
  minimumMainStage: number;
  requiredObjectiveIds?: string[];
  blockedMessage: string;
}

export const QUEST_ACCESS_RULES: QuestAccessRule[] = [
  {
    id: "heartlandsCryptSeal",
    type: "dungeon",
    targetId: "heartlands_dungeon",
    minimumMainStage: 1,
    requiredObjectiveIds: ["ironholdOath", "deeprootOath"],
    blockedMessage: "The crypt seal requires the oaths of Ironhold and Deeproot.",
  },
  {
    id: "canyonwatchPass",
    type: "city",
    targetId: "canyonwatch_city",
    minimumMainStage: 3,
    requiredObjectiveIds: ["sandportPass"],
    blockedMessage: "Canyonwatch requires the covenant pass from Sandport.",
  },
  {
    id: "volcanicForgeSeal",
    type: "dungeon",
    targetId: "volcanic_forge",
    minimumMainStage: 6,
    blockedMessage: "The forge seal will not open until all twelve city oaths are restored.",
  },
];

export interface QuestDangerRule {
  id: string;
  untilMainStage: number;
  cityIds: string[];
  dungeonIds: string[];
  chunks: Array<{ x: number; y: number }>;
  warning: string;
  encounterRateMultiplier: number;
  effectiveLevelOffset: number;
}

export const QUEST_DANGER_RULES: QuestDangerRule[] = [
  {
    id: "frostRouteDanger",
    untilMainStage: 2,
    cityIds: ["frostheim_city"],
    dungeonIds: ["frost_cavern"],
    chunks: [{ x: 1, y: 0 }, { x: 2, y: 0 }],
    warning: "The northern route is ahead of your covenant trail. Expect stronger, more frequent enemies.",
    encounterRateMultiplier: 1.5,
    effectiveLevelOffset: 4,
  },
  {
    id: "shadowfenDanger",
    untilMainStage: 4,
    cityIds: ["shadowfen_city"],
    dungeonIds: [],
    chunks: [{ x: 3, y: 7 }],
    warning: "Shadowfen has not joined your covenant trail. The surrounding wilds are especially dangerous.",
    encounterRateMultiplier: 1.5,
    effectiveLevelOffset: 4,
  },
  {
    id: "ashenWatchDanger",
    untilMainStage: 5,
    cityIds: ["ashfall_city", "ridgewatch_city"],
    dungeonIds: [],
    chunks: [{ x: 6, y: 4 }, { x: 9, y: 6 }],
    warning: "The ashen road lies beyond your current covenant trail. Powerful enemies patrol this region.",
    encounterRateMultiplier: 1.5,
    effectiveLevelOffset: 4,
  },
];

/** Create the default quest state for a new or pre-quest save. */
export function createInitialQuestLog(): QuestLogState {
  return {
    quests: {
      [MAIN_QUEST_ID]: {
        status: "active",
        stage: 0,
        objectives: {},
        claimedRewards: [],
      },
      [IRON_DISPATCH_QUEST_ID]: {
        status: "inactive",
        stage: 0,
        objectives: {},
        claimedRewards: [],
      },
      [FROST_SILK_QUEST_ID]: {
        status: "inactive",
        stage: 0,
        objectives: {},
        claimedRewards: [],
      },
    },
    seenWarnings: [],
  };
}

export function getQuestDefinition(questId: QuestId): QuestDefinition {
  const quest = QUESTS.find((entry) => entry.id === questId);
  if (!quest) throw new Error(`[quests] Missing definition for ${questId}`);
  return quest;
}

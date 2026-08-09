import type { AlignmentAxis, ReputationTargetKind, ReputationTierId } from "./reputation";
import type { QuestId } from "./quests";
import type { SkillCheckAbility } from "./skillChecks";
import type { TrapState } from "./traps";

export const ACHIEVEMENT_CATEGORIES = [
  "campaign",
  "combat",
  "exploration",
  "codex",
  "party",
  "world",
  "social",
  "collection",
] as const;

export type AchievementCategory = (typeof ACHIEVEMENT_CATEGORIES)[number];

export const ACHIEVEMENT_IDS = [
  "firstSealComplete",
  "stoneAndRootComplete",
  "winterWitnessComplete",
  "sunRoadComplete",
  "marshCovenantComplete",
  "ashenWatchComplete",
  "lastForgeComplete",
  "ironboundDispatchComplete",
  "silkAgainstColdComplete",
  "twelvefoldCovenantComplete",
  "unbrokenCovenant",
  "threeDungeonsCleared",
  "seasonedVictor",
  "legendaryVictor",
  "singleStroke",
  "keenEye",
  "skillMaster",
  "trapbreaker",
  "sixCities",
  "twelveCities",
  "worldCartographer",
  "monsterScholar",
  "familyScholar",
  "bestiaryMaster",
  "fullFellowship",
  "gambitMaster",
  "roadStories",
  "worldEventMaster",
  "goodHeart",
  "lawkeeper",
  "trustedTown",
  "exaltedFaction",
  "fullyEquipped",
  "relicCollector",
  "resourceGatherer",
  "rareHarvest",
  "masterGatherer",
] as const;

export type AchievementId = (typeof ACHIEVEMENT_IDS)[number];

export const TITLE_IDS = [
  "covenantRoadwarden",
  "unbroken",
  "deepdelver",
  "battleforged",
  "oneStroke",
  "trapbreaker",
  "wayfarer",
  "cartographer",
  "beastScholar",
  "fellowship",
  "eventWitness",
  "exalted",
  "relicKeeper",
  "realmGatherer",
] as const;

export type TitleId = (typeof TITLE_IDS)[number];

export type AchievementCounterKey =
  | "battleWins"
  | "oneHitDefeats";

export type AchievementCriteria =
  | {
    readonly type: "questStageCompleted";
    readonly questId: QuestId;
    readonly stageId: string;
  }
  | {
    readonly type: "questCompleted";
    readonly questId: QuestId;
  }
  | {
    readonly type: "bossDefeated";
    readonly bossId: string;
  }
  | {
    readonly type: "allDungeonsCompleted";
  }
  | {
    readonly type: "counter";
    readonly counter: AchievementCounterKey;
    readonly threshold: number;
  }
  | {
    readonly type: "noDefeatCampaign";
  }
  | {
    readonly type: "successfulSkillChecks";
    readonly threshold: number;
    readonly ability?: SkillCheckAbility;
  }
  | {
    readonly type: "trapStateCount";
    readonly state: TrapState;
    readonly threshold: number;
  }
  | {
    readonly type: "discoveredCities";
    readonly threshold: number;
  }
  | {
    readonly type: "exploredOverworldChunks";
    readonly threshold: number;
  }
  | {
    readonly type: "codexMonstersDiscovered";
    readonly threshold: number;
  }
  | {
    readonly type: "codexFamiliesCompleted";
    readonly threshold: number;
  }
  | {
    readonly type: "companionsRecruited";
    readonly threshold: number;
  }
  | {
    readonly type: "gambitCompanions";
    readonly threshold: number;
  }
  | {
    readonly type: "worldEventsResolved";
    readonly threshold: number;
    readonly unique: boolean;
  }
  | {
    readonly type: "alignmentAxis";
    readonly axis: AlignmentAxis;
    readonly minimum: number;
  }
  | {
    readonly type: "reputationTargetsAtTier";
    readonly targetKind: ReputationTargetKind;
    readonly tier: ReputationTierId;
    readonly threshold: number;
  }
  | {
    readonly type: "inventoryUniqueItems";
    readonly threshold: number;
  }
  | {
    readonly type: "fullyEquipped";
  }
  | {
    readonly type: "gatheringSuccesses";
    readonly threshold: number;
    readonly discipline?: "fishing" | "mining" | "foraging";
  }
  | {
    readonly type: "gatheringRareFinds";
    readonly threshold: number;
  }
  | {
    readonly type: "gatheringDisciplinesMastered";
    readonly successesPerDiscipline: number;
  };

export interface AchievementSourceMetadata {
  readonly kind:
    | "quest"
    | "boss"
    | "dungeon"
    | "combat"
    | "defeatHistory"
    | "skillCheck"
    | "trap"
    | "exploration"
    | "codex"
    | "companion"
    | "gambit"
    | "worldEvent"
    | "alignment"
    | "reputation"
    | "inventory"
    | "gathering";
  readonly authoritativeState: string;
  readonly targetIds?: readonly string[];
}

export interface AchievementDefinition {
  readonly id: AchievementId;
  readonly name: string;
  readonly description: string;
  readonly category: AchievementCategory;
  readonly points: number;
  readonly hidden?: boolean;
  readonly criteria: AchievementCriteria;
  readonly rewardTitleId?: TitleId;
  readonly source: AchievementSourceMetadata;
}

export interface TitleDefinition {
  readonly id: TitleId;
  readonly name: string;
  readonly description: string;
  readonly achievementId: AchievementId;
}

const MAIN_QUEST = "twelvefoldCovenant" as const;

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  {
    id: "firstSealComplete",
    name: "The First Seal",
    description: "Learn why the Twelvefold Covenant is failing.",
    category: "campaign",
    points: 10,
    criteria: { type: "questStageCompleted", questId: MAIN_QUEST, stageId: "firstSeal" },
    source: { kind: "quest", authoritativeState: "Quest stage", targetIds: [MAIN_QUEST, "firstSeal"] },
  },
  {
    id: "stoneAndRootComplete",
    name: "Stone and Root",
    description: "Unite Ironhold and Deeproot and reclaim the Heartlands keystone.",
    category: "campaign",
    points: 20,
    criteria: { type: "questStageCompleted", questId: MAIN_QUEST, stageId: "stoneAndRoot" },
    source: { kind: "quest", authoritativeState: "Quest stage and boss reconciliation", targetIds: [MAIN_QUEST, "cryptLich"] },
  },
  {
    id: "winterWitnessComplete",
    name: "The Winter Witness",
    description: "Join Frostheim and Thornvale and reclaim the frozen keystone.",
    category: "campaign",
    points: 20,
    criteria: { type: "questStageCompleted", questId: MAIN_QUEST, stageId: "winterWitness" },
    source: { kind: "quest", authoritativeState: "Quest stage and boss reconciliation", targetIds: [MAIN_QUEST, "frostWarden"] },
  },
  {
    id: "sunRoadComplete",
    name: "The Sun Road",
    description: "Carry the covenant through Sandport, Canyonwatch, and Dunerest.",
    category: "campaign",
    points: 15,
    criteria: { type: "questStageCompleted", questId: MAIN_QUEST, stageId: "sunRoad" },
    source: { kind: "quest", authoritativeState: "Quest stage", targetIds: [MAIN_QUEST, "sunRoad"] },
  },
  {
    id: "marshCovenantComplete",
    name: "The Marsh Covenant",
    description: "Renew the oaths of Bogtown and Shadowfen.",
    category: "campaign",
    points: 15,
    criteria: { type: "questStageCompleted", questId: MAIN_QUEST, stageId: "marshCovenant" },
    source: { kind: "quest", authoritativeState: "Quest stage", targetIds: [MAIN_QUEST, "marshCovenant"] },
  },
  {
    id: "ashenWatchComplete",
    name: "The Ashen Watch",
    description: "Win the final city oaths from Ashfall and Ridgewatch.",
    category: "campaign",
    points: 15,
    criteria: { type: "questStageCompleted", questId: MAIN_QUEST, stageId: "ashenWatch" },
    source: { kind: "quest", authoritativeState: "Quest stage", targetIds: [MAIN_QUEST, "ashenWatch"] },
  },
  {
    id: "lastForgeComplete",
    name: "The Last Forge",
    description: "Defeat the Inferno Forgemaster and recover the third keystone.",
    category: "campaign",
    points: 30,
    criteria: { type: "bossDefeated", bossId: "infernoForgemaster" },
    source: { kind: "boss", authoritativeState: "Defeated boss set", targetIds: ["infernoForgemaster"] },
  },
  {
    id: "ironboundDispatchComplete",
    name: "Ironbound Courier",
    description: "Complete Ironbound Dispatch and reopen the iron route.",
    category: "campaign",
    points: 15,
    criteria: { type: "questCompleted", questId: "ironboundDispatch" },
    source: { kind: "quest", authoritativeState: "Quest completion", targetIds: ["ironboundDispatch"] },
  },
  {
    id: "silkAgainstColdComplete",
    name: "Silk Against the Cold",
    description: "Restore Frostheim's ward-cloths.",
    category: "campaign",
    points: 15,
    criteria: { type: "questCompleted", questId: "silkAgainstTheCold" },
    source: { kind: "quest", authoritativeState: "Quest completion", targetIds: ["silkAgainstTheCold"] },
  },
  {
    id: "twelvefoldCovenantComplete",
    name: "Covenant Restored",
    description: "Restore all twelve oaths, reclaim the keystones, and return to Elowen.",
    category: "campaign",
    points: 50,
    criteria: { type: "questCompleted", questId: MAIN_QUEST },
    rewardTitleId: "covenantRoadwarden",
    source: { kind: "quest", authoritativeState: "Canonical main quest completion", targetIds: [MAIN_QUEST] },
  },
  {
    id: "unbrokenCovenant",
    name: "Unbroken Covenant",
    description: "Complete the campaign without a recorded party defeat.",
    category: "campaign",
    points: 50,
    hidden: true,
    criteria: { type: "noDefeatCampaign" },
    rewardTitleId: "unbroken",
    source: { kind: "defeatHistory", authoritativeState: "Schema-v13 defeat history", targetIds: [MAIN_QUEST] },
  },
  {
    id: "threeDungeonsCleared",
    name: "Master of the Three Depths",
    description: "Defeat the deepest guardian of every dungeon.",
    category: "exploration",
    points: 40,
    criteria: { type: "allDungeonsCompleted" },
    rewardTitleId: "deepdelver",
    source: { kind: "dungeon", authoritativeState: "Dungeon boss definitions and defeated boss set" },
  },
  {
    id: "seasonedVictor",
    name: "Seasoned Victor",
    description: "Win 10 battles.",
    category: "combat",
    points: 15,
    criteria: { type: "counter", counter: "battleWins", threshold: 10 },
    source: { kind: "combat", authoritativeState: "Once-only battle result counter" },
  },
  {
    id: "legendaryVictor",
    name: "Battleforged",
    description: "Win 50 battles.",
    category: "combat",
    points: 30,
    criteria: { type: "counter", counter: "battleWins", threshold: 50 },
    rewardTitleId: "battleforged",
    source: { kind: "combat", authoritativeState: "Once-only battle result counter" },
  },
  {
    id: "singleStroke",
    name: "Single Stroke",
    description: "Defeat a full-health enemy with one damaging action.",
    category: "combat",
    points: 20,
    hidden: true,
    criteria: { type: "counter", counter: "oneHitDefeats", threshold: 1 },
    rewardTitleId: "oneStroke",
    source: { kind: "combat", authoritativeState: "Battle damage event" },
  },
  {
    id: "keenEye",
    name: "Keen Eye",
    description: "Succeed at 5 Wisdom skill checks.",
    category: "exploration",
    points: 15,
    criteria: { type: "successfulSkillChecks", threshold: 5, ability: "wisdom" },
    source: { kind: "skillCheck", authoritativeState: "Persistent skill-check records" },
  },
  {
    id: "skillMaster",
    name: "Tested and Proven",
    description: "Succeed at 20 persistent non-combat skill checks.",
    category: "exploration",
    points: 25,
    criteria: { type: "successfulSkillChecks", threshold: 20 },
    source: { kind: "skillCheck", authoritativeState: "Persistent skill-check records" },
  },
  {
    id: "trapbreaker",
    name: "Trapbreaker",
    description: "Disarm 10 dungeon traps.",
    category: "exploration",
    points: 25,
    criteria: { type: "trapStateCount", state: "disarmed", threshold: 10 },
    rewardTitleId: "trapbreaker",
    source: { kind: "trap", authoritativeState: "Persistent trap lifecycle state" },
  },
  {
    id: "sixCities",
    name: "Half the Covenant",
    description: "Discover 6 cities.",
    category: "exploration",
    points: 10,
    criteria: { type: "discoveredCities", threshold: 6 },
    source: { kind: "exploration", authoritativeState: "Discovered city IDs" },
  },
  {
    id: "twelveCities",
    name: "Twelve Roads",
    description: "Discover all 12 cities.",
    category: "exploration",
    points: 30,
    criteria: { type: "discoveredCities", threshold: 12 },
    rewardTitleId: "wayfarer",
    source: { kind: "exploration", authoritativeState: "Discovered city IDs" },
  },
  {
    id: "worldCartographer",
    name: "No Blank Spaces",
    description: "Reveal at least one tile in every overworld chunk.",
    category: "exploration",
    points: 40,
    hidden: true,
    criteria: { type: "exploredOverworldChunks", threshold: 90 },
    rewardTitleId: "cartographer",
    source: { kind: "exploration", authoritativeState: "Fog-of-war explored tile keys" },
  },
  {
    id: "monsterScholar",
    name: "Monster Scholar",
    description: "Discover 25 monsters in the Codex.",
    category: "codex",
    points: 15,
    criteria: { type: "codexMonstersDiscovered", threshold: 25 },
    source: { kind: "codex", authoritativeState: "Monster Codex entries" },
  },
  {
    id: "familyScholar",
    name: "Family Resemblance",
    description: "Complete one monster family in the Codex.",
    category: "codex",
    points: 15,
    criteria: { type: "codexFamiliesCompleted", threshold: 1 },
    source: { kind: "codex", authoritativeState: "Derived Codex family completion" },
  },
  {
    id: "bestiaryMaster",
    name: "Master of Monsters",
    description: "Complete every monster family in the Codex.",
    category: "codex",
    points: 50,
    criteria: { type: "codexFamiliesCompleted", threshold: 14 },
    rewardTitleId: "beastScholar",
    source: { kind: "codex", authoritativeState: "Derived Codex family completion" },
  },
  {
    id: "fullFellowship",
    name: "Full Fellowship",
    description: "Recruit the Guardian, Scout, and Mystic.",
    category: "party",
    points: 25,
    criteria: { type: "companionsRecruited", threshold: 3 },
    rewardTitleId: "fellowship",
    source: { kind: "companion", authoritativeState: "Persistent unique companion roster" },
  },
  {
    id: "gambitMaster",
    name: "Plans Within Plans",
    description: "Configure an enabled gambit for every companion.",
    category: "party",
    points: 20,
    criteria: { type: "gambitCompanions", threshold: 3 },
    source: { kind: "gambit", authoritativeState: "Normalized companion gambit rules" },
  },
  {
    id: "roadStories",
    name: "Road Stories",
    description: "Resolve 5 World Events.",
    category: "world",
    points: 15,
    criteria: { type: "worldEventsResolved", threshold: 5, unique: false },
    source: { kind: "worldEvent", authoritativeState: "World Event repeat counters" },
  },
  {
    id: "worldEventMaster",
    name: "Witness to the Realm",
    description: "Resolve every kind of World Event.",
    category: "world",
    points: 35,
    criteria: { type: "worldEventsResolved", threshold: 7, unique: true },
    rewardTitleId: "eventWitness",
    source: { kind: "worldEvent", authoritativeState: "World Event repeat counters" },
  },
  {
    id: "goodHeart",
    name: "A Good Heart",
    description: "Reach Good on the Good/Evil alignment axis.",
    category: "social",
    points: 15,
    criteria: { type: "alignmentAxis", axis: "goodEvil", minimum: 25 },
    source: { kind: "alignment", authoritativeState: "Bounded alignment scores" },
  },
  {
    id: "lawkeeper",
    name: "Keeper of Order",
    description: "Reach Lawful on the Law/Chaos alignment axis.",
    category: "social",
    points: 15,
    criteria: { type: "alignmentAxis", axis: "lawChaos", minimum: 25 },
    source: { kind: "alignment", authoritativeState: "Bounded alignment scores" },
  },
  {
    id: "trustedTown",
    name: "A Name They Trust",
    description: "Reach Trusted reputation with any town.",
    category: "social",
    points: 20,
    criteria: { type: "reputationTargetsAtTier", targetKind: "town", tier: "trusted", threshold: 1 },
    source: { kind: "reputation", authoritativeState: "Town reputation tiers" },
  },
  {
    id: "exaltedFaction",
    name: "Exalted Service",
    description: "Reach Exalted reputation with any faction.",
    category: "social",
    points: 30,
    criteria: { type: "reputationTargetsAtTier", targetKind: "faction", tier: "exalted", threshold: 1 },
    rewardTitleId: "exalted",
    source: { kind: "reputation", authoritativeState: "Faction reputation tiers" },
  },
  {
    id: "fullyEquipped",
    name: "Ready for Anything",
    description: "Equip a weapon, armor, and either a shield or off-hand weapon.",
    category: "collection",
    points: 10,
    criteria: { type: "fullyEquipped" },
    source: { kind: "inventory", authoritativeState: "Relinked equipment references" },
  },
  {
    id: "relicCollector",
    name: "Relic Collector",
    description: "Carry 20 distinct item types at once.",
    category: "collection",
    points: 20,
    criteria: { type: "inventoryUniqueItems", threshold: 20 },
    rewardTitleId: "relicKeeper",
    source: { kind: "inventory", authoritativeState: "Canonical inventory item IDs" },
  },
  {
    id: "resourceGatherer",
    name: "Working the Wilds",
    description: "Complete 10 successful gathering attempts.",
    category: "collection",
    points: 15,
    criteria: { type: "gatheringSuccesses", threshold: 10 },
    source: { kind: "gathering", authoritativeState: "Persistent gathering discipline statistics" },
  },
  {
    id: "rareHarvest",
    name: "Against the Odds",
    description: "Secure a rare gathering find.",
    category: "collection",
    points: 20,
    hidden: true,
    criteria: { type: "gatheringRareFinds", threshold: 1 },
    source: { kind: "gathering", authoritativeState: "Persistent once-only rare gathering rewards" },
  },
  {
    id: "masterGatherer",
    name: "Threefold Provider",
    description: "Succeed at fishing, mining, and foraging at least 5 times each.",
    category: "collection",
    points: 35,
    criteria: {
      type: "gatheringDisciplinesMastered",
      successesPerDiscipline: 5,
    },
    rewardTitleId: "realmGatherer",
    source: { kind: "gathering", authoritativeState: "Per-discipline gathering statistics" },
  },
] as const;

export const TITLES: readonly TitleDefinition[] = [
  { id: "covenantRoadwarden", name: "Covenant Roadwarden", description: "Bearer of the restored Twelvefold Covenant.", achievementId: "twelvefoldCovenantComplete" },
  { id: "unbroken", name: "The Unbroken", description: "Completed the covenant road without defeat.", achievementId: "unbrokenCovenant" },
  { id: "deepdelver", name: "Deepdelver", description: "Conqueror of the realm's three deepest dungeons.", achievementId: "threeDungeonsCleared" },
  { id: "battleforged", name: "Battleforged", description: "Veteran of fifty victories.", achievementId: "legendaryVictor" },
  { id: "oneStroke", name: "One-Stroke", description: "Ended a fight before the foe could yield a step.", achievementId: "singleStroke" },
  { id: "trapbreaker", name: "Trapbreaker", description: "Master of dungeon mechanisms and runes.", achievementId: "trapbreaker" },
  { id: "wayfarer", name: "Wayfarer", description: "Known in all twelve cities.", achievementId: "twelveCities" },
  { id: "cartographer", name: "Cartographer", description: "Left no overworld region uncharted.", achievementId: "worldCartographer" },
  { id: "beastScholar", name: "Beast Scholar", description: "Completed every monster family record.", achievementId: "bestiaryMaster" },
  { id: "fellowship", name: "of the Fellowship", description: "Recruited every companion.", achievementId: "fullFellowship" },
  { id: "eventWitness", name: "Realm Witness", description: "Witnessed every kind of World Event.", achievementId: "worldEventMaster" },
  { id: "exalted", name: "The Exalted", description: "Earned a faction's highest regard.", achievementId: "exaltedFaction" },
  { id: "relicKeeper", name: "Relic Keeper", description: "Carried a collection worthy of a royal archive.", achievementId: "relicCollector" },
  { id: "realmGatherer", name: "Realm Gatherer", description: "Mastered fishing, mining, and foraging.", achievementId: "masterGatherer" },
] as const;

const ACHIEVEMENT_BY_ID = new Map(
  ACHIEVEMENTS.map((achievement) => [achievement.id, achievement]),
);
const TITLE_BY_ID = new Map(TITLES.map((title) => [title.id, title]));

export function isAchievementId(value: unknown): value is AchievementId {
  return typeof value === "string"
    && (ACHIEVEMENT_IDS as readonly string[]).includes(value);
}

export function isTitleId(value: unknown): value is TitleId {
  return typeof value === "string"
    && (TITLE_IDS as readonly string[]).includes(value);
}

export function getAchievement(
  achievementId: AchievementId,
): AchievementDefinition {
  return ACHIEVEMENT_BY_ID.get(achievementId)!;
}

export function getTitle(titleId: TitleId): TitleDefinition {
  return TITLE_BY_ID.get(titleId)!;
}
